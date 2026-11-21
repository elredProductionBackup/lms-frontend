"use client";

import { useEffect, useState } from "react";
import { UserPlus, Trash2, Users } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchMembers,
  addMember,
  changeMemberRole,
  removeMember,
  PERSON_NAME_MAX,
} from "@/store/slices/membersSlice";
import { pushToast } from "@/store/slices/uiSlice";
import PageHeader from "@/components/admin/PageHeader";
import { Card, EmptyState } from "@/components/ui/Shell";
import { Button, Avatar, Spinner } from "@/components/ui/Primitives";
import { Input, Select, Fieldset } from "@/components/ui/Field";
import Pagination from "@/components/ui/Pagination";
import { usePaging } from "@/hooks/usePaging";

const ROLE_LABEL = { admin: "Admin", author: "Author", learner: "Learner" };
const ROLE_FILTERS = [
  { value: "", label: "All roles" },
  { value: "admin", label: "Admins" },
  { value: "author", label: "Authors" },
  { value: "learner", label: "Learners" },
];

export default function AdminUsersPage() {
  const dispatch = useAppDispatch();
  const { items, page, status } = useAppSelector((s) => s.members);
  const [busyId, setBusyId] = useState(null);
  const [role, setRole] = useState("");
  const [tick, setTick] = useState(0);
  const loading = status === "loading";
  const paging = usePaging({ count: items.length, loading });

  // GET /members?role=&start=&offset=
  useEffect(() => {
    dispatch(fetchMembers({ role, start: paging.start, offset: paging.offset }));
  }, [dispatch, role, paging.start, paging.offset, tick]);

  const reload = () => setTick((t) => t + 1);

  const onFilter = (value) => {
    setRole(value);
    paging.reset();
  };

  const changeRole = async (userId, nextRole) => {
    setBusyId(userId);
    const res = await dispatch(changeMemberRole({ userId, role: nextRole }));
    setBusyId(null);
    if (changeMemberRole.fulfilled.match(res)) {
      dispatch(pushToast("Role updated", "success"));
      if (role) reload(); // they may no longer match the role filter
    } else dispatch(pushToast(res.payload?.message || "Could not change role", "error"));
  };

  const remove = async (userId, label) => {
    if (!confirm(`Remove ${label}'s access?`)) return;
    setBusyId(userId);
    const res = await dispatch(removeMember(userId));
    setBusyId(null);
    if (removeMember.fulfilled.match(res)) {
      dispatch(pushToast("Member removed", "success"));
      reload(); // pull the next person up onto this page
    } else dispatch(pushToast(res.payload?.message || "Could not remove", "error"));
  };

  return (
    <div>
      <PageHeader
        title="Users"
        description="Everyone with access — admins, authors, and learners."
      />

      <AddMemberCard
        onAdded={() => {
          paging.reset();
          reload();
        }}
      />

      <div className="mt-6" ref={paging.listRef}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl text-ink">
            Members
            {page.total != null && (
              <span className="ml-2 align-middle font-sans text-sm font-normal text-ink-muted">{page.total}</span>
            )}
          </h2>
          <div className="w-40">
            <Select value={role} onChange={(e) => onFilter(e.target.value)} aria-label="Filter by role">
              {ROLE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </div>
        </div>
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-16"><Spinner size={26} /></div>
        ) : items.length === 0 ? (
          role ? (
            <EmptyState icon={Users} title={`No ${ROLE_LABEL[role].toLowerCase()}s`} description="Try another role, or choose All roles." />
          ) : (
            <EmptyState icon={Users} title="No members yet" description="Add an admin or author to get started." />
          )
        ) : (
          <>
          <Card className={`overflow-hidden transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
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
            </div>
          </Card>
          <Pagination {...paging.props(page)} noun="members" />
          </>
        )}
      </div>
    </div>
  );
}

function AddMemberCard({ onAdded }) {
  const dispatch = useAppDispatch();
  const { mutating } = useAppSelector((s) => s.members);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("author");

  // POST /members { email, role, name }. The name is used only when this
  // creates the account; an existing account gets the role and keeps its name.
  const submit = async (e) => {
    e.preventDefault();
    const typed = name.trim();
    const res = await dispatch(addMember({ email: email.trim().toLowerCase(), role, name: typed }));
    if (addMember.fulfilled.match(res)) {
      const used = res.payload?.name?.trim() || "";
      dispatch(
        typed && used && used !== typed
          ? pushToast(`${used} already had an account: role updated, name kept.`, "default")
          : pushToast(`${used || typed || "Member"} added`, "success")
      );
      onAdded?.();
      setName("");
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
      <form onSubmit={submit} className="flex flex-wrap items-start gap-3">
        <div className="min-w-[200px] flex-1">
          <Fieldset label="Display name" hint="new people only" htmlFor="member-name">
            <Input
              id="member-name"
              maxLength={PERSON_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Asha Verma"
            />
          </Fieldset>
        </div>
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
        <Button type="submit" variant="teal" loading={mutating} className="sm:mt-[1.6rem]">
          <UserPlus size={16} /> Add member
        </Button>
      </form>
    </Card>
  );
}
