"use client";

import { useRef, useState } from "react";
import { sessionApi as api } from "@/lib/api";
import { DocumentPreviewModal } from "@/app/(onboarding)/onboarding/profile/DocumentPreviewModal";
import {
  isAllowedKycUpload,
  KYC_FILE_INPUT_ACCEPT,
  KYC_UPLOAD_MAX_BYTES,
  kycUploadMaxSizeLabelMb,
  parseKycUploadErrorMessage,
} from "@/app/(onboarding)/onboarding/profile/kycUploadAllowed";

export type RemittanceSupportingDocKind = "INVOICE" | "BILL_OF_LADING";

export type RemittanceSupportingDocumentRow = {
  id: string;
  docType: RemittanceSupportingDocKind;
  fileName: string;
  fileUrl: string;
};

function normalizeDocKind(raw: string): RemittanceSupportingDocKind {
  const u = raw.toUpperCase().replace(/-/g, "_");
  if (u === "BILL_OF_LADING" || u === "BILLOFLADING" || u === "BILL_OF_LANDING")
    return "BILL_OF_LADING";
  return "INVOICE";
}

const CORP_DOCS: Array<{
  type: RemittanceSupportingDocKind;
  label: string;
  description: string;
}> = [
  {
    type: "INVOICE",
    label: "Invoice",
    description: "Commercial or pro-forma invoice related to this transfer",
  },
  {
    type: "BILL_OF_LADING",
    label: "Additional documents",
    description: "Additional documents related to this transfer",
  },
];

type Props = {
  transferId: string | null;
  documents: RemittanceSupportingDocumentRow[];
  disabled?: boolean;
  onDocumentUploaded: (doc: RemittanceSupportingDocumentRow) => void;
};

export function CorporateSupportingDocumentsSection({
  transferId,
  documents,
  disabled,
  onDocumentUploaded,
}: Props) {
  const fileInputRefs = useRef<
    Partial<Record<RemittanceSupportingDocKind, HTMLInputElement | null>>
  >({});
  const [preview, setPreview] = useState<{
    url: string;
    fileName: string;
    title: string;
  } | null>(null);
  const [uploadingType, setUploadingType] =
    useState<RemittanceSupportingDocKind | null>(null);
  const [slotErrors, setSlotErrors] = useState<
    Partial<Record<RemittanceSupportingDocKind, string>>
  >({});

  const docRow = (kind: RemittanceSupportingDocKind) =>
    documents.find((d) => d.docType === kind);

  const handleFileSelect = async (
    docType: RemittanceSupportingDocKind,
    file: File,
  ) => {
    setSlotErrors((prev) => ({ ...prev, [docType]: undefined }));
    if (!transferId) return;

    if (file.size > KYC_UPLOAD_MAX_BYTES) {
      setSlotErrors((prev) => ({
        ...prev,
        [docType]: `This file is too large (max ${kycUploadMaxSizeLabelMb()} MB).`,
      }));
      return;
    }
    if (!isAllowedKycUpload(file)) {
      setSlotErrors((prev) => ({
        ...prev,
        [docType]:
          "This file type is not accepted. Use documents or media (executables and scripts are blocked).",
      }));
      return;
    }

    setUploadingType(docType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", docType);
      const res = await api.post<{
        data: {
          document: {
            id: string;
            docType: string;
            fileName: string;
            fileUrl: string;
          };
        };
      }>(`/remittance/transfers/${transferId}/supporting-doc`, formData);
      const d = res.data.data.document;
      onDocumentUploaded({
        id: d.id,
        docType: normalizeDocKind(d.docType),
        fileName: d.fileName,
        fileUrl: d.fileUrl,
      });
    } catch (err) {
      const serverMsg = parseKycUploadErrorMessage(err);
      setSlotErrors((prev) => ({
        ...prev,
        [docType]:
          serverMsg ?? "Upload failed. Check your connection and try again.",
      }));
    } finally {
      setUploadingType(null);
    }
  };

  const hasOneOrMore = documents.length > 0;

  return (
    <div className="space-y-4 pt-4 border-t border-slate-100">
      {preview && (
        <DocumentPreviewModal
          open={Boolean(preview)}
          onClose={() => setPreview(null)}
          fileUrl={preview.url}
          fileName={preview.fileName}
          title={preview.title}
        />
      )}
      <div>
        <label className="text-sm font-medium text-slate-700 block mb-1">
          Supporting documents <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-slate-500 mb-2 leading-relaxed">
          For corporate senders, upload an <strong>invoice</strong> and/or a{" "}
          <strong>bill of lading</strong>.{" "}
          <span className="text-slate-700 font-medium">
            At least one file is required before you continue.
          </span>{" "}
          Most file types are accepted (executables blocked) — max{" "}
          {kycUploadMaxSizeLabelMb()} MB per file.
        </p>
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            hasOneOrMore
              ? "bg-teal-50 text-teal-800"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              hasOneOrMore ? "bg-teal-500" : "bg-amber-500"
            }`}
          />
          {hasOneOrMore
            ? "Supporting document on file"
            : "Upload invoice and/or bill of lading"}
        </div>
      </div>

      <div className="space-y-4">
        {CORP_DOCS.map((doc) => {
          const server = docRow(doc.type);
          const uploading = uploadingType === doc.type;
          const err = slotErrors[doc.type];

          return (
            <div
              key={doc.type}
              className={`bg-slate-50/80 border rounded-xl p-5 transition-colors ${
                server ? "border-teal-200" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {doc.label}
                    </h3>
                    {/* <span className="text-xs text-slate-400">Optional</span> */}
                  </div>
                  <p className="text-xs text-slate-500">{doc.description}</p>

                  {(uploading || server || err) && (
                    <div
                      className={`mt-2 flex items-center gap-2 text-xs ${
                        server
                          ? "text-teal-700"
                          : uploading
                            ? "text-slate-500"
                            : "text-red-500"
                      }`}
                    >
                      {uploading && (
                        <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      )}
                      {!uploading && server && (
                        <svg
                          className="w-3.5 h-3.5 text-teal-600"
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
                      )}
                      {!uploading && err && (
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      <span className="truncate max-w-xs">
                        {uploading && "Uploading..."}
                        {!uploading && server && server.fileName}
                        {!uploading && err && err}
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
                    disabled={Boolean(disabled) || !transferId || uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileSelect(doc.type, file);
                      e.target.value = "";
                    }}
                  />
                  {server?.fileUrl ? (
                    <button
                      type="button"
                      disabled={Boolean(disabled)}
                      onClick={() =>
                        setPreview({
                          url: server.fileUrl,
                          fileName: server.fileName,
                          title: doc.label,
                        })
                      }
                      className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      View
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[doc.type]?.click()}
                    disabled={Boolean(disabled) || !transferId || uploading}
                    className={`cursor-pointer h-9 px-4 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      server
                        ? "border-teal-200 text-teal-700 hover:bg-teal-50"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {uploading ? "Uploading..." : server ? "Replace" : "Upload"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!transferId && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Save progress through the corridor and beneficiary steps first; then
          you can attach documents to this draft transfer.
        </p>
      )}
    </div>
  );
}
