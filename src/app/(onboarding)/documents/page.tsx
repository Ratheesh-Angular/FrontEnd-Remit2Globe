"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth.store";
import api from "@/lib/api";

type DocumentType =
  | "PASSPORT"
  | "WORK_PERMIT"
  | "NATIONAL_ID"
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
}

const DOC_CONFIG: DocConfig[] = [
  {
    type: "PASSPORT",
    label: "Passport",
    description: "Upload the photo page of your valid passport",
    required: true,
    requiredFor: "foreigner",
  },
  {
    type: "WORK_PERMIT",
    label: "Work Permit",
    description: "Upload your valid work permit or residence permit",
    required: true,
    requiredFor: "foreigner",
  },
  {
    type: "NATIONAL_ID",
    label: "National ID",
    description: "Upload front and back of your national identity card",
    required: true,
    requiredFor: "national",
  },
  {
    type: "OTHER_GOVT_ID",
    label: "Other Government Approved ID",
    description: "Any other government issued identification document",
    required: false,
    requiredFor: "all",
  },
];

export default function DocumentsPage() {
  const { user } = useAuthStore();
  const [isNational, setIsNational] = useState(false);
  const [uploads, setUploads] = useState<
    Record<DocumentType, UploadedDoc | null>
  >({
    PASSPORT: null,
    WORK_PERMIT: null,
    NATIONAL_ID: null,
    OTHER_GOVT_ID: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load profile to check if national or foreigner
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await api.get("/kyc/profile");
        const profile = res.data.data?.individualProfile;
        if (profile) {
          setIsNational(profile.isNational || false);
        }

        // Load already uploaded documents
        const docs = res.data.data?.documents || [];
        const uploadedMap: Record<DocumentType, UploadedDoc | null> = {
          PASSPORT: null,
          WORK_PERMIT: null,
          NATIONAL_ID: null,
          OTHER_GOVT_ID: null,
        };
        docs.forEach((doc: any) => {
          if (doc.documentType in uploadedMap) {
            uploadedMap[doc.documentType as DocumentType] = {
              type: doc.documentType,
              fileName: doc.fileName,
              fileUrl: doc.fileUrl,
              status: "done",
            };
          }
        });
        setUploads(uploadedMap);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingProfile(false);
      }
    };
    loadProfile();
  }, []);

  // Filter docs based on national or foreigner
  const visibleDocs = DOC_CONFIG.filter((doc) => {
    if (doc.requiredFor === "all") return true;
    if (doc.requiredFor === "national" && isNational) return true;
    if (doc.requiredFor === "foreigner" && !isNational) return true;
    return false;
  });

  const requiredDocs = visibleDocs.filter((d) => d.required);
  const allRequiredUploaded = requiredDocs.every(
    (d) => uploads[d.type]?.status === "done",
  );

  const handleFileSelect = async (docType: DocumentType, file: File) => {
    // Validate file type
    const allowed = ["application/pdf", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type)) {
      setUploads((prev) => ({
        ...prev,
        [docType]: {
          type: docType,
          fileName: file.name,
          fileUrl: "",
          status: "error",
        },
      }));
      return;
    }

    // Validate file size — max 10MB
    if (file.size > 10 * 1024 * 1024) {
      setUploads((prev) => ({
        ...prev,
        [docType]: {
          type: docType,
          fileName: file.name,
          fileUrl: "",
          status: "error",
        },
      }));
      return;
    }

    // Set uploading state
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

      const res = await api.post("/kyc/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploads((prev) => ({
        ...prev,
        [docType]: {
          type: docType,
          fileName: file.name,
          fileUrl: res.data.data.fileUrl,
          status: "done",
        },
      }));
    } catch (e) {
      setUploads((prev) => ({
        ...prev,
        [docType]: {
          type: docType,
          fileName: file.name,
          fileUrl: "",
          status: "error",
        },
      }));
    }
  };

  const handleSubmitKyc = async () => {
    try {
      setIsSubmitting(true);
      setSubmitError("");
      await api.post("/kyc/submit");
      window.location.href = "/onboarding/status";
    } catch (error: any) {
      setSubmitError(
        error.response?.data?.message ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Upload Documents
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload clear copies of your identity documents. Accepted formats: PDF
          or JPEG. Max size: 10MB per file.
        </p>
      </div>

      {/* Account type badge */}
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

      {/* Document cards */}
      <div className="space-y-4">
        {visibleDocs.map((doc) => {
          const upload = uploads[doc.type];
          return (
            <div
              key={doc.type}
              className={`bg-white border rounded-xl p-5 transition-colors ${
                upload?.status === "done"
                  ? "border-teal-200"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left — doc info */}
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

                  {/* Upload status */}
                  {upload && (
                    <div
                      className={`mt-2 flex items-center gap-2 text-xs ${
                        upload.status === "done"
                          ? "text-teal-700"
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
                          className="w-3.5 h-3.5 text-teal-600"
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
                          "Invalid file. Use PDF or JPEG under 10MB."}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right — upload button */}
                <div className="shrink-0">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg"
                    className="hidden"
                    ref={(el) => {
                      fileInputRefs.current[doc.type] = el;
                    }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(doc.type, file);
                      // Reset input so same file can be re-uploaded
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[doc.type]?.click()}
                    disabled={upload?.status === "uploading"}
                    className={`h-9 px-4 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                      upload?.status === "done"
                        ? "border-teal-200 text-teal-700 hover:bg-teal-50"
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

      {/* Error */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {submitError}
        </div>
      )}

      {/* Submit section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
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
            onClick={handleSubmitKyc}
            disabled={!allRequiredUploaded || isSubmitting}
            className="shrink-0 h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

        {/* Progress indicator */}
        <div className="mt-4 flex items-center gap-2">
          {requiredDocs.map((doc) => {
            const isDone = uploads[doc.type]?.status === "done";
            return (
              <div key={doc.type} className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isDone ? "bg-teal-500" : "bg-slate-200"
                  }`}
                />
                <span
                  className={`text-xs ${
                    isDone ? "text-teal-700" : "text-slate-400"
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
