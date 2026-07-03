import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/site/TopNav";
import { BottomNav } from "@/components/site/BottomNav";
import { MapPin, Phone, MessageCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — GT Grounds Dokiparru" }] }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-screen bg-white pb-20">
      <TopNav />
      <div className="px-5 py-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Get in touch</h1>
        <p className="mt-1 text-sm text-black/50">We reply on WhatsApp within minutes.</p>

        <div className="mt-6 grid gap-3">
          <a
            href="https://wa.me/918712143183"
            className="flex items-center gap-4 rounded-2xl border border-black/5 bg-surface p-4"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-emerald-500 text-white">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">WhatsApp</p>
              <p className="text-xs text-black/50">+91 87121 43183</p>
            </div>
          </a>
          <a
            href="tel:+918712143183"
            className="flex items-center gap-4 rounded-2xl border border-black/5 bg-surface p-4"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-prime text-white">
              <Phone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Bookings</p>
              <p className="text-xs text-black/50">+91 87121 43183</p>
            </div>
          </a>
          <a
            href="tel:+918499817867"
            className="flex items-center gap-4 rounded-2xl border border-black/5 bg-surface p-4"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-prime text-white">
              <Phone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Enquiries</p>
              <p className="text-xs text-black/50">+91 84998 17867</p>
            </div>
          </a>
          <a
            href="https://maps.google.com/?q=Dokiparru%20Andhra%20Pradesh"
            className="flex items-center gap-4 rounded-2xl border border-black/5 bg-surface p-4"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-event text-event-foreground">
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Directions</p>
              <p className="text-xs text-black/50">Near Sri Venkateswara Swamy Temple</p>
            </div>
          </a>
          <div className="flex items-center gap-4 rounded-2xl border border-black/5 bg-surface p-4">
            <span className="grid size-11 place-items-center rounded-xl bg-black/10">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Hours</p>
              <p className="text-xs text-black/50">Sports: 24 hours · Venue: By reservation</p>
            </div>
          </div>
        </div>

        <iframe
          title="Map"
          src="https://www.google.com/maps?q=Dokiparru,%20Andhra%20Pradesh&output=embed"
          className="mt-6 h-72 w-full rounded-3xl border-0"
          loading="lazy"
        />
      </div>
      <BottomNav />
    </div>
  );
}
