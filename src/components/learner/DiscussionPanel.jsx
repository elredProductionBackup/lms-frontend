"use client";

import { useState } from "react";
import {
  Clock,
  Send,
  Trash2,
  CornerDownRight,
  Pencil,
  Check,
  X,
  Pin,
  PinOff,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchComments,
  addComment,
  deleteComment,
  pinComment,
  unpinComment,
  replyToComment,
  fetchQuestions,
  askQuestion,
  replyToQuestion,
  pinQuestion,
  unpinQuestion,
} from "@/store/slices/discussionsSlice";
import {
  fetchNotes,
  addNote,
  updateNote,
  deleteNote,
} from "@/store/slices/notesSlice";
import { Tabs } from "@/components/ui/Shell";
import { Button, Avatar, Dot, Spinner } from "@/components/ui/Primitives";
import { Textarea } from "@/components/ui/Field";
import { clock, formatDate } from "@/lib/format";

// Falls back to a capitalized email handle when the user has no name.
function displayName(u) {
  if (!u) return "";
  if (u.name?.trim()) return u.name;
  if (u.email) {
    const handle = u.email.split("@")[0];
    return handle.charAt(0).toUpperCase() + handle.slice(1);
  }
  return "";
}

const TABS = [
  { value: "comments", label: "Comments" },
  { value: "questions", label: "Questions" },
  { value: "notes", label: "My notes" },
];

