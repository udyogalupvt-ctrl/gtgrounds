import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { toast } from "sonner";
import { Camera, LogOut, MessageCircle, Send, Sparkles, Star, Calendar } from "lucide-react";
import { TopNav } from "@/components/site/TopNav";
import { BottomNav } from "@/components/site/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  onFirebaseAuth,
  signOutFirebase,
  updateUserPhotoURL,
  updateUserDisplayName,
} from "@/lib/firebase";
import { uploadProfilePhoto } from "@/lib/cloudinary";
import { getBookingsForCurrentUser, type SportsBooking } from "@/lib/booking-store";
import { SPORTS, formatHour, formatINR, statusColor, statusLabel } from "@/lib/venue";
import {
  sendUserMessage,
  subscribeUserThread,
  markThreadRead,
  type ChatMessage,
} from "@/lib/chat-store";
import { getRewardSettings, type RewardSettings } from "@/lib/rewards-store";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My Profile — GT Grounds" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let unsub: undefined | (() => void);
    onFirebaseAuth((u) => setUser(u)).then((fn) => {
      unsub = fn;
    });
    return () => unsub?.();
  }, []);

  if (user === undefined)
    return (
      <div className="grid min-h-screen place-items-center bg-white text-sm text-black/50">
        Loading…
      </div>
    );
  if (!user) return <Navigate to="/auth" replace />;
  return <ProfileInner user={user} />;
}

