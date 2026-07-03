import { useEffect, useState } from "react";
import logoUrl from "@/assets/gt-logo.png";

export function LogoSplash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = sessionStorage.getItem("gt_splash_seen");
    if (seen) {
      setVisible(false);
      return;
    }
    const fadeTimer = setTimeout(() => setFading(true), 1400);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem("gt_splash_seen", "1");
    }, 1900);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;
  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] grid place-items-center bg-prime transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <div className="relative flex flex-col items-center">
        <span className="absolute inset-0 -m-8 animate-ping rounded-full bg-sport/25" />
        <span className="absolute inset-0 -m-2 animate-pulse rounded-full bg-sport/10 blur-2xl" />
        <img
          src={logoUrl}
          alt="Jilani's GT Grounds"
          width={112}
          height={112}
          className="relative size-28 rounded-full object-contain shadow-2xl shadow-black/40 ring-2 ring-sport/40 animate-[splashPop_900ms_cubic-bezier(.2,.9,.3,1.4)_both]"
        />
        <p className="relative mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/70 animate-[splashFade_900ms_ease-out_400ms_both]">
          Jilani's GT
        </p>
        <div className="relative mt-4 h-0.5 w-24 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-1/2 animate-[splashSlide_1200ms_ease-in-out_infinite] bg-sport" />
        </div>
      </div>
      <style>{`
        @keyframes splashPop { 0%{opacity:0;transform:scale(.6) rotate(-12deg)} 60%{opacity:1;transform:scale(1.08) rotate(4deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes splashFade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes splashSlide { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
      `}</style>
    </div>
  );
}
