"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { submitJoinRequest, resetSubmit } from "@/store/slices/joinRequestsSlice";
import { Button } from "@/components/ui/Primitives";
import { Input, Select, Fieldset } from "@/components/ui/Field";
import { Card } from "@/components/ui/Shell";

export default function JoinPage() {
  const dispatch = useAppDispatch();
  const { submitStatus, error } = useAppSelector((s) => s.joinRequests);
  const settings = useAppSelector((s) => s.settings);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    userName: "",
    gender: "male",
    dob: "",
    city: "",
    state: "",
    country: "",
    profession: "",
    organizationType: "",
    companyType: "",
    companyDisplayName: "",
    industry: "",
    organizationUrl: "",
    linkedInUrl: "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      userName: form.userName,
      gender: form.gender,
      dob: form.dob,
      location: { city: form.city, state: form.state, country: form.country },
      profession: form.profession,
      organizationType: form.organizationType,
      companyType: form.companyType,
      companyDisplayName: form.companyDisplayName,
      industry: form.industry,
    };
    if (form.organizationUrl) payload.organizationUrl = form.organizationUrl;
    if (form.linkedInUrl) payload.linkedInUrl = form.linkedInUrl;
    dispatch(submitJoinRequest(payload));
  };

  if (submitStatus === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Card className="max-w-md p-10 text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-available/12 text-available">
            <CheckCircle2 size={30} strokeWidth={1.5} />
          </span>
          <h1 className="font-serif text-2xl text-ink">Request received</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            An admin will review your request. Once approved, you can sign in with your
            email to start watching sessions.
          </p>
          <Link href="/login" className="mt-6 inline-block">
            <Button variant="teal">Go to sign in</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link
        href="/login"
        onClick={() => dispatch(resetSubmit())}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> Back to sign in
      </Link>
      <h1 className="font-serif text-4xl text-ink">Request access</h1>
      <p className="mt-2 text-ink-muted">
        Tell us a bit about yourself. {settings.name} admins review each request.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <Card className="p-6">
          <h2 className="mb-4 font-serif text-lg text-ink">About you</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Fieldset label="First name">
              <Input required value={form.firstName} onChange={set("firstName")} />
            </Fieldset>
            <Fieldset label="Last name">
              <Input required value={form.lastName} onChange={set("lastName")} />
            </Fieldset>
            <Fieldset label="Email">
              <Input type="email" required value={form.email} onChange={set("email")} />
            </Fieldset>
            <Fieldset label="Phone">
              <Input required value={form.phone} onChange={set("phone")} placeholder="+91 ..." />
            </Fieldset>
            <Fieldset label="Username" hint="3–30 chars, unique">
              <Input required value={form.userName} onChange={set("userName")} />
            </Fieldset>
            <Fieldset label="Gender">
              <Select value={form.gender} onChange={set("gender")}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </Fieldset>
            <Fieldset label="Date of birth" hint="DD/MM/YYYY">
              <Input required value={form.dob} onChange={set("dob")} placeholder="05/03/1995" />
            </Fieldset>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-serif text-lg text-ink">Location</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Fieldset label="City">
              <Input required value={form.city} onChange={set("city")} />
            </Fieldset>
            <Fieldset label="State">
              <Input required value={form.state} onChange={set("state")} />
            </Fieldset>
            <Fieldset label="Country">
              <Input required value={form.country} onChange={set("country")} />
            </Fieldset>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-serif text-lg text-ink">Work</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Fieldset label="Profession">
              <Input required value={form.profession} onChange={set("profession")} />
            </Fieldset>
            <Fieldset label="Industry">
              <Input required value={form.industry} onChange={set("industry")} />
            </Fieldset>
            <Fieldset label="Organization type">
              <Input required value={form.organizationType} onChange={set("organizationType")} />
            </Fieldset>
            <Fieldset label="Company type">
              <Input required value={form.companyType} onChange={set("companyType")} />
            </Fieldset>
            <Fieldset label="Company name">
              <Input required value={form.companyDisplayName} onChange={set("companyDisplayName")} />
            </Fieldset>
            <Fieldset label="Organization URL" hint="optional">
              <Input value={form.organizationUrl} onChange={set("organizationUrl")} placeholder="https://" />
            </Fieldset>
            <Fieldset label="LinkedIn URL" hint="optional">
              <Input value={form.linkedInUrl} onChange={set("linkedInUrl")} placeholder="https://linkedin.com/in/" />
            </Fieldset>
          </div>
        </Card>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
        <Button
          type="submit"
          variant="teal"
          size="lg"
          className="w-full"
          loading={submitStatus === "loading"}
        >
          Submit request
        </Button>
      </form>
    </div>
  );
}
