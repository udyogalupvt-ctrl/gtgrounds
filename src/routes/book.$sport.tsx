import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock, Phone, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { TopNav } from "@/components/site/TopNav";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { uploadPaymentProof } from "@/lib/cloudinary";
import {
  createSportsBooking,
  getAvailability,
  getPaymentSettings,
  hasOverlap,
  submitBookingPaymentProof,
  type PaymentSettings,
  type SportsBooking,
} from "@/lib/booking-store";
import {
  CLOSE_HOUR,
  OPEN_HOUR,
  SPORTS,
  SPORT_PRICES,
  SportSlug,
  currentHourIST,
  formatDateFull,
  formatDateLong,
  formatDateShort,
  formatHour,
  formatINR,
  isWeekend,
  normalizePhone,
  todayIsoIST,
  upcomingDaysIST,
} from "@/lib/venue";

export const Route = createFileRoute("/book/$sport")({
  head: ({ params }) => {
    const slug = params.sport as SportSlug;
    return { meta: [{ title: `Book ${SPORTS[slug]?.name ?? "Sport"} — GT Grounds` }] };
  },
  loader: ({ params }) => {
    const slug = params.sport as SportSlug;
    if (!(slug in SPORTS)) throw notFound();
    return { sport: slug };
  },
  validateSearch: (search: Record<string, unknown>): { start?: number; end?: number } => {
    const start = Number(search.start);
    const end = Number(search.end);
    return {
      start: Number.isFinite(start) && start >= OPEN_HOUR && start < CLOSE_HOUR ? start : undefined,
      end: Number.isFinite(end) && end > OPEN_HOUR && end <= CLOSE_HOUR ? end : undefined,
    };
  },
  component: BookingPage,
});

type Step = 1 | 2 | 3 | 4;
const timeOptions = Array.from({ length: CLOSE_HOUR - OPEN_HOUR + 1 }, (_, i) => OPEN_HOUR + i);

function toIsoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9\s-]{10,15}$/, "Enter a valid phone number"),
  notes: z.string().trim().max(300).optional(),
});

