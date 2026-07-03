import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";

import { TopNav } from "@/components/site/TopNav";
import { BottomNav } from "@/components/site/BottomNav";
import { SPORTS, SPORT_PRICES, SportSlug, formatINR } from "@/lib/venue";
import { getVenueConfig, type SportHold } from "@/lib/venue-config-store";
import cricketImg from "@/assets/sport-cricket.jpg";
import volleyballImg from "@/assets/sport-volleyball.jpg";
import badmintonImg from "@/assets/sport-badminton.jpg";

const IMAGES: Record<SportSlug, string> = {
  box_cricket: cricketImg,
  volleyball: volleyballImg,
  badminton: badmintonImg,
};

export const Route = createFileRoute("/sports/$sport")({
  head: ({ params }) => {
    const slug = params.sport as SportSlug;
    const s = SPORTS[slug];
    return {
      meta: [
        { title: s ? `${s.name} — GT Grounds Dokiparru` : "Sport" },
        { name: "description", content: s?.description ?? "" },
      ],
    };
  },
  loader: ({ params }) => {
    const slug = params.sport as SportSlug;
    if (!(slug in SPORTS)) throw notFound();
    return { sport: slug };
  },
  component: SportPage,
  notFoundComponent: () => <div className="p-10 text-center">Sport not found</div>,
});

function SportPage() {
  const data = Route.useLoaderData() as { sport: SportSlug };
  const sport = data.sport;
  const s = SPORTS[sport];
  const [price, setPrice] = useState<number>(SPORT_PRICES[sport]);
  const [hold, setHold] = useState<SportHold | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    getVenueConfig()
      .then((config) => {
        setPrice(config.prices[sport]);
        setHold(config.holds[sport]);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [sport]);

  const isOnHold = hold?.onHold === true;

  return (
    <div className="bg-white pb-32">
      <TopNav />
      <div className="mx-auto max-w-3xl px-5 pt-4">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-sm font-semibold text-black/60"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>
      <section className="relative">
        <img
          src={IMAGES[sport]}
          alt={s.name}
          width={800}
          height={800}
          className="aspect-square w-full object-cover sm:aspect-[16/9]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-prime via-prime/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          {loaded ? (
            <span className="rounded-full bg-sport px-3 py-1 text-[10px] font-black uppercase tracking-wider text-sport-foreground">
              {formatINR(price)}/hr
            </span>
          ) : (
            <span className="inline-block h-5 w-20 animate-pulse rounded-full bg-white/25" />
          )}
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight italic">{s.name}</h1>
          <p className="mt-1 text-sm text-white/70">{s.tagline}</p>
        </div>
      </section>

      <div className="px-5 py-8">
        <p className="text-base leading-relaxed text-black/70">{s.description}</p>

        <h2 className="mt-10 mb-4 text-xs font-bold uppercase tracking-widest text-black/40">
          Features
        </h2>
        <ul className="grid gap-2">
          {s.features.map((f) => (
            <li
              key={f}
              className="flex items-center gap-3 rounded-xl border border-black/5 bg-surface p-3 text-sm font-medium"
            >
              <span className="grid size-7 place-items-center rounded-full bg-sport text-sport-foreground">
                <Check className="h-4 w-4" />
              </span>
              {f}
            </li>
          ))}
        </ul>

        <h2 className="mt-10 mb-4 text-xs font-bold uppercase tracking-widest text-black/40">
          Rules
        </h2>
        <ul className="grid gap-2 text-sm text-black/70">
          {s.rules.map((r) => (
            <li key={r} className="rounded-xl border border-black/5 p-3">
              {r}
            </li>
          ))}
        </ul>

        {isOnHold ? (
          <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-center gap-2 text-amber-800">
              <Lock className="h-5 w-5" />
              <p className="text-sm font-bold uppercase tracking-widest">Bookings on hold</p>
            </div>
            <p className="mt-2 text-sm text-amber-900">
              {hold?.reason?.trim() ||
                "This sport isn't available to book right now. Please check back soon."}
            </p>
          </div>
        ) : (
          <div className="mt-10 rounded-2xl bg-prime p-6 text-white">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
              Ready to Play?
            </p>
            <p className="mt-2 mb-6 text-2xl font-extrabold">Book your slot in seconds.</p>
            <Link
              to="/book/$sport"
              params={{ sport }}
              className="flex items-center justify-between rounded-xl bg-sport px-5 py-4 text-sm font-bold uppercase tracking-widest text-sport-foreground"
            >
              Book {s.name}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
