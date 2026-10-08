import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

// GET /api/overview  -> { courseCount, publishedCourseCount, userCount }
export const fetchOverview = createAsyncThunk(
  "admin/overview",
  async (_, { rejectWithValue }) => {
    try {
      return await api.get("/overview");
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// GET /api/audit-log?action=&actorEmail=&from=&to=
export const fetchAuditLog = createAsyncThunk(
  "admin/audit",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const qs = new URLSearchParams();
      if (filters.action) qs.set("action", filters.action);
      if (filters.actorEmail) qs.set("actorEmail", filters.actorEmail);
      if (filters.from) qs.set("from", filters.from);
      if (filters.to) qs.set("to", filters.to);
      const q = qs.toString();
      const data = await api.get(`/audit-log${q ? `?${q}` : ""}`);
      return data.entries || [];
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// GET /api/audit-log/actions
export const fetchAuditActions = createAsyncThunk(
  "admin/auditActions",
  async (_, { rejectWithValue }) => {
    try {
      const data = await api.get("/audit-log/actions");
      return data.actions || [];
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

const slice = createSlice({
  name: "admin",
  initialState: {
    overview: null,
    entries: [],
    actions: [],
    overviewStatus: "idle",
    auditStatus: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchOverview.pending, (s) => {
      s.overviewStatus = "loading";
    })
      .addCase(fetchOverview.fulfilled, (s, a) => {
        s.overviewStatus = "idle";
        s.overview = a.payload;
      })
      .addCase(fetchOverview.rejected, (s, a) => {
        s.overviewStatus = "error";
        s.error = a.payload?.message;
      });

    b.addCase(fetchAuditLog.pending, (s) => {
      s.auditStatus = "loading";
    })
      .addCase(fetchAuditLog.fulfilled, (s, a) => {
        s.auditStatus = "idle";
        s.entries = a.payload;
      })
      .addCase(fetchAuditLog.rejected, (s, a) => {
        s.auditStatus = "error";
        s.error = a.payload?.message;
      });

    b.addCase(fetchAuditActions.fulfilled, (s, a) => {
      s.actions = a.payload;
    });
  },
});

export default slice.reducer;
