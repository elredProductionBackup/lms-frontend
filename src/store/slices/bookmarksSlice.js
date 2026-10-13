import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api, withPage } from "@/lib/api";

// Bookmarks: a learner's private saved spots in ONE recording, created by the
// player's Bookmark button. Strictly owner-only (no admin/author override) and
// returned in timeline order (timestampSeconds ascending), not save order.
//
//   GET    /courses/:id/videos/:videoId/bookmarks   list (page size 100)
//   POST   /courses/:id/videos/:videoId/bookmarks   { timestampSeconds, label? }
//   PUT    /bookmarks/:bookmarkId                   { label }  ("" clears it)
//   DELETE /bookmarks/:bookmarkId                   200 even if already gone
//
// The backend stores whole seconds (2.7 -> 2) and keeps one bookmark per second
// per video per learner: re-bookmarking a saved second returns that same
// bookmark, so double-clicks never create duplicates.

export const BOOKMARK_PAGE_SIZE = 100;
// Safety cap on how many pages we'll walk for one recording's markers.
const MAX_BOOKMARK_PAGES = 20;

const bookmarksPath = (courseId, videoId) =>
  `/courses/${courseId}/videos/${videoId}/bookmarks`;

const isCurrent = (s, a) => !!a.meta.arg?.videoId && a.meta.arg.videoId === s.videoId;

const byTime = (a, b) => (a.timestampSeconds ?? 0) - (b.timestampSeconds ?? 0);

function upsert(list, doc) {
  const next = list.filter((b) => b._id !== doc._id);
  next.push(doc);
  return next.sort(byTime);
}

// GET /api/courses/:id/videos/:videoId/bookmarks
// The seek bar needs every marker, so walk the pages (100 each) until a short
// page comes back. Almost always a single request.
export const fetchBookmarks = createAsyncThunk(
  "bookmarks/list",
  async ({ courseId, videoId }, { rejectWithValue }) => {
    try {
      const all = [];
      for (let page = 0; page < MAX_BOOKMARK_PAGES; page++) {
        const data = await api.get(
          withPage(bookmarksPath(courseId, videoId), {
            start: page * BOOKMARK_PAGE_SIZE,
            offset: BOOKMARK_PAGE_SIZE,
          })
        );
        const items = data.bookmarks || [];
        all.push(...items);
        if (items.length < BOOKMARK_PAGE_SIZE) break;
      }
      return all;
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/courses/:id/videos/:videoId/bookmarks  { timestampSeconds, label? }
// timestampSeconds is the player's raw currentTime; the backend floors it.
//
// Two clicks landing in the same second at the same instant can race: one gets
// 201, the other may get 409 DUPLICATE. That's still a success from the
// learner's point of view, so we resolve with { duplicate: true } and refetch.
export const addBookmark = createAsyncThunk(
  "bookmarks/add",
  async ({ courseId, videoId, timestampSeconds, label }, { dispatch, rejectWithValue }) => {
    try {
      const body = { timestampSeconds };
      if (label != null) body.label = label;
      return await api.post(bookmarksPath(courseId, videoId), body);
    } catch (e) {
      if (e.status === 409 || e.code === "DUPLICATE") {
        dispatch(fetchBookmarks({ courseId, videoId }));
        return { duplicate: true };
      }
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/bookmarks/:bookmarkId  { label }  — rename only. The timestamp can't
// be moved: delete and save a new one instead.
export const renameBookmark = createAsyncThunk(
  "bookmarks/rename",
  async ({ bookmarkId, label }, { rejectWithValue }) => {
    try {
      return await api.put(`/bookmarks/${bookmarkId}`, { label: label ?? "" });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// DELETE /api/bookmarks/:bookmarkId  -> { ok: true }
export const deleteBookmark = createAsyncThunk(
  "bookmarks/delete",
  async (bookmarkId, { rejectWithValue }) => {
    try {
      await api.del(`/bookmarks/${bookmarkId}`);
      return bookmarkId;
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

const initialState = {
  videoId: null, // recording whose bookmarks are loaded
  items: [], // sorted by timestampSeconds ascending
  status: "idle",
  saving: false,
  error: null,
};

const slice = createSlice({
  name: "bookmarks",
  initialState,
  reducers: {
    setBookmarksVideo(s, a) {
      const videoId = a.payload || null;
      if (s.videoId === videoId) return;
      Object.assign(s, initialState, { videoId });
    },
    clearBookmarks() {
      return initialState;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchBookmarks.pending, (s, a) => {
      if (!isCurrent(s, a)) return;
      // Keep showing existing markers during a background refetch.
      if (s.items.length === 0) s.status = "loading";
    })
      .addCase(fetchBookmarks.fulfilled, (s, a) => {
        if (!isCurrent(s, a)) return;
        s.status = "idle";
        s.items = [...a.payload].sort(byTime);
      })
      .addCase(fetchBookmarks.rejected, (s, a) => {
        if (!isCurrent(s, a)) return;
        s.status = "error";
        s.error = a.payload?.message;
      });

    b.addCase(addBookmark.pending, (s) => {
      s.saving = true;
      s.error = null;
    })
      .addCase(addBookmark.fulfilled, (s, a) => {
        s.saving = false;
        if (!isCurrent(s, a) || a.payload?.duplicate || !a.payload?._id) return;
        s.items = upsert(s.items, a.payload);
      })
      .addCase(addBookmark.rejected, (s, a) => {
        s.saving = false;
        s.error = a.payload?.message;
      });

    b.addCase(renameBookmark.fulfilled, (s, a) => {
      if (s.items.some((x) => x._id === a.payload?._id)) {
        s.items = upsert(s.items, a.payload);
      }
    }).addCase(renameBookmark.rejected, (s, a) => {
      s.error = a.payload?.message;
    });

    b.addCase(deleteBookmark.fulfilled, (s, a) => {
      s.items = s.items.filter((x) => x._id !== a.payload);
    }).addCase(deleteBookmark.rejected, (s, a) => {
      s.error = a.payload?.message;
    });
  },
});

export const { setBookmarksVideo, clearBookmarks } = slice.actions;
export default slice.reducer;
