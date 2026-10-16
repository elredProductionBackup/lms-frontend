"use client";

import { Mail, Globe, Phone, ArrowUpRight } from "lucide-react";
import BrandMark from "@/components/ui/BrandMark";

/* ------------------------------------------------------------------ *
 *  Footer content: everything is edited here, in this one file.
 *  Every link goes to the main website (not the LMS).
 *  Leave a value "" (or a list empty) and it simply isn't shown.
 * ------------------------------------------------------------------ */

const WEBSITE = "https://www.theprofessionals.network";

const BLURB =
  "Online courses taught by professors from the world's leading business schools. Stream at your own pace and earn a certificate when you finish.";

const EMAIL = "info@theprofessionals.network";
const PHONE = ""; // e.g. "+91 98765 43210"
const ADDRESS = ""; // one line
const COMPANY_URL = ""; // Rextone Digital's website
const COLLEGE_DISCLAIMER = "";

const COURSES = [{ label: "Developing Quantitative Intuition", path: "/view-details" }];

const COMPANY = [
  { label: "About", path: "/about" },
  { label: "Gallery", path: "/gallery" },
  // { label: "FAQs", path: "/faqs" },
];

// e.g. { label: "Privacy policy", path: "/privacy-policy" }
const POLICIES = [];

// e.g. { label: "LinkedIn", href: "https://www.linkedin.com/company/…" }
const SOCIALS = [];

/* ------------------------------------------------------------------ */

// Same background as the featured course card and the login hero.
const GRADIENT =
  "radial-gradient(120% 120% at 88% 92%, rgba(153,18,27,0.40) 0%, rgba(0,0,0,0) 55%), linear-gradient(150deg, #1c1215 0%, #141317 55%, #0d0d10 100%)";
const DOT_TEXTURE = "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)";

const site = (path) => `${WEBSITE}${path}`;
const linkCls = "text-white/65 transition-colors hover:text-white";

function Column({ title, children, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/45">{title}</h2>
      <ul className="mt-4 space-y-3 text-[15px]">{children}</ul>
    </div>
  );
}

export default function SiteFooter() {
  const year = new Date().getFullYear();

  // Columns on the right share the full width, however many are filled in.
  const columns = [
    <Column key="courses" title="Courses">
      {COURSES.map((c) => (
        <li key={c.path}>
          <a href={site(c.path)} className={linkCls}>{c.label}</a>
        </li>
      ))}
      <li className="text-white/40">More courses coming soon</li>
    </Column>,

    <Column key="company" title="Company">
      {COMPANY.map((l) => (
        <li key={l.path}>
          <a href={site(l.path)} className={linkCls}>{l.label}</a>
        </li>
      ))}
    </Column>,

    POLICIES.length > 0 && (
      <Column key="policies" title="Policies">
        {POLICIES.map((p) => (
          <li key={p.path}>
            <a href={site(p.path)} className={linkCls}>{p.label}</a>
          </li>
        ))}
      </Column>
    ),

    <Column key="contact" title="Get in touch" className="col-span-2 sm:col-span-1">
      <li>
        <a href={site("/contact-us")} className={`${linkCls} inline-flex items-center gap-1`}>
          Contact us <ArrowUpRight size={14} className="opacity-60" />
        </a>
      </li>
      {EMAIL && (
        <li>
          <a href={`mailto:${EMAIL}`} className={`${linkCls} inline-flex items-start gap-2 [overflow-wrap:anywhere]`}>
            <Mail size={15} className="mt-[3px] shrink-0 text-white/40" />
            {EMAIL}
          </a>
        </li>
      )}
      {PHONE && (
        <li>
          <a href={`tel:${PHONE.replace(/\s+/g, "")}`} className={`${linkCls} inline-flex items-center gap-2`}>
            <Phone size={15} className="shrink-0 text-white/40" />
            {PHONE}
          </a>
        </li>
      )}
      <li>
        <a href={WEBSITE} className={`${linkCls} inline-flex items-center gap-2`}>
          <Globe size={15} className="shrink-0 text-white/40" />
          theprofessionals.network
        </a>
      </li>
      {SOCIALS.map((s) => (
        <li key={s.label}>
          <a href={s.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
            {s.label}
          </a>
        </li>
      ))}
    </Column>,
  ].filter(Boolean);

  return (
    <footer className="relative mt-16 overflow-hidden text-white" style={{ background: GRADIENT }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: DOT_TEXTURE, backgroundSize: "22px 22px", opacity: 0.6 }}
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-5 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-14">
          <div className="max-w-[380px]">
            <a href={'/'} aria-label="The Professionals Network website" className="inline-block">
              <BrandMark tone="dark" size="md" />
            </a>
            <p className="mt-5 text-[15px] leading-relaxed text-white/70">{BLURB}</p>
            <a
              href={site(COURSES[0]?.path || "/")}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-80"
            >
              Explore courses <ArrowUpRight size={16} />
            </a>
          </div>

          {/* Equal columns, with a little extra room for the contact one (email). */}
          <div
            className="grid grid-cols-2 gap-x-8 gap-y-10 sm:[grid-template-columns:var(--cols)]"
            style={{ "--cols": `repeat(${columns.length - 1}, minmax(0, 1fr)) minmax(0, 1.6fr)` }}
          >
            {columns}
          </div>
        </div>

        <div className="mt-14 grid gap-4 border-t border-white/10 pt-7 text-[13px] leading-relaxed text-white/45 md:grid-cols-3 md:gap-10">
          <p className="md:col-span-1">
            © {year} The Professionals Network is a network trademarked and operated by{" "}
            {COMPANY_URL ? (
              <a
                href={COMPANY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-white"
              >
                Rextone Digital
              </a>
            ) : (
              "Rextone Digital"
            )}
            .
          </p>
          {ADDRESS && <p>{ADDRESS}</p>}
          {COLLEGE_DISCLAIMER && <p>{COLLEGE_DISCLAIMER}</p>}
        </div>
      </div>
    </footer>
  );
}