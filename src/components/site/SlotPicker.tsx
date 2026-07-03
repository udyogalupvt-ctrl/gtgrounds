import { useState } from "react";
import { cn } from "@/lib/utils";

function compactHour(h: number) {
  const hour = h % 12 === 0 ? 12 : h % 12;
  const period = h >= 12 && h < 24 ? "PM" : "AM";
  return `${hour} ${period}`;
}

type Props = {
  occupied: Set<number>;
  startHour: number;
  endHour: number;
  onSelect: (start: number, end: number) => void;
  openHour?: number;
  closeHour?: number;
  /** Hours before this are shown as "past" and can't be booked (today only). */
  minStartHour?: number;
  loading?: boolean;
};

/**
 * Bus/train-seat style hourly slot picker. Booked hours are shown struck-out and
 * disabled; free hours are tappable. Tap one hour, then another, to select a
 * contiguous range — the range can't cross a booked or past slot.
 */
export function SlotPicker({
  occupied,
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

  const isFree = (h: number) => !occupied.has(h) && h >= minStartHour;
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
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {hours.map((h) => (
          <div key={h} className="h-12 animate-pulse rounded-xl bg-black/5" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {hours.map((h) => {
          const booked = occupied.has(h);
          const past = h < minStartHour;
          const selected = h >= startHour && h < endHour;
          return (
            <button
              key={h}
              type="button"
              disabled={booked || past}
              onClick={() => handleClick(h)}
              className={cn(
                "flex h-12 items-center justify-center rounded-xl border text-xs font-bold transition-colors",
                selected
                  ? "border-prime bg-prime text-prime-foreground"
                  : booked
                    ? "cursor-not-allowed border-red-100 bg-red-50 text-red-400 line-through"
                    : past
                      ? "cursor-not-allowed border-black/5 bg-black/5 text-black/25"
                      : "border-black/10 bg-white text-prime hover:border-prime active:scale-95",
              )}
            >
              {compactHour(h)}
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
          <span className="h-3 w-3 rounded border border-red-100 bg-red-50" /> Booked
        </span>
      </div>
    </div>
  );
}
