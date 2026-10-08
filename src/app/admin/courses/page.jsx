"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, BookOpen, ChevronRight, Film } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { fetchCourses, createCourse } from "@/store/slices/coursesSlice";
import { fetchMembers } from "@/store/slices/membersSlice";
import { pushToast } from "@/store/slices/uiSlice";
import PageHeader from "@/components/admin/PageHeader";
import { Card, Modal, EmptyState } from "@/components/ui/Shell";
import { Button, Badge, Spinner } from "@/components/ui/Primitives";
import { Input, Textarea, Select, Fieldset } from "@/components/ui/Field";
import { plainText, formatDate } from "@/lib/format";

export default function AdminCoursesPage() {
  const dispatch = useAppDispatch();
  const { manage, status } = useAppSelector((s) => s.courses);
  const { role } = useAppSelector((s) => s.auth);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    dispatch(fetchCourses("manage"));
  }, [dispatch]);

  return (
    <div>
      <PageHeader
        title="Courses"
        description={role === "admin" ? "Every course on the platform." : "Courses you author."}
        action={
          <Button variant="teal" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New course
          </Button>
        }
      />

      {status === "loading" && manage.length === 0 ? (
        <div className="flex justify-center py-16"><Spinner size={26} /></div>
      ) : manage.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Create your first course, then add recordings and publish it."
          action={<Button variant="teal" onClick={() => setShowCreate(true)}><Plus size={16} /> New course</Button>}
        />
      ) : (
        <div className="space-y-3">
          {manage.map((c) => (
            <Link key={c._id} href={`/admin/courses/${c._id}`}>
              <Card className="flex items-center gap-4 p-5 transition-colors hover:bg-cream-100">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cream-200 text-ink-muted">
                  <Film size={20} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <p className="truncate font-medium text-ink">{c.title}</p>
                    <Badge tone={c.status}>{c.status}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {(c.videos || []).length} recordings
                    {c.detailsHtml ? ` · ${plainText(c.detailsHtml, 60)}` : ""}
                  </p>
                </div>
                {c.publishedAt && (
                  <span className="hidden text-xs text-ink-muted sm:block">
                    Published {formatDate(c.publishedAt, { month: "short", day: "numeric" })}
                  </span>
                )}
                <ChevronRight size={18} className="text-ink-muted" />
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateCourseModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

function CreateCourseModal({ open, onClose }) {
  const dispatch = useAppDispatch();
  const { role } = useAppSelector((s) => s.auth);
  const { mutating } = useAppSelector((s) => s.courses);
  const authors = useAppSelector((s) => s.members.items);
  const [form, setForm] = useState({ title: "", detailsHtml: "", authorId: "" });

  useEffect(() => {
    if (open && role === "admin") dispatch(fetchMembers("author"));
  }, [open, role, dispatch]);

  const submit = async (e) => {
    e.preventDefault();
    const body = { title: form.title, detailsHtml: form.detailsHtml };
    if (role === "admin") body.authorId = form.authorId;
    const res = await dispatch(createCourse(body));
    if (createCourse.fulfilled.match(res)) {
      dispatch(pushToast("Course created", "success"));
      dispatch(fetchCourses("manage"));
      setForm({ title: "", detailsHtml: "", authorId: "" });
      onClose();
    } else {
      dispatch(pushToast(res.payload?.message || "Could not create", "error"));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New course">
      <form onSubmit={submit} className="space-y-4">
        <Fieldset label="Title">
          <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Advanced Redux Toolkit" />
        </Fieldset>
        {role === "admin" && (
          <Fieldset label="Author" hint="create on behalf of">
            <Select required value={form.authorId} onChange={(e) => setForm((f) => ({ ...f, authorId: e.target.value }))}>
              <option value="">Select an author…</option>
              {authors.map((a) => (
                <option key={a.userId} value={a.userId}>{a.name || a.email}</option>
              ))}
            </Select>
          </Fieldset>
        )}
        <Fieldset label="Details" hint="HTML allowed">
          <Textarea rows={4} value={form.detailsHtml} onChange={(e) => setForm((f) => ({ ...f, detailsHtml: e.target.value }))} placeholder="<p>What this session covers…</p>" />
        </Fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="teal" loading={mutating}>Create draft</Button>
        </div>
      </form>
    </Modal>
  );
}
