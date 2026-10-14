"use client";

import { useEffect, useMemo } from "react";
import { LibraryBig } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { fetchCourses } from "@/store/slices/coursesSlice";
import RouteGuard from "@/components/auth/RouteGuard";
import TopNav from "@/components/learner/TopNav";
import FeaturedCard from "@/components/learner/FeaturedCard";
import SessionCard from "@/components/learner/SessionCard";
import { EmptyState } from "@/components/ui/Shell";
import { Spinner } from "@/components/ui/Primitives";

function HomeInner() {
  const dispatch = useAppDispatch();
  const { catalog, status } = useAppSelector((s) => s.courses);
  const { user } = useAppSelector((s) => s.auth);

  useEffect(() => {
    dispatch(fetchCourses("catalog"));
  }, [dispatch]);

  const featured = useMemo(
    () => catalog.find((c) => c.unlocked) || catalog[0],
    [catalog]
  );

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-10">
        <header className="mb-6 sm:mb-8">
          <h1 className="font-serif text-3xl text-ink sm:text-5xl">
            Welcome back, {user?.name?.split(" ")[0] || "there"}
          </h1>
          <p className="mt-2 text-sm text-ink-muted sm:text-base">
            Modules unlock inside their access window. Pick up where you left off.
          </p>
        </header>

        {status === "loading" && catalog.length === 0 ? (
          <div className="flex justify-center py-24">
            <Spinner size={28} />
          </div>
        ) : catalog.length === 0 ? (
          <EmptyState
            icon={LibraryBig}
            title="No sessions yet"
            description="Published sessions will appear here once they're available."
          />
        ) : (
          <>
            {featured && (
              <div className="mb-8 sm:mb-10">
                <FeaturedCard course={featured} />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {catalog.map((course) => (
                <SessionCard key={course._id} course={course} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <RouteGuard>
      <HomeInner />
    </RouteGuard>
  );
}