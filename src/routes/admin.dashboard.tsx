import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  Bell,
  BellRing,
  CheckCircle2,
  XCircle,
  LogOut,
  Image as ImageIcon,
  Users,
  UserPlus,
  IndianRupee,
  CalendarClock,
  MessageSquare,
  Trash2,
  Upload,
  Megaphone,
  Radio,
  Send,
  Sparkles,
  Wallet,
  Mail,
  Phone,
  Search,
  Ban,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { User as FirebaseUser } from "firebase/auth";
import {
  deleteBooking,
  getPaymentSettings,
  savePaymentSettings,
  subscribeAdminBookings,
  subscribeAdminInquiries,
  updateBookingStatus,
  type BookingStatus,
  type FunctionInquiry,
  type PaymentSettings,
  type SportsBooking,
  type getAvailability,
  submitAdminBlock,
} from "@/lib/booking-store";
import { AdminTodaySlots } from "@/components/site/AdminTodaySlots";

import { uploadGalleryMedia } from "@/lib/cloudinary";
import {
  broadcastAdminMessage,
  sendAdminMessage,
  subscribeAdminThreadMessages,
  subscribeAdminThreads,
  type ChatMessage,
  type ChatThread,
} from "@/lib/chat-store";
import { getRewardSettings, saveRewardSettings, type RewardSettings } from "@/lib/rewards-store";
import {
  createAnnouncement,
  createGalleryItem,
  deleteAnnouncement,
  deleteGalleryItem,
  getAdminAnnouncements,
  getPublicGalleryItems,
  setAnnouncementActive,
  type Announcement,
  type AnnouncementPriority,
  type GalleryItem,
  type GalleryMediaType,
} from "@/lib/content-store";
import {
  isAdminEmail,
  onFirebaseAuth,
  signInWithEmail,
  signInWithGoogle,
  signOutFirebase,
  subscribeAllUsers,
  disableUserProfile,
  enableUserProfile,
  deleteUserProfile,
  type RegisteredUser,
} from "@/lib/firebase";
import { enableAdminPushNotifications } from "@/lib/push-notifications";
import {
  getVenueConfig,
  saveVenueConfig,
  defaultVenueConfig,
  type VenueConfig,
} from "@/lib/venue-config-store";
import { buildUpiUri, generateUpiQr } from "@/lib/upi";
import {
  SPORTS,
  SportSlug,
  formatDateFull,
  formatDateLong,
  formatDateShort,
  formatHour,
  formatINR,
  statusColor,
  statusLabel,
  todayIsoIST,
} from "@/lib/venue";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Admin — GT Grounds" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<FirebaseUser | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [tab, setTab] = useState<
    "sports" | "events" | "gallery" | "announcements" | "chats" | "rewards" | "payment" | "pricing" | "users"
  >("sports");
  const [bookings, setBookings] = useState<SportsBooking[]>([]);
  const [inquiries, setInquiries] = useState<FunctionInquiry[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [galleryType, setGalleryType] = useState<GalleryMediaType>("image");
  const [galleryTitle, setGalleryTitle] = useState("");
  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryUrl, setGalleryUrl] = useState("");
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementPriority, setAnnouncementPriority] = useState<AnnouncementPriority>("normal");
  const [announcementExpiresAt, setAnnouncementExpiresAt] = useState("");
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [broadcastDraft, setBroadcastDraft] = useState("");
  const [rewards, setRewards] = useState<RewardSettings | null>(null);
  const [savingRewards, setSavingRewards] = useState(false);
  const [payment, setPayment] = useState<PaymentSettings | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [venue, setVenue] = useState<VenueConfig>(defaultVenueConfig);
  const [savingVenue, setSavingVenue] = useState(false);
  const [adminQrPreview, setAdminQrPreview] = useState<string | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [usersQuery, setUsersQuery] = useState("");

  useEffect(() => {
    let unsubscribe: undefined | (() => void);
    onFirebaseAuth((user) => setSession(user)).then((fn) => {
      unsubscribe = fn;
    });
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(null);
      return;
    }
    setIsAdmin(isAdminEmail(session.email));
  }, [session]);

  // Live bookings & inquiries — update the dashboard the instant a customer
  // books or submits payment, no refresh needed. Gallery/announcements are
  // static enough to load once (and after admin edits).
  useEffect(() => {
    if (!isAdmin) return;
    loadContent();
    let unsubBookings: undefined | (() => void);
    let unsubInquiries: undefined | (() => void);
    subscribeAdminBookings(setBookings, (e) => toast.error(e.message)).then((fn) => {
      unsubBookings = fn;
    });
    subscribeAdminInquiries(setInquiries).then((fn) => {
      unsubInquiries = fn;
    });
    return () => {
      unsubBookings?.();
      unsubInquiries?.();
    };
  }, [isAdmin]);

  // If this browser already granted notification permission, silently refresh
  // its push token so admin alerts keep working after token rotation.
  useEffect(() => {
    if (!isAdmin || !session) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    enableAdminPushNotifications({ uid: session.uid, email: session.email })
      .then((result) => setPushEnabled(result === "enabled"))
      .catch(() => {});
  }, [isAdmin, session]);

  async function enablePush() {
    if (!session) return;
    try {
      const result = await enableAdminPushNotifications({ uid: session.uid, email: session.email });
      if (result === "enabled") {
        setPushEnabled(true);
        toast.success("Booking alerts enabled on this device");
      } else if (result === "denied") {
        toast.error("Notifications are blocked. Allow them in your browser's site settings.");
      } else {
        toast.error("This browser does not support push notifications.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enable notifications");
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    let unsub: undefined | (() => void);
    subscribeAdminThreads(setThreads).then((fn) => {
      unsub = fn;
    });
    getRewardSettings()
      .then(setRewards)
      .catch(() => {});
    getPaymentSettings()
      .then(setPayment)
      .catch(() => {});
    getVenueConfig()
      .then(setVenue)
      .catch(() => {});

    let unsubUsers: undefined | (() => void);
    subscribeAllUsers(setRegisteredUsers, (e) => toast.error(e.message)).then((fn) => {
      unsubUsers = fn;
    });

    return () => {
      unsub?.();
      unsubUsers?.();
    };
  }, [isAdmin]);

  // Live QR preview for the admin (no amount — a generic "pay us" code).
  useEffect(() => {
    if (!payment?.upiId) {
      setAdminQrPreview(null);
      return;
    }
    let active = true;
    generateUpiQr(buildUpiUri({ upiId: payment.upiId, upiName: payment.upiName || "GT Grounds" }))
      .then((url) => active && setAdminQrPreview(url))
      .catch(() => active && setAdminQrPreview(null));
    return () => {
      active = false;
    };
  }, [payment?.upiId, payment?.upiName]);

  async function saveVenue() {
    setSavingVenue(true);
    try {
      await saveVenueConfig(venue);
      toast.success("Pricing & availability saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingVenue(false);
    }
  }

  useEffect(() => {
    if (!activeThread) {
      setThreadMessages([]);
      return;
    }
    let unsub: undefined | (() => void);
    subscribeAdminThreadMessages(activeThread, setThreadMessages).then((fn) => {
      unsub = fn;
    });
    return () => unsub?.();
  }, [activeThread]);

  async function loadContent() {
    try {
      const [g, a] = await Promise.all([getPublicGalleryItems(), getAdminAnnouncements()]);
      setGalleryItems(g);
      setAnnouncements(a);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load admin data");
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    try {
      await signInWithEmail(email, password);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setSigningIn(false);
    }
  }

  async function googleSignIn() {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    await signOutFirebase();
    navigate({ to: "/" });
  }

  async function updateStatus(id: string, status: BookingStatus) {
    try {
      await updateBookingStatus(id, status);
      toast.success(`Marked ${statusLabel(status)}`);
      // The live subscription reflects the change automatically.
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update status");
    }
  }

  async function removeBooking(b: SportsBooking) {
    const label = `${b.customerName} — ${SPORTS[b.sport].name} ${formatDateShort(b.bookingDate)} ${formatHour(b.startHour)}–${formatHour(b.endHour)}`;
    if (!window.confirm(`Delete this booking?\n\n${label}\n\nThis cannot be undone.`)) return;
    try {
      await deleteBooking(b.id);
      toast.success("Booking deleted");
      // Live subscription removes it from the list automatically.
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete booking");
    }
  }

  function viewScreenshot(b: SportsBooking) {
    if (b.paymentProofUrl) window.open(b.paymentProofUrl, "_blank");
  }

  async function uploadGalleryFile(file: File) {
    setGalleryUploading(true);
    try {
      const url = await uploadGalleryMedia(file);
      setGalleryUrl(url);
      setGalleryType(file.type.startsWith("video/") ? "video" : "image");
      toast.success("Media uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setGalleryUploading(false);
    }
  }

  async function saveGalleryItem(e: React.FormEvent) {
    e.preventDefault();
    if (!galleryTitle.trim() || !galleryUrl.trim()) {
      toast.error("Add a title and media URL.");
      return;
    }
    try {
      await createGalleryItem({
        type: galleryType,
        title: galleryTitle.trim(),
        caption: galleryCaption.trim(),
        url: galleryUrl.trim(),
      });
      setGalleryTitle("");
      setGalleryCaption("");
      setGalleryUrl("");
      setGalleryType("image");
      toast.success("Gallery updated");
      loadContent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save gallery item");
    }
  }

  async function removeGalleryItem(id: string) {
    try {
      await deleteGalleryItem(id);
      toast.success("Removed from gallery");
      loadContent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete gallery item");
    }
  }

  async function saveAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      toast.error("Add announcement title and message.");
      return;
    }
    setAnnouncementSaving(true);
    try {
      await createAnnouncement({
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
        priority: announcementPriority,
        active: true,
        expiresAt: announcementExpiresAt || null,
      });
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setAnnouncementPriority("normal");
      setAnnouncementExpiresAt("");
      toast.success("Announcement published");
      loadContent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish announcement");
    } finally {
      setAnnouncementSaving(false);
    }
  }

  async function toggleAnnouncement(item: Announcement) {
    try {
      await setAnnouncementActive(item.id, !item.active);
      toast.success(item.active ? "Announcement hidden" : "Announcement live");
      loadContent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update announcement");
    }
  }

  async function removeAnnouncement(id: string) {
    try {
      await deleteAnnouncement(id);
      toast.success("Announcement deleted");
      loadContent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete announcement");
    }
  }

  function whatsappLink(b: SportsBooking) {
    const paymentLine =
      b.paymentMethod === "venue"
        ? `💳 Payment: Pay ${formatINR(b.totalAmount)} at the venue`
        : `💳 Payment: Received (${formatINR(b.totalAmount)})`;
    const msg = `Hi ${b.customerName}! ✅ Your booking at Jilani's GT Grounds is CONFIRMED.
📅 ${formatDateLong(b.bookingDate)}
⏰ ${formatHour(b.startHour)} – ${formatHour(b.endHour)}
🏟️ ${SPORTS[b.sport].name}
${paymentLine}
📍 Location: https://maps.app.goo.gl/Ycke5SbvAQG6gbam6?g_st=ic
Please arrive 10 minutes early. Contact: +91 81214 03183 / +91 84998 17867`;
    const phone = b.customerPhone.replace(/[^0-9]/g, "");
    return `https://wa.me/${phone.startsWith("91") ? phone : "91" + phone}?text=${encodeURIComponent(msg)}`;
  }

  const stats = useMemo(() => {
    const today = todayIsoIST();
    const todays = bookings.filter((b) => b.bookingDate === today);
    const revenue = bookings
      .filter((b) => b.status === "approved" || b.status === "completed")
      .reduce((s, b) => s + Number(b.totalAmount), 0);
    const pending = bookings.filter(
      (b) => b.status === "payment_submitted" || b.status === "under_verification",
    ).length;
    return {
      todays: todays.length,
      revenue,
      pending,
      inquiries: inquiries.filter((i) => i.status === "pending").length,
      users: registeredUsers.length,
    };
  }, [bookings, inquiries, registeredUsers]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (q) {
        const s = q.toLowerCase();
        return (
          b.customerName.toLowerCase().includes(s) ||
          b.customerPhone.includes(s) ||
          b.id.startsWith(s)
        );
      }
      return true;
    });
  }, [bookings, statusFilter, q]);

  if (session === undefined || (session && isAdmin === null)) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-black/50">Loading…</div>
    );
  }

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center bg-prime px-6 text-white">
        <form onSubmit={signIn} className="w-full max-w-sm space-y-4">
          <Link to="/" className="text-xs font-bold uppercase tracking-widest text-white/50">
            ← Back
          </Link>
          <h1 className="text-3xl font-black italic">Admin Sign In</h1>
          <p className="text-sm text-white/50">
            Use {"jilanigtgrounds@gmail.com"} or the approved Google account.
          </p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="Email"
            className="w-full rounded-2xl bg-white/10 p-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sport"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            placeholder="Password"
            className="w-full rounded-2xl bg-white/10 p-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sport"
          />
          <button
            disabled={signingIn}
            className="w-full rounded-2xl bg-sport py-4 text-sm font-bold uppercase tracking-widest text-sport-foreground disabled:opacity-40"
          >
            {signingIn ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={googleSignIn}
            disabled={signingIn}
            className="w-full rounded-2xl border border-white/20 py-4 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-40"
          >
            Continue with Google
          </button>
        </form>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Not authorized</h1>
          <p className="mt-2 text-sm text-black/60">
            Your account isn't an admin. Sign in with jilanigtgrounds@gmail.com.
          </p>
          <button
            onClick={signOut}
            className="mt-4 rounded-xl bg-prime px-4 py-2 text-sm text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-16">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Admin</p>
            <h1 className="text-lg font-extrabold">GT Grounds Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={enablePush}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${pushEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-black/10 bg-white text-black/60"}`}
              title={
                pushEnabled
                  ? "Booking alerts are on for this device"
                  : "Get a push notification when a booking is submitted"
              }
            >
              {pushEnabled ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {pushEnabled ? "Alerts on" : "Enable alerts"}
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-1 text-xs font-bold text-black/60"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard icon={CalendarClock} label="Today" value={String(stats.todays)} />
          <StatCard icon={Users} label="Pending" value={String(stats.pending)} accent />
          <StatCard icon={IndianRupee} label="Revenue" value={formatINR(stats.revenue)} />
          <StatCard icon={MessageSquare} label="Inquiries" value={String(stats.inquiries)} />
          <StatCard icon={UserPlus} label="Users" value={String(stats.users)} />
        </div>

        <div className="mt-8 flex gap-2 overflow-x-auto border-b border-black/5">
          {(
            [
              "sports",
              "events",
              "users",
              "chats",
              "gallery",
              "announcements",
              "pricing",
              "payment",
              "rewards",
            ] as const
          ).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative -mb-px whitespace-nowrap px-4 py-3 text-sm font-bold uppercase tracking-wider ${tab === t ? "text-prime" : "text-black/40"}`}
            >
              {t === "sports"
                ? "Sports Bookings"
                : t === "events"
                  ? "Event Inquiries"
                  : t === "users"
                    ? "Users"
                    : t === "gallery"
                      ? "Gallery"
                      : t === "chats"
                        ? "Chats"
                        : t === "rewards"
                          ? "Rewards"
                          : t === "pricing"
                            ? "Pricing & Holds"
                            : t === "payment"
                              ? "Payment"
                              : "Announcements"}
              {tab === t && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-prime" />}
            </button>
          ))}
        </div>

        {tab === "sports" && (
          <div className="mt-6">
            <AdminBlockSlotForm />
            <AdminTodaySlots bookings={bookings} prices={venue.prices} />
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, phone, ID"
                className="flex-1 rounded-xl border border-black/10 bg-white p-3 text-sm focus:border-prime focus:outline-none"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-black/10 bg-white p-3 text-sm focus:border-prime focus:outline-none"
              >
                <option value="all">All statuses</option>
                {[
                  "pending_payment",
                  "payment_submitted",
                  "under_verification",
                  "approved",
                  "rejected",
                  "cancelled",
                  "completed",
                ].map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            <ul className="space-y-3">
              {filtered.length === 0 && (
                <p className="rounded-2xl bg-white p-8 text-center text-sm text-black/50">
                  No bookings.
                </p>
              )}
              {filtered.map((b) => (
                <li key={b.id} className="rounded-2xl border border-black/5 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">
                        {b.customerName} · <span className="text-black/50">{b.customerPhone}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-black/60">
                        {SPORTS[b.sport].name} · {formatDateShort(b.bookingDate)} ·{" "}
                        {formatHour(b.startHour)}–{formatHour(b.endHour)}
                      </p>
                      {b.notes && <p className="mt-1 text-xs text-black/50">📝 {b.notes}</p>}
                      <p className="mt-1 font-mono text-[10px] text-black/30">
                        #{b.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black">{formatINR(b.totalAmount)}</p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusColor(b.status)}`}
                      >
                        {statusLabel(b.status)}
                      </span>
                      {b.paymentMethod === "venue" && (
                        <span className="mt-1 flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          <Banknote className="h-3 w-3" /> Pay at venue
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {b.paymentProofUrl ? (
                      <button
                        onClick={() => viewScreenshot(b)}
                        className="flex items-center gap-1 rounded-lg bg-black/5 px-3 py-1.5 text-xs font-bold"
                      >
                        <ImageIcon className="h-3 w-3" /> Payment Proof
                      </button>
                    ) : (
                      b.paymentMethod === "venue" && (
                        <span className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                          <Banknote className="h-3 w-3" /> Collect at venue
                        </span>
                      )
                    )}
                    {b.status !== "approved" && (
                      <button
                        onClick={() => updateStatus(b.id, "approved")}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </button>
                    )}
                    {b.status !== "rejected" && (
                      <button
                        onClick={() => updateStatus(b.id, "rejected")}
                        className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        <XCircle className="h-3 w-3" /> Reject
                      </button>
                    )}
                    {b.status === "approved" && (
                      <a
                        href={whatsappLink(b)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        WhatsApp confirm
                      </a>
                    )}
                    <button
                      onClick={() => removeBooking(b)}
                      className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "events" && (
          <div className="mt-6">
            <ul className="space-y-3">
              {inquiries.length === 0 && (
                <p className="rounded-2xl bg-white p-8 text-center text-sm text-black/50">
                  No inquiries yet.
                </p>
              )}
              {inquiries.map((i) => (
                <li key={i.id} className="rounded-2xl border border-black/5 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">
                        {i.customerName} · <span className="text-black/50">{i.customerPhone}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-black/60">
                        {i.eventType} · {formatDateFull(i.preferredDate)} · {i.expectedGuests}{" "}
                        guests
                      </p>
                      {i.specialRequirements && (
                        <p className="mt-1 text-xs text-black/50">📝 {i.specialRequirements}</p>
                      )}
                    </div>
                    <a
                      href={`https://wa.me/${i.customerPhone.replace(/[^0-9]/g, "").replace(/^0+/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      WhatsApp
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "users" && (
          <div className="mt-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-extrabold">Registered Users</h2>
                <span className="rounded-full bg-prime px-3 py-1 text-xs font-bold text-white">
                  {registeredUsers.length}
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                <input
                  value={usersQuery}
                  onChange={(e) => setUsersQuery(e.target.value)}
                  placeholder="Search name, email, phone"
                  className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-prime focus:outline-none sm:w-72"
                />
              </div>
            </div>

            {registeredUsers.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center">
                <UserPlus className="mx-auto mb-3 h-8 w-8 text-black/20" />
                <p className="text-sm text-black/50">No registered users yet.</p>
                <p className="mt-1 text-xs text-black/40">
                  Users will appear here when they sign up on the site.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {registeredUsers
                  .filter((u) => {
                    if (!usersQuery.trim()) return true;
                    const q = usersQuery.toLowerCase();
                    return (
                      u.fullName.toLowerCase().includes(q) ||
                      u.email.toLowerCase().includes(q) ||
                      u.phone.includes(q)
                    );
                  })
                  .map((u) => {
                    const waPhone = u.phone
                      .replace(/[^0-9]/g, "")
                      .replace(/^(?!91)/, "91");
                    const registeredDate = u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—";
                    const registeredTime = u.createdAt
                      ? new Date(u.createdAt).toLocaleTimeString("en-IN", {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "";

                    return (
                      <div
                        key={u.uid}
                        className={`rounded-2xl border border-black/5 bg-white p-4 transition-opacity ${u.disabled ? "opacity-50 grayscale" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          {u.photoURL ? (
                            <img
                              src={u.photoURL}
                              alt={u.fullName}
                              className="size-11 shrink-0 rounded-full object-cover ring-1 ring-black/5"
                            />
                          ) : (
                            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-sport/20 text-prime">
                              <span className="text-sm font-black">
                                {(u.fullName || u.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}

                          {/* User info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`truncate font-bold ${u.disabled ? "line-through" : ""}`}>
                                {u.fullName || "—"}
                              </p>
                              {u.disabled && (
                                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-700">
                                  Disabled
                                </span>
                              )}
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                  u.provider === "google.com"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-black/5 text-black/50"
                                }`}
                              >
                                {u.provider === "google.com" ? "Google" : "Email"}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-black/50">
                              <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {u.email || "—"}
                              </span>
                              {u.phone && (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {u.phone}
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-black/30">
                              Registered {registeredDate}
                              {registeredTime ? ` at ${registeredTime}` : ""}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex shrink-0 gap-1.5">
                            {u.phone && (
                              <>
                                <a
                                  href={`https://wa.me/${waPhone}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100"
                                  title="WhatsApp"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </a>
                                <a
                                  href={`tel:${u.phone.replace(/\s+/g, "")}`}
                                  className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                                  title="Call"
                                >
                                  <Phone className="h-4 w-4" />
                                </a>
                              </>
                            )}
                            <div className="h-9 w-px bg-black/10 mx-1" />
                            {u.disabled ? (
                              <button
                                onClick={() => {
                                  if (confirm(`Enable access for ${u.fullName || u.email}?`)) {
                                    enableUserProfile(u.uid).then(() => toast.success("User enabled")).catch((e) => toast.error(e.message));
                                  }
                                }}
                                className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100"
                                title="Enable User"
                              >
                                <UserCheck className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (confirm(`Disable access for ${u.fullName || u.email}? They won't be able to log in.`)) {
                                    disableUserProfile(u.uid).then(() => toast.success("User disabled")).catch((e) => toast.error(e.message));
                                  }
                                }}
                                className="grid size-9 place-items-center rounded-lg bg-amber-50 text-amber-600 transition-colors hover:bg-amber-100"
                                title="Disable User"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm(`Permanently delete ${u.fullName || u.email}? This cannot be undone.`)) {
                                  deleteUserProfile(u.uid).then(() => toast.success("User deleted")).catch((e) => toast.error(e.message));
                                }
                              }}
                              className="grid size-9 place-items-center rounded-lg bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                              title="Delete User"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {tab === "gallery" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
            <form
              onSubmit={saveGalleryItem}
              className="space-y-3 rounded-2xl border border-black/5 bg-white p-4"
            >
              <h2 className="text-lg font-extrabold">Add gallery media</h2>
              <select
                value={galleryType}
                onChange={(e) => setGalleryType(e.target.value as GalleryMediaType)}
                className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm focus:border-prime focus:outline-none"
              >
                <option value="image">Image upload / image URL</option>
                <option value="video">Video upload / video URL</option>
                <option value="youtube">YouTube URL</option>
                <option value="live">YouTube live URL</option>
              </select>
              {(galleryType === "image" || galleryType === "video") && (
                <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-black/10 bg-surface p-5 text-center text-sm font-bold text-black/60">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    disabled={galleryUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadGalleryFile(file);
                    }}
                  />
                  <Upload className="mx-auto mb-2 h-5 w-5" />
                  {galleryUploading ? "Uploading…" : "Upload image or video"}
                </label>
              )}
              <input
                value={galleryTitle}
                onChange={(e) => setGalleryTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm focus:border-prime focus:outline-none"
              />
              <textarea
                value={galleryCaption}
                onChange={(e) => setGalleryCaption(e.target.value)}
                placeholder="Caption"
                rows={3}
                className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm focus:border-prime focus:outline-none"
              />
              <input
                value={galleryUrl}
                onChange={(e) => setGalleryUrl(e.target.value)}
                placeholder={
                  galleryType === "youtube" || galleryType === "live"
                    ? "YouTube or live stream URL"
                    : "Uploaded media URL"
                }
                className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm focus:border-prime focus:outline-none"
              />
              <button className="w-full rounded-xl bg-prime py-3 text-xs font-bold uppercase tracking-widest text-white">
                Publish to gallery
              </button>
            </form>

            <div className="space-y-3">
              {galleryItems.length === 0 && (
                <p className="rounded-2xl bg-white p-8 text-center text-sm text-black/50">
                  No gallery items yet.
                </p>
              )}
              {galleryItems.map((item) => (
                <article
                  key={item.id}
                  className="flex gap-3 rounded-2xl border border-black/5 bg-white p-3"
                >
                  <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/5">
                    {item.type === "image" ? (
                      <img src={item.url} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <Radio className="h-5 w-5 text-black/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{item.title}</p>
                    <p className="text-xs uppercase tracking-widest text-black/40">{item.type}</p>
                    {item.caption && (
                      <p className="mt-1 line-clamp-2 text-xs text-black/50">{item.caption}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeGalleryItem(item.id)}
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600"
                    aria-label="Delete gallery item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "announcements" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
            <form
              onSubmit={saveAnnouncement}
              className="space-y-3 rounded-2xl border border-black/5 bg-white p-4"
            >
              <h2 className="text-lg font-extrabold">Send announcement</h2>
              <input
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm focus:border-prime focus:outline-none"
              />
              <textarea
                value={announcementBody}
                onChange={(e) => setAnnouncementBody(e.target.value)}
                placeholder="Message for visitors"
                rows={5}
                className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm focus:border-prime focus:outline-none"
              />
              <select
                value={announcementPriority}
                onChange={(e) => setAnnouncementPriority(e.target.value as AnnouncementPriority)}
                className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm focus:border-prime focus:outline-none"
              >
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/40">
                Expiry date
                <input
                  type="date"
                  value={announcementExpiresAt}
                  onChange={(e) => setAnnouncementExpiresAt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-normal text-prime focus:border-prime focus:outline-none"
                />
              </label>
              <button
                disabled={announcementSaving}
                className="w-full rounded-xl bg-prime py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
              >
                {announcementSaving ? "Publishing…" : "Publish announcement"}
              </button>
            </form>

            <div className="space-y-3">
              {announcements.length === 0 && (
                <p className="rounded-2xl bg-white p-8 text-center text-sm text-black/50">
                  No active announcements.
                </p>
              )}
              {announcements.map((item) => (
                <article key={item.id} className="rounded-2xl border border-black/5 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <Megaphone className="mt-1 h-5 w-5 shrink-0 text-black/40" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/35">
                        {item.priority}
                        {item.expiresAt ? ` · until ${item.expiresAt}` : ""}
                      </p>
                      <h3 className="font-bold">{item.title}</h3>
                      <p className="mt-1 text-sm text-black/60">{item.body}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => toggleAnnouncement(item)}
                      className="rounded-lg bg-black/5 px-3 py-1.5 text-xs font-bold"
                    >
                      {item.active ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => removeAnnouncement(item.id)}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "chats" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-2">
              <div className="rounded-2xl border border-black/5 bg-white p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-black/40">
                  Broadcast to all
                </p>
                <textarea
                  value={broadcastDraft}
                  onChange={(e) => setBroadcastDraft(e.target.value)}
                  rows={3}
                  placeholder="Send a message to everyone who chatted…"
                  className="w-full rounded-xl border border-black/10 bg-white p-2 text-sm focus:border-prime focus:outline-none"
                />
                <button
                  onClick={async () => {
                    if (!broadcastDraft.trim() || threads.length === 0) return;
                    try {
                      await broadcastAdminMessage(
                        threads.map((t) => t.threadId),
                        broadcastDraft.trim(),
                      );
                      setBroadcastDraft("");
                      toast.success(`Sent to ${threads.length} users`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Broadcast failed");
                    }
                  }}
                  className="mt-2 w-full rounded-xl bg-prime py-2 text-[11px] font-bold uppercase tracking-widest text-white"
                >
                  Send broadcast
                </button>
              </div>
              {threads.length === 0 && (
                <p className="rounded-2xl bg-white p-6 text-center text-sm text-black/50">
                  No chats yet.
                </p>
              )}
              {threads.map((t) => {
                const userBookings = bookings.filter((b) => b.userId === t.threadId);
                const completed = userBookings.filter(
                  (b) => b.status === "approved" || b.status === "completed",
                ).length;
                return (
                  <button
                    key={t.threadId}
                    onClick={() => setActiveThread(t.threadId)}
                    className={`block w-full rounded-2xl border p-3 text-left transition-colors ${activeThread === t.threadId ? "border-prime bg-prime/5" : "border-black/5 bg-white hover:border-black/20"}`}
                  >
                    <p className="truncate text-sm font-bold">
                      {t.userName || t.userEmail || "Guest"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-black/50">
                      {t.lastMessage || "(no messages)"}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/40">
                      <span>{completed} completed</span>
                      {completed >= 1 && (
                        <span className="rounded-full bg-sport/30 px-2 py-0.5 text-prime">
                          Repeat eligible
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-black/5 bg-white">
              {!activeThread ? (
                <div className="grid flex-1 place-items-center text-sm text-black/40">
                  Select a chat to view messages.
                </div>
              ) : (
                <>
                  <div className="border-b border-black/5 px-4 py-3">
                    <p className="text-sm font-bold">
                      {threads.find((x) => x.threadId === activeThread)?.userName || "User"}
                    </p>
                    <p className="text-xs text-black/50">
                      {threads.find((x) => x.threadId === activeThread)?.userEmail}
                    </p>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto bg-surface p-4">
                    {threadMessages.length === 0 && (
                      <p className="text-center text-xs text-black/40">No messages yet.</p>
                    )}
                    {threadMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.from === "admin" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.from === "admin" ? "bg-prime text-white" : "bg-white text-prime ring-1 ring-black/5"}`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p
                            className={`mt-1 text-[9px] uppercase tracking-wider ${m.from === "admin" ? "text-white/50" : "text-black/40"}`}
                          >
                            {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!chatDraft.trim() || !activeThread) return;
                      try {
                        await sendAdminMessage(activeThread, chatDraft.trim());
                        setChatDraft("");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Send failed");
                      }
                    }}
                    className="flex items-center gap-2 border-t border-black/5 p-3"
                  >
                    <input
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      placeholder="Reply…"
                      className="flex-1 rounded-full border border-black/10 bg-surface px-4 py-2.5 text-sm focus:border-prime focus:outline-none"
                    />
                    <button
                      className="grid size-10 place-items-center rounded-full bg-prime text-white"
                      aria-label="Send"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                    {rewards?.enabled && rewards.googleReviewUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setChatDraft(
                            `Hi! Thanks for choosing GT Grounds. Enjoyed your session? Please leave us a 5-star Google review and get ${rewards.discountPercent}% OFF your next booking → ${rewards.googleReviewUrl}`,
                          )
                        }
                        className="hidden shrink-0 rounded-full border border-sport bg-sport/20 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-prime sm:inline-flex"
                        title="Insert reward promo"
                      >
                        <Sparkles className="mr-1 h-3 w-3" /> Promo
                      </button>
                    )}
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {tab === "rewards" && rewards && (
          <div className="mt-6 max-w-2xl">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingRewards(true);
                try {
                  await saveRewardSettings(rewards);
                  toast.success("Rewards updated");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Save failed");
                } finally {
                  setSavingRewards(false);
                }
              }}
              className="space-y-4 rounded-2xl border border-black/5 bg-white p-6"
            >
              <div>
                <h2 className="text-lg font-extrabold">Google Review Reward</h2>
                <p className="mt-1 text-sm text-black/50">
                  Offer a dynamic discount to customers who rate you 5 stars on Google. Shown on
                  their profile after their first completed booking.
                </p>
              </div>
              <label className="flex items-center gap-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={rewards.enabled}
                  onChange={(e) => setRewards({ ...rewards, enabled: e.target.checked })}
                  className="size-4"
                />
                Reward enabled
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-black/50">
                  Discount %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rewards.discountPercent}
                    onChange={(e) =>
                      setRewards({ ...rewards, discountPercent: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 text-base font-semibold text-prime focus:border-prime focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-widest text-black/50">
                  Show after N completed bookings
                  <input
                    type="number"
                    min={1}
                    value={rewards.minCompletedBookings}
                    onChange={(e) =>
                      setRewards({ ...rewards, minCompletedBookings: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 text-base font-semibold text-prime focus:border-prime focus:outline-none"
                  />
                </label>
              </div>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/50">
                Google Review URL
                <input
                  type="url"
                  value={rewards.googleReviewUrl}
                  onChange={(e) => setRewards({ ...rewards, googleReviewUrl: e.target.value })}
                  placeholder="https://g.page/r/…/review"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-normal focus:border-prime focus:outline-none"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/50">
                Promo title
                <input
                  value={rewards.promoTitle}
                  onChange={(e) => setRewards({ ...rewards, promoTitle: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-normal focus:border-prime focus:outline-none"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/50">
                Promo body
                <textarea
                  value={rewards.promoBody}
                  onChange={(e) => setRewards({ ...rewards, promoBody: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-normal focus:border-prime focus:outline-none"
                />
              </label>
              <button
                disabled={savingRewards}
                className="w-full rounded-xl bg-prime py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
              >
                {savingRewards ? "Saving…" : "Save reward settings"}
              </button>
            </form>
          </div>
        )}

        {tab === "payment" && (
          <div className="mt-6 max-w-2xl">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!payment) return;
                setSavingPayment(true);
                try {
                  await savePaymentSettings(payment);
                  toast.success("Payment details saved");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Save failed");
                } finally {
                  setSavingPayment(false);
                }
              }}
              className="space-y-4 rounded-2xl border border-black/5 bg-white p-6"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-sport/20 text-prime">
                  <Wallet className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-extrabold">Payment details</h2>
                  <p className="text-sm text-black/50">
                    Shown to every customer at the payment step.
                  </p>
                </div>
              </div>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/50">
                UPI ID
                <input
                  value={payment?.upiId ?? ""}
                  onChange={(e) =>
                    setPayment({
                      ...(payment ?? { upiName: "", paymentPhone: "", qrCodeUrl: null, upiId: "" }),
                      upiId: e.target.value,
                    })
                  }
                  placeholder="name@bank"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-normal text-prime focus:border-prime focus:outline-none"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/50">
                UPI account name
                <input
                  value={payment?.upiName ?? ""}
                  onChange={(e) =>
                    setPayment({
                      ...(payment ?? { upiId: "", paymentPhone: "", qrCodeUrl: null, upiName: "" }),
                      upiName: e.target.value,
                    })
                  }
                  placeholder="Jilanis GT Grounds"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-normal text-prime focus:border-prime focus:outline-none"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/50">
                Payment phone number
                <input
                  value={payment?.paymentPhone ?? ""}
                  onChange={(e) =>
                    setPayment({
                      ...(payment ?? { upiId: "", upiName: "", qrCodeUrl: null, paymentPhone: "" }),
                      paymentPhone: e.target.value,
                    })
                  }
                  placeholder="+91 81214 03183"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-normal text-prime focus:border-prime focus:outline-none"
                />
              </label>
              <div className="rounded-xl border border-black/5 bg-surface p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-black/50">
                  Auto-generated QR
                </p>
                <p className="mt-1 text-xs text-black/50">
                  Customers see this automatically with the exact booking amount pre-filled — no
                  upload needed.
                </p>
                {adminQrPreview ? (
                  <img
                    src={adminQrPreview}
                    alt="UPI QR preview"
                    className="mt-3 h-40 w-40 rounded-lg bg-white object-contain p-1"
                  />
                ) : (
                  <p className="mt-3 text-xs text-black/40">Enter a UPI ID to preview the QR.</p>
                )}
              </div>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/50">
                Custom QR image URL (optional — overrides the auto QR)
                <input
                  value={payment?.qrCodeUrl ?? ""}
                  onChange={(e) =>
                    setPayment({
                      ...(payment ?? { upiId: "", upiName: "", paymentPhone: "", qrCodeUrl: null }),
                      qrCodeUrl: e.target.value || null,
                    })
                  }
                  placeholder="https://…/qr.png"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-normal text-prime focus:border-prime focus:outline-none"
                />
              </label>
              <button
                disabled={savingPayment || !payment}
                className="w-full rounded-xl bg-prime py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
              >
                {savingPayment ? "Saving…" : "Save payment details"}
              </button>
            </form>
          </div>
        )}

        {tab === "pricing" && (
          <div className="mt-6 max-w-2xl">
            <div className="space-y-4 rounded-2xl border border-black/5 bg-white p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-sport/20 text-prime">
                  <IndianRupee className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-extrabold">Pricing & availability</h2>
                  <p className="text-sm text-black/50">
                    Set the per-hour rate and pause bookings for any sport.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">Weekend extra charge</p>
                    <p className="text-xs text-black/40">
                      {venue.weekendExtra.enabled
                        ? `Sat & Sun prices are ${venue.weekendExtra.percent}% higher`
                        : "Off — weekends cost the same as weekdays"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setVenue((v) => ({
                        ...v,
                        weekendExtra: { ...v.weekendExtra, enabled: !v.weekendExtra.enabled },
                      }))
                    }
                    className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${venue.weekendExtra.enabled ? "bg-prime text-white" : "bg-black/10 text-black/60"}`}
                  >
                    {venue.weekendExtra.enabled ? "On" : "Off"}
                  </button>
                </div>
                {venue.weekendExtra.enabled && (
                  <label className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-black/50">
                    Extra %
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={venue.weekendExtra.percent}
                      onChange={(e) =>
                        setVenue((v) => ({
                          ...v,
                          weekendExtra: {
                            ...v.weekendExtra,
                            percent: Math.max(0, Number(e.target.value)),
                          },
                        }))
                      }
                      className="w-24 rounded-xl border border-black/10 bg-white p-2 text-right text-sm font-bold text-prime focus:border-prime focus:outline-none"
                    />
                    <span className="normal-case tracking-normal text-black/40">
                      of the hourly rate
                    </span>
                  </label>
                )}
              </div>

              {(Object.keys(SPORTS) as SportSlug[]).map((slug) => {
                const held = venue.holds[slug];
                return (
                  <div key={slug} className="rounded-2xl border border-black/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">{SPORTS[slug].name}</p>
                        <p className="text-xs text-black/40">{SPORTS[slug].tagline}</p>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-black/50">
                        ₹ / hour
                        <input
                          type="number"
                          min={0}
                          value={venue.prices[slug]}
                          onChange={(e) =>
                            setVenue((v) => ({
                              ...v,
                              prices: { ...v.prices, [slug]: Number(e.target.value) },
                            }))
                          }
                          className="w-28 rounded-xl border border-black/10 bg-white p-2 text-right text-sm font-bold text-prime focus:border-prime focus:outline-none"
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-xl bg-surface px-3 py-2">
                      <span className="text-sm font-bold">
                        {held.onHold ? (
                          <span className="text-amber-700">On hold — hidden from booking</span>
                        ) : (
                          <span className="text-emerald-700">Available for booking</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setVenue((v) => ({
                            ...v,
                            holds: {
                              ...v.holds,
                              [slug]: { ...v.holds[slug], onHold: !v.holds[slug].onHold },
                            },
                          }))
                        }
                        className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${held.onHold ? "bg-amber-500 text-white" : "bg-black/10 text-black/60"}`}
                      >
                        {held.onHold ? "Resume" : "Put on hold"}
                      </button>
                    </div>

                    {held.onHold && (
                      <input
                        value={held.reason}
                        onChange={(e) =>
                          setVenue((v) => ({
                            ...v,
                            holds: {
                              ...v.holds,
                              [slug]: { ...v.holds[slug], reason: e.target.value },
                            },
                          }))
                        }
                        placeholder="Reason shown to customers (e.g. Turf maintenance until Aug 5)"
                        maxLength={160}
                        className="mt-3 w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 placeholder:text-amber-500/70 focus:border-amber-400 focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}

              <button
                onClick={saveVenue}
                disabled={savingVenue}
                className="w-full rounded-xl bg-prime py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
              >
                {savingVenue ? "Saving…" : "Save pricing & availability"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${accent ? "border-sport bg-prime text-white" : "border-black/5 bg-white"}`}
    >
      <Icon className={`mb-2 h-4 w-4 ${accent ? "text-sport" : "text-black/40"}`} />
      <p
        className={`text-[10px] font-bold uppercase tracking-widest ${accent ? "text-white/60" : "text-black/50"}`}
      >
        {label}
      </p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function AdminBlockSlotForm() {
  const [open, setOpen] = useState(false);
  const [sport, setSport] = useState<SportSlug>("box_cricket");
  const [date, setDate] = useState(todayIsoIST());
  const [startHour, setStartHour] = useState(18);
  const [endHour, setEndHour] = useState(19);
  const [loading, setLoading] = useState(false);

  async function handleBlock(e: React.FormEvent) {
    e.preventDefault();
    if (endHour <= startHour) {
      toast.error("End time must be after start time");
      return;
    }
    setLoading(true);
    try {
      await submitAdminBlock({
        sport,
        bookingDate: date,
        startHour,
        endHour,
        totalHours: endHour - startHour,
      });
      toast.success("Slot blocked successfully");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to block slot");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="mb-6">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-prime px-4 py-2 text-sm font-bold uppercase tracking-wider text-white transition-transform active:scale-95"
        >
          <Lock className="h-4 w-4" /> Block a Slot
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-prime/10 bg-prime/5 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold">Block a Slot</h3>
        <button onClick={() => setOpen(false)} className="text-black/50 hover:text-black">
          <XCircle className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={handleBlock} className="grid gap-4 sm:grid-cols-5 sm:items-end">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-black/60">Sport</label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as SportSlug)}
            className="w-full rounded-xl border border-black/10 p-2.5 text-sm outline-none focus:border-prime"
          >
            {Object.values(SPORTS).map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-black/60">Date</label>
          <input
            type="date"
            value={date}
            min={todayIsoIST()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-black/10 p-2.5 text-sm outline-none focus:border-prime"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-black/60">Start Time</label>
          <select
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="w-full rounded-xl border border-black/10 p-2.5 text-sm outline-none focus:border-prime"
          >
            {Array.from({ length: 24 }).map((_, i) => (
              <option key={i} value={i}>
                {formatHour(i)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-black/60">End Time</label>
          <select
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="w-full rounded-xl border border-black/10 p-2.5 text-sm outline-none focus:border-prime"
          >
            {Array.from({ length: 24 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {formatHour(i + 1)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-prime p-2.5 text-sm font-bold uppercase text-white transition-opacity disabled:opacity-50"
        >
          {loading ? "Saving..." : "Block Slot"}
        </button>
      </form>
    </div>
  );
}
