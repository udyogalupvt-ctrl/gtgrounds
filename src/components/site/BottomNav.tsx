import { Link, useRouterState } from "@tanstack/react-router";
import { Home, CalendarCheck, Images, Phone, UserCircle } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/my-bookings", label: "Bookings", icon: CalendarCheck },
  { to: "/media", label: "Media", icon: Images },
  { to: "/contact", label: "Contact", icon: Phone },
  { to: "/profile", label: "Profile", icon: UserCircle },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[92%] max-w-md -translate-x-1/2">
      <nav className="flex h-16 items-center justify-around rounded-full border border-white/10 bg-prime/95 px-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
        {items.map(({ to, label, icon: Icon }) => {
          const active =
            to === "/"
              ? pathname === "/"
              : to === "/media"
                ? pathname.startsWith("/media") ||
                  pathname.startsWith("/gallery") ||
                  pathname.startsWith("/announcements")
                : pathname.startsWith(to);
          return (
            <Link key={to} to={to} className="flex flex-col items-center gap-1" aria-label={label}>
              <Icon
                className={`h-5 w-5 transition-colors ${active ? "text-sport" : "text-white/50"}`}
                strokeWidth={2.2}
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-tighter ${active ? "text-white" : "text-white/40"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
