"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { sessionApi as api } from "@/lib/api";
import { useSearchParams, useRouter } from "next/navigation";
import { StateSearchSelect } from "@/components/address/StateSearchSelect";
import { FlexCountryFlag } from "@/components/country/FlexCountryFlag";
import { useFlexCountries } from "@/hooks/useFlexCountries";
import type { KycDocumentRow } from "./VerificationDocuments";
import { CorporateVerificationDocuments } from "./CorporateVerificationDocuments";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import {
  isAllowedKycUpload,
  KYC_FILE_INPUT_ACCEPT,
  KYC_UPLOAD_MAX_BYTES,
  kycUploadMaxSizeLabelMb,
  parseKycUploadErrorMessage,
} from "./kycUploadAllowed";
import { KycSubmittedPanel } from "./KycSubmittedPanel";
import { AppDialog } from "@/components/ui/AppDialog";
import { Field, SectionLabel } from "./KycFormPrimitives";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { notifyApiError } from "@/lib/notify";
import { Plus, Trash2 } from "lucide-react";

type CorporateSection =
  | "business"
  | "licenses"
  | "ownership"
  | "documents"
  | "submitted";

type ShareholderFormRow =
  | {
      kind: "INDIVIDUAL";
      fullName: string;
      documentFileUrl: string;
      documentFileName: string;
    }
  | {
      kind: "CORPORATE";
      fullName: string;
      documentFileUrl: string;
      documentFileName: string;
      registeredAddress: string;
    };

interface KeyPersonnelRow {
  fullName: string;
  documentFileUrl: string;
  documentFileName: string;
}

interface BusinessPremisesAddressForm {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  /** Mirrors registration country (same as individual flow). */
  country: string;
}

const emptyBusinessPremises = (): BusinessPremisesAddressForm => ({
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
});

/** DB column is a string: JSON for structured saves; legacy plain text loads into line1. */
function parseStoredBusinessAddress(raw: unknown): BusinessPremisesAddressForm {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return emptyBusinessPremises();
  try {
    const j = JSON.parse(s) as unknown;
    if (j && typeof j === "object" && "line1" in (j as object)) {
      const o = j as Record<string, unknown>;
      return {
        line1: String(o.line1 ?? "").trim(),
        line2: String(o.line2 ?? "").trim(),
        city: String(o.city ?? "").trim(),
        state: String(o.state ?? "").trim(),
        postalCode: String(o.postalCode ?? "").trim(),
        country: String(o.country ?? "").trim(),
      };
    }
  } catch {
    /* legacy single-field textarea */
  }
  return { ...emptyBusinessPremises(), line1: s };
}

function serializeBusinessPremises(p: BusinessPremisesAddressForm): string {
  return JSON.stringify({
    line1: p.line1.trim(),
    line2: p.line2.trim(),
    city: p.city.trim(),
    state: p.state.trim(),
    postalCode: p.postalCode.trim(),
    country: p.country.trim(),
  });
}

function businessPremisesComplete(p: BusinessPremisesAddressForm): boolean {
  return Boolean(
    p.line1.trim() && p.city.trim() && p.state.trim() && p.country.trim(),
  );
}

function isKeyPersonnelComplete(personnel: KeyPersonnelRow): boolean {
  return Boolean(personnel.fullName.trim() && personnel.documentFileUrl.trim());
}

function isShareholderRowComplete(row: ShareholderFormRow): boolean {
  if (row.kind === "INDIVIDUAL") {
    return Boolean(row.fullName.trim() && row.documentFileUrl.trim());
  }
  return Boolean(
    row.fullName.trim() &&
    row.documentFileUrl.trim() &&
    row.registeredAddress.trim(),
  );
}

