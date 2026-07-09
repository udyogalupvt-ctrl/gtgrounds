import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { getFirebasePublicConfig } from "./firebase-config.functions";

export const ADMIN_EMAIL = "jilanigtgrounds@gmail.com";

let appPromise: Promise<FirebaseApp> | null = null;

export async function getFirebaseApp() {
  if (getApps().length) return getApps()[0];
  if (!appPromise) {
    appPromise = getFirebasePublicConfig().then((config) => initializeApp(config));
  }
  return appPromise;
}

export async function getFirebaseAuth() {
  const app = await getFirebaseApp();
  return getAuth(app);
}

export async function getFirebaseDb(): Promise<Firestore> {
  const app = await getFirebaseApp();
  return getFirestore(app);
}

export async function onFirebaseAuth(callback: (user: User | null) => void) {
  const auth = await getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

export function isAdminEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

export async function upsertUserProfile(user: User, extra?: { fullName?: string; phone?: string }) {
  const db = await getFirebaseDb();
  const fullName = extra?.fullName?.trim() || user.displayName || "";
  await setDoc(
    doc(db, "userProfiles", user.uid),
    {
      uid: user.uid,
      email: user.email ?? "",
      fullName,
      phone: extra?.phone?.trim() ?? "",
      provider: user.providerData[0]?.providerId ?? "password",
      photoURL: user.photoURL ?? "",
      isAdmin: isAdminEmail(user.email),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export type UserProfile = { fullName: string; phone: string; email: string };

/** Saved profile details, used to auto-fill booking forms for signed-in users. */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = await getFirebaseDb();
  const snap = await getDoc(doc(db, "userProfiles", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    fullName: d.fullName ?? "",
    phone: d.phone ?? "",
    email: d.email ?? "",
  };
}

/** Remembers the phone a signed-in user booked with, for future auto-fill. */
export async function saveUserPhone(uid: string, phone: string) {
  const db = await getFirebaseDb();
  await setDoc(
    doc(db, "userProfiles", uid),
    { phone: phone.trim(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
  phone: string,
) {
  const auth = await getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (fullName.trim()) await updateProfile(credential.user, { displayName: fullName.trim() });
  await upsertUserProfile(credential.user, { fullName, phone });
  return credential.user;
}

export async function signInWithEmail(email: string, password: string) {
  const auth = await getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  await upsertUserProfile(credential.user);
  return credential.user;
}

export async function signInWithGoogle() {
  const { getAdditionalUserInfo } = await import("firebase/auth");
  const auth = await getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  const isNew = getAdditionalUserInfo(credential)?.isNewUser ?? false;
  await upsertUserProfile(credential.user);
  return { user: credential.user, isNew };
}

export async function signOutFirebase() {
  const auth = await getFirebaseAuth();
  await signOut(auth);
}

export async function updateUserPhotoURL(photoURL: string) {
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to update your photo.");
  await updateProfile(user, { photoURL });
  const db = await getFirebaseDb();
  await setDoc(
    doc(db, "userProfiles", user.uid),
    { photoURL, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function updateUserDisplayName(fullName: string) {
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in first.");
  await updateProfile(user, { displayName: fullName });
  const db = await getFirebaseDb();
  await setDoc(
    doc(db, "userProfiles", user.uid),
    { fullName, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** A registered user profile as stored in Firestore. */
export type RegisteredUser = {
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  provider: string;
  photoURL: string;
  isAdmin: boolean;
  disabled: boolean;
  createdAt: string; // ISO string or Firestore timestamp
};

/**
 * Subscribe to all user profiles in real time (for admin dashboard).
 * Returns an unsubscribe function.
 */
export async function subscribeAllUsers(
  onData: (users: RegisteredUser[]) => void,
  onError?: (err: Error) => void,
) {
  const db = await getFirebaseDb();
  const q = query(collection(db, "userProfiles"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const users: RegisteredUser[] = snapshot.docs.map((d) => {
        const data = d.data();
        // Normalize createdAt from Firestore Timestamp to ISO string
        let createdAt = "";
        if (data.createdAt?.toDate) {
          createdAt = data.createdAt.toDate().toISOString();
        } else if (typeof data.createdAt === "string") {
          createdAt = data.createdAt;
        }
        return {
          uid: data.uid ?? d.id,
          email: data.email ?? "",
          fullName: data.fullName ?? "",
          phone: data.phone ?? "",
          provider: data.provider ?? "",
          photoURL: data.photoURL ?? "",
          isAdmin: data.isAdmin ?? false,
          disabled: data.disabled ?? false,
          createdAt,
        };
      });
      // Filter out admin users so only customer registrations show
      onData(users.filter((u) => !u.isAdmin));
    },
    (error) => {
      onError?.(error);
    },
  );
}

/** Disable a user (sets disabled flag on their profile). */
export async function disableUserProfile(uid: string) {
  const db = await getFirebaseDb();
  await setDoc(
    doc(db, "userProfiles", uid),
    { disabled: true, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Re-enable a disabled user. */
export async function enableUserProfile(uid: string) {
  const db = await getFirebaseDb();
  await setDoc(
    doc(db, "userProfiles", uid),
    { disabled: false, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Permanently delete a user's profile document. */
export async function deleteUserProfile(uid: string) {
  const { deleteDoc } = await import("firebase/firestore");
  const db = await getFirebaseDb();
  await deleteDoc(doc(db, "userProfiles", uid));
}
