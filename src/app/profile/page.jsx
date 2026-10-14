"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Input, Textarea, Fieldset } from "@/components/ui/Field";
import { Dropdown } from "@/components/ui/Dropdown";
import { DateField } from "@/components/ui/DateField";
import { dmyToIso, isoToDmy, toISODate } from "@/lib/date";
import {
  AVATAR,
  GENDER_OPTIONS,
  LIMITS,
  dobBounds,
  sanitize,
  validateProfile,
  validateAvatar,
  normalizeUrl,
  dobFromApi,
  htmlToPlainText,
  plainTextToHtml,
} from "@/lib/profileValidation";

// Key order = on-screen order, used to focus the first invalid field.
const EMPTY = {
  name: "",
  firstName: "",
  lastName: "",
  gender: "",
  dob: "",
  city: "",
  state: "",
  country: "",
  profession: "",
  industry: "",
  organizationType: "",
  companyType: "",
  companyDisplayName: "",
  organizationUrl: "",
  linkedInUrl: "",
  about: "", // plain text; converted to aboutHtml on save
};

const URL_FIELDS = ["organizationUrl", "linkedInUrl"];
const idFor = (key) => `profile-${key}`;

function trimAll(form) {
  return Object.fromEntries(
    Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
  );
}

function ProfileInner() {
  const dispatch = useAppDispatch();
  const fileRef = useRef(null);
  const { me, status, saving } = useAppSelector((s) => s.profile);
  const { role } = useAppSelector((s) => s.auth);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  // DateField works in YYYY-MM-DD; the form/API keep DD/MM/YYYY.
  const dobRange = useMemo(() => {
    const { min, max } = dobBounds();
    return { min: toISODate(min), max: toISODate(max) };
  }, []);

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
      dob: dobFromApi(me.dob),
      city: me.location?.city || "",
      state: me.location?.state || "",
      country: me.location?.country || "",
      profession: me.profession || "",
      industry: me.industry || "",
      organizationType: me.organizationType || "",
      companyType: me.companyType || "",
      companyDisplayName: me.companyDisplayName || "",
      organizationUrl: me.organizationUrl || "",
      linkedInUrl: me.linkedInUrl || "",
      about: htmlToPlainText(me.aboutHtml),
    });
    setErrors({});
  }, [me]);

  // Works with native inputs (event) and custom ones like Dropdown (value).
  const onChange = (key) => (eventOrValue) => {
    const raw = eventOrValue?.target ? eventOrValue.target.value : eventOrValue ?? "";
    const value = sanitize[key] ? sanitize[key](raw) : raw;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) {
      setErrors(({ [key]: _removed, ...rest }) => rest);
    }
  };

  // Tidy the field and show its error (if any) when the user leaves it.
  const onBlur = (key) => () => {
    let value = typeof form[key] === "string" ? form[key].trim() : form[key];
    if (URL_FIELDS.includes(key)) value = normalizeUrl(value);
    const next = { ...form, [key]: value };
    if (value !== form[key]) setForm(next);

    const found = validateProfile(next);
    setErrors((prev) => {
      const copy = { ...prev };
      if (found[key]) copy[key] = found[key];
      else delete copy[key];
      return copy;
    });
  };

  // Props shared by every input: value, handlers, error state, a11y wiring.
  const bind = (key) => ({
    id: idFor(key),
    value: form[key],
    onChange: onChange(key),
    onBlur: onBlur(key),
    invalid: Boolean(errors[key]),
    "aria-describedby": errors[key] ? `${idFor(key)}-error` : undefined,
  });

  const field = (key, label, extra = {}) => ({
    label,
    htmlFor: idFor(key),
    error: errors[key],
    ...extra,
  });

  const save = async (e) => {
    e.preventDefault();

    const clean = trimAll({
      ...form,
      organizationUrl: normalizeUrl(form.organizationUrl),
      linkedInUrl: normalizeUrl(form.linkedInUrl),
    });
    setForm(clean);

    const found = validateProfile(clean);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(EMPTY).find((k) => found[k]);
      document.getElementById(idFor(first))?.focus();
      dispatch(pushToast("Fix the highlighted fields to save", "error"));
      return;
    }

    const patch = {
      name: clean.name,
      firstName: clean.firstName,
      lastName: clean.lastName,
      profession: clean.profession,
      industry: clean.industry,
      organizationType: clean.organizationType,
      companyType: clean.companyType,
      companyDisplayName: clean.companyDisplayName,
      organizationUrl: clean.organizationUrl,
      linkedInUrl: clean.linkedInUrl,
      aboutHtml: plainTextToHtml(clean.about),
    };
    if (clean.gender) patch.gender = clean.gender;
    if (clean.dob) patch.dob = clean.dob; // sent as DD/MM/YYYY, same as before
    if (clean.city && clean.state && clean.country) {
      patch.location = { city: clean.city, state: clean.state, country: clean.country };
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
    } else dispatch(pushToast(res.payload?.message || "Profile wasn't saved. Try again.", "error"));
  };

  const onAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the user pick the same file again after an error
    if (!file) return;

    const problem = validateAvatar(file);
    if (problem) {
      dispatch(pushToast(problem, "error"));
      return;
    }

    const res = await dispatch(uploadMyAvatar(file));
    if (uploadMyAvatar.fulfilled.match(res)) {
      // Reflect the new avatar in the top-nav immediately.
      dispatch(userUpdated({ avatarUrl: res.payload?.avatarUrl }));
      dispatch(pushToast("Avatar updated", "success"));
    } else dispatch(pushToast(res.payload?.message || "Avatar wasn't uploaded. Try again.", "error"));
  };

  if (status === "loading" && !me) {
    return <div className="flex justify-center py-24"><Spinner size={28} /></div>;
  }

  const aboutCount = Array.from(form.about).length;

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="mb-8 flex items-center gap-5">
          <div className="relative">
            <Avatar name={me?.name} src={me?.avatarUrl} size={80} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-cream-100 bg-teal text-white hover:bg-teal-dark"
              aria-label="Change avatar"
            >
              <Camera size={15} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={AVATAR.types.join(",")}
              hidden
              onChange={onAvatar}
            />
          </div>
          <div>
            <h1 className="font-serif text-3xl text-ink">{me?.name || "Your profile"}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-ink-muted">{me?.email}</span>
              {role && <Badge tone={role}>{role}</Badge>}
            </div>
          </div>
        </div>

        <form onSubmit={save} noValidate className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 font-serif text-lg text-ink">Basics</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Fieldset {...field("name", "Display name")}>
                <Input {...bind("name")} placeholder="How your name appears to others" autoComplete="nickname" />
              </Fieldset>
              <Fieldset label="Email" hint="can't be changed" htmlFor={idFor("email")}>
                <Input
                  id={idFor("email")}
                  value={me?.email || ""}
                  placeholder="name@example.com"
                  disabled
                  readOnly
                  className="opacity-60"
                />
              </Fieldset>
              <Fieldset {...field("firstName", "First name")}>
                <Input {...bind("firstName")} placeholder="First name" autoComplete="given-name" />
              </Fieldset>
              <Fieldset {...field("lastName", "Last name")}>
                <Input {...bind("lastName")} placeholder="Last name" autoComplete="family-name" />
              </Fieldset>
              <Fieldset {...field("gender", "Gender")}>
                <Dropdown {...bind("gender")} options={GENDER_OPTIONS} placeholder="Select gender" />
              </Fieldset>
              <Fieldset {...field("dob", "Date of birth")}>
                <DateField
                  {...bind("dob")}
                  value={dmyToIso(form.dob)}
                  onChange={(e) => onChange("dob")(isoToDmy(e.target.value))}
                  min={dobRange.min}
                  max={dobRange.max}
                  openTo="years"
                  placeholder="Select your date of birth"
                />
              </Fieldset>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-serif text-lg text-ink">Location</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Fieldset {...field("city", "City")}>
                <Input {...bind("city")} placeholder="City" autoComplete="address-level2" />
              </Fieldset>
              <Fieldset {...field("state", "State")}>
                <Input {...bind("state")} placeholder="State" autoComplete="address-level1" />
              </Fieldset>
              <Fieldset {...field("country", "Country")}>
                <Input {...bind("country")} placeholder="Country" autoComplete="country-name" />
              </Fieldset>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-serif text-lg text-ink">Work & links</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Fieldset {...field("profession", "Profession")}>
                <Input {...bind("profession")} placeholder="e.g. Software engineer" />
              </Fieldset>
              <Fieldset {...field("industry", "Industry")}>
                <Input {...bind("industry")} placeholder="e.g. Education" />
              </Fieldset>
              <Fieldset {...field("organizationType", "Organization type")}>
                <Input {...bind("organizationType")} placeholder="e.g. Private" />
              </Fieldset>
              <Fieldset {...field("companyType", "Company type")}>
                <Input {...bind("companyType")} placeholder="e.g. Startup" />
              </Fieldset>
              <Fieldset {...field("companyDisplayName", "Company name")}>
                <Input {...bind("companyDisplayName")} placeholder="e.g. Acme Learning" autoComplete="organization" />
              </Fieldset>
              <Fieldset {...field("organizationUrl", "Organization URL")}>
                <Input {...bind("organizationUrl")} type="url" inputMode="url" placeholder="https://example.com" />
              </Fieldset>
              <Fieldset {...field("linkedInUrl", "LinkedIn URL")}>
                <Input {...bind("linkedInUrl")} type="url" inputMode="url" placeholder="https://linkedin.com/in/your-name" />
              </Fieldset>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-serif text-lg text-ink">About</h2>
            <Fieldset {...field("about", "Bio")}>
              <Textarea
                {...bind("about")}
                rows={4}
                placeholder="Tell learners a little about yourself"
              />
              <p className="mt-1 text-right text-xs text-ink-muted">
                {aboutCount}/{LIMITS.about}
              </p>
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