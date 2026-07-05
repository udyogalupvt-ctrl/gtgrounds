import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Lock,
  MapPin,
  Phone,
  Sparkles,
  Zap,
  Trophy,
  Shield,
  Users,
  Star,
  Megaphone,
} from "lucide-react";
import { TopNav } from "@/components/site/TopNav";
import { BottomNav } from "@/components/site/BottomNav";
import { SlotPicker } from "@/components/site/SlotPicker";
import { SPORTS, currentHourIST, formatDateShort, formatINR, todayIsoIST } from "@/lib/venue";
import { getAvailability, occupiedHours } from "@/lib/booking-store";
import { getPublicAnnouncements, type Announcement } from "@/lib/content-store";
import { defaultVenueConfig, getVenueConfig, type VenueConfig } from "@/lib/venue-config-store";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroImg from "@/assets/hero.jpg";
import cricketImg from "@/assets/sport-cricket.jpg";
import volleyballImg from "@/assets/sport-volleyball.jpg";
import badmintonImg from "@/assets/sport-badminton.jpg";
import eventImg from "@/assets/venue-event.jpg";
import logoUrl from "@/assets/gt-logo.png";

const SPORT_IMAGES = {
  box_cricket: cricketImg,
  volleyball: volleyballImg,
  badminton: badmintonImg,
} as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jilani's GT Grounds & Gardens — Book Sports & Events in Dokiparru" },
      {
        name: "description",
        content:
          "Premium box cricket, volleyball, badminton turf and luxury garden venue near Sri Venkateswara Swamy Temple, Dokiparru. Book in seconds.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const today = todayIsoIST();
  const nowHour = currentHourIST();
  const [quickSport, setQuickSport] = useState<keyof typeof SPORTS>("box_cricket");
  const [quickStart, setQuickStart] = useState(Math.min(23, Math.max(nowHour, 6)));
  const [quickEnd, setQuickEnd] = useState(Math.min(24, Math.max(nowHour, 6) + 2));
  const [venue, setVenue] = useState<VenueConfig>(defaultVenueConfig);
  const [venueLoaded, setVenueLoaded] = useState(false);
  const [quickOccupied, setQuickOccupied] = useState<Set<number>>(new Set());
  const [slotsLoading, setSlotsLoading] = useState(true);

  useEffect(() => {
    getVenueConfig()
      .then(setVenue)
      .catch(() => {})
      .finally(() => setVenueLoaded(true));
  }, []);

  // Today's availability for the selected sport, so the picker shows free slots.
  useEffect(() => {
    let cancelled = false;
    setSlotsLoading(true);
    getAvailability(quickSport, today)
      .then((rows) => {
        if (!cancelled) setQuickOccupied(occupiedHours(rows));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quickSport, today]);

  const quickHeld = venue.holds[quickSport]?.onHold === true;
  const quickIsValid = quickEnd > quickStart && !quickHeld;
  const quickHours = quickEnd > quickStart ? quickEnd - quickStart : 0;
  const quickTotal = quickHours * venue.prices[quickSport];

  return (
    <div className="bg-white text-prime">
      <TopNav />

      {/* HERO */}
      <section className="relative px-5 pt-8 pb-14">
        <span className="inline-block rounded-full bg-sport/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-prime">
          Premium Sports &amp; Events
        </span>
        <h1 className="mt-4 text-[44px] font-extrabold leading-[0.92] tracking-tight italic sm:text-6xl">
          WHERE ENERGY
          <br />
          MEETS <span className="text-serif-italic text-event">elegance.</span>
        </h1>
        <p className="mt-5 max-w-md text-sm text-black/60 sm:text-base">
          A premium multi-sport arena and luxury event garden — steps from Sri Venkateswara Swamy
          Temple, Dokiparru.
        </p>

        <div className="mt-8 relative">
          <img
            src={heroImg}
            alt="Aerial view of Jilani's GT Grounds sports turf and event garden at dusk"
            width={1280}
            height={1600}
            className="aspect-[4/5] w-full rounded-3xl object-cover ring-1 ring-black/5 sm:aspect-[16/10]"
          />
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <div className="pointer-events-none absolute bottom-5 left-5 right-5 flex items-center justify-between text-white">
            <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-sport animate-pulse" />
              Open 24 Hours · Slots Live
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            to="/book/$sport"
            params={{ sport: "box_cricket" }}
            className="rounded-2xl bg-prime py-5 text-center text-sm font-bold uppercase tracking-widest text-prime-foreground shadow-xl shadow-black/10 transition-transform active:scale-95"
          >
            Book Sports
          </Link>
          <Link
            to="/function"
            className="rounded-2xl border-2 border-prime bg-white py-5 text-center text-sm font-bold uppercase tracking-widest transition-transform active:scale-95"
          >
            Book Venue
          </Link>
        </div>
      </section>

      <LatestAnnouncements />

      {/* SPORTS SELECTION - dark section */}
      <section className="rounded-t-[40px] bg-prime px-5 py-16 text-white">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-sport">The Arena</p>
            <h2 className="text-3xl font-extrabold tracking-tight">Choose Your Game</h2>
          </div>
          <span className="text-xs text-white/40">01 / 03</span>
        </div>

        <div className="space-y-4">
          {Object.values(SPORTS).map((sport, i) => (
            <Link
              key={sport.slug}
              to="/sports/$sport"
              params={{ sport: sport.slug }}
              className="group relative flex items-center gap-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
            >
              <img
                src={SPORT_IMAGES[sport.slug]}
                alt={sport.name}
                width={800}
                height={800}
                loading="lazy"
                className="size-24 shrink-0 rounded-2xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xl font-bold">{sport.name}</h3>
                <p className="mb-3 truncate text-xs text-white/50">{sport.tagline}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {venueLoaded ? (
                    <span className="rounded bg-sport px-2 py-1 text-[10px] font-black text-sport-foreground">
                      {formatINR(venue.prices[sport.slug])}/hr
                    </span>
                  ) : (
                    <span className="h-6 w-16 animate-pulse rounded bg-white/20" />
                  )}
                  {venue.holds[sport.slug]?.onHold ? (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-400/90 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-950">
                      <Lock className="h-3 w-3" /> On hold
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/40">Starting from</span>
                  )}
                </div>
              </div>
              <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/20 text-white transition-transform group-hover:translate-x-1">
                <ArrowRight className="h-4 w-4" />
              </span>
              <span className="sr-only">{`View ${sport.name}`}</span>
              <span
                aria-hidden
                className="absolute right-0 top-0 text-[10px] font-mono text-white/20 p-2"
              >
                0{i + 1}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* QUICK BOOK PREVIEW */}
      <section className="bg-white px-5 py-16">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-event">
          Instant Access
        </p>
        <h2 className="mb-8 text-3xl font-bold tracking-tight">Book in Under a Minute</h2>

        <div className="rounded-3xl bg-surface p-6">
          <div className="mb-4 grid grid-cols-3 gap-2">
            {Object.values(SPORTS).map((sport) => (
              <button
                key={sport.slug}
                onClick={() => setQuickSport(sport.slug)}
                className={`rounded-2xl border p-3 text-xs font-black ${quickSport === sport.slug ? "border-prime bg-prime text-white" : "border-black/5 bg-white text-prime"}`}
              >
                {sport.name.replace("Box ", "")}
              </button>
            ))}
          </div>
          {!quickHeld && (
            <div className="mb-6 rounded-2xl border border-black/5 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-black/40">
                  Today · {formatDateShort(today)} — tap start, then end
                </span>
                <span className="text-[10px] font-bold uppercase text-black/40">
                  {quickHours > 0 ? `${quickHours}h selected` : "Pick a slot"}
                </span>
              </div>
              <SlotPicker
                occupied={quickOccupied}
                startHour={quickStart}
                endHour={quickEnd}
                minStartHour={nowHour}
                loading={slotsLoading}
                onSelect={(s, e) => {
                  setQuickStart(s);
                  setQuickEnd(e);
                }}
              />
            </div>
          )}
          {quickHeld && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              <Lock className="h-4 w-4 shrink-0" />
              {venue.holds[quickSport]?.reason?.trim() ||
                `${SPORTS[quickSport].name} bookings are on hold right now.`}
            </div>
          )}
          <div className="flex items-center justify-between rounded-2xl bg-prime p-4 text-white">
            <div>
              <p className="text-[10px] font-bold text-white/50">TOTAL AMOUNT</p>
              <p className="text-xl font-black italic">
                {quickHeld
                  ? "On hold"
                  : !venueLoaded
                    ? "…"
                    : quickEnd > quickStart
                      ? formatINR(quickTotal)
                      : "Select range"}
              </p>
            </div>
            <button
              disabled={!quickIsValid}
              onClick={() =>
                navigate({
                  to: "/book/$sport",
                  params: { sport: quickSport },
                  search: { start: quickStart, end: quickEnd },
                })
              }
              className="rounded-xl bg-sport px-6 py-3 text-xs font-bold uppercase tracking-tight text-sport-foreground disabled:opacity-40"
            >
              Start Booking
            </button>
          </div>
        </div>
      </section>

      {/* EVENT VENUE */}
      <section className="px-5 pb-16">
        <div className="relative flex min-h-[520px] flex-col justify-end overflow-hidden rounded-[40px] bg-prime p-8">
          <img
            src={eventImg}
            alt="Luxury garden venue set up for a wedding"
            width={1088}
            height={1360}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-prime via-prime/40 to-transparent" />
          <div className="relative z-10">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-event">
              Grand Celebrations
            </p>
            <h2 className="text-serif-italic mb-3 text-4xl leading-tight text-event">
              Crafting Your
              <br />
              Perfect Moment
            </h2>
            <p className="mb-8 max-w-xs text-sm text-white/70">
              Weddings, receptions, engagements, birthdays — our gardens are the serene backdrop for
              life's biggest celebrations.
            </p>
            <Link
              to="/function"
              className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-white"
            >
              Explore Venue
              <span className="grid size-10 place-items-center rounded-full border border-white/25">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="bg-surface px-5 py-16">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-black/40">
          Why GT Grounds
        </p>
        <h2 className="mb-10 text-3xl font-extrabold tracking-tight">
          Built for champions.
          <br />
          Loved by families.
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            {
              Icon: MapPin,
              title: "Sacred Proximity",
              body: "Steps from Sri Venkateswara Swamy Temple — perfect for temple-visit gatherings.",
            },
            {
              Icon: Zap,
              title: "Day & Night Ready",
              body: "Pro-grade LED floodlighting so the action never stops after dark.",
            },
            {
              Icon: Shield,
              title: "Family Friendly",
              body: "Clean seating, drinking water, hygienic restrooms designed for comfort.",
            },
            {
              Icon: Trophy,
              title: "Pro Facilities",
              body: "Turf, nets, sand, and courts maintained to tournament standards.",
            },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-black/5 bg-white p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-sport/20 text-prime">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm text-black/60">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-5 py-16">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-black/40">
          Player Voices
        </p>
        <h2 className="mb-8 text-3xl font-extrabold tracking-tight">Loved locally.</h2>
        <TestimonialsMarquee />
      </section>

      {/* LOCATION */}
      <section className="bg-surface px-5 py-16">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-black/40">Find Us</p>
        <h2 className="mb-6 text-3xl font-extrabold tracking-tight">Dokiparru, AP</h2>
        <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm">
          <iframe
            title="Location map"
            src="https://www.google.com/maps?q=Dokiparru,%20Andhra%20Pradesh&output=embed"
            className="h-72 w-full border-0"
            loading="lazy"
          />
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                Address
              </p>
              <p className="mt-1 text-sm font-semibold leading-relaxed">
                Near Sri Venkateswara Swamy Temple
                <br />
                Dokiparru, Andhra Pradesh
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Hours</p>
              <p className="mt-1 text-sm font-semibold">Sports: Open 24 hours</p>
              <p className="text-sm font-semibold">Venue: By reservation</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 py-16">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-black/40">FAQ</p>
        <h2 className="mb-6 text-3xl font-extrabold tracking-tight">Good to know.</h2>
        <Accordion type="single" collapsible className="w-full">
          {[
            {
              q: "How do I confirm my booking?",
              a: "Select your slot, pay via UPI, and upload the payment screenshot. Our team verifies within a few hours and confirms via WhatsApp.",
            },
            {
              q: "Can I book multiple hours?",
              a: "Yes — pick a start and end time. The system calculates total hours and price automatically.",
            },
            {
              q: "What if I need to cancel?",
              a: "Call us at least 4 hours before your slot. Cancellation policy is discussed at booking.",
            },
            {
              q: "Do you provide equipment?",
              a: "Basic equipment is available on rent at the counter for a small fee.",
            },
            {
              q: "Is the venue suitable for large weddings?",
              a: "Absolutely. Our garden comfortably hosts up to 1000+ guests with ample parking.",
            },
          ].map(({ q, a }) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger className="text-left text-base font-semibold">{q}</AccordionTrigger>
              <AccordionContent className="text-sm text-black/60">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* FOOTER */}
      <footer className="bg-prime px-5 pt-16 pb-32 text-white">
        <div className="mb-8 flex items-center gap-3">
          <img
            src={logoUrl}
            alt="GT Grounds logo"
            width={56}
            height={56}
            className="size-14 rounded-full bg-white/5 object-contain p-1 ring-1 ring-white/10"
          />
          <div>
            <p className="text-2xl font-extrabold tracking-tight">Jilani's GT Grounds</p>
            <p className="text-serif-italic text-sm text-event/90">
              Where every celebration becomes a beautiful memory
            </p>
          </div>
        </div>
        <div className="mb-8 grid gap-3">
          <a
            href="https://wa.me/918712143183"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <span className="flex items-center gap-3 text-sm font-bold">
              <Users className="h-4 w-4 text-sport" /> WhatsApp
            </span>
            <span className="text-[11px] font-mono uppercase text-sport">+91 87121 43183</span>
          </a>
          <a
            href="tel:+918712143183"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <span className="flex items-center gap-3 text-sm font-bold">
              <Phone className="h-4 w-4 text-sport" /> Bookings
            </span>
            <span className="text-[11px] font-mono uppercase text-white/70">+91 87121 43183</span>
          </a>
          <a
            href="tel:+918499817867"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <span className="flex items-center gap-3 text-sm font-bold">
              <Phone className="h-4 w-4 text-sport" /> Enquiries
            </span>
            <span className="text-[11px] font-mono uppercase text-white/70">+91 84998 17867</span>
          </a>
          <a
            href="https://maps.google.com/?q=Dokiparru%20Andhra%20Pradesh"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <span className="flex items-center gap-3 text-sm font-bold">
              <MapPin className="h-4 w-4 text-sport" /> Dokiparru, AP
            </span>
            <span className="text-[10px] font-mono uppercase text-white/50">Maps</span>
          </a>
        </div>
        <div className="mb-8 grid grid-cols-2 gap-2 text-[11px] text-white/60">
          {[
            "Cricket Tournaments",
            "Volleyball Matches",
            "Badminton Courts",
            "Corporate Sports Days",
            "Wedding Ceremonies",
            "Reception Parties",
            "Birthday Parties",
            "Family Reunions",
            "Cultural Festivals",
            "Garden Gatherings",
          ].map((s) => (
            <span key={s} className="rounded-full border border-white/10 px-3 py-1.5 text-center">
              {s}
            </span>
          ))}
        </div>
        <div className="border-t border-white/10 pt-6 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
            Spacious Grounds · Lush Green Lawns · Premium Facilities · Ample Parking
          </p>
          <p className="mt-5 text-xs text-white/60">
            © {new Date().getFullYear()} Jilani's GT Grounds &amp; Gardens. All Rights Reserved.
          </p>
          <p className="mt-1 text-xs text-white/50">
            Designed &amp; Developed By{" "}
            <a
              href="https://www.thedreamteamservices.com/"
              target="_blank"
              rel="noreferrer"
              className="font-bold tracking-wide text-sport transition-colors hover:text-white hover:underline"
            >
              DREAM TEAM SERVICES
            </a>
          </p>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}

function LatestAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    getPublicAnnouncements()
      .then((announcements) => setItems(announcements.slice(0, 2)))
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="px-5 pb-12">
      <div className="rounded-3xl border border-black/5 bg-sport/20 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-white text-prime shadow-sm">
              <Megaphone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                Latest Updates
              </p>
              <h2 className="text-lg font-extrabold">Announcements</h2>
            </div>
          </div>
          <Link
            to="/announcements"
            className="text-[10px] font-black uppercase tracking-widest text-prime/70"
          >
            View all
          </Link>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-black/35">
                {item.priority}
              </p>
              <h3 className="mt-1 font-extrabold">{item.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-black/60">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsMarquee() {
  const items = [
    {
      name: "Ravi K.",
      quote: "Best turf in the area. Booking through the app takes under a minute.",
      rating: 5,
    },
    {
      name: "Priya S.",
      quote: "Held my sister's engagement here — the garden is magical at night.",
      rating: 5,
    },
    {
      name: "Sandeep M.",
      quote: "Clean, well-lit, safe. My weekend cricket group plays here every Sunday.",
      rating: 5,
    },
    {
      name: "Ayesha R.",
      quote: "The floodlights are stadium-grade. Night matches feel professional.",
      rating: 5,
    },
    {
      name: "Karthik V.",
      quote: "Booked in a minute. Staff is warm, courts spotless. Recommended.",
      rating: 5,
    },
  ];
  const [paused, setPaused] = useState(false);
  const doubled = [...items, ...items];
  return (
    <div
      className="no-scrollbar relative -mx-5 overflow-x-auto px-5"
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
    >
      <div
        className="marquee-track flex w-max gap-4"
        style={{ animationPlayState: paused ? "paused" : "running" }}
      >
        {doubled.map((t, i) => (
          <blockquote
            key={`${t.name}-${i}`}
            className="w-[300px] shrink-0 rounded-2xl border border-black/5 bg-surface p-6 sm:w-[360px]"
          >
            <div className="mb-3 flex gap-0.5 text-event">
              {Array.from({ length: t.rating }).map((_, j) => (
                <Star key={j} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="text-sm leading-relaxed">"{t.quote}"</p>
            <footer className="mt-4 text-xs font-bold uppercase tracking-wider text-black/50">
              — {t.name}
            </footer>
          </blockquote>
        ))}
      </div>
    </div>
  );
}

// Suppress unused import warning for Sparkles
void Sparkles;
