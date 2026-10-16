import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api, withPage, PAGE_SIZE } from "@/lib/api";

// Keep pinned items on top (most-recently-pinned first), then leave everyone
// else in the order the server already returned them (comments and questions
// are both newest-first now). Array.prototype.sort is stable, so the non-pinned
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

const fail = (e) => ({ code: e.code, message: e.message });

// ---- Comments ----

// `total` counts every top-level item on the recording (replies aren't
// counted) and ignores start/offset, so it's the same on every page. It also
// tells us when everything is loaded. Older backends without `total` fall back
// to "a full page means there may be more".
function pageResult(items, total, { start, offset, append }) {
  const hasTotal = Number.isFinite(total);
  return {
    items,
    start,
    offset,
    append,
    total: hasTotal ? total : null,
    hasMore: hasTotal ? start + items.length < total : items.length === offset,
  };
}

// GET /api/courses/:id/videos/:videoId/comments?start=&offset=
// -> { comments, total }  (pinned-first, then newest-first, this recording only)
export const fetchComments = createAsyncThunk(
  "disc/comments/list",
  async ({ courseId, videoId, start = 0, offset = PAGE_SIZE, append = false }, { rejectWithValue }) => {
    try {
      const data = await api.get(withPage(videoPath(courseId, videoId, "comments"), { start, offset }));
      return pageResult(data.comments || [], data.total, { start, offset, append });
    } catch (e) {
      return rejectWithValue(fail(e));
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
      return rejectWithValue(fail(e));
    }
  }
);

// DELETE /api/comments/:commentId  (writer, this course's author, or an admin)
// Also removes all its replies.
export const deleteComment = createAsyncThunk(
  "disc/comments/delete",
  async (commentId, { rejectWithValue }) => {
    try {
      await api.del(`/comments/${commentId}`);
      return commentId;
    } catch (e) {
      return rejectWithValue(fail(e));
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
      return rejectWithValue(fail(e));
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
      return rejectWithValue(fail(e));
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
      return rejectWithValue(fail(e));
    }
  }
);

// DELETE /api/comments/:commentId/replies/:replyId
// (reply's writer, this course's author, or an admin) -> the parent comment
// without that reply. An already-gone reply returns the comment unchanged.
export const deleteCommentReply = createAsyncThunk(
  "disc/comments/replyDelete",
  async ({ commentId, replyId }, { rejectWithValue }) => {
    try {
      const data = await api.del(`/comments/${commentId}/replies/${replyId}`);
      return { parentId: commentId, replyId, doc: data?._id ? data : null };
    } catch (e) {
      return rejectWithValue(fail(e));
    }
  }
);

// ---- Questions (now public, same model as comments) ----

// GET /api/courses/:id/videos/:videoId/questions?start=&offset=
// -> { questions, total }  (pinned-first, then newest-first, this recording only)
export const fetchQuestions = createAsyncThunk(
  "disc/questions/list",
  async ({ courseId, videoId, start = 0, offset = PAGE_SIZE, append = false }, { rejectWithValue }) => {
    try {
      const data = await api.get(withPage(videoPath(courseId, videoId, "questions"), { start, offset }));
      return pageResult(data.questions || [], data.total, { start, offset, append });
    } catch (e) {
      return rejectWithValue(fail(e));
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
      return rejectWithValue(fail(e));
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
      return rejectWithValue(fail(e));
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
      return rejectWithValue(fail(e));
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
      return rejectWithValue(fail(e));
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
      return rejectWithValue(fail(e));
    }
  }
);

// DELETE /api/questions/:questionId  -> { ok: true }
// (writer, this course's author, or an admin). Also removes all its replies.
export const deleteQuestion = createAsyncThunk(
  "disc/questions/delete",
  async (questionId, { rejectWithValue }) => {
    try {
      await api.del(`/questions/${questionId}`);
      return questionId;
    } catch (e) {
      return rejectWithValue(fail(e));
    }
  }
);

// DELETE /api/questions/:questionId/replies/:replyId  -> the parent question
// (reply's writer, this course's author, or an admin)
export const deleteQuestionReply = createAsyncThunk(
  "disc/questions/replyDelete",
  async ({ questionId, replyId }, { rejectWithValue }) => {
    try {
      const data = await api.del(`/questions/${questionId}/replies/${replyId}`);
      return { parentId: questionId, replyId, doc: data?._id ? data : null };
    } catch (e) {
      return rejectWithValue(fail(e));
    }
  }
);

// Newest-first lists shift when someone posts while we page, so the next page
// can repeat an item we already hold. Skip those instead of showing it twice.
function dedupeAppend(list, items) {
  const seen = new Set(list.map((x) => x._id));
  return [...list, ...items.filter((x) => !seen.has(x._id))];
}

// Replace or insert a full record returned from a mutation, then re-sort so the
// pinned tier stays on top.
function upsertSorted(list, doc) {
  const i = list.findIndex((x) => x._id === doc._id);
  if (i >= 0) list[i] = doc;
  return sortPinnedFirst(list);
}

// After a reply delete: use the server's updated parent if it sent one,
// otherwise drop the reply locally.
function removeReply(list, { parentId, replyId, doc }) {
  if (doc) return upsertSorted(list, doc);
  const parent = list.find((x) => x._id === parentId);
  if (parent) parent.replies = (parent.replies || []).filter((r) => r._id !== replyId);
  return list;
}

