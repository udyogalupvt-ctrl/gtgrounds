const CLOUD_NAME = "dcoimqij";
const UPLOAD_PRESET = "Jilani";

type UploadOptions = { onProgress?: (percent: number) => void };

// Uses XMLHttpRequest (not fetch) so we can report real upload progress to the
// UI — fetch has no upload-progress events.
function uploadToCloudinary(
  file: File,
  folder: string,
  maxSizeMb: number,
  options: UploadOptions = {},
): Promise<string> {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return Promise.reject(new Error("Upload an image or video file."));
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    return Promise.reject(new Error(`File must be under ${maxSizeMb} MB.`));
  }

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", UPLOAD_PRESET);
  body.append("folder", folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && payload.secure_url) {
          resolve(payload.secure_url as string);
        } else {
          reject(new Error(payload.error?.message ?? "Cloudinary upload failed."));
        }
      } catch {
        reject(new Error("Cloudinary upload failed."));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload. Try again."));
    xhr.send(body);
  });
}

export function uploadPaymentProof(file: File, options?: UploadOptions) {
  return uploadToCloudinary(file, "jilani-payment-proofs", 20, options);
}

export function uploadGalleryMedia(file: File, options?: UploadOptions) {
  return uploadToCloudinary(file, "jilani-gallery", 100, options);
}

export function uploadProfilePhoto(file: File, options?: UploadOptions) {
  return uploadToCloudinary(file, "jilani-profile-photos", 8, options);
}
