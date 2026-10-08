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

// ---- Comments ----

// GET /api/courses/:id/comments?start=&offset=  (pinned-first, then oldest-first)
export const fetchComments = createAsyncThunk(
  "disc/comments/list",
  async ({ courseId, start = 0, offset = PAGE_SIZE, append = false }, { rejectWithValue }) => {
    try {
      const data = await api.get(withPage(`/courses/${courseId}/comments`, { start, offset }));
      const items = data.comments || [];
      return { items, start, offset, append, hasMore: items.length === offset };
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/courses/:id/comments  { text, timestampSeconds? }
export const addComment = createAsyncThunk(
  "disc/comments/add",
  async ({ courseId, text, timestampSeconds }, { rejectWithValue }) => {
    try {
      return await api.post(`/courses/${courseId}/comments`, {
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

// GET /api/courses/:id/questions?start=&offset=  (pinned-first, then newest-first)
export const fetchQuestions = createAsyncThunk(
  "disc/questions/list",
  async ({ courseId, start = 0, offset = PAGE_SIZE, append = false }, { rejectWithValue }) => {
    try {
      const data = await api.get(withPage(`/courses/${courseId}/questions`, { start, offset }));
      const items = data.questions || [];
      return { items, start, offset, append, hasMore: items.length === offset };
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/courses/:id/questions  { body, timestampSeconds? }
export const askQuestion = createAsyncThunk(
  "disc/questions/ask",
  async ({ courseId, body, timestampSeconds }, { rejectWithValue }) => {
    try {
      return await api.post(`/courses/${courseId}/questions`, {
        body,
        timestampSeconds,
      });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// GET /api/questions/:questionId  (now public to any unlocked user)
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
    clearDiscussions(s) {
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
      if (a.meta.arg?.append) s.loadingMoreComments = true;
      else s.commentsStatus = "loading";
    })
      .addCase(fetchComments.fulfilled, (s, a) => {
        s.commentsStatus = "idle";
        s.loadingMoreComments = false;
        const { items, start, append, hasMore } = a.payload;
        s.comments = append ? [...s.comments, ...items] : items;
        s.commentsStart = start + items.length;
        s.commentsHasMore = hasMore;
      })
      .addCase(fetchComments.rejected, (s, a) => {
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
      if (a.meta.arg?.append) s.loadingMoreQuestions = true;
      else s.questionsStatus = "loading";
    })
      .addCase(fetchQuestions.fulfilled, (s, a) => {
        s.questionsStatus = "idle";
        s.loadingMoreQuestions = false;
        const { items, start, append, hasMore } = a.payload;
        s.questions = append ? [...s.questions, ...items] : items;
        s.questionsStart = start + items.length;
        s.questionsHasMore = hasMore;
      })
      .addCase(fetchQuestions.rejected, (s, a) => {
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

export const { clearDiscussions } = slice.actions;
export default slice.reducer;