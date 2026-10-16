import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";
import { renameVideo, deleteVideo, uploadVideoThumbnail } from "@/store/slices/videosSlice";

// GET /api/courses?scope=catalog|manage
export const fetchCourses = createAsyncThunk(
  "courses/list",
  async (scope = "catalog", { rejectWithValue }) => {
    try {
      const data = await api.get(`/courses?scope=${scope}`);
      return { scope, courses: data.courses || [] };
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// GET /api/public/courses  (logged-out catalog)
export const fetchPublicCourses = createAsyncThunk(
  "courses/public",
  async (_, { rejectWithValue }) => {
    try {
      const data = await api.get("/public/courses", { auth: false });
      return data.courses || [];
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// GET /api/courses/:id
export const fetchCourse = createAsyncThunk(
  "courses/get",
  async (id, { rejectWithValue }) => {
    try {
      return await api.get(`/courses/${id}`);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/courses
export const createCourse = createAsyncThunk(
  "courses/create",
  async (body, { rejectWithValue }) => {
    try {
      return await api.post("/courses", body);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/courses/:id
export const updateCourse = createAsyncThunk(
  "courses/update",
  async ({ id, patch }, { rejectWithValue }) => {
    try {
      return await api.put(`/courses/${id}`, patch);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/courses/:id/thumbnail  (multipart "file")
export const uploadThumbnail = createAsyncThunk(
  "courses/thumbnail",
  async ({ id, file }, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      return await api.form(`/courses/${id}/thumbnail`, fd);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/courses/:id/images  (multipart "files" - up to 10)
export const uploadCourseImages = createAsyncThunk(
  "courses/images/add",
  async ({ id, files }, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      return await api.form(`/courses/${id}/images`, fd);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// DELETE /api/courses/:id/images  { url }
export const removeCourseImage = createAsyncThunk(
  "courses/images/remove",
  async ({ id, url }, { rejectWithValue }) => {
    try {
      return await api.del(`/courses/${id}/images`, { url });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/courses/:id/publish
export const publishCourse = createAsyncThunk(
  "courses/publish",
  async (id, { rejectWithValue }) => {
    try {
      return await api.put(`/courses/${id}/publish`, null);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/courses/:id/archive
export const archiveCourse = createAsyncThunk(
  "courses/archive",
  async (id, { rejectWithValue }) => {
    try {
      return await api.put(`/courses/${id}/archive`, null);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// GET /api/courses/:id/users  (roster)
export const fetchCourseRoster = createAsyncThunk(
  "courses/roster",
  async (id, { rejectWithValue }) => {
    try {
      const data = await api.get(`/courses/${id}/users`);
      return { id, users: data.users || [] };
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// Apply a change to one course wherever this slice holds a copy of it: the
// open course and the catalog / manage lists. Keeps every screen in step
// without a refetch.
function updateCourseEverywhere(s, courseId, change) {
  if (s.current?._id === courseId) change(s.current);
  [s.catalog, s.manage].forEach((list) =>
    list.forEach((c) => {
      if (c._id === courseId) change(c);
    })
  );
}

const slice = createSlice({
  name: "courses",
  initialState: {
    catalog: [],
    manage: [],
    publicList: [],
    current: null,
    roster: [],
    status: "idle",
    detailStatus: "idle",
    error: null,
    mutating: false,
  },
  reducers: {
    clearCurrentCourse(s) {
      s.current = null;
      s.roster = [];
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchCourses.pending, (s) => {
      s.status = "loading";
      s.error = null;
    })
      .addCase(fetchCourses.fulfilled, (s, a) => {
        s.status = "idle";
        if (a.payload.scope === "manage") s.manage = a.payload.courses;
        else s.catalog = a.payload.courses;
      })
      .addCase(fetchCourses.rejected, (s, a) => {
        s.status = "error";
        s.error = a.payload?.message;
      });

    b.addCase(fetchPublicCourses.fulfilled, (s, a) => {
      s.publicList = a.payload;
    });

    b.addCase(fetchCourse.pending, (s) => {
      s.detailStatus = "loading";
      s.error = null;
    })
      .addCase(fetchCourse.fulfilled, (s, a) => {
        s.detailStatus = "idle";
        s.current = a.payload;
      })
      .addCase(fetchCourse.rejected, (s, a) => {
        s.detailStatus = "error";
        s.error = a.payload?.message;
      });

    const setCurrent = (s, a) => {
      s.mutating = false;
      s.current = a.payload;
    };
    [
      createCourse,
      updateCourse,
      uploadThumbnail,
      uploadCourseImages,
      removeCourseImage,
      publishCourse,
      archiveCourse,
    ].forEach((thunk) => {
      b.addCase(thunk.pending, (s) => {
        s.mutating = true;
        s.error = null;
      });
      b.addCase(thunk.fulfilled, setCurrent);
      b.addCase(thunk.rejected, (s, a) => {
        s.mutating = false;
        s.error = a.payload?.message;
      });
    });

    b.addCase(fetchCourseRoster.fulfilled, (s, a) => {
      s.roster = a.payload.users;
    });

    // ----- module (video) changes made from the Modules tab -----
    // These thunks live in videosSlice, but the module list on screen is
    // course.videos from this slice, so it has to be updated here too.
    // Only the one field that changed is patched: the PUT/DELETE responses
    // don't carry `unlocked` / `author`, so we never swap the whole course.

    b.addCase(renameVideo.fulfilled, (s, a) => {
      const { courseId, videoId, title } = a.meta.arg;
      // Prefer the title the server saved (it may trim it), whatever shape
      // the response has: the course, the video, or nothing useful.
      const fromServer =
        a.payload?.videos?.find?.((v) => v._id === videoId)?.title ??
        (a.payload?._id === videoId ? a.payload.title : undefined);
      const nextTitle = fromServer ?? title;
      updateCourseEverywhere(s, courseId, (c) => {
        const video = c.videos?.find((v) => v._id === videoId);
        if (video) video.title = nextTitle;
      });
    });

    b.addCase(uploadVideoThumbnail.fulfilled, (s, a) => {
      const { courseId, videoId } = a.meta.arg;
      const url = a.payload?.thumbnailUrl ?? null;
      updateCourseEverywhere(s, courseId, (c) => {
        const video = c.videos?.find((v) => v._id === videoId);
        if (video) video.thumbnailUrl = url;
      });
    });

    b.addCase(deleteVideo.fulfilled, (s, a) => {
      const { courseId, videoId } = a.meta.arg;
      updateCourseEverywhere(s, courseId, (c) => {
        if (c.videos) c.videos = c.videos.filter((v) => v._id !== videoId);
      });
    });
  },
});

export const { clearCurrentCourse } = slice.actions;
export default slice.reducer;