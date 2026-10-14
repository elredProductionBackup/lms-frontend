// Rules for the profile form. The backend should enforce the same limits;
// these only give the user fast, friendly feedback.

import { addDays, ageOn, maskDMY, parseDMY, yearsAgo } from "@/lib/date";

export const LIMITS = {
  name: 50,
  firstName: 30,
  lastName: 30,
  city: 50,
  state: 50,
  country: 50,
  profession: 60,
  industry: 60,
  organizationType: 60,
  companyType: 60,
  companyDisplayName: 100,
  url: 200,
  about: 1000,
};

export const MIN_AGE = 13;
export const MAX_AGE = 100;

// Edit this list to change the gender dropdown everywhere.
export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];
export const GENDERS = GENDER_OPTIONS.map((o) => o.value);

// Earliest and latest allowed birth dates (age MIN_AGE to MAX_AGE), for DateField.
export function dobBounds(today = new Date()) {
  return {
    min: addDays(yearsAgo(MAX_AGE + 1, today), 1),
    max: yearsAgo(MIN_AGE, today),
  };
}

export const AVATAR = {
  maxBytes: 2 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp"],
};

// Allowed characters per kind of field. \p{L} = letters from any script,
// \p{M} = combining marks (needed for Hindi matras etc.). Emoji, digits and
// symbols are not in these classes, so they are rejected.
const CHARS = {
  name: { set: "\\p{L}\\p{M} ", msg: "Use letters and spaces only" },
  place: { set: "\\p{L}\\p{M} .'\\-", msg: "Use letters, spaces, . ' and - only" },
  text: { set: "\\p{L}\\p{M} .,&()'/\\-", msg: "Use letters, spaces and . , & ( ) ' / - only" },
  company: {
    set: "\\p{L}\\p{M}\\p{N} .,&()'/\\-",
    msg: "Use letters, numbers, spaces and . , & ( ) ' / - only",
  },
};

const TEXT_FIELDS = {
  name: { label: "Display name", kind: "name", min: 2, required: true },
  firstName: { label: "First name", kind: "name", min: 2 },
  lastName: { label: "Last name", kind: "name", min: 1 },
  city: { label: "City", kind: "place", min: 2 },
  state: { label: "State", kind: "place", min: 2 },
  country: { label: "Country", kind: "place", min: 2 },
  profession: { label: "Profession", kind: "text", min: 2 },
  industry: { label: "Industry", kind: "text", min: 2 },
  organizationType: { label: "Organization type", kind: "text", min: 2 },
  companyType: { label: "Company type", kind: "text", min: 2 },
  companyDisplayName: { label: "Company name", kind: "company", min: 2 },
};

const disallowed = (kind, flags) => new RegExp(`[^${CHARS[kind].set}]`, flags);
const charCount = (s) => Array.from(s).length; // counts emoji/surrogates as 1

/* ---------------- Sanitizers: run on every keystroke / paste ---------------- */

const cleanText = (kind, max) => (value) =>
  Array.from(
    value
      .replace(disallowed(kind, "gu"), "")
      .replace(/ {2,}/g, " ")
      .replace(/^ +/, "")
  )
    .slice(0, max)
    .join("");

export const sanitize = {
  ...Object.fromEntries(
    Object.entries(TEXT_FIELDS).map(([key, rule]) => [key, cleanText(rule.kind, LIMITS[key])])
  ),
  dob: maskDMY,
  organizationUrl: (v) => v.replace(/\s/g, "").slice(0, LIMITS.url),
  linkedInUrl: (v) => v.replace(/\s/g, "").slice(0, LIMITS.url),
  about: (v) => Array.from(v).slice(0, LIMITS.about).join(""),
};

/* ---------------- Date of birth ---------------- */

// Accepts what the API may send ("05/03/1995" or an ISO string) and returns DD/MM/YYYY.
export function dobFromApi(raw) {
  if (!raw || typeof raw !== "string") return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : "";
}

/* ---------------- URLs ---------------- */

// "linkedin.com/in/x" -> "https://linkedin.com/in/x"
export function normalizeUrl(value) {
  const v = (value || "").trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function urlError(value, { linkedIn = false } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return "Enter a valid link, like https://example.com";
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
    return "Enter a valid link, like https://example.com";
  }
  if (linkedIn) {
    const host = url.hostname.toLowerCase();
    const isLinkedIn = host === "linkedin.com" || host.endsWith(".linkedin.com");
    if (!isLinkedIn || !/^\/(in|company)\/[^/]+/.test(url.pathname)) {
      return "Use your LinkedIn profile link, like https://linkedin.com/in/your-name";
    }
  }
  return null;
}

/* ---------------- Bio: plain text in the UI, safe HTML for the API ---------------- */

export function htmlToPlainText(html) {
  if (!html) return "";
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n\n");
  // DOMParser does not run scripts, so this is safe for stripping tags.
  const doc = new DOMParser().parseFromString(withBreaks, "text/html");
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

const escapeHtml = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Blank line = new paragraph, single newline = <br>. Anything the user types
// that looks like HTML is escaped, so it shows as text and never runs.
export function plainTextToHtml(text) {
  const t = (text || "").trim();
  if (!t) return "";
  return t
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/* ---------------- Whole-form validation ---------------- */

export function validateProfile(form) {
  const errors = {};

  for (const [key, rule] of Object.entries(TEXT_FIELDS)) {
    const value = (form[key] || "").trim();
    if (!value) {
      if (rule.required) errors[key] = `${rule.label} is required`;
      continue;
    }
    if (disallowed(rule.kind, "u").test(value)) errors[key] = CHARS[rule.kind].msg;
    else if (charCount(value) < rule.min)
      errors[key] = `${rule.label} needs at least ${rule.min} characters`;
    else if (charCount(value) > LIMITS[key])
      errors[key] = `${rule.label} can be up to ${LIMITS[key]} characters`;
  }

  // Location is saved as one object, so it's all three or none.
  const loc = ["city", "state", "country"];
  const filled = loc.filter((k) => (form[k] || "").trim());
  if (filled.length > 0 && filled.length < loc.length) {
    loc.forEach((k) => {
      if (!(form[k] || "").trim()) errors[k] = "Add city, state and country together";
    });
  }

  if (form.gender && !GENDERS.includes(form.gender)) errors.gender = "Choose an option from the list";

  if (form.dob) {
    const date = parseDMY(form.dob);
    if (!date) {
      errors.dob =
        form.dob.length < 10 ? "Enter the full date as DD/MM/YYYY" : "Enter a real date, like 05/03/1995";
    } else if (date > new Date()) {
      errors.dob = "Date of birth can't be in the future";
    } else {
      const age = ageOn(date);
      if (age < MIN_AGE) errors.dob = `You need to be at least ${MIN_AGE} years old`;
      else if (age > MAX_AGE) errors.dob = "Check the year of birth";
    }
  }

  if (form.organizationUrl) {
    const err = urlError(form.organizationUrl);
    if (err) errors.organizationUrl = err;
  }
  if (form.linkedInUrl) {
    const err = urlError(form.linkedInUrl, { linkedIn: true });
    if (err) errors.linkedInUrl = err;
  }

  if (charCount(form.about || "") > LIMITS.about) {
    errors.about = `Bio can be up to ${LIMITS.about} characters`;
  }

  return errors;
}

export function validateAvatar(file) {
  if (!AVATAR.types.includes(file.type)) return "Upload a JPG, PNG or WebP image";
  if (file.size > AVATAR.maxBytes) return "Image must be 2 MB or smaller";
  return null;
}