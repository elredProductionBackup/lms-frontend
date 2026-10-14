"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload, Trash2, Pencil, Check, X, Film, Loader2, Captions, CaptionsOff, RotateCcw,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  uploadVideo,
  fetchVideoStatus,
  renameVideo,
  deleteVideo,
  retryVideo,
  setUploadProgress,
  fetchVideoCaptions,
  updateVideoCaptions,
} from "@/store/slices/videosSlice";
import { fetchCourse } from "@/store/slices/coursesSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { Card, EmptyState } from "@/components/ui/Shell";
import { Button, Badge } from "@/components/ui/Primitives";
import { Input, Textarea } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { clock } from "@/lib/format";

const STATUS_TONE = {
  ready: "published",
  transcoding: "draft",
  uploaded: "draft",
  none: "closed",
  failed: "archived",
};

const moduleName = (v, i) => v.title || `Module ${i + 1}`;

export default function RecordingsTab({ course }) {
  const dispatch = useAppDispatch();
  const fileRef = useRef(null);
  const { uploading, uploadProgress } = useAppSelector((s) => s.videos);
  const statuses = useAppSelector((s) => s.videos.statuses);
  const [title, setTitle] = useState("");
  const { confirm, dialog } = useConfirm();
  const courseId = course._id;
  const videos = course.videos || [];

  // Poll transcoding videos until ready/failed
  useEffect(() => {
    const pending = videos.filter((v) =>
      ["uploaded", "transcoding", "none"].includes(statuses[v._id]?.status || v.status)
    );
    if (pending.length === 0) return;
    const t = setInterval(() => {
      pending.forEach((v) =>
        dispatch(fetchVideoStatus({ courseId, videoId: v._id }))
      );
    }, 4000);
    return () => clearInterval(t);
  }, [videos, statuses, courseId, dispatch]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    dispatch(setUploadProgress(0));
    const res = await dispatch(
      uploadVideo({
        courseId,
        file,
        title: title.trim(),
        onProgress: (p) => dispatch(setUploadProgress(p)),
      })
    );
    if (uploadVideo.fulfilled.match(res)) {
      dispatch(pushToast("Upload complete — transcoding will follow", "success"));
      setTitle("");
      dispatch(fetchCourse(courseId));
    } else {
      dispatch(pushToast(res.payload?.message || "Upload failed", "error"));
    }
    e.target.value = "";
  };

  // The row disappears as soon as the delete succeeds (coursesSlice drops it
  // from course.videos). If the server refuses, the popup shows why.
  const onDelete = async (video, index) => {
    const ok = await confirm({
      title: "Delete this module?",
      message: `"${moduleName(video, index)}" and its video will be removed for everyone, and learners' comments, questions and notes on it will no longer be reachable. This can't be undone.`,
      confirmLabel: "Delete module",
      action: () => dispatch(deleteVideo({ courseId, videoId: video._id })).unwrap(),
    });
    if (ok) dispatch(pushToast("Module deleted", "success"));
  };

  return (
    <div>
      <Card className="mb-5 p-5">
        <h3 className="mb-3 font-serif text-lg text-ink">Add a module</h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Module title (optional)"
            className="flex-1"
          />
          <input ref={fileRef} type="file" accept="video/*" hidden onChange={onUpload} />
          <Button variant="teal" onClick={() => fileRef.current?.click()} loading={uploading}>
            <Upload size={16} />
            {uploading && uploadProgress != null
              ? `Uploading ${uploadProgress}%`
              : "Upload video"}
          </Button>
        </div>

        {uploading && uploadProgress != null && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-200">
              <div
                className="h-full rounded-full bg-teal transition-[width] duration-200 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">
              {uploadProgress < 100
                ? `Uploading… ${uploadProgress}%`
                : "Upload finished — starting transcode…"}
            </p>
          </div>
        )}

        <p className="mt-2 text-xs text-ink-muted">
          Up to 2GB. The file is transcoded to HLS after upload — status updates automatically.
        </p>
      </Card>

      {videos.length === 0 ? (
        <EmptyState icon={Film} title="No recordings yet" description="Upload a video to build out this session." />
      ) : (
        <div className="space-y-2">
          {videos.map((v, i) => {
            const live = statuses[v._id] || {};
            return (
              <VideoRow
                key={v._id}
                courseId={courseId}
                video={{
                  ...v,
                  status: live.status || v.status,
                  captionsStatus: live.captionsStatus || v.captionsStatus,
                  // The status poll reports the duration once transcoding
                  // finishes; use it so "duration pending" clears without a reload.
                  durationSeconds: live.durationSeconds ?? v.durationSeconds,
                }}
                index={i}
                onDelete={() => onDelete(v, i)}
              />
            );
          })}
        </div>
      )}
      {dialog}
    </div>
  );
}

