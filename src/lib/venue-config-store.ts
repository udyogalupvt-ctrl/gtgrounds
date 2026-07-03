import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, isAdminEmail } from "./firebase";
import { SPORTS, SPORT_PRICES, type SportSlug } from "./venue";

export type SportHold = { onHold: boolean; reason: string };

export type VenueConfig = {
  prices: Record<SportSlug, number>;
  holds: Record<SportSlug, SportHold>;
};

const SPORT_SLUGS = Object.keys(SPORTS) as SportSlug[];

export function defaultVenueConfig(): VenueConfig {
  const holds = {} as Record<SportSlug, SportHold>;
  for (const slug of SPORT_SLUGS) holds[slug] = { onHold: false, reason: "" };
  return { prices: { ...SPORT_PRICES }, holds };
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
    { prices: next.prices, holds: next.holds, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
