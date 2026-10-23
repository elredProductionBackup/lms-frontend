"use client";

import { useCallback, useState } from "react";
import {
  Clock,
  Send,
  Trash2,
  Pencil,
  Check,
  X,
  Pin,
  PinOff,
  ChevronDown,
  ChevronUp,
  Reply as ReplyIcon,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchComments,
  addComment,
  deleteComment,
  pinComment,
  unpinComment,
  replyToComment,
  deleteCommentReply,
  fetchQuestions,
  askQuestion,
  deleteQuestion,
  replyToQuestion,
  deleteQuestionReply,
  pinQuestion,
  unpinQuestion,
} from "@/store/slices/discussionsSlice";
import {
  fetchNotes,
  addNote,
  updateNote,
  deleteNote,
} from "@/store/slices/notesSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { Tabs } from "@/components/ui/Shell";
import { Button, Avatar, Spinner } from "@/components/ui/Primitives";
import { Textarea } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import UserHoverCard, { displayName } from "@/components/learner/UserHoverCard";
import { clock, formatDate } from "@/lib/format";
import { isSameUser } from "@/lib/identity";

// Tab label with the recording's total beside it ("Comments 12"). The count
// only appears once the API has sent one; notes never get a total.
function TabLabel({ text, count }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {text}
      {count != null && (
        <span className="min-w-[1.25rem] rounded-full bg-ink/[0.07] px-1.5 py-px text-center text-[11px] font-semibold tabular-nums leading-4">
          {count > 999 ? "999+" : count}
        </span>
      )}
    </span>
  );
}

// Runs a thunk, toasts the server's message on failure, resolves true/false.
function useRun() {
  const dispatch = useAppDispatch();
  return useCallback(
    async (thunkAction, fallbackMessage) => {
      try {
        await dispatch(thunkAction).unwrap();
        return true;
      } catch (e) {
        dispatch(pushToast(e?.message || fallbackMessage, "error"));
        return false;
      }
    },
    [dispatch]
  );
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Avatar + name of a post's writer, each opening the profile hover card.
// Emails in the card are only shown to moderators.
function UserAvatar({ user, size, showEmail, className = "" }) {
  return (
    <UserHoverCard user={user} showEmail={showEmail} className={`shrink-0 rounded-full ${className}`}>
      <Avatar name={displayName(user)} src={user?.avatarUrl} size={size} />
    </UserHoverCard>
  );
}

function UserName({ user, showEmail, className = "text-sm font-medium" }) {
  return (
    <UserHoverCard user={user} showEmail={showEmail}>
      <span className={`truncate text-ink decoration-ink/30 underline-offset-2 hover:underline ${className}`}>
        {displayName(user)}
      </span>
    </UserHoverCard>
  );
}

// Comments, questions and notes are per recording: everything here is scoped
// to `videoId`, the recording currently loaded in the player. The course page
// owns loading (it refetches all panels whenever the recording changes); this
// component only posts, paginates and moderates.
//
// canModerate comes from the page: true only for an admin or THIS course's
// own author (the API rejects other authors with 403).
export default function DiscussionPanel({ courseId, videoId, currentTime, seekTo, canModerate = false }) {
  const [tab, setTab] = useState("comments");
  const { user } = useAppSelector((s) => s.auth);
  const { commentsTotal, questionsTotal } = useAppSelector((s) => s.discussions);

  const tabs = [
    { value: "comments", label: <TabLabel text="Comments" count={commentsTotal} /> },
    { value: "questions", label: <TabLabel text="Q&A" count={questionsTotal} /> },
    { value: "notes", label: "My notes" },
  ];
  const { confirm, dialog } = useConfirm();

  // Matches on any id field or the email, so a learner always sees Delete on
  // their own comments, questions and replies.
  const isMine = (ref) => isSameUser(user, ref);

  const shared = { courseId, videoId, currentTime, seekTo, canModerate, isMine, confirm };

  return (
    <div className="flex h-full flex-col rounded-card border border-ink/8 bg-cream-50 shadow-soft">
      <div className="px-4 pt-1">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      <div className="flex-1 overflow-hidden p-4">
        {!videoId ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            Comments, questions and notes appear here once a recording is available.
          </p>
        ) : (
          <>
            {tab === "comments" && <CommentsTab {...shared} />}
            {tab === "questions" && <QuestionsTab {...shared} />}
            {tab === "notes" && <NotesTab {...shared} />}
          </>
        )}
      </div>
      {dialog}
    </div>
  );
}

