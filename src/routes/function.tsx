import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/site/TopNav";
import { BottomNav } from "@/components/site/BottomNav";
import { CONTACT } from "@/lib/venue";
import eventImg from "@/assets/venue-event.jpg";
import { Sparkles, Users, CalendarDays, MessageCircle, Phone, MapPin } from "lucide-react";

export const Route = createFileRoute("/function")({
  head: () => ({
    meta: [
      { title: "Book the Venue — Weddings, Receptions & Events | GT Grounds" },
      {
        name: "description",
        content:
          "Reserve our luxury garden venue in Dokiparru for weddings, receptions, engagements and celebrations.",
      },
    ],
  }),
  component: FunctionPage,
});

const WHATSAPP_MESSAGE =
  "Hi Jilani's GT Grounds! I'd like to book the garden venue for an event. " +
  "Event type: ____, Date: ____, Approx guests: ____. Please share availability and pricing.";

function FunctionPage() {
  const waLink = `https://wa.me/${CONTACT.enquiries.wa}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <div className="min-h-screen bg-white pb-32">
      <TopNav />
      <section className="relative">
        <img
          src={eventImg}
          alt="Luxury garden venue"
          width={1088}
          height={1360}
          className="aspect-[4/5] w-full object-cover sm:aspect-[16/9]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-prime via-prime/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-event">
            Grand Celebrations
          </p>
          <h1 className="text-serif-italic mt-2 text-5xl leading-tight text-event">
            The Garden Venue
          </h1>
          <p className="mt-2 max-w-sm text-sm text-white/70">
            Weddings, receptions, engagements — an elegant open-air backdrop near Sri Venkateswara
            Swamy Temple.
          </p>
        </div>
      </section>

      <div className="px-5 py-8">
        <div className="mb-8 grid grid-cols-3 gap-3">
          {[
            { Icon: Users, label: "Up to 1000+", sub: "Guests" },
            { Icon: Sparkles, label: "All-in", sub: "Decor Ready" },
            { Icon: CalendarDays, label: "Any Day", sub: "Flexible" },
          ].map(({ Icon, label, sub }) => (
            <div
              key={label}
              className="rounded-2xl border border-black/5 bg-surface p-3 text-center"
            >
              <Icon className="mx-auto mb-1 h-4 w-4 text-event" />
              <p className="text-xs font-bold">{label}</p>
              <p className="text-[10px] text-black/50">{sub}</p>
            </div>
          ))}
        </div>

        {/* Event bookings are handled personally by the team — contact them directly. */}
        <div className="rounded-3xl border border-black/5 bg-surface p-6">
          <h2 className="text-2xl font-extrabold tracking-tight">Talk to our events team</h2>
          <p className="mt-2 text-sm text-black/60">
            Every celebration is custom. Message or call us with your date, guest count and needs —
            we'll share availability, pricing and a personalised plan on WhatsApp.
          </p>

          <div className="mt-6 grid gap-3">
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl bg-emerald-500 px-5 py-4 text-white transition-transform active:scale-[0.98]"
            >
              <span className="flex items-center gap-3 text-sm font-bold uppercase tracking-widest">
                <MessageCircle className="h-5 w-5" /> Enquire on WhatsApp
              </span>
              <span className="text-xs font-semibold opacity-90">{CONTACT.enquiries.display}</span>
            </a>
            <a
              href={`tel:${CONTACT.enquiries.tel}`}
              className="flex items-center justify-between rounded-2xl bg-prime px-5 py-4 text-prime-foreground transition-transform active:scale-[0.98]"
            >
              <span className="flex items-center gap-3 text-sm font-bold uppercase tracking-widest">
                <Phone className="h-5 w-5" /> Call the events team
              </span>
              <span className="text-xs font-semibold opacity-90">{CONTACT.enquiries.display}</span>
            </a>
            <a
              href={`tel:${CONTACT.bookings.tel}`}
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-5 py-4 text-prime transition-transform active:scale-[0.98]"
            >
              <span className="flex items-center gap-3 text-sm font-bold uppercase tracking-widest">
                <Phone className="h-5 w-5" /> Alternate number
              </span>
              <span className="text-xs font-semibold text-black/50">
                {CONTACT.bookings.display}
              </span>
            </a>
          </div>

          <a
            href={CONTACT.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-2 text-xs font-semibold text-black/50"
          >
            <MapPin className="h-4 w-4 text-event" /> Near Sri Venkateswara Swamy Temple, Dokiparru
          </a>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
