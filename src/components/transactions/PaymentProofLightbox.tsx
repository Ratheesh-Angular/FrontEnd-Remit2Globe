"use client";

type PaymentProofLightboxProps = {
  url: string | null;
  onClose: () => void;
};

export function PaymentProofLightbox({ url, onClose }: PaymentProofLightboxProps) {
  if (!url) return null;
  return (
    <button
      type="button"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      aria-label="Close image preview"
    >
      <span className="sr-only">Close</span>
      <img
        src={url}
        alt="Payment proof"
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </button>
  );
}
