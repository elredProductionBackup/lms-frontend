import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api, withPage, PAGE_SIZE } from "@/lib/api";

// Notes belong to ONE recording of a course. List + create are scoped by
// :videoId; edit / delete by noteId are unchanged. The old /courses/:id/notes
// path now 404s ROUTE_NOT_FOUND.
const notesPath = (courseId, videoId) => `/courses/${courseId}/videos/${videoId}/notes`;

// Ignore results for a recording the learner has already switched away from.
const isCurrent = (s, a) => !!a.meta.arg?.videoId && a.meta.arg.videoId === s.videoId;

// GET /api/courses/:id/videos/:videoId/notes?start=&offset=
// Caller's own notes on this recording only, newest-first.
export const fetchNotes = createAsyncThunk(
  "notes/list",
  async ({ courseId, videoId, start = 0, offset = PAGE_SIZE, append = false }, { rejectWithValue }) => {
    try {
      const data = await api.get(withPage(notesPath(courseId, videoId), { start, offset }));
      const items = data.notes || [];
      return { items, start, append, hasMore: items.length === offset };
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/courses/:id/videos/:videoId/notes  { text, timestampSeconds? }
export const addNote = createAsyncThunk(
  "notes/add",
  async ({ courseId, videoId, text, timestampSeconds }, { rejectWithValue }) => {
    try {
      return await api.post(notesPath(courseId, videoId), {
        text,
        timestampSeconds,
      });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/notes/:noteId  { text }  (unchanged)
export const updateNote = createAsyncThunk(
  "notes/update",
  async ({ noteId, text }, { rejectWithValue }) => {
    try {
      return await api.put(`/notes/${noteId}`, { text });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// DELETE /api/notes/:noteId  (unchanged; 200 even if already gone)
export const deleteNote = createAsyncThunk(
  "notes/delete",
  async (noteId, { rejectWithValue }) => {
    try {
      await api.del(`/notes/${noteId}`);
      return noteId;
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

const initialState = {
  videoId: null, // recording whose notes are loaded
  items: [],
  status: "idle",
  hasMore: false,
  start: 0, // records loaded so far (next fetch's start)
  loadingMore: false,
  saving: false,
  error: null,
};

const slice = createSlice({
  name: "notes",
  initialState,
  reducers: {
    // Point the notes tab at a recording, dropping the previous one's notes.
    setNotesVideo(s, a) {
      const videoId = a.payload || null;
      if (s.videoId === videoId) return;
      Object.assign(s, initialState, { videoId });
    },
    clearNotes() {
      return initialState;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchNotes.pending, (s, a) => {
      if (!isCurrent(s, a)) return;
      if (a.meta.arg?.append) s.loadingMore = true;
      else s.status = "loading";
    })
      .addCase(fetchNotes.fulfilled, (s, a) => {
        if (!isCurrent(s, a)) return;
        const { items, start, append, hasMore } = a.payload;
        s.status = "idle";
        s.loadingMore = false;
        s.items = append ? [...s.items, ...items] : items;
        s.start = start + items.length;
        s.hasMore = hasMore;
      })
      .addCase(fetchNotes.rejected, (s, a) => {
        if (!isCurrent(s, a)) return;
        s.status = "error";
        s.loadingMore = false;
        s.error = a.payload?.message;
      });

    b.addCase(addNote.pending, (s) => {
      s.saving = true;
      s.error = null;
    })
      .addCase(addNote.fulfilled, (s, a) => {
        s.saving = false;
        if (!isCurrent(s, a)) return;
        s.items.unshift(a.payload); // newest-first
        s.start += 1;
      })
      .addCase(addNote.rejected, (s, a) => {
        s.saving = false;
        s.error = a.payload?.message;
      });

    b.addCase(updateNote.fulfilled, (s, a) => {
      const i = s.items.findIndex((n) => n._id === a.payload._id);
      if (i >= 0) s.items[i] = a.payload;
    });

    b.addCase(deleteNote.fulfilled, (s, a) => {
      const before = s.items.length;
      s.items = s.items.filter((n) => n._id !== a.payload);
      if (s.items.length < before) s.start = Math.max(0, s.start - 1);
    });
  },
});

export const { setNotesVideo, clearNotes } = slice.actions;
export default slice.reducer;