// The "At 0:14" chip only attaches the player's current time to the post
// (timestampSeconds in the POST body). It does NOT save a bookmark; saved
// bookmarks come from the player's Bookmark button.
//
// onSubmit resolves true/false; the text is only cleared once the post
// succeeds, so a failed post doesn't lose what the user typed.
function Composer({ placeholder, onSubmit, posting, currentTime, showTimestamp = true }) {
  const [text, setText] = useState("");
  const [stamped, setStamped] = useState(false);

  const submit = async () => {
    const value = text.trim();
    if (!value || posting) return;
    const ok = await onSubmit(value, stamped ? Math.floor(currentTime) : undefined);
    if (ok) {
      setText("");
      setStamped(false);
    }
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
            type="button"
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
      type="button"
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
      type="button"
      onClick={onUnpin}
      className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
      aria-label="Unpin"
      title="Unpin"
    >
      <PinOff size={14} />
    </button>
  ) : (
    <button
      type="button"
      onClick={onPin}
      className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-teal"
      aria-label="Pin"
      title="Pin"
    >
      <Pin size={14} />
    </button>
  );
}

function DeleteButton({ onClick, label, size = 15 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-ink-muted transition-colors hover:text-red-600"
      aria-label={label}
      title={label}
    >
      <Trash2 size={size} />
    </button>
  );
}

// Small text actions under a post (thread toggle, Reply): same size/colour,
// with a slightly larger hit area for touch.
const actionLink =
  "inline-flex items-center gap-1.5 rounded-md py-1 text-xs font-medium text-teal transition-colors hover:text-teal-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40";
const deleteLink =
  "inline-flex items-center gap-1.5 rounded-md py-1 text-xs font-medium text-ink-muted transition-colors hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300";

