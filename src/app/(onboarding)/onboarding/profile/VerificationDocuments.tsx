"use client";

import { useState, useEffect, useRef } from "react";
import { sessionApi as api } from "@/lib/api";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import {
  isAllowedKycUpload,
  KYC_FILE_INPUT_ACCEPT,
  KYC_UPLOAD_MAX_BYTES,
  kycUploadMaxSizeLabelMb,
  parseKycUploadErrorMessage,
} from "./kycUploadAllowed";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { notifyApiError, notifyError } from "@/lib/notify";

type DocumentType =
  | "PASSPORT_FRONT"
  | "PASSPORT_BACK"
  | "WORK_PERMIT"
  | "NATIONAL_ID_FRONT"
  | "NATIONAL_ID_BACK"
  | "OTHER_GOVT_ID";

interface DocConfig {
  type: DocumentType;
  label: string;
  description: string;
  required: boolean;
  requiredFor: "all" | "national" | "foreigner";
}

interface UploadedDoc {
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  status: "uploading" | "done" | "error";
  errorDetail?: string;
}

export type KycDocumentRow = {
  documentType: string;
  fileName: string;
  fileUrl: string;
};

const DOC_CONFIG: DocConfig[] = [
  {
    type: "PASSPORT_FRONT",
    label: "Passport (Front)",
    description: "Upload the front side of your valid passport",
    required: true,
    requiredFor: "foreigner",
  },
  {
    type: "PASSPORT_BACK",
    label: "Passport (Back)",
    description: "Upload the back side of your valid passport",
    required: true,
    requiredFor: "foreigner",
  },
  {
    type: "WORK_PERMIT",
    label: "Work Permit / Foreign Card",
    description: "Upload your work permit or foreign card document",
    required: true,
    requiredFor: "foreigner",
  },
  {
    type: "NATIONAL_ID_FRONT",
    label: "National ID (Front)",
    description: "Upload front of your national identity card",
    required: true,
    requiredFor: "national",
  },
  {
    type: "NATIONAL_ID_BACK",
    label: "National ID (Back)",
    description: "Upload back of your national identity card",
    required: true,
    requiredFor: "national",
  },
];

const emptyUploads = (): Record<DocumentType, UploadedDoc | null> => ({
  PASSPORT_FRONT: null,
  PASSPORT_BACK: null,
  WORK_PERMIT: null,
  NATIONAL_ID_FRONT: null,
  NATIONAL_ID_BACK: null,
  OTHER_GOVT_ID: null,
});

function normalizeDocumentType(raw: string): DocumentType | null {
  if (raw === "WORK_PERMIT_FRONT" || raw === "WORK_PERMIT_BACK") {
    return "WORK_PERMIT";
  }
  const uploadedMap = emptyUploads();
  if (raw in uploadedMap) return raw as DocumentType;
  return null;
}

type CitizenDocType = "" | "PASSPORT" | "NATIONAL_ID";

type Props = {
  isNational: boolean;
  citizenDocType: CitizenDocType;
  documents: KycDocumentRow[];
  onDocumentsSynced: () => void;
  onKycSubmitted: () => void;
};

