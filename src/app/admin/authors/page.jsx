"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, Trash2, Pencil, Camera, UserCheck } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchMembers,
  addMember,
  removeMember,
  updateMemberProfile,
  uploadMemberAvatar,
} from "@/store/slices/membersSlice";
import { pushToast } from "@/store/slices/uiSlice";
import PageHeader from "@/components/admin/PageHeader";
import { Card, Modal, EmptyState } from "@/components/ui/Shell";
import { Button, Avatar, Spinner } from "@/components/ui/Primitives";
import { Input, Textarea, Fieldset } from "@/components/ui/Field";
import { isSameUser } from "@/lib/identity";

export default function AdminAuthorsPage() {
  const dispatch = useAppDispatch();
  const { items, status } = useAppSelector((s) => s.members);
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = () => dispatch(fetchMembers("author"));

  useEffect(() => {
    load();
  }, [dispatch]);

  // Keep the open edit modal in sync with the freshest member data.
  const editingAuthor = editing ? items.find((a) => a.userId === editing) || null : null;

  const remove = async (userId, label) => {
    if (
      !confirm(
        `Remove ${label} as an author? Any courses they authored will be orphaned, not reassigned.`
      )
    )
      return;
    setBusyId(userId);
    const res = await dispatch(removeMember(userId));
    setBusyId(null);
    if (removeMember.fulfilled.match(res)) dispatch(pushToast("Author removed", "success"));
    else dispatch(pushToast(res.payload?.message || "Could not remove", "error"));
  };

  return (
    <div>
      <PageHeader title="Authors" description="Everyone with author access." />

      <AddAuthorCard onAdded={load} />

      <div className="mt-6">
        <h2 className="mb-1 font-serif text-xl text-ink">Authors</h2>
        <p className="mb-3 text-[13px] text-ink-muted">
          Removing an author does not reassign their courses — those courses become orphaned
          (author-less) but stay fully manageable from the dashboard.
        </p>

        {status === "loading" && items.length === 0 ? (
          <div className="flex justify-center py-16"><Spinner size={26} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={UserCheck} title="No authors yet" description="Add an author to get started." />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/8 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-5 py-3 font-medium">Author</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {items.map((a) => (
                  <tr key={a.userId} className="hover:bg-cream-100/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={a.name || a.email} src={a.avatarUrl} size={34} />
                        <span className="font-medium text-ink">{a.name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{a.email}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(a.userId)}>
                          <Pencil size={14} /> Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busyId === a.userId}
                          onClick={() => remove(a.userId, a.email)}
                        >
                          <Trash2 size={14} /> Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <EditAuthorModal author={editingAuthor} onClose={() => setEditing(null)} />
    </div>
  );
}

function AddAuthorCard({ onAdded }) {
  const dispatch = useAppDispatch();
  const fileRef = useRef(null);
  const { mutating } = useAppSelector((s) => s.members);
  const [form, setForm] = useState({ email: "", name: "", aboutHtml: "" });
  const [file, setFile] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const res = await dispatch(
      addMember({
        email: form.email.trim().toLowerCase(),
        role: "author",
        name: form.name.trim(),
        aboutHtml: form.aboutHtml,
        file,
      })
    );
    if (addMember.fulfilled.match(res)) {
      dispatch(pushToast("Author added", "success"));
      setForm({ email: "", name: "", aboutHtml: "" });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onAdded();
    } else {
      dispatch(pushToast(res.payload?.message || "Could not add author", "error"));
    }
  };

  return (
    <Card className="p-6">
      <h2 className="mb-4 font-serif text-lg text-ink">Add an author</h2>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Fieldset label="Email">
            <Input type="email" required value={form.email} onChange={set("email")} placeholder="author@example.com" />
          </Fieldset>
          <Fieldset label="Display name" hint="new people only">
            <Input maxLength={100} value={form.name} onChange={set("name")} placeholder="e.g. Asha Verma" />
          </Fieldset>
        </div>
        <Fieldset label="Photo" hint="optional">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-cream-200 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-cream-300"
          />
        </Fieldset>
        <Fieldset label="About us" hint="optional, HTML allowed">
          <Textarea rows={3} value={form.aboutHtml} onChange={set("aboutHtml")} placeholder="A short bio for this author…" />
        </Fieldset>
        <div>
          <Button type="submit" variant="teal" loading={mutating}>
            <UserPlus size={16} /> Add author
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EditAuthorModal({ author, onClose }) {
  const dispatch = useAppDispatch();
  const fileRef = useRef(null);
  const { mutating } = useAppSelector((s) => s.members);
  const me = useAppSelector((s) => s.auth.user);
  // Only the person can change their display name (PUT /users/:userId/profile
  // refuses a different name from an admin). Sending it unchanged is fine.
  const isSelf = Boolean(author) && isSameUser(me, { _id: author.userId, email: author.email });
  const [name, setName] = useState("");
  const [aboutHtml, setAboutHtml] = useState("");
  const [uploading, setUploading] = useState(false);

  // Reset local drafts whenever a different author opens.
  useEffect(() => {
    if (author) {
      setName(author.name || "");
      setAboutHtml(author.aboutHtml || "");
    }
  }, [author?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!author) return null;

  const handleAvatar = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    const res = await dispatch(uploadMemberAvatar({ userId: author.userId, file }));
    setUploading(false);
    if (uploadMemberAvatar.fulfilled.match(res)) {
      dispatch(pushToast("Photo updated", "success"));
      if (fileRef.current) fileRef.current.value = "";
    } else {
      dispatch(pushToast(res.payload?.message || "Upload failed", "error"));
    }
  };

  const save = async () => {
    if (isSelf && !name.trim()) return;
    const res = await dispatch(
      updateMemberProfile({
        userId: author.userId,
        // Someone else's name isn't sent at all; the partial update leaves it.
        name: isSelf ? name.trim() : undefined,
        aboutHtml,
      })
    );
    if (updateMemberProfile.fulfilled.match(res)) {
      dispatch(pushToast("Profile saved", "success"));
      onClose();
    } else {
      dispatch(pushToast(res.payload?.message || "Could not save", "error"));
    }
  };

  return (
    <Modal open={!!author} onClose={onClose} title={`Edit author — ${author.email}`}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar name={name || author.email} src={author.avatarUrl} size={56} />
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-cream-200 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-cream-300"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleAvatar} loading={uploading}>
            <Camera size={15} /> Upload photo
          </Button>
        </div>

        <Fieldset label="Display name" hint={isSelf ? "" : "only they can change it"}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            disabled={!isSelf}
            readOnly={!isSelf}
            className={isSelf ? "" : "opacity-60"}
          />
        </Fieldset>

        <Fieldset label="About us" hint="HTML allowed">
          <Textarea rows={4} value={aboutHtml} onChange={(e) => setAboutHtml(e.target.value)} placeholder="A short bio for this author…" />
        </Fieldset>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="teal" onClick={save} loading={mutating} disabled={isSelf && !name.trim()}>
            Save profile
          </Button>
        </div>
      </div>
    </Modal>
  );
}
