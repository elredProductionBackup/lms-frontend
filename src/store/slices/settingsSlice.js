import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

// GET /api/public/settings  -> { name, logoUrl }
export const fetchPublicSettings = createAsyncThunk(
  "settings/public",
  async (_, { rejectWithValue }) => {
    try {
      return await api.get("/public/settings", { auth: false });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/settings/logo  (admin, multipart "file")
export const uploadLogo = createAsyncThunk(
  "settings/logo",
  async (file, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      return await api.form("/settings/logo", fd);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

const slice = createSlice({
  name: "settings",
  initialState: {
    name: "The Professionals Network",
    logoUrl: null,
    status: "idle",
    saving: false,
    error: null,
  },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchPublicSettings.fulfilled, (s, a) => {
      s.name = a.payload?.name || s.name;
      s.logoUrl = a.payload?.logoUrl || null;
    });
    b.addCase(uploadLogo.pending, (s) => {
      s.saving = true;
    })
      .addCase(uploadLogo.fulfilled, (s, a) => {
        s.saving = false;
        s.name = a.payload?.name || s.name;
        s.logoUrl = a.payload?.logoUrl || s.logoUrl;
      })
      .addCase(uploadLogo.rejected, (s, a) => {
        s.saving = false;
        s.error = a.payload?.message;
      });
  },
});

export default slice.reducer;
