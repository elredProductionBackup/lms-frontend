import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api, withPage, pageResult, EMPTY_PAGE, PAGE_SIZE } from "@/lib/api";

// GET /api/join-requests?start=&offset=  (admin, all statuses)
//   -> { requests, total? }
export const fetchJoinRequests = createAsyncThunk(
  "join/list",
  async ({ start = 0, offset = PAGE_SIZE } = {}, { rejectWithValue }) => {
    try {
      const data = await api.get(withPage("/join-requests", { start, offset }));
      return pageResult(data.requests || [], data.total, { start, offset });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/join-requests/:requestId  { action: 'approve' | 'reject' }
export const reviewJoinRequest = createAsyncThunk(
  "join/review",
  async ({ requestId, action }, { rejectWithValue }) => {
    try {
      return await api.put(`/join-requests/${requestId}`, { action });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/public/join-requests  (public sign-up)
export const submitJoinRequest = createAsyncThunk(
  "join/submit",
  async (payload, { rejectWithValue }) => {
    try {
      return await api.post("/public/join-requests", payload, {
        auth: false,
      });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

const slice = createSlice({
  name: "joinRequests",
  initialState: {
    items: [],
    page: EMPTY_PAGE,
    status: "idle",
    reviewing: null, // requestId being processed
    submitStatus: "idle",
    error: null,
  },
  reducers: {
    resetSubmit(s) {
      s.submitStatus = "idle";
      s.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchJoinRequests.pending, (s) => {
      s.status = "loading";
    })
      .addCase(fetchJoinRequests.fulfilled, (s, a) => {
        s.status = "idle";
        s.items = a.payload.items;
        s.page = a.payload.page;
      })
      .addCase(fetchJoinRequests.rejected, (s, a) => {
        s.status = "error";
        s.error = a.payload?.message;
      });

    b.addCase(reviewJoinRequest.pending, (s, a) => {
      s.reviewing = a.meta.arg.requestId;
    })
      .addCase(reviewJoinRequest.fulfilled, (s, a) => {
        s.reviewing = null;
        const i = s.items.findIndex((r) => r._id === a.payload._id);
        if (i >= 0) s.items[i] = a.payload;
      })
      .addCase(reviewJoinRequest.rejected, (s, a) => {
        s.reviewing = null;
        s.error = a.payload?.message;
      });

    b.addCase(submitJoinRequest.pending, (s) => {
      s.submitStatus = "loading";
      s.error = null;
    })
      .addCase(submitJoinRequest.fulfilled, (s) => {
        s.submitStatus = "success";
      })
      .addCase(submitJoinRequest.rejected, (s, a) => {
        s.submitStatus = "error";
        s.error = a.payload?.message;
      });
  },
});

export const { resetSubmit } = slice.actions;
export default slice.reducer;
