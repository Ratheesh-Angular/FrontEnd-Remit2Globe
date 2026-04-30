"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { sessionApi as api } from "@/lib/api";
import {
  getPasswordRequirementRows,
  getPasswordStrength,
  meetsStrongPassword,
  type PasswordStrength,
} from "@/lib/passwordStrength";
import { documentTypeLabel } from "./documentLabels";
import {
  User,
  FileText,
  FolderOpen,
  Shield,
  ExternalLink,
  Pencil,
} from "lucide-react";

type TabId = "account" | "verification" | "documents" | "security";

function fmtDate(v: string | Date | null | undefined): string {
  if (v == null) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function residenceDetailRows(
  individual: Record<string, unknown> | null | undefined,
): { label: string; value: string }[] {
  const r = individual?.residenceAddress;
  if (r && typeof r === "object" && !Array.isArray(r)) {
    const o = r as Record<string, unknown>;
    const rows: { label: string; value: string }[] = [];
    const line1 = String(o.line1 ?? "").trim();
    const line2 = String(o.line2 ?? "").trim();
    const city = String(o.city ?? "").trim();
    const state = String(o.state ?? "").trim();
    const postal = String(o.postalCode ?? "").trim();
    if (line1) rows.push({ label: "Address line 1", value: line1 });
    if (line2) rows.push({ label: "Address line 2", value: line2 });
    if (city) rows.push({ label: "City", value: city });
    if (state) rows.push({ label: "State", value: state });
    if (postal) rows.push({ label: "Postal code", value: postal });
    if (rows.length) return rows;
  }
  const legacy = individual?.residentialAddress;
  if (legacy != null && String(legacy).trim()) {
    return [{ label: "Residential address", value: String(legacy) }];
  }
  return [];
}

function KycBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
    SUBMITTED: "bg-blue-50 text-blue-800 ring-blue-200",
    APPROVED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    REJECTED: "bg-red-50 text-red-800 ring-red-200",
    SUSPENDED: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  const labels: Record<string, string> = {
    PENDING: "Pending",
    SUBMITTED: "Under review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    SUSPENDED: "Suspended",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${map[status] ?? "bg-slate-50 text-slate-700 ring-slate-200"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-800",
    APPROVED: "bg-emerald-50 text-emerald-800",
    REJECTED: "bg-red-50 text-red-800",
  };
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-md ${map[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {status}
    </span>
  );
}

function DetailRow({
  label,
  value,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`grid gap-1 py-3 border-b border-slate-100 last:border-0 sm:grid-cols-3 sm:gap-4 ${wide ? "sm:items-start" : "sm:items-center"}`}
    >
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={`text-sm text-slate-900 sm:col-span-2 ${wide ? "whitespace-pre-wrap break-words" : ""}`}
      >
        {value === "" || value == null ? (
          <span className="text-slate-400">Not provided</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-1 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description ? (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-5 py-2">{children}</div>
    </section>
  );
}

function strengthLabel(s: PasswordStrength): string {
  if (s === "strong") return "Strong";
  if (s === "medium") return "Medium";
  return "Weak";
}

function strengthColor(s: PasswordStrength): string {
  if (s === "strong") return "text-emerald-600";
  if (s === "medium") return "text-amber-600";
  return "text-red-600";
}

function strengthBar(s: PasswordStrength): string {
  if (s === "strong") return "bg-emerald-500";
  if (s === "medium") return "bg-amber-400";
  return "bg-red-500";
}

export default function ProfilePageClient() {
  const [tab, setTab] = useState<TabId>("account");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<{
    id: string;
    email: string | null;
    phone: string | null;
    country: string | null;
    role: string;
    kycStatus: string;
    createdAt: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    hasPassword?: boolean;
  } | null>(null);
  const [full, setFull] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [meRes, kycRes] = await Promise.all([
        api.get("/auth/me"),
        api.get("/kyc/profile"),
      ]);
      setMe(meRes.data.data?.user ?? null);
      setFull(kycRes.data.data ?? null);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? "Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const role = me?.role ?? (full as { role?: string })?.role;
  const individual = full?.individualProfile as Record<string, unknown> | null;
  const corporate = full?.corporateProfile as Record<string, unknown> | null;
  const documents = (full?.documents as Array<Record<string, unknown>>) ?? [];

  const tabs: { id: TabId; label: string; icon: typeof User }[] = [
    { id: "account", label: "Account", icon: User },
    { id: "verification", label: "Verification", icon: FileText },
    { id: "documents", label: "Documents", icon: FolderOpen },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Profile
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Your account details and verification information
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav
          className="flex gap-1 overflow-x-auto pb-px"
          aria-label="Profile sections"
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`
                  flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                  ${
                    active
                      ? "border-teal-600 text-teal-700"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200"
                  }
                `}
              >
                <Icon className="w-4 h-4 shrink-0 opacity-90" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Loading profile…
        </div>
      ) : (
        <>
          {tab === "account" && me && (
            <div className="space-y-6">
              <SectionCard
                title="Account overview"
                description="How your account appears in our system"
              >
                <dl>
                  <DetailRow label="Email" value={me.email} />
                  <DetailRow label="Phone" value={me.phone} />
                  <DetailRow label="Registration country" value={me.country} />
                  <DetailRow
                    label="Account type"
                    value={
                      me.role === "INDIVIDUAL" ? "Individual" : "Corporate"
                    }
                  />
                  <DetailRow
                    label="KYC status"
                    value={<KycBadge status={me.kycStatus} />}
                  />
                  <DetailRow
                    label="Email verified"
                    value={me.emailVerified ? "Yes" : "No"}
                  />
                  <DetailRow
                    label="Phone verified"
                    value={me.phoneVerified ? "Yes" : "No"}
                  />
                  <DetailRow
                    label="Member since"
                    value={fmtDate(me.createdAt)}
                  />
                </dl>
              </SectionCard>
            </div>
          )}

          {tab === "verification" && (
            <div className="space-y-6">
              {role === "CORPORATE" ? (
                <>
                  <SectionCard
                    title="Business information"
                    description="Registered business details"
                    action={
                      <Link
                        href="/onboarding/profile"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Update in KYC
                      </Link>
                    }
                  >
                    <dl>
                      <DetailRow
                        label="Business name"
                        value={corporate?.businessName as string}
                      />
                      <DetailRow
                        label="Nature of business"
                        value={corporate?.natureOfBusiness as string}
                      />
                      <DetailRow
                        label="Business address"
                        value={corporate?.businessAddress as string}
                        wide
                      />
                      <DetailRow
                        label="Registration number"
                        value={corporate?.registrationNumber as string}
                      />
                      <DetailRow
                        label="Incorporation date"
                        value={fmtDate(
                          corporate?.incorporationDate as string | undefined,
                        )}
                      />
                    </dl>
                  </SectionCard>

                  <SectionCard
                    title="Licenses & registration"
                    description="Trading and regulatory licenses"
                  >
                    <dl>
                      <DetailRow
                        label="Trading license number"
                        value={corporate?.tradingLicenseNumber as string}
                      />
                      <DetailRow
                        label="Trading license issued"
                        value={fmtDate(
                          corporate?.tradingLicenseIssue as string | undefined,
                        )}
                      />
                      <DetailRow
                        label="Trading license expires"
                        value={fmtDate(
                          corporate?.tradingLicenseExpiry as string | undefined,
                        )}
                      />
                      <DetailRow
                        label="Regulatory license number"
                        value={corporate?.regulatoryLicenseNumber as string}
                      />
                      <DetailRow
                        label="Regulatory license issued"
                        value={fmtDate(
                          corporate?.regulatoryLicenseIssue as
                            | string
                            | undefined,
                        )}
                      />
                      <DetailRow
                        label="Regulatory license expires"
                        value={fmtDate(
                          corporate?.regulatoryLicenseExpiry as
                            | string
                            | undefined,
                        )}
                      />
                    </dl>
                  </SectionCard>

                  <SectionCard
                    title="Key personnel"
                    description="Directors and officers (as submitted)"
                  >
                    <JsonOrEmpty value={corporate?.keyPersonnel} />
                  </SectionCard>

                  <SectionCard
                    title="Shareholders"
                    description="Shareholding structure (as submitted)"
                  >
                    <JsonOrEmpty value={corporate?.shareholders} />
                  </SectionCard>
                </>
              ) : (
                <>
                  <SectionCard
                    title="Personal information"
                    description="Name and basic details from your KYC"
                    action={
                      <Link
                        href="/onboarding/profile"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Update in KYC
                      </Link>
                    }
                  >
                    <dl>
                      <DetailRow
                        label="Full name"
                        value={
                          (individual?.fullName as string) ||
                          [
                            individual?.firstName,
                            individual?.middleName,
                            individual?.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ") ||
                          ""
                        }
                      />
                      <DetailRow
                        label="First name"
                        value={individual?.firstName as string}
                      />
                      <DetailRow
                        label="Middle name"
                        value={individual?.middleName as string}
                      />
                      <DetailRow
                        label="Last name"
                        value={individual?.lastName as string}
                      />
                      <DetailRow
                        label="Date of birth"
                        value={fmtDate(
                          individual?.dateOfBirth as string | undefined,
                        )}
                      />
                      <DetailRow
                        label="Nationality"
                        value={individual?.passportIssuingCountry as string}
                      />
                      <DetailRow
                        label="National / foreign"
                        value={
                          individual?.isNational
                            ? "National"
                            : individual?.isNational === false
                              ? "Foreign national"
                              : ""
                        }
                      />
                    </dl>
                  </SectionCard>

                  <SectionCard
                    title="Identity documents"
                    description="Passport, national ID, and work permit (as provided)"
                  >
                    <dl>
                      {individual?.isNational ? (
                        <DetailRow
                          label="Primary document (citizen)"
                          value={
                            individual?.citizenPrimaryDocumentType ===
                            "PASSPORT"
                              ? "Passport"
                              : individual?.citizenPrimaryDocumentType ===
                                  "NATIONAL_ID"
                                ? "National ID"
                                : "—"
                          }
                        />
                      ) : null}
                      {!individual?.isNational ||
                      individual?.citizenPrimaryDocumentType === "PASSPORT" ? (
                        <DetailRow
                          label="Passport issuing country"
                          value={individual?.passportIssuingCountry as string}
                        />
                      ) : null}
                      <DetailRow
                        label="Passport number"
                        value={individual?.passportNumber as string}
                      />
                      <DetailRow
                        label="Passport issued"
                        value={fmtDate(
                          individual?.passportIssue as string | undefined,
                        )}
                      />
                      <DetailRow
                        label="Passport expires"
                        value={fmtDate(
                          individual?.passportExpiry as string | undefined,
                        )}
                      />
                      {individual?.citizenPrimaryDocumentType ===
                      "NATIONAL_ID" ? (
                        <DetailRow
                          label="National ID issuing country"
                          value={individual?.nationalIdIssuingCountry as string}
                        />
                      ) : null}
                      <DetailRow
                        label="National ID number"
                        value={individual?.nationalIdNumber as string}
                      />
                      <DetailRow
                        label="National ID issued"
                        value={fmtDate(
                          individual?.nationalIdIssue as string | undefined,
                        )}
                      />
                      <DetailRow
                        label="National ID expires"
                        value={
                          individual?.citizenPrimaryDocumentType ===
                          "NATIONAL_ID"
                            ? "—"
                            : fmtDate(
                                individual?.nationalIdExpiry as
                                  | string
                                  | undefined,
                              )
                        }
                      />
                      <DetailRow
                        label="Work permit number"
                        value={individual?.workPermitNumber as string}
                      />
                      <DetailRow
                        label="Work permit issued"
                        value={fmtDate(
                          individual?.workPermitIssue as string | undefined,
                        )}
                      />
                      <DetailRow
                        label="Work permit expires"
                        value={fmtDate(
                          individual?.workPermitExpiry as string | undefined,
                        )}
                      />
                    </dl>
                  </SectionCard>

                  <SectionCard
                    title="Address, contact & employment"
                    description="Where we can reach you and your occupation"
                  >
                    <dl>
                      {(() => {
                        const rows = residenceDetailRows(
                          individual as
                            | Record<string, unknown>
                            | null
                            | undefined,
                        );
                        if (rows.length === 0) {
                          return (
                            <DetailRow
                              label="Residential address"
                              value="—"
                              wide
                            />
                          );
                        }
                        return rows.map((row) => (
                          <DetailRow
                            key={row.label}
                            label={row.label}
                            value={row.value}
                            wide
                          />
                        ));
                      })()}
                      <DetailRow
                        label="Country"
                        value={individual?.country as string}
                      />
                      {/* <DetailRow
                        label="Contact email"
                        value={individual?.contactEmail as string}
                      />
                      <DetailRow
                        label="Contact phone"
                        value={
                          individual?.contactPhone != null
                            ? String(individual.contactPhone)
                            : ""
                        }
                      /> */}
                      <DetailRow
                        label="Occupation"
                        value={individual?.occupation as string}
                      />
                      <DetailRow
                        label="Employer"
                        value={individual?.employerName as string}
                      />
                    </dl>
                  </SectionCard>
                </>
              )}
            </div>
          )}

          {tab === "documents" && (
            <div className="space-y-6">
              <SectionCard
                title="Uploaded documents"
                description="Files submitted for identity verification"
                action={
                  <Link
                    href="/onboarding/profile?step=documents"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700"
                  >
                    Manage uploads
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                }
              >
                {documents.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">
                    No documents uploaded yet. Complete verification to add
                    files.
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-5 px-5">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                          <th className="pb-2 pr-4">Type</th>
                          <th className="pb-2 pr-4">File</th>
                          <th className="pb-2 pr-4">Status</th>
                          <th className="pb-2">Uploaded</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {documents.map((doc) => (
                          <tr key={String(doc.id)} className="align-top">
                            <td className="py-3 pr-4 text-slate-900">
                              {documentTypeLabel(String(doc.documentType))}
                            </td>
                            <td className="py-3 pr-4">
                              {doc.fileUrl ? (
                                <a
                                  href={String(doc.fileUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-teal-600 hover:text-teal-700 font-medium inline-flex items-center gap-1"
                                >
                                  {String(doc.fileName ?? "View")}
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                String(doc.fileName ?? "—")
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              <DocStatusBadge status={String(doc.status)} />
                            </td>
                            <td className="py-3 text-slate-600">
                              {fmtDate(doc.uploadedAt as string | undefined)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {tab === "security" && (
            <ChangePasswordPanel
              hasPassword={me?.hasPassword ?? false}
              onSuccess={() => load()}
            />
          )}
        </>
      )}
    </div>
  );
}

function JsonOrEmpty({ value }: { value: unknown }) {
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return <p className="text-sm text-slate-500 py-2">Not provided</p>;
  }
  return (
    <pre className="text-xs bg-slate-50 border border-slate-100 rounded-lg p-4 overflow-x-auto text-slate-800 max-h-80">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ChangePasswordPanel({
  hasPassword,
  onSuccess,
}: {
  hasPassword: boolean;
  onSuccess: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState({ c: false, p: false, n: false });
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);
  const rows = getPasswordRequirementRows(password);
  const strongOk = meetsStrongPassword(password);
  const matchOk = password.length > 0 && password === confirm;
  const canSubmit =
    hasPassword && currentPassword && strongOk && matchOk && !loading;

  const barW =
    strength === "strong" ? "100%" : strength === "medium" ? "66%" : "33%";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDone("");
    if (!canSubmit) return;
    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword: password,
      });
      setDone("Password updated successfully.");
      setCurrentPassword("");
      setPassword("");
      setConfirm("");
      onSuccess();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? "Could not update password.");
    } finally {
      setLoading(false);
    }
  };

  if (!hasPassword) {
    return (
      <SectionCard
        title="Password"
        description="Sign-in password for your email or phone"
      >
        <p className="text-sm text-slate-600 py-2">
          This account does not have a password yet (for example if you only use
          Google sign-in). Complete email and phone verification and set a
          password from the registration flow, or continue using your provider.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Change password"
      description="Use a strong password you do not use elsewhere"
    >
      <form onSubmit={submit} className="space-y-5 max-w-lg">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">
            Current password
          </label>
          <div className="relative">
            <input
              type={show.c ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="border border-slate-200 rounded-lg px-3 pr-14 h-11 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, c: !s.c }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500"
            >
              {show.c ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">
            New password
          </label>
          <div className="relative">
            <input
              type={show.p ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="border border-slate-200 rounded-lg px-3 pr-14 h-11 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, p: !s.p }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500"
            >
              {show.p ? "Hide" : "Show"}
            </button>
          </div>
          {password.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex h-2 rounded-full bg-slate-100 overflow-hidden ring-1 ring-inset ring-slate-200/60">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strengthBar(strength)}`}
                  style={{ width: barW }}
                />
              </div>
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${strengthColor(strength)}`}
              >
                {strengthLabel(strength)}
              </p>
            </div>
          )}
          <div className="mt-4 rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800 mb-3">
              Password needs at least:
            </p>
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold leading-none transition-colors ${
                      row.met
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {row.met ? "✓" : ""}
                  </span>
                  <span
                    className={`text-sm leading-snug pt-0.5 ${
                      row.met
                        ? "text-emerald-800 font-medium"
                        : "text-slate-600"
                    }`}
                  >
                    {row.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">
            Confirm new password
          </label>
          <div className="relative">
            <input
              type={show.n ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="border border-slate-200 rounded-lg px-3 pr-14 h-11 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, n: !s.n }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500"
            >
              {show.n ? "Hide" : "Show"}
            </button>
          </div>
          {confirm.length > 0 && !matchOk && (
            <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {done && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {done}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-teal-600 px-6 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </SectionCard>
  );
}
