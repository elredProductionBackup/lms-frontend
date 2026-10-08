"use client";

import RouteGuard from "@/components/auth/RouteGuard";
import Sidebar from "@/components/admin/Sidebar";

export default function AdminLayout({ children }) {
  return (
    <RouteGuard roles={["admin", "author"]}>
      <div className="flex min-h-screen">
        <div className="sticky top-0 hidden h-screen shrink-0 self-start lg:block">
          <Sidebar />
        </div>
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">{children}</div>
        </main>
      </div>
    </RouteGuard>
  );
}