/** Passport / National ID upload card — matches Individual KYC verification documents pattern. */
function CorporateOwnershipDocUpload({
  documentFileUrl,
  documentFileName,
  uploading,
  errorMsg,
  description,
  fileInputRef,
  onFileSelected,
  onBrowseClick,
  onView,
}: {
  documentFileUrl: string;
  documentFileName: string;
  uploading: boolean;
  errorMsg?: string;
  description?: string;
  fileInputRef: (el: HTMLInputElement | null) => void;
  onFileSelected: (file: File) => void;
  onBrowseClick: () => void;
  onView: () => void;
}) {
  const done = Boolean(documentFileUrl.trim()) && !uploading && !errorMsg;
  const showStatus = uploading || done || Boolean(errorMsg);
  const hint = description ?? `Upload a clear copy of passport or national ID`;

  return (
    <div
      className={`bg-slate-50/80 border rounded-xl p-3 transition-colors ${
        done ? "border-teal-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">{hint}</p>
          {showStatus ? (
            <div
              className={`mt-2 flex items-center gap-2 text-xs ${
                errorMsg
                  ? "text-red-500"
                  : uploading
                    ? "text-slate-500"
                    : "text-teal-700"
              }`}
            >
              {uploading ? (
                <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin shrink-0" />
              ) : null}
              {errorMsg ? (
                <svg
                  className="w-3.5 h-3.5 shrink-0"
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
              ) : null}
              {done ? (
                <svg
                  className="w-3.5 h-3.5 text-teal-600 shrink-0"
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
              ) : null}
              <span className="truncate max-w-[min(100%,14rem)] sm:max-w-xs">
                {uploading ? "Uploading..." : null}
                {errorMsg ? errorMsg : null}
                {done ? documentFileName.trim() || "Document" : null}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <input
            type="file"
            accept={KYC_FILE_INPUT_ACCEPT}
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file);
              e.target.value = "";
            }}
          />
          {documentFileUrl.trim() && !uploading ? (
            <button
              type="button"
              onClick={onView}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              View
            </button>
          ) : null}
          <button
            type="button"
            onClick={onBrowseClick}
            disabled={uploading}
            className={`cursor-pointer h-9 px-4 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
              documentFileUrl.trim() && !uploading
                ? "border-teal-200 text-teal-700 hover:bg-teal-50"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {uploading
              ? "Uploading..."
              : documentFileUrl.trim()
                ? "Replace"
                : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CorporateForm {
  businessName: string;
  natureOfBusiness: string;
  businessPremises: BusinessPremisesAddressForm;
  registrationNumber: string;
  incorporationDate: string;
  tradingLicenseNumber: string;
  tradingLicenseIssue: string;
  tradingLicenseExpiry: string;
  regulatoryNotApplicable: boolean;
  regulatoryLicenseNumber: string;
  regulatoryLicenseIssue: string;
  regulatoryLicenseExpiry: string;
  keyPersonnel: KeyPersonnelRow[];
  shareholders: ShareholderFormRow[];
}

const emptyShareholder = (): ShareholderFormRow => ({
  kind: "INDIVIDUAL",
  fullName: "",
  documentFileUrl: "",
  documentFileName: "",
});

const emptyKeyPerson = (): KeyPersonnelRow => ({
  fullName: "",
  documentFileUrl: "",
  documentFileName: "",
});

const emptyForm: CorporateForm = {
  businessName: "",
  natureOfBusiness: "",
  businessPremises: emptyBusinessPremises(),
  registrationNumber: "",
  incorporationDate: "",
  tradingLicenseNumber: "",
  tradingLicenseIssue: "",
  tradingLicenseExpiry: "",
  regulatoryNotApplicable: false,
  regulatoryLicenseNumber: "",
  regulatoryLicenseIssue: "",
  regulatoryLicenseExpiry: "",
  keyPersonnel: [emptyKeyPerson()],
  shareholders: [emptyShareholder()],
};

const corpSections: {
  key: CorporateSection;
  label: string;
  description: string;
}[] = [
  {
    key: "business",
    label: "Business details",
    description: "Legal entity information",
  },
  {
    key: "licenses",
    label: "Licenses",
    description: "Trading and regulatory licenses",
  },
  {
    key: "ownership",
    label: "Authorised personnel & shareholders",
    description:
      "CEO's, Directors, officers, and shareholders on your KYC record.",
  },
  {
    key: "documents",
    label: "Verification documents",
    description:
      "Upload proof so we can verify your business and complete compliance review.",
  },
  {
    key: "submitted",
    label: "Application complete",
    description: "Your KYC has been submitted for review",
  },
];

function isoDate(v: unknown): string {
  return v ? new Date(v as string).toISOString().split("T")[0] : "";
}

function parseKeyPersonnel(raw: unknown): KeyPersonnelRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return [emptyKeyPerson()];
  const rows = raw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const docUrl =
        String(o.documentFileUrl ?? "").trim() ||
        String(o.passportOrNationalIdDocumentUrl ?? "").trim();
      return {
        fullName: String(o.fullName ?? "").trim(),
        documentFileUrl: docUrl,
        documentFileName: String(o.documentFileName ?? "").trim(),
      };
    })
    .filter(Boolean) as KeyPersonnelRow[];
  return rows.length ? rows : [emptyKeyPerson()];
}

function parseShareholders(raw: unknown): ShareholderFormRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return [emptyShareholder()];
  const rows: ShareholderFormRow[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const kind = o.kind === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL";
    const docUrl =
      String(o.documentFileUrl ?? "").trim() ||
      String(o.passportOrNationalIdDocumentUrl ?? "").trim();
    if (kind === "CORPORATE") {
      rows.push({
        kind: "CORPORATE",
        fullName: String(
          o.fullName ?? o.entityName ?? o.businessName ?? "",
        ).trim(),
        documentFileUrl: docUrl,
        documentFileName: String(o.documentFileName ?? "").trim(),
        registeredAddress: String(
          o.registeredAddress ?? o.address ?? "",
        ).trim(),
      });
    } else {
      rows.push({
        kind: "INDIVIDUAL",
        fullName: String(o.fullName ?? "").trim(),
        documentFileUrl: docUrl,
        documentFileName: String(o.documentFileName ?? "").trim(),
      });
    }
  }
  return rows.length ? rows : [emptyShareholder()];
}

function buildCorporatePayload(form: CorporateForm): Record<string, unknown> {
  const keyPersonnel = form.keyPersonnel
    .filter((r) => isKeyPersonnelComplete(r))
    .map((r) => ({
      fullName: r.fullName.trim(),
      documentFileUrl: r.documentFileUrl.trim(),
      documentFileName: r.documentFileName.trim(),
    }));

  const shareholders = form.shareholders.map((row) => {
    if (row.kind === "CORPORATE") {
      return {
        kind: "CORPORATE" as const,
        fullName: row.fullName.trim(),
        documentFileUrl: row.documentFileUrl.trim(),
        documentFileName: row.documentFileName.trim(),
        registeredAddress: row.registeredAddress.trim(),
      };
    }
    return {
      kind: "INDIVIDUAL" as const,
      fullName: row.fullName.trim(),
      documentFileUrl: row.documentFileUrl.trim(),
      documentFileName: row.documentFileName.trim(),
    };
  });

  const payload: Record<string, unknown> = {
    businessName: form.businessName.trim(),
    natureOfBusiness: form.natureOfBusiness.trim(),
    businessAddress: serializeBusinessPremises(form.businessPremises),
    registrationNumber: form.registrationNumber.trim(),
    incorporationDate: form.incorporationDate || null,
    tradingLicenseNumber: form.tradingLicenseNumber.trim(),
    tradingLicenseIssue: form.tradingLicenseIssue || null,
    tradingLicenseExpiry: form.tradingLicenseExpiry || null,
    keyPersonnel,
    shareholders,
  };

  if (form.regulatoryNotApplicable) {
    payload.regulatoryLicenseNumber = null;
    payload.regulatoryLicenseIssue = null;
    payload.regulatoryLicenseExpiry = null;
  } else {
    payload.regulatoryLicenseNumber =
      form.regulatoryLicenseNumber.trim() || null;
    payload.regulatoryLicenseIssue = form.regulatoryLicenseIssue || null;
    payload.regulatoryLicenseExpiry = form.regulatoryLicenseExpiry || null;
  }

  return payload;
}

function formSignature(form: CorporateForm): string {
  return JSON.stringify(buildCorporatePayload(form));
}

function inferCorporateDocsComplete(
  regulatoryRequired: boolean,
  documents: { documentType?: string }[] | undefined,
): boolean {
  if (!documents?.length) return false;
  const uploaded = new Set(
    documents.map((d) => d.documentType).filter(Boolean) as string[],
  );
  const base = [
    "CERTIFICATE_OF_INCORPORATION",
    "TRADING_LICENSE",
    "CR12",
    "PROOF_OF_ADDRESS",
  ];
  if (!base.every((t) => uploaded.has(t))) return false;
  if (regulatoryRequired && !uploaded.has("REGULATORY_LICENSE")) return false;
  return true;
}

