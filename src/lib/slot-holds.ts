import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import type { SportSlug } from "./venue";

/**
 * Movie-ticket style slot holds. When a customer reaches the payment step,
 * each hour of their range is held with one small Firestore doc
 * (slotHolds/{sport}_{date}_{hour}). Other customers see those hours as
 * "being booked" and can't take them. Holds live for 5 minutes and expire on
 * their own — an abandoned payment never blocks the slot, and a tab left open
 * on the slot screen holds nothing (holds are only taken at the payment step).
 */
const HOLD_MINUTES = 5;

export const HOLD_MINUTES_LABEL = `${HOLD_MINUTES} minutes`;

function holdDocId(sport: SportSlug, bookingDate: string, hour: number) {
  return `${sport}_${bookingDate}_${hour}`;
}

/** Anonymous per-tab-session id so a customer never blocks themselves. */
export function getHoldSessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = sessionStorage.getItem("gt_hold_session");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("gt_hold_session", id);
  }
  return id;
}

function isActiveForeignHold(
  data: { sessionId?: string; expiresAt?: Timestamp } | undefined,
  session: string,
) {
  if (!data) return false;
  if (data.sessionId === session) return false;
  return (data.expiresAt?.toMillis() ?? 0) > Date.now();
}

/**
 * Atomically holds every hour in [startHour, endHour). Throws if any hour is
 * already held by someone else; expired holds are simply overwritten.
 */
export async function acquireSlotHold(
  sport: SportSlug,
  bookingDate: string,
  startHour: number,
  endHour: number,
) {
  const db = await getFirebaseDb();
  const session = getHoldSessionId();
  const expiresAt = Timestamp.fromMillis(Date.now() + HOLD_MINUTES * 60_000);

  await runTransaction(db, async (tx) => {
    const hours: number[] = [];
    for (let h = startHour; h < endHour; h++) hours.push(h);
    const refs = hours.map((h) => doc(db, "slotHolds", holdDocId(sport, bookingDate, h)));
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    for (const snap of snaps) {
      if (snap.exists() && isActiveForeignHold(snap.data(), session)) {
        throw new Error(
          "Another customer is completing payment for this slot right now. Please pick a different time.",
        );
      }
    }
    hours.forEach((hour, i) => {
      tx.set(refs[i], { sport, bookingDate, hour, sessionId: session, expiresAt });
    });
  });
}

/** Releases this session's hold on the range (best effort; never throws). */
export async function releaseSlotHold(
  sport: SportSlug,
  bookingDate: string,
  startHour: number,
  endHour: number,
) {
  try {
    const db = await getFirebaseDb();
    const session = getHoldSessionId();
    const tasks: Promise<void>[] = [];
    for (let h = startHour; h < endHour; h++) {
      const ref = doc(db, "slotHolds", holdDocId(sport, bookingDate, h));
      tasks.push(
        getDoc(ref)
          .then((snap) => {
            // Only delete our own hold — never someone who took over after expiry.
            if (snap.exists() && snap.data().sessionId === session) return deleteDoc(ref);
          })
          .catch(() => {}),
      );
    }
    await Promise.all(tasks);
  } catch {
    // Expiry cleans up anything we couldn't delete.
  }
}

/** One-shot: hours currently held by OTHER customers for this sport + date. */
export async function getForeignHeldHours(
  sport: SportSlug,
  bookingDate: string,
): Promise<Set<number>> {
  const db = await getFirebaseDb();
  const session = getHoldSessionId();
  const snapshot = await getDocs(
    query(
      collection(db, "slotHolds"),
      where("sport", "==", sport),
      where("bookingDate", "==", bookingDate),
    ),
  );
  const held = new Set<number>();
  snapshot.forEach((snap) => {
    const data = snap.data();
    if (isActiveForeignHold(data, session)) held.add(Number(data.hour));
  });
  return held;
}

/** Live version of getForeignHeldHours — fires on every hold change. */
export async function subscribeForeignHeldHours(
  sport: SportSlug,
  bookingDate: string,
  cb: (held: Set<number>) => void,
) {
  const db = await getFirebaseDb();
  const session = getHoldSessionId();
  return onSnapshot(
    query(
      collection(db, "slotHolds"),
      where("sport", "==", sport),
      where("bookingDate", "==", bookingDate),
    ),
    (snapshot) => {
      const held = new Set<number>();
      snapshot.forEach((snap) => {
        const data = snap.data();
        if (isActiveForeignHold(data, session)) held.add(Number(data.hour));
      });
      cb(held);
    },
    () => cb(new Set()),
  );
}
