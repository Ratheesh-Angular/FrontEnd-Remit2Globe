"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { sessionApi as api } from "@/lib/api";
import { useSearchParams, useRouter } from "next/navigation";
import { StateSearchSelect } from "@/components/address/StateSearchSelect";
import { FlexCountryFlag } from "@/components/country/FlexCountryFlag";
import { CatalogCountrySelect } from "@/components/country/CatalogCountrySelect";
import { FlexCountrySelect } from "@/components/country/FlexCountrySelect";
import { useCatalogCountries } from "@/hooks/useCatalogCountries";
import { useFlexCountries } from "@/hooks/useFlexCountries";
import Flag from "react-world-flags";
import type { Country } from "@/lib/phone-countries";
import { phoneCountryFromCouCode } from "@/lib/flex-country-phone";
import {
  VerificationDocuments,
  type KycDocumentRow,
} from "./VerificationDocuments";
import { KycSubmittedPanel } from "./KycSubmittedPanel";
import { AppDialog } from "@/components/ui/AppDialog";
import { NativeSelectShell } from "@/components/ui/NativeSelectShell";
import { fieldNativeSelectClasses } from "@/lib/field-styles";
import { Field, SectionLabel } from "./KycFormPrimitives";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { notifyApiError } from "@/lib/notify";
import {
  getPassportRuleForIssuingCountry,
  passportFormatHint,
  sanitizePassportNumber,
  validatePassportNumber,
} from "@/lib/passport-validation";

type Section = "personal" | "identity" | "address" | "documents" | "submitted";

/** Citizen: primary ID type. Empty when resident or not chosen yet. */
type CitizenDocType = "" | "PASSPORT" | "NATIONAL_ID";

interface ResidenceAddressForm {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  /** Same as country of residence at signup; stored in address JSON and synced from Personal Info. */
  country: string;
}

const emptyResidenceAddress: ResidenceAddressForm = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

interface IndividualForm {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  // nationality: string;
  isNational: boolean;
  passportNumber: string;
  /** Resident (foreign): issuing country of passport — mandatory. */
  passportIssuingCountry: string;
  passportIssue: string;
  passportExpiry: string;
  /** Citizen: passport vs national ID — drives which fields are shown. */
  citizenPrimaryDocumentType: CitizenDocType;
  workPermitNumber: string;
  workPermitIssue: string;
  workPermitExpiry: string;
  nationalIdNumber: string;
  /** Citizen + national ID as primary document */
  nationalIdIssuingCountry: string;
  nationalIdIssue: string;
  nationalIdExpiry: string;

  residenceAddress: ResidenceAddressForm;

  country: string;
  contactEmail: string;
  contactPhone: string;
  occupation: string;
  employerName: string;
}

const empty: IndividualForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  dateOfBirth: "",
  // nationality: "",
  isNational: false,
  passportNumber: "",
  passportIssuingCountry: "",
  passportIssue: "",
  passportExpiry: "",
  citizenPrimaryDocumentType: "",
  workPermitNumber: "",
  workPermitIssue: "",
  workPermitExpiry: "",
  nationalIdNumber: "",
  nationalIdIssuingCountry: "",
  nationalIdIssue: "",
  nationalIdExpiry: "",

  residenceAddress: { ...emptyResidenceAddress },

  country: "",
  contactEmail: "",
  contactPhone: "",
  occupation: "",
  employerName: "",
};

const sections: { key: Section; label: string; description: string }[] = [
  {
    key: "personal",
    label: "Personal Info",
    description: "Your basic personal details",
  },
  {
    key: "identity",
    label: "Identity Documents",
    description: "",
  },
  {
    key: "address",
    label: "Residential Address",
    description: "Residential address and contact info",
  },
  {
    key: "documents",
    label: "Verification Documents",
    description: "Upload identity and supporting documents",
  },
  {
    key: "submitted",
    label: "Application complete",
    description: "Your KYC has been submitted for review",
  },
];

function buildSanitizedKycPayload(form: IndividualForm): IndividualForm {
  const out: IndividualForm = {
    ...form,
    residenceAddress: {
      line1: form.residenceAddress.line1.trim(),
      line2: form.residenceAddress.line2.trim(),
      city: form.residenceAddress.city.trim(),
      state: form.residenceAddress.state.trim(),
      postalCode: form.residenceAddress.postalCode.trim(),
      country: form.country.trim(),
    },
  };
  if (!form.isNational) {
    out.citizenPrimaryDocumentType = "";
  } else {
    if (form.citizenPrimaryDocumentType === "PASSPORT") {
      out.nationalIdNumber = "";
      out.nationalIdIssuingCountry = "";
      out.nationalIdIssue = "";
      out.nationalIdExpiry = "";
    }
    if (form.citizenPrimaryDocumentType === "NATIONAL_ID") {
      out.passportNumber = "";
      out.passportIssue = "";
      out.passportExpiry = "";
      out.passportIssuingCountry = "";
      out.nationalIdExpiry = "";
    }
  }
  return out;
}

function inferCitizenDocType(profile: Record<string, unknown>): CitizenDocType {
  const raw = profile.citizenPrimaryDocumentType as string | undefined;
  if (raw === "PASSPORT" || raw === "NATIONAL_ID") return raw;
  if (!profile.isNational) return "";
  const hasP = Boolean((profile.passportNumber as string)?.toString().trim());
  const hasN = Boolean((profile.nationalIdNumber as string)?.toString().trim());
  if (hasP && !hasN) return "PASSPORT";
  if (hasN && !hasP) return "NATIONAL_ID";
  return "";
}

function parseResidenceFromProfile(
  p: Record<string, unknown>,
): ResidenceAddressForm {
  const raw = p.residenceAddress;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      line1: String(o.line1 ?? "").trim(),
      line2: String(o.line2 ?? "").trim(),
      city: String(o.city ?? "").trim(),
      state: String(o.state ?? "").trim(),
      postalCode: String(o.postalCode ?? "").trim(),
      country: String(o.country ?? "").trim(),
    };
  }
  const legacy = String(p.residentialAddress ?? "").trim();
  if (legacy) {
    return { ...emptyResidenceAddress, line1: legacy };
  }
  return { ...emptyResidenceAddress };
}

function formSignature(form: IndividualForm): string {
  return JSON.stringify(buildSanitizedKycPayload(form));
}

function formFromSignature(signature: string): IndividualForm {
  const raw = JSON.parse(signature) as IndividualForm;
  return {
    ...empty,
    ...raw,
    residenceAddress: {
      ...emptyResidenceAddress,
      ...(raw.residenceAddress ?? {}),
    },
  };
}

function inferSavedSectionsFromForm(f: IndividualForm): Section[] {
  const saved: Section[] = [];
  const personalComplete = Boolean(
    f.firstName.trim() &&
    f.lastName.trim() &&
    f.dateOfBirth &&
    f.occupation.trim() &&
    f.country.trim(),
  );
  if (personalComplete) saved.push("personal");

  let identityComplete = false;
  if (!f.isNational) {
    identityComplete = Boolean(
      f.passportNumber.trim() &&
      f.passportIssuingCountry.trim() &&
      f.passportIssue &&
      f.passportExpiry &&
      f.workPermitNumber.trim() &&
      f.workPermitIssue &&
      f.workPermitExpiry,
    );
  } else if (f.citizenPrimaryDocumentType === "PASSPORT") {
    identityComplete = Boolean(
      f.passportNumber.trim() &&
      f.passportIssuingCountry.trim() &&
      f.passportIssue &&
      f.passportExpiry,
    );
  } else if (f.citizenPrimaryDocumentType === "NATIONAL_ID") {
    identityComplete = Boolean(
      f.nationalIdNumber.trim() &&
      f.nationalIdIssuingCountry.trim() &&
      f.nationalIdIssue,
    );
  }
  if (identityComplete) saved.push("identity");

  const ra = f.residenceAddress;
  if (ra.line1.trim() && ra.city.trim() && ra.state.trim()) {
    saved.push("address");
  }
  return saved;
}

/** Same rules as the verification documents step: required uploads for this profile path. */
function inferDocumentsSectionFromApi(
  f: IndividualForm,
  documents: { documentType?: string }[] | undefined,
): boolean {
  if (!documents?.length) return false;
  if (f.isNational && !f.citizenPrimaryDocumentType) return false;

  const uploaded = new Set(
    documents.map((d) => d.documentType).filter(Boolean) as string[],
  );

  const needsPassportSlots =
    !f.isNational || f.citizenPrimaryDocumentType === "PASSPORT";
  const needsWorkPermit = !f.isNational;
  const needsNationalId =
    f.isNational && f.citizenPrimaryDocumentType === "NATIONAL_ID";

  if (needsPassportSlots) {
    if (!uploaded.has("PASSPORT_FRONT") || !uploaded.has("PASSPORT_BACK")) {
      return false;
    }
  }
  if (needsWorkPermit) {
    const hasWorkPermit =
      uploaded.has("WORK_PERMIT") ||
      uploaded.has("WORK_PERMIT_FRONT") ||
      uploaded.has("WORK_PERMIT_BACK");
    if (!hasWorkPermit) return false;
  }
  if (needsNationalId) {
    if (
      !uploaded.has("NATIONAL_ID_FRONT") ||
      !uploaded.has("NATIONAL_ID_BACK")
    ) {
      return false;
    }
  }
  return true;
}

function recomputeSavedSections(
  f: IndividualForm,
  docs: { documentType?: string }[] | undefined,
): Section[] {
  const inferred = inferSavedSectionsFromForm(f);
  if (inferDocumentsSectionFromApi(f, docs)) {
    inferred.push("documents");
  }
  return inferred;
}

function mergeSavedSectionsWithKycStatus(
  f: IndividualForm,
  docs: KycDocumentRow[] | undefined,
  kycStatus: string | undefined,
): Section[] {
  const base = recomputeSavedSections(f, docs);
  if (kycStatus === "SUBMITTED" || kycStatus === "APPROVED") {
    const merged = new Set<Section>([
      ...base,
      "personal",
      "identity",
      "address",
      "documents",
      "submitted",
    ]);
    return Array.from(merged);
  }
  return base;
}

/** Cleared when switching Resident ⇄ Citizen so the other path doesn't show stale passport/ID/permit values. */
function emptyIdentityDocs(): Pick<
  IndividualForm,
  | "passportNumber"
  | "passportIssuingCountry"
  | "passportIssue"
  | "passportExpiry"
  | "citizenPrimaryDocumentType"
  | "workPermitNumber"
  | "workPermitIssue"
  | "workPermitExpiry"
  | "nationalIdNumber"
  | "nationalIdIssuingCountry"
  | "nationalIdIssue"
  | "nationalIdExpiry"
> {
  return {
    passportNumber: "",
    passportIssuingCountry: "",
    passportIssue: "",
    passportExpiry: "",
    citizenPrimaryDocumentType: "",
    workPermitNumber: "",
    workPermitIssue: "",
    workPermitExpiry: "",
    nationalIdNumber: "",
    nationalIdIssuingCountry: "",
    nationalIdIssue: "",
    nationalIdExpiry: "",
  };
}

type FormErrors = Partial<
  Record<Exclude<keyof IndividualForm, "residenceAddress">, string>
> & {
  residenceAddress?: Partial<Record<keyof ResidenceAddressForm, string>>;
  registrationPhone?: string;
};

