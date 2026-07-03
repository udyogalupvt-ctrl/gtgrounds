import { Link } from "@tanstack/react-router";
import { LogOut, ArrowRight, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onFirebaseAuth, signOutFirebase } from "@/lib/firebase";
import logoUrl from "@/assets/gt-logo.png";

export function TopNav() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let unsubscribe: undefined | (() => void);
    onFirebaseAuth((nextUser) => setUser(nextUser)).then((fn) => {
      unsubscribe = fn;
    });
    return () => unsubscribe?.();
  }, []);

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-black/5 bg-white/85 px-4 py-2.5 backdrop-blur-md">
      <Link to="/" className="flex items-center gap-2.5 leading-none">
        <img
          src={logoUrl}
          alt="Jilani's GT Grounds & Gardens logo"
          width={44}
          height={44}
          className="size-11 rounded-full object-contain ring-1 ring-black/5"
        />
        <span className="flex flex-col">
          <span className="text-[13px] font-extrabold tracking-tight text-prime">Jilani's GT</span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/45">
            Grounds & Gardens
          </span>
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <Link
          to="/media"
          className="hidden rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-black/55 transition-colors hover:text-prime sm:inline-flex"
        >
          Media
        </Link>
        <Link
          to="/contact"
          className="hidden rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-black/55 transition-colors hover:text-prime sm:inline-flex"
        >
          Contact
        </Link>
        {user ? (
          <>
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-prime transition-all active:scale-95"
              aria-label="Profile"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  width={24}
                  height={24}
                  className="size-6 rounded-full object-cover"
                />
              ) : (
                <UserCircle2 className="h-6 w-6" strokeWidth={1.8} />
              )}
              <span className="max-w-[80px] truncate normal-case tracking-normal">
                {user.displayName || user.email?.split("@")[0]}
              </span>
            </Link>
            <button
              onClick={() => signOutFirebase()}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white p-2 text-prime transition-all active:scale-95"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </>
        ) : (
          <Link
            to="/auth"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-prime px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] text-prime-foreground shadow-lg shadow-prime/25 ring-1 ring-white/10 transition-all active:scale-95"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sport animate-pulse" />
            Sign in
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2.5}
            />
          </Link>
        )}
      </div>
    </nav>
  );
}
