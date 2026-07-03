import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Megaphone } from "lucide-react";
import { TopNav } from "@/components/site/TopNav";
import { BottomNav } from "@/components/site/BottomNav";
import { getPublicAnnouncements, type Announcement } from "@/lib/content-store";

export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — Jilani's GT Grounds" },
      {
        name: "description",
        content:
          "Latest match updates, event notices and live stream announcements from Jilani's GT Grounds & Gardens.",
      },
      { property: "og:title", content: "Announcements — Jilani's GT Grounds" },
      {
        property: "og:description",
        content:
          "Latest match updates, event notices and live stream announcements from GT Grounds.",
      },
    ],
  }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicAnnouncements()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-surface pb-28 text-prime">
      <TopNav />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-black/40">Updates</p>
        <h1 className="text-4xl font-extrabold tracking-tight">Announcements</h1>
        <p className="mt-3 text-sm leading-6 text-black/60">
          Official updates from Jilani's GT Grounds & Gardens.
        </p>

        {loading ? (
          <p className="mt-10 text-sm text-black/50">Loading announcements…</p>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-white p-8 text-center text-sm text-black/50">
            No active announcements right now.
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {items.map((item) => (
              <article key={item.id} className="rounded-3xl bg-white p-6 ring-1 ring-black/5">
                <div className="flex items-start gap-4">
                  <span
                    className={`grid size-12 shrink-0 place-items-center rounded-2xl ${item.priority === "urgent" ? "bg-red-100 text-red-700" : "bg-sport/20 text-prime"}`}
                  >
                    {item.priority === "urgent" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <Megaphone className="h-5 w-5" />
                    )}
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/35">
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      · {item.priority}
                    </p>
                    <h2 className="mt-1 text-xl font-extrabold">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-black/65">{item.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
