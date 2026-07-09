"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { sessionApi as api } from "@/lib/api";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import type { KycDocumentRow } from "./VerificationDocuments";
import { SectionLabel } from "./KycFormPrimitives";
import {
  isAllowedKycUpload,
  KYC_FILE_INPUT_ACCEPT,
  KYC_UPLOAD_MAX_BYTES,
  kycUploadMaxSizeLabelMb,
  parseKycUploadErrorMessage,
} from "./kycUploadAllowed";

type CorporateDocType =
  | "CERTIFICATE_OF_INCORPORATION"
  | "TRADING_LICENSE"
  | "CR12"
  | "REGULATORY_LICENSE"
  | "PROOF_OF_ADDRESS";

interface DocConfig {
  type: CorporateDocType;
  label: string;
  description: string;
  required: boolean;
}

interface UploadedDoc {
  type: CorporateDocType;
  fileName: string;
  fileUrl: string;
  status: "uploading" | "done" | "error";
  errorDetail?: string;
}

const BASE_DOC_CONFIG: DocConfig[] = [
  {
    type: "CERTIFICATE_OF_INCORPORATION",
    label: "Certificate of Incorporation",
    description: "Official certificate from the registrar of companies.",
    required: true,
  },
  {
    type: "TRADING_LICENSE",
    label: "Trading License",
    description: "Current trading or business license.",
    required: true,
  },
  {
    type: "CR12",
    label: "Company Detailed Information (e.g. CR12)",
    description: "Detailed company information extract or equivalent.",
    required: true,
  },
  {
    type: "PROOF_OF_ADDRESS",
    label: "Proof of Business Address",
    description:
      "Utility bill, lease, or bank statement showing business address.",
    required: true,
  },
];

const REGULATORY_CONFIG: DocConfig = {
  type: "REGULATORY_LICENSE",
  label: "Regulatory License",
  description: "Sector-specific regulatory license (if applicable).",
  required: true,
};

const COMPANY_TYPES = new Set<CorporateDocType>([
  "CERTIFICATE_OF_INCORPORATION",
  "TRADING_LICENSE",
  "CR12",
  "REGULATORY_LICENSE",
]);

function emptyUploads(): Record<CorporateDocType, UploadedDoc | null> {
  return {
    CERTIFICATE_OF_INCORPORATION: null,
    TRADING_LICENSE: null,
    CR12: null,
    REGULATORY_LICENSE: null,
    PROOF_OF_ADDRESS: null,
  };
}

function docSectionsForConfig(docConfig: DocConfig[]) {
  const companyItems = docConfig.filter((d) => COMPANY_TYPES.has(d.type));
  const premisesItems = docConfig.filter((d) => d.type === "PROOF_OF_ADDRESS");
  const sections: { id: string; title: string; items: DocConfig[] }[] = [];
  if (companyItems.length)
    sections.push({
      id: "corp-kyc-docs-company",
      title: "Company & registration",
      items: companyItems,
    });
  if (premisesItems.length)
    sections.push({
      id: "corp-kyc-docs-premises",
      title: "Business premises",
      items: premisesItems,
    });
  return sections;
}

function sectionCompletion(
  items: DocConfig[],
  uploads: Record<string, UploadedDoc | null>,
) {
  const req = items.filter((i) => i.required);
  const done = req.filter((i) => uploads[i.type]?.status === "done").length;
  return { done, total: req.length };
}

type Props = {
  regulatoryLicenseRequired: boolean;
  documents: KycDocumentRow[];
  onDocumentsSynced: () => void;
  onKycSubmitted: () => void;
};