// Renders an existing reply list plus an inline reply composer. Replies are
// open to any signed-in, course-unlocked user for both comments and questions.
// onReply resolves true/false; the box only closes once the reply is saved.
//
// Long threads start collapsed: only the first `collapsedCount` replies show,
// with a "View N more" button when there are more.
function ReplyThread({
  replies = [],
  onReply,
  canDeleteReply,
  onDeleteReply,
  collapsedCount = 1,
  noun = ["reply", "replies"],
  onDeleteParent, // set when the viewer may delete the comment/question itself
  parentNoun = "comment",
  showEmail = false,
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const hiddenCount = Math.max(0, replies.length - collapsedCount);
  const visible = expanded || hiddenCount === 0 ? replies : replies.slice(0, collapsedCount);

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    const ok = await onReply(value);
    setSending(false);
    if (ok) {
      setText("");
      setOpen(false);
      setExpanded(true); // new replies land at the end, so show the full thread
    }
  };

  return (
    <div className="mt-3">
      {visible.map((r) => (
        <div key={r._id} className="mt-2 flex gap-2 border-l-2 border-ink/10 pl-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <UserAvatar user={r.by} size={20} showEmail={showEmail} />
              <UserName user={r.by} showEmail={showEmail} className="text-xs font-medium" />
              {r.createdAt && (
                <span className="text-[11px] text-ink-muted">{formatDate(r.createdAt)}</span>
              )}
            </div>
            <p className="mt-0.5 break-words text-sm text-ink-soft">{r.body}</p>
            {canDeleteReply?.(r) && (
              <button
                type="button"
                onClick={() => onDeleteReply(r)}
                className="mt-1 inline-flex items-center gap-1 rounded-md py-0.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                aria-label={`Delete ${noun[0]}`}
              >
                <Trash2 size={12} aria-hidden="true" /> Delete
              </button>
            )}
          </div>
        </div>
      ))}

      {/* One action row: thread toggle (when there's more to show) and Reply,
          same size and colour, evenly spaced. Wraps on narrow screens. */}
      {(hiddenCount > 0 || !open) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className={actionLink}
            >
              {expanded ? (
                <>
                  <ChevronUp size={14} aria-hidden="true" /> Show fewer {noun[1]}
                </>
              ) : (
                <>
                  <ChevronDown size={14} aria-hidden="true" />
                  View {plural(hiddenCount, `more ${noun[0]}`, `more ${noun[1]}`)}
                </>
              )}
            </button>
          )}
          {!open && (
            <button type="button" onClick={() => setOpen(true)} className={actionLink}>
              <ReplyIcon size={14} aria-hidden="true" /> Reply
            </button>
          )}
          {onDeleteParent && (
            <button
              type="button"
              onClick={onDeleteParent}
              className={deleteLink}
              aria-label={`Delete this ${parentNoun}`}
            >
              <Trash2 size={13} aria-hidden="true" /> Delete
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="mt-2 space-y-2">
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply..." />
          <div className="flex gap-2">
            <Button size="sm" variant="teal" onClick={send} loading={sending} disabled={!text.trim()}>
              <Check size={14} /> Send reply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </Button>
          </div>
        </div>
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

// Who may delete a comment, question or reply: whoever wrote it, this course's
// author, or an admin (canModerate covers the last two). Anyone else gets 403.
const replyDeleter = (isMine, canModerate) => (r) => isMine(r.by) || canModerate;

function CommentsTab({ courseId, videoId, currentTime, seekTo, canModerate, isMine, confirm }) {
  const dispatch = useAppDispatch();
  const run = useRun();
  const { comments, commentsStatus, posting, commentsHasMore, commentsStart, loadingMoreComments, error } =
    useAppSelector((s) => s.discussions);

  const post = (text, timestampSeconds) =>
    run(addComment({ courseId, videoId, text, timestampSeconds }), "Comment wasn't posted. Try again.");

  const loadMore = () =>
    dispatch(fetchComments({ courseId, videoId, start: commentsStart, append: true }));

  const removeComment = async (c) => {
    const replyCount = c.replies?.length || 0;
    const ok = await confirm({
      title: "Delete this comment?",
      message: replyCount
        ? `Its ${plural(replyCount, "reply", "replies")} will be deleted too. This can't be undone.`
        : "This can't be undone.",
      confirmLabel: "Delete comment",
      action: () => dispatch(deleteComment(c._id)).unwrap(),
    });
    if (ok) dispatch(pushToast("Comment deleted", "success"));
  };

  const removeReply = (c) => async (r) => {
    const ok = await confirm({
      title: "Delete this reply?",
      message: "This can't be undone.",
      confirmLabel: "Delete reply",
      action: () => dispatch(deleteCommentReply({ commentId: c._id, replyId: r._id })).unwrap(),
    });
    if (ok) dispatch(pushToast("Reply deleted", "success"));
  };

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
          <EmptyState status={commentsStatus} error={error}>Your comments on this module will be visible to the public. Share your thoughts to get started.</EmptyState>
        ) : (
          <>
            {comments.map((c) => (
              <div
                key={c._id}
                className={`group rounded-xl p-3 ${
                  c.isPinned ? "border border-teal/30 bg-teal/5" : ""
                }`}
              >
                <div className="flex gap-3">
                  <UserAvatar user={c.userId} size={30} showEmail={canModerate} className="mt-0.5 self-start" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <UserName user={c.userId} showEmail={canModerate} />
                      <span className="text-xs text-ink-muted">{formatDate(c.createdAt)}</span>
                      <TimeChip seconds={c.timestampSeconds} onClick={() => seekTo?.(c.timestampSeconds)} />
                      {c.isPinned && <PinnedTag />}
                    </div>
                    <p className="mt-0.5 break-words text-sm leading-relaxed text-ink-soft">{c.text}</p>
                  </div>
                  {canModerate && (
                    <div className="flex items-start">
                      <PinToggle
                        pinned={c.isPinned}
                        onPin={() => run(pinComment(c._id), "Comment wasn't pinned. Try again.")}
                        onUnpin={() => run(unpinComment(c._id), "Comment wasn't unpinned. Try again.")}
                      />
                    </div>
                  )}
                </div>

                <div className="pl-[42px]">
                  <ReplyThread
                    replies={c.replies}
                    onReply={(body) =>
                      run(replyToComment({ commentId: c._id, body }), "Reply wasn't posted. Try again.")
                    }
                    canDeleteReply={replyDeleter(isMine, canModerate)}
                    onDeleteReply={removeReply(c)}
                    onDeleteParent={
                      isMine(c.userId) || canModerate ? () => removeComment(c) : undefined
                    }
                    parentNoun="comment"
                    showEmail={canModerate}
                  />
                </div>
              </div>
            ))}
            <LoadMore hasMore={commentsHasMore} loading={loadingMoreComments} onClick={loadMore} />
          </>
        )}
      </div>
    </div>
  );
}

