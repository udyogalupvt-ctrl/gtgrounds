import { createServerFn } from "@tanstack/react-start";

export const getFirebasePublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Firebase API key is not configured.");
  }

  return {
    apiKey,
    authDomain: "jilani-bba6a.firebaseapp.com",
    projectId: "jilani-bba6a",
    storageBucket: "jilani-bba6a.firebasestorage.app",
    messagingSenderId: "1061161538387",
    appId: "1:1061161538387:web:fed82bb8695700c34c87a6",
    measurementId: "G-T39T3HCF88",
  };
});
