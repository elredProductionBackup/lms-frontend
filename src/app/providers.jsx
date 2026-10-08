"use client";

import { useEffect } from "react";
import { Provider } from "react-redux";
import { useRouter } from "next/navigation";
import { store } from "@/store";
import {
  hydrateToken,
  fetchMe,
  sessionExpired,
} from "@/store/slices/authSlice";
import { fetchPublicSettings } from "@/store/slices/settingsSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { getToken, registerSessionExpiredHandler } from "@/lib/api";
import ToastHost from "@/components/ui/ToastHost";

function Bootstrap({ children }) {
  const router = useRouter();

  useEffect(() => {
    store.dispatch(hydrateToken());
    store.dispatch(fetchPublicSettings());
    if (getToken()) store.dispatch(fetchMe());
    else {
      // mark bootstrapped so guards can resolve for logged-out users
      store.dispatch({ type: "auth/fetchMe/rejected", payload: null });
    }
  }, []);

  // One place to react to a replaced/expired session (single-session rule):
  // sign out locally and bounce to /login with a clear message. Debounced so a
  // burst of failing requests only triggers one redirect + toast.
  useEffect(() => {
    let handled = false;
    registerSessionExpiredHandler((err) => {
      if (handled) return;
      handled = true;

      const replaced = err?.code === "SESSION_REPLACED";
      store.dispatch(sessionExpired());
      store.dispatch(
        pushToast(
          replaced
            ? "You were signed in on another device."
            : "Your session expired. Please sign in again.",
          "error"
        )
      );
      router.replace("/login");

      // Allow future expiries to be handled again after this one settles.
      setTimeout(() => {
        handled = false;
      }, 1500);
    });

    return () => registerSessionExpiredHandler(null);
  }, [router]);

  return children;
}

export default function Providers({ children }) {
  return (
    <Provider store={store}>
      <Bootstrap>{children}</Bootstrap>
      <ToastHost />
    </Provider>
  );
}
