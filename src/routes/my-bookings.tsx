import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Calendar, CalendarClock, Check, MessageCircle, Phone, Search, X } from "lucide-react";
import type { User } from "firebase/auth";
import { TopNav } from "@/components/site/TopNav";
import { BottomNav } from "@/components/site/BottomNav";
import { SportPickerSheet } from "@/components/site/SportPickerSheet";
import { SlotPicker } from "@/components/site/SlotPicker";
import {
  CLOSE_HOUR,
  OPEN_HOUR,
  SPORTS,
  currentHourIST,
  formatDateCompact,
  formatHour,
  formatINR,
  statusColor,
  statusLabel,
  todayIsoIST,
  upcomingDaysIST,
} from "@/lib/venue";
import {
  canModifyBooking,
  cancelMyBooking,
  getAvailability,
  getBookingsByPhone,
  getBookingsForCurrentUser,
  getPaymentSettings,
  occupiedHours,
  rescheduleMyBooking,
  type SportsBooking,
} from "@/lib/booking-store";
import { onFirebaseAuth } from "@/lib/firebase";
import { getForeignHeldHours } from "@/lib/slot-holds";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({ meta: [{ title: "My Bookings — GT Grounds" }] }),
  component: MyBookings,
});

function MyBookings() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SportsBooking[] | null>(null);
  const [adminPhone, setAdminPhone] = useState("+91 81214 03183");
  const [sportPickerOpen, setSportPickerOpen] = useState(false);

  async function refresh(currentUser: User | null) {
    if (currentUser) {
      setLoading(true);
      try {
        setRows(await getBookingsForCurrentUser());
      } finally {
        setLoading(false);
      }
      return;
    }
    const saved = typeof window !== "undefined" ? localStorage.getItem("gt_phone") : null;
    if (saved) {
      setPhone(saved);
      await search(saved);
    }
  }

  useEffect(() => {
    let unsubscribe: undefined | (() => void);
    onFirebaseAuth((nextUser) => {
      setUser(nextUser);
      refresh(nextUser);
    }).then((fn) => {
      unsubscribe = fn;
    });
    getPaymentSettings()
      .then((s) => s.paymentPhone && setAdminPhone(s.paymentPhone))
      .catch(() => {});
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(p: string) {
    const trimmed = p.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      setRows((await getBookingsByPhone(trimmed)) ?? []);
      localStorage.setItem("gt_phone", trimmed);
    } finally {
      setLoading(false);
    }
  }

  const signedIn = !!user;
  const waLink = `https://wa.me/${adminPhone.replace(/[^0-9]/g, "").replace(/^(?!91)/, "91")}`;

  return (
    <div className="min-h-screen bg-white pb-32">
      <TopNav />
      <div className="mx-auto max-w-2xl px-5 py-6">
        <h1 className="text-3xl font-extrabold tracking-tight">My Bookings</h1>
        <p className="mt-1 text-sm text-black/50">
          {signedIn
            ? `Signed in as ${user?.email ?? user?.displayName ?? "your account"}`
            : "Enter the phone number you booked with."}
        </p>

        {!signedIn && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search(phone);
            }}
            className="mt-6 flex gap-2"
          >
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              maxLength={15}
              placeholder="+91 98765 43210"
              className="flex-1 rounded-2xl border border-black/10 bg-white p-4 text-base font-semibold focus:border-prime focus:outline-none"
            />
            <button className="rounded-2xl bg-prime px-5 text-white" aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
          </form>
        )}

        {!signedIn && user !== undefined && (
          <div className="mt-6 rounded-2xl border border-black/5 bg-surface p-4">
            <p className="text-sm font-bold">Need to cancel or reschedule?</p>
            <p className="mt-0.5 text-xs text-black/55">
              Contact the admin — or{" "}
              <Link to="/auth" className="font-bold text-prime underline underline-offset-2">
                sign in
              </Link>{" "}
              to manage bookings yourself in one tap.
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href={`tel:${adminPhone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-prime px-4 py-2 text-xs font-bold text-white"
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold text-prime"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </div>
          </div>
        )}

        <div className="mt-8">
          {loading && <p className="text-sm text-black/50">Loading…</p>}
          {rows && rows.length === 0 && !loading && (
            <div className="rounded-3xl border border-dashed border-black/10 p-10 text-center">
              <Calendar className="mx-auto mb-3 h-8 w-8 text-black/30" />
              <p className="text-sm text-black/50">No bookings yet.</p>
              <button
                onClick={() => setSportPickerOpen(true)}
                className="mt-4 inline-block rounded-full bg-prime px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white"
              >
                Book a slot
              </button>
            </div>
          )}
          {rows && rows.length > 0 && (
            <ul className="space-y-3">
              {rows.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  manageable={signedIn && canModifyBooking(b)}
                  onChanged={() => refresh(user ?? null)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      <SportPickerSheet open={sportPickerOpen} onClose={() => setSportPickerOpen(false)} />
      <BottomNav />
    </div>
  );
}

function BookingCard({
  booking: b,
  manageable,
  onChanged,
}: {
  booking: SportsBooking;
  manageable: boolean;
  onChanged: () => void;
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  async function doCancel() {
    setCancelling(true);
    try {
      await cancelMyBooking(b.id);
      toast.success("Booking cancelled");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel. Try again.");
    } finally {
      setCancelling(false);
      setConfirmingCancel(false);
    }
  }

  return (
    <li className="rounded-2xl border border-black/5 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{SPORTS[b.sport].name}</p>
          <p className="mt-0.5 text-sm text-black/60">
            {formatDateCompact(b.bookingDate)} · {formatHour(b.startHour)}–{formatHour(b.endHour)}
          </p>
          <p className="mt-1 font-mono text-xs text-black/40">#{b.id.slice(0, 8)}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black">{formatINR(b.totalAmount)}</p>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${statusColor(b.status)}`}
          >
            {statusLabel(b.status)}
          </span>
        </div>
      </div>

      {manageable && !rescheduling && (
        <div className="mt-3 flex gap-2 border-t border-black/5 pt-3">
          {confirmingCancel ? (
            <>
              <span className="flex items-center text-xs font-bold text-red-700">
                Cancel this booking?
              </span>
              <button
                onClick={doCancel}
                disabled={cancelling}
                className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button
                onClick={() => setConfirmingCancel(false)}
                disabled={cancelling}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold text-black/60"
              >
                Keep it
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setRescheduling(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold text-prime transition-colors hover:border-prime"
              >
                <CalendarClock className="h-3.5 w-3.5" /> Reschedule
              </button>
              <button
                onClick={() => setConfirmingCancel(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold text-black/60 transition-colors hover:border-red-300 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </>
          )}
        </div>
      )}

      {rescheduling && (
        <ReschedulePanel booking={b} onClose={() => setRescheduling(false)} onChanged={onChanged} />
      )}
    </li>
  );
}

function ReschedulePanel({
  booking: b,
  onClose,
  onChanged,
}: {
  booking: SportsBooking;
  onClose: () => void;
  onChanged: () => void;
}) {
  const days = useMemo(() => upcomingDaysIST(14), []);
  const [date, setDate] = useState(b.bookingDate >= todayIsoIST() ? b.bookingDate : todayIsoIST());
  const [startHour, setStartHour] = useState(b.startHour);
  const [endHour, setEndHour] = useState(b.endHour);
  const [others, setOthers] = useState<SportsBooking[]>([]);
  const [heldHours, setHeldHours] = useState<Set<number>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    getAvailability(b.sport, date)
      // Ignore this booking's own slot so it shows as free while moving it.
      .then((all) => {
        if (!cancelled) setOthers(all.filter((x) => x.id !== b.id));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    getForeignHeldHours(b.sport, date)
      .then((held) => {
        if (!cancelled) setHeldHours(held);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [b.id, b.sport, date]);

  const occupied = useMemo(() => occupiedHours(others), [others]);
  const pastCutoff = date === todayIsoIST() ? currentHourIST() : OPEN_HOUR;
  const hours = Math.max(0, endHour - startHour);

  async function save() {
    setSaving(true);
    try {
      const result = await rescheduleMyBooking(b.id, { bookingDate: date, startHour, endHour });
      if (result.totalAmount !== result.previousAmount) {
        toast.success(
          `Rescheduled! New total ${formatINR(result.totalAmount)} — the admin will adjust any payment difference with you.`,
        );
      } else {
        toast.success("Booking rescheduled!");
      }
      onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reschedule. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-black/50">
          Pick a new date & time
        </p>
        <button onClick={onClose} className="rounded-full p-1 text-black/40 hover:text-black">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => (
          <button
            key={d.iso}
            onClick={() => setDate(d.iso)}
            className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 transition-colors ${date === d.iso ? "border-prime bg-prime text-white" : "border-black/10 bg-white"}`}
          >
            <span className="text-[9px] font-bold uppercase opacity-70">{d.day}</span>
            <span className="text-base font-extrabold">{d.dom}</span>
          </button>
        ))}
      </div>
      <div className="mt-3">
        <SlotPicker
          occupied={occupied}
          held={heldHours}
          startHour={startHour}
          endHour={endHour}
          minStartHour={pastCutoff}
          openHour={OPEN_HOUR}
          closeHour={CLOSE_HOUR}
          loading={loadingSlots}
          onSelect={(s, e) => {
            setStartHour(s);
            setEndHour(e);
          }}
        />
      </div>
      <button
        onClick={save}
        disabled={saving || hours === 0 || loadingSlots}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-prime py-4 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-40"
      >
        {saving ? (
          "Saving…"
        ) : (
          <>
            <Check className="h-4 w-4" /> Confirm {formatDateCompact(date)} ·{" "}
            {formatHour(startHour)}–{formatHour(endHour)}
          </>
        )}
      </button>
    </div>
  );
}