function BookingPage() {
  const data = Route.useLoaderData() as { sport: SportSlug };
  const search = Route.useSearch();
  const sport = data.sport;
  const s = SPORTS[sport];
  const navigate = useNavigate();

  const todayIso = todayIsoIST();
  const [step, setStep] = useState<Step>(1);
  const [date, setDate] = useState(todayIso);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // upcoming hour helper for today (venue-local time)
  function upcomingHourFor(iso: string) {
    if (iso !== todayIsoIST()) return 19;
    const nowH = currentHourIST() + 1;
    return Math.min(CLOSE_HOUR - 1, Math.max(OPEN_HOUR, nowH));
  }

  const [startHour, setStartHour] = useState(() => {
    if (search.start !== undefined) return search.start;
    return upcomingHourFor(todayIso);
  });
  const [endHour, setEndHour] = useState(() => {
    const s0 = search.start ?? upcomingHourFor(todayIso);
    return search.end && search.end > s0 ? search.end : Math.min(CLOSE_HOUR, s0 + 1);
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [bookings, setBookings] = useState<SportsBooking[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [creating, setCreating] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);

  const weekendMult = isWeekend(date) ? 1.25 : 1;
  const pricePerHour = Math.round(SPORT_PRICES[sport] * weekendMult);
  const hours = Math.max(0, endHour - startHour);
  const total = hours * pricePerHour;
  const overlaps = hasOverlap(startHour, endHour, bookings);

  // when date changes, if it's today and start hour is in the past, bump to upcoming hour
  useEffect(() => {
    const min = upcomingHourFor(date);
    if (startHour < min) {
      setStartHour(min);
      if (endHour <= min) setEndHour(Math.min(CLOSE_HOUR, min + 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    getAvailability(sport, date)
      .then((rows) => {
        if (!cancelled) setBookings(rows);
      })
      .catch((error) => toast.error(error.message ?? "Could not load slots"))
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sport, date]);

  useEffect(() => {
    getPaymentSettings()
      .then(setSettings)
      .catch(() =>
        setSettings({
          upiId: "jilanigt@upi",
          upiName: "Jilanis GT Grounds",
          paymentPhone: "+91 87121 43183",
          qrCodeUrl: null,
        }),
      );
  }, []);

  const days = useMemo(() => upcomingDaysIST(21), []);
  const minStart = upcomingHourFor(date);

  function continueFromTime() {
    if (endHour <= startHour) return toast.error("Choose an end time after start time.");
    if (overlaps) return toast.error("This range overlaps an existing booking.");
    setStep(3);
  }

  async function createBooking() {
    const parsed = contactSchema.safeParse({ name, phone, notes });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    if (endHour <= startHour) return toast.error("Choose a valid time range.");
    if (overlaps) return toast.error("This range overlaps an existing booking.");
    setCreating(true);
    try {
      const id = await createSportsBooking({
        sport,
        bookingDate: date,
        startHour,
        endHour,
        totalHours: hours,
        pricePerHour,
        totalAmount: total,
        customerName: parsed.data.name.trim(),
        customerPhone: normalizePhone(parsed.data.phone),
        notes: parsed.data.notes?.trim() || null,
      });
      setBookingId(id);
      localStorage.setItem("gt_phone", normalizePhone(parsed.data.phone));
      setStep(4);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create booking. Try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpload(file: File) {
    if (!bookingId) return;
    setUploading(true);
    try {
      const url = await uploadPaymentProof(file);
      await submitBookingPaymentProof(bookingId, url);
      setPaymentProofUrl(url);
      toast.success("Payment submitted! We'll verify shortly.");
      setTimeout(() => navigate({ to: "/my-bookings" }), 1200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  const startOfToday = new Date(todayIsoIST() + "T00:00:00");

  return (
    <div className="min-h-screen bg-white pb-24">
      <TopNav />
      <div className="mx-auto max-w-2xl px-5 py-6">
        <button
          onClick={() => (step === 1 ? window.history.back() : setStep((step - 1) as Step))}
          className="mb-4 flex items-center gap-2 text-sm font-semibold text-black/60"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-prime" : "bg-black/10"}`}
            />
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-black/40">
          Step {step} of 4
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          {step === 1 && "Pick a date"}
          {step === 2 && "Start & end time"}
          {step === 3 && "Your details"}
          {step === 4 && "Pay & confirm"}
        </h1>
        <p className="mt-1 text-sm text-black/50">
          {s.name} · Open 24 hours · {formatINR(pricePerHour)}/hr{isWeekend(date) && " weekend"}
        </p>

        {step === 1 && (
          <div className="mt-8">
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
              {days.map((d) => (
                <button
                  key={d.iso}
                  onClick={() => setDate(d.iso)}
                  className={`flex shrink-0 flex-col items-center rounded-2xl border px-4 py-3 transition-colors ${date === d.iso ? "border-prime bg-prime text-white" : "border-black/10 bg-white"}`}
                >
                  <span className="text-[10px] font-bold uppercase opacity-70">{d.day}</span>
                  <span className="text-xl font-extrabold">{d.dom}</span>
                </button>
              ))}
            </div>

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="mt-4 flex w-full items-center justify-between rounded-2xl border border-black/10 bg-surface px-5 py-4 text-left">
                  <span className="flex items-center gap-3 text-sm font-semibold">
                    <CalendarDays className="h-4 w-4 text-prime" />
                    {formatDateFull(date)}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-black/50">
                    Pick from calendar
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={new Date(date)}
                  onSelect={(d) => {
                    if (d) {
                      setDate(toIsoDate(d));
                      setCalendarOpen(false);
                    }
                  }}
                  disabled={{ before: startOfToday }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <button
              onClick={() => setStep(2)}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-prime py-5 text-sm font-bold uppercase tracking-widest text-prime-foreground"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-8">
            <div className="mb-5 flex items-center gap-2 text-sm text-black/60">
              <CalendarDays className="h-4 w-4" />
              {formatDateLong(date)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-black/50">
                  Start time
                </span>
                <select
                  value={startHour}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setStartHour(next);
                    if (endHour <= next) setEndHour(Math.min(24, next + 1));
                  }}
                  className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base font-bold focus:border-prime focus:outline-none"
                >
                  {timeOptions.slice(0, -1).map((h) => (
                    <option key={h} value={h} disabled={h < minStart}>
                      {formatHour(h)}
                      {h < minStart ? " (past)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-black/50">
                  End time
                </span>
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base font-bold focus:border-prime focus:outline-none"
                >
                  {timeOptions.slice(1).map((h) => (
                    <option key={h} value={h} disabled={h <= startHour}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 rounded-2xl bg-surface p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-black/60">
                  <Clock className="mr-1 inline h-4 w-4" />
                  {formatHour(startHour)} – {formatHour(endHour)}
                </span>
                <span className="font-bold">
                  {hours}h × {formatINR(pricePerHour)}
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between border-t border-black/5 pt-3">
                <span className="text-xs font-bold uppercase text-black/50">Total</span>
                <span className="text-2xl font-black">{formatINR(total)}</span>
              </div>
              {loadingSlots && (
                <p className="mt-3 text-xs text-black/40">Checking live availability…</p>
              )}
              {overlaps && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                  This time overlaps an existing booking. Please choose another range.
                </p>
              )}
              {bookings.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {bookings.map((b) => (
                    <span
                      key={b.id}
                      className="rounded-full bg-black/5 px-3 py-1 text-[11px] font-bold text-black/50"
                    >
                      Booked {formatHour(b.startHour)}–{formatHour(b.endHour)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              disabled={hours === 0 || overlaps || loadingSlots}
              onClick={continueFromTime}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-prime py-5 text-sm font-bold uppercase tracking-widest text-prime-foreground disabled:opacity-40"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-black/50">
                Full name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base font-semibold focus:border-prime focus:outline-none"
                placeholder="Your name"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-black/50">
                Phone (WhatsApp)
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={15}
                inputMode="tel"
                className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base font-semibold focus:border-prime focus:outline-none"
                placeholder="+91 98765 43210"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-black/50">
                Notes (optional)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                rows={3}
                className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base focus:border-prime focus:outline-none"
                placeholder="Any requests?"
              />
            </label>
            <button
              disabled={creating}
              onClick={createBooking}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-prime py-5 text-sm font-bold uppercase tracking-widest text-prime-foreground disabled:opacity-40"
            >
              {creating ? "Creating…" : "Continue to payment"} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="mt-8">
            <div className="rounded-3xl bg-prime p-6 text-white">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                Amount to pay
              </p>
              <p className="text-4xl font-black italic">{formatINR(total)}</p>
              <p className="mt-2 text-xs text-white/60">
                {s.name} · {formatDateShort(date)} · {formatHour(startHour)}–{formatHour(endHour)}
              </p>
            </div>
            <div className="mt-6 rounded-3xl border border-black/5 bg-surface p-6 text-center">
              {settings?.qrCodeUrl ? (
                <img
                  src={settings.qrCodeUrl}
                  alt="UPI QR"
                  className="mx-auto h-48 w-48 rounded-xl object-cover"
                />
              ) : (
                <div className="mx-auto grid h-48 w-48 place-items-center rounded-xl border-2 border-dashed border-black/20 text-xs text-black/40">
                  QR Code
                  <br />
                  (admin will upload)
                </div>
              )}
              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-black/40">
                UPI ID
              </p>
              <p className="text-lg font-bold">{settings?.upiId ?? "jilanigt@upi"}</p>
              <p className="text-xs text-black/50">{settings?.upiName ?? "Jilanis GT Grounds"}</p>
              {settings?.paymentPhone && (
                <a
                  href={`tel:${settings.paymentPhone.replace(/\s+/g, "")}`}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-prime ring-1 ring-black/10"
                >
                  <Phone className="h-3.5 w-3.5" /> {settings.paymentPhone}
                </a>
              )}
              <div className="mt-4">
                <a
                  href={`upi://pay?pa=${encodeURIComponent(settings?.upiId ?? "jilanigt@upi")}&pn=${encodeURIComponent(settings?.upiName ?? "GT Grounds")}&am=${total}&cu=INR`}
                  className="inline-block rounded-xl bg-prime px-6 py-3 text-xs font-bold uppercase tracking-widest text-prime-foreground"
                >
                  Open UPI App
                </a>
              </div>
            </div>
            <label className="mt-6 block cursor-pointer rounded-3xl border-2 border-dashed border-black/15 bg-white p-6 text-center transition-colors hover:border-prime">
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
                disabled={uploading || !!paymentProofUrl}
              />
              {paymentProofUrl ? (
                <div className="flex flex-col items-center gap-2 text-emerald-700">
                  <Check className="h-6 w-6" />
                  <span className="font-bold">Uploaded! Redirecting…</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6 text-black/50" />
                  <span className="text-sm font-bold">
                    {uploading ? "Uploading…" : "Upload payment screenshot or video"}
                  </span>
                  <span className="text-xs text-black/50">PNG, JPG, or short video</span>
                </div>
              )}
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
