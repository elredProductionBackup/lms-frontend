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
import SiteFooter from "@/components/learner/SiteFooter";
import { Card } from "@/components/ui/Shell";
import { Button, Avatar, Spinner, Badge } from "@/components/ui/Primitives";
import { Input, Textarea, Fieldset } from "@/components/ui/Field";
import {
  AVATAR,
  LIMITS,
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

// Form values from GET /me/profile (or a PUT response).
function formFromProfile(me) {
  return {
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
  };
}

// PUT /me/profile is a partial update, so send ONLY what the user changed.
// Sending every field (empty ones included) is what made "save my display
// name" fail: the live API still rejects "" for firstName/profession/…,
// null gender and half-empty locations until the relaxed profile rules ship,
// so one untouched empty field 400'd the whole save. With a diff, changing
// just the display name sends just { name }.
//
// Clearing a field that had a value still sends "" / null as the contract
// asks; on the current API that particular save may be refused with the
// server's message until the relaxed rules are live.
function buildPatch(before, after) {
  const patch = {};
  if (after.name !== before.name) patch.name = after.name;
  TEXT_KEYS.forEach((k) => {
    if ((after[k] || "") !== (before[k] || "")) patch[k] = after[k] || "";
  });
  if ((after.gender || "") !== (before.gender || "")) patch.gender = after.gender || null;
  if ((after.dob || "") !== (before.dob || "")) patch.dob = after.dob || ""; // DD/MM/YYYY
  const loc = ["city", "state", "country"];
  if (loc.some((k) => (after[k] || "") !== (before[k] || ""))) {
    patch.location = { city: after.city || "", state: after.state || "", country: after.country || "" };
  }
  if ((after.about || "").trim() !== (before.about || "").trim()) {
    patch.aboutHtml = plainTextToHtml(after.about);
  }
  return patch;
}


// Plain text fields sent as-is; "" clears the saved value.
const TEXT_KEYS = [
  "firstName",
  "lastName",
  "profession",
  "industry",
  "organizationType",
  "companyType",
  "companyDisplayName",
  "organizationUrl",
  "linkedInUrl",
];
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
  useEffect(() => {
    dispatch(fetchMyProfile());
  }, [dispatch]);

  // What the server last gave us, in form shape. Saving sends only the fields
  // that differ from this.
  const baselineRef = useRef(EMPTY);

  useEffect(() => {
    if (!me) return;
    const loaded = formFromProfile(me);
    baselineRef.current = loaded;
    setForm(loaded);
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

    // Only block the save on fields the user actually changed (plus the
    // required display name). Old data that doesn't match today's FE rules
    // shouldn't stop someone from fixing their name.
    const before = baselineRef.current;
    const touched = (k) => k === "name" || (clean[k] || "") !== (before[k] || "");
    const found = Object.fromEntries(
      Object.entries(validateProfile(clean)).filter(([k]) => touched(k))
    );
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(EMPTY).find((k) => found[k]);
      document.getElementById(idFor(first))?.focus();
      dispatch(pushToast("Fix the highlighted fields to save", "error"));
      return;
    }

    const patch = buildPatch(baselineRef.current, clean);
    if (Object.keys(patch).length === 0) {
      dispatch(pushToast("No changes to save", "default"));
      return;
    }

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
  const optional = <span className="ml-2 align-middle font-sans text-xs font-normal text-ink-muted">Optional</span>;

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
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
                <Input
                  {...bind("name")}
                  maxLength={LIMITS.name}
                  placeholder="How your name appears to others"
                  autoComplete="nickname"
                  required
                />
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
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-serif text-lg text-ink">Location{optional}</h2>
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
            <h2 className="mb-4 font-serif text-lg text-ink">Work & links{optional}</h2>
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
            <h2 className="mb-4 font-serif text-lg text-ink">About{optional}</h2>
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
      <SiteFooter />
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