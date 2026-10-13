import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api, withPage, PAGE_SIZE } from "@/lib/api";

// Keep pinned items on top (most-recently-pinned first), then leave everyone
// else in the order the server already returned them (comments oldest-first,
// questions newest-first). Array.prototype.sort is stable, so the non-pinned
// tail keeps its relative order. Mirrors the backend's pinned-first sort so we
// don't need a round-trip after every pin/unpin.
function sortPinnedFirst(list) {
  return [...list].sort((a, b) => {
    if (a.isPinned && b.isPinned) {
      return new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0);
    }
    if (a.isPinned) return -1;
    if (b.isPinned) return 1;
    return 0;
  });
}

// Comments, questions and notes belong to ONE recording of a course, not the
// course as a whole. Every list/create route is scoped by :videoId:
//
//   /courses/:id/videos/:videoId/comments
//   /courses/:id/videos/:videoId/questions
//
// The old course-level paths (/courses/:id/comments, ...) now 404
// ROUTE_NOT_FOUND. By-id routes (pin / unpin / reply / delete / detail) are
// unchanged.
const videoPath = (courseId, videoId, kind) =>
  `/courses/${courseId}/videos/${videoId}/${kind}`;

// True when a thunk's result is for the recording that's loaded right now.
// Switching recordings can leave a request in flight for the previous one; its
// response must not land in the new recording's panel.
const isCurrent = (s, a) => !!a.meta.arg?.videoId && a.meta.arg.videoId === s.videoId;

// ---- Comments ----

