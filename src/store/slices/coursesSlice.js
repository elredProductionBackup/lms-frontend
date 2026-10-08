import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

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
  },
});

export const { clearCurrentCourse } = slice.actions;
export default slice.reducer;