export function VerificationDocuments({
  isNational,
  citizenDocType,
  documents,
  onDocumentsSynced,
  onKycSubmitted,
}: Props) {
  const [uploads, setUploads] =
    useState<Record<DocumentType, UploadedDoc | null>>(emptyUploads);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [preview, setPreview] = useState<{
    url: string;
    fileName: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    const uploadedMap = emptyUploads();
    documents.forEach((doc) => {
      const type = normalizeDocumentType(doc.documentType);
      if (!type) return;
      uploadedMap[type] = {
        type,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        status: "done",
      };
    });
    setUploads(uploadedMap);
  }, [documents]);

  const visibleDocs = DOC_CONFIG.filter((doc) => {
    if (doc.requiredFor === "all") return true;

    const isPassportSlot =
      doc.type === "PASSPORT_FRONT" || doc.type === "PASSPORT_BACK";
    const isWorkPermit = doc.type === "WORK_PERMIT";

    if (isPassportSlot) {
      if (!isNational) return true;
      if (isNational && citizenDocType === "PASSPORT") return true;
      return false;
    }

    if (isWorkPermit) return !isNational;

    if (doc.requiredFor === "national") {
      return isNational && citizenDocType === "NATIONAL_ID";
    }

    return false;
  });

  const requiredDocs = visibleDocs.filter((d) => d.required);
  const allRequiredUploaded = requiredDocs.every(
    (d) => uploads[d.type]?.status === "done",
  );

  const handleFileSelect = async (docType: DocumentType, file: File) => {
    if (file.size > KYC_UPLOAD_MAX_BYTES) {
      setUploads((prev) => ({
        ...prev,
        [docType]: {
          type: docType,
          fileName: file.name,
          fileUrl: "",
          status: "error",
          errorDetail: `This file is too large (max ${kycUploadMaxSizeLabelMb()} MB).`,
        },
      }));
      return;
    }

    if (!isAllowedKycUpload(file)) {
      setUploads((prev) => ({
        ...prev,
        [docType]: {
          type: docType,
          fileName: file.name,
          fileUrl: "",
          status: "error",
          errorDetail:
            "This file type is not accepted. Use documents or media (executables and scripts are blocked).",
        },
      }));
      return;
    }

    setUploads((prev) => ({
      ...prev,
      [docType]: {
        type: docType,
        fileName: file.name,
        fileUrl: "",
        status: "uploading",
      },
    }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", docType);

      const res = await api.post("/kyc/documents/upload", formData);

      setUploads((prev) => ({
        ...prev,
        [docType]: {
          type: docType,
          fileName: file.name,
          fileUrl: res.data.data.fileUrl,
          status: "done",
        },
      }));
      onDocumentsSynced();
    } catch (err) {
      const serverMsg = parseKycUploadErrorMessage(err);
      notifyError(
        serverMsg ?? "Upload failed. Check your connection and try again.",
      );
      setUploads((prev) => ({
        ...prev,
        [docType]: {
          type: docType,
          fileName: file.name,
          fileUrl: "",
          status: "error",
          errorDetail:
            serverMsg ?? "Upload failed. Check your connection and try again.",
        },
      }));
    }
  };

  const handleSubmitKyc = async () => {
    try {
      setIsSubmitting(true);
      await api.post("/kyc/submit");
      onKycSubmitted();
    } catch (error: unknown) {
      notifyApiError(error, "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 relative">
      <AppLoadingOverlay show={isSubmitting} label="Submitting application…" />
      {preview && (
        <DocumentPreviewModal
          open={Boolean(preview)}
          onClose={() => setPreview(null)}
          fileUrl={preview.url}
          fileName={preview.fileName}
          title={preview.title}
        />
      )}
      <p className="text-sm text-slate-500">
        Upload clear copies of your identity documents. Most file types are
        accepted (executables blocked) — max {kycUploadMaxSizeLabelMb()} MB per
        file.
      </p>

      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
          isNational
            ? "bg-blue-50 text-blue-700"
            : "bg-purple-50 text-purple-700"
        }`}
      >
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            isNational ? "bg-blue-500" : "bg-purple-500"
          }`}
        />
        {isNational ? "National Citizen" : "Foreign National"}
      </div>

      <div className="space-y-4">
        {visibleDocs.map((doc) => {
          const upload = uploads[doc.type];
          return (
            <div
              key={doc.type}
              className={`bg-slate-50/80 border rounded-xl p-5 transition-colors ${
                upload?.status === "done"
                  ? "border-red-200"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {doc.label}
                    </h3>
                    {doc.required && (
                      <span className="text-xs text-red-500 font-medium">
                        Required
                      </span>
                    )}
                    {!doc.required && (
                      <span className="text-xs text-slate-400">Optional</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{doc.description}</p>

                  {upload && (
                    <div
                      className={`mt-2 flex items-center gap-2 text-xs ${
                        upload.status === "done"
                          ? "text-red-700"
                          : upload.status === "uploading"
                            ? "text-slate-500"
                            : "text-red-500"
                      }`}
                    >
                      {upload.status === "uploading" && (
                        <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      )}
                      {upload.status === "done" && (
                        <svg
                          className="w-3.5 h-3.5 text-red-600"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      {upload.status === "error" && (
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      <span className="truncate max-w-xs">
                        {upload.status === "uploading" &&
                          `Uploading ${upload.fileName}...`}
                        {upload.status === "done" && upload.fileName}
                        {upload.status === "error" &&
                          (upload.errorDetail ??
                            "Upload failed. Try a different file or format.")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <input
                    type="file"
                    accept={KYC_FILE_INPUT_ACCEPT}
                    className="hidden"
                    ref={(el) => {
                      fileInputRefs.current[doc.type] = el;
                    }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(doc.type, file);
                      e.target.value = "";
                    }}
                  />
                  {upload?.status === "done" && upload.fileUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPreview({
                          url: upload.fileUrl,
                          fileName: upload.fileName,
                          title: doc.label,
                        })
                      }
                      className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      View
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[doc.type]?.click()}
                    disabled={upload?.status === "uploading"}
                    className={`cursor-pointer h-9 px-4 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                      upload?.status === "done"
                        ? "border-red-200 text-red-700 hover:bg-red-50"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {upload?.status === "uploading"
                      ? "Uploading..."
                      : upload?.status === "done"
                        ? "Replace"
                        : "Upload"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Ready to submit?
            </p>
            <p className="text-sm text-slate-500 mt-0.5">
              {allRequiredUploaded
                ? "All required documents uploaded. You can now submit your application."
                : `Upload all required documents to continue.`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSubmitKyc}
            disabled={!allRequiredUploaded || isSubmitting}
            className="cursor-pointer shrink-0 h-10 px-5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit KYC Application"
            )}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          {requiredDocs.map((doc) => {
            const isDone = uploads[doc.type]?.status === "done";
            return (
              <div key={doc.type} className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isDone ? "bg-red-500" : "bg-slate-200"
                  }`}
                />
                <span
                  className={`text-xs ${
                    isDone ? "text-red-700" : "text-slate-400"
                  }`}
                >
                  {doc.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
