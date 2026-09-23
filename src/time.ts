export interface YMD {
  y: number;
  m: number;
  d: number;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export function kolkataParts(now = new Date()): YMD & { weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const y = Number(parts.year);
  const m = Number(parts.month);
  const d = Number(parts.day);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, weekday };
}

export function addDays(base: YMD, days: number): YMD {
  const dt = new Date(Date.UTC(base.y, base.m - 1, base.d) + days * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function weekdayOf(date: YMD): number {
  return new Date(Date.UTC(date.y, date.m - 1, date.d)).getUTCDay();
}

export function isoInKolkata(date: YMD, hours: number, minutes: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.y}-${p(date.m)}-${p(date.d)}T${p(hours)}:${p(minutes)}:00+05:30`;
}

export function sameDay(a: YMD, b: YMD): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

export function ymdFromIso(iso: string): YMD {
  const [date] = iso.split("T");
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

export function clockFromIso(iso: string): { hours: number; minutes: number } {
  const match = iso.match(/T(\d{2}):(\d{2})/);
  return { hours: Number(match?.[1] ?? 0), minutes: Number(match?.[2] ?? 0) };
}

export function formatDayLabel(date: YMD, now = new Date()): string {
  const today = kolkataParts(now);
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, addDays(today, 1))) return "Tomorrow";
  const name = WEEKDAYS[weekdayOf(date)];
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.m - 1];
  return `${name.slice(0, 1).toUpperCase()}${name.slice(1, 3)} ${date.d} ${month}`;
}

export function formatClock(hours: number, minutes: number): string {
  const suffix = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatDue(iso: string, now = new Date()): string {
  const date = ymdFromIso(iso);
  const clock = clockFromIso(iso);
  return `${formatDayLabel(date, now)} · ${formatClock(clock.hours, clock.minutes)}`;
}

export function formatStamp(iso: string): string {
  return formatDue(iso);
}

export function headerDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now);
}

export function parseWhen(text: string, now = new Date()): { iso: string; label: string } | null {
  const t = text.toLowerCase();
  const today = kolkataParts(now);
  let day: YMD | null = null;

  if (/\bday after tomorrow\b/.test(t)) day = addDays(today, 2);
  else if (/\btomorrow\b/.test(t)) day = addDays(today, 1);
  else if (/\btoday\b/.test(t)) day = today;
  else if (/\bnext week\b/.test(t)) day = addDays(today, 7);
  else {
    const inDays = t.match(/\bin\s+(\d+)\s+days?\b/);
    if (inDays) day = addDays(today, Number(inDays[1]));
    else {
      for (let i = 0; i < WEEKDAYS.length; i += 1) {
        const name = WEEKDAYS[i];
        if (new RegExp(`\\b${name}\\b`).test(t)) {
          let delta = (i - today.weekday + 7) % 7;
          if (delta === 0 && /\bnext\b/.test(t)) delta = 7;
          day = addDays(today, delta);
          break;
        }
      }
    }
  }

  const hasPartOfDay = /\b(morning|afternoon|evening|eod|end of day)\b/.test(t);
  const at = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!day && (hasPartOfDay || at)) day = today;
  if (!day) return null;

  let hours = 10;
  let minutes = 0;
  if (at) {
    hours = Number(at[1]);
    minutes = at[2] ? Number(at[2]) : 0;
    if (at[3] === "pm" && hours < 12) hours += 12;
    if (at[3] === "am" && hours === 12) hours = 0;
    if (!at[3] && hours >= 1 && hours <= 7) hours += 12;
  } else if (/\bevening\b/.test(t)) hours = 17;
  else if (/\bafternoon\b/.test(t)) hours = 14;
  else if (/\beod\b|\bend of day\b/.test(t)) hours = 18;
  else hours = 10;

  const iso = isoInKolkata(day, hours, minutes);
  return { iso, label: formatDue(iso, now) };
}

export function toDateTimeLocal(iso: string): string {
  const date = ymdFromIso(iso);
  const clock = clockFromIso(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.y}-${p(date.m)}-${p(date.d)}T${p(clock.hours)}:${p(clock.minutes)}`;
}

export function fromDateTimeLocal(value: string): string {
  return value.length === 16 ? `${value}:00+05:30` : value;
}
