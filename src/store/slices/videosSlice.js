import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

// S3 needs >= 5MB per part (except the last); 16MB keeps the request count low
// while staying well under the 10,000-part cap for large files.
const MULTIPART_PART_SIZE = 16 * 1024 * 1024;

// Raw PUT straight to S3 via the presigned URL. This must NOT go through the
// `api` wrapper (no Authorization header / API base URL should get attached),
// and we still want a live progress %, so use XHR directly. Resolves with the
// part's ETag — which requires the bucket's CORS to expose the ETag header.
function putPartToS3(url, chunk, onLoaded) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) onLoaded(evt.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader("ETag"));
      } else {
        reject(new Error(`S3 upload failed for part (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during S3 upload"));
    xhr.onabort = () => reject(new Error("S3 upload aborted"));
    xhr.send(chunk);
  });
}

// S3 multipart flow — replaces the old direct POST .../videos route (2GB cap).
// initiate -> part-url (once per part) -> PUT each part straight to S3 ->
// complete. On any failure after initiate succeeds, abort so the backend can
// drop the half-made video record and S3 stops billing the orphaned parts.
// Returns { videoId, status: 'uploaded' }; the component refetches the course
// afterward to pull the new video subdoc into current.videos.
export const uploadVideo = createAsyncThunk(
  "videos/upload",
  async ({ courseId, file, title, onProgress }, { rejectWithValue }) => {
    let videoId, uploadId, key;
    try {
      ({ videoId, uploadId, key } = await api.post(
        `/courses/${courseId}/videos/initiate`,
        {
          title: title || undefined,
          filename: file.name,
          contentType: file.type || undefined,
        }
      ));

      const totalParts = Math.max(1, Math.ceil(file.size / MULTIPART_PART_SIZE));
      const parts = [];
      let uploadedBytes = 0;

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const start = (partNumber - 1) * MULTIPART_PART_SIZE;
        const chunk = file.slice(start, Math.min(start + MULTIPART_PART_SIZE, file.size));

        const { url } = await api.post(
          `/courses/${courseId}/videos/${videoId}/part-url`,
          { key, uploadId, partNumber }
        );

        const etag = await putPartToS3(url, chunk, (loaded) => {
          if (onProgress) {
            onProgress(Math.round(((uploadedBytes + loaded) / file.size) * 100));
          }
        });

        uploadedBytes += chunk.size;
        parts.push({ ETag: etag, PartNumber: partNumber });
      }

      // { videoId, status: 'uploaded' }
      return await api.post(`/courses/${courseId}/videos/${videoId}/complete`, {
        key,
        uploadId,
        parts,
      });
    } catch (e) {
      if (videoId && uploadId && key) {
        try {
          await api.post(`/courses/${courseId}/videos/${videoId}/abort`, {
            key,
            uploadId,
          });
        } catch {
          // best-effort — nothing more the FE can do if the abort itself fails
        }
      }
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);
// POST /api/courses/:id/videos/:videoId/retry  (only valid when status==="failed")
// -> { videoId, status: "transcoding" }
export const retryVideo = createAsyncThunk(
  "videos/retry",
  async ({ courseId, videoId }, { rejectWithValue }) => {
    try {
      return await api.post(`/courses/${courseId}/videos/${videoId}/retry`, null);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// GET /api/courses/:id/videos/:videoId/captions -> { videoId, vtt }
// The caption text isn't part of the course payload, so this is the only way to
// read the current WebVTT for editing.
export const fetchVideoCaptions = createAsyncThunk(
  "videos/fetchCaptions",
  async ({ courseId, videoId }, { rejectWithValue }) => {
    try {
      return await api.get(`/courses/${courseId}/videos/${videoId}/captions`);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PATCH /api/courses/:id/videos/:videoId/captions  { vtt }
// Overwrites the caption track's text only — the video's audio is untouched.
// -> { videoId, captionsStatus: 'ready' }
export const updateVideoCaptions = createAsyncThunk(
  "videos/updateCaptions",
  async ({ courseId, videoId, vtt }, { rejectWithValue }) => {
    try {
      return await api.patch(`/courses/${courseId}/videos/${videoId}/captions`, {
        vtt,
      });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// GET /api/courses/:id/videos/:videoId/status
export const fetchVideoStatus = createAsyncThunk(
  "videos/status",
  async ({ courseId, videoId }, { rejectWithValue }) => {
    try {
      return await api.get(`/courses/${courseId}/videos/${videoId}/status`);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/courses/:id/videos/:videoId  { title }
export const renameVideo = createAsyncThunk(
  "videos/rename",
  async ({ courseId, videoId, title }, { rejectWithValue }) => {
    try {
      return await api.put(`/courses/${courseId}/videos/${videoId}`, {
        title,
      });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// DELETE /api/courses/:id/videos/:videoId -> returns updated course
export const deleteVideo = createAsyncThunk(
  "videos/delete",
  async ({ courseId, videoId }, { rejectWithValue }) => {
    try {
      return await api.del(`/courses/${courseId}/videos/${videoId}`);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/courses/:id/videos/:videoId/stream-session
// -> { manifestUrl, heartbeatSeconds, resumeAtSeconds } (+ HttpOnly cookie)
export const startStreamSession = createAsyncThunk(
  "videos/streamSession",
  async ({ courseId, videoId }, { rejectWithValue }) => {
    try {
      return await api.post(
        `/courses/${courseId}/videos/${videoId}/stream-session`,
        null
      );
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST .../stream-session/heartbeat
export const streamHeartbeat = createAsyncThunk(
  "videos/heartbeat",
  async ({ courseId, videoId }, { rejectWithValue }) => {
    try {
      return await api.post(
        `/courses/${courseId}/videos/${videoId}/stream-session/heartbeat`,
        null
      );
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/courses/:id/videos/:videoId/progress  { positionSeconds, durationSeconds? }
export const saveProgress = createAsyncThunk(
  "videos/progress",
  async ({ courseId, videoId, positionSeconds, durationSeconds }, { rejectWithValue }) => {
    try {
      return await api.post(
        `/courses/${courseId}/videos/${videoId}/progress`,
        { positionSeconds, durationSeconds }
      );
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

const slice = createSlice({
  name: "videos",
  initialState: {
    statuses: {}, // videoId -> status object
    session: null, // active stream session for the player
    uploading: false,
    uploadError: null,
    uploadProgress: null, // 0-100 while uploading, null otherwise
    lastUploaded: null,
    retrying: {}, // videoId -> bool
  },
  reducers: {
    clearSession(s) {
      s.session = null;
    },
    setUploadProgress(s, a) {
      s.uploadProgress = a.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(uploadVideo.pending, (s) => {
      s.uploading = true;
      s.uploadError = null;
    })
      .addCase(uploadVideo.fulfilled, (s, a) => {
        s.uploading = false;
        s.uploadProgress = null;
        s.lastUploaded = a.payload;
        if (a.payload?.videoId)
          s.statuses[a.payload.videoId] = { status: a.payload.status };
      })
      .addCase(uploadVideo.rejected, (s, a) => {
        s.uploading = false;
        s.uploadProgress = null;
        s.uploadError = a.payload?.message;
      });

    // Retry: reflect transcoding immediately so the row updates without waiting.
    b.addCase(retryVideo.pending, (s, a) => {
      s.retrying[a.meta.arg.videoId] = true;
    });
    b.addCase(retryVideo.fulfilled, (s, a) => {
      const { videoId } = a.meta.arg;
      s.retrying[videoId] = false;
      if (a.payload?.videoId) {
        s.statuses[a.payload.videoId] = {
          ...(s.statuses[a.payload.videoId] || {}),
          status: a.payload.status,
          progressPercent: 0,
        };
      }
    });
    b.addCase(retryVideo.rejected, (s, a) => {
      s.retrying[a.meta.arg.videoId] = false;
    });

    b.addCase(fetchVideoStatus.fulfilled, (s, a) => {
      if (a.payload?._id) s.statuses[a.payload._id] = a.payload;
    });

    // Reflect the new caption status on the row immediately after a save.
    b.addCase(updateVideoCaptions.fulfilled, (s, a) => {
      const { videoId, captionsStatus } = a.payload || {};
      if (videoId) {
        s.statuses[videoId] = {
          ...(s.statuses[videoId] || {}),
          captionsStatus: captionsStatus || "ready",
        };
      }
    });

    b.addCase(startStreamSession.fulfilled, (s, a) => {
      s.session = a.payload;
    });
    b.addCase(streamHeartbeat.fulfilled, (s, a) => {
      s.session = a.payload;
    });
  },
});

export const { clearSession, setUploadProgress } = slice.actions;
export default slice.reducer;
