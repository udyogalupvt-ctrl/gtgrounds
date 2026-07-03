const CLOUD_NAME = "dcoimqij";
const UPLOAD_PRESET = "Jilani";

async function uploadToCloudinary(file: File, folder: string, maxSizeMb: number) {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("Upload an image or video file.");
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`File must be under ${maxSizeMb} MB.`);
  }

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", UPLOAD_PRESET);
  body.append("folder", folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: "POST",
    body,
  });

  const payload = await response.json();
  if (!response.ok || !payload.secure_url) {
    throw new Error(payload.error?.message ?? "Cloudinary upload failed.");
  }

  return payload.secure_url as string;
}

export async function uploadPaymentProof(file: File) {
  return uploadToCloudinary(file, "jilani-payment-proofs", 20);
}

export async function uploadGalleryMedia(file: File) {
  return uploadToCloudinary(file, "jilani-gallery", 100);
}

export async function uploadProfilePhoto(file: File) {
  return uploadToCloudinary(file, "jilani-profile-photos", 8);
}
