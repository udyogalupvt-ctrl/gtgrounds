import { useMemo, useState } from "react";
import { toast } from "sonner";
import { adminCreateBooking, occupiedHours, type SportsBooking } from "@/lib/booking-store";
import { SPORTS, SportSlug, currentHourIST, formatHour, formatINR, todayIsoIST } from "@/lib/venue";

function compactHour(h: number) {
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${h >= 12 ? "p" : "a"}`;
}

type Props = {
  bookings: SportsBooking[];
  prices: Record<SportSlug, number>;
};

/**
 * Today's slot board for the admin: one row of hourly cells per sport showing
 * which are booked (with the customer's name) and which are free. Tapping a
 * free cell opens a quick form to book a walk-in for that slot.
 */
export function AdminTodaySlots({ bookings, prices }: Props) {
  const today = todayIsoIST();
  const nowHour = currentHourIST();
  const [add, setAdd] = useState<{ sport: SportSlug; start: number } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [endHour, setEndHour] = useState(0);
  const [saving, setSaving] = useState(false);

  const perSport = useMemo(() => {
    const map = {} as Record<SportSlug, { occupied: Set<number>; labels: Map<number, string> }>;
    const todaysAll = bookings.filter((b) => b.bookingDate === today);
    const occupiedAll = occupiedHours(todaysAll);
    const labelsAll = new Map<number, string>();
    for (const b of todaysAll) {
      for (let h = b.startHour; h < b.endHour; h++) {
        labelsAll.set(h, `${b.customerName || "Booked"} (${SPORTS[b.sport].name})`);
      }
    }

    for (const slug of Object.keys(SPORTS) as SportSlug[]) {
      map[slug] = { occupied: occupiedAll, labels: labelsAll };
    }
    return map;
  }, [bookings, today]);

  function openAdd(sport: SportSlug, start: number) {
    setAdd({ sport, start });
    setEndHour(start + 1);
    setName("");
    setPhone("");
  }

  // Latest end hour that keeps the range free (stops at the next booked/expired slot).
  function maxEndFor(sport: SportSlug, start: number) {
    const { occupied } = perSport[sport];
    let end = start + 1;
    while (end < 24 && !occupied.has(end)) end += 1;
    return end;
  }

  async function submit() {
    if (!add) return;
    if (name.trim().length < 2) return toast.error("Enter the customer's name.");
    if (!/^[+0-9\s-]{10,15}$/.test(phone.trim())) return toast.error("Enter a valid phone number.");
    setSaving(true);
    try {
      await adminCreateBooking({
        sport: add.sport,
        bookingDate: today,
        startHour: add.start,
        endHour,
        pricePerHour: prices[add.sport],
        customerName: name.trim(),
        customerPhone: phone.trim(),
      });
      toast.success("Slot booked");
      setAdd(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not book slot");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-black/5 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-extrabold uppercase tracking-wider">Today's slots</h3>
        <span className="text-[11px] font-medium text-black/40">
          Tap a free slot to book a walk-in
        </span>
      </div>

      <div className="space-y-4">
        {(Object.keys(SPORTS) as SportSlug[]).map((slug) => {
          const { occupied, labels } = perSport[slug];
          return (
            <div key={slug}>
              <p className="mb-1.5 text-xs font-bold text-black/60">
                {SPORTS[slug].name}{" "}
                <span className="font-normal text-black/35">· {formatINR(prices[slug])}/hr</span>
              </p>
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
                {Array.from({ length: 24 }, (_, h) => h).map((h) => {
                  const booked = occupied.has(h);
                  const past = h < nowHour;
                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={booked || past}
                      onClick={() => openAdd(slug, h)}
                      title={
                        booked
                          ? `${labels.get(h)} · ${formatHour(h)}–${formatHour(h + 1)}`
                          : `${formatHour(h)}–${formatHour(h + 1)}`
                      }
                      className={`flex h-9 flex-col items-center justify-center rounded-md text-[10px] font-bold leading-none transition-colors ${
                        booked
                          ? "cursor-not-allowed bg-red-100 text-red-600"
                          : past
                            ? "cursor-not-allowed bg-black/[0.03] text-black/25"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {compactHour(h)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {add && (
        <div className="mt-4 rounded-2xl border border-prime/20 bg-surface p-4">
          <p className="mb-3 text-sm font-bold">
            Book {SPORTS[add.sport].name} · {formatHour(add.start)}–{formatHour(endHour)} ·{" "}
            {formatINR((endHour - add.start) * prices[add.sport])}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              maxLength={80}
              className="rounded-xl border border-black/10 bg-white p-3 text-sm focus:border-prime focus:outline-none"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              maxLength={15}
              inputMode="tel"
              className="rounded-xl border border-black/10 bg-white p-3 text-sm focus:border-prime focus:outline-none"
            />
          </div>
          <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-black/50">
            End time
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-normal text-prime focus:border-prime focus:outline-none"
            >
              {Array.from(
                { length: maxEndFor(add.sport, add.start) - add.start },
                (_, i) => add.start + 1 + i,
              ).map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 flex gap-2">
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 rounded-xl bg-prime py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
            >
              {saving ? "Booking…" : "Confirm booking"}
            </button>
            <button
              onClick={() => setAdd(null)}
              disabled={saving}
              className="rounded-xl border border-black/10 px-4 py-3 text-xs font-bold text-black/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