// GET /api/courses/:id/videos/:videoId/comments?start=&offset=
// (pinned-first, then oldest-first, this recording only)
export const fetchComments = createAsyncThunk(
  "disc/comments/list",
  async ({ courseId, videoId, start = 0, offset = PAGE_SIZE, append = false }, { rejectWithValue }) => {
    try {
      const data = await api.get(withPage(videoPath(courseId, videoId, "comments"), { start, offset }));
      const items = data.comments || [];
      return { items, start, offset, append, hasMore: items.length === offset };
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/courses/:id/videos/:videoId/comments  { text, timestampSeconds? }
// timestampSeconds only timestamps the comment; it does NOT save a bookmark.
export const addComment = createAsyncThunk(
  "disc/comments/add",
  async ({ courseId, videoId, text, timestampSeconds }, { rejectWithValue }) => {
    try {
      return await api.post(videoPath(courseId, videoId, "comments"), {
        text,
        timestampSeconds,
      });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// DELETE /api/comments/:commentId
export const deleteComment = createAsyncThunk(
  "disc/comments/delete",
  async (commentId, { rejectWithValue }) => {
    try {
      await api.del(`/comments/${commentId}`);
      return commentId;
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/comments/:commentId/pin  (course author / admin only) -> full comment
export const pinComment = createAsyncThunk(
  "disc/comments/pin",
  async (commentId, { rejectWithValue }) => {
    try {
      return await api.put(`/comments/${commentId}/pin`, null);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/comments/:commentId/unpin  (course author / admin only) -> full comment
export const unpinComment = createAsyncThunk(
  "disc/comments/unpin",
  async (commentId, { rejectWithValue }) => {
    try {
      return await api.put(`/comments/${commentId}/unpin`, null);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/comments/:commentId/replies  { body }  (any unlocked user)
// Returns 201 with the full parent comment, replies included.
export const replyToComment = createAsyncThunk(
  "disc/comments/reply",
  async ({ commentId, body }, { rejectWithValue }) => {
    try {
      return await api.post(`/comments/${commentId}/replies`, { body });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// ---- Questions (now public, same model as comments) ----

// GET /api/courses/:id/videos/:videoId/questions?start=&offset=
// (pinned-first, then newest-first, this recording only)
export const fetchQuestions = createAsyncThunk(
  "disc/questions/list",
  async ({ courseId, videoId, start = 0, offset = PAGE_SIZE, append = false }, { rejectWithValue }) => {
    try {
      const data = await api.get(withPage(videoPath(courseId, videoId, "questions"), { start, offset }));
      const items = data.questions || [];
      return { items, start, offset, append, hasMore: items.length === offset };
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/courses/:id/videos/:videoId/questions  { body, timestampSeconds? }
export const askQuestion = createAsyncThunk(
  "disc/questions/ask",
  async ({ courseId, videoId, body, timestampSeconds }, { rejectWithValue }) => {
    try {
      return await api.post(videoPath(courseId, videoId, "questions"), {
        body,
        timestampSeconds,
      });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// GET /api/questions/:questionId  (now public to any unlocked user)
// The response includes videoId, so a deep link can open the right recording.
export const fetchQuestionDetail = createAsyncThunk(
  "disc/questions/detail",
  async (questionId, { rejectWithValue }) => {
    try {
      return await api.get(`/questions/${questionId}`);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/questions/:questionId/replies  { body }
// Now open to ANY unlocked user (was author/admin only). No status flip anymore.
export const replyToQuestion = createAsyncThunk(
  "disc/questions/reply",
  async ({ questionId, body }, { rejectWithValue }) => {
    try {
      return await api.post(`/questions/${questionId}/replies`, { body });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/questions/:questionId/pin  (course author / admin only)
export const pinQuestion = createAsyncThunk(
  "disc/questions/pin",
  async (questionId, { rejectWithValue }) => {
    try {
      return await api.put(`/questions/${questionId}/pin`, null);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/questions/:questionId/unpin  (course author / admin only)
export const unpinQuestion = createAsyncThunk(
  "disc/questions/unpin",
  async (questionId, { rejectWithValue }) => {
    try {
      return await api.put(`/questions/${questionId}/unpin`, null);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// Replace or insert a full record returned from a mutation, then re-sort so the
// pinned tier stays on top.
function upsertSorted(list, doc) {
  const i = list.findIndex((x) => x._id === doc._id);
  if (i >= 0) list[i] = doc;
  return sortPinnedFirst(list);
}

const slice = createSlice({
  name: "discussions",
  initialState: {
    videoId: null, // recording whose comments/questions are loaded
    comments: [],
    questions: [],
    activeQuestion: null,
    commentsStatus: "idle",
    questionsStatus: "idle",
    commentsHasMore: false,
    questionsHasMore: false,
    commentsStart: 0, // records loaded so far (next fetch's start)
    questionsStart: 0,
    loadingMoreComments: false,
    loadingMoreQuestions: false,
    posting: false,
    error: null,
  },
  reducers: {
    // Point the panel at a recording. Nothing carries over between recordings,
    // so everything loaded for the previous one is dropped.
    setDiscussionVideo(s, a) {
      const videoId = a.payload || null;
      if (s.videoId === videoId) return;
      s.videoId = videoId;
      s.comments = [];
      s.questions = [];
      s.activeQuestion = null;
      s.commentsStatus = "idle";
      s.questionsStatus = "idle";
      s.commentsHasMore = false;
      s.questionsHasMore = false;
      s.commentsStart = 0;
      s.questionsStart = 0;
      s.loadingMoreComments = false;
      s.loadingMoreQuestions = false;
      s.error = null;
    },
    clearDiscussions(s) {
      s.videoId = null;
      s.comments = [];
      s.questions = [];
      s.activeQuestion = null;
      s.commentsHasMore = false;
      s.questionsHasMore = false;
      s.commentsStart = 0;
      s.questionsStart = 0;
    },
  },
  extraReducers: (b) => {
    // ----- comments -----
    b.addCase(fetchComments.pending, (s, a) => {
      if (!isCurrent(s, a)) return;
      if (a.meta.arg?.append) s.loadingMoreComments = true;
      else s.commentsStatus = "loading";
    })
      .addCase(fetchComments.fulfilled, (s, a) => {
        if (!isCurrent(s, a)) return;
        s.commentsStatus = "idle";
        s.loadingMoreComments = false;
        const { items, start, append, hasMore } = a.payload;
        s.comments = append ? [...s.comments, ...items] : items;
        s.commentsStart = start + items.length;
        s.commentsHasMore = hasMore;
      })
      .addCase(fetchComments.rejected, (s, a) => {
        if (!isCurrent(s, a)) return;
        s.commentsStatus = "error";
        s.loadingMoreComments = false;
        s.error = a.payload?.message;
      });

    b.addCase(addComment.pending, (s) => {
      s.posting = true;
      s.error = null;
    })
      .addCase(addComment.fulfilled, (s, a) => {
        s.posting = false;
        if (!isCurrent(s, a)) return; // posted on a recording we've since left
        s.comments.push(a.payload); // oldest-first tail; pinned still lead
        s.comments = sortPinnedFirst(s.comments);
        s.commentsStart += 1;
      })
      .addCase(addComment.rejected, (s, a) => {
        s.posting = false;
        s.error = a.payload?.message;
      });

    b.addCase(deleteComment.fulfilled, (s, a) => {
      s.comments = s.comments.filter((c) => c._id !== a.payload);
    });

    [pinComment, unpinComment, replyToComment].forEach((t) => {
      b.addCase(t.pending, (s) => {
        s.error = null;
      });
      b.addCase(t.fulfilled, (s, a) => {
        s.comments = upsertSorted(s.comments, a.payload);
      });
      b.addCase(t.rejected, (s, a) => {
        s.error = a.payload?.message;
      });
    });

    // ----- questions -----
    b.addCase(fetchQuestions.pending, (s, a) => {
      if (!isCurrent(s, a)) return;
      if (a.meta.arg?.append) s.loadingMoreQuestions = true;
      else s.questionsStatus = "loading";
    })
      .addCase(fetchQuestions.fulfilled, (s, a) => {
        if (!isCurrent(s, a)) return;
        s.questionsStatus = "idle";
        s.loadingMoreQuestions = false;
        const { items, start, append, hasMore } = a.payload;
        s.questions = append ? [...s.questions, ...items] : items;
        s.questionsStart = start + items.length;
        s.questionsHasMore = hasMore;
      })
      .addCase(fetchQuestions.rejected, (s, a) => {
        if (!isCurrent(s, a)) return;
        s.questionsStatus = "error";
        s.loadingMoreQuestions = false;
        s.error = a.payload?.message;
      });

    b.addCase(askQuestion.pending, (s) => {
      s.posting = true;
      s.error = null;
    })
      .addCase(askQuestion.fulfilled, (s, a) => {
        s.posting = false;
        if (!isCurrent(s, a)) return;
        s.questions.unshift(a.payload); // newest-first
        s.questions = sortPinnedFirst(s.questions);
        s.questionsStart += 1;
      })
      .addCase(askQuestion.rejected, (s, a) => {
        s.posting = false;
        s.error = a.payload?.message;
      });

    b.addCase(fetchQuestionDetail.fulfilled, (s, a) => {
      s.activeQuestion = a.payload;
    });

    [replyToQuestion, pinQuestion, unpinQuestion].forEach((t) => {
      b.addCase(t.pending, (s) => {
        s.error = null;
      });
      b.addCase(t.fulfilled, (s, a) => {
        if (s.activeQuestion?._id === a.payload._id) s.activeQuestion = a.payload;
        s.questions = upsertSorted(s.questions, a.payload);
      });
      b.addCase(t.rejected, (s, a) => {
        s.error = a.payload?.message;
      });
    });
  },
});

export const { setDiscussionVideo, clearDiscussions } = slice.actions;
export default slice.reducer;