function QuestionsTab({ courseId, videoId, currentTime, seekTo, canModerate, isMine, confirm }) {
  const dispatch = useAppDispatch();
  const run = useRun();
  const { questions, questionsStatus, posting, questionsHasMore, questionsStart, loadingMoreQuestions, error } =
    useAppSelector((s) => s.discussions);

  const ask = (body, timestampSeconds) =>
    run(askQuestion({ courseId, videoId, body, timestampSeconds }), "Question wasn't posted. Try again.");

  const loadMore = () =>
    dispatch(fetchQuestions({ courseId, videoId, start: questionsStart, append: true }));

  const removeQuestion = async (q) => {
    const replyCount = q.replies?.length || 0;
    const ok = await confirm({
      title: "Delete this question?",
      message: replyCount
        ? `Its ${plural(replyCount, "answer", "answers")} will be deleted too. This can't be undone.`
        : "This can't be undone.",
      confirmLabel: "Delete question",
      action: () => dispatch(deleteQuestion(q._id)).unwrap(),
    });
    if (ok) dispatch(pushToast("Question deleted", "success"));
  };

  const removeReply = (q) => async (r) => {
    const ok = await confirm({
      title: "Delete this answer?",
      message: "This can't be undone.",
      confirmLabel: "Delete answer",
      action: () => dispatch(deleteQuestionReply({ questionId: q._id, replyId: r._id })).unwrap(),
    });
    if (ok) dispatch(pushToast("Answer deleted", "success"));
  };

  return (
    <div className="flex h-full flex-col">
      <Composer placeholder="Ask a question..." onSubmit={ask} posting={posting} currentTime={currentTime} />
      <div className="thin-scroll mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        {questionsStatus === "loading" ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : questions.length === 0 ? (
          <EmptyState status={questionsStatus} error={error}>Your questions and answers are public. Participate in the discussion by posting a question or sharing an answer.</EmptyState>
        ) : (
          <>
            {questions.map((q) => {
              const canDelete = isMine(q.askedBy) || canModerate;
              return (
                <div
                  key={q._id}
                  className={`rounded-xl border p-3.5 ${
                    q.isPinned ? "border-teal/40 bg-teal/5" : "border-ink/8 bg-cream-100"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <UserAvatar user={q.askedBy} size={26} showEmail={canModerate} />
                    <UserName user={q.askedBy} showEmail={canModerate} />
                    <TimeChip seconds={q.timestampSeconds} onClick={() => seekTo?.(q.timestampSeconds)} />
                    {q.isPinned && <PinnedTag />}
                    {canModerate && (
                      <span className="ml-auto flex items-center">
                        <PinToggle
                          pinned={q.isPinned}
                          onPin={() => run(pinQuestion(q._id), "Question wasn't pinned. Try again.")}
                          onUnpin={() => run(unpinQuestion(q._id), "Question wasn't unpinned. Try again.")}
                        />
                      </span>
                    )}
                  </div>
                  <p className="mt-2 break-words text-sm leading-relaxed text-ink-soft">{q.body}</p>

                  {/* Replies are open to any course-unlocked user, not just moderators. */}
                  <ReplyThread
                    replies={q.replies}
                    onReply={(body) =>
                      run(replyToQuestion({ questionId: q._id, body }), "Answer wasn't posted. Try again.")
                    }
                    canDeleteReply={replyDeleter(isMine, canModerate)}
                    onDeleteReply={removeReply(q)}
                    noun={["answer", "answers"]}
                    onDeleteParent={canDelete ? () => removeQuestion(q) : undefined}
                    parentNoun="question"
                    showEmail={canModerate}
                  />
                </div>
              );
            })}
            <LoadMore hasMore={questionsHasMore} loading={loadingMoreQuestions} onClick={loadMore} />
          </>
        )}
      </div>
    </div>
  );
}

function NotesTab({ courseId, videoId, currentTime, seekTo, confirm }) {
  const dispatch = useAppDispatch();
  const run = useRun();
  const { items, status, saving, hasMore, start, loadingMore, error } = useAppSelector((s) => s.notes);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const post = (text, timestampSeconds) =>
    run(addNote({ courseId, videoId, text, timestampSeconds }), "Note wasn't saved. Try again.");

  const loadMore = () =>
    dispatch(fetchNotes({ courseId, videoId, start, append: true }));

  // Only closes the editor once the save succeeds; blank text isn't sent (API 400s it).
  const saveEdit = async (noteId) => {
    const text = editText.trim();
    if (!text || savingEdit) return;
    setSavingEdit(true);
    const ok = await run(updateNote({ noteId, text }), "Note wasn't updated. Try again.");
    setSavingEdit(false);
    if (ok) setEditing(null);
  };

  const removeNote = async (n) => {
    const ok = await confirm({
      title: "Delete this note?",
      message: "This can't be undone.",
      confirmLabel: "Delete note",
      action: () => dispatch(deleteNote(n._id)).unwrap(),
    });
    if (ok) {
      if (editing === n._id) setEditing(null);
      dispatch(pushToast("Note deleted", "success"));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Composer placeholder="Write a private note..." onSubmit={post} posting={saving} currentTime={currentTime} />
      <div className="thin-scroll mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {status === "loading" ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState status={status} error={error}>
            Your notes on this module are private to you. Add one to get started.
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
                      type="button"
                      onClick={() => {
                        setEditing(n._id);
                        setEditText(n.text);
                      }}
                      className="text-ink-muted hover:text-ink"
                      aria-label="Edit note"
                      title="Edit note"
                    >
                      <Pencil size={14} />
                    </button>
                    <DeleteButton size={14} label="Delete note" onClick={() => removeNote(n)} />
                  </div>
                </div>
                {editing === n._id ? (
                  <div className="space-y-2">
                    <Textarea rows={2} value={editText} onChange={(e) => setEditText(e.target.value)} />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="teal"
                        onClick={() => saveEdit(n._id)}
                        loading={savingEdit}
                        disabled={!editText.trim()}
                      >
                        <Check size={14} /> Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={savingEdit}>
                        <X size={14} /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="break-words text-sm leading-relaxed text-ink-soft">{n.text}</p>
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