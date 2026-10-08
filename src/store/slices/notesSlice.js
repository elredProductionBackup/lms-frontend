import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

// GET /api/courses/:id/notes  (private, newest-first)
export const fetchNotes = createAsyncThunk(
  "notes/list",
  async (courseId, { rejectWithValue }) => {
    try {
      const data = await api.get(`/courses/${courseId}/notes`);
      return data.notes || [];
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/courses/:id/notes  { text, timestampSeconds? }
export const addNote = createAsyncThunk(
  "notes/add",
  async ({ courseId, text, timestampSeconds }, { rejectWithValue }) => {
    try {
      return await api.post(`/courses/${courseId}/notes`, {
        text,
        timestampSeconds,
      });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/notes/:noteId  { text }
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

// DELETE /api/notes/:noteId
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

const slice = createSlice({
  name: "notes",
  initialState: { items: [], status: "idle", saving: false, error: null },
  reducers: {
    clearNotes(s) {
      s.items = [];
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchNotes.pending, (s) => {
      s.status = "loading";
    })
      .addCase(fetchNotes.fulfilled, (s, a) => {
        s.status = "idle";
        s.items = a.payload;
      })
      .addCase(fetchNotes.rejected, (s, a) => {
        s.status = "error";
        s.error = a.payload?.message;
      });

    b.addCase(addNote.pending, (s) => {
      s.saving = true;
    })
      .addCase(addNote.fulfilled, (s, a) => {
        s.saving = false;
        s.items.unshift(a.payload);
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
      s.items = s.items.filter((n) => n._id !== a.payload);
    });
  },
});

export const { clearNotes } = slice.actions;
export default slice.reducer;
