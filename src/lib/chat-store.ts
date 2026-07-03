import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, isAdminEmail } from "./firebase";

export type ChatMessage = {
  id: string;
  threadId: string;
  from: "user" | "admin";
  body: string;
  createdAt: string;
  read: boolean;
};

export type ChatThread = {
  threadId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  lastMessage: string;
  lastFrom: "user" | "admin";
  lastAt: string;
  unreadForAdmin: number;
};

function toIso(v: unknown) {
  if (
    v &&
    typeof v === "object" &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof v === "string" ? v : new Date().toISOString();
}

function mapMessage(snap: QueryDocumentSnapshot<DocumentData>): ChatMessage {
  const d = snap.data();
  return {
    id: snap.id,
    threadId: d.threadId,
    from: d.from,
    body: d.body ?? "",
    createdAt: toIso(d.createdAt),
    read: Boolean(d.read),
  };
}

export async function subscribeUserThread(userId: string, cb: (msgs: ChatMessage[]) => void) {
  const db = await getFirebaseDb();
  const q1 = query(collection(db, "chatMessages"), where("threadId", "==", userId));
  return onSnapshot(q1, (snap) => {
    const rows = snap.docs.map(mapMessage).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    cb(rows);
  });
}

async function upsertThreadSummary(
  threadId: string,
  last: { body: string; from: "user" | "admin" },
) {
  const db = await getFirebaseDb();
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  await setDoc(
    doc(db, "chatThreads", threadId),
    {
      threadId,
      userName: user?.displayName ?? "",
      userEmail: user?.email ?? "",
      userPhone: user?.phoneNumber ?? "",
      lastMessage: last.body.slice(0, 200),
      lastFrom: last.from,
      lastAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function sendUserMessage(body: string) {
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to chat with the venue.");
  const db = await getFirebaseDb();
  await addDoc(collection(db, "chatMessages"), {
    threadId: user.uid,
    from: "user",
    body: body.trim(),
    read: false,
    createdAt: serverTimestamp(),
  });
  await upsertThreadSummary(user.uid, { body, from: "user" });
}

export async function sendAdminMessage(threadId: string, body: string) {
  const auth = await getFirebaseAuth();
  if (!isAdminEmail(auth.currentUser?.email)) throw new Error("Admin only.");
  const db = await getFirebaseDb();
  await addDoc(collection(db, "chatMessages"), {
    threadId,
    from: "admin",
    body: body.trim(),
    read: false,
    createdAt: serverTimestamp(),
  });
  await setDoc(
    doc(db, "chatThreads", threadId),
    {
      lastMessage: body.slice(0, 200),
      lastFrom: "admin",
      lastAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function markThreadRead(threadId: string, side: "user" | "admin") {
  const db = await getFirebaseDb();
  const other = side === "user" ? "admin" : "user";
  const snap = await getDocs(
    query(
      collection(db, "chatMessages"),
      where("threadId", "==", threadId),
      where("from", "==", other),
      where("read", "==", false),
      limit(50),
    ),
  );
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
}

export async function subscribeAdminThreads(cb: (threads: ChatThread[]) => void) {
  const db = await getFirebaseDb();
  return onSnapshot(
    query(collection(db, "chatThreads"), orderBy("lastAt", "desc"), limit(100)),
    (snap) => {
      cb(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            threadId: x.threadId ?? d.id,
            userName: x.userName ?? "",
            userEmail: x.userEmail ?? "",
            userPhone: x.userPhone ?? "",
            lastMessage: x.lastMessage ?? "",
            lastFrom: x.lastFrom ?? "user",
            lastAt: toIso(x.lastAt),
            unreadForAdmin: 0,
          };
        }),
      );
    },
  );
}

export async function subscribeAdminThreadMessages(
  threadId: string,
  cb: (msgs: ChatMessage[]) => void,
) {
  const db = await getFirebaseDb();
  return onSnapshot(
    query(collection(db, "chatMessages"), where("threadId", "==", threadId)),
    (snap) => {
      cb(snap.docs.map(mapMessage).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    },
  );
}

export async function broadcastAdminMessage(threadIds: string[], body: string) {
  for (const id of threadIds) {
    await sendAdminMessage(id, body);
  }
}
