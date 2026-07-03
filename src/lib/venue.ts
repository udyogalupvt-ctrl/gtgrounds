export const SPORTS = {
  box_cricket: {
    slug: "box_cricket",
    name: "Box Cricket",
    tagline: "Floodlit High-Octane Turf",
    description:
      "Play under the lights on our premium artificial turf. Nets on all sides, boundary markings, and stadium-grade LED floodlights for day and night matches.",
    features: ["Pro artificial turf", "360° netting", "LED floodlights", "Free parking"],
    rules: [
      "Maximum 12 players per side",
      "No spike shoes on turf",
      "Wear appropriate sportswear",
      "Bring your own kit or rent on site",
    ],
    priceKey: "price_box_cricket" as const,
  },
  volleyball: {
    slug: "volleyball",
    name: "Volleyball",
    tagline: "Pro Sand & Hard Court",
    description:
      "Regulation-size court with professional netting and lighting for competitive matches and casual play.",
    features: [
      "Regulation net height",
      "Premium sand court",
      "Night lighting",
      "Seating for guests",
    ],
    rules: ["Max 6 players per side", "Barefoot or court shoes only", "Respect the net"],
    priceKey: "price_volleyball" as const,
  },
  badminton: {
    slug: "badminton",
    name: "Badminton",
    tagline: "Premium Indoor Court",
    description:
      "Wind-free indoor court with professional matting, ideal for singles and doubles play.",
    features: ["Anti-slip mat", "Wind-free environment", "Bright lighting", "Racket rental"],
    rules: ["Non-marking shoes only", "Bring own shuttles or buy at counter"],
    priceKey: "price_badminton" as const,
  },
} as const;

export type SportSlug = keyof typeof SPORTS;

export const SPORT_PRICES: Record<SportSlug, number> = {
  box_cricket: 800,
  volleyball: 600,
  badminton: 400,
};

export const OPEN_HOUR = 0;
export const CLOSE_HOUR = 24;

export function normalizePhone(phone: string) {
  return phone.trim().replace(/\s+/g, " ");
}

export const EVENT_TYPES = [
  "Wedding",
  "Engagement",
  "Reception",
  "Birthday",
  "Naming Ceremony",
  "Corporate Meeting",
  "Private Party",
  "Other",
];

// The venue operates in India Standard Time. All "today"/"now" logic is pinned
// to IST so the server (often UTC) and every visitor's browser agree on the
// calendar day — otherwise SSR and hydration render different dates.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

export function todayIsoIST() {
  const d = nowIST();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function currentHourIST() {
  return nowIST().getUTCHours();
}

export function upcomingDaysIST(n: number) {
  const base = nowIST();
  const out: { iso: string; day: string; dom: string; weekday: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i));
    out.push({
      iso: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
      day: WEEKDAYS_SHORT[d.getUTCDay()],
      dom: String(d.getUTCDate()),
      weekday: WEEKDAYS_LONG[d.getUTCDay()],
    });
  }
  return out;
}

// Deterministic date formatting. Intl/toLocaleDateString output differs
// between Node and browsers (ICU versions), which breaks React hydration —
// these helpers produce identical strings everywhere.
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseIsoParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** "3 Jul" */
export function formatDateShort(iso: string) {
  const { m, d } = parseIsoParts(iso);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "Thursday, 3 July" */
export function formatDateLong(iso: string) {
  const { m, d, weekday } = parseIsoParts(iso);
  return `${WEEKDAYS_LONG[weekday]}, ${d} ${MONTHS_LONG[m - 1]}`;
}

/** "Thursday, 3 July 2026" */
export function formatDateFull(iso: string) {
  const { y, m, d, weekday } = parseIsoParts(iso);
  return `${WEEKDAYS_LONG[weekday]}, ${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

export function formatHour(h: number) {
  if (h === 24) return "12:00 AM";
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${period}`;
}

export function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function isWeekend(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending_payment: "Pending Payment",
    payment_submitted: "Payment Submitted",
    under_verification: "Under Verification",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
    completed: "Completed",
  };
  return map[s] ?? s;
}

export function statusColor(s: string) {
  const map: Record<string, string> = {
    pending_payment: "bg-amber-100 text-amber-900",
    payment_submitted: "bg-blue-100 text-blue-900",
    under_verification: "bg-blue-100 text-blue-900",
    approved: "bg-emerald-100 text-emerald-900",
    rejected: "bg-red-100 text-red-900",
    cancelled: "bg-zinc-200 text-zinc-800",
    completed: "bg-emerald-100 text-emerald-900",
  };
  return map[s] ?? "bg-zinc-100 text-zinc-800";
}
