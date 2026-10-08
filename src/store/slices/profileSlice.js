import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

// GET /api/me/profile
export const fetchMyProfile = createAsyncThunk(
  "profile/fetchMine",
  async (_, { rejectWithValue }) => {
    try {
      return await api.get("/me/profile");
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/me/profile
export const updateMyProfile = createAsyncThunk(
  "profile/updateMine",
  async (patch, { rejectWithValue }) => {
    try {
      return await api.put("/me/profile", patch);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/me/avatar  (multipart field "file")
export const uploadMyAvatar = createAsyncThunk(
  "profile/uploadAvatar",
  async (file, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      return await api.form("/me/avatar", fd);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// GET /api/users/:userId/profile
export const fetchUserProfile = createAsyncThunk(
  "profile/fetchUser",
  async (userId, { rejectWithValue }) => {
    try {
      return await api.get(`/users/${userId}/profile`);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/users/:userId/profile  (admin/self)
export const updateUserProfile = createAsyncThunk(
  "profile/updateUser",
  async ({ userId, patch }, { rejectWithValue }) => {
    try {
      return await api.put(`/users/${userId}/profile`, patch);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

const slice = createSlice({
  name: "profile",
  initialState: {
    me: null,
    viewed: null, // another user's profile
    status: "idle",
    saving: false,
    error: null,
    savedAt: null,
  },
  reducers: {
    clearViewedProfile(s) {
      s.viewed = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchMyProfile.pending, (s) => {
      s.status = "loading";
    })
      .addCase(fetchMyProfile.fulfilled, (s, a) => {
        s.status = "idle";
        s.me = a.payload;
      })
      .addCase(fetchMyProfile.rejected, (s, a) => {
        s.status = "error";
        s.error = a.payload?.message;
      });

    b.addCase(updateMyProfile.pending, (s) => {
      s.saving = true;
      s.error = null;
    })
      .addCase(updateMyProfile.fulfilled, (s, a) => {
        s.saving = false;
        s.me = a.payload;
        s.savedAt = Date.now();
      })
      .addCase(updateMyProfile.rejected, (s, a) => {
        s.saving = false;
        s.error = a.payload?.message;
      });

    b.addCase(uploadMyAvatar.fulfilled, (s, a) => {
      s.me = a.payload;
      s.savedAt = Date.now();
    });

    b.addCase(fetchUserProfile.fulfilled, (s, a) => {
      s.viewed = a.payload;
    });
    b.addCase(updateUserProfile.fulfilled, (s, a) => {
      s.viewed = a.payload;
      s.savedAt = Date.now();
    });
  },
});

export const { clearViewedProfile } = slice.actions;
export default slice.reducer;