function inferSavedSectionsFromForm(f: CorporateForm): CorporateSection[] {
  const saved: CorporateSection[] = [];

  const businessDone =
    f.businessName.trim() &&
    f.natureOfBusiness.trim() &&
    businessPremisesComplete(f.businessPremises) &&
    f.registrationNumber.trim() &&
    f.incorporationDate;

  if (businessDone) saved.push("business");

  const licensesDone =
    f.tradingLicenseNumber.trim() &&
    f.tradingLicenseIssue &&
    f.tradingLicenseExpiry &&
    (f.regulatoryNotApplicable ||
      (f.regulatoryLicenseNumber.trim() &&
        f.regulatoryLicenseIssue &&
        f.regulatoryLicenseExpiry));

  if (licensesDone) saved.push("licenses");

  const kpOk = f.keyPersonnel.some((r) => isKeyPersonnelComplete(r));
  const shOk = f.shareholders.every((row) => isShareholderRowComplete(row));
  const hasShareholder = f.shareholders.length > 0;
  if (kpOk && shOk && hasShareholder) saved.push("ownership");

  return saved;
}

function recomputeCorporateSavedSections(
  f: CorporateForm,
  docs: { documentType?: string }[] | undefined,
): CorporateSection[] {
  const inferred = inferSavedSectionsFromForm(f);
  const regulatoryRequired = !f.regulatoryNotApplicable;
  if (inferCorporateDocsComplete(regulatoryRequired, docs)) {
    inferred.push("documents");
  }
  return inferred;
}

function mergeCorporateSavedWithStatus(
  f: CorporateForm,
  docs: KycDocumentRow[] | undefined,
  kycStatus: string | undefined,
): CorporateSection[] {
  const base = recomputeCorporateSavedSections(f, docs);
  if (kycStatus === "SUBMITTED" || kycStatus === "APPROVED") {
    return ["business", "licenses", "ownership", "documents", "submitted"];
  }
  return base;
}

type FormErrors = Partial<
  Record<
    | Exclude<
        keyof CorporateForm,
        "businessPremises" | "keyPersonnel" | "shareholders"
      >
    | "keyPersonnel"
    | "shareholders",
    string | undefined
  >
> & {
  businessPremises?: Partial<Record<keyof BusinessPremisesAddressForm, string>>;
};

function corporateFormFromPersisted(sig: string): CorporateForm {
  try {
    const raw = JSON.parse(sig) as Record<string, unknown>;
    const regNum = raw.regulatoryLicenseNumber;
    const hasReg = Boolean(regNum != null && String(regNum).trim().length > 0);
    return {
      ...emptyForm,
      businessName: String(raw.businessName ?? ""),
      natureOfBusiness: String(raw.natureOfBusiness ?? ""),
      businessPremises: parseStoredBusinessAddress(raw.businessAddress),
      registrationNumber: String(raw.registrationNumber ?? ""),
      incorporationDate: raw.incorporationDate
        ? String(raw.incorporationDate).slice(0, 10)
        : "",
      tradingLicenseNumber: String(raw.tradingLicenseNumber ?? ""),
      tradingLicenseIssue: raw.tradingLicenseIssue
        ? String(raw.tradingLicenseIssue).slice(0, 10)
        : "",
      tradingLicenseExpiry: raw.tradingLicenseExpiry
        ? String(raw.tradingLicenseExpiry).slice(0, 10)
        : "",
      regulatoryNotApplicable: !hasReg,
      regulatoryLicenseNumber: String(raw.regulatoryLicenseNumber ?? ""),
      regulatoryLicenseIssue: raw.regulatoryLicenseIssue
        ? String(raw.regulatoryLicenseIssue).slice(0, 10)
        : "",
      regulatoryLicenseExpiry: raw.regulatoryLicenseExpiry
        ? String(raw.regulatoryLicenseExpiry).slice(0, 10)
        : "",
      keyPersonnel: parseKeyPersonnel(raw.keyPersonnel),
      shareholders: parseShareholders(raw.shareholders),
    };
  } catch {
    return emptyForm;
  }
}

