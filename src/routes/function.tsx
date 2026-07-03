import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { TopNav } from "@/components/site/TopNav";
import { BottomNav } from "@/components/site/BottomNav";
import { EVENT_TYPES } from "@/lib/venue";
import { createFunctionInquiry } from "@/lib/booking-store";
import eventImg from "@/assets/venue-event.jpg";
import { Sparkles, Users, CalendarDays, ArrowRight, Check } from "lucide-react";

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

const schema = z.object({
  event_type: z.string().min(1),
  preferred_date: z.string().min(1),
  expected_guests: z.number().int().min(10).max(5000),
  customer_name: z.string().trim().min(2).max(80),
  customer_phone: z
    .string()
    .trim()
    .regex(/^[+0-9\s-]{10,15}$/, "Invalid phone"),
  special_requirements: z.string().trim().max(500).optional(),
});

function FunctionPage() {
  const navigate = useNavigate();
  const [eventType, setEventType] = useState("");
  const [otherEventType, setOtherEventType] = useState("");

  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalEventType = eventType === "Other" ? otherEventType.trim() : eventType;
    const parsed = schema.safeParse({
      event_type: finalEventType,

      preferred_date: date,
      expected_guests: Number(guests),
      customer_name: name,
      customer_phone: phone,
      special_requirements: notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSubmitting(true);
    try {
      await createFunctionInquiry({
        eventType: parsed.data.event_type,
        preferredDate: parsed.data.preferred_date,
        expectedGuests: parsed.data.expected_guests,
        customerName: parsed.data.customer_name.trim(),
        customerPhone: parsed.data.customer_phone.trim(),
        specialRequirements: parsed.data.special_requirements?.trim() || null,
      });
    } catch (error) {
      setSubmitting(false);
      toast.error(error instanceof Error ? error.message : "Could not submit inquiry. Try again.");
      return;
    }
    setSubmitting(false);
    setDone(true);
    toast.success("Inquiry submitted! We'll be in touch soon.");
    setTimeout(() => navigate({ to: "/" }), 2500);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white pb-32">
        <TopNav />
        <div className="grid min-h-[70vh] place-items-center px-6 text-center">
          <div>
            <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-event/20 text-event">
              <Check className="h-8 w-8" />
            </div>
            <h1 className="text-serif-italic text-4xl text-prime">Thank you.</h1>
            <p className="mt-3 max-w-sm text-sm text-black/60">
              Your inquiry has been submitted. Our team will reach out on WhatsApp within 24 hours.
            </p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

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

        <h2 className="mb-6 text-2xl font-extrabold tracking-tight">Send us your requirement</h2>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-black/50">
              Event type
            </span>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              required
              className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base font-semibold focus:border-prime focus:outline-none"
            >
              <option value="">Choose event</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {eventType === "Other" && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-black/50">
                Tell us the event
              </span>
              <input
                value={otherEventType}
                onChange={(e) => setOtherEventType(e.target.value)}
                required
                maxLength={80}
                className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base font-semibold focus:border-prime focus:outline-none"
                placeholder="e.g. Sangeet, Housewarming"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-black/50">
              Preferred date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              min={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base font-semibold focus:border-prime focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-black/50">
              Expected guests
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              required
              min={10}
              max={5000}
              className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base font-semibold focus:border-prime focus:outline-none"
              placeholder="200"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-black/50">
              Full name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base font-semibold focus:border-prime focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-black/50">
              Phone (WhatsApp)
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              maxLength={15}
              inputMode="tel"
              className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base font-semibold focus:border-prime focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-black/50">
              Special requirements (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base focus:border-prime focus:outline-none"
              placeholder="Catering, decor, mandap, etc."
            />
          </label>
          <button
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-event py-5 text-sm font-bold uppercase tracking-widest text-event-foreground disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Submit Inquiry"} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>

      <BottomNav />
    </div>
  );
}
