"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, User, LogOut, Shield, ChevronDown } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { logout } from "@/store/slices/authSlice";
import { mediaUrl } from "@/lib/api";
import { Avatar } from "@/components/ui/Primitives";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useDismiss } from "@/hooks/usePopover";

export default function TopNav() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const { user, role } = useAppSelector((s) => s.auth);
  const settings = useAppSelector((s) => s.settings);
  const { confirm, dialog } = useConfirm();

  // Close the account menu on any click outside it. (The old full-screen
  // overlay didn't work: the header's backdrop-blur turns `position: fixed`
  // children into header-sized boxes, so clicks on the page never reached it.)
  useDismiss(menuRef, open, () => setOpen(false));

  // Esc closes it too, and hands focus back to the avatar button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Never leave it open after navigating.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const onLogout = async () => {
    setOpen(false);
    const ok = await confirm({
      title: "Log out?",
      message: "To sign back in, you'll need a new code from your email.",
      confirmLabel: "Log out",
      tone: "default",
      // Not unwrapped: even if the server call fails, we still sign out locally.
      action: () => dispatch(logout()),
    });
    if (ok) router.replace("/login");
  };

  // Prefer the real name for the avatar initials; when there's no name, fall
  // back to the email so the avatar shows its first letter instead of a blank.
  const avatarLabel = user?.name || user?.email || "";

  return (
    <header className="sticky top-0 z-40 border-b border-ink/8 bg-cream-100/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-5">
        <Link href="/home" className="flex items-center gap-2.5">
          <img
            src={settings.logoUrl ? mediaUrl(settings.logoUrl) : "/tpn.svg"}
            alt={settings.name || "The Professional Network"}
            className="h-8 w-auto"
          />
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/home"
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/5 sm:px-3.5"
          >
            <LayoutGrid size={16} strokeWidth={1.75} />
            <span className="hidden sm:inline">Sessions</span>
          </Link>
          {(role === "admin" || role === "author") && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/5 sm:px-3.5"
            >
              <Shield size={16} strokeWidth={1.75} />
              <span className="hidden sm:inline">
                {role === "admin" ? "Admin" : "Author"}
              </span>
            </Link>
          )}

          <div ref={menuRef} className="relative ml-1">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={open}
              aria-label="Account menu"
              className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-ink/5"
            >
              <Avatar name={avatarLabel} src={user?.avatarUrl} size={32} />
              <ChevronDown
                size={14}
                className={`text-ink-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open && (
              <div className="absolute right-0 z-20 mt-2 w-56 max-w-[calc(100vw-2rem)] animate-fade-in overflow-hidden rounded-xl border border-ink/10 bg-cream-50 shadow-card">
                <div className="border-b border-ink/8 px-4 py-3">
                  <p className="truncate text-sm font-medium text-ink">
                    {user?.name || user?.email || "Your account"}
                  </p>
                  {user?.name && user?.email && (
                    <p className="truncate text-xs text-ink-muted">{user.email}</p>
                  )}
                </div>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-soft transition-colors hover:bg-ink/5"
                >
                  <User size={16} strokeWidth={1.75} /> Your profile
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink-soft transition-colors hover:bg-ink/5"
                >
                  <LogOut size={16} strokeWidth={1.75} /> Log out
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
      {/* Rendered through a portal into <body>, so the header's backdrop-blur can't trap it. */}
      {dialog}
    </header>
  );
}