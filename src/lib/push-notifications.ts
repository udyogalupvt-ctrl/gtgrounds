import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { toast } from "sonner";
import { getFirebaseApp, getFirebaseDb } from "./firebase";
import { getFirebasePublicConfig } from "./firebase-config.functions";

export type PushSetupResult = "enabled" | "denied" | "unsupported";

let foregroundListenerBound = false;

/**
 * Registers this browser to receive admin push notifications:
 * requests permission, registers the FCM service worker, creates a device
 * token and stores it in the `adminPushTokens` Firestore collection where the
 * server-side sender picks it up.
 */
export async function enableAdminPushNotifications(admin: {
  uid: string;
  email: string | null;
}): Promise<PushSetupResult> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  ) {
    return "unsupported";
  }
  if (!(await isSupported().catch(() => false))) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const config = await getFirebasePublicConfig();
  const swQuery = new URLSearchParams({
    apiKey: config.apiKey,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });
  const registration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${swQuery.toString()}`,
  );
  await navigator.serviceWorker.ready;

  const app = await getFirebaseApp();
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY as string,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Could not create a push token for this browser.");

  const db = await getFirebaseDb();
  await setDoc(
    doc(db, "adminPushTokens", token),
    {
      token,
      uid: admin.uid,
      email: admin.email ?? "",
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  // While the admin dashboard is open in the foreground the service worker
  // does not fire, so surface pushes as in-app toasts instead.
  if (!foregroundListenerBound) {
    foregroundListenerBound = true;
    onMessage(messaging, (payload) => {
      const title = payload.data?.title ?? "GT Grounds";
      const body = payload.data?.body ?? "";
      toast.info(title, { description: body, duration: 8000 });
    });
  }

  return "enabled";
}
