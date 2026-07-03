import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, isAdminEmail } from "./firebase";

export type RewardSettings = {
  enabled: boolean;
  discountPercent: number;
  googleReviewUrl: string;
  promoTitle: string;
  promoBody: string;
  minCompletedBookings: number;
};

const DEFAULTS: RewardSettings = {
  enabled: true,
  discountPercent: 5,
  googleReviewUrl: "",
  promoTitle: "Rate us on Google, get a discount",
  promoBody:
    "Enjoyed your first session? Leave us a 5-star Google review and unlock a discount on your next booking.",
  minCompletedBookings: 1,
};

export async function getRewardSettings(): Promise<RewardSettings> {
  const db = await getFirebaseDb();
  const snap = await getDoc(doc(db, "venueSettings", "rewards"));
  if (!snap.exists()) return DEFAULTS;
  const d = snap.data();
  return {
    enabled: d.enabled !== false,
    discountPercent: Number(d.discountPercent ?? DEFAULTS.discountPercent),
    googleReviewUrl: d.googleReviewUrl ?? "",
    promoTitle: d.promoTitle ?? DEFAULTS.promoTitle,
    promoBody: d.promoBody ?? DEFAULTS.promoBody,
    minCompletedBookings: Number(d.minCompletedBookings ?? DEFAULTS.minCompletedBookings),
  };
}

export async function saveRewardSettings(next: RewardSettings) {
  const auth = await getFirebaseAuth();
  if (!isAdminEmail(auth.currentUser?.email)) throw new Error("Admin only.");
  const db = await getFirebaseDb();
  await setDoc(
    doc(db, "venueSettings", "rewards"),
    { ...next, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
