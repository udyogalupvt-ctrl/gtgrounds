import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { notifyAdmins } from "./admin-notify.functions";
import { getFirebaseAuth, getFirebaseDb, isAdminEmail } from "./firebase";
import { getVenueConfig } from "./venue-config-store";
import { SportSlug, currentHourIST, isWeekend, todayIsoIST } from "./venue";

export type BookingStatus =
  | "pending_payment"
  | "payment_submitted"
  | "under_verification"
  | "approved"
  | "rejected"
  | "cancelled"
  | "completed";

export type SportsBooking = {
  id: string;
  sport: SportSlug;
  bookingDate: string;
  startHour: number;
  endHour: number;
  totalHours: number;
  pricePerHour: number;
  totalAmount: number;
  status: BookingStatus;
  customerName: string;
  customerPhone: string;
  notes: string | null;
  paymentProofUrl: string | null;
  userId: string | null;
  createdAt: string;
};

export type FunctionInquiry = {
  id: string;
  eventType: string;
  preferredDate: string;
  expectedGuests: number;
  customerName: string;
  customerPhone: string;
  specialRequirements: string | null;
  status: string;
  userId: string | null;
  createdAt: string;
};

export type PaymentSettings = {
  upiId: string;
  upiName: string;
  paymentPhone: string;
  qrCodeUrl: string | null;
};

const ACTIVE_STATUSES = new Set<BookingStatus>([
  "pending_payment",
  "payment_submitted",
  "under_verification",
  "approved",
]);

function timestampToIso(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }
  return typeof value === "string" ? value : new Date().toISOString();
}

function mapBooking(snap: QueryDocumentSnapshot<DocumentData>): SportsBooking {
  const d = snap.data();
  return {
    id: snap.id,
    sport: d.sport,
    bookingDate: d.bookingDate,
    startHour: Number(d.startHour),
    endHour: Number(d.endHour),
    totalHours: Number(d.totalHours),
    pricePerHour: Number(d.pricePerHour),
    totalAmount: Number(d.totalAmount),
    status: d.status ?? "pending_payment",
    customerName: d.customerName ?? "",
    customerPhone: d.customerPhone ?? "",
    notes: d.notes ?? null,
    paymentProofUrl: d.paymentProofUrl ?? null,
    userId: d.userId ?? null,
    createdAt: timestampToIso(d.createdAt),
  };
}

function mapInquiry(snap: QueryDocumentSnapshot<DocumentData>): FunctionInquiry {
  const d = snap.data();
  return {
    id: snap.id,
    eventType: d.eventType ?? "",
    preferredDate: d.preferredDate ?? "",
    expectedGuests: Number(d.expectedGuests ?? 0),
    customerName: d.customerName ?? "",
    customerPhone: d.customerPhone ?? "",
    specialRequirements: d.specialRequirements ?? null,
    status: d.status ?? "pending",
    userId: d.userId ?? null,
    createdAt: timestampToIso(d.createdAt),
  };
}

export function hasOverlap(
  startHour: number,
  endHour: number,
  bookings: Pick<SportsBooking, "startHour" | "endHour" | "status">[],
) {
  return bookings.some(
    (booking) =>
      ACTIVE_STATUSES.has(booking.status as BookingStatus) &&
      startHour < booking.endHour &&
      endHour > booking.startHour,
  );
}

/** Set of hour-slots (e.g. 20 = the 8–9 PM slot) already taken by active bookings. */
export function occupiedHours(
  bookings: Pick<SportsBooking, "startHour" | "endHour" | "status">[],
): Set<number> {
  const set = new Set<number>();
  for (const booking of bookings) {
    if (!ACTIVE_STATUSES.has(booking.status as BookingStatus)) continue;
    for (let h = booking.startHour; h < booking.endHour; h++) set.add(h);
  }
  return set;
}

export async function getAvailability(sport: SportSlug, bookingDate: string) {
  const db = await getFirebaseDb();
  const snapshot = await getDocs(
    query(
      collection(db, "sportsBookings"),
      where("sport", "==", sport),
      where("bookingDate", "==", bookingDate),
    ),
  );
  return snapshot.docs.map(mapBooking).filter((booking) => ACTIVE_STATUSES.has(booking.status));
}

