import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

// "My team": the buyer of an enterprise plan hands its seats to colleagues.
// The buyer holds one of the seats themselves (seat.isOwner).

const seatsPath = (subscriptionId) => `/my/subscriptions/${subscriptionId}/seats`;
const seatPath = (subscriptionId, email) => `${seatsPath(subscriptionId)}/${encodeURIComponent(email)}`;

// GET /my/subscriptions
//   -> { subscriptions: [{ id, type, status, seatLimit, seatsUsed, seatsAvailable,
//        isLifetime, accessStartAt, accessEndAt, companyName, course, seats: [...] }] }
// Only enterprise plans have seats to share, so single plans are left out.
// `silent` refreshes without swapping the page for a spinner.
export const fetchMyTeam = createAsyncThunk(
  "team/fetch",
  async (_opts = {}, { rejectWithValue }) => {
    try {
      const data = await api.get("/my/subscriptions");
      return (data?.subscriptions || []).filter((s) => s.type === "enterprise");
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// One email  -> POST /my/subscriptions/:id/seats       { email }
//               -> { ok, seat: { email, name } }
// Several    -> POST /my/subscriptions/:id/seats/bulk  { emails: "a@x.com, b@x.com" }
//               -> { ok, added, failed, seatsUsed, seatsAvailable,
//                    results: [{ email, ok, error?: { code, message } }] }
// Always resolves to { results } in the bulk shape, so the form can keep the
// emails that failed and show each one's reason.
export const addTeamSeats = createAsyncThunk(
  "team/add",
  async ({ subscriptionId, emails }, { rejectWithValue }) => {
    if (emails.length === 1) {
      const email = emails[0];
      try {
        await api.post(seatsPath(subscriptionId), { email });
        return { results: [{ email, ok: true }] };
      } catch (e) {
        if (e.status === 401) return rejectWithValue({ code: e.code, message: e.message });
        return { results: [{ email, ok: false, error: { code: e.code, message: e.message } }] };
      }
    }
    try {
      const data = await api.post(`${seatsPath(subscriptionId)}/bulk`, { emails: emails.join(", ") });
      return { results: data?.results || emails.map((email) => ({ email, ok: true })) };
    } catch (e) {
      // If every email fails the API may answer with an error status; the
      // per-email results are still in the body.
      if (Array.isArray(e.body?.results)) return { results: e.body.results };
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /my/subscriptions/:id/seats/:email  { newEmail }
export const replaceTeamSeat = createAsyncThunk(
  "team/replace",
  async ({ subscriptionId, email, newEmail }, { rejectWithValue }) => {
    try {
      return await api.put(seatPath(subscriptionId, email), { newEmail });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// DELETE /my/subscriptions/:id/seats/:email
export const removeTeamSeat = createAsyncThunk(
  "team/remove",
  async ({ subscriptionId, email }, { rejectWithValue }) => {
    try {
      await api.del(seatPath(subscriptionId, email));
      return { subscriptionId, email };
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

const slice = createSlice({
  name: "team",
  initialState: {
    plans: [],
    selectedId: null,
    status: "idle", // idle | loading | ready | error
    refreshing: false,
    assigning: false,
    busyEmail: null, // seat row being replaced / removed
    error: null,
  },
  reducers: {
    selectPlan(s, a) {
      s.selectedId = a.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchMyTeam.pending, (s, a) => {
      if (a.meta.arg?.silent && s.status === "ready") s.refreshing = true;
      else s.status = "loading";
      s.error = null;
    })
      .addCase(fetchMyTeam.fulfilled, (s, a) => {
        s.status = "ready";
        s.refreshing = false;
        s.plans = a.payload;
        if (!a.payload.some((p) => p.id === s.selectedId)) s.selectedId = a.payload[0]?.id || null;
      })
      .addCase(fetchMyTeam.rejected, (s, a) => {
        s.refreshing = false;
        // A failed background refresh keeps what's on screen.
        if (s.status !== "ready") {
          s.status = "error";
          s.error = a.payload?.message || "Your team couldn't be loaded.";
        }
      });

    b.addCase(addTeamSeats.pending, (s) => {
      s.assigning = true;
    })
      .addCase(addTeamSeats.fulfilled, (s) => {
        s.assigning = false;
      })
      .addCase(addTeamSeats.rejected, (s) => {
        s.assigning = false;
      });

    [replaceTeamSeat, removeTeamSeat].forEach((t) => {
      b.addCase(t.pending, (s, a) => {
        s.busyEmail = a.meta.arg.email;
      });
      b.addCase(t.rejected, (s) => {
        s.busyEmail = null;
      });
    });

    b.addCase(replaceTeamSeat.fulfilled, (s) => {
      s.busyEmail = null;
    });

    // Drop the row straight away; the refetch that follows confirms counts.
    b.addCase(removeTeamSeat.fulfilled, (s, a) => {
      s.busyEmail = null;
      const plan = s.plans.find((p) => p.id === a.payload.subscriptionId);
      if (!plan) return;
      const before = plan.seats.length;
      plan.seats = plan.seats.filter((x) => x.email !== a.payload.email);
      if (plan.seats.length < before) {
        plan.seatsUsed = Math.max(0, (plan.seatsUsed ?? before) - 1);
        plan.seatsAvailable = (plan.seatsAvailable ?? 0) + 1;
      }
    });
  },
});

export const { selectPlan } = slice.actions;
export default slice.reducer;
