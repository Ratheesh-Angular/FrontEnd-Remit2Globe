/** Matches backend KYC upload limits in `upload.middleware.ts` (keep in sync). */

export const KYC_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/** Non-image/text MIME types we accept explicitly (office, pdf, etc.). */
const SPECIFIC_ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

/** Block obvious installers/scripts (must match `upload.middleware.ts`). */
export const KYC_BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".msi",
  ".bat",
  ".cmd",
  ".com",
  ".scr",
  ".pif",
  ".dll",
  ".sys",
  ".vbs",
  ".vbe",
  ".ps1",
  ".psm1",
  ".app",
  ".deb",
  ".rpm",
]);

function mimeBlocked(t: string): boolean {
  const m = t.trim().toLowerCase();
  return (
    m === "application/x-msdownload" ||
    m === "application/x-msdos-program" ||
    m === "application/x-executable" ||
    m === "application/x-sharedlib" ||
    m === "application/javascript" ||
    m === "application/ecmascript" ||
    m === "text/javascript"
  );
}

export function kycUploadFileExtension(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i).toLowerCase() : "";
}

export function isAllowedKycUpload(file: File): boolean {
  const ext = kycUploadFileExtension(file.name);
  if (KYC_BLOCKED_EXTENSIONS.has(ext)) return false;

  const t = file.type.trim().toLowerCase();
  if (mimeBlocked(t)) return false;
  if (t.startsWith("image/") || t.startsWith("text/")) return true;
  if (t.startsWith("video/") || t.startsWith("audio/")) return true;
  if (SPECIFIC_ALLOWED_MIMES.has(t)) return true;
  if (
    t.startsWith("application/") &&
    !mimeBlocked(t) &&
    !KYC_BLOCKED_EXTENSIONS.has(ext)
  ) {
    return true;
  }

  if (!t || t === "application/octet-stream") {
    return ext !== "" && !KYC_BLOCKED_EXTENSIONS.has(ext);
  }

  return false;
}

/** Let the system file picker show all types; `isAllowedKycUpload` still validates. */
export const KYC_FILE_INPUT_ACCEPT = "*/*";

export function kycUploadMaxSizeLabelMb(): number {
  return Math.round(KYC_UPLOAD_MAX_BYTES / (1024 * 1024));
}

export function parseKycUploadErrorMessage(error: unknown): string | undefined {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    (error as { response?: { data?: { message?: unknown } } }).response?.data
  ) {
    const m = (error as { response: { data: { message?: unknown } } }).response
      .data.message;
    if (typeof m === "string") return m;
  }
  return undefined;
}
