"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ArrowRight,
  Plus,
  Users,
  Pencil,
  UploadCloud,
  ImageIcon,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { fetchCourses, createCourse } from "@/store/slices/coursesSlice";
import { fetchMembers } from "@/store/slices/membersSlice";
import { uploadLogo } from "@/store/slices/settingsSlice";
import { pushToast } from "@/store/slices/uiSlice";
import PageHeader from "@/components/admin/PageHeader";
import { Card, EmptyState } from "@/components/ui/Shell";
import { Button, Badge, Spinner } from "@/components/ui/Primitives";
import { Input, Textarea, Select, Fieldset } from "@/components/ui/Field";
import { mediaUrl } from "@/lib/api";

const STATUS_LABEL = { draft: "Draft", published: "Published", archived: "Archived" };

function videoSummary(videos) {
  if (!videos || videos.length === 0) return "No video";
  const ready = videos.filter((v) => v.status === "ready").length;
  return `${ready}/${videos.length} ready`;
}

export default function AdminDashboardPage() {
  const dispatch = useAppDispatch();
  const { role } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (role !== "admin") return;
    dispatch(fetchCourses("manage"));
    dispatch(fetchMembers("author"));
  }, [dispatch, role]);

  // Authors don't get the platform dashboard — just a shortcut into their courses.
  if (role !== "admin") {
    return (
      <div>
        <PageHeader title="Author workspace" description="Manage your courses and recordings." />
        <Link href="/admin/courses">
          <Card className="flex items-center justify-between p-6 transition-colors hover:bg-cream-100">
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-frontend/12 text-frontend">
                <BookOpen size={22} strokeWidth={1.75} />
              </span>
              <div>
                <p className="font-medium text-ink">Your courses</p>
                <p className="text-sm text-ink-muted">Create, edit, publish, and add recordings</p>
              </div>
            </div>
            <ArrowRight size={18} className="text-ink-muted" />
          </Card>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Admin dashboard" description="Every course, regardless of status." />
      <div className="space-y-6">
        <PlatformBrandingCard />
        <CreateCourseCard />
        <CoursesTableCard />
      </div>
    </div>
  );
}

function PlatformBrandingCard() {
  const dispatch = useAppDispatch();
  const fileRef = useRef(null);
  const { name, logoUrl, saving } = useAppSelector((s) => s.settings);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const res = await dispatch(uploadLogo(file));
    if (uploadLogo.fulfilled.match(res)) {
      dispatch(pushToast("Logo updated", "success"));
      if (fileRef.current) fileRef.current.value = "";
    } else {
      dispatch(pushToast(res.payload?.message || "Upload failed", "error"));
    }
  };

  return (
    <Card className="p-6">
      <h2 className="mb-4 font-serif text-lg text-ink">Platform branding</h2>
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-ink/12 bg-cream-100">
          {logoUrl ? (
            <img src={mediaUrl(logoUrl)} alt={name} className="max-h-full max-w-full object-contain p-2" />
          ) : (
            <ImageIcon size={22} className="text-ink-muted" strokeWidth={1.5} />
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="block text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-cream-200 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-cream-300"
        />
        <Button variant="outline" onClick={upload} loading={saving}>
          <UploadCloud size={16} /> Upload logo
        </Button>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Shown next to the logo in the topbar and on the public catalog page.
      </p>
    </Card>
  );
}

function CreateCourseCard() {
  const dispatch = useAppDispatch();
  const { mutating } = useAppSelector((s) => s.courses);
  const authors = useAppSelector((s) => s.members.items);
  const [form, setForm] = useState({ title: "", detailsHtml: "", authorId: "" });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.authorId) {
      dispatch(pushToast("Choose an author to create this course on behalf of.", "error"));
      return;
    }
    const body = { title: form.title.trim(), authorId: form.authorId };
    if (form.detailsHtml.trim()) body.detailsHtml = form.detailsHtml;
    const res = await dispatch(createCourse(body));
    if (createCourse.fulfilled.match(res)) {
      dispatch(pushToast("Course created", "success"));
      dispatch(fetchCourses("manage"));
      setForm({ title: "", detailsHtml: "", authorId: "" });
    } else {
      dispatch(pushToast(res.payload?.message || "Could not create", "error"));
    }
  };

  return (
    <Card className="p-6">
      <h2 className="mb-4 font-serif text-lg text-ink">Create course on behalf of an author</h2>
      {authors.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No authors yet — add one on the{" "}
          <Link href="/admin/authors" className="text-teal hover:underline">Authors</Link> page first.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Fieldset label="Author">
              <Select required value={form.authorId} onChange={set("authorId")}>
                <option value="">Select an author…</option>
                {authors.map((a) => (
                  <option key={a.userId} value={a.userId}>
                    {a.name ? `${a.name} (${a.email})` : a.email}
                  </option>
                ))}
              </Select>
            </Fieldset>
            <div className="sm:col-span-2">
              <Fieldset label="Title">
                <Input required value={form.title} onChange={set("title")} placeholder="Course title" />
              </Fieldset>
            </div>
          </div>
          <Fieldset label="Details" hint="optional, HTML allowed">
            <Textarea
              rows={3}
              value={form.detailsHtml}
              onChange={set("detailsHtml")}
              placeholder="What learners will get out of this course…"
            />
          </Fieldset>
          <div>
            <Button type="submit" variant="teal" loading={mutating}>
              <Plus size={16} /> Create course
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function CoursesTableCard() {
  const { manage, status } = useAppSelector((s) => s.courses);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink/8 px-6 py-4">
        <h2 className="font-serif text-lg text-ink">Courses</h2>
      </div>
      {status === "loading" && manage.length === 0 ? (
        <div className="flex justify-center py-14"><Spinner size={26} /></div>
      ) : manage.length === 0 ? (
        <div className="px-6 py-10 text-sm text-ink-muted">No courses yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/8 text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-6 py-3 font-medium">Title</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Video</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/8">
            {manage.map((c) => (
              <tr key={c._id} className="hover:bg-cream-100/60">
                <td className="px-6 py-3 font-medium text-ink">{c.title}</td>
                <td className="px-6 py-3">
                  <Badge tone={c.status}>{STATUS_LABEL[c.status] || c.status}</Badge>
                </td>
                <td className="px-6 py-3 text-ink-muted">{videoSummary(c.videos)}</td>
                <td className="px-6 py-3">
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/courses/${c._id}`}>
                      <Button variant="ghost" size="sm"><Pencil size={14} /> Edit content</Button>
                    </Link>
                    <Link href={`/admin/courses/${c._id}/subscriptions`}>
                      <Button variant="ghost" size="sm"><Users size={14} /> Manage subscriptions</Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