export function CorporateVerificationDocuments({
  regulatoryLicenseRequired,
  documents,
  onDocumentsSynced,
  onKycSubmitted,
}: Props) {
  const [uploads, setUploads] =
    useState<Record<CorporateDocType, UploadedDoc | null>>(emptyUploads);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [preview, setPreview] = useState<{
    url: string;
    fileName: string;
    title: string;
  } | null>(null);

  const docConfig = regulatoryLicenseRequired
    ? [
        BASE_DOC_CONFIG[0],
        BASE_DOC_CONFIG[1],
        BASE_DOC_CONFIG[2],
        REGULATORY_CONFIG,
        ...BASE_DOC_CONFIG.slice(3),
      ]
    : BASE_DOC_CONFIG;

  useEffect(() => {
    const uploadedMap = emptyUploads();
    documents.forEach((doc) => {
      const t = doc.documentType as CorporateDocType;
      if (t in uploadedMap) {
        uploadedMap[t] = {
          type: t,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          status: "done",
        };
      }
    });
    setUploads(uploadedMap);
  }, [documents]);

  const requiredDocs = docConfig.filter((d) => d.required);
  const allRequiredUploaded = requiredDocs.every(
    (d) => uploads[d.type]?.status === "done",
  );

  const uploadedRequiredCount = requiredDocs.filter(
    (d) => uploads[d.type]?.status === "done",
  ).length;
  const requiredTotal = requiredDocs.length;

  const missingLabels = requiredDocs
    .filter((d) => uploads[d.type]?.status !== "done")
    .map((d) => d.label);

  const groupedSections = useMemo(() => {
    const cfg = regulatoryLicenseRequired
      ? [
          BASE_DOC_CONFIG[0],
          BASE_DOC_CONFIG[1],
          BASE_DOC_CONFIG[2],
          REGULATORY_CONFIG,
          ...BASE_DOC_CONFIG.slice(3),
        ]
      : BASE_DOC_CONFIG;
    return docSectionsForConfig(cfg);
  }, [regulatoryLicenseRequired]);

  const handleFileSelect = async (docType: CorporateDocType, file: File) => {
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
      setSubmitError("");
      await api.post("/kyc/submit");
      onKycSubmitted();
    } catch (error: unknown) {
      const msg =
        error &&
        typeof error === "object" &&
        "response" in error &&
        (error as { response?: { data?: { message?: string } } }).response?.data
          ?.message;
      setSubmitError(
        typeof msg === "string"
          ? msg
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPct =
    requiredTotal > 0
      ? Math.round((uploadedRequiredCount / requiredTotal) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {preview && (
        <DocumentPreviewModal
          open={Boolean(preview)}
          onClose={() => setPreview(null)}
          fileUrl={preview.url}
          fileName={preview.fileName}
          title={preview.title}
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-4 sm:py-3.5 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">
            {uploadedRequiredCount} of {requiredTotal} required uploads complete
          </p>
          <nav
            aria-label="Skip to document sections"
            className="flex flex-wrap gap-x-2 gap-y-1"
          >
            {groupedSections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs font-medium text-red-700 hover:text-red-800 underline-offset-2 hover:underline"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={uploadedRequiredCount}
          aria-valuemin={0}
          aria-valuemax={requiredTotal}
          aria-label="Upload progress"
        >
          <div
            className="h-full rounded-full bg-red-600 transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {/* {missingLabels.length > 0 ? (
          <p className="text-xs text-slate-600 leading-snug">
            <span className="font-medium text-slate-700">Still needed:</span>{" "}
            {missingLabels.join(" · ")}
          </p>
        ) : (
          <p className="text-xs font-medium text-red-800">
            All required documents uploaded—you can submit below.
          </p>
        )} */}
      </div>

      <div className="space-y-8">
        {groupedSections.map((section) => {
          const { done, total } = sectionCompletion(section.items, uploads);
          return (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 space-y-3"
              aria-labelledby={`${section.id}-heading`}
            >
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <SectionLabel>
                    <span id={`${section.id}-heading`}>{section.title}</span>
                  </SectionLabel>
                </div>
                <span className="text-xs font-medium tabular-nums text-slate-500 shrink-0">
                  {done}/{total} required
                </span>
              </div>
              <ul className="space-y-2 list-none p-0 m-0">
                {section.items.map((doc) => {
                  const upload = uploads[doc.type];
                  const doneRow = upload?.status === "done";
                  return (
                    <li
                      key={doc.type}
                      className={`rounded-lg border px-3 py-3 sm:px-4 transition-colors ${
                        doneRow
                          ? "border-red-200 bg-red-50/25"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {doc.label}
                            </h3>
                            {doc.required && (
                              <span className="text-[11px] font-medium uppercase tracking-wide text-red-500">
                                Required
                              </span>
                            )}
                            {upload?.status === "done" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">
                                <svg
                                  className="h-3 w-3 shrink-0"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Uploaded
                              </span>
                            )}
                            {upload?.status === "uploading" && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                                Uploading…
                              </span>
                            )}
                            {upload?.status === "error" && (
                              <span className="text-xs font-medium text-red-600">
                                Upload failed
                              </span>
                            )}
                          </div>
                          {upload?.status === "done" && (
                            <p
                              className="truncate text-xs text-red-800/90"
                              title={upload.fileName}
                            >
                              {upload.fileName}
                            </p>
                          )}
                          {upload?.status === "error" && (
                            <p className="text-xs text-red-600">
                              {upload.errorDetail ??
                                "Upload failed. Try a different file or format."}
                            </p>
                          )}
                          <details className="group text-xs text-slate-600">
                            <summary className="cursor-pointer list-none font-medium text-red-700 hover:text-red-800 [&::-webkit-details-marker]:hidden">
                              <span className="underline-offset-2 group-open:no-underline hover:underline">
                                What to upload
                              </span>
                            </summary>
                            <p className="mt-2 border-l-2 border-slate-200 pl-3 leading-snug text-slate-600">
                              {doc.description}
                            </p>
                          </details>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
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
                              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:min-h-0 sm:h-9"
                            >
                              View
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              fileInputRefs.current[doc.type]?.click()
                            }
                            disabled={upload?.status === "uploading"}
                            className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border px-4 text-xs font-medium transition-colors disabled:opacity-50 sm:min-h-0 sm:h-9 ${
                              upload?.status === "done"
                                ? "border-red-200 text-red-700 hover:bg-red-50"
                                : "border-slate-200 bg-red-600 text-white hover:bg-red-700"
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
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              Ready to submit?
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {allRequiredUploaded
                ? "Your application will go to compliance review (KYC/AML)."
                : `Upload all ${requiredTotal} required documents to enable submission.`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSubmitKyc}
            disabled={!allRequiredUploaded || isSubmitting}
            className="inline-flex min-h-[44px] w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:h-10 sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Submitting...
              </>
            ) : (
              "Submit KYC Application"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
