import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { BottomNav } from "@/components/site/BottomNav";
import { SPORTS, SportSlug, formatHour, formatINR, statusColor, statusLabel } from "@/lib/venue";
import { getBookingsByPhone, getBookingsForCurrentUser } from "@/lib/booking-store";
import { onFirebaseAuth } from "@/lib/firebase";
import { Search, Calendar } from "lucide-react";

type Booking = {
  id: string;
  sport: SportSlug;
  bookingDate: string;
  startHour: number;
  endHour: number;
  totalAmount: number;
  status: string;
  customerName: string;
  customerPhone: string;
  createdAt: string;
};

export const Route = createFileRoute("/my-bookings")({
  head: () => ({ meta: [{ title: "My Bookings — GT Grounds" }] }),
  component: MyBookings,
});

function MyBookings() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Booking[] | null>(null);

  useEffect(() => {
    let unsubscribe: undefined | (() => void);
    onFirebaseAuth(async (user) => {
      if (user) {
        setLoading(true);
        try {
          const userRows = await getBookingsForCurrentUser();
          setRows(userRows as Booking[]);
        } finally {
          setLoading(false);
        }
        return;
      }
      const saved = typeof window !== "undefined" ? localStorage.getItem("gt_phone") : null;
      if (saved) {
        setPhone(saved);
        search(saved);
      }
    }).then((fn) => {
      unsubscribe = fn;
    });
    return () => unsubscribe?.();
  }, []);

  async function search(p: string) {
    const trimmed = p.trim();
    if (!trimmed) return;
    setLoading(true);
    const data = await getBookingsByPhone(trimmed);
    setRows((data as Booking[]) ?? []);
    localStorage.setItem("gt_phone", trimmed);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      <TopNav />
      <div className="px-5 py-6">
        <h1 className="text-3xl font-extrabold tracking-tight">My Bookings</h1>
        <p className="mt-1 text-sm text-black/50">Enter the phone number you booked with.</p>

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

        <div className="mt-8">
          {loading && <p className="text-sm text-black/50">Loading…</p>}
          {rows && rows.length === 0 && (
            <div className="rounded-3xl border border-dashed border-black/10 p-10 text-center">
              <Calendar className="mx-auto mb-3 h-8 w-8 text-black/30" />
              <p className="text-sm text-black/50">No bookings yet.</p>
            </div>
          )}
          {rows && rows.length > 0 && (
            <ul className="space-y-3">
              {rows.map((b) => (
                <li key={b.id} className="rounded-2xl border border-black/5 bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold">{SPORTS[b.sport].name}</p>
                      <p className="mt-0.5 text-sm text-black/60">
                        {new Date(b.bookingDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          weekday: "short",
                        })}{" "}
                        · {formatHour(b.startHour)}–{formatHour(b.endHour)}
                      </p>
                      <p className="mt-1 text-xs font-mono text-black/40">#{b.id.slice(0, 8)}</p>
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
