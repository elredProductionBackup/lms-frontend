"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/hooks/redux";
import { Spinner } from "@/components/ui/Primitives";

/**
 * Wraps protected pages. Waits for auth bootstrap, then:
 *  - if not authenticated -> /login
 *  - if `roles` given and user's role not included -> /home (learners) fallback
 */
export default function RouteGuard({ children, roles }) {
  const router = useRouter();
  const { user, role, bootstrapped } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (roles && !roles.includes(role)) {
      router.replace("/home");
    }
  }, [bootstrapped, user, role, roles, router]);

  if (!bootstrapped || !user || (roles && !roles.includes(role))) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }
  return children;
}
