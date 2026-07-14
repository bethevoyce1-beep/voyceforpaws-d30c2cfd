import { useEffect, useState } from "react";
import { normalizeStatusKey, type AcsAnimal } from "@/lib/acs.functions";

// ============================================================
// ACS euthanasia timer
//
// The euthanasia procedure *starts* at a fixed wall-clock time on the animal's
// day, in US Central (America/Chicago):
//   Mon–Fri  5:30 PM
//   Sat      12:30 PM
//   Sun      closed  → rolls forward to Monday 5:30 PM
//
// Everything below is timezone-correct regardless of the viewer's device zone:
// we read the Central calendar date, decide the start hour/minute, then convert
// that Central wall time back to a real UTC instant.
// ============================================================

const CENTRAL_TZ = "America/Chicago";

/** Central-time start-of-euthanasia for a given weekday. `null` = closed (Sun). */
function startTimeForWeekday(weekday: number): { h: number; m: number } | null {
  if (weekday === 0) return null; // Sunday — closed
  if (weekday === 6) return { h: 12, m: 30 }; // Saturday 12:30 PM
  return { h: 17, m: 30 }; // Mon–Fri 5:30 PM
}

/** Central-time calendar parts for an instant. */
function centralParts(at: Date): { y: number; mo: number; d: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    y: Number(get("year")),
    mo: Number(get("month")),
    d: Number(get("day")),
    weekday: wdMap[get("weekday")] ?? 0,
  };
}

/** America/Chicago UTC offset (minutes) at a given instant — handles DST. */
function centralOffsetMinutes(at: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL_TZ,
    timeZoneName: "shortOffset",
  });
  const name = fmt.formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT-6";
  const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!m) return -6 * 60;
  const h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  return h * 60 + (h < 0 ? -min : min);
}

/**
 * Build a UTC Date for a Central wall-clock time (y/mo/d at h:m Central),
 * accounting for the correct DST offset on that day.
 */
function centralWallToUtc(y: number, mo: number, d: number, h: number, m: number): Date {
  // First guess assuming the offset at "roughly" that time, then correct once.
  const guess = new Date(Date.UTC(y, mo - 1, d, h, m, 0));
  const off = centralOffsetMinutes(guess);
  return new Date(Date.UTC(y, mo - 1, d, h, m, 0) - off * 60_000);
}

/** Zero-pad helper for weekday lookups on a Central calendar date. */
function weekdayOf(y: number, mo: number, d: number): number {
  // getUTCDay on a noon-UTC anchor is safe from timezone rollover.
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay();
}

/**
 * Euthanasia start instant for the Central calendar day that `dayAnchor`
 * falls on. Sundays roll forward to Monday 5:30 PM Central.
 */
export function euthDeadlineFor(dayAnchor: Date): Date {
  let { y, mo, d } = centralParts(dayAnchor);
  for (let i = 0; i < 7; i++) {
    const wd = weekdayOf(y, mo, d);
    const t = startTimeForWeekday(wd);
    if (t) return centralWallToUtc(y, mo, d, t.h, t.m);
    // Closed (Sunday) → advance one Central calendar day.
    const next = new Date(Date.UTC(y, mo - 1, d + 1, 12, 0, 0));
    y = next.getUTCFullYear();
    mo = next.getUTCMonth() + 1;
    d = next.getUTCDate();
  }
  return dayAnchor;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Best-effort parse of the animal's euthanasia calendar day.
 * Prefers `euth_date` ("07/10/2026" or ISO "2026-07-10"); otherwise reads the
 * month/day out of a `public_status` like "On the clock · Jul 10".
 * Returns a noon-Central anchor Date, or null if nothing parseable.
 */
function euthDayAnchor(a: AcsAnimal, now: Date): Date | null {
  const raw = (a.euth_date ?? "").trim();
  // MM/DD/YYYY
  let m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), 12, 0, 0));
  // ISO YYYY-MM-DD
  m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));

  // Fall back to "… · Jul 10" in public_status. Year is inferred: use the
  // current Central year, rolling to next year if the date already passed.
  const status = (a.public_status ?? "").toLowerCase();
  const dm = /\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})\b/.exec(status);
  if (dm && dm[1] in MONTHS) {
    const mo = MONTHS[dm[1]];
    const day = Number(dm[2]);
    const { y } = centralParts(now);
    let anchor = new Date(Date.UTC(y, mo, day, 12, 0, 0));
    // If that day is well in the past, assume it means next year.
    if (anchor.getTime() < now.getTime() - 200 * 24 * 3_600_000) {
      anchor = new Date(Date.UTC(y + 1, mo, day, 12, 0, 0));
    }
    return anchor;
  }
  return null;
}

/**
 * The countdown target for an animal, or null if this status shows no timer.
 * - immediate → today's Central start
 * - scheduled → the euth date's Central start (from euth_date / public_status)
 * - everything else (incl. b6spt, which is "in progress") → null
 */
export function deadlineForAnimal(a: AcsAnimal, now = new Date()): Date | null {
  const key = normalizeStatusKey(a.status_key);
  if (key === "immediate") return euthDeadlineFor(now);
  if (key === "scheduled") {
    const anchor = euthDayAnchor(a, now);
    return anchor ? euthDeadlineFor(anchor) : null;
  }
  return null;
}

/**
 * The euthanasia deadline as a short Central wall-clock label, e.g. "5:30 PM CT".
 * Shown next to the countdown so no one has to do timezone math on their own
 * device clock.
 */
export function formatDeadlineClock(target: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${fmt.format(target)} CT`;
}

// ============================================================
// Escalating urgency chip — a small live badge, layered on top of (never
// replacing) the category pill/section. Colors use the brand red ramp.
// ============================================================
export type UrgencyLevel = "soon" | "under24" | "under12" | "under6" | "inprogress";

export type UrgencyChip = {
  level: UrgencyLevel;
  label: string;
  bg: string;
  text: string;
  pulse: boolean;
};

/** Map hours-until-deadline to an escalating chip. `msLeft <= 0` = in progress. */
export function urgencyFor(msLeft: number): UrgencyChip {
  const hours = msLeft / 3_600_000;
  if (msLeft <= 0) {
    return { level: "inprogress", label: "In progress — act now", bg: "#7F1D1D", text: "#FFFFFF", pulse: true };
  }
  if (hours < 6) {
    return { level: "under6", label: "Euthanasia may begin soon", bg: "#991B1B", text: "#FFFFFF", pulse: false };
  }
  if (hours < 12) {
    return { level: "under12", label: "Limited time", bg: "#DC2626", text: "#FFFFFF", pulse: false };
  }
  if (hours < 24) {
    return { level: "under24", label: "Under 24 hours", bg: "#F97316", text: "#FFFFFF", pulse: false };
  }
  return { level: "soon", label: "Needs placement soon", bg: "#FDE68A", text: "#78350F", pulse: false };
}

/** Format remaining ms as a compact ticking string, e.g. "3h 42m" / "12m 05s". */
export function formatCountdown(msLeft: number): string {
  const ms = Math.max(0, msLeft);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

/**
 * Live countdown to a target instant. Re-renders every second (so the seconds
 * tick under an hour) but is safe to display at minute granularity. Returns
 * null-ish `msLeft` when there is no target.
 */
export function useEuthCountdown(target: Date | null): { msLeft: number; hasTarget: boolean } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return { msLeft: 0, hasTarget: false };
  return { msLeft: target.getTime() - now, hasTarget: true };
}
