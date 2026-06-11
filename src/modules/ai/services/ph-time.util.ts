/**
 * Date helpers for the AI assistant. The product's users are in the
 * Philippines, so every date the model sees (and therefore repeats back to
 * users) is pre-formatted as human-readable Philippine time instead of ISO.
 */

const PH_TIME_ZONE = 'Asia/Manila';

const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: PH_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const fullFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: PH_TIME_ZONE,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** e.g. "Jun 10, 2026, 2:30 PM" (Philippine time). */
export const formatPhDateTime = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return dateTimeFmt.format(d);
};

/** e.g. "Wednesday, June 10, 2026, 2:30 PM" — for the system prompt clock. */
export const phNow = (): string => fullFmt.format(new Date());