export function CorporateKycWizard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeSection, setActiveSection] =
    useState<CorporateSection>("business");
  const [form, setForm] = useState<CorporateForm>(emptyForm);
  const formRef = useRef(form);
  formRef.current = form;

  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSections, setSavedSections] = useState<CorporateSection[]>([]);
  const [persistedSignature, setPersistedSignature] = useState("");
  const [kycDocuments, setKycDocuments] = useState<KycDocumentRow[]>([]);
  const [kycLifecycleStatus, setKycLifecycleStatus] = useState<
    string | undefined
  >(undefined);
  const [kycSubmittedAt, setKycSubmittedAt] = useState<Date | null>(null);
  const [pendingSectionAfterUnsaved, setPendingSectionAfterUnsaved] =
    useState<CorporateSection | null>(null);
  const [registrationCountry, setRegistrationCountry] = useState("");
  const [uploadingPersonnelDoc, setUploadingPersonnelDoc] = useState<
    number | null
  >(null);
  const [personnelUploadErrors, setPersonnelUploadErrors] = useState<
    Record<number, string>
  >({});
  const [ownershipFilePreview, setOwnershipFilePreview] = useState<{
    url: string;
    fileName: string;
    title: string;
  } | null>(null);
  const personnelFileInputRefs = useRef<
    Record<number, HTMLInputElement | null>
  >({});
  const [uploadingShareholderDoc, setUploadingShareholderDoc] = useState<
    number | null
  >(null);
  const [shareholderUploadErrors, setShareholderUploadErrors] = useState<
    Record<number, string>
  >({});
  const shareholderFileInputRefs = useRef<
    Record<number, HTMLInputElement | null>
  >({});

  const { countries: flexCountryList } = useFlexCountries(true);

  const businessPremisesFlexCountry = useMemo(
    () =>
      flexCountryList.find((c) => c.couName === form.businessPremises.country),
    [flexCountryList, form.businessPremises.country],
  );

  useEffect(() => {
    const c = registrationCountry.trim();
    if (!c) return;
    setForm((prev) => {
      if (prev.businessPremises.country === c) return prev;
      return {
        ...prev,
        businessPremises: { ...prev.businessPremises, country: c },
      };
    });
  }, [registrationCountry]);

  const syncDocumentsFromServer = useCallback(async () => {
    try {
      const res = await api.get("/kyc/profile");
      const userRow = res.data.data as {
        documents?: KycDocumentRow[];
        kycStatus?: string;
        corporateProfile?: Record<string, unknown> | null;
      };
      const docs = userRow?.documents ?? [];
      setKycDocuments(docs);
      if (userRow?.kycStatus != null) setKycLifecycleStatus(userRow.kycStatus);
      setSavedSections(
        mergeCorporateSavedWithStatus(
          formRef.current,
          docs,
          userRow?.kycStatus,
        ),
      );
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handlePersonnelDocumentUpload = useCallback(
    async (file: File, personnelIndex: number) => {
      if (file.size > KYC_UPLOAD_MAX_BYTES) {
        setPersonnelUploadErrors((prev) => ({
          ...prev,
          [personnelIndex]: `This file is too large (max ${kycUploadMaxSizeLabelMb()} MB).`,
        }));
        return;
      }

      if (!isAllowedKycUpload(file)) {
        setPersonnelUploadErrors((prev) => ({
          ...prev,
          [personnelIndex]:
            "This file type is not accepted. Use documents or media (executables and scripts are blocked).",
        }));
        return;
      }

      setPersonnelUploadErrors((prev) => {
        const next = { ...prev };
        delete next[personnelIndex];
        return next;
      });

      try {
        setUploadingPersonnelDoc(personnelIndex);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentType", "AUTHORIZED_PERSONNEL_DOC");

        const res = await api.post("/kyc/documents/upload", formData);
        const uploadedDoc = res.data.data as {
          fileUrl: string;
          fileName: string;
        };

        setForm((p) => {
          const kp = [...p.keyPersonnel];
          kp[personnelIndex] = {
            ...kp[personnelIndex],
            documentFileUrl: uploadedDoc.fileUrl,
            documentFileName: uploadedDoc.fileName,
          };
          return { ...p, keyPersonnel: kp };
        });
        await syncDocumentsFromServer();
      } catch (err) {
        console.error("Failed to upload personnel document:", err);
        const serverMsg = parseKycUploadErrorMessage(err);
        setPersonnelUploadErrors((prev) => ({
          ...prev,
          [personnelIndex]:
            serverMsg ?? "Upload failed. Check your connection and try again.",
        }));
      } finally {
        setUploadingPersonnelDoc(null);
      }
    },
    [syncDocumentsFromServer],
  );

  const handleShareholderDocumentUpload = useCallback(
    async (file: File, shareholderIndex: number) => {
      if (file.size > KYC_UPLOAD_MAX_BYTES) {
        setShareholderUploadErrors((prev) => ({
          ...prev,
          [shareholderIndex]: `This file is too large (max ${kycUploadMaxSizeLabelMb()} MB).`,
        }));
        return;
      }

      if (!isAllowedKycUpload(file)) {
        setShareholderUploadErrors((prev) => ({
          ...prev,
          [shareholderIndex]:
            "This file type is not accepted. Use documents or media (executables and scripts are blocked).",
        }));
        return;
      }

      setShareholderUploadErrors((prev) => {
        const next = { ...prev };
        delete next[shareholderIndex];
        return next;
      });

      try {
        setUploadingShareholderDoc(shareholderIndex);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentType", "AUTHORIZED_PERSONNEL_DOC");

        const res = await api.post("/kyc/documents/upload", formData);
        const uploadedDoc = res.data.data as {
          fileUrl: string;
          fileName: string;
        };

        setForm((p) => {
          const sh = [...p.shareholders];
          const cur = sh[shareholderIndex];
          if (!cur) return p;
          sh[shareholderIndex] = {
            ...cur,
            documentFileUrl: uploadedDoc.fileUrl,
            documentFileName: uploadedDoc.fileName,
          };
          return { ...p, shareholders: sh };
        });
        await syncDocumentsFromServer();
      } catch (err) {
        console.error("Failed to upload shareholder document:", err);
        const serverMsg = parseKycUploadErrorMessage(err);
        setShareholderUploadErrors((prev) => ({
          ...prev,
          [shareholderIndex]:
            serverMsg ?? "Upload failed. Check your connection and try again.",
        }));
      } finally {
        setUploadingShareholderDoc(null);
      }
    },
    [syncDocumentsFromServer],
  );

  const handleKycSubmitted = useCallback(() => {
    setPersistedSignature(formSignature(formRef.current));
    setKycLifecycleStatus("SUBMITTED");
    setKycSubmittedAt(new Date());
    setSavedSections([
      "business",
      "licenses",
      "ownership",
      "documents",
      "submitted",
    ]);
    setActiveSection("submitted");
    router.replace("/onboarding/profile", { scroll: false });
  }, [router]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const res = await api.get("/kyc/profile");
        const userRow = res.data.data as {
          country?: string | null;
          corporateProfile?: Record<string, unknown> | null;
          documents?: KycDocumentRow[];
          kycStatus?: string;
          updatedAt?: string;
        };
        const countryFromRegistration = userRow?.country?.trim() || "";
        setRegistrationCountry(countryFromRegistration);
        const cp = userRow?.corporateProfile;
        let next: CorporateForm = {
          ...emptyForm,
          businessPremises: {
            ...emptyBusinessPremises(),
            country: countryFromRegistration,
          },
        };

        if (cp) {
          const bp = parseStoredBusinessAddress(cp.businessAddress);
          next = {
            ...emptyForm,
            businessName: String(cp.businessName ?? ""),
            natureOfBusiness: String(cp.natureOfBusiness ?? ""),
            businessPremises: {
              ...bp,
              country: bp.country || countryFromRegistration,
            },
            registrationNumber: String(cp.registrationNumber ?? ""),
            incorporationDate: isoDate(cp.incorporationDate),
            tradingLicenseNumber: String(cp.tradingLicenseNumber ?? ""),
            tradingLicenseIssue: isoDate(cp.tradingLicenseIssue),
            tradingLicenseExpiry: isoDate(cp.tradingLicenseExpiry),
            regulatoryLicenseNumber: String(cp.regulatoryLicenseNumber ?? ""),
            regulatoryLicenseIssue: isoDate(cp.regulatoryLicenseIssue),
            regulatoryLicenseExpiry: isoDate(cp.regulatoryLicenseExpiry),
            regulatoryNotApplicable:
              !cp.regulatoryLicenseNumber ||
              !String(cp.regulatoryLicenseNumber).trim(),
            keyPersonnel: parseKeyPersonnel(cp.keyPersonnel),
            shareholders: parseShareholders(cp.shareholders),
          };
        }

        setForm(next);
        setKycLifecycleStatus(userRow?.kycStatus);
        const docRows = (userRow?.documents ?? []) as KycDocumentRow[];
        setKycDocuments(docRows);
        setSavedSections(
          mergeCorporateSavedWithStatus(next, docRows, userRow?.kycStatus),
        );
        setPersistedSignature(formSignature(next));
        if (
          userRow?.kycStatus === "SUBMITTED" ||
          userRow?.kycStatus === "APPROVED"
        ) {
          setKycSubmittedAt(
            userRow.updatedAt ? new Date(userRow.updatedAt) : new Date(),
          );
          setActiveSection("submitted");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (savedSections.includes("submitted")) return;
    if (searchParams.get("step") !== "documents") return;
    if (!savedSections.includes("ownership")) return;
    setActiveSection("documents");
    router.replace("/onboarding/profile", { scroll: false });
  }, [isLoading, searchParams, savedSections, router]);

  useEffect(() => {
    if (isLoading) return;
    if (searchParams.get("step") !== "submitted") return;
    const ok =
      savedSections.includes("submitted") ||
      kycLifecycleStatus === "SUBMITTED" ||
      kycLifecycleStatus === "APPROVED";
    if (!ok) return;
    setActiveSection("submitted");
    router.replace("/onboarding/profile", { scroll: false });
  }, [isLoading, searchParams, savedSections, kycLifecycleStatus, router]);

  const validateSection = (section: CorporateSection): boolean => {
    if (section === "documents" || section === "submitted") {
      setErrors({});
      return true;
    }

    const newErrors: FormErrors = {};

    if (section === "business") {
      if (!form.businessName.trim())
        newErrors.businessName = "Business name is required";
      if (!form.natureOfBusiness.trim())
        newErrors.natureOfBusiness = "Nature of business is required";

      const bp = form.businessPremises;
      const bpErr: Partial<Record<keyof BusinessPremisesAddressForm, string>> =
        {};
      if (!bp.line1.trim()) bpErr.line1 = "Address line 1 is required";
      if (!bp.city.trim()) bpErr.city = "City is required";
      if (!bp.state.trim()) bpErr.state = "State or region is required";
      if (!registrationCountry.trim() || !bp.country.trim()) {
        bpErr.country =
          "Country is not set from registration—refresh the page or contact support.";
      }
      if (Object.keys(bpErr).length) newErrors.businessPremises = bpErr;

      if (!form.registrationNumber.trim())
        newErrors.registrationNumber = "Registration number is required";
      if (!form.incorporationDate)
        newErrors.incorporationDate = "Date of incorporation is required";
    }

    if (section === "licenses") {
      if (!form.tradingLicenseNumber.trim())
        newErrors.tradingLicenseNumber = "Trading license number is required";
      if (!form.tradingLicenseIssue)
        newErrors.tradingLicenseIssue =
          "Trading license issue date is required";
      if (!form.tradingLicenseExpiry)
        newErrors.tradingLicenseExpiry = "Trading license expiry is required";
      if (!form.regulatoryNotApplicable) {
        if (!form.regulatoryLicenseNumber.trim())
          newErrors.regulatoryLicenseNumber =
            "Regulatory license number is required (or mark as not applicable)";
        if (!form.regulatoryLicenseIssue)
          newErrors.regulatoryLicenseIssue =
            "Regulatory license issue date is required";
        if (!form.regulatoryLicenseExpiry)
          newErrors.regulatoryLicenseExpiry =
            "Regulatory license expiry is required";
      }
    }

    if (section === "ownership") {
      const kpOk = form.keyPersonnel.some((r) => isKeyPersonnelComplete(r));
      if (!kpOk)
        newErrors.keyPersonnel =
          "Add at least one authorised person with full name and passport or national ID document uploaded";

      const badSh = form.shareholders.find(
        (row) => !isShareholderRowComplete(row),
      );
      if (badSh) {
        newErrors.shareholders =
          "Complete all shareholder rows or remove incomplete entries";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const flowComplete = savedSections.includes("submitted");

  const canAccessSection = (key: CorporateSection) => {
    if (flowComplete && key !== "submitted") return false;
    if (key === "submitted") {
      return (
        savedSections.includes("submitted") ||
        kycLifecycleStatus === "SUBMITTED" ||
        kycLifecycleStatus === "APPROVED"
      );
    }
    if (key !== "documents") return true;
    return savedSections.includes("ownership");
  };

  const saveSection = async (section: CorporateSection) => {
    if (section === "documents" || section === "submitted") return;
    if (!validateSection(section)) return;
    try {
      setIsSaving(true);
      const payload = buildCorporatePayload(form);
      await api.post("/kyc/corporate/profile", payload);
      setPersistedSignature(formSignature(form));
      setSavedSections((prev) =>
        prev.includes(section) ? prev : [...prev, section],
      );
      const currentIndex = corpSections.findIndex((s) => s.key === section);
      if (currentIndex < corpSections.length - 1) {
        setActiveSection(corpSections[currentIndex + 1].key);
      }
    } catch (error: unknown) {
      console.error(error);
      notifyApiError(error, "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty =
    persistedSignature.length > 0 && formSignature(form) !== persistedSignature;

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const requestNavigateToSection = (target: CorporateSection) => {
    if (target === activeSection) return;
    if (flowComplete && target !== "submitted") return;
    if (!canAccessSection(target)) return;
    if (isDirty) {
      setPendingSectionAfterUnsaved(target);
      return;
    }
    setActiveSection(target);
  };

  const confirmLeaveUnsaved = () => {
    const target = pendingSectionAfterUnsaved;
    if (!target) return;
    setPendingSectionAfterUnsaved(null);
    if (persistedSignature) {
      setForm(corporateFormFromPersisted(persistedSignature));
    }
    setErrors({});
    setActiveSection(target);
  };

  const inputClass = (
    field: Exclude<
      keyof CorporateForm,
      "businessPremises" | "keyPersonnel" | "shareholders"
    >,
  ) =>
    `border rounded-lg px-3 h-10 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
      errors[field] ? "border-red-400" : "border-slate-200"
    }`;

  const setPremisesField = (
    sub: keyof BusinessPremisesAddressForm,
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      businessPremises: { ...prev.businessPremises, [sub]: value },
    }));
    setErrors((prev) => ({
      ...prev,
      businessPremises: {
        ...prev.businessPremises,
        [sub]: "",
      },
    }));
  };

  const premisesAddrInputClass = (sub: keyof BusinessPremisesAddressForm) =>
    `border rounded-lg px-3 h-10 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
      errors.businessPremises?.[sub] ? "border-red-400" : "border-slate-200"
    }`;

  const ownershipInputClass = (section: "keyPersonnel" | "shareholders") =>
    `border rounded-lg px-3 h-10 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
      errors[section] ? "border-red-400" : "border-slate-200"
    }`;

  const ownershipTextareaClass = (section: "shareholders") =>
    `border rounded-lg px-3 py-2 min-h-[64px] w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 resize-y transition-colors ${
      errors[section] ? "border-red-400" : "border-slate-200"
    }`;

  const regulatoryRequired = !form.regulatoryNotApplicable;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 relative">
      <AppLoadingOverlay show={isSaving} label="Saving…" />
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Business verification
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete all sections to submit your corporate KYC application
        </p>
      </div>

      <div className="flex items-center gap-2">
        {corpSections.map((section, index) => {
          const isDone = savedSections.includes(section.key);
          const isActive = activeSection === section.key;
          const allowed = canAccessSection(section.key);
          return (
            <div key={section.key} className="flex items-center gap-2 flex-1">
              <button
                type="button"
                disabled={!allowed}
                title={
                  !allowed
                    ? flowComplete
                      ? "Your application has been submitted."
                      : "Complete prior steps first."
                    : undefined
                }
                onClick={() => requestNavigateToSection(section.key)}
                className={`flex items-center gap-2 flex-1 text-left ${
                  !allowed ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                    isDone
                      ? "bg-teal-600 text-white"
                      : isActive
                        ? "bg-teal-50 border-2 border-teal-600 text-teal-700"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isDone ? "✓" : index + 1}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${isActive ? "text-teal-700" : "text-slate-500"}`}
                >
                  {section.label}
                </span>
              </button>
              {index < corpSections.length - 1 && (
                <div
                  className={`h-px flex-1 ${isDone ? "bg-teal-300" : "bg-slate-200"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        {activeSection !== "submitted" && (
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {corpSections.find((s) => s.key === activeSection)?.label}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {corpSections.find((s) => s.key === activeSection)?.description}
            </p>
          </div>
        )}

        {activeSection === "submitted" && (
          <KycSubmittedPanel
            submittedAt={kycSubmittedAt ?? new Date()}
            variant="business"
          />
        )}

        {activeSection === "business" && (
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Business name"
                  required
                  error={errors.businessName}
                >
                  <input
                    className={inputClass("businessName")}
                    value={form.businessName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, businessName: e.target.value }))
                    }
                  />
                </Field>
                <Field
                  label="Nature of business"
                  required
                  error={errors.natureOfBusiness}
                >
                  <input
                    type="text"
                    className={inputClass("natureOfBusiness")}
                    value={form.natureOfBusiness}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        natureOfBusiness: e.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Business registration number"
                  required
                  error={errors.registrationNumber}
                >
                  <input
                    className={inputClass("registrationNumber")}
                    value={form.registrationNumber}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        registrationNumber: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Date of incorporation"
                  required
                  error={errors.incorporationDate}
                >
                  <input
                    type="date"
                    className={inputClass("incorporationDate")}
                    value={form.incorporationDate}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        incorporationDate: e.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-4 bg-slate-50/40 p-4 sm:p-5">
              <SectionLabel>Business address</SectionLabel>
              <div className="space-y-4">
                <Field
                  label="Address line 1"
                  required
                  error={errors.businessPremises?.line1}
                >
                  <input
                    className={premisesAddrInputClass("line1")}
                    placeholder="Street address, P.O. box"
                    value={form.businessPremises.line1}
                    onChange={(e) => setPremisesField("line1", e.target.value)}
                  />
                </Field>
                <Field
                  label="Address line 2"
                  error={errors.businessPremises?.line2}
                >
                  <input
                    className={premisesAddrInputClass("line2")}
                    placeholder="Suite, unit, building (optional)"
                    value={form.businessPremises.line2}
                    onChange={(e) => setPremisesField("line2", e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="City"
                    required
                    error={errors.businessPremises?.city}
                  >
                    <input
                      className={premisesAddrInputClass("city")}
                      placeholder="City"
                      value={form.businessPremises.city}
                      onChange={(e) => setPremisesField("city", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="State / region"
                    required
                    error={errors.businessPremises?.state}
                  >
                    <StateSearchSelect
                      countryName={
                        registrationCountry || form.businessPremises.country
                      }
                      value={form.businessPremises.state}
                      onChange={(v) => setPremisesField("state", v)}
                      error={Boolean(errors.businessPremises?.state)}
                      placeholder="State / region"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <Field
                    label="Postal code"
                    error={errors.businessPremises?.postalCode}
                  >
                    <input
                      className={premisesAddrInputClass("postalCode")}
                      placeholder="Postal or ZIP code (optional)"
                      value={form.businessPremises.postalCode}
                      onChange={(e) =>
                        setPremisesField("postalCode", e.target.value)
                      }
                    />
                  </Field>
                  <Field
                    label="Country"
                    error={errors.businessPremises?.country}
                  >
                    <div
                      className={`flex items-center gap-2.5 w-full border rounded-lg px-3 h-10 text-sm text-left bg-white text-slate-700 cursor-not-allowed select-none border-slate-200 ${
                        errors.businessPremises?.country
                          ? "border-red-400"
                          : "border-slate-200"
                      }`}
                      title="Same as the country you selected at registration."
                    >
                      {form.businessPremises.country || registrationCountry ? (
                        <>
                          <span className="text-base leading-none shrink-0 opacity-90">
                            {businessPremisesFlexCountry ? (
                              <FlexCountryFlag
                                couCode={businessPremisesFlexCountry.couCode}
                              />
                            ) : (
                              <span className="inline-block w-5 h-3.5 bg-slate-200 rounded" />
                            )}
                          </span>
                          <span className="font-medium truncate">
                            {form.businessPremises.country ||
                              registrationCountry}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">Loading…</span>
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "licenses" && (
          <div className="space-y-5">
            <SectionLabel>Trading license</SectionLabel>
            <Field
              label="Trading license number"
              required
              error={errors.tradingLicenseNumber}
            >
              <input
                className={inputClass("tradingLicenseNumber")}
                value={form.tradingLicenseNumber}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    tradingLicenseNumber: e.target.value,
                  }))
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Issue date"
                required
                error={errors.tradingLicenseIssue}
              >
                <input
                  type="date"
                  className={inputClass("tradingLicenseIssue")}
                  value={form.tradingLicenseIssue}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      tradingLicenseIssue: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field
                label="Expiry date"
                required
                error={errors.tradingLicenseExpiry}
              >
                <input
                  type="date"
                  className={inputClass("tradingLicenseExpiry")}
                  value={form.tradingLicenseExpiry}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      tradingLicenseExpiry: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.regulatoryNotApplicable}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    regulatoryNotApplicable: e.target.checked,
                  }))
                }
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              No regulatory license applies to our business
            </label>

            {!form.regulatoryNotApplicable && (
              <div className="space-y-4 pt-2">
                <SectionLabel>Regulatory license</SectionLabel>
                <Field
                  label="Regulatory license number"
                  required
                  error={errors.regulatoryLicenseNumber}
                >
                  <input
                    className={inputClass("regulatoryLicenseNumber")}
                    value={form.regulatoryLicenseNumber}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        regulatoryLicenseNumber: e.target.value,
                      }))
                    }
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Issue date"
                    required
                    error={errors.regulatoryLicenseIssue}
                  >
                    <input
                      type="date"
                      className={inputClass("regulatoryLicenseIssue")}
                      value={form.regulatoryLicenseIssue}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          regulatoryLicenseIssue: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field
                    label="Expiry date"
                    required
                    error={errors.regulatoryLicenseExpiry}
                  >
                    <input
                      type="date"
                      className={inputClass("regulatoryLicenseExpiry")}
                      value={form.regulatoryLicenseExpiry}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          regulatoryLicenseExpiry: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === "ownership" && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-2">
                Authorised personnels
              </p>
              {errors.keyPersonnel && (
                <p className="text-xs text-red-500 mb-2">
                  {errors.keyPersonnel}
                </p>
              )}
              <div className="space-y-4">
                {form.keyPersonnel.map((row, i) => {
                  const uploading = uploadingPersonnelDoc === i;
                  const errMsg = personnelUploadErrors[i];
                  return (
                    <div
                      key={i}
                      role="group"
                      aria-label={`Authorised personnel ${i + 1}`}
                      className="rounded-lg border border-slate-200 border-l-2 border-l-teal-600 p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-slate-700">
                          Person {i + 1}
                        </p>
                        {form.keyPersonnel.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPersonnelUploadErrors({});
                              setUploadingPersonnelDoc(null);
                              setForm((p) => ({
                                ...p,
                                keyPersonnel: p.keyPersonnel.filter(
                                  (_, idx) => idx !== i,
                                ),
                              }));
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="">
                        <Field label="Full name" required>
                          <input
                            className={ownershipInputClass("keyPersonnel")}
                            placeholder="Full legal name"
                            value={row.fullName}
                            onChange={(e) =>
                              setForm((p) => {
                                const kp = [...p.keyPersonnel];
                                kp[i] = { ...kp[i], fullName: e.target.value };
                                return { ...p, keyPersonnel: kp };
                              })
                            }
                          />
                        </Field>
                        <div className="mt-3">
                          <Field label="Passport or National ID" required>
                            <CorporateOwnershipDocUpload
                              documentFileUrl={row.documentFileUrl}
                              documentFileName={row.documentFileName}
                              uploading={uploading}
                              errorMsg={errMsg}
                              fileInputRef={(el) => {
                                personnelFileInputRefs.current[i] = el;
                              }}
                              onFileSelected={(file) =>
                                void handlePersonnelDocumentUpload(file, i)
                              }
                              onBrowseClick={() =>
                                personnelFileInputRefs.current[i]?.click()
                              }
                              onView={() =>
                                setOwnershipFilePreview({
                                  url: row.documentFileUrl,
                                  fileName: row.documentFileName || "Document",
                                  title: `Passport or National ID — Person ${i + 1}`,
                                })
                              }
                            />
                          </Field>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal-600 bg-white px-3 py-2 text-sm font-medium text-teal-700 shadow-sm hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                onClick={() => {
                  setPersonnelUploadErrors({});
                  setForm((p) => ({
                    ...p,
                    keyPersonnel: [...p.keyPersonnel, emptyKeyPerson()],
                  }));
                }}
              >
                <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
                Add authorised person
              </button>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900 mb-2">
                Directors & Shareholders
              </p>
              {errors.shareholders && (
                <p className="text-xs text-red-500 mb-2">
                  {errors.shareholders}
                </p>
              )}
              <div className="space-y-4">
                {form.shareholders.map((row, i) => {
                  const uploading = uploadingShareholderDoc === i;
                  const errMsg = shareholderUploadErrors[i];
                  return (
                    <div
                      key={i}
                      role="group"
                      aria-label={`Shareholder ${i + 1}`}
                      className="rounded-lg border border-slate-200 border-l-2 border-l-teal-600 p-4"
                    >
                      <div className="mb-3 min-w-0">
                        <p
                          id={`shareholder-type-label-${i}`}
                          className="sr-only"
                        >
                          Shareholder {i + 1} type
                        </p>
                        <div
                          role="radiogroup"
                          aria-labelledby={`shareholder-type-label-${i}`}
                          className="flex w-full flex-col gap-1 rounded-lg border border-slate-200 bg-slate-100/90 p-0.5 sm:inline-flex sm:w-auto sm:flex-row"
                        >
                          <button
                            type="button"
                            role="radio"
                            aria-checked={row.kind === "INDIVIDUAL"}
                            data-state={
                              row.kind === "INDIVIDUAL"
                                ? "checked"
                                : "unchecked"
                            }
                            className={`w-full rounded-md px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 sm:w-auto sm:text-sm ${
                              row.kind === "INDIVIDUAL"
                                ? "bg-white text-teal-800 shadow-sm ring-1 ring-slate-200/80"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                            onClick={() => {
                              setShareholderUploadErrors({});
                              setUploadingShareholderDoc(null);
                              setForm((p) => {
                                const sh = [...p.shareholders];
                                sh[i] = {
                                  kind: "INDIVIDUAL",
                                  fullName: "",
                                  documentFileUrl: "",
                                  documentFileName: "",
                                };
                                return { ...p, shareholders: sh };
                              });
                            }}
                          >
                            Individual
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={row.kind === "CORPORATE"}
                            data-state={
                              row.kind === "CORPORATE" ? "checked" : "unchecked"
                            }
                            className={`w-full rounded-md px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 sm:w-auto sm:text-sm ${
                              row.kind === "CORPORATE"
                                ? "bg-white text-teal-800 shadow-sm ring-1 ring-slate-200/80"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                            onClick={() => {
                              setShareholderUploadErrors({});
                              setUploadingShareholderDoc(null);
                              setForm((p) => {
                                const sh = [...p.shareholders];
                                sh[i] = {
                                  kind: "CORPORATE",
                                  fullName: "",
                                  documentFileUrl: "",
                                  documentFileName: "",
                                  registeredAddress: "",
                                };
                                return { ...p, shareholders: sh };
                              });
                            }}
                          >
                            Corporate
                          </button>
                        </div>
                      </div>

                      {row.kind === "INDIVIDUAL" ? (
                        <div className="">
                          <Field label="Full name" required>
                            <input
                              className={ownershipInputClass("shareholders")}
                              placeholder="Full legal name"
                              value={row.fullName}
                              onChange={(e) =>
                                setForm((p) => {
                                  const sh = [...p.shareholders];
                                  if (sh[i].kind !== "INDIVIDUAL") return p;
                                  sh[i] = {
                                    ...sh[i],
                                    fullName: e.target.value,
                                  };
                                  return { ...p, shareholders: sh };
                                })
                              }
                            />
                          </Field>
                          <div className="mt-3">
                            <Field label="Passport or National ID" required>
                              <CorporateOwnershipDocUpload
                                documentFileUrl={row.documentFileUrl}
                                documentFileName={row.documentFileName}
                                uploading={uploading}
                                errorMsg={errMsg}
                                fileInputRef={(el) => {
                                  shareholderFileInputRefs.current[i] = el;
                                }}
                                onFileSelected={(file) =>
                                  void handleShareholderDocumentUpload(file, i)
                                }
                                onBrowseClick={() =>
                                  shareholderFileInputRefs.current[i]?.click()
                                }
                                onView={() =>
                                  setOwnershipFilePreview({
                                    url: row.documentFileUrl,
                                    fileName:
                                      row.documentFileName || "Document",
                                    title: `Passport or National ID — Shareholder ${i + 1} (Individual)`,
                                  })
                                }
                              />
                            </Field>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="">
                            <Field label="Full name" required>
                              <input
                                className={ownershipInputClass("shareholders")}
                                placeholder="Legal entity name"
                                value={row.fullName}
                                onChange={(e) =>
                                  setForm((p) => {
                                    const sh = [...p.shareholders];
                                    if (sh[i].kind !== "CORPORATE") return p;
                                    sh[i] = {
                                      ...sh[i],
                                      fullName: e.target.value,
                                    };
                                    return { ...p, shareholders: sh };
                                  })
                                }
                              />
                            </Field>
                            <div className="mt-3">
                              <Field label="Passport or National ID" required>
                                <CorporateOwnershipDocUpload
                                  documentFileUrl={row.documentFileUrl}
                                  documentFileName={row.documentFileName}
                                  uploading={uploading}
                                  errorMsg={errMsg}
                                  description={`Upload a clear copy of passport or national ID`}
                                  fileInputRef={(el) => {
                                    shareholderFileInputRefs.current[i] = el;
                                  }}
                                  onFileSelected={(file) =>
                                    void handleShareholderDocumentUpload(
                                      file,
                                      i,
                                    )
                                  }
                                  onBrowseClick={() =>
                                    shareholderFileInputRefs.current[i]?.click()
                                  }
                                  onView={() =>
                                    setOwnershipFilePreview({
                                      url: row.documentFileUrl,
                                      fileName:
                                        row.documentFileName || "Document",
                                      title: `Passport or National ID — Shareholder ${i + 1} (Corporate)`,
                                    })
                                  }
                                />
                              </Field>
                            </div>
                          </div>
                          <Field label="Registered address" required>
                            <textarea
                              className={ownershipTextareaClass("shareholders")}
                              placeholder="Registered office address"
                              rows={3}
                              value={row.registeredAddress}
                              onChange={(e) =>
                                setForm((p) => {
                                  const sh = [...p.shareholders];
                                  if (sh[i].kind !== "CORPORATE") return p;
                                  sh[i] = {
                                    ...sh[i],
                                    registeredAddress: e.target.value,
                                  };
                                  return { ...p, shareholders: sh };
                                })
                              }
                            />
                          </Field>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal-600 bg-white px-3 py-2 text-sm font-medium text-teal-700 shadow-sm hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                onClick={() => {
                  setShareholderUploadErrors({});
                  setForm((p) => ({
                    ...p,
                    shareholders: [...p.shareholders, emptyShareholder()],
                  }));
                }}
              >
                <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
                Add shareholder
              </button>
            </div>
          </div>
        )}

        {activeSection === "documents" && (
          <CorporateVerificationDocuments
            regulatoryLicenseRequired={regulatoryRequired}
            documents={kycDocuments}
            onDocumentsSynced={syncDocumentsFromServer}
            onKycSubmitted={handleKycSubmitted}
          />
        )}


        {activeSection !== "documents" && activeSection !== "submitted" && (
          <div className="flex justify-between items-center pt-2">
            {activeSection !== "business" && (
              <button
                type="button"
                onClick={() => {
                  const idx = corpSections.findIndex(
                    (s) => s.key === activeSection,
                  );
                  requestNavigateToSection(corpSections[idx - 1].key);
                }}
                className="cursor-pointer text-sm text-slate-600 hover:text-slate-900 font-medium "
              >
                Back
              </button>
            )}
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => saveSection(activeSection)}
                disabled={isSaving}
                className="cursor-pointer h-10 px-6 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white cursor-pointer border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save and Continue"
                )}
              </button>
            </div>
          </div>
        )}

        {activeSection === "documents" && !flowComplete && (
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => requestNavigateToSection("ownership")}
              className="cursor-pointer text-sm text-slate-600 hover:text-slate-900 font-medium "
            >
              Back
            </button>
          </div>
        )}
      </div>

      {ownershipFilePreview && (
        <DocumentPreviewModal
          open={Boolean(ownershipFilePreview)}
          onClose={() => setOwnershipFilePreview(null)}
          fileUrl={ownershipFilePreview.url}
          fileName={ownershipFilePreview.fileName}
          title={ownershipFilePreview.title}
        />
      )}

      <AppDialog
        open={pendingSectionAfterUnsaved !== null}
        onClose={() => setPendingSectionAfterUnsaved(null)}
        variant="confirm"
        title="Unsaved changes"
        message="You have unsaved changes on this step. Save before leaving or your edits will be lost."
        cancelLabel="Keep editing"
        confirmLabel="Leave without saving"
        destructive
        onConfirm={confirmLeaveUnsaved}
      />
    </div>
  );
}
