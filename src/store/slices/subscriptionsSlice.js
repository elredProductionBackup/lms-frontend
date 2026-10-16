import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

// POST /api/courses/:id/subscriptions
//   { type, seatLimit?, subscriptionCode, subscriptionDetails?, accessStartAt, accessEndAt }
// Subscriptions have no display name (dropped; UC-FN13).
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

// GET /api/courses/:id/subscriptions
// Every seat: { email, userId, status, userExists, user: { id, name, email,
// avatarUrl } | null, progress }. Revoked seats are listed too.
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

// POST /api/subscriptions/:id/seats  { email, displayName? }
// -> { subscription, enrollment, user: { id, name, email } }
// displayName (max 100, trimmed) becomes the person's profile name only if
// this call creates their account; for an existing account it's ignored and
// user.name is their current name. Blank/missing -> the part before "@".
export const assignSeat = createAsyncThunk(
  "subs/assignSeat",
  async ({ id, email, displayName }, { rejectWithValue }) => {
    try {
      const body = { email };
      const name = (displayName || "").trim();
      if (name) body.displayName = name;
      return await api.post(`/subscriptions/${id}/seats`, body);
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
  initialState: {
    items: [],
    status: "idle",
    mutating: false,
    error: null,
  },
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

    // Merge the returned subscription over the one we hold (the seat route
    // returns { subscription, enrollment }), keeping fields the response
    // leaves out, e.g. seat progress, which only the list endpoint adds.
    const upsert = (s, a) => {
      s.mutating = false;
      const isUpdate = a.type === updateSubscription.fulfilled.type;
      const raw = a.payload?.subscription || a.payload;
      const sub = raw?._id ? raw : null;
      const id = sub?._id || (isUpdate ? a.meta.arg.id : null);
      if (!id) return; // nothing usable; the screen refetches anyway
      const i = s.items.findIndex((x) => x._id === id);
      if (i < 0 && !sub) return;
      const next = { ...(i >= 0 ? s.items[i] : {}), ...(sub || {}) };
      // A 200 on PUT means the change was saved; if the body is partial (or
      // just { ok: true }), still show what we sent.
      if (isUpdate) {
        Object.entries(a.meta.arg.patch || {}).forEach(([k, v]) => {
          if (!sub || !(k in sub)) next[k] = v;
        });
      }
      if (i >= 0) s.items[i] = next;
      else s.items.unshift(next);
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
