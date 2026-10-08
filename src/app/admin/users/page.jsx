"use client";

import { useEffect, useState } from "react";
import { UserPlus, Trash2, Users } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchMembers,
  addMember,
  changeMemberRole,
  removeMember,
} from "@/store/slices/membersSlice";
import { pushToast } from "@/store/slices/uiSlice";
import PageHeader from "@/components/admin/PageHeader";
import { Card, EmptyState } from "@/components/ui/Shell";
import { Button, Avatar, Spinner } from "@/components/ui/Primitives";
import { Input, Select, Fieldset } from "@/components/ui/Field";

const ROLE_LABEL = { admin: "Admin", author: "Author", learner: "Learner" };

export default function AdminUsersPage() {
  const dispatch = useAppDispatch();
  const { items, status } = useAppSelector((s) => s.members);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    dispatch(fetchMembers(""));
  }, [dispatch]);

  const changeRole = async (userId, role) => {
    setBusyId(userId);
    const res = await dispatch(changeMemberRole({ userId, role }));
    setBusyId(null);
    if (changeMemberRole.fulfilled.match(res)) dispatch(pushToast("Role updated", "success"));
    else dispatch(pushToast(res.payload?.message || "Could not change role", "error"));
  };

  const remove = async (userId, label) => {
    if (!confirm(`Remove ${label}'s access?`)) return;
    setBusyId(userId);
    const res = await dispatch(removeMember(userId));
    setBusyId(null);
    if (removeMember.fulfilled.match(res)) dispatch(pushToast("Member removed", "success"));
    else dispatch(pushToast(res.payload?.message || "Could not remove", "error"));
  };

  return (
    <div>
      <PageHeader
        title="Users"
        description="Everyone with access — admins, authors, and learners."
      />

      <AddMemberCard />

      <div className="mt-6">
        <h2 className="mb-3 font-serif text-xl text-ink">Members</h2>
        {status === "loading" && items.length === 0 ? (
          <div className="flex justify-center py-16"><Spinner size={26} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={Users} title="No members yet" description="Add an admin or author to get started." />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/8 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {items.map((m) => (
                  <tr key={m.userId} className="hover:bg-cream-100/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name || m.email} src={m.avatarUrl} size={32} />
                        <span className="font-medium text-ink">{m.name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{m.email}</td>
                    <td className="px-5 py-3">
                      <Select
                        value={m.role}
                        disabled={busyId === m.userId}
                        onChange={(e) => changeRole(m.userId, e.target.value)}
                        className="w-32"
                      >
                        <option value="admin">{ROLE_LABEL.admin}</option>
                        <option value="author">{ROLE_LABEL.author}</option>
                        <option value="learner">{ROLE_LABEL.learner}</option>
                      </Select>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busyId === m.userId}
                        onClick={() => remove(m.userId, m.email)}
                      >
                        <Trash2 size={14} /> Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}

function AddMemberCard() {
  const dispatch = useAppDispatch();
  const { mutating } = useAppSelector((s) => s.members);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("author");

  const submit = async (e) => {
    e.preventDefault();
    const res = await dispatch(addMember({ email: email.trim().toLowerCase(), role }));
    if (addMember.fulfilled.match(res)) {
      dispatch(pushToast("Member added", "success"));
      dispatch(fetchMembers(""));
      setEmail("");
      setRole("author");
    } else {
      dispatch(pushToast(res.payload?.message || "Could not add member", "error"));
    }
  };

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-serif text-lg text-ink">Add a member</h2>
      <p className="mb-4 text-sm text-ink-muted">
        Only admins and authors can be added directly here — learners get access via seat assignment on a
        course or by requesting to join from the public catalog.
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <Fieldset label="Email">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </Fieldset>
        </div>
        <div className="w-40">
          <Fieldset label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="admin">Admin</option>
              <option value="author">Author</option>
            </Select>
          </Fieldset>
        </div>
        <Button type="submit" variant="teal" loading={mutating}>
          <UserPlus size={16} /> Add member
        </Button>
      </form>
    </Card>
  );
}