function VideoRow({ courseId, video, index, onDelete }) {
  const dispatch = useAppDispatch();
  const retrying = useAppSelector((s) => s.videos.retrying[video._id]);
  const [editing, setEditing] = useState(false);
  const [editingCaptions, setEditingCaptions] = useState(false);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const transcoding = ["uploaded", "transcoding", "none"].includes(video.status);
  const failed = video.status === "failed";
  const captionsReady = video.captionsStatus === "ready";

  // Always start editing from the current title, not whatever was typed last time.
  const startEdit = () => {
    setName(video.title || "");
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const save = async () => {
    const title = name.trim();
    if (!title || savingName) return;
    if (title === (video.title || "")) return setEditing(false); // nothing changed
    setSavingName(true);
    const res = await dispatch(renameVideo({ courseId, videoId: video._id, title }));
    setSavingName(false);
    if (renameVideo.fulfilled.match(res)) {
      dispatch(pushToast("Title updated", "success"));
      setEditing(false);
    } else {
      dispatch(pushToast(res.payload?.message || "Title wasn't updated. Try again.", "error"));
    }
  };

  const onNameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const onRetry = async () => {
    const res = await dispatch(retryVideo({ courseId, videoId: video._id }));
    if (retryVideo.fulfilled.match(res)) {
      dispatch(pushToast("Re-processing started", "success"));
    } else {
      dispatch(pushToast(res.payload?.message || "Could not retry", "error"));
    }
  };

  return (
    <Card className="px-5 py-3.5">
      <div className="flex items-center gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cream-200 text-ink-muted">
          {transcoding ? <Loader2 size={18} className="animate-spin" /> : <Film size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={onNameKeyDown}
                placeholder="Module title"
                aria-label="Module title"
                autoFocus
                className="max-w-xs"
              />
              <Button
                size="sm"
                variant="teal"
                onClick={save}
                loading={savingName}
                disabled={!name.trim()}
                aria-label="Save title"
              >
                <Check size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={savingName} aria-label="Cancel">
                <X size={14} />
              </Button>
            </div>
          ) : (
            <p className="truncate font-medium text-ink">{moduleName(video, index)}</p>
          )}
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <span>
              {video.durationSeconds ? clock(video.durationSeconds) : "duration pending"}
            </span>
            {captionsReady && (
              <span className="inline-flex items-center gap-1 text-available">
                <Captions size={13} /> Captions
              </span>
            )}
            {video.captionsStatus === "failed" && (
              <span className="inline-flex items-center gap-1 text-red-600">
                <CaptionsOff size={13} /> Captions failed
              </span>
            )}
          </p>
        </div>
        <Badge tone={STATUS_TONE[video.status] || "closed"}>{video.status}</Badge>
        {failed && (
          <Button size="sm" variant="outline" onClick={onRetry} loading={retrying}>
            <RotateCcw size={14} /> Retry
          </Button>
        )}
        {captionsReady && (
          <Button
            size="sm"
            variant={editingCaptions ? "subtle" : "outline"}
            onClick={() => setEditingCaptions((v) => !v)}
          >
            <Captions size={14} /> {editingCaptions ? "Close" : "Edit captions"}
          </Button>
        )}
        {!editing && (
          <button type="button" onClick={startEdit} className="rounded-lg p-2 text-ink-muted hover:bg-ink/5 hover:text-ink" aria-label="Rename module" title="Rename">
            <Pencil size={16} />
          </button>
        )}
        <button type="button" onClick={onDelete} className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label="Delete module" title="Delete">
          <Trash2 size={16} />
        </button>
      </div>

      {editingCaptions && captionsReady && (
        <CaptionsEditForm
          courseId={courseId}
          videoId={video._id}
          onDone={() => setEditingCaptions(false)}
        />
      )}
    </Card>
  );
}

// Fetch-fresh-on-open WebVTT editor. The caption text isn't part of the course
// payload, so we always pull the live track when the editor opens. Saving
// overwrites only the subtitle text — the video's audio is untouched.
function CaptionsEditForm({ courseId, videoId, onDone }) {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const [vtt, setVtt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    dispatch(fetchVideoCaptions({ courseId, videoId })).then((res) => {
      if (!active) return;
      setLoading(false);
      if (fetchVideoCaptions.fulfilled.match(res)) {
        setVtt(res.payload?.vtt || "");
      } else {
        setError(res.payload?.message || "Failed to load captions");
      }
    });
    return () => {
      active = false;
    };
  }, [dispatch, courseId, videoId]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await dispatch(updateVideoCaptions({ courseId, videoId, vtt }));
    setSaving(false);
    if (updateVideoCaptions.fulfilled.match(res)) {
      dispatch(pushToast("Captions saved", "success"));
      onDone();
    } else {
      setError(res.payload?.message || "Failed to save captions");
    }
  };

  return (
    <div className="mt-3 border-t border-ink/8 pt-3">
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-ink-muted">
          <Loader2 size={15} className="animate-spin" /> Loading current captions…
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs text-ink-muted">
            Editing the subtitle text only — the video&apos;s own audio is unchanged.
            Keep the WebVTT format (timestamps like <code className="rounded bg-cream-200 px-1">00:00:01.000 --&gt; 00:00:04.000</code>).
          </p>
          <Textarea
            value={vtt}
            onChange={(e) => setVtt(e.target.value)}
            rows={12}
            spellCheck={false}
            className="font-mono text-xs leading-relaxed"
          />
          <div className="mt-2.5 flex items-center gap-2">
            <Button size="sm" variant="teal" onClick={save} loading={saving}>
              <Check size={14} /> Save captions
            </Button>
            <Button size="sm" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </>
      )}
      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}