import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api, setToken, clearToken, getToken } from "@/lib/api";

// --- Thunks (endpoints 1-4) -------------------------------------------------

export const requestOtp = createAsyncThunk(
  "auth/requestOtp",
  async ({ email }, { rejectWithValue }) => {
    try {
      // POST /api/auth/request-otp
      return await api.post("/auth/request-otp", { email }, { auth: false });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async ({ email, code }, { rejectWithValue }) => {
    try {
      // POST /api/auth/verify-otp -> { token, role, user }
      const data = await api.post(
        "/auth/verify-otp",
        { email, code },
        { auth: false }
      );
      setToken(data.token);
      return data;
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

export const fetchMe = createAsyncThunk(
  "auth/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      // GET /api/me
      return await api.get("/me");
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

export const logout = createAsyncThunk("auth/logout", async () => {
  try {
    // POST /api/auth/logout
    await api.post("/auth/logout", null);
  } catch (_) {
    /* even if it fails we clear locally */
  }
  clearToken();
  return true;
});

const initialState = {
  token: null,
  user: null, // { id, name, email, role, avatarUrl, aboutHtml }
  role: null,
  status: "idle", // idle | loading | authenticated | error
  otpStage: "email", // email | code
  otpEmail: "",
  devOtp: null, // dev-only convenience echo
  error: null,
  bootstrapped: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    hydrateToken(state) {
      state.token = getToken();
    },
    // Merge fresh fields (name, avatarUrl, ...) into the signed-in user so UI
    // like the top-nav avatar updates immediately after a profile/avatar save,
    // without waiting for a full page reload.
    userUpdated(state, action) {
      if (!action.payload) return;
      state.user = { ...(state.user || {}), ...action.payload };
    },
    setOtpStage(state, action) {
      state.otpStage = action.payload;
    },
    resetOtp(state) {
      state.otpStage = "email";
      state.otpEmail = "";
      state.devOtp = null;
      state.error = null;
    },
    clearAuthError(state) {
      state.error = null;
    },
    // Server invalidated the session (single-session rule / expiry). Reset auth
    // locally without a network round-trip; the token is already cleared.
    sessionExpired(state) {
      Object.assign(state, { ...initialState, bootstrapped: true });
    },
  },
  extraReducers: (b) => {
    b.addCase(requestOtp.pending, (s) => {
      s.status = "loading";
      s.error = null;
    })
      .addCase(requestOtp.fulfilled, (s, a) => {
        s.status = "idle";
        s.otpStage = "code";
        s.otpEmail = a.meta.arg.email;
        s.devOtp = a.payload?.devOtp || null;
      })
      .addCase(requestOtp.rejected, (s, a) => {
        s.status = "error";
        s.error = a.payload?.message || "Could not send code";
      });

    b.addCase(verifyOtp.pending, (s) => {
      s.status = "loading";
      s.error = null;
    })
      .addCase(verifyOtp.fulfilled, (s, a) => {
        s.status = "authenticated";
        s.token = a.payload.token;
        s.role = a.payload.role;
        s.user = a.payload.user;
        s.devOtp = null;
        s.bootstrapped = true;
      })
      .addCase(verifyOtp.rejected, (s, a) => {
        s.status = "error";
        s.error = a.payload?.message || "Invalid code";
      });

    b.addCase(fetchMe.pending, (s) => {
      s.status = "loading";
    })
      .addCase(fetchMe.fulfilled, (s, a) => {
        s.status = "authenticated";
        s.user = a.payload;
        s.role = a.payload.role;
        s.bootstrapped = true;
      })
      .addCase(fetchMe.rejected, (s) => {
        s.status = "idle";
        s.user = null;
        s.role = null;
        s.token = null;
        s.bootstrapped = true;
        clearToken();
      });

    b.addCase(logout.fulfilled, (s) => {
      Object.assign(s, { ...initialState, bootstrapped: true });
    });
  },
});

export const {
  hydrateToken,
  userUpdated,
  setOtpStage,
  resetOtp,
  clearAuthError,
  sessionExpired,
} = authSlice.actions;
export default authSlice.reducer;
