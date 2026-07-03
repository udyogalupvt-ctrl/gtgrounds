import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Megaphone, Play, Radio } from "lucide-react";
import { TopNav } from "@/components/site/TopNav";
import { BottomNav } from "@/components/site/BottomNav";
import {
  getPublicAnnouncements,
  getPublicGalleryItems,
  type Announcement,
  type GalleryItem,
} from "@/lib/content-store";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Jilani's GT Grounds & Gardens" },
      {
        name: "description",
        content:
          "Photos, videos, YouTube streams and latest updates from Jilani's GT Grounds & Gardens in Dokiparru.",
      },
      { property: "og:title", content: "Gallery — Jilani's GT Grounds & Gardens" },
      {
        property: "og:description",
        content: "See sports, events, live streams and venue moments from GT Grounds.",
      },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPublicGalleryItems(), getPublicAnnouncements()])
      .then(([gallery, notes]) => {
        setItems(gallery);
        setAnnouncements(notes);
      })
      .finally(() => setLoading(false));
  }, []);

  const featured = useMemo(() => items[0], [items]);

  return (
    <div className="min-h-screen bg-white pb-28 text-prime">
      <TopNav />
      <main>
        <section className="px-5 pb-10 pt-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-black/40">
            Live Gallery
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Moments from the ground.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-black/60">
            Photos, match clips, event films, YouTube videos and live-stream embeds from Jilani's GT
            Grounds & Gardens.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              to="/book/$sport"
              params={{ sport: "box_cricket" }}
              className="rounded-2xl bg-prime px-5 py-3 text-xs font-bold uppercase tracking-widest text-prime-foreground"
            >
              Book a slot
            </Link>
            <Link
              to="/announcements"
              className="rounded-2xl border border-black/10 px-5 py-3 text-xs font-bold uppercase tracking-widest"
            >
              Announcements
            </Link>
          </div>
        </section>

        {announcements.length > 0 && (
          <section className="px-5 pb-8">
            <div className="space-y-3">
              {announcements.slice(0, 2).map((item) => (
                <article key={item.id} className="rounded-3xl bg-sport/20 p-5 ring-1 ring-black/5">
                  <div className="flex items-start gap-3">
                    <Megaphone className="mt-1 h-5 w-5 shrink-0 text-prime" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-black/40">
                        {item.priority}
                      </p>
                      <h2 className="mt-1 text-lg font-extrabold">{item.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-black/65">{item.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-black/50">Loading gallery…</div>
        ) : items.length === 0 ? (
          <div className="mx-5 rounded-3xl bg-surface p-10 text-center">
            <p className="text-lg font-bold">Gallery coming soon.</p>
            <p className="mt-2 text-sm text-black/50">
              The admin can upload images, videos and YouTube live links from the dashboard.
            </p>
          </div>
        ) : (
          <section className="px-5 pb-16">
            {featured && <MediaCard item={featured} large />}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.slice(featured ? 1 : 0).map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function MediaCard({ item, large }: { item: GalleryItem; large?: boolean }) {
  return (
    <article
      className={`overflow-hidden rounded-3xl border border-black/5 bg-surface ${large ? "mb-4" : ""}`}
    >
      <div className={large ? "aspect-[4/3] sm:aspect-[16/8]" : "aspect-[4/3]"}>
        <MediaFrame item={item} />
      </div>
      <div className="p-5">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/40">
          {item.type === "live" ? (
            <Radio className="h-3.5 w-3.5 text-red-600" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {item.type === "live" ? "YouTube Live" : item.type}
        </p>
        <h2 className="text-lg font-extrabold">{item.title}</h2>
        {item.caption && <p className="mt-1 text-sm leading-6 text-black/60">{item.caption}</p>}
      </div>
    </article>
  );
}

function MediaFrame({ item }: { item: GalleryItem }) {
  if (item.type === "image") {
    return (
      <img src={item.url} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
    );
  }
  if (item.type === "video") {
    return (
      <video
        src={item.url}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
      />
    );
  }
  return (
    <iframe
      title={item.title}
      src={toYouTubeEmbedUrl(item.url)}
      className="h-full w-full border-0 bg-black"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      loading="lazy"
    />
  );
}

function toYouTubeEmbedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.pathname.includes("/embed/")) return rawUrl;
    const host = url.hostname.replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (host.includes("youtube.com")) {
      id = url.searchParams.get("v") ?? "";
      if (!id) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (["live", "shorts"].includes(parts[0])) id = parts[1] ?? "";
      }
    }
    return id ? `https://www.youtube.com/embed/${id}` : rawUrl;
  } catch {
    return rawUrl;
  }
}
