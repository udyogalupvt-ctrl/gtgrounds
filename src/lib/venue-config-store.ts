import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, isAdminEmail } from "./firebase";
import { SPORTS, SPORT_PRICES, isWeekend, type SportSlug } from "./venue";

export type SportHold = { onHold: boolean; reason: string };

/** Optional weekend surcharge — applied only when the admin switches it on. */
export type WeekendExtra = { enabled: boolean; percent: number };

export type VenueConfig = {
  prices: Record<SportSlug, number>;
  holds: Record<SportSlug, SportHold>;
  weekendExtra: WeekendExtra;
};

const SPORT_SLUGS = Object.keys(SPORTS) as SportSlug[];

export function defaultVenueConfig(): VenueConfig {
  const holds = {} as Record<SportSlug, SportHold>;
  for (const slug of SPORT_SLUGS) holds[slug] = { onHold: false, reason: "" };
  return { prices: { ...SPORT_PRICES }, holds, weekendExtra: { enabled: false, percent: 25 } };
}

/** Price multiplier for a date under this config (1 when surcharge is off or it's a weekday). */
export function weekendMultiplier(config: Pick<VenueConfig, "weekendExtra">, iso: string) {
  if (!config.weekendExtra.enabled || !isWeekend(iso)) return 1;
  return 1 + Math.max(0, config.weekendExtra.percent) / 100;
}

/**
 * Reads admin-managed pricing and availability from Firestore
 * (`venueSettings/venue`), falling back to the hard-coded defaults so the app
 * always has valid prices even before an admin saves anything.
 */
export async function getVenueConfig(): Promise<VenueConfig> {
  const config = defaultVenueConfig();
  try {
    const db = await getFirebaseDb();
    const snap = await getDoc(doc(db, "venueSettings", "venue"));
    if (!snap.exists()) return config;
    const data = snap.data();
    for (const slug of SPORT_SLUGS) {
      const price = Number(data.prices?.[slug]);
      if (Number.isFinite(price) && price > 0) config.prices[slug] = price;
      const hold = data.holds?.[slug];
      if (hold) {
        config.holds[slug] = { onHold: hold.onHold === true, reason: String(hold.reason ?? "") };
      }
    }
    if (data.weekendExtra) {
      const percent = Number(data.weekendExtra.percent);
      config.weekendExtra = {
        enabled: data.weekendExtra.enabled === true,
        percent: Number.isFinite(percent) && percent >= 0 ? percent : 25,
      };
    }
  } catch {
    // Never let a settings read break booking — fall back to defaults.
  }
  return config;
}

export async function saveVenueConfig(next: VenueConfig) {
  const auth = await getFirebaseAuth();
  if (!isAdminEmail(auth.currentUser?.email)) throw new Error("Admin access required.");
  const db = await getFirebaseDb();
  await setDoc(
    doc(db, "venueSettings", "venue"),
    {
      prices: next.prices,
      holds: next.holds,
      weekendExtra: next.weekendExtra,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