export async function createSportsBooking(
  input: Omit<SportsBooking, "id" | "status" | "paymentProofUrl" | "createdAt" | "userId">,
) {
  const db = await getFirebaseDb();
  const user = (await getFirebaseAuth()).currentUser;
  const activeBookings = await getAvailability(input.sport, input.bookingDate);
  if (hasOverlap(input.startHour, input.endHour, activeBookings)) {
    throw new Error("That time overlaps another booking. Pick a different slot.");
  }
  const docRef = await addDoc(collection(db, "sportsBookings"), {
    ...input,
    userId: user?.uid ?? null,
    status: "pending_payment" satisfies BookingStatus,
    paymentProofUrl: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  void notifyAdmins({
    data: {
      kind: "booking_created",
      sport: input.sport,
      bookingDate: input.bookingDate,
      startHour: input.startHour,
      endHour: input.endHour,
      totalAmount: input.totalAmount,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
    },
  }).catch(() => {});
  return docRef.id;
}

export async function submitBookingPaymentProof(bookingId: string, paymentProofUrl: string) {
  const db = await getFirebaseDb();
  await updateDoc(doc(db, "sportsBookings", bookingId), {
    paymentProofUrl,
    status: "payment_submitted" satisfies BookingStatus,
    updatedAt: serverTimestamp(),
  });
  try {
    const snapshot = await getDoc(doc(db, "sportsBookings", bookingId));
    if (snapshot.exists()) {
      const d = snapshot.data();
      void notifyAdmins({
        data: {
          kind: "payment_submitted",
          sport: d.sport,
          bookingDate: d.bookingDate ?? "",
          totalAmount: Number(d.totalAmount ?? 0),
          customerName: d.customerName ?? "",
        },
      }).catch(() => {});
    }
  } catch {
    // Notifying admins must never block the customer's payment submission.
  }
}

export async function getBookingsByPhone(phone: string) {
  const db = await getFirebaseDb();
  const snapshot = await getDocs(
    query(collection(db, "sportsBookings"), where("customerPhone", "==", phone.trim()), limit(100)),
  );
  return snapshot.docs.map(mapBooking).sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
}

export async function getBookingsForCurrentUser() {
  const user = (await getFirebaseAuth()).currentUser;
  if (!user) return [];
  const db = await getFirebaseDb();
  const snapshot = await getDocs(
    query(collection(db, "sportsBookings"), where("userId", "==", user.uid), limit(100)),
  );
  return snapshot.docs.map(mapBooking).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createFunctionInquiry(
  input: Omit<FunctionInquiry, "id" | "status" | "createdAt" | "userId">,
) {
  const db = await getFirebaseDb();
  const user = (await getFirebaseAuth()).currentUser;
  await addDoc(collection(db, "functionInquiries"), {
    ...input,
    userId: user?.uid ?? null,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  void notifyAdmins({
    data: {
      kind: "inquiry_created",
      eventType: input.eventType,
      preferredDate: input.preferredDate,
      expectedGuests: input.expectedGuests,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
    },
  }).catch(() => {});
}

export async function getAdminBookings() {
  const db = await getFirebaseDb();
  const snapshot = await getDocs(query(collection(db, "sportsBookings"), limit(300)));
  return snapshot.docs.map(mapBooking).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAdminInquiries() {
  const db = await getFirebaseDb();
  const snapshot = await getDocs(query(collection(db, "functionInquiries"), limit(300)));
  return snapshot.docs.map(mapInquiry).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Live admin feed of sports bookings — fires immediately with the current data
 * and again on every change, so the dashboard updates the moment a customer
 * books or submits payment (no refresh). Returns the unsubscribe function.
 */
export async function subscribeAdminBookings(
  cb: (bookings: SportsBooking[]) => void,
  onError?: (error: Error) => void,
) {
  const db = await getFirebaseDb();
  return onSnapshot(
    query(collection(db, "sportsBookings"), limit(300)),
    (snapshot) => {
      cb(snapshot.docs.map(mapBooking).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    (error) => onError?.(error),
  );
}

export async function subscribeAdminInquiries(
  cb: (inquiries: FunctionInquiry[]) => void,
  onError?: (error: Error) => void,
) {
  const db = await getFirebaseDb();
  return onSnapshot(
    query(collection(db, "functionInquiries"), limit(300)),
    (snapshot) => {
      cb(snapshot.docs.map(mapInquiry).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    (error) => onError?.(error),
  );
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const db = await getFirebaseDb();
  await updateDoc(doc(db, "sportsBookings", bookingId), { status, updatedAt: serverTimestamp() });
}

/** A booking the signed-in customer may still cancel or reschedule: it's active
 *  and its start time hasn't passed yet (venue-local time). */
export function canModifyBooking(b: Pick<SportsBooking, "status" | "bookingDate" | "startHour">) {
  if (!ACTIVE_STATUSES.has(b.status)) return false;
  const today = todayIsoIST();
  if (b.bookingDate > today) return true;
  return b.bookingDate === today && b.startHour > currentHourIST();
}

/** Fetches a booking and verifies the signed-in user owns it and can still modify it. */
async function getOwnModifiableBooking(bookingId: string) {
  const user = (await getFirebaseAuth()).currentUser;
  if (!user) throw new Error("Sign in to manage your bookings.");
  const db = await getFirebaseDb();
  const snap = await getDoc(doc(db, "sportsBookings", bookingId));
  if (!snap.exists()) throw new Error("Booking not found.");
  const booking = mapBooking(snap as QueryDocumentSnapshot<DocumentData>);
  if (booking.userId !== user.uid) throw new Error("This booking belongs to another account.");
  if (!canModifyBooking(booking)) {
    throw new Error("This booking can no longer be changed. Contact the admin for help.");
  }
  return booking;
}

export async function cancelMyBooking(bookingId: string) {
  const booking = await getOwnModifiableBooking(bookingId);
  const db = await getFirebaseDb();
  await updateDoc(doc(db, "sportsBookings", bookingId), {
    status: "cancelled" satisfies BookingStatus,
    updatedAt: serverTimestamp(),
  });
  void notifyAdmins({
    data: {
      kind: "booking_cancelled",
      sport: booking.sport,
      bookingDate: booking.bookingDate,
      startHour: booking.startHour,
      endHour: booking.endHour,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
    },
  }).catch(() => {});
}

export async function rescheduleMyBooking(
  bookingId: string,
  next: { bookingDate: string; startHour: number; endHour: number },
) {
  const booking = await getOwnModifiableBooking(bookingId);
  if (next.endHour <= next.startHour) throw new Error("Choose a valid time range.");

  // The new slot must be free — ignoring this booking's own current slot.
  const active = (await getAvailability(booking.sport, next.bookingDate)).filter(
    (b) => b.id !== bookingId,
  );
  if (hasOverlap(next.startHour, next.endHour, active)) {
    throw new Error("That time overlaps another booking. Pick a different slot.");
  }

  // Reprice for the new date (weekday/weekend rates can differ).
  const config = await getVenueConfig();
  const pricePerHour = Math.round(
    config.prices[booking.sport] * (isWeekend(next.bookingDate) ? 1.25 : 1),
  );
  const totalHours = next.endHour - next.startHour;

  const db = await getFirebaseDb();
  await updateDoc(doc(db, "sportsBookings", bookingId), {
    bookingDate: next.bookingDate,
    startHour: next.startHour,
    endHour: next.endHour,
    totalHours,
    pricePerHour,
    totalAmount: totalHours * pricePerHour,
    updatedAt: serverTimestamp(),
  });
  void notifyAdmins({
    data: {
      kind: "booking_rescheduled",
      sport: booking.sport,
      oldDate: booking.bookingDate,
      oldStartHour: booking.startHour,
      oldEndHour: booking.endHour,
      bookingDate: next.bookingDate,
      startHour: next.startHour,
      endHour: next.endHour,
      totalAmount: totalHours * pricePerHour,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
    },
  }).catch(() => {});
  return { totalAmount: totalHours * pricePerHour, previousAmount: booking.totalAmount };
}

export async function deleteBooking(bookingId: string) {
  const auth = await getFirebaseAuth();
  if (!isAdminEmail(auth.currentUser?.email)) throw new Error("Admin access required.");
  const db = await getFirebaseDb();
  await deleteDoc(doc(db, "sportsBookings", bookingId));
}

/**
 * Admin books a slot directly (walk-in / phone booking). The booking is created
 * already approved and does not require payment proof. Still guards overlaps.
 */
export async function adminCreateBooking(input: {
  sport: SportSlug;
  bookingDate: string;
  startHour: number;
  endHour: number;
  pricePerHour: number;
  customerName: string;
  customerPhone: string;
}) {
  const auth = await getFirebaseAuth();
  if (!isAdminEmail(auth.currentUser?.email)) throw new Error("Admin access required.");
  const db = await getFirebaseDb();
  const active = await getAvailability(input.sport, input.bookingDate);
  if (hasOverlap(input.startHour, input.endHour, active)) {
    throw new Error("That time overlaps another booking. Pick a free slot.");
  }
  const totalHours = input.endHour - input.startHour;
  await addDoc(collection(db, "sportsBookings"), {
    sport: input.sport,
    bookingDate: input.bookingDate,
    startHour: input.startHour,
    endHour: input.endHour,
    totalHours,
    pricePerHour: input.pricePerHour,
    totalAmount: totalHours * input.pricePerHour,
    status: "approved" satisfies BookingStatus,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    notes: "Booked by admin",
    paymentProofUrl: null,
    userId: null,
    createdBy: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const db = await getFirebaseDb();
  const snapshot = await getDoc(doc(db, "venueSettings", "main"));
  if (!snapshot.exists()) {
    return {
      upiId: "jilanigt@upi",
      upiName: "Jilanis GT Grounds",
      paymentPhone: "+91 87121 43183",
      qrCodeUrl: null,
    };
  }
  const d = snapshot.data();
  return {
    upiId: d.upiId ?? "jilanigt@upi",
    upiName: d.upiName ?? "Jilanis GT Grounds",
    paymentPhone: d.paymentPhone ?? "+91 87121 43183",
    qrCodeUrl: d.qrCodeUrl ?? null,
  };
}

export async function savePaymentSettings(next: PaymentSettings) {
  const db = await getFirebaseDb();
  const { setDoc, doc: docRef, serverTimestamp: ts } = await import("firebase/firestore");
  await setDoc(docRef(db, "venueSettings", "main"), { ...next, updatedAt: ts() }, { merge: true });
}
