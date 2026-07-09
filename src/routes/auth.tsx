import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, Lock, User, Phone, Sparkles } from "lucide-react";
import { TopNav } from "@/components/site/TopNav";
import { BottomNav } from "@/components/site/BottomNav";
import {
  onFirebaseAuth,
  signInWithEmail,
  signInWithGoogle,
  signOutFirebase,
  signUpWithEmail,
} from "@/lib/firebase";
import { normalizePhone } from "@/lib/venue";
import type { User as FirebaseUser } from "firebase/auth";
import { notifyAdmins } from "@/lib/admin-notify.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Login & Google Signup — GT Grounds" }] }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Signup requires everything — the phone is what links bookings made as a
// guest to the new account.
const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9\s-]{10,15}$/, "Enter a valid phone number"),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let unsubscribe: undefined | (() => void);
    onFirebaseAuth(setUser).then((fn) => {
      unsubscribe = fn;
    });
    return () => unsubscribe?.();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse({ email, password, fullName, phone });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Check your details");
          return;
        }
        const cleanPhone = normalizePhone(parsed.data.phone);
        await signUpWithEmail(
          parsed.data.email,
          parsed.data.password,
          parsed.data.fullName,
          cleanPhone,
        );
        // Remember the phone locally too, so booking auto-fill and guest-booking
        // matching work immediately.
        localStorage.setItem("gt_phone", cleanPhone);
        toast.success("Account created");
        // Notify admin about new registration (fire and forget)
        notifyAdmins({
          data: {
            kind: "user_registered",
            fullName: parsed.data.fullName,
            email: parsed.data.email,
            phone: cleanPhone,
            provider: "email",
          },
        }).catch(() => {});
      } else {
        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Check your details");
          return;
        }
        await signInWithEmail(parsed.data.email, parsed.data.password);
        toast.success("Signed in");
      }
      navigate({ to: "/my-bookings" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    try {
      const { user: gUser, isNew } = await signInWithGoogle();
      toast.success("Signed in with Google");
      if (isNew) {
        // Notify admin about new Google registration (fire and forget)
        notifyAdmins({
          data: {
            kind: "user_registered",
            fullName: gUser.displayName || "",
            email: gUser.email || "",
            phone: "",
            provider: "google",
          },
        }).catch(() => {});
      }
      navigate({ to: "/my-bookings" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  if (user) {
    return (
      <div className="min-h-screen bg-white pb-32">
        <TopNav />
        <div className="mx-auto max-w-md px-5 py-10 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-sport text-sport-foreground">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">You’re signed in</h1>
          <p className="mt-2 text-sm text-black/50">{user.email}</p>
          <div className="mt-8 grid gap-3">
            <Link
              to="/my-bookings"
              className="rounded-2xl bg-prime py-4 text-sm font-bold uppercase tracking-widest text-prime-foreground"
            >
              View bookings
            </Link>
            <button
              onClick={() => signOutFirebase()}
              className="rounded-2xl border border-black/10 py-4 text-sm font-bold uppercase tracking-widest"
            >
              Sign out
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      <TopNav />
      <div className="mx-auto max-w-md px-5 py-8">
        <p className="text-xs font-bold uppercase tracking-widest text-event">Account</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Login or Google signup</h1>
        <p className="mt-2 text-sm text-black/50">
          Track bookings faster and reuse your details on every visit.
        </p>

        <div className="mt-7 grid grid-cols-2 rounded-2xl bg-surface p-1">
          <button
            onClick={() => setMode("login")}
            className={`rounded-xl py-3 text-xs font-bold uppercase tracking-widest ${mode === "login" ? "bg-white shadow-sm" : "text-black/40"}`}
          >
            Login
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`rounded-xl py-3 text-xs font-bold uppercase tracking-widest ${mode === "signup" ? "bg-white shadow-sm" : "text-black/40"}`}
          >
            Signup
          </button>
        </div>

        <button
          disabled={loading}
          onClick={google}
          className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white py-4 text-sm font-bold disabled:opacity-40"
        >
          <span className="grid size-6 place-items-center rounded-full bg-prime text-[11px] font-black text-white">
            G
          </span>
          Continue with Google
        </button>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "signup" && (
            <label className="relative block">
              <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                required
                maxLength={80}
                className="w-full rounded-2xl border border-black/10 bg-white py-4 pl-11 pr-4 text-sm font-semibold focus:border-prime focus:outline-none"
              />
            </label>
          )}
          <label className="relative block">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-2xl border border-black/10 bg-white py-4 pl-11 pr-4 text-sm font-semibold focus:border-prime focus:outline-none"
            />
          </label>
          <label className="relative block">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              required
              minLength={6}
              className="w-full rounded-2xl border border-black/10 bg-white py-4 pl-11 pr-4 text-sm font-semibold focus:border-prime focus:outline-none"
            />
          </label>
          {mode === "signup" && (
            <label className="relative block">
              <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone / WhatsApp (used to match your bookings)"
                inputMode="tel"
                required
                maxLength={15}
                className="w-full rounded-2xl border border-black/10 bg-white py-4 pl-11 pr-4 text-sm font-semibold focus:border-prime focus:outline-none"
              />
            </label>
          )}
          <button
            disabled={loading}
            className="flex w-full items-center justify-center rounded-2xl bg-prime py-5 text-sm font-bold uppercase tracking-widest text-prime-foreground disabled:opacity-40"
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Login"}
          </button>
        </form>
      </div>
      <BottomNav />
    </div>
  );
}
