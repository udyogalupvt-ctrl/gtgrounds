import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, isAdminEmail } from "./firebase";

export type GalleryMediaType = "image" | "video" | "youtube" | "live";

export type GalleryItem = {
  id: string;
  type: GalleryMediaType;
  title: string;
  caption: string;
  url: string;
  createdAt: string;
};

export type AnnouncementPriority = "normal" | "important" | "urgent";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
};

function timestampToIso(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }
  return typeof value === "string" ? value : new Date().toISOString();
}

async function requireAdmin() {
  const user = (await getFirebaseAuth()).currentUser;
  if (!isAdminEmail(user?.email)) throw new Error("Admin access required.");
  return user!;
}

function mapGalleryItem(snap: QueryDocumentSnapshot<DocumentData>): GalleryItem {
  const data = snap.data();
  return {
    id: snap.id,
    type: data.type ?? "image",
    title: data.title ?? "Gallery update",
    caption: data.caption ?? "",
    url: data.url ?? "",
    createdAt: timestampToIso(data.createdAt),
  };
}

function mapAnnouncement(snap: QueryDocumentSnapshot<DocumentData>): Announcement {
  const data = snap.data();
  return {
    id: snap.id,
    title: data.title ?? "Announcement",
    body: data.body ?? "",
    priority: data.priority ?? "normal",
    active: data.active !== false,
    expiresAt: data.expiresAt ?? null,
    createdAt: timestampToIso(data.createdAt),
  };
}

function latestFirst<T extends { createdAt: string }>(items: T[]) {
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function isCurrentAnnouncement(item: Announcement) {
  return (
    item.active && (!item.expiresAt || item.expiresAt >= new Date().toISOString().slice(0, 10))
  );
}

export async function getPublicGalleryItems() {
  const db = await getFirebaseDb();
  const snapshot = await getDocs(query(collection(db, "galleryItems"), limit(200)));
  return latestFirst(snapshot.docs.map(mapGalleryItem)).filter((item) => Boolean(item.url));
}

export async function getPublicAnnouncements() {
  const db = await getFirebaseDb();
  const snapshot = await getDocs(query(collection(db, "announcements"), limit(100)));
  return latestFirst(snapshot.docs.map(mapAnnouncement)).filter(isCurrentAnnouncement);
}

export async function getAdminAnnouncements() {
  await requireAdmin();
  const db = await getFirebaseDb();
  const snapshot = await getDocs(query(collection(db, "announcements"), limit(200)));
  return latestFirst(snapshot.docs.map(mapAnnouncement));
}

export async function createGalleryItem(input: Omit<GalleryItem, "id" | "createdAt">) {
  const user = await requireAdmin();
  const db = await getFirebaseDb();
  await addDoc(collection(db, "galleryItems"), {
    ...input,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGalleryItem(id: string) {
  await requireAdmin();
  const db = await getFirebaseDb();
  await deleteDoc(doc(db, "galleryItems", id));
}

export async function createAnnouncement(input: Omit<Announcement, "id" | "createdAt">) {
  const user = await requireAdmin();
  const db = await getFirebaseDb();
  await addDoc(collection(db, "announcements"), {
    ...input,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function setAnnouncementActive(id: string, active: boolean) {
  await requireAdmin();
  const db = await getFirebaseDb();
  await updateDoc(doc(db, "announcements", id), { active, updatedAt: serverTimestamp() });
}

export async function deleteAnnouncement(id: string) {
  await requireAdmin();
  const db = await getFirebaseDb();
  await deleteDoc(doc(db, "announcements", id));
}
