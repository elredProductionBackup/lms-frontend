"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

// Google Identity Services (GIS). The button is rendered by Google; on success
// GIS hands us a `credential` (a Google ID token), which we POST to
// /auth/google as { idToken }. The backend verifies it against the same client
// ID (LMS_GOOGLE_CLIENT_ID), so both sides must use one OAuth Web client whose
// "Authorized JavaScript origins" include this front-end's origin.
//
// The LMS OAuth client (from the API contract). A client ID is public, not a
// secret. Override with NEXT_PUBLIC_GOOGLE_CLIENT_ID; set it to "off" to hide
// the button.
//
// "Access blocked · no registered origin · 401 invalid_client" in the popup
// means the page's origin isn't listed under Authorized JavaScript origins on
// this client in Google Cloud. Google stops there, so no credential comes
// back and POST /auth/google is never called. Only the owner of the Google
// Cloud project can fix that; there is nothing to change in this code.
const LMS_GOOGLE_CLIENT_ID = "927723428529-qbl5a61slf41uq5mi0nd7h80ubnmljod.apps.googleusercontent.com";
const envId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
export const GOOGLE_CLIENT_ID = envId.toLowerCase() === "off" ? "" : envId || LMS_GOOGLE_CLIENT_ID;

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisPromise = null;

function loadGis() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = GIS_SRC;
      el.async = true;
      el.defer = true;
      el.onload = () => resolve();
      el.onerror = () => {
        gisPromise = null; // allow a retry on the next mount
        reject(new Error("Couldn't load Google sign-in"));
      };
      document.head.appendChild(el);
    });
  }
  return gisPromise;
}

// While developing, show which origin has to be registered on the client.
function OriginHint() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (process.env.NODE_ENV === "production" || !origin) return null;
  return (
    <p className="mt-2 text-center text-[11px] leading-snug text-ink-muted">
      Dev: if Google says &ldquo;no registered origin&rdquo;, add{" "}
      <code className="rounded bg-ink/5 px-1 font-mono">{origin}</code> to Authorized JavaScript
      origins on the OAuth client.
    </p>
  );
}

export default function GoogleSignInButton({ onCredential, busy = false }) {
  const holderRef = useRef(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const [state, setState] = useState("loading"); // loading | ready | error

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        const holder = holderRef.current;
        if (cancelled || !holder) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp) => {
            if (resp?.credential) callbackRef.current?.(resp.credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        // GIS takes a fixed pixel width (200–400). Match the form column.
        const width = Math.max(200, Math.min(400, Math.round(holder.offsetWidth || 320)));
        holder.innerHTML = "";
        window.google.accounts.id.renderButton(holder, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          logo_alignment: "center",
          width,
        });
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  if (state === "error") {
    return (
      <p className="text-center text-sm text-ink-muted">
        Google sign-in couldn&apos;t load. Check your connection, or use an email code.
      </p>
    );
  }

  return (
    <div>
    <div className="relative h-11 w-full">
      {/* Placeholder while Google's script loads, same footprint as the button */}
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full border border-ink/15 bg-cream-50 text-sm text-ink-muted">
          <Loader2 size={16} className="mr-2 animate-spin" /> Loading Google sign-in
        </div>
      )}
      <div
        ref={holderRef}
        className={`flex w-full justify-center transition-opacity ${
          state !== "ready" ? "opacity-0" : busy ? "pointer-events-none opacity-40" : "opacity-100"
        }`}
      />
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center" aria-live="polite">
          <span className="flex items-center gap-2 rounded-full bg-cream-50/95 px-3 py-1.5 text-sm font-medium text-ink shadow-soft">
            <Loader2 size={15} className="animate-spin text-teal" /> Signing you in
          </span>
        </div>
      )}
    </div>
    <OriginHint />
    </div>
  );
}
