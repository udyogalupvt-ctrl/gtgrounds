import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, X } from "lucide-react";
import { SPORTS, formatINR, type SportSlug } from "@/lib/venue";
import {
  getVenueConfig,
  defaultVenueConfig,
  type VenueConfig,
} from "@/lib/venue-config-store";

import cricketImg from "@/assets/sport-cricket.jpg";
import volleyballImg from "@/assets/sport-volleyball.jpg";
import badmintonImg from "@/assets/sport-badminton.jpg";

const SPORT_IMAGES: Record<SportSlug, string> = {
  box_cricket: cricketImg,
  volleyball: volleyballImg,
  badminton: badmintonImg,
};

interface SportPickerSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SportPickerSheet({ open, onClose }: SportPickerSheetProps) {
  const navigate = useNavigate();
  const [venue, setVenue] = useState<VenueConfig>(defaultVenueConfig);
  const [venueLoaded, setVenueLoaded] = useState(false);

  useEffect(() => {
    if (open) {
      getVenueConfig()
        .then(setVenue)
        .catch(() => {})
        .finally(() => setVenueLoaded(true));
    }
  }, [open]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleSportSelect(slug: SportSlug) {
    const held = venue.holds[slug]?.onHold === true;
    if (held) return;
    onClose();
    navigate({ to: "/book/$sport", params: { sport: slug } });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile: Bottom sheet | Desktop: Centered modal */}
      <div
        className={`fixed z-50 transition-all duration-500 ease-out
          /* Mobile bottom sheet */
          inset-x-0 bottom-0 sm:inset-auto
          /* Desktop centered modal */
          sm:left-1/2 sm:top-1/2
          ${open
            ? "translate-y-0 sm:-translate-x-1/2 sm:-translate-y-1/2 opacity-100 scale-100"
            : "translate-y-full sm:translate-y-8 sm:-translate-x-1/2 sm:scale-95 opacity-0 pointer-events-none"
          }`}
        role="dialog"
        aria-modal="true"
        aria-label="Choose your sport"
      >
        <div className="w-full sm:w-[480px] max-h-[85vh] sm:max-h-[600px] overflow-hidden rounded-t-[32px] sm:rounded-3xl bg-prime text-white shadow-2xl shadow-black/40">
          {/* Handle bar (mobile) */}
          <div className="flex justify-center pt-3 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-end justify-between px-6 pt-5 pb-4">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-sport">
                The Arena
              </p>
              <h2 className="text-2xl font-extrabold tracking-tight">
                Choose Your Game
              </h2>
            </div>
            <button
              onClick={onClose}
              className="grid size-10 place-items-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Sport list */}
          <div className="space-y-3 px-6 pb-8 overflow-y-auto max-h-[calc(85vh-120px)] sm:max-h-[calc(600px-120px)]">
            {Object.values(SPORTS).map((sport, i) => {
              const held = venue.holds[sport.slug]?.onHold === true;
              return (
                <button
                  key={sport.slug}
                  onClick={() => handleSportSelect(sport.slug)}
                  disabled={held}
                  className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-3xl border p-3 text-left transition-all duration-200
                    ${held
                      ? "border-white/5 bg-white/3 opacity-50 cursor-not-allowed"
                      : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]"
                    }`}
                >
                  <img
                    src={SPORT_IMAGES[sport.slug]}
                    alt={sport.name}
                    width={96}
                    height={96}
                    loading="lazy"
                    className="size-20 shrink-0 rounded-2xl object-cover sm:size-24"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold sm:text-xl">
                      {sport.name}
                    </h3>
                    <p className="mb-2.5 truncate text-xs text-white/50">
                      {sport.tagline}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {venueLoaded ? (
                        <span className="rounded bg-sport px-2 py-1 text-[10px] font-black text-sport-foreground">
                          {formatINR(venue.prices[sport.slug])}/hr
                        </span>
                      ) : (
                        <span className="h-6 w-16 animate-pulse rounded bg-white/20" />
                      )}
                      {held ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-400/90 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-950">
                          <Lock className="h-3 w-3" /> On hold
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/40">
                          Starting from
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full border transition-transform sm:size-12
                      ${held
                        ? "border-white/10 text-white/20"
                        : "border-white/20 text-white group-hover:translate-x-1"
                      }`}
                  >
                    {held ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </span>
                  <span
                    aria-hidden
                    className="absolute right-0 top-0 p-2 font-mono text-[10px] text-white/15"
                  >
                    0{i + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
