"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import api from "@/lib/api";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import Flag from "react-world-flags";
type Section = "personal" | "identity" | "address";

interface IndividualForm {
  fullName: string;
  dateOfBirth: string;
  // nationality: string;
  isNational: boolean;
  passportNumber: string;
  passportIssue: string;
  passportExpiry: string;
  workPermitNumber: string;
  workPermitIssue: string;
  workPermitExpiry: string;
  nationalIdNumber: string;
  nationalIdIssue: string;
  nationalIdExpiry: string;

  residentialAddress: string;

  country: string;
  contactEmail: string;
  contactPhone: string;
  occupation: string;
  employerName: string;
}

const empty: IndividualForm = {
  fullName: "",
  dateOfBirth: "",
  // nationality: "",
  isNational: false,
  passportNumber: "",
  passportIssue: "",
  passportExpiry: "",
  workPermitNumber: "",
  workPermitIssue: "",
  workPermitExpiry: "",
  nationalIdNumber: "",
  nationalIdIssue: "",
  nationalIdExpiry: "",

  residentialAddress: "",

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
    description: "Passport, ID and work permit details",
  },
  {
    key: "address",
    label: "Address & Contact",
    description: "Residential address and contact info",
  },
];

// ─── Country helpers (module-level constants, not inside the component) ────────