// Comments, questions and notes are per recording: everything here is scoped
// to `videoId`, the recording currently loaded in the player. The course page
// owns loading (it refetches all panels whenever the recording changes); this
// component only posts, paginates and moderates.
export default function DiscussionPanel({ courseId, videoId, currentTime, seekTo }) {
  const [tab, setTab] = useState("comments");
  const { role, user } = useAppSelector((s) => s.auth);
  const canModerate = role === "admin" || role === "author";

  return (
    <div className="flex h-full flex-col rounded-card border border-ink/8 bg-cream-50 shadow-soft">
      <div className="px-4 pt-1">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="flex-1 overflow-hidden p-4">
        {!videoId ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            Comments, questions and notes appear here once a recording is available.
          </p>
        ) : (
          <>
            {tab === "comments" && (
              <CommentsTab courseId={courseId} videoId={videoId} currentTime={currentTime} seekTo={seekTo} user={user} canModerate={canModerate} />
            )}
            {tab === "questions" && (
              <QuestionsTab courseId={courseId} videoId={videoId} currentTime={currentTime} seekTo={seekTo} canModerate={canModerate} user={user} />
            )}
            {tab === "notes" && (
              <NotesTab courseId={courseId} videoId={videoId} currentTime={currentTime} seekTo={seekTo} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// The "At 0:14" chip only attaches the player's current time to the post
// (timestampSeconds in the POST body). It does NOT save a bookmark; saved
// bookmarks come from the player's Bookmark button. It used to read
// "Bookmark at 0:14", which was easy to confuse with that button.
function Composer({ placeholder, onSubmit, posting, currentTime, showTimestamp = true }) {
  const [text, setText] = useState("");
  const [stamped, setStamped] = useState(false);

  const submit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim(), stamped ? Math.floor(currentTime) : undefined);
    setText("");
    setStamped(false);
  };

  return (
    <div className="rounded-xl border border-ink/12 bg-cream-100 p-3">
      <Textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="border-0 bg-transparent p-0 focus:bg-transparent"
      />
      <div className="mt-2 flex items-center justify-between">
        {showTimestamp ? (
          <button
            onClick={() => setStamped((v) => !v)}
            aria-pressed={stamped}
            title="Attach the current video time to this post"
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              stamped
                ? "border-teal bg-teal/10 text-teal"
                : "border-ink/15 text-ink-muted hover:text-ink"
            }`}
          >
            <Clock size={13} /> At {clock(currentTime)}
          </button>
        ) : (
          <span />
        )}
        <Button size="sm" variant="teal" onClick={submit} loading={posting} disabled={!text.trim()}>
          <Send size={14} /> Post
        </Button>
      </div>
    </div>
  );
}

function TimeChip({ seconds, onClick }) {
  if (seconds == null) return null;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 text-[11px] font-medium text-teal hover:bg-teal/20"
    >
      <Clock size={11} /> {clock(seconds)}
    </button>
  );
}

// Small pinned marker shown on pinned comments/questions.
function PinnedTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-general/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-general-dark">
      <Pin size={10} /> Pinned
    </span>
  );
}

// Moderator-only pin / unpin toggle.
function PinToggle({ pinned, onPin, onUnpin }) {
  return pinned ? (
    <button
      onClick={onUnpin}
      className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
      aria-label="Unpin"
      title="Unpin"
    >
      <PinOff size={14} />
    </button>
  ) : (
    <button
      onClick={onPin}
      className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-teal"
      aria-label="Pin"
      title="Pin"
    >
      <Pin size={14} />
    </button>
  );
}

// Renders an existing reply list plus an inline reply composer. Replies are
// open to any signed-in, course-unlocked user for both comments and questions.
function ReplyThread({ replies = [], posting, onReply }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    onReply(text.trim());
    setText("");
    setOpen(false);
  };

  return (
    <div className="mt-3">
      {replies.map((r) => (
        <div key={r._id} className="mt-2 flex gap-2 border-l-2 border-teal/30 pl-3">
          <CornerDownRight size={14} className="mt-1 shrink-0 text-teal" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink">{displayName(r.by)}</span>
              {r.createdAt && (
                <span className="text-[11px] text-ink-muted">{formatDate(r.createdAt)}</span>
              )}
            </div>
            <p className="text-sm text-ink-soft">{r.body}</p>
          </div>
        </div>
      ))}

      {open ? (
        <div className="mt-2 space-y-2">
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply..." />
          <div className="flex gap-2">
            <Button size="sm" variant="teal" onClick={send} loading={posting} disabled={!text.trim()}>
              <Check size={14} /> Send reply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-2 text-sm font-medium text-teal hover:underline"
        >
          Reply
        </button>
      )}
    </div>
  );
}

// Empty state for a list. A failed load (e.g. 404 "Video not found",
// 403 "This course is locked for you") shows the server's message instead of
// pretending the list is empty.
function EmptyState({ status, error, children }) {
  return (
    <p className={`py-10 text-center text-sm ${status === "error" ? "text-red-600" : "text-ink-muted"}`}>
      {status === "error" ? error || "Couldn't load this list." : children}
    </p>
  );
}

// Shared "Load more" control for the paginated lists.
function LoadMore({ hasMore, loading, onClick }) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center py-2">
      <Button size="sm" variant="subtle" onClick={onClick} loading={loading}>
        Load more
      </Button>
    </div>
  );
}

function CommentsTab({ courseId, videoId, currentTime, seekTo, user, canModerate }) {
  const dispatch = useAppDispatch();
  const { comments, commentsStatus, posting, commentsHasMore, commentsStart, loadingMoreComments, error } =
    useAppSelector((s) => s.discussions);

  const post = (text, timestampSeconds) =>
    dispatch(addComment({ courseId, videoId, text, timestampSeconds }));

  const loadMore = () =>
    dispatch(fetchComments({ courseId, videoId, start: commentsStart, append: true }));

  return (
    <div className="flex h-full flex-col">
      <Composer
        placeholder="Add a comment..."
        onSubmit={post}
        posting={posting}
        currentTime={currentTime}
      />
      <div className="thin-scroll mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        {commentsStatus === "loading" ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : comments.length === 0 ? (
          <EmptyState status={commentsStatus} error={error}>No comments on this recording yet.</EmptyState>
        ) : (
          <>
            {comments.map((c) => {
              const mine = c.userId?._id === user?.id;
              const name = displayName(c.userId);
              return (
                <div
                  key={c._id}
                  className={`group rounded-xl p-3 ${
                    c.isPinned ? "border border-teal/30 bg-teal/5" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    <Avatar name={name} size={30} className="mt-0.5" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{name}</span>
                        <span className="text-xs text-ink-muted">{formatDate(c.createdAt)}</span>
                        <TimeChip seconds={c.timestampSeconds} onClick={() => seekTo?.(c.timestampSeconds)} />
                        {c.isPinned && <PinnedTag />}
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{c.text}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      {canModerate && (
                        <PinToggle
                          pinned={c.isPinned}
                          onPin={() => dispatch(pinComment(c._id))}
                          onUnpin={() => dispatch(unpinComment(c._id))}
                        />
                      )}
                      {(mine || canModerate) && (
                        <button
                          onClick={() => dispatch(deleteComment(c._id))}
                          className="text-ink-muted transition-colors hover:text-red-600"
                          aria-label="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pl-[42px]">
                    <ReplyThread
                      replies={c.replies}
                      posting={posting}
                      onReply={(body) => dispatch(replyToComment({ commentId: c._id, body }))}
                    />
                  </div>
                </div>
              );
            })}
            <LoadMore hasMore={commentsHasMore} loading={loadingMoreComments} onClick={loadMore} />
          </>
        )}
      </div>
    </div>
  );
}

function QuestionsTab({ courseId, videoId, currentTime, seekTo, canModerate }) {
  const dispatch = useAppDispatch();
  const { questions, questionsStatus, posting, questionsHasMore, questionsStart, loadingMoreQuestions, error } =
    useAppSelector((s) => s.discussions);

  const ask = (body, timestampSeconds) =>
    dispatch(askQuestion({ courseId, videoId, body, timestampSeconds }));

  const loadMore = () =>
    dispatch(fetchQuestions({ courseId, videoId, start: questionsStart, append: true }));

  return (
    <div className="flex h-full flex-col">
      <Composer placeholder="Ask a question..." onSubmit={ask} posting={posting} currentTime={currentTime} />
      <div className="thin-scroll mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        {questionsStatus === "loading" ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : questions.length === 0 ? (
          <EmptyState status={questionsStatus} error={error}>No questions on this recording yet.</EmptyState>
        ) : (
          <>
            {questions.map((q) => (
              <div
                key={q._id}
                className={`rounded-xl border p-3.5 ${
                  q.isPinned ? "border-teal/40 bg-teal/5" : "border-ink/8 bg-cream-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Avatar name={displayName(q.askedBy)} size={26} />
                  <span className="text-sm font-medium text-ink">{displayName(q.askedBy)}</span>
                  <TimeChip seconds={q.timestampSeconds} onClick={() => seekTo?.(q.timestampSeconds)} />
                  {q.isPinned && <PinnedTag />}
                  {canModerate && (
                    <span className="ml-auto">
                      <PinToggle
                        pinned={q.isPinned}
                        onPin={() => dispatch(pinQuestion(q._id))}
                        onUnpin={() => dispatch(unpinQuestion(q._id))}
                      />
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{q.body}</p>

                {/* Replies are now open to any course-unlocked user, not just moderators. */}
                <ReplyThread
                  replies={q.replies}
                  posting={posting}
                  onReply={(body) => dispatch(replyToQuestion({ questionId: q._id, body }))}
                />
              </div>
            ))}
            <LoadMore hasMore={questionsHasMore} loading={loadingMoreQuestions} onClick={loadMore} />
          </>
        )}
      </div>
    </div>
  );
}

function NotesTab({ courseId, videoId, currentTime, seekTo }) {
  const dispatch = useAppDispatch();
  const { items, status, saving, hasMore, start, loadingMore, error } = useAppSelector((s) => s.notes);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");

  const post = (text, timestampSeconds) =>
    dispatch(addNote({ courseId, videoId, text, timestampSeconds }));

  const loadMore = () =>
    dispatch(fetchNotes({ courseId, videoId, start, append: true }));

  const saveEdit = (noteId) => {
    dispatch(updateNote({ noteId, text: editText })).then(() => setEditing(null));
  };

  return (
    <div className="flex h-full flex-col">
      <Composer placeholder="Write a private note..." onSubmit={post} posting={saving} currentTime={currentTime} />
      <div className="thin-scroll mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {status === "loading" ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState status={status} error={error}>
            Your notes on this recording are private to you. Add one to get started.
          </EmptyState>
        ) : (
          <>
          {items.map((n) => (
            <div key={n._id} className="rounded-xl border border-ink/8 bg-cream-100 p-3.5">
              <div className="mb-1 flex items-center gap-2">
                <TimeChip seconds={n.timestampSeconds} onClick={() => seekTo?.(n.timestampSeconds)} />
                <span className="text-xs text-ink-muted">{formatDate(n.createdAt)}</span>
                <div className="ml-auto flex gap-1.5">
                  <button
                    onClick={() => {
                      setEditing(n._id);
                      setEditText(n.text);
                    }}
                    className="text-ink-muted hover:text-ink"
                    aria-label="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => dispatch(deleteNote(n._id))}
                    className="text-ink-muted hover:text-red-600"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {editing === n._id ? (
                <div className="space-y-2">
                  <Textarea rows={2} value={editText} onChange={(e) => setEditText(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="teal" onClick={() => saveEdit(n._id)}>
                      <Check size={14} /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      <X size={14} /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-ink-soft">{n.text}</p>
              )}
            </div>
          ))}
          <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />
          </>
        )}
      </div>
    </div>
  );
}