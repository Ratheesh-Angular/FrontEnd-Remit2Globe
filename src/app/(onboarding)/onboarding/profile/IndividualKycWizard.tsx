"use client";

import { useState, useEffect, useMemo } from "react";
import { sessionApi as api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { StateSearchSelect } from "@/components/address/StateSearchSelect";
import { FlexCountryFlag } from "@/components/country/FlexCountryFlag";
import { FlexCountrySelect } from "@/components/country/FlexCountrySelect";
import { useFlexCountries } from "@/hooks/useFlexCountries";
import Flag from "react-world-flags";
import type { Country } from "@/lib/phone-countries";
import { phoneCountryFromCouCode } from "@/lib/flex-country-phone";
import { Field } from "./KycFormPrimitives";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { notifyApiError } from "@/lib/notify";

type View = "personal" | "in_progress" | "approved" | "rejected";

type KycDocumentType = "ALIEN_CARD" | "PASSPORT" | "NATIONAL_ID" | "";

interface ResidenceAddressForm {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface IndividualForm {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  isNational: boolean;
  citizenPrimaryDocumentType: KycDocumentType;
  /** Kenya Resident + Passport only; otherwise saved as null. */
  passportIssuingCountry: string;
  residenceAddress: ResidenceAddressForm;
  country: string;
  contactEmail: string;
  contactPhone: string;
  occupation: string;
  employerName: string;
}

function isKenyaCountry(country: string): boolean {
  const n = country.trim().toLowerCase();
  return n === "kenya" || n === "ken" || n === "ke";
}

function parseDocumentType(raw: unknown): KycDocumentType {
  const v = String(raw ?? "").trim();
  if (v === "ALIEN_CARD" || v === "PASSPORT" || v === "NATIONAL_ID") return v;
  return "";
}

const emptyResidenceAddress: ResidenceAddressForm = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

const empty: IndividualForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  dateOfBirth: "",
  isNational: false,
  citizenPrimaryDocumentType: "",
  passportIssuingCountry: "",
  residenceAddress: { ...emptyResidenceAddress },
  country: "",
  contactEmail: "",
  contactPhone: "",
  occupation: "",
  employerName: "",
};

type FormErrors = Partial<
  Record<Exclude<keyof IndividualForm, "residenceAddress">, string>
> & {
  residenceAddress?: Partial<Record<keyof ResidenceAddressForm, string>>;
  registrationPhone?: string;
};

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

function buildPayload(form: IndividualForm) {
  const kenya = isKenyaCountry(form.country);
  const sendPassportCountry =
    kenya &&
    form.isNational === false &&
    form.citizenPrimaryDocumentType === "PASSPORT";

  return {
    firstName: form.firstName.trim(),
    middleName: form.middleName.trim() || undefined,
    lastName: form.lastName.trim(),
    dateOfBirth: form.dateOfBirth,
    isNational: form.isNational,
    country: form.country.trim(),
    citizenPrimaryDocumentType: kenya
      ? form.citizenPrimaryDocumentType || null
      : null,
    passportIssuingCountry: sendPassportCountry
      ? form.passportIssuingCountry.trim() || null
      : null,
    residenceAddress: {
      line1: form.residenceAddress.line1.trim(),
      line2: form.residenceAddress.line2.trim(),
      city: form.residenceAddress.city.trim(),
      state: form.residenceAddress.state.trim(),
      postalCode: form.residenceAddress.postalCode.trim(),
      country: form.country.trim(),
    },
    contactEmail: form.contactEmail.trim() || undefined,
    contactPhone: form.contactPhone.trim() || undefined,
    occupation: form.occupation.trim() || undefined,
    employerName: form.employerName.trim() || undefined,
  };
}

function viewFromKycStatus(status: string | undefined): View {
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "rejected";
  if (status === "IN_PROGRESS" || status === "SUBMITTED") return "in_progress";
  return "personal";
}

export function IndividualKycWizard() {
  const router = useRouter();
  const [view, setView] = useState<View>("personal");
  const [form, setForm] = useState<IndividualForm>(empty);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [kycLifecycleStatus, setKycLifecycleStatus] = useState<
    string | undefined
  >(undefined);
  const [decisionReason, setDecisionReason] = useState<string | null>(null);
  const [resumeJourneyUrl, setResumeJourneyUrl] = useState<string | null>(null);

  const [kycNeedsRegistrationContact, setKycNeedsRegistrationContact] =
    useState(false);
  const [registrationPhoneCountry, setRegistrationPhoneCountry] =
    useState<Country | null>(null);
  const [registrationLocalPhone, setRegistrationLocalPhone] = useState("");

  const {
    countries: flexCountryList,
    loading: flexCountriesLoading,
  } = useFlexCountries(true);

  const residenceFlexCountry = useMemo(
    () => flexCountryList.find((c) => c.couName === form.country),
    [flexCountryList, form.country],
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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const res = await api.get("/kyc/profile");
        const userRow = res.data.data as
          | {
              country?: string | null;
              phone?: string | null;
              individualProfile?: Record<string, unknown> | null;
              kycStatus?: string;
            }
          | undefined;

        const profile = userRow?.individualProfile;
        const countryFromRegistration = userRow?.country?.trim() || "";
        const phoneFromUser = String(userRow?.phone ?? "").trim() || "";
        const needsContactGap = !countryFromRegistration || !phoneFromUser;
        setKycNeedsRegistrationContact(needsContactGap);
        setRegistrationLocalPhone("");
        setKycLifecycleStatus(userRow?.kycStatus);

        let nextForm: IndividualForm;
        if (profile) {
          const p = profile;
          const nameParts = String(p.fullName ?? "")
            .trim()
            .split(/\s+/);
          const firstName =
            String(p.firstName ?? "").trim() || nameParts[0] || "";
          const lastName =
            String(p.lastName ?? "").trim() ||
            (nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");
          const middleName =
            String(p.middleName ?? "").trim() ||
            (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "");
          const isoDate = (v: unknown) =>
            v ? new Date(v as string).toISOString().split("T")[0] : "";
          const raParsed = parseResidenceFromProfile(p);
          const countryLine =
            countryFromRegistration || String(p.country ?? "").trim();

          nextForm = {
            firstName,
            middleName,
            lastName,
            dateOfBirth: isoDate(p.dateOfBirth),
            isNational: Boolean(p.isNational),
            citizenPrimaryDocumentType: parseDocumentType(
              p.citizenPrimaryDocumentType,
            ),
            passportIssuingCountry: String(p.passportIssuingCountry ?? "").trim(),
            residenceAddress: {
              ...raParsed,
              country: raParsed.country || countryLine,
            },
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
          nextForm = { ...empty, residenceAddress: { ...emptyResidenceAddress } };
        }

        setForm(nextForm);
        setView(viewFromKycStatus(userRow?.kycStatus));

        if (
          userRow?.kycStatus === "IN_PROGRESS" ||
          userRow?.kycStatus === "REJECTED"
        ) {
          try {
            const st = await api.get("/kyc/signzy/status");
            const data = st.data?.data as {
              journey?: {
                journeyUrl?: string | null;
                kycDecisionReason?: string | null;
              } | null;
            };
            setResumeJourneyUrl(data?.journey?.journeyUrl ?? null);
            setDecisionReason(data?.journey?.kycDecisionReason ?? null);
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  const setField = <K extends keyof IndividualForm>(
    key: K,
    value: IndividualForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const setResidenceField = <K extends keyof ResidenceAddressForm>(
    key: K,
    value: ResidenceAddressForm[K],
  ) => {
    setForm((prev) => ({
      ...prev,
      residenceAddress: { ...prev.residenceAddress, [key]: value },
    }));
    setErrors((prev) => ({
      ...prev,
      residenceAddress: { ...prev.residenceAddress, [key]: undefined },
    }));
  };

  const inputClass = (key: keyof FormErrors) =>
    `w-full border rounded-lg px-3 h-10 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-600 ${
      errors[key] ? "border-red-400" : "border-slate-200"
    }`;

  const addrInputClass = (key: keyof ResidenceAddressForm) =>
    `w-full border rounded-lg px-3 h-10 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-600 ${
      errors.residenceAddress?.[key] ? "border-red-400" : "border-slate-200"
    }`;

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = "First name is required";
    if (!form.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!form.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
    if (!form.country.trim()) newErrors.country = "Country is required";
    if (form.isNational === undefined || form.isNational === null) {
      newErrors.isNational = "Please select Resident or Citizen";
    }
    if (isKenyaCountry(form.country)) {
      const doc = form.citizenPrimaryDocumentType;
      if (!doc) {
        newErrors.citizenPrimaryDocumentType =
          "Please select the document you will upload";
      } else if (form.isNational && doc === "ALIEN_CARD") {
        newErrors.citizenPrimaryDocumentType =
          "Citizens must choose National ID or Passport";
      } else if (!form.isNational && doc === "NATIONAL_ID") {
        newErrors.citizenPrimaryDocumentType =
          "Residents must choose Alien card or Passport";
      } else if (!form.isNational && doc === "PASSPORT") {
        if (!form.passportIssuingCountry.trim()) {
          newErrors.passportIssuingCountry = "Passport country is required";
        }
      }
    }
    const ra = form.residenceAddress;
    const raErrors: Partial<Record<keyof ResidenceAddressForm, string>> = {};
    if (!ra.line1.trim()) raErrors.line1 = "Address is required";
    if (!ra.city.trim()) raErrors.city = "City is required";
    if (!ra.state.trim()) raErrors.state = "State / region is required";
    if (Object.keys(raErrors).length) newErrors.residenceAddress = raErrors;

    if (kycNeedsRegistrationContact) {
      if (!registrationPhoneCountry) {
        newErrors.registrationPhone = "Select your country first";
      } else {
        const digits = registrationLocalPhone.replace(/\D/g, "");
        if (digits.length < registrationPhoneCountry.minDigits) {
          newErrors.registrationPhone = `Enter a valid ${registrationPhoneCountry.minDigits}-digit mobile number`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const startSignzyJourney = async () => {
    const res = await api.post("/kyc/signzy/create-journey");
    const journeyUrl = res.data?.data?.journeyUrl as string | undefined;
    if (!journeyUrl) {
      throw new Error("KYC journey URL was not returned");
    }
    setKycLifecycleStatus("IN_PROGRESS");
    setView("in_progress");
    window.location.href = journeyUrl;
  };

  const saveAndStartKyc = async () => {
    if (!validate()) return;
    try {
      setIsSaving(true);
      const payload: Record<string, unknown> = { ...buildPayload(form) };
      if (
        kycNeedsRegistrationContact &&
        registrationPhoneCountry &&
        registrationLocalPhone.trim()
      ) {
        payload.registrationPhoneE164 = `+${registrationPhoneCountry.dialCode}${registrationLocalPhone}`;
      }
      await api.post("/kyc/individual/profile", payload);

      if (kycNeedsRegistrationContact) {
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

      await startSignzyJourney();
    } catch (error: unknown) {
      console.error(error);
      notifyApiError(error, "Could not start identity verification. Please try again.");
      setIsSaving(false);
    }
  };

  const retryKyc = async () => {
    try {
      setIsSaving(true);
      await startSignzyJourney();
    } catch (error: unknown) {
      console.error(error);
      notifyApiError(error, "Could not restart identity verification.");
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <AppLoadingOverlay show label="Loading your profile…" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Identity verification
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete your personal details, then verify your identity with our
          secure partner.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        {view === "approved" && (
          <div className="space-y-4 text-center py-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              Your identity is verified
            </h2>
            <p className="text-sm text-slate-500">
              You can now add beneficiaries and send money.
            </p>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="cursor-pointer h-10 px-6 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg"
            >
              Go to dashboard
            </button>
          </div>
        )}

        {view === "in_progress" && (
          <div className="space-y-4 text-center py-6">
            <div className="mx-auto h-10 w-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            <h2 className="text-base font-semibold text-slate-900">
              Verification in progress
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Complete the identity check in the verification window. If you
              closed it early, you can resume or start again.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {resumeJourneyUrl && (
                <a
                  href={resumeJourneyUrl}
                  className="h-10 px-6 inline-flex items-center bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg"
                >
                  Resume verification
                </a>
              )}
              <button
                type="button"
                onClick={retryKyc}
                disabled={isSaving}
                className="cursor-pointer h-10 px-6 border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {isSaving ? "Starting…" : "Start new verification"}
              </button>
              <button
                type="button"
                onClick={() => setView("personal")}
                className="cursor-pointer h-10 px-4 text-sm text-slate-600 hover:text-slate-900 font-medium"
              >
                Edit personal info
              </button>
            </div>
            {kycLifecycleStatus && (
              <p className="text-xs text-slate-400">Status: {kycLifecycleStatus}</p>
            )}
          </div>
        )}

        {view === "rejected" && (
          <div className="space-y-4 text-center py-6">
            <h2 className="text-base font-semibold text-slate-900">
              Verification did not pass
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {decisionReason ||
                "Please try again. Make sure your documents are clear and match your personal details."}
            </p>
            <button
              type="button"
              onClick={retryKyc}
              disabled={isSaving}
              className="cursor-pointer h-10 px-6 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {isSaving ? "Starting…" : "Retry verification"}
            </button>
            <button
              type="button"
              onClick={() => setView("personal")}
              className="block mx-auto cursor-pointer text-sm text-slate-600 hover:text-slate-900 font-medium"
            >
              Edit personal info
            </button>
          </div>
        )}

        {view === "personal" && (
          <>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Personal Info
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Your basic personal details
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="First Name" required error={errors.firstName}>
                  <input
                    className={inputClass("firstName")}
                    placeholder="Enter your first name"
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Date of Birth" required error={errors.dateOfBirth}>
                  <input
                    type="date"
                    className={inputClass("dateOfBirth")}
                    value={form.dateOfBirth}
                    onChange={(e) => setField("dateOfBirth", e.target.value)}
                  />
                </Field>
                <Field
                  label="Country of Residence"
                  required
                  error={errors.country}
                >
                  {kycNeedsRegistrationContact ? (
                    <FlexCountrySelect
                      value={form.country}
                      onChange={(couName) => {
                        const fc = flexCountryList.find(
                          (c) => c.couName === couName,
                        );
                        setForm((prev) => {
                          const stillKenya = isKenyaCountry(couName);
                          return {
                            ...prev,
                            country: couName,
                            citizenPrimaryDocumentType: stillKenya
                              ? prev.citizenPrimaryDocumentType
                              : "",
                            passportIssuingCountry: stillKenya
                              ? prev.passportIssuingCountry
                              : "",
                          };
                        });
                        setRegistrationPhoneCountry(
                          fc ? phoneCountryFromCouCode(fc.couCode) : null,
                        );
                        setRegistrationLocalPhone("");
                        setErrors((prev) => ({
                          ...prev,
                          country: undefined,
                          registrationPhone: undefined,
                          citizenPrimaryDocumentType: undefined,
                          passportIssuingCountry: undefined,
                        }));
                      }}
                      error={Boolean(errors.country)}
                      disabled={isSaving}
                      placeholder="Select your country of residence"
                      countries={flexCountryList}
                      countriesLoading={flexCountriesLoading}
                    />
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
              </div>

              {kycNeedsRegistrationContact && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 block">
                    Mobile number <span className="text-red-500">*</span>
                  </label>
                  <div
                    className={`flex items-center h-10 border rounded-lg overflow-visible transition-all focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-600 bg-white ${
                      errors.registrationPhone
                        ? "border-red-400"
                        : "border-slate-200"
                    }`}
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
                          <span className="text-slate-400">Select country</span>
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
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Residency Status <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-4 sm:gap-6 px-3 bg-slate-50 rounded-lg border border-transparent h-10">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="residencyStatus"
                      checked={form.isNational === false}
                      onChange={() => {
                        setForm((prev) => ({
                          ...prev,
                          isNational: false,
                          citizenPrimaryDocumentType:
                            prev.citizenPrimaryDocumentType === "NATIONAL_ID"
                              ? ""
                              : prev.citizenPrimaryDocumentType,
                          passportIssuingCountry:
                            prev.citizenPrimaryDocumentType === "PASSPORT"
                              ? prev.passportIssuingCountry
                              : "",
                        }));
                        setErrors((prev) => ({
                          ...prev,
                          isNational: undefined,
                          citizenPrimaryDocumentType: undefined,
                          passportIssuingCountry: undefined,
                        }));
                      }}
                      className="w-4 h-4 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-slate-700">Resident</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="residencyStatus"
                      checked={form.isNational === true}
                      onChange={() => {
                        setForm((prev) => ({
                          ...prev,
                          isNational: true,
                          citizenPrimaryDocumentType:
                            prev.citizenPrimaryDocumentType === "ALIEN_CARD"
                              ? ""
                              : prev.citizenPrimaryDocumentType,
                          passportIssuingCountry: "",
                        }));
                        setErrors((prev) => ({
                          ...prev,
                          isNational: undefined,
                          citizenPrimaryDocumentType: undefined,
                          passportIssuingCountry: undefined,
                        }));
                      }}
                      className="w-4 h-4 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-slate-700">Citizen</span>
                  </label>
                </div>
                {errors.isNational && (
                  <p className="mt-1.5 text-xs text-red-500">
                    {errors.isNational}
                  </p>
                )}
              </div>

              {isKenyaCountry(form.country) && (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Document type <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 px-3 bg-slate-50 rounded-lg border border-transparent min-h-10 py-2">
                      {form.isNational ? (
                        <>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="kycDocumentType"
                              checked={
                                form.citizenPrimaryDocumentType ===
                                "NATIONAL_ID"
                              }
                              onChange={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  citizenPrimaryDocumentType: "NATIONAL_ID",
                                  passportIssuingCountry: "",
                                }));
                                setErrors((prev) => ({
                                  ...prev,
                                  citizenPrimaryDocumentType: undefined,
                                  passportIssuingCountry: undefined,
                                }));
                              }}
                              className="w-4 h-4 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm text-slate-700">
                              National ID
                            </span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="kycDocumentType"
                              checked={
                                form.citizenPrimaryDocumentType === "PASSPORT"
                              }
                              onChange={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  citizenPrimaryDocumentType: "PASSPORT",
                                  passportIssuingCountry: "",
                                }));
                                setErrors((prev) => ({
                                  ...prev,
                                  citizenPrimaryDocumentType: undefined,
                                  passportIssuingCountry: undefined,
                                }));
                              }}
                              className="w-4 h-4 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm text-slate-700">
                              Passport
                            </span>
                          </label>
                        </>
                      ) : (
                        <>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="kycDocumentType"
                              checked={
                                form.citizenPrimaryDocumentType ===
                                "ALIEN_CARD"
                              }
                              onChange={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  citizenPrimaryDocumentType: "ALIEN_CARD",
                                  passportIssuingCountry: "",
                                }));
                                setErrors((prev) => ({
                                  ...prev,
                                  citizenPrimaryDocumentType: undefined,
                                  passportIssuingCountry: undefined,
                                }));
                              }}
                              className="w-4 h-4 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm text-slate-700">
                              Alien card
                            </span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="kycDocumentType"
                              checked={
                                form.citizenPrimaryDocumentType === "PASSPORT"
                              }
                              onChange={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  citizenPrimaryDocumentType: "PASSPORT",
                                }));
                                setErrors((prev) => ({
                                  ...prev,
                                  citizenPrimaryDocumentType: undefined,
                                }));
                              }}
                              className="w-4 h-4 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm text-slate-700">
                              Passport
                            </span>
                          </label>
                        </>
                      )}
                    </div>
                    {errors.citizenPrimaryDocumentType && (
                      <p className="mt-1.5 text-xs text-red-500">
                        {errors.citizenPrimaryDocumentType}
                      </p>
                    )}
                  </div>

                  {!form.isNational &&
                    form.citizenPrimaryDocumentType === "PASSPORT" && (
                      <Field
                        label="Passport country"
                        required
                        error={errors.passportIssuingCountry}
                      >
                        <FlexCountrySelect
                          value={form.passportIssuingCountry}
                          onChange={(couName) => {
                            setField("passportIssuingCountry", couName);
                          }}
                          error={Boolean(errors.passportIssuingCountry)}
                          disabled={isSaving}
                          placeholder="Select the country that issued your passport"
                          countries={flexCountryList}
                          countriesLoading={flexCountriesLoading}
                        />
                      </Field>
                    )}
                </>
              )}

              <Field
                label="Address Line"
                required
                error={errors.residenceAddress?.line1}
              >
                <textarea
                  className={`${addrInputClass("line1")} h-auto min-h-[4.5rem] py-2.5 resize-y`}
                  placeholder="Street address, P.O. box"
                  rows={3}
                  value={form.residenceAddress.line1}
                  onChange={(e) => setResidenceField("line1", e.target.value)}
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
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={saveAndStartKyc}
                disabled={isSaving}
                className="cursor-pointer h-10 px-6 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Starting verification…
                  </>
                ) : (
                  "Save and Continue"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
