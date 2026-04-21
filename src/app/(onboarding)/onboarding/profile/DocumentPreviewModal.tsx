"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  title: string;
};

function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isImageExt(ext: string) {
  return [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "tif",
    "tiff",
    "heic",
    "heif",
  ].includes(ext);
}

export function DocumentPreviewModal({
  open,
  onClose,
  fileUrl,
  fileName,
  title,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const ext = extOf(fileName);
  const isPdf = ext === "pdf";
  const isImg = isImageExt(ext);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close preview"
        className="absolute inset-0 bg-slate-900/75 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl ring-1 ring-black/5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-preview-title"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0 text-left">
            <p
              id="doc-preview-title"
              className="truncate text-sm font-semibold text-slate-900"
            >
              {title}
            </p>
            <p className="truncate text-xs text-slate-500">{fileName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-teal-600 hover:text-teal-700"
            >
              Open in new tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
              aria-label="Close"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-slate-50 to-slate-100/80 p-4 sm:p-6">
          {isImg ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded S3 URLs */}
              <img
                src={fileUrl}
                alt={title}
                className="max-h-[min(72vh,720px)] max-w-full rounded-xl object-contain shadow-lg ring-1 ring-slate-200/60"
              />
            </div>
          ) : isPdf ? (
            <iframe
              title={title}
              src={fileUrl}
              className="h-[min(72vh,720px)] w-full rounded-xl border border-slate-200 bg-white shadow-inner"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <p className="max-w-sm text-sm text-slate-600">
                Live preview isn&apos;t available for this file type. Open it in
                a new tab to view or download.
              </p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center rounded-lg bg-teal-600 px-5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
              >
                Open file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
