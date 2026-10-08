"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, User, LogOut, Shield, ChevronDown } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { logout } from "@/store/slices/authSlice";
import { mediaUrl } from "@/lib/api";
import { Avatar } from "@/components/ui/Primitives";

export default function TopNav() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { user, role } = useAppSelector((s) => s.auth);
  const settings = useAppSelector((s) => s.settings);

  const onLogout = async () => {
    await dispatch(logout());
    router.replace("/login");
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

          <div className="relative ml-1">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-ink/5"
            >
              <Avatar name={avatarLabel} src={user?.avatarUrl} size={32} />
              <ChevronDown size={14} className="text-ink-muted" />
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
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
                    onClick={onLogout}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink-soft transition-colors hover:bg-ink/5"
                  >
                    <LogOut size={16} strokeWidth={1.75} /> Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}