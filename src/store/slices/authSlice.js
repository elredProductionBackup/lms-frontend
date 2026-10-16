import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api, setToken, clearToken, getToken } from "@/lib/api";

// Sign-in is invite-only: request-otp, verify-otp and google all answer
// 403 LOGIN_NOT_ALLOWED for an email that isn't an admin/author and holds no
// active seat. No account is ever auto-created by signing in.
//
// Server messages are shown as-is, except for codes where a clearer line helps.
const FRIENDLY = {
  LOGIN_NOT_ALLOWED: "This email doesn't have access yet. Ask your admin to add you.",
  GOOGLE_TOKEN_INVALID:
    "Google couldn't confirm this account. Try again, or sign in with an email code.",
};
const authFail = (e) => ({
  code: e.code,
  message: FRIENDLY[e.code] && !e.message ? FRIENDLY[e.code] : e.message,
});
// GOOGLE_TOKEN_INVALID's server text is technical (signature/audience), so
// always use ours for it.
// ROUTE_NOT_FOUND / 404 means the backend hasn't deployed POST /auth/google yet.
const googleFail = (e) => ({
  code: e.code,
  message:
    e.code === "GOOGLE_TOKEN_INVALID"
      ? FRIENDLY.GOOGLE_TOKEN_INVALID
      : e.code === "ROUTE_NOT_FOUND" || e.status === 404
        ? "Google sign-in isn't switched on on the server yet. Use an email code for now."
        : authFail(e).message,
});

// --- Thunks (endpoints 1-4) -------------------------------------------------

export const requestOtp = createAsyncThunk(
  "auth/requestOtp",
  async ({ email }, { rejectWithValue }) => {
    try {
      // POST /api/auth/request-otp
      return await api.post("/auth/request-otp", { email }, { auth: false });
    } catch (e) {
      return rejectWithValue(authFail(e));
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
      return rejectWithValue(authFail(e));
    }
  }
);

// POST /api/auth/google  { idToken } -> { token, role, user }  (same as verify-otp)
// idToken is the `credential` from the Google Identity Services callback.
// Never creates an account; signs out any other open session.
export const googleSignIn = createAsyncThunk(
  "auth/google",
  async ({ idToken }, { rejectWithValue }) => {
    try {
      const data = await api.post("/auth/google", { idToken }, { auth: false });
      setToken(data.token);
      return data;
    } catch (e) {
      return rejectWithValue(googleFail(e));
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
  errorCode: null, // e.g. LOGIN_NOT_ALLOWED, so the UI can tailor the message
  method: null, // "email" | "google": which sign-in is in flight
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
      state.errorCode = null;
    },
    clearAuthError(state) {
      state.error = null;
      state.errorCode = null;
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
      s.method = "email";
      s.error = null;
      s.errorCode = null;
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
        s.errorCode = a.payload?.code || null;
      });

    b.addCase(verifyOtp.pending, (s) => {
      s.status = "loading";
      s.method = "email";
      s.error = null;
      s.errorCode = null;
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
        s.errorCode = a.payload?.code || null;
      });

    b.addCase(googleSignIn.pending, (s) => {
      s.status = "loading";
      s.method = "google";
      s.error = null;
      s.errorCode = null;
    })
      .addCase(googleSignIn.fulfilled, (s, a) => {
        s.status = "authenticated";
        s.token = a.payload.token;
        s.role = a.payload.role;
        s.user = a.payload.user;
        s.devOtp = null;
        s.bootstrapped = true;
      })
      .addCase(googleSignIn.rejected, (s, a) => {
        s.status = "error";
        s.error = a.payload?.message || "Google sign-in didn't work. Try again.";
        s.errorCode = a.payload?.code || null;
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
