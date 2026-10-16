"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, ArrowLeft, ArrowRight, ShieldAlert } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  requestOtp,
  verifyOtp,
  resetOtp,
  googleSignIn,
  clearAuthError,
} from "@/store/slices/authSlice";
import { Button } from "@/components/ui/Primitives";
import { Input, Label } from "@/components/ui/Field";
import BrandMark from "@/components/ui/BrandMark";
import GoogleSignInButton, { GOOGLE_CLIENT_ID } from "@/components/auth/GoogleSignInButton";
import { SITE } from "@/lib/site";

// Sign-in is invite-only. A 403 LOGIN_NOT_ALLOWED gets its own callout so it
// doesn't read like a typo in the email; everything else is a plain line.
function AuthError({ error, code }) {
  if (!error) return null;
  if (code === "LOGIN_NOT_ALLOWED") {
    return (
      <div
        role="alert"
        className="mt-4 flex gap-3 rounded-xl border border-teal/25 bg-teal/5 px-3.5 py-3 text-sm text-ink"
      >
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-teal" />
        <div>
          <p className="font-medium">No access for this email yet</p>
          <p className="mt-0.5 text-ink-soft">{error}</p>
        </div>
      </div>
    );
  }
  return (
    <p role="alert" className="mt-3 text-sm text-red-600">
      {error}
    </p>
  );
}

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { otpStage, otpEmail, devOtp, status, error, errorCode, method, user } =
    useAppSelector((s) => s.auth);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (user) router.replace("/home");
  }, [user, router]);

  useEffect(() => {
    if (devOtp) setCode(devOtp);
  }, [devOtp]);

  const sendCode = (e) => {
    e.preventDefault();
    dispatch(requestOtp({ email: email.trim() }));
  };
  const verify = (e) => {
    e.preventDefault();
    dispatch(verifyOtp({ email: otpEmail, code: code.trim() }));
  };
  const onGoogle = (idToken) => {
    dispatch(googleSignIn({ idToken }));
  };

  const loading = status === "loading";
  const emailBusy = loading && method === "email";
  const googleBusy = loading && method === "google";

  return (
    <div className="flex min-h-screen">
      {/* Brand hero panel — deep charcoal lit by crimson glows */}
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{
          background:
            " radial-gradient(120% 120% at 88% 92%, rgba(153,18,27,0.40) 0%, rgba(0,0,0,0) 55%), linear-gradient(150deg, #1c1215 0%, #141317 55%, #0d0d10 100%)",
        }}
      >
        {/* subtle dot texture for depth */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            opacity: 0.6,
          }}
        />
        <div className="relative z-10">
          <BrandMark tone="dark" size="lg" />
        </div>
        <div className="relative z-10 max-w-md">
          <p className="font-serif text-4xl leading-tight text-white">
            Curated learning, built for you.
          </p>
          <p className="mt-4 text-lg text-white/70">
            Join expert sessions across topics and track your progress in one place.
          </p>
        </div>
        <p className="relative z-10 text-sm text-white/50">
          © {new Date().getFullYear()} {SITE.name}
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <BrandMark size="md" className="mb-8 lg:hidden" />

          {otpStage === "email" ? (
            <form onSubmit={sendCode} className="animate-fade-in">
              <h1 className="font-serif text-3xl text-ink">Sign in</h1>
              <p className="mt-2 text-sm text-ink-muted">
                {GOOGLE_CLIENT_ID
                  ? "Use the email your admin added, or continue with Google."
                  : "We'll email you a one-time code. No password needed."}
              </p>
              <div className="mt-8">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                  <Input
                    id="email"
                    type="email"
                    autoFocus
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) dispatch(clearAuthError());
                    }}
                    placeholder="you@company.com"
                    className="pl-10"
                  />
                </div>
              </div>
              <AuthError error={error} code={errorCode} />
              <Button
                type="submit"
                variant="teal"
                size="lg"
                className="mt-6 w-full"
                loading={emailBusy}
                disabled={googleBusy}
              >
                Send code <ArrowRight size={16} />
              </Button>

              {GOOGLE_CLIENT_ID && (
                <>
                  <div className="my-6 flex items-center gap-3 text-xs text-ink-muted">
                    <span className="h-px flex-1 bg-ink/10" />
                    or
                    <span className="h-px flex-1 bg-ink/10" />
                  </div>
                  <GoogleSignInButton onCredential={onGoogle} busy={googleBusy} />
                </>
              )}

              <p className="mt-6 text-center text-xs leading-relaxed text-ink-muted">
                Access is by invitation. If you can&apos;t sign in, ask your admin to add you.
              </p>
              {/* <p className="mt-6 text-center text-sm text-ink-muted">
                New here?{" "}
                <Link href="/join" className="font-medium text-teal hover:underline">
                  Request access
                </Link>
              </p> */}
            </form>
          ) : (
            <form onSubmit={verify} className="animate-fade-in">
              <button
                type="button"
                onClick={() => dispatch(resetOtp())}
                className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
              >
                <ArrowLeft size={15} /> Back
              </button>
              <h1 className="font-serif text-3xl text-ink">Enter your code</h1>
              <p className="mt-2 text-sm text-ink-muted">
                We sent a code to <span className="font-medium text-ink">{otpEmail}</span>
              </p>
              {devOtp && (
                <p className="mt-3 rounded-lg bg-general/12 px-3 py-2 text-sm text-general-dark">
                  Dev code: <span className="font-mono font-semibold">{devOtp}</span>
                </p>
              )}
              <div className="mt-8">
                <Label htmlFor="code">6-digit code</Label>
                <div className="relative">
                  <KeyRound
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                 <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="pl-10 font-mono tracking-widest"
                />
                </div>
              </div>
              <AuthError error={error} code={errorCode} />
              <Button
                type="submit"
                variant="teal"
                size="lg"
                className="mt-6 w-full"
                loading={emailBusy}
              >
                Verify & continue
              </Button>
              <button
                type="button"
                onClick={() => dispatch(requestOtp({ email: otpEmail }))}
                disabled={loading}
                className="mt-4 w-full text-center text-sm text-ink-muted hover:text-ink disabled:opacity-50"
              >
                Resend code
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
