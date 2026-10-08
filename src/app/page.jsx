"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/hooks/redux";
import { Spinner } from "@/components/ui/Primitives";

export default function RootPage() {
  const router = useRouter();
  const { user, bootstrapped } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (!bootstrapped) return;
    router.replace(user ? "/home" : "/login");
  }, [bootstrapped, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size={28} />
    </div>
  );
}
