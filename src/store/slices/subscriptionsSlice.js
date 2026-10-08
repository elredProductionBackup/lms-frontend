import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

// POST /api/courses/:id/subscriptions
export const createSubscription = createAsyncThunk(
  "subs/create",
  async ({ courseId, body }, { rejectWithValue }) => {
    try {
      return await api.post(`/courses/${courseId}/subscriptions`, body);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// GET /api/courses/:id/subscriptions  (with seat progress)
export const fetchSubscriptions = createAsyncThunk(
  "subs/list",
  async (courseId, { rejectWithValue }) => {
    try {
      const data = await api.get(`/courses/${courseId}/subscriptions`);
      return data.subscriptions || [];
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/subscriptions/:id  { seatLimit?, accessStartAt?, accessEndAt?, status? }
export const updateSubscription = createAsyncThunk(
  "subs/update",
  async ({ id, patch }, { rejectWithValue }) => {
    try {
      return await api.put(`/subscriptions/${id}`, patch);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/subscriptions/:id/seats  { email }
export const assignSeat = createAsyncThunk(
  "subs/assignSeat",
  async ({ id, email }, { rejectWithValue }) => {
    try {
      return await api.post(`/subscriptions/${id}/seats`, { email });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// DELETE /api/subscriptions/:id/seats/:email
export const revokeSeat = createAsyncThunk(
  "subs/revokeSeat",
  async ({ id, email }, { rejectWithValue }) => {
    try {
      await api.del(`/subscriptions/${id}/seats/${encodeURIComponent(email)}`);
      return { id, email };
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/enrollments/:id/window  { startAt?, endAt?, forceStatus? }
export const updateEnrollmentWindow = createAsyncThunk(
  "subs/enrollWindow",
  async ({ enrollmentId, patch }, { rejectWithValue }) => {
    try {
      return await api.put(`/enrollments/${enrollmentId}/window`, patch);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

const slice = createSlice({
  name: "subscriptions",
  initialState: { items: [], status: "idle", mutating: false, error: null },
  reducers: {
    clearSubscriptions(s) {
      s.items = [];
    },
    clearSubError(s) {
      s.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchSubscriptions.pending, (s) => {
      s.status = "loading";
    })
      .addCase(fetchSubscriptions.fulfilled, (s, a) => {
        s.status = "idle";
        s.items = a.payload;
      })
      .addCase(fetchSubscriptions.rejected, (s, a) => {
        s.status = "error";
        s.error = a.payload?.message;
      });

    const upsert = (s, a) => {
      s.mutating = false;
      const sub = a.payload.subscription || a.payload;
      const i = s.items.findIndex((x) => x._id === sub._id);
      if (i >= 0) s.items[i] = sub;
      else s.items.unshift(sub);
    };
    [createSubscription, updateSubscription, assignSeat].forEach((t) => {
      b.addCase(t.pending, (s) => {
        s.mutating = true;
        s.error = null;
      });
      b.addCase(t.fulfilled, upsert);
      b.addCase(t.rejected, (s, a) => {
        s.mutating = false;
        s.error = a.payload?.message;
      });
    });

    b.addCase(revokeSeat.fulfilled, (s, a) => {
      const sub = s.items.find((x) => x._id === a.payload.id);
      if (sub) {
        const seat = sub.seats?.find((st) => st.email === a.payload.email);
        if (seat) seat.status = "revoked";
      }
    });
  },
});

export const { clearSubscriptions, clearSubError } = slice.actions;
export default slice.reducer;