const COUNTRIES: { code: string; name: string }[] = [
  { code: "GH", name: "Ghana" },
  { code: "ID", name: "Indonesia" },
  { code: "IN", name: "India" },

  { code: "KE", name: "Kenya" },
  { code: "LB", name: "Lebanon" },
  { code: "LY", name: "Libya" },
  { code: "MA", name: "Morocco" },

  { code: "NG", name: "Nigeria" },

  { code: "ZA", name: "South Africa" },
  { code: "ZW", name: "Zimbabwe" },
];
export default function KycProfilePage() {
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState<Section>("personal");
  const [form, setForm] = useState<IndividualForm>(empty);
  const [errors, setErrors] = useState<
    Partial<Record<keyof IndividualForm, string>>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSections, setSavedSections] = useState<Section[]>([]);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // ─── Load profile ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const res = await api.get("/kyc/profile");
        const profile = res.data.data?.individualProfile;
        if (profile) {
          setForm({
            fullName: profile.fullName || "",
            dateOfBirth: profile.dateOfBirth
              ? new Date(profile.dateOfBirth).toISOString().split("T")[0]
              : "",
            // nationality: profile.nationality || "",
            isNational: profile.isNational || false,
            passportNumber: profile.passportNumber || "",
            passportIssue: profile.passportIssue
              ? new Date(profile.passportIssue).toISOString().split("T")[0]
              : "",
            passportExpiry: profile.passportExpiry
              ? new Date(profile.passportExpiry).toISOString().split("T")[0]
              : "",
            workPermitNumber: profile.workPermitNumber || "",
            workPermitIssue: profile.workPermitIssue
              ? new Date(profile.workPermitIssue).toISOString().split("T")[0]
              : "",
            workPermitExpiry: profile.workPermitExpiry
              ? new Date(profile.workPermitExpiry).toISOString().split("T")[0]
              : "",
            nationalIdNumber: profile.nationalIdNumber || "",
            nationalIdIssue: profile.nationalIdIssue
              ? new Date(profile.nationalIdIssue).toISOString().split("T")[0]
              : "",
            nationalIdExpiry: profile.nationalIdExpiry
              ? new Date(profile.nationalIdExpiry).toISOString().split("T")[0]
              : "",

            residentialAddress: profile.residentialAddress || "",

            country: profile.country || "",
            contactEmail: profile.contactEmail || "",
            contactPhone: profile.contactPhone || "",
            occupation: profile.occupation || "",
            employerName: profile.employerName || "",
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  const setField = (field: keyof IndividualForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateSection = (section: Section): boolean => {
    const newErrors: Partial<Record<keyof IndividualForm, string>> = {};

    if (section === "personal") {
      if (!form.fullName.trim()) newErrors.fullName = "Full name is required";
      if (!form.dateOfBirth)
        newErrors.dateOfBirth = "Date of birth is required";
      // if (!form.nationality.trim())
      //   newErrors.nationality = "Nationality is required";
      if (!form.occupation.trim())
        newErrors.occupation = "Occupation is required";
      if (!form.country.trim())
        newErrors.country = "Country of origin is required";
    }

    if (section === "identity") {
      if (!form.isNational) {
        if (!form.passportNumber.trim())
          newErrors.passportNumber = "Passport number is required";
        if (!form.passportIssue)
          newErrors.passportIssue = "Issue date is required";
        if (!form.passportExpiry)
          newErrors.passportExpiry = "Expiry date is required";
      } else {
        if (!form.nationalIdNumber.trim())
          newErrors.nationalIdNumber = "National ID is required";
        if (!form.nationalIdIssue)
          newErrors.nationalIdIssue = "Issue date is required";
        if (!form.nationalIdExpiry)
          newErrors.nationalIdExpiry = "Expiry date is required";
      }
    }

    if (section === "address") {
      if (!form.residentialAddress.trim())
        newErrors.residentialAddress = "Residential Address is required";

      if (!form.country.trim()) newErrors.country = "Country is required";
      if (!form.contactPhone.trim())
        newErrors.contactPhone = "Phone is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveSection = async (section: Section) => {
    if (!validateSection(section)) return;
    try {
      setIsSaving(true);
      await api.post("/kyc/individual/profile", form);
      setSavedSections((prev) =>
        prev.includes(section) ? prev : [...prev, section],
      );
      const currentIndex = sections.findIndex((s) => s.key === section);
      if (currentIndex < sections.length - 1) {
        setActiveSection(sections[currentIndex + 1].key);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = (field: keyof IndividualForm) =>
    `border rounded-lg px-3 h-10 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
      errors[field] ? "border-red-400" : "border-slate-200"
    }`;

  // ─── Close country dropdown on outside click ──────────────────────────────
  useEffect(() => {
    if (!countryOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-country-dropdown]")) setCountryOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [countryOpen]);

  // Early return AFTER all hooks ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allSectionsDone = sections.every((s) => savedSections.includes(s.key));
  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
          return (
            <div key={section.key} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setActiveSection(section.key)}
                className="flex items-center gap-2 flex-1"
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
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {sections.find((s) => s.key === activeSection)?.label}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {sections.find((s) => s.key === activeSection)?.description}
          </p>
        </div>

        {/* PERSONAL */}
        {activeSection === "personal" && (
          <div className="space-y-4">
            <Field label="Full Name" required error={errors.fullName}>
              <input
                className={inputClass("fullName")}
                placeholder="As it appears on your ID"
                value={form.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
              />
            </Field>

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

            <Field label="Country of Origin" required error={errors.country}>
              <div className="relative" data-country-dropdown>
                {/* Trigger button */}
                <button
                  type="button"
                  onClick={() => {
                    setCountryOpen((v) => !v);
                    setCountrySearch("");
                  }}
                  className={`flex items-center gap-2 w-full border rounded-lg px-3 h-10 text-sm text-left
        focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600
        transition-colors bg-white
        ${errors.country ? "border-red-400" : "border-slate-200"}
        ${form.country ? "text-slate-900" : "text-slate-400"}`}
                >
                  {form.country ? (
                    <>
                      <span className="text-base leading-none">
                        <Flag
                          code={
                            COUNTRIES.find((c) => c.name === form.country)
                              ?.code ?? ""
                          }
                          style={{
                            width: 20,
                            height: 14,
                            borderRadius: 2,
                            objectFit: "cover",
                          }}
                        />
                      </span>
                      <span>{form.country}</span>
                    </>
                  ) : (
                    <span>Select country…</span>
                  )}
                  <svg
                    className="ml-auto w-4 h-4 text-slate-400 shrink-0"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {/* Dropdown panel */}
                {countryOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {/* Search */}
                    <div className="p-2 border-b border-slate-100">
                      <input
                        autoFocus
                        placeholder="Search country…"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md
              focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                      />
                    </div>

                    {/* List */}
                    <ul className="max-h-52 overflow-y-auto py-1">
                      {COUNTRIES.filter((c) =>
                        c.name
                          .toLowerCase()
                          .includes(countrySearch.toLowerCase()),
                      ).map((c) => (
                        <li key={c.code}>
                          <button
                            type="button"
                            onClick={() => {
                              setField("country", c.name);
                              setCountryOpen(false);
                            }}
                            className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left
                  hover:bg-teal-50 hover:text-teal-700 transition-colors
                  ${form.country === c.name ? "bg-teal-50 text-teal-700 font-medium" : "text-slate-700"}`}
                          >
                            <span className="text-base leading-none">
                              <Flag
                                code={c.code}
                                style={{
                                  width: 20,
                                  height: 14,
                                  borderRadius: 2,
                                  objectFit: "cover",
                                }}
                              />
                            </span>
                            <span>{c.name}</span>
                            {form.country === c.name && (
                              <svg
                                className="ml-auto w-4 h-4 text-teal-600"
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
                          </button>
                        </li>
                      ))}
                      {COUNTRIES.filter((c) =>
                        c.name
                          .toLowerCase()
                          .includes(countrySearch.toLowerCase()),
                      ).length === 0 && (
                        <li className="px-3 py-4 text-sm text-slate-400 text-center">
                          No countries found
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </Field>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <input
                type="checkbox"
                id="isNational"
                checked={form.isNational}
                onChange={(e) => setField("isNational", e.target.checked)}
                className="w-4 h-4 accent-teal-600"
              />
              <label
                htmlFor="isNational"
                className="text-sm text-slate-700 cursor-pointer"
              >
                I am a national citizen of the country where I reside
              </label>
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
                <Field
                  label="Passport Number"
                  required
                  error={errors.passportNumber}
                >
                  <input
                    className={inputClass("passportNumber")}
                    placeholder="e.g. A12345678"
                    value={form.passportNumber}
                    onChange={(e) => setField("passportNumber", e.target.value)}
                  />
                </Field>
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
                <SectionLabel>Work Permit (if applicable)</SectionLabel>
                <Field
                  label="Work Permit Number"
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
                  <Field label="Issue Date" error={errors.workPermitIssue}>
                    <input
                      type="date"
                      className={inputClass("workPermitIssue")}
                      value={form.workPermitIssue}
                      onChange={(e) =>
                        setField("workPermitIssue", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Expiry Date" error={errors.workPermitExpiry}>
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
              <div className="space-y-4">
                <SectionLabel>National ID Details</SectionLabel>
                <Field
                  label="National ID Number"
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
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Issue Date"
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
                  <Field
                    label="Expiry Date"
                    required
                    error={errors.nationalIdExpiry}
                  >
                    <input
                      type="date"
                      className={inputClass("nationalIdExpiry")}
                      value={form.nationalIdExpiry}
                      onChange={(e) =>
                        setField("nationalIdExpiry", e.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADDRESS */}
        {activeSection === "address" && (
          <div className="space-y-4">
            <SectionLabel>Residential Address</SectionLabel>
            <Field
              label="Residential Address"
              required
              error={errors.residentialAddress}
            >
              <textarea
                className={`border rounded-lg px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors resize-none ${
                  errors.residentialAddress
                    ? "border-red-400"
                    : "border-slate-200"
                }`}
                placeholder="Enter your full residential address "
                rows={3}
                value={form.residentialAddress}
                onChange={(e) => setField("residentialAddress", e.target.value)}
              />
            </Field>

            <SectionLabel>Contact Information</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
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
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between items-center pt-2">
          {activeSection !== "personal" && (
            <button
              onClick={() => {
                const currentIndex = sections.findIndex(
                  (s) => s.key === activeSection,
                );
                setActiveSection(sections[currentIndex - 1].key);
              }}
              className="text-sm text-slate-600 hover:text-slate-900 font-medium"
            >
              Back
            </button>
          )}
          <div className="ml-auto">
            <button
              onClick={() => saveSection(activeSection)}
              disabled={isSaving}
              className="h-10 px-6 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : activeSection === "address" ? (
                "Save and Continue to Documents"
              ) : (
                "Save and Continue"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* All done banner */}
      {allSectionsDone && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-800">
              Profile complete!
            </p>
            <p className="text-sm text-teal-700">
              Now upload your required documents
            </p>
          </div>
          <Link href="/onboarding/documents">
            <Button className="shrink-0 h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg flex items-center transition-colors">
              Upload Documents
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {children}
      </span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}
