import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SPORTS, formatHour, formatINR } from "./venue";

// Sends an FCM web push to every registered admin browser when a customer
// submits a booking, payment proof, or function inquiry. Uses the FCM HTTP v1
// API directly with a service-account-signed OAuth token — no extra deps.

const alertSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("booking_created"),
    sport: z.enum(["box_cricket", "volleyball", "badminton"]),
    bookingDate: z.string().max(40),
    startHour: z.number().min(0).max(24),
    endHour: z.number().min(0).max(24),
    totalAmount: z.number().min(0),
    customerName: z.string().max(120),
    customerPhone: z.string().max(40),
  }),
  z.object({
    kind: z.literal("payment_submitted"),
    sport: z.enum(["box_cricket", "volleyball", "badminton"]),
    bookingDate: z.string().max(40),
    totalAmount: z.number().min(0),
    customerName: z.string().max(120),
  }),
  z.object({
    kind: z.literal("inquiry_created"),
    eventType: z.string().max(80),
    preferredDate: z.string().max(40),
    expectedGuests: z.number().min(0),
    customerName: z.string().max(120),
    customerPhone: z.string().max(40),
  }),
  z.object({
    kind: z.literal("booking_cancelled"),
    sport: z.enum(["box_cricket", "volleyball", "badminton"]),
    bookingDate: z.string().max(40),
    startHour: z.number().min(0).max(24),
    endHour: z.number().min(0).max(24),
    customerName: z.string().max(120),
    customerPhone: z.string().max(40),
  }),
  z.object({
    kind: z.literal("booking_rescheduled"),
    sport: z.enum(["box_cricket", "volleyball", "badminton"]),
    oldDate: z.string().max(40),
    oldStartHour: z.number().min(0).max(24),
    oldEndHour: z.number().min(0).max(24),
    bookingDate: z.string().max(40),
    startHour: z.number().min(0).max(24),
    endHour: z.number().min(0).max(24),
    totalAmount: z.number().min(0),
    customerName: z.string().max(120),
    customerPhone: z.string().max(40),
  }),
  z.object({
    kind: z.literal("user_registered"),
    fullName: z.string().max(120),
    email: z.string().max(200),
    phone: z.string().max(40),
    provider: z.string().max(40),
  }),
]);

type AdminAlert = z.infer<typeof alertSchema>;

function composeMessage(alert: AdminAlert): { title: string; body: string; tag: string } {
  switch (alert.kind) {
    case "booking_created":
      return {
        title: `New booking — ${SPORTS[alert.sport].name}`,
        body: `${alert.customerName} (${alert.customerPhone}) booked ${alert.bookingDate}, ${formatHour(alert.startHour)}–${formatHour(alert.endHour)} · ${formatINR(alert.totalAmount)}. Payment proof attached — verify in the dashboard.`,
        tag: `booking-${alert.bookingDate}-${alert.startHour}`,
      };
    case "payment_submitted":
      return {
        title: `Payment proof — ${SPORTS[alert.sport].name}`,
        body: `${alert.customerName} submitted payment proof for ${alert.bookingDate} · ${formatINR(alert.totalAmount)}. Verify it in the dashboard.`,
        tag: `payment-${alert.bookingDate}-${alert.customerName}`,
      };
    case "inquiry_created":
      return {
        title: `New function inquiry — ${alert.eventType}`,
        body: `${alert.customerName} (${alert.customerPhone}) · ${alert.preferredDate} · ${alert.expectedGuests} guests`,
        tag: `inquiry-${alert.preferredDate}-${alert.customerName}`,
      };
    case "booking_cancelled":
      return {
        title: `Booking cancelled — ${SPORTS[alert.sport].name}`,
        body: `${alert.customerName} (${alert.customerPhone}) cancelled ${alert.bookingDate}, ${formatHour(alert.startHour)}–${formatHour(alert.endHour)}. The slot is free again.`,
        tag: `cancel-${alert.bookingDate}-${alert.startHour}`,
      };
    case "booking_rescheduled":
      return {
        title: `Booking rescheduled — ${SPORTS[alert.sport].name}`,
        body: `${alert.customerName} (${alert.customerPhone}) moved ${alert.oldDate} ${formatHour(alert.oldStartHour)}–${formatHour(alert.oldEndHour)} → ${alert.bookingDate} ${formatHour(alert.startHour)}–${formatHour(alert.endHour)} · ${formatINR(alert.totalAmount)}`,
        tag: `reschedule-${alert.bookingDate}-${alert.startHour}`,
      };
    case "user_registered":
      return {
        title: `New user registered`,
        body: `${alert.fullName || "A user"} (${alert.email})${alert.phone ? ` · ${alert.phone}` : ""} just signed up via ${alert.provider}.`,
        tag: `signup-${alert.email}`,
      };
  }
}

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri: string;
};

function getServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    console.error("[admin-notify] FIREBASE_SERVICE_ACCOUNT is not valid JSON.");
    return null;
  }
}

// Google endpoints occasionally drop a connection ("fetch failed" with no HTTP
// response) from serverless/SSR runtimes. Retry transient network failures with
// a short backoff and a hard timeout so a single flaky socket doesn't silently
// swallow an admin notification.
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 3, timeoutMs = 10_000 }: { retries?: number; timeoutMs?: number } = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.value;
  }
  const { createSign } = await import("node:crypto");
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope:
      "https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(sa.private_key).toString("base64url")}`;

  const response = await fetchWithRetry(sa.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!response.ok || !payload.access_token) {
    throw new Error(`Could not obtain Google access token (HTTP ${response.status}).`);
  }
  cachedAccessToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  return payload.access_token;
}

const FIRESTORE_BASE = (projectId: string) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

async function listAdminTokens(
  sa: ServiceAccount,
  accessToken: string,
): Promise<{ token: string; docName: string }[]> {
  const response = await fetchWithRetry(
    `${FIRESTORE_BASE(sa.project_id)}/adminPushTokens?pageSize=300`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`Could not list admin push tokens (HTTP ${response.status}).`);
  }
  const payload = (await response.json()) as {
    documents?: { name: string; fields?: { token?: { stringValue?: string } } }[];
  };
  return (payload.documents ?? [])
    .map((docEntry) => ({
      token: docEntry.fields?.token?.stringValue ?? docEntry.name.split("/").pop() ?? "",
      docName: docEntry.name,
    }))
    .filter((entry) => entry.token.length > 0);
}

async function deleteStaleToken(accessToken: string, docName: string) {
  await fetch(`https://firestore.googleapis.com/v1/${docName}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}

async function sendPush(
  sa: ServiceAccount,
  accessToken: string,
  target: { token: string; docName: string },
  message: { title: string; body: string; tag: string },
): Promise<boolean> {
  const response = await fetchWithRetry(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token: target.token,
          // Data-only payload: the service worker (background) or the in-app
          // listener (foreground) decides how to display it.
          data: {
            title: message.title,
            body: message.body,
            tag: message.tag,
            url: "/admin/dashboard",
          },
          webpush: { headers: { Urgency: "high", TTL: "86400" } },
        },
      }),
    },
  );
  if (response.ok) return true;

  const errorBody = await response.text();
  // Purge tokens for uninstalled/expired browser registrations.
  if (
    response.status === 404 ||
    errorBody.includes("UNREGISTERED") ||
    errorBody.includes("INVALID_ARGUMENT")
  ) {
    await deleteStaleToken(accessToken, target.docName);
  } else {
    console.error(
      `[admin-notify] FCM send failed (HTTP ${response.status}): ${errorBody.slice(0, 300)}`,
    );
  }
  return false;
}

export const notifyAdmins = createServerFn({ method: "POST" })
  .validator(alertSchema)
  .handler(async ({ data }) => {
    const sa = getServiceAccount();
    if (!sa) {
      console.error(
        "[admin-notify] FIREBASE_SERVICE_ACCOUNT missing — skipping push notification.",
      );
      return { sent: 0, failed: 0 };
    }
    try {
      const accessToken = await getAccessToken(sa);
      const targets = await listAdminTokens(sa, accessToken);
      if (targets.length === 0) return { sent: 0, failed: 0 };

      const message = composeMessage(data);
      const results = await Promise.all(
        targets.map((target) => sendPush(sa, accessToken, target, message)),
      );
      const sent = results.filter(Boolean).length;
      return { sent, failed: results.length - sent };
    } catch (error) {
      console.error("[admin-notify]", error);
      if (error instanceof Error && error.cause) {
        console.error("[admin-notify] cause:", error.cause);
      }
      return { sent: 0, failed: 0 };
    }
  });
