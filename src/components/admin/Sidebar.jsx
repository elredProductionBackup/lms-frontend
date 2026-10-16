"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  UserPlus,
  BookOpen,
  ScrollText,
  Settings,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { logout } from "@/store/slices/authSlice";
import { Avatar } from "@/components/ui/Primitives";
import BrandMark from "@/components/ui/BrandMark";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, adminOnly: true },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/admin/authors", label: "Authors", icon: UserCheck, adminOnly: true },
  { href: "/admin/join-requests", label: "Join requests", icon: UserPlus, adminOnly: true },
  { href: "/admin/audit-log", label: "Audit log", icon: ScrollText, adminOnly: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user, role } = useAppSelector((s) => s.auth);

  const links = LINKS.filter((l) => !l.adminOnly || role === "admin");

  const onLogout = async () => {
    await dispatch(logout());
    router.replace("/login");
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-ink/8 bg-cream-100">
      <div className="flex h-16 shrink-0 items-center px-6">
        <BrandMark size="sm" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {links.map((l) => {
          const active =
            l.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-ink text-cream-50"
                  : "text-ink-soft hover:bg-ink/5"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-ink/8 p-3">
        <Link
          href="/home"
          className="mb-1 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/5"
        >
          <ArrowUpRight size={18} strokeWidth={1.75} /> Learner view
        </Link>
        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2">
          <Avatar name={user?.name} src={user?.avatarUrl} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
            <p className="truncate text-xs capitalize text-ink-muted">{role}</p>
          </div>
          <button onClick={onLogout} className="text-ink-muted hover:text-ink" aria-label="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
