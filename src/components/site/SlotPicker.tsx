import { useState } from "react";
import { cn } from "@/lib/utils";

function hourNum(h: number) {
  const wrapped = h % 24;
  return wrapped % 12 === 0 ? 12 : wrapped % 12;
}

function hourPeriod(h: number) {
  return h % 24 >= 12 ? "PM" : "AM";
}

/**
 * A slot card is one hour block, labelled as a range ("6 – 7 PM") so nobody
 * has to guess whether tapping "6" means starting or ending at 6. When the
 * block crosses noon/midnight both periods are shown ("11 AM – 12 PM").
 */
function slotLabel(h: number): { range: string; period: string } {
  const startPeriod = hourPeriod(h);
  const endPeriod = hourPeriod(h + 1);
  return {
    range: `${hourNum(h)} – ${hourNum(h + 1)}`,
    period: startPeriod === endPeriod ? startPeriod : `${startPeriod} – ${endPeriod}`,
  };
}

type Props = {
  occupied: Set<number>;
  /** Hours another customer is holding at the payment step right now. */
  held?: Set<number>;
  startHour: number;
  endHour: number;
  onSelect: (start: number, end: number) => void;
  openHour?: number;
  closeHour?: number;
  /** Hours before this are shown as "past" and can't be booked (today only). */
  minStartHour?: number;
  loading?: boolean;
};

const NO_HOLDS = new Set<number>();

/**
 * Bus/train-seat style hourly slot picker. Booked hours are shown struck-out and
 * disabled; free hours are tappable. Tap one hour, then another, to select a
 * contiguous range — the range can't cross a booked or past slot.
 */
export function SlotPicker({
  occupied,
  held = NO_HOLDS,
  startHour,
  endHour,
  onSelect,
  openHour = 0,
  closeHour = 24,
  minStartHour = 0,
  loading = false,
}: Props) {
  const [anchor, setAnchor] = useState<number | null>(null);

  const hours: number[] = [];
  for (let h = openHour; h < closeHour; h++) hours.push(h);

  const isFree = (h: number) => !occupied.has(h) && !held.has(h) && h >= minStartHour;
  const rangeFree = (lo: number, hi: number) => {
    for (let h = lo; h <= hi; h++) if (!isFree(h)) return false;
    return true;
  };

  function handleClick(h: number) {
    if (!isFree(h)) return;
    if (anchor === null) {
      setAnchor(h);
      onSelect(h, h + 1);
      return;
    }
    const lo = Math.min(anchor, h);
    const hi = Math.max(anchor, h);
    if (rangeFree(lo, hi)) {
      onSelect(lo, hi + 1);
      setAnchor(null);
    } else {
      setAnchor(h);
      onSelect(h, h + 1);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {hours.map((h) => (
          <div key={h} className="h-14 animate-pulse rounded-xl bg-black/5" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {hours.map((h) => {
          const booked = occupied.has(h);
          const beingBooked = !booked && held.has(h);
          const past = h < minStartHour;
          const selected = h >= startHour && h < endHour;
          const label = slotLabel(h);
          return (
            <button
              key={h}
              type="button"
              disabled={booked || beingBooked || past}
              onClick={() => handleClick(h)}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-xl border transition-colors",
                selected
                  ? "border-prime bg-prime text-prime-foreground"
                  : booked
                    ? "cursor-not-allowed border-red-100 bg-red-50 text-red-400"
                    : beingBooked
                      ? "cursor-not-allowed border-amber-200 bg-amber-50 text-amber-500"
                      : past
                        ? "cursor-not-allowed border-black/5 bg-black/5 text-black/25"
                        : "border-black/10 bg-white text-prime hover:border-prime active:scale-95",
              )}
            >
              <span
                className={cn("text-sm font-extrabold leading-tight", booked && "line-through")}
              >
                {label.range}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">
                {beingBooked ? "Being booked" : label.period}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-medium text-black/50">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-black/15 bg-white" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-prime" /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-amber-200 bg-amber-50" /> Being booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-red-100 bg-red-50" /> Booked
        </span>
      </div>
    </div>
  );
}