// Add a new top-level comment/question once. The POST response and the
// socket echo of the same post can arrive in either order, so a second copy
// replaces the first instead of being shown (or counted) twice.
function insertTop(s, kind, doc) {
  const list = s[kind];
  const i = list.findIndex((x) => x._id === doc._id);
  if (i >= 0) {
    list[i] = doc;
    s[kind] = sortPinnedFirst(list);
    return;
  }
  list.unshift(doc); // newest-first: top, below the pinned ones
  s[kind] = sortPinnedFirst(list);
  const start = kind === "comments" ? "commentsStart" : "questionsStart";
  const total = kind === "comments" ? "commentsTotal" : "questionsTotal";
  s[start] += 1;
  if (s[total] != null) s[total] += 1;
}

// Remove a top-level item once; replies go with it but don't change the total.
function removeTop(s, kind, id) {
  const before = s[kind].length;
  s[kind] = s[kind].filter((x) => x._id !== id);
  if (s[kind].length === before) return false; // already gone (e.g. my own delete's echo)
  const start = kind === "comments" ? "commentsStart" : "questionsStart";
  const total = kind === "comments" ? "commentsTotal" : "questionsTotal";
  s[start] = Math.max(0, s[start] - 1);
  if (s[total] != null) s[total] = Math.max(0, s[total] - 1);
  return true;
}

// Socket events are per course; only apply ones for the recording on screen.
const forThisVideo = (s, payload) => Boolean(payload?.videoId) && payload.videoId === s.videoId;

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
    commentsTotal: null, // from the API; null until the first page arrives
    questionsTotal: null,
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
      s.commentsTotal = null;
      s.questionsTotal = null;
      s.loadingMoreComments = false;
      s.loadingMoreQuestions = false;
      s.error = null;
    },
    // ----- realtime (course room on /lms-socket.io) -----
    rtCommentAdded(s, a) {
      if (forThisVideo(s, a.payload)) insertTop(s, "comments", a.payload);
    },
    // comment:pinned / comment:unpinned / comment:replied carry the full comment
    rtCommentUpdated(s, a) {
      if (forThisVideo(s, a.payload)) s.comments = upsertSorted(s.comments, a.payload);
    },
    rtCommentDeleted(s, a) {
      if (forThisVideo(s, a.payload)) removeTop(s, "comments", a.payload.commentId);
    },
    rtCommentReplyDeleted(s, a) {
      if (!forThisVideo(s, a.payload)) return;
      s.comments = removeReply(s.comments, { parentId: a.payload.commentId, replyId: a.payload.replyId });
    },
    rtQuestionAdded(s, a) {
      if (forThisVideo(s, a.payload)) insertTop(s, "questions", a.payload);
    },
    // question:replied / question:pinned / question:unpinned
    rtQuestionUpdated(s, a) {
      if (!forThisVideo(s, a.payload)) return;
      s.questions = upsertSorted(s.questions, a.payload);
      if (s.activeQuestion?._id === a.payload._id) s.activeQuestion = a.payload;
    },
    rtQuestionDeleted(s, a) {
      if (!forThisVideo(s, a.payload)) return;
      removeTop(s, "questions", a.payload.questionId);
      if (s.activeQuestion?._id === a.payload.questionId) s.activeQuestion = null;
    },
    rtQuestionReplyDeleted(s, a) {
      if (!forThisVideo(s, a.payload)) return;
      const { questionId, replyId } = a.payload;
      s.questions = removeReply(s.questions, { parentId: questionId, replyId });
      if (s.activeQuestion?._id === questionId) {
        s.activeQuestion = {
          ...s.activeQuestion,
          replies: (s.activeQuestion.replies || []).filter((r) => r._id !== replyId),
        };
      }
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
      s.commentsTotal = null;
      s.questionsTotal = null;
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
        const { items, start, append, hasMore, total } = a.payload;
        s.comments = append ? dedupeAppend(s.comments, items) : items;
        s.commentsStart = start + items.length;
        s.commentsHasMore = hasMore;
        if (total != null) s.commentsTotal = total;
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
        insertTop(s, "comments", a.payload);
      })
      .addCase(addComment.rejected, (s, a) => {
        s.posting = false;
        s.error = a.payload?.message;
      });

    // Also step the page cursor back, otherwise "Load more" skips one comment.
    b.addCase(deleteComment.fulfilled, (s, a) => {
      removeTop(s, "comments", a.payload);
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

    b.addCase(deleteCommentReply.fulfilled, (s, a) => {
      s.comments = removeReply(s.comments, a.payload);
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
        const { items, start, append, hasMore, total } = a.payload;
        s.questions = append ? dedupeAppend(s.questions, items) : items;
        s.questionsStart = start + items.length;
        s.questionsHasMore = hasMore;
        if (total != null) s.questionsTotal = total;
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
        insertTop(s, "questions", a.payload);
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

    b.addCase(deleteQuestion.fulfilled, (s, a) => {
      // Replies go with it, but the total only counts top-level questions, so
      // it drops by exactly one.
      removeTop(s, "questions", a.payload);
      if (s.activeQuestion?._id === a.payload) s.activeQuestion = null;
    });

    b.addCase(deleteQuestionReply.fulfilled, (s, a) => {
      s.questions = removeReply(s.questions, a.payload);
      if (s.activeQuestion?._id === a.payload.parentId) {
        s.activeQuestion = a.payload.doc
          ? a.payload.doc
          : {
              ...s.activeQuestion,
              replies: (s.activeQuestion.replies || []).filter((r) => r._id !== a.payload.replyId),
            };
      }
    });
  },
});

export const {
  setDiscussionVideo,
  clearDiscussions,
  rtCommentAdded,
  rtCommentUpdated,
  rtCommentDeleted,
  rtCommentReplyDeleted,
  rtQuestionAdded,
  rtQuestionUpdated,
  rtQuestionDeleted,
  rtQuestionReplyDeleted,
} = slice.actions;
export default slice.reducer;