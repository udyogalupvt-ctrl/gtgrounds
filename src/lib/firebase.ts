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
import { doc, getFirestore, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
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
  const auth = await getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  await upsertUserProfile(credential.user);
  return credential.user;
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
