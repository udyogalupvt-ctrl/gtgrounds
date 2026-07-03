import QRCode from "qrcode";

/**
 * Builds a standard UPI deep-link. When an amount is supplied the payer's app
 * pre-fills it, so the QR/scan carries the exact booking total.
 */
export function buildUpiUri(params: { upiId: string; upiName: string; amount?: number }): string {
  const parts = [
    `pa=${encodeURIComponent(params.upiId)}`,
    `pn=${encodeURIComponent(params.upiName)}`,
    "cu=INR",
  ];
  if (params.amount && params.amount > 0) parts.push(`am=${params.amount}`);
  return `upi://pay?${parts.join("&")}`;
}

/** Renders a UPI URI to a PNG data URL entirely on the client (no network). */
export function generateUpiQr(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0D0D0D", light: "#FFFFFF" },
  });
}
