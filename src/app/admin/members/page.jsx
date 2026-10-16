"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, Trash2, Users } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchMembers,
  addMember,
  changeMemberRole,
  removeMember,
  setRoleFilter,
} from "@/store/slices/membersSlice";
import { pushToast } from "@/store/slices/uiSlice";
import PageHeader from "@/components/admin/PageHeader";
import { Card, Modal, EmptyState } from "@/components/ui/Shell";
import { Button, Avatar, Badge, Spinner } from "@/components/ui/Primitives";
import { Input, Select, Textarea, Fieldset } from "@/components/ui/Field";

const ROLE_TABS = [
  { value: "", label: "All" },
  { value: "admin", label: "Admins" },
  { value: "author", label: "Authors" },
  { value: "learner", label: "Learners" },
];

export default function MembersPage() {
  const dispatch = useAppDispatch();
  const { items, status, roleFilter, mutating, error } = useAppSelector((s) => s.members);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    dispatch(fetchMembers(roleFilter));
  }, [dispatch, roleFilter]);

  const onRoleChange = async (userId, role) => {
    const res = await dispatch(changeMemberRole({ userId, role }));
    if (changeMemberRole.fulfilled.match(res)) dispatch(pushToast("Role updated", "success"));
  };

  const onRemove = async (userId) => {
    if (!confirm("Remove this member? Their role will be cleared but their profile is kept.")) return;
    const res = await dispatch(removeMember(userId));
    if (removeMember.fulfilled.match(res)) dispatch(pushToast("Member removed", "success"));
  };

  return (
    <div>
      <PageHeader
        title="Members"
        description="Admins and authors run the platform. Learners are added via seats or approved requests."
        action={
          <Button variant="teal" onClick={() => setShowAdd(true)}>
            <UserPlus size={16} /> Add member
          </Button>
        }
      />

      <div className="mb-5 flex gap-2">
        {ROLE_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => dispatch(setRoleFilter(t.value))}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              roleFilter === t.value
                ? "bg-ink text-cream-50"
                : "border border-ink/15 bg-cream-50 text-ink hover:bg-cream-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {status === "loading" ? (
        <div className="flex justify-center py-16"><Spinner size={26} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title="No members here" description="Add an admin or author to get started." />
      ) : (
        <Card className="divide-y divide-ink/8">
          {items.map((m) => (
            <div key={m.userId} className="flex items-center gap-4 px-6 py-4">
              <Avatar name={m.name} src={m.avatarUrl} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{m.name || "—"}</p>
                <p className="truncate text-sm text-ink-muted">{m.email}</p>
              </div>
              <Badge tone={m.role}>{m.role}</Badge>
              <Select
                value={m.role}
                onChange={(e) => onRoleChange(m.userId, e.target.value)}
                className="w-32"
              >
                <option value="admin">Admin</option>
                <option value="author">Author</option>
                <option value="learner">Learner</option>
              </Select>
              <button
                onClick={() => onRemove(m.userId)}
                className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label="Remove"
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </Card>
      )}

      <AddMemberModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        mutating={mutating}
        error={error}
      />
    </div>
  );
}

function AddMemberModal({ open, onClose, mutating, error }) {
  const dispatch = useAppDispatch();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ email: "", role: "author", name: "", aboutHtml: "" });
  const [file, setFile] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const res = await dispatch(addMember({ ...form, file }));
    if (addMember.fulfilled.match(res)) {
      dispatch(pushToast("Member added", "success"));
      dispatch(fetchMembers(""));
      setForm({ email: "", role: "author", name: "", aboutHtml: "" });
      setFile(null);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add member">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-muted">
          Adds an admin or author by email. If they already have an account, their role is updated.
        </p>
        <Fieldset label="Email">
          <Input type="email" required value={form.email} onChange={set("email")} placeholder="person@company.com" />
        </Fieldset>
        <Fieldset label="Role">
          <Select value={form.role} onChange={set("role")}>
            <option value="author">Author</option>
            <option value="admin">Admin</option>
          </Select>
        </Fieldset>
        <Fieldset label="Display name" hint="new people only">
          <Input maxLength={100} value={form.name} onChange={set("name")} placeholder="e.g. Asha Verma" />
        </Fieldset>
        <Fieldset label="Bio" hint="optional, HTML allowed">
          <Textarea rows={3} value={form.aboutHtml} onChange={set("aboutHtml")} />
        </Fieldset>
        <Fieldset label="Avatar" hint="optional">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-cream-200 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-cream-300"
          />
        </Fieldset>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="teal" loading={mutating}>Add member</Button>
        </div>
      </form>
    </Modal>
  );
}
