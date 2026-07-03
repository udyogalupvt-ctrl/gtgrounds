import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { notifyAdmins } from "./admin-notify.functions";
import { getFirebaseAuth, getFirebaseDb } from "./firebase";
import { SportSlug } from "./venue";

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

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const db = await getFirebaseDb();
  await updateDoc(doc(db, "sportsBookings", bookingId), { status, updatedAt: serverTimestamp() });
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
