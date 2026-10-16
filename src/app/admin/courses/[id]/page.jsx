"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { fetchCourse, clearCurrentCourse } from "@/store/slices/coursesSlice";
import { clearSubscriptions } from "@/store/slices/subscriptionsSlice";
import { Tabs } from "@/components/ui/Shell";
import { Spinner, Badge } from "@/components/ui/Primitives";
import DetailsTab from "@/components/admin/DetailsTab";
import RecordingsTab from "@/components/admin/RecordingsTab";
import SubscriptionsTab from "@/components/admin/SubscriptionsTab";
import RosterTab from "@/components/admin/RosterTab";

export default function ManageCoursePage() {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const { current, detailStatus, error } = useAppSelector((s) => s.courses);
  const { role } = useAppSelector((s) => s.auth);
  const [tab, setTab] = useState("details");

  useEffect(() => {
    dispatch(fetchCourse(id));
    return () => {
      dispatch(clearCurrentCourse());
      dispatch(clearSubscriptions());
    };
  }, [id, dispatch]);

  const tabs = [
    { value: "details", label: "Details" },
    { value: "recordings", label: `Modules${current ? ` (${(current.videos || []).length})` : ""}` },
    ...(role === "admin" ? [{ value: "subscriptions", label: "Subscriptions" }] : []),
    { value: "roster", label: "Roster" },
  ];

  // Spinner only until THIS course is first loaded. A refetch (e.g. after an
  // upload) keeps the page on screen instead of blanking it and remounting
  // every tab, which threw away anything mid-edit.
  const hasThisCourse = current && current._id === id;
  if (!hasThisCourse && detailStatus === "error") {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-red-600">{error || "This course couldn't be loaded."}</p>
        <button
          type="button"
          onClick={() => dispatch(fetchCourse(id))}
          className="mt-3 text-sm font-medium text-teal hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!hasThisCourse) {
    return <div className="flex justify-center py-24"><Spinner size={28} /></div>;
  }

  return (
    <div>
      <Link
        href="/admin/courses"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:underline"
      >
        <ArrowLeft size={16} /> All courses
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <h1 className="font-serif text-3xl text-ink">{current.title}</h1>
        <Badge tone={current.status}>{current.status}</Badge>
        {detailStatus === "loading" && <Spinner size={16} />}
      </div>

      <div className="mb-6">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {tab === "details" && (
        <DetailsTab course={current} onGoToModules={() => setTab("recordings")} />
      )}
      {tab === "recordings" && <RecordingsTab course={current} />}
      {tab === "subscriptions" && role === "admin" && <SubscriptionsTab course={current} />}
      {tab === "roster" && <RosterTab course={current} />}
    </div>
  );
}