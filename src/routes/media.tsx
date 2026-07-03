import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Megaphone, Play, Radio } from "lucide-react";
import { TopNav } from "@/components/site/TopNav";
import { BottomNav } from "@/components/site/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getPublicAnnouncements,
  getPublicGalleryItems,
  type Announcement,
  type GalleryItem,
} from "@/lib/content-store";

export const Route = createFileRoute("/media")({
  head: () => ({
    meta: [
      { title: "Media & Updates — Jilani's GT Grounds" },
      {
        name: "description",
        content:
          "Gallery, YouTube live streams and the latest announcements from Jilani's GT Grounds & Gardens.",
      },
      { property: "og:title", content: "Media & Updates — Jilani's GT Grounds" },
      {
        property: "og:description",
        content: "Photos, live streams and announcements from GT Grounds.",
      },
    ],
  }),
  component: MediaPage,
});

function MediaPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPublicGalleryItems(), getPublicAnnouncements()])
      .then(([g, a]) => {
        setItems(g);
        setAnnouncements(a);
      })
      .finally(() => setLoading(false));
  }, []);

  const featured = useMemo(() => items[0], [items]);

  return (
    <div className="min-h-screen bg-white pb-20 text-prime">
      <TopNav />
      <main>
        <section className="px-5 pb-6 pt-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-black/40">
            Media & Updates
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Everything from the ground.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-black/60">
            Photos, match clips, live streams and official announcements — all in one place.
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
              to="/contact"
              className="rounded-2xl border border-black/10 px-5 py-3 text-xs font-bold uppercase tracking-widest"
            >
              Contact
            </Link>
          </div>
        </section>

        <section className="px-5 pb-8">
          <Tabs defaultValue="gallery" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-full bg-surface p-1">
              <TabsTrigger
                value="gallery"
                className="rounded-full data-[state=active]:bg-prime data-[state=active]:text-prime-foreground"
              >
                Gallery
              </TabsTrigger>
              <TabsTrigger
                value="updates"
                className="rounded-full data-[state=active]:bg-prime data-[state=active]:text-prime-foreground"
              >
                Updates{" "}
                {announcements.length > 0 && (
                  <span className="ml-1 rounded-full bg-sport px-1.5 text-[10px] font-black text-prime">
                    {announcements.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gallery" className="mt-6">
              {loading ? (
                <p className="py-16 text-center text-sm text-black/50">Loading gallery…</p>
              ) : items.length === 0 ? (
                <div className="rounded-3xl bg-surface p-10 text-center">
                  <p className="text-lg font-bold">Gallery coming soon.</p>
                  <p className="mt-2 text-sm text-black/50">
                    The admin will upload photos, videos and YouTube links soon.
                  </p>
                </div>
              ) : (
                <>
                  {featured && <MediaCard item={featured} large />}
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.slice(featured ? 1 : 0).map((item) => (
                      <MediaCard key={item.id} item={item} />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="updates" className="mt-6">
              {loading ? (
                <p className="py-16 text-center text-sm text-black/50">Loading updates…</p>
              ) : announcements.length === 0 ? (
                <div className="rounded-3xl bg-surface p-10 text-center text-sm text-black/50">
                  No active announcements right now.
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-3xl bg-surface p-6 ring-1 ring-black/5"
                    >
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
            </TabsContent>
          </Tabs>
        </section>
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
  if (item.type === "image")
    return (
      <img src={item.url} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
    );
  if (item.type === "video")
    return (
      <video
        src={item.url}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
      />
    );
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