export function IndividualKycWizard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("personal");
  const [form, setForm] = useState<IndividualForm>(empty);
  const formRef = useRef(form);
  formRef.current = form;
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSections, setSavedSections] = useState<Section[]>([]);
  const [persistedSignature, setPersistedSignature] = useState("");
  const [kycDocuments, setKycDocuments] = useState<KycDocumentRow[]>([]);
  const [kycLifecycleStatus, setKycLifecycleStatus] = useState<
    string | undefined
  >(undefined);
  const [kycSubmittedAt, setKycSubmittedAt] = useState<Date | null>(null);
  /** Missing User.country or User.phone (e.g. Google signup) — collect in Personal Info. */
  const [kycNeedsRegistrationContact, setKycNeedsRegistrationContact] =
    useState(false);
  const [registrationPhoneCountry, setRegistrationPhoneCountry] =
    useState<Country | null>(null);
  const [registrationLocalPhone, setRegistrationLocalPhone] = useState("");
  /** When set, user tried to switch step with unsaved edits — `AppDialog` confirms discard. */
  const [pendingSectionAfterUnsaved, setPendingSectionAfterUnsaved] =
    useState<Section | null>(null);

  const {
    countries: flexCountryList,
    loading: flexCountriesLoading,
    error: flexCountriesError,
  } = useFlexCountries(true);

  const {
    countries: catalogCountryList,
    loading: catalogCountriesLoading,
    error: catalogCountriesError,
  } = useCatalogCountries(true);

  const passportRule = useMemo(
    () =>
      getPassportRuleForIssuingCountry(
        form.passportIssuingCountry,
        catalogCountryList,
      ),
    [form.passportIssuingCountry, catalogCountryList],
  );

  const passportHint = useMemo(
    () => passportFormatHint(passportRule, form.passportIssuingCountry),
    [passportRule, form.passportIssuingCountry],
  );

  useEffect(() => {
    setForm((prev) => {
      const c = prev.country.trim();
      if (prev.residenceAddress.country === c) return prev;
      return {
        ...prev,
        residenceAddress: { ...prev.residenceAddress, country: c },
      };
    });
  }, [form.country]);

  /** National ID issuing country is always the registration / residence country. */
  useEffect(() => {
    const c = form.country.trim();
    if (!c) return;
    setForm((prev) => {
      if (prev.nationalIdIssuingCountry === c) return prev;
      return { ...prev, nationalIdIssuingCountry: c };
    });
  }, [form.country]);

  const residenceFlexCountry = useMemo(
    () => flexCountryList.find((c) => c.couName === form.country),
    [flexCountryList, form.country],
  );

  useEffect(() => {
    if (!kycNeedsRegistrationContact) return;
    const c = form.country.trim();
    if (!c) {
      setRegistrationPhoneCountry(null);
      return;
    }
    const fc = flexCountryList.find((x) => x.couName === c);
    setRegistrationPhoneCountry(
      fc ? phoneCountryFromCouCode(fc.couCode) : null,
    );
  }, [kycNeedsRegistrationContact, form.country, flexCountryList]);

  const syncDocumentsFromServer = useCallback(async () => {
    try {
      const res = await api.get("/kyc/profile");
      const userRow = res.data.data as {
        documents?: KycDocumentRow[];
        kycStatus?: string;
      };
      const docs = userRow?.documents ?? [];
      setKycDocuments(docs);
      if (userRow?.kycStatus != null) setKycLifecycleStatus(userRow.kycStatus);
      setSavedSections(
        mergeSavedSectionsWithKycStatus(
          formRef.current,
          docs,
          userRow?.kycStatus,
        ),
      );
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleKycSubmitted = useCallback(() => {
    setPersistedSignature(formSignature(formRef.current));
    setKycLifecycleStatus("SUBMITTED");
    setKycSubmittedAt(new Date());
    setSavedSections([
      "personal",
      "identity",
      "address",
      "documents",
      "submitted",
    ]);
    setActiveSection("submitted");
    router.replace("/onboarding/profile", { scroll: false });
  }, [router]);

  // ─── Load profile ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const res = await api.get("/kyc/profile");
        // API returns the user record at `data` (includes individualProfile, corporateProfile, country, …)
        const userRow = res.data.data as
          | {
              country?: string | null;
              phone?: string | null;
              individualProfile?: Record<string, unknown> | null;
              documents?: KycDocumentRow[];
              kycStatus?: string;
              updatedAt?: string;
            }
          | undefined;
        const profile = userRow?.individualProfile;
        const countryFromRegistration = userRow?.country?.trim() || "";
        const phoneFromUser = String(userRow?.phone ?? "").trim() || "";
        const needsContactGap = !countryFromRegistration || !phoneFromUser;
        setKycNeedsRegistrationContact(needsContactGap);
        setRegistrationLocalPhone("");

        let nextForm: IndividualForm;

        if (profile) {
          const p = profile as Record<string, unknown>;
          const nameParts = String(p.fullName ?? "")
            .trim()
            .split(/\s+/);
          const firstName = nameParts[0] || "";
          const lastName =
            nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
          const middleName =
            nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";

          const isoDate = (v: unknown) =>
            v ? new Date(v as string).toISOString().split("T")[0] : "";

          const raParsed = parseResidenceFromProfile(p);
          const countryLine =
            countryFromRegistration || String(p.country ?? "").trim();
          const residenceAddress: ResidenceAddressForm = {
            ...raParsed,
            country: raParsed.country || countryLine,
          };

          nextForm = {
            firstName,
            middleName,
            lastName,
            dateOfBirth: isoDate(p.dateOfBirth),
            isNational: Boolean(p.isNational),
            passportNumber: String(p.passportNumber ?? ""),
            passportIssuingCountry: String(p.passportIssuingCountry ?? ""),
            passportIssue: isoDate(p.passportIssue),
            passportExpiry: isoDate(p.passportExpiry),
            citizenPrimaryDocumentType: inferCitizenDocType(p),
            workPermitNumber: String(p.workPermitNumber ?? ""),
            workPermitIssue: isoDate(p.workPermitIssue),
            workPermitExpiry: isoDate(p.workPermitExpiry),
            nationalIdNumber: String(p.nationalIdNumber ?? ""),
            nationalIdIssuingCountry: String(p.nationalIdIssuingCountry ?? ""),
            nationalIdIssue: isoDate(p.nationalIdIssue),
            nationalIdExpiry: isoDate(p.nationalIdExpiry),

            residenceAddress,

            country: countryLine,
            contactEmail: String(p.contactEmail ?? ""),
            contactPhone: String(p.contactPhone ?? ""),
            occupation: String(p.occupation ?? ""),
            employerName: String(p.employerName ?? ""),
          };
        } else if (countryFromRegistration) {
          nextForm = {
            ...empty,
            country: countryFromRegistration,
            residenceAddress: {
              ...emptyResidenceAddress,
              country: countryFromRegistration,
            },
          };
        } else {
          nextForm = {
            ...empty,
            residenceAddress: { ...emptyResidenceAddress },
          };
        }

        setForm(nextForm);
        setKycLifecycleStatus(userRow?.kycStatus);
        const docRows = (userRow?.documents ?? []) as KycDocumentRow[];
        setKycDocuments(docRows);
        setSavedSections(
          mergeSavedSectionsWithKycStatus(
            nextForm,
            docRows,
            userRow?.kycStatus,
          ),
        );
        setPersistedSignature(formSignature(nextForm));
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
    if (!savedSections.includes("address")) return;
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

  /** Only when switching path — avoids wiping docs on hydration. */
  function handleIsNationalChange(nextNational: boolean) {
    const prevNational = form.isNational;
    if (nextNational === prevNational) return;
    setForm((p) => ({
      ...p,
      isNational: nextNational,
      ...emptyIdentityDocs(),
    }));
    setErrors((e) => {
      const copy = { ...e };
      const keysToClear = [
        "passportNumber",
        "passportIssuingCountry",
        "passportIssue",
        "passportExpiry",
        "citizenPrimaryDocumentType",
        "workPermitNumber",
        "workPermitIssue",
        "workPermitExpiry",
        "nationalIdNumber",
        "nationalIdIssuingCountry",
        "nationalIdIssue",
        "nationalIdExpiry",
        "isNational",
      ] as const;
      for (const k of keysToClear) {
        delete copy[k];
      }
      return copy;
    });
  }

  const setField = (
    field: Exclude<keyof IndividualForm, "residenceAddress">,
    value: string | boolean,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handlePassportIssuingCountryChange = (name: string) => {
    const rule = getPassportRuleForIssuingCountry(name, catalogCountryList);
    const sanitized = form.passportNumber
      ? sanitizePassportNumber(form.passportNumber, rule)
      : "";
    setForm((prev) => ({
      ...prev,
      passportIssuingCountry: name,
      passportNumber: sanitized,
    }));
    const formatError = sanitized
      ? validatePassportNumber(name, sanitized, {
          countries: catalogCountryList,
        })
      : null;
    setErrors((prev) => ({
      ...prev,
      passportIssuingCountry: "",
      passportNumber: formatError ?? "",
    }));
  };

  const handlePassportNumberChange = (raw: string) => {
    const sanitized = sanitizePassportNumber(raw, passportRule);
    setForm((prev) => ({ ...prev, passportNumber: sanitized }));
    if (!form.passportIssuingCountry.trim()) {
      setErrors((prev) => ({ ...prev, passportNumber: "" }));
      return;
    }
    const formatError = validatePassportNumber(
      form.passportIssuingCountry,
      sanitized,
      {
        countries: catalogCountryList,
        allowEmpty: true,
        allowIncomplete: true,
      },
    );
    setErrors((prev) => ({
      ...prev,
      passportNumber: formatError ?? "",
    }));
  };

  const setResidenceField = (
    sub: keyof ResidenceAddressForm,
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      residenceAddress: { ...prev.residenceAddress, [sub]: value },
    }));
    setErrors((prev) => ({
      ...prev,
      residenceAddress: {
        ...prev.residenceAddress,
        [sub]: "",
      },
    }));
  };

  const validateSection = (section: Section): boolean => {
    if (section === "documents" || section === "submitted") {
      setErrors({});
      return true;
    }

    const newErrors: FormErrors = {};

    if (section === "personal") {
      if (!form.firstName.trim())
        newErrors.firstName = "First name is required";
      if (!form.lastName.trim()) newErrors.lastName = "Last name is required";
      if (!form.dateOfBirth)
        newErrors.dateOfBirth = "Date of birth is required";
      // if (!form.nationality.trim())
      //   newErrors.nationality = "Nationality is required";
      if (!form.occupation.trim())
        newErrors.occupation = "Occupation is required";
      if (kycNeedsRegistrationContact) {
        if (!form.country.trim()) {
          newErrors.country = "Select your country of residence.";
        }
        if (!registrationPhoneCountry) {
          newErrors.registrationPhone = "Please select a country first.";
        } else if (!registrationLocalPhone.trim()) {
          newErrors.registrationPhone = "Phone number is required.";
        } else {
          const min = registrationPhoneCountry.minDigits ?? 7;
          const max = registrationPhoneCountry.maxDigits ?? 15;
          if (
            registrationLocalPhone.length < min ||
            registrationLocalPhone.length > max
          ) {
            const label = registrationPhoneCountry.name ?? "this country";
            const dial = registrationPhoneCountry.dialCode ?? "";
            const dialPart = dial ? ` (+${dial})` : "";
            newErrors.registrationPhone =
              min === max
                ? `Enter exactly ${min} digits for ${label}${dialPart}.`
                : `Enter ${min}–${max} digits for ${label}${dialPart}.`;
          }
        }
      } else if (!form.country.trim()) {
        newErrors.country =
          "Country of residence from your registration is required. If this appears empty, refresh the page or contact support.";
      }
      // Check if user selected resident or citizen
      if (form.isNational === undefined || form.isNational === null) {
        newErrors.isNational = "Please select Resident or Citizen" as any;
      }
    }

    const applyPassportFieldValidation = () => {
      if (!form.passportIssuingCountry.trim()) {
        newErrors.passportIssuingCountry =
          "Passport issuing country is required";
      }
      if (!form.passportNumber.trim()) {
        newErrors.passportNumber = "Passport number is required";
      } else if (form.passportIssuingCountry.trim()) {
        const formatError = validatePassportNumber(
          form.passportIssuingCountry,
          form.passportNumber,
          { countries: catalogCountryList },
        );
        if (formatError) newErrors.passportNumber = formatError;
      }
    };

    if (section === "identity") {
      if (!form.isNational) {
        applyPassportFieldValidation();
        if (!form.passportIssue)
          newErrors.passportIssue = "Issue date is required";
        if (!form.passportExpiry)
          newErrors.passportExpiry = "Expiry date is required";
        if (!form.workPermitNumber.trim())
          newErrors.workPermitNumber = "Work permit number is required";
        if (!form.workPermitIssue)
          newErrors.workPermitIssue = "Work permit issue date is required";
        if (!form.workPermitExpiry)
          newErrors.workPermitExpiry = "Work permit expiry date is required";
      } else {
        if (!form.citizenPrimaryDocumentType) {
          newErrors.citizenPrimaryDocumentType =
            "Select whether you are using a passport or national ID";
        }
        if (form.citizenPrimaryDocumentType === "PASSPORT") {
          applyPassportFieldValidation();
          if (!form.passportIssue)
            newErrors.passportIssue = "Issue date is required";
          if (!form.passportExpiry)
            newErrors.passportExpiry = "Expiry date is required";
        }
        if (form.citizenPrimaryDocumentType === "NATIONAL_ID") {
          if (!form.nationalIdNumber.trim())
            newErrors.nationalIdNumber = "National ID number is required";
          if (!form.nationalIdIssuingCountry.trim())
            newErrors.nationalIdIssuingCountry =
              "National ID issuing country is required";
          if (!form.nationalIdIssue)
            newErrors.nationalIdIssue = "Issue date is required";
        }
      }
    }

    if (section === "address") {
      const ra = form.residenceAddress;
      const raErr: Partial<Record<keyof ResidenceAddressForm, string>> = {};
      if (!ra.line1.trim()) raErr.line1 = "Address line 1 is required";
      if (!ra.city.trim()) raErr.city = "City is required";
      if (!ra.state.trim()) raErr.state = "State or region is required";
      if (!form.country.trim() || !ra.country.trim()) {
        raErr.country =
          "Country of residence is not set. It should match the country you selected at registration—refresh the page or contact support.";
      }
      if (Object.keys(raErr).length) newErrors.residenceAddress = raErr;

      // if (!form.country.trim()) newErrors.country = "Country is required";
      // if (!form.contactPhone.trim())
      //   newErrors.contactPhone = "Phone is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const flowComplete = savedSections.includes("submitted");

  const canAccessSection = (key: Section) => {
    if (flowComplete && key !== "submitted") return false;
    if (key === "submitted") {
      return (
        savedSections.includes("submitted") ||
        kycLifecycleStatus === "SUBMITTED" ||
        kycLifecycleStatus === "APPROVED"
      );
    }
    if (key !== "documents") return true;
    return savedSections.includes("address");
  };

  const saveSection = async (section: Section) => {
    if (section === "documents" || section === "submitted") return;
    if (!validateSection(section)) return;
    try {
      setIsSaving(true);
      const basePayload = buildSanitizedKycPayload(form);
      const payload: Record<string, unknown> = { ...basePayload };
      if (
        kycNeedsRegistrationContact &&
        registrationPhoneCountry &&
        registrationLocalPhone.trim()
      ) {
        payload.registrationPhoneE164 = `+${registrationPhoneCountry.dialCode}${registrationLocalPhone}`;
      }
      await api.post("/kyc/individual/profile", payload);
      if (section === "personal") {
        try {
          const pr = await api.get("/kyc/profile");
          const row = pr.data.data as {
            country?: string | null;
            phone?: string | null;
          };
          const gap = !(row.country?.trim() && row.phone?.trim());
          setKycNeedsRegistrationContact(gap);
          if (!gap) setRegistrationLocalPhone("");
        } catch {
          /* ignore */
        }
      }
      const sig = JSON.stringify(basePayload);
      setPersistedSignature(sig);
      setSavedSections((prev) =>
        prev.includes(section) ? prev : [...prev, section],
      );
      const currentIndex = sections.findIndex((s) => s.key === section);
      if (currentIndex < sections.length - 1) {
        setActiveSection(sections[currentIndex + 1].key);
      }
    } catch (error: unknown) {
      console.error(error);
      notifyApiError(error, "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty =
    persistedSignature.length > 0 &&
    (formSignature(form) !== persistedSignature ||
      (kycNeedsRegistrationContact &&
        registrationLocalPhone.trim().length > 0));

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const requestNavigateToSection = (target: Section) => {
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
    setForm(formFromSignature(persistedSignature));
    setRegistrationLocalPhone("");
    setErrors({});
    setActiveSection(target);
  };

  const inputClass = (
    field: Exclude<keyof IndividualForm, "residenceAddress">,
  ) =>
    `border rounded-lg px-3 h-10 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
      errors[field] ? "border-red-400" : "border-slate-200"
    }`;

  const addrInputClass = (sub: keyof ResidenceAddressForm) =>
    `border rounded-lg px-3 h-10 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
      errors.residenceAddress?.[sub] ? "border-red-400" : "border-slate-200"
    }`;

  // Early return AFTER all hooks ─────────────────────────────────────────────
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
          Identity Verification
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete all sections to submit your KYC application
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2">
        {sections.map((section, index) => {
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
                      : "Save the Address step first to upload documents."
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
              {index < sections.length - 1 && (
                <div
                  className={`h-px flex-1 ${isDone ? "bg-teal-300" : "bg-slate-200"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Section card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        {activeSection !== "submitted" && (
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {sections.find((s) => s.key === activeSection)?.label}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {sections.find((s) => s.key === activeSection)?.description}
            </p>
          </div>
        )}

        {activeSection === "submitted" && (
          <KycSubmittedPanel submittedAt={kycSubmittedAt ?? new Date()} />
        )}

        {/* PERSONAL */}
        {activeSection === "personal" && (
          <div className="space-y-4">
            <Field label="First Name" required error={errors.firstName}>
              <input
                className={inputClass("firstName")}
                placeholder="Enter your first name"
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Middle Name" error={errors.middleName}>
                <input
                  className={inputClass("middleName")}
                  placeholder="Middle name (optional)"
                  value={form.middleName}
                  onChange={(e) => setField("middleName", e.target.value)}
                />
              </Field>

              <Field label="Last Name" required error={errors.lastName}>
                <input
                  className={inputClass("lastName")}
                  placeholder="Enter your last name"
                  value={form.lastName}
                  onChange={(e) => setField("lastName", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Date of Birth" required error={errors.dateOfBirth}>
              <input
                type="date"
                className={inputClass("dateOfBirth")}
                value={form.dateOfBirth}
                onChange={(e) => setField("dateOfBirth", e.target.value)}
              />
            </Field>

            {/* <Field label="Nationality" required error={errors.nationality}>
              <input
                className={inputClass("nationality")}
                placeholder="e.g. Kenyan, British, Indian"
                value={form.nationality}
                onChange={(e) => setField("nationality", e.target.value)}
              />
            </Field> */}

            <Field label="Country of Residence" required error={errors.country}>
              {kycNeedsRegistrationContact ? (
                <>
                  <FlexCountrySelect
                    value={form.country}
                    onChange={(couName) => {
                      const fc = flexCountryList.find(
                        (c) => c.couName === couName,
                      );
                      setForm((prev) => ({ ...prev, country: couName }));
                      setRegistrationPhoneCountry(
                        fc ? phoneCountryFromCouCode(fc.couCode) : null,
                      );
                      setRegistrationLocalPhone("");
                      setErrors((prev) => ({
                        ...prev,
                        country: undefined,
                        registrationPhone: undefined,
                      }));
                    }}
                    error={Boolean(errors.country)}
                    disabled={isSaving}
                    placeholder="Select your country of residence"
                    countries={flexCountryList}
                    countriesLoading={flexCountriesLoading}
                  />
                  <div className="mt-4 space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 block">
                      Mobile number <span className="text-red-500">*</span>
                    </label>
                    {/* <p className="text-xs text-slate-500">
                      We do not have a mobile number on your account yet (for
                      example if you signed in with Google). Add the number you
                      use for account verification.
                    </p> */}
                    <div
                      className={`flex items-center h-10 border rounded-lg overflow-visible transition-all focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-600 bg-white ${
                        errors.registrationPhone
                          ? "border-red-400 focus-within:ring-red-400/20 focus-within:border-red-400"
                          : "border-slate-200"
                      } ${isSaving ? "bg-slate-50" : ""}`}
                    >
                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-1.5 px-3 h-10 text-sm bg-slate-100 border-r border-slate-200 rounded-l-lg">
                          {registrationPhoneCountry ? (
                            <>
                              <Flag
                                code={registrationPhoneCountry.code}
                                style={{
                                  width: 20,
                                  height: 14,
                                  borderRadius: 2,
                                  objectFit: "cover",
                                }}
                              />
                              <span className="text-slate-700 font-medium">
                                +{registrationPhoneCountry.dialCode}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400">
                              Select country
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder={
                          registrationPhoneCountry
                            ? `${registrationPhoneCountry.minDigits} digit number`
                            : "Select country first"
                        }
                        value={registrationLocalPhone}
                        onChange={(e) => {
                          if (registrationPhoneCountry) {
                            const digits = e.target.value
                              .replace(/\D/g, "")
                              .slice(0, registrationPhoneCountry.maxDigits);
                            setRegistrationLocalPhone(digits);
                            setErrors((prev) => ({
                              ...prev,
                              registrationPhone: undefined,
                            }));
                          }
                        }}
                        disabled={isSaving || !registrationPhoneCountry}
                        className="flex-1 h-10 px-3 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-900 disabled:cursor-not-allowed font-mono tracking-wide"
                      />
                    </div>
                    {errors.registrationPhone && (
                      <p className="mt-1.5 text-xs text-red-500">
                        {errors.registrationPhone}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div
                  className={`flex items-center gap-2.5 w-full border rounded-lg px-3 h-10 text-sm text-left bg-slate-50 text-slate-700 cursor-not-allowed select-none border-slate-200 ${
                    errors.country ? "border-red-400" : ""
                  }`}
                  title="Taken from your registration — contact support to change."
                >
                  {form.country ? (
                    <>
                      <span className="text-base leading-none shrink-0 opacity-90">
                        {residenceFlexCountry ? (
                          <FlexCountryFlag
                            couCode={residenceFlexCountry.couCode}
                          />
                        ) : (
                          <span className="inline-block w-5 h-3.5 bg-slate-200 rounded" />
                        )}
                      </span>
                      <span className="font-medium">{form.country}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">Loading country…</span>
                  )}
                </div>
              )}
            </Field>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Residency Status <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-6 p-3 bg-slate-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="residencyStatus"
                    checked={form.isNational === false}
                    onChange={() => handleIsNationalChange(false)}
                    className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-slate-700">Resident</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="residencyStatus"
                    checked={form.isNational === true}
                    onChange={() => handleIsNationalChange(true)}
                    className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-slate-700">Citizen</span>
                </label>
              </div>
              {errors.isNational && (
                <p className="mt-1.5 text-xs text-red-500">
                  {errors.isNational as any}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Occupation" required error={errors.occupation}>
                <input
                  className={inputClass("occupation")}
                  placeholder="e.g. Engineer"
                  value={form.occupation}
                  onChange={(e) => setField("occupation", e.target.value)}
                />
              </Field>
              <Field label="Employer Name" error={errors.employerName}>
                <input
                  className={inputClass("employerName")}
                  placeholder="Company name"
                  value={form.employerName}
                  onChange={(e) => setField("employerName", e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {/* IDENTITY */}
        {activeSection === "identity" && (
          <div className="space-y-5">
            {!form.isNational && (
              <div className="space-y-4">
                <SectionLabel>Passport Details</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Passport issuing country"
                    required
                    error={errors.passportIssuingCountry}
                  >
                    <CatalogCountrySelect
                      value={form.passportIssuingCountry}
                      onChange={handlePassportIssuingCountryChange}
                      error={Boolean(errors.passportIssuingCountry)}
                      placeholder="Select issuing country…"
                      countries={catalogCountryList}
                      countriesLoading={catalogCountriesLoading}
                      countriesError={catalogCountriesError}
                    />
                  </Field>
                  <Field
                    label="Passport Number"
                    required
                    error={errors.passportNumber}
                  >
                    <input
                      className={inputClass("passportNumber")}
                      placeholder={
                        passportHint ? "Enter passport number" : "e.g. A12345678"
                      }
                      value={form.passportNumber}
                      onChange={(e) =>
                        handlePassportNumberChange(e.target.value)
                      }
                      maxLength={passportRule?.maxLength}
                      inputMode={passportRule?.digitsOnly ? "numeric" : "text"}
                      autoCapitalize="characters"
                      spellCheck={false}
                    />
                    {passportHint && !errors.passportNumber ? (
                      <p className="text-xs text-slate-500">{passportHint}</p>
                    ) : null}
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Issue Date"
                    required
                    error={errors.passportIssue}
                  >
                    <input
                      type="date"
                      className={inputClass("passportIssue")}
                      value={form.passportIssue}
                      onChange={(e) =>
                        setField("passportIssue", e.target.value)
                      }
                    />
                  </Field>
                  <Field
                    label="Expiry Date"
                    required
                    error={errors.passportExpiry}
                  >
                    <input
                      type="date"
                      className={inputClass("passportExpiry")}
                      value={form.passportExpiry}
                      onChange={(e) =>
                        setField("passportExpiry", e.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>
            )}

            {!form.isNational && (
              <div className="space-y-4">
                <SectionLabel>Work Permit</SectionLabel>
                <Field
                  label="Work Permit Number"
                  required
                  error={errors.workPermitNumber}
                >
                  <input
                    className={inputClass("workPermitNumber")}
                    placeholder="Work permit number"
                    value={form.workPermitNumber}
                    onChange={(e) =>
                      setField("workPermitNumber", e.target.value)
                    }
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Issue Date"
                    required
                    error={errors.workPermitIssue}
                  >
                    <input
                      type="date"
                      className={inputClass("workPermitIssue")}
                      value={form.workPermitIssue}
                      onChange={(e) =>
                        setField("workPermitIssue", e.target.value)
                      }
                    />
                  </Field>
                  <Field
                    label="Expiry Date"
                    required
                    error={errors.workPermitExpiry}
                  >
                    <input
                      type="date"
                      className={inputClass("workPermitExpiry")}
                      value={form.workPermitExpiry}
                      onChange={(e) =>
                        setField("workPermitExpiry", e.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>
            )}

            {form.isNational && (
              <div className="space-y-5">
                <Field
                  label="Primary document"
                  required
                  error={errors.citizenPrimaryDocumentType}
                >
                  <NativeSelectShell>
                    <select
                      className={`${inputClass("citizenPrimaryDocumentType")} ${fieldNativeSelectClasses} bg-white`}
                      value={form.citizenPrimaryDocumentType}
                      onChange={(e) =>
                        setField(
                          "citizenPrimaryDocumentType",
                          e.target.value as CitizenDocType,
                        )
                      }
                    >
                      <option value="">Select document type…</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="NATIONAL_ID">National ID</option>
                    </select>
                  </NativeSelectShell>
                </Field>

                {form.citizenPrimaryDocumentType === "PASSPORT" && (
                  <div className="space-y-4">
                    <SectionLabel>Passport</SectionLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field
                        label="Passport number"
                        required
                        error={errors.passportNumber}
                      >
                        <input
                          className={inputClass("passportNumber")}
                          placeholder={
                            passportHint
                              ? "Enter passport number"
                              : "e.g. A12345678"
                          }
                          value={form.passportNumber}
                          onChange={(e) =>
                            handlePassportNumberChange(e.target.value)
                          }
                          maxLength={passportRule?.maxLength}
                          inputMode={
                            passportRule?.digitsOnly ? "numeric" : "text"
                          }
                          autoCapitalize="characters"
                          spellCheck={false}
                        />
                        {passportHint && !errors.passportNumber ? (
                          <p className="text-xs text-slate-500">
                            {passportHint}
                          </p>
                        ) : null}
                      </Field>
                      <Field
                        label="Passport issuing country"
                        required
                        error={errors.passportIssuingCountry}
                      >
                        <CatalogCountrySelect
                          value={form.passportIssuingCountry}
                          onChange={handlePassportIssuingCountryChange}
                          error={Boolean(errors.passportIssuingCountry)}
                          placeholder="Select issuing country…"
                          countries={catalogCountryList}
                          countriesLoading={catalogCountriesLoading}
                          countriesError={catalogCountriesError}
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field
                        label="Issue date"
                        required
                        error={errors.passportIssue}
                      >
                        <input
                          type="date"
                          className={inputClass("passportIssue")}
                          value={form.passportIssue}
                          onChange={(e) =>
                            setField("passportIssue", e.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="Expiry date"
                        required
                        error={errors.passportExpiry}
                      >
                        <input
                          type="date"
                          className={inputClass("passportExpiry")}
                          value={form.passportExpiry}
                          onChange={(e) =>
                            setField("passportExpiry", e.target.value)
                          }
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {form.citizenPrimaryDocumentType === "NATIONAL_ID" && (
                  <div className="space-y-4">
                    <SectionLabel>National ID</SectionLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field
                        label="National ID number"
                        required
                        error={errors.nationalIdNumber}
                      >
                        <input
                          className={inputClass("nationalIdNumber")}
                          placeholder="National ID number"
                          value={form.nationalIdNumber}
                          onChange={(e) =>
                            setField("nationalIdNumber", e.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="National ID issuing country"
                        required
                        error={errors.nationalIdIssuingCountry}
                      >
                        <FlexCountrySelect
                          value={form.nationalIdIssuingCountry || form.country}
                          onChange={() => {}}
                          disabled
                          error={Boolean(errors.nationalIdIssuingCountry)}
                          placeholder="Same as country of residence"
                          countries={flexCountryList}
                          countriesLoading={flexCountriesLoading}
                          countriesError={flexCountriesError}
                        />
                        <p className="mt-1.5 text-xs text-slate-500">
                          Same as the country you selected at registration.
                        </p>
                      </Field>
                    </div>
                    <Field
                      label="Issue date"
                      required
                      error={errors.nationalIdIssue}
                    >
                      <input
                        type="date"
                        className={inputClass("nationalIdIssue")}
                        value={form.nationalIdIssue}
                        onChange={(e) =>
                          setField("nationalIdIssue", e.target.value)
                        }
                      />
                    </Field>
                    <p className="text-xs text-slate-500">
                      National ID does not require an expiry date.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ADDRESS */}
        {activeSection === "address" && (
          <div className="space-y-4">
            <SectionLabel>Residential Address</SectionLabel>
            <div className="space-y-4">
              <Field
                label="Address line 1"
                required
                error={errors.residenceAddress?.line1}
              >
                <input
                  className={addrInputClass("line1")}
                  placeholder="Street address, P.O. box"
                  value={form.residenceAddress.line1}
                  onChange={(e) => setResidenceField("line1", e.target.value)}
                />
              </Field>
              <Field
                label="Address line 2"
                error={errors.residenceAddress?.line2}
              >
                <input
                  className={addrInputClass("line2")}
                  placeholder="Apartment, suite, unit (optional)"
                  value={form.residenceAddress.line2}
                  onChange={(e) => setResidenceField("line2", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="City"
                  required
                  error={errors.residenceAddress?.city}
                >
                  <input
                    className={addrInputClass("city")}
                    placeholder="City"
                    value={form.residenceAddress.city}
                    onChange={(e) => setResidenceField("city", e.target.value)}
                  />
                </Field>
                <Field
                  label="State / region"
                  required
                  error={errors.residenceAddress?.state}
                >
                  <StateSearchSelect
                    countryName={form.country}
                    value={form.residenceAddress.state}
                    onChange={(v) => setResidenceField("state", v)}
                    error={Boolean(errors.residenceAddress?.state)}
                    placeholder="State / region"
                  />
                </Field>
              </div>
              <Field
                label="Postal code"
                error={errors.residenceAddress?.postalCode}
              >
                <input
                  className={addrInputClass("postalCode")}
                  placeholder="Postal or ZIP code (optional)"
                  value={form.residenceAddress.postalCode}
                  onChange={(e) =>
                    setResidenceField("postalCode", e.target.value)
                  }
                />
              </Field>
              <Field label="Country" error={errors.residenceAddress?.country}>
                <div
                  className={`flex items-center gap-2.5 w-full border rounded-lg px-3 h-10 text-sm text-left bg-slate-50 text-slate-700 cursor-not-allowed select-none border-slate-200 ${
                    errors.residenceAddress?.country
                      ? "border-red-400"
                      : "border-slate-200"
                  }`}
                  title="Same as the country you selected at registration."
                >
                  {form.residenceAddress.country || form.country ? (
                    <>
                      <span className="text-base leading-none shrink-0 opacity-90">
                        {residenceFlexCountry ? (
                          <FlexCountryFlag
                            couCode={residenceFlexCountry.couCode}
                          />
                        ) : (
                          <span className="inline-block w-5 h-3.5 bg-slate-200 rounded" />
                        )}
                      </span>
                      <span className="font-medium">
                        {form.residenceAddress.country || form.country}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400">Loading…</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Taken from your registration. Shown for your address record;
                  it is saved with your profile.
                </p>
              </Field>
            </div>

            {/* <SectionLabel>Contact Information</SectionLabel> */}
            {/* <div className="grid grid-cols-2 gap-4">
              <Field label="Contact Email" error={errors.contactEmail}>
                <input
                  type="email"
                  className={inputClass("contactEmail")}
                  placeholder="email@example.com"
                  value={form.contactEmail}
                  onChange={(e) => setField("contactEmail", e.target.value)}
                />
              </Field>
              <Field label="Contact Phone" required error={errors.contactPhone}>
                <input
                  type="tel"
                  className={inputClass("contactPhone")}
                  placeholder="+1234567890"
                  value={form.contactPhone}
                  onChange={(e) => setField("contactPhone", e.target.value)}
                />
              </Field>
            </div> */}
          </div>
        )}

        {activeSection === "documents" && (
          <VerificationDocuments
            isNational={form.isNational}
            citizenDocType={form.citizenPrimaryDocumentType}
            documents={kycDocuments}
            onDocumentsSynced={syncDocumentsFromServer}
            onKycSubmitted={handleKycSubmitted}
          />
        )}

        {/* Buttons */}
        {activeSection !== "documents" && activeSection !== "submitted" && (
          <div className="flex justify-between items-center pt-2">
            {activeSection !== "personal" && (
              <button
                type="button"
                onClick={() => {
                  const currentIndex = sections.findIndex(
                    (s) => s.key === activeSection,
                  );
                  requestNavigateToSection(sections[currentIndex - 1].key);
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
              onClick={() => {
                requestNavigateToSection("address");
              }}
              className="cursor-pointer text-sm text-slate-600 hover:text-slate-900 font-medium "
            >
              Back
            </button>
          </div>
        )}
      </div>

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
