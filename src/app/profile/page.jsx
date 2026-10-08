"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Save } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchMyProfile,
  updateMyProfile,
  uploadMyAvatar,
} from "@/store/slices/profileSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { userUpdated } from "@/store/slices/authSlice";
import RouteGuard from "@/components/auth/RouteGuard";
import TopNav from "@/components/learner/TopNav";
import { Card } from "@/components/ui/Shell";
import { Button, Avatar, Spinner, Badge } from "@/components/ui/Primitives";
import { Input, Select, Textarea, Fieldset } from "@/components/ui/Field";

const EMPTY = {
  name: "",
  firstName: "",
  lastName: "",
  gender: "",
  dob: "",
  profession: "",
  industry: "",
  organizationType: "",
  companyType: "",
  companyDisplayName: "",
  organizationUrl: "",
  linkedInUrl: "",
  aboutHtml: "",
  city: "",
  state: "",
  country: "",
};

function ProfileInner() {
  const dispatch = useAppDispatch();
  const fileRef = useRef(null);
  const { me, status, saving } = useAppSelector((s) => s.profile);
  const { role } = useAppSelector((s) => s.auth);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    dispatch(fetchMyProfile());
  }, [dispatch]);

  useEffect(() => {
    if (!me) return;
    setForm({
      name: me.name || "",
      firstName: me.firstName || "",
      lastName: me.lastName || "",
      gender: me.gender || "",
      dob: me.dob || "",
      profession: me.profession || "",
      industry: me.industry || "",
      organizationType: me.organizationType || "",
      companyType: me.companyType || "",
      companyDisplayName: me.companyDisplayName || "",
      organizationUrl: me.organizationUrl || "",
      linkedInUrl: me.linkedInUrl || "",
      aboutHtml: me.aboutHtml || "",
      city: me.location?.city || "",
      state: me.location?.state || "",
      country: me.location?.country || "",
    });
  }, [me]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    const patch = {
      name: form.name,
      firstName: form.firstName,
      lastName: form.lastName,
      profession: form.profession,
      industry: form.industry,
      organizationType: form.organizationType,
      companyType: form.companyType,
      companyDisplayName: form.companyDisplayName,
      aboutHtml: form.aboutHtml,
    };
    if (form.gender) patch.gender = form.gender;
    if (form.dob) patch.dob = form.dob;
    if (form.organizationUrl !== undefined) patch.organizationUrl = form.organizationUrl;
    if (form.linkedInUrl !== undefined) patch.linkedInUrl = form.linkedInUrl;
    if (form.city && form.state && form.country) {
      patch.location = { city: form.city, state: form.state, country: form.country };
    }
    // Drop empty strings for optional bounded fields to avoid 400s
    Object.keys(patch).forEach((k) => {
      if (patch[k] === "" && !["aboutHtml", "organizationUrl", "linkedInUrl"].includes(k))
        delete patch[k];
    });
    const res = await dispatch(updateMyProfile(patch));
    if (updateMyProfile.fulfilled.match(res)) {
      // Keep the signed-in user (top-nav avatar/name) in sync with the save.
      dispatch(
        userUpdated({ name: res.payload?.name, avatarUrl: res.payload?.avatarUrl })
      );
      dispatch(pushToast("Profile saved", "success"));
    } else dispatch(pushToast(res.payload?.message || "Could not save", "error"));
  };

  const onAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await dispatch(uploadMyAvatar(file));
    if (uploadMyAvatar.fulfilled.match(res)) {
      console.log(res.payload?.avatarUrl??'nope')
      // Reflect the new avatar in the top-nav immediately.
      dispatch(userUpdated({ avatarUrl: res.payload?.avatarUrl }));
      dispatch(pushToast("Avatar updated", "success"));
    } else dispatch(pushToast(res.payload?.message || "Upload failed", "error"));
  };

  if (status === "loading" && !me) {
    return <div className="flex justify-center py-24"><Spinner size={28} /></div>;
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="mb-8 flex items-center gap-5">
          <div className="relative">
            <Avatar name={me?.name} src={me?.avatarUrl} size={80} />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-cream-100 bg-teal text-white hover:bg-teal-dark"
              aria-label="Change avatar"
            >
              <Camera size={15} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
          </div>
          <div>
            <h1 className="font-serif text-3xl text-ink">{me?.name || "Your profile"}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-ink-muted">{me?.email}</span>
              {role && <Badge tone={role}>{role}</Badge>}
            </div>
          </div>
        </div>

        <form onSubmit={save} className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 font-serif text-lg text-ink">Basics</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Fieldset label="Display name">
                <Input value={form.name} onChange={set("name")} />
              </Fieldset>
              <Fieldset label="Email" hint="fixed at signup">
                <Input value={me?.email || ""} disabled className="opacity-60" />
              </Fieldset>
              <Fieldset label="First name">
                <Input value={form.firstName} onChange={set("firstName")} />
              </Fieldset>
              <Fieldset label="Last name">
                <Input value={form.lastName} onChange={set("lastName")} />
              </Fieldset>
              <Fieldset label="Gender">
                <Select value={form.gender} onChange={set("gender")}>
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </Select>
              </Fieldset>
              <Fieldset label="Date of birth" hint="DD/MM/YYYY">
                <Input value={form.dob} onChange={set("dob")} placeholder="05/03/1995" />
              </Fieldset>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-serif text-lg text-ink">Location</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Fieldset label="City"><Input value={form.city} onChange={set("city")} /></Fieldset>
              <Fieldset label="State"><Input value={form.state} onChange={set("state")} /></Fieldset>
              <Fieldset label="Country"><Input value={form.country} onChange={set("country")} /></Fieldset>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-serif text-lg text-ink">Work & links</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Fieldset label="Profession"><Input value={form.profession} onChange={set("profession")} /></Fieldset>
              <Fieldset label="Industry"><Input value={form.industry} onChange={set("industry")} /></Fieldset>
              <Fieldset label="Organization type"><Input value={form.organizationType} onChange={set("organizationType")} /></Fieldset>
              <Fieldset label="Company type"><Input value={form.companyType} onChange={set("companyType")} /></Fieldset>
              <Fieldset label="Company name"><Input value={form.companyDisplayName} onChange={set("companyDisplayName")} /></Fieldset>
              <Fieldset label="Organization URL"><Input value={form.organizationUrl} onChange={set("organizationUrl")} placeholder="https://" /></Fieldset>
              <Fieldset label="LinkedIn URL"><Input value={form.linkedInUrl} onChange={set("linkedInUrl")} placeholder="https://linkedin.com/in/" /></Fieldset>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-serif text-lg text-ink">About</h2>
            <Fieldset label="Bio" hint="basic HTML allowed">
              <Textarea rows={4} value={form.aboutHtml} onChange={set("aboutHtml")} placeholder="<p>A little about you…</p>" />
            </Fieldset>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" variant="teal" size="lg" loading={saving}>
              <Save size={16} /> Save changes
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RouteGuard>
      <ProfileInner />
    </RouteGuard>
  );
}