function ProfileInner({ user }: { user: User }) {
  const [name, setName] = useState(user.displayName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [bookings, setBookings] = useState<SportsBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [rewards, setRewards] = useState<RewardSettings | null>(null);

  useEffect(() => {
    getBookingsForCurrentUser()
      .then((rows) => setBookings(rows))
      .finally(() => setLoadingBookings(false));
    getRewardSettings()
      .then(setRewards)
      .catch(() => {});
  }, []);

  const completed = bookings.filter(
    (b) => b.status === "completed" || b.status === "approved",
  ).length;
  const showReward =
    rewards?.enabled && completed >= (rewards.minCompletedBookings ?? 1) && rewards.googleReviewUrl;

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadProfilePhoto(file);
      await updateUserPhotoURL(url);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingName(true);
    try {
      await updateUserDisplayName(name.trim());
      toast.success("Name updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="min-h-screen bg-white pb-32 text-prime">
      <TopNav />
      <div className="px-5 pt-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="grid size-20 place-items-center overflow-hidden rounded-full bg-surface ring-2 ring-black/5">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-prime/60">
                  {(user.displayName ?? user.email ?? "U").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-prime text-white shadow-lg active:scale-95"
              aria-label="Change profile photo"
              disabled={uploading}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhotoChange} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-extrabold">
              {user.displayName || user.email?.split("@")[0]}
            </p>
            <p className="mt-0.5 truncate text-xs text-black/50">{user.email}</p>
            {uploading && <p className="mt-1 text-xs text-black/50">Uploading photo…</p>}
          </div>
          <button
            onClick={() => signOutFirebase()}
            className="rounded-full border border-black/10 p-2 text-prime active:scale-95"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {showReward && rewards && (
          <div className="mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-sport/30 via-sport/15 to-white p-5 ring-1 ring-sport/40">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-prime" />
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-prime/70">
                  Exclusive · {rewards.discountPercent}% OFF
                </p>
                <h3 className="mt-1 text-lg font-extrabold">{rewards.promoTitle}</h3>
                <p className="mt-1 text-sm text-black/70">{rewards.promoBody}</p>
                <a
                  href={rewards.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-prime px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-prime-foreground"
                >
                  <Star className="h-3.5 w-3.5 fill-sport text-sport" /> Rate on Google
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <Tabs defaultValue="bookings">
            <TabsList className="grid w-full grid-cols-3 rounded-full bg-surface p-1">
              <TabsTrigger
                value="bookings"
                className="rounded-full data-[state=active]:bg-prime data-[state=active]:text-prime-foreground"
              >
                Bookings
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="rounded-full data-[state=active]:bg-prime data-[state=active]:text-prime-foreground"
              >
                Chat
              </TabsTrigger>
              <TabsTrigger
                value="account"
                className="rounded-full data-[state=active]:bg-prime data-[state=active]:text-prime-foreground"
              >
                Account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bookings" className="mt-5">
              {loadingBookings ? (
                <p className="text-sm text-black/50">Loading…</p>
              ) : bookings.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-black/10 p-10 text-center">
                  <Calendar className="mx-auto mb-3 h-8 w-8 text-black/30" />
                  <p className="text-sm text-black/50">No bookings yet.</p>
                  <Link
                    to="/book/$sport"
                    params={{ sport: "box_cricket" }}
                    className="mt-4 inline-flex rounded-full bg-prime px-5 py-2 text-xs font-bold uppercase tracking-widest text-prime-foreground"
                  >
                    Book now
                  </Link>
                </div>
              ) : (
                <ul className="space-y-3">
                  {bookings.map((b) => (
                    <li key={b.id} className="rounded-2xl border border-black/5 bg-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold">
                            {SPORTS[b.sport]?.name ?? b.sport}
                          </p>
                          <p className="mt-0.5 text-sm text-black/60">
                            {new Date(b.bookingDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              weekday: "short",
                            })}{" "}
                            · {formatHour(b.startHour)}–{formatHour(b.endHour)}
                          </p>
                          <p className="mt-1 text-xs font-mono text-black/40">
                            #{b.id.slice(0, 8)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black">{formatINR(b.totalAmount)}</p>
                          <span
                            className={`mt-1 inline-block rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${statusColor(b.status)}`}
                          >
                            {statusLabel(b.status)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="chat" className="mt-5">
              <UserChat userId={user.uid} />
            </TabsContent>

            <TabsContent value="account" className="mt-5">
              <form onSubmit={onSaveName} className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-widest text-black/50">
                  Display name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-black/10 bg-white p-4 text-base font-semibold focus:border-prime focus:outline-none"
                  placeholder="Your name"
                />
                <button
                  disabled={savingName}
                  className="w-full rounded-2xl bg-prime px-5 py-3 text-sm font-bold uppercase tracking-widest text-prime-foreground disabled:opacity-60"
                >
                  {savingName ? "Saving…" : "Save name"}
                </button>
              </form>
              <div className="mt-6 rounded-2xl border border-black/5 bg-surface p-4 text-xs text-black/60">
                <p>
                  <strong>Email:</strong> {user.email}
                </p>
                <p className="mt-1">
                  <strong>Provider:</strong> {user.providerData[0]?.providerId ?? "password"}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

function UserChat({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unsub: undefined | (() => void);
    subscribeUserThread(userId, setMessages).then((fn) => {
      unsub = fn;
    });
    return () => unsub?.();
  }, [userId]);

  useEffect(() => {
    markThreadRead(userId, "user").catch(() => {});
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, userId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setSending(true);
    try {
      await sendUserMessage(input);
      setInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-black/5 bg-surface">
      <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
        <MessageCircle className="h-4 w-4 text-prime" />
        <p className="text-sm font-bold">Chat with the venue</p>
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green-500" />
      </div>
      <div ref={scrollRef} className="flex h-80 flex-col gap-2 overflow-y-auto bg-white p-4">
        {messages.length === 0 ? (
          <p className="my-auto text-center text-xs text-black/40">
            Send a message and our team will reply here.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.from === "user" ? "bg-prime text-prime-foreground" : "bg-surface text-prime"}`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p
                  className={`mt-1 text-[9px] uppercase tracking-wider ${m.from === "user" ? "text-white/50" : "text-black/40"}`}
                >
                  {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      <form
        onSubmit={send}
        className="flex items-center gap-2 border-t border-black/5 bg-white p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-black/10 bg-surface px-4 py-2.5 text-sm focus:border-prime focus:outline-none"
        />
        <button
          disabled={sending || !input.trim()}
          className="grid size-11 place-items-center rounded-full bg-prime text-white disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
