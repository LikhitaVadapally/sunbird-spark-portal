import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/**
 * Returns a human-readable relative time string for an ISO datetime.
 * Examples: "a few seconds ago", "5 minutes ago", "3 hours ago", "5 days ago",
 *           "a month ago", "4 months ago", "a year ago", "2 years ago".
 * Returns '—' for invalid dates.
 */
export function toRelativeTime(isoString: string, now: Date = new Date()): string {
  const past = dayjs(isoString);
  if (!past.isValid()) return '—';
  return past.from(dayjs(now));
}

/**
 * Formats an ISO date string as `dd/MM/yyyy` in the viewer's local timezone.
 * Returns '' for missing or invalid input. Local TZ is intentional — matches the rest of the
 * app's date display (`formatBatchDisplayDate`) and shows users their own calendar day.
 */
export function formatDayMonthYear(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * A timestamp as "02 Nov 2026" in `locale` (the app language), so a date reads in the same
 * language as the page around it. Returns '' for a missing or invalid timestamp.
 */
export function formatShortDate(ms: number | undefined, locale?: string): string {
  if (!ms) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}
