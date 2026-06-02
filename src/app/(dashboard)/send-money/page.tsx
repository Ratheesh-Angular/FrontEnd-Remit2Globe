"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { sessionApi as api } from "@/lib/api";
import { formatBeneficiaryName } from "@/lib/beneficiaryDisplay";
import { AddBeneficiaryModal } from "@/components/beneficiaries/AddBeneficiaryModal";
import {
  PhoneCountryInput,
  isValidE164Phone,
} from "@/components/PhoneCountryInput";
import Flag from "react-world-flags";
import countriesIso from "i18n-iso-countries";
import enCountries from "i18n-iso-countries/langs/en.json";

countriesIso.registerLocale(enCountries);
import {
  ALPHA2_TO_CURRENCY,
  COU_CODE_TO_CURRENCY,
  CURRENCY_TO_FLAG_ALPHA2,
  PREFERRED_COU_CODE_FOR_RECEIVE_CURRENCY,
} from "@/lib/send-money-currencies";
import { useCatalogCountries } from "@/hooks/useCatalogCountries";
import { FlexCountryFlag } from "@/components/country/FlexCountryFlag";
import {
  ChevronRight,
  Check,
  Loader2,
  ChevronDown,
  UserPlus,
  Download,
  Upload,
  Eye,
  X,
  FileText,
  Copy,
} from "lucide-react";
import { downloadTransferReceiptPdf } from "@/lib/transfer-receipt-pdf";
import { CorporateSupportingDocumentsSection } from "@/components/remittance/CorporateSupportingDocumentsSection";

interface FlexCountry {
  couCode: string;
  couName: string;
}

/** One row per receive currency; maps back to a Flex corridor country for quotes & beneficiaries. */
interface RecipientReceiveOption {
  currency: string;
  couCode: string;
  couName: string;
}

interface SenderContext {
  senderCountryIso2: string | null;
  senderCountryName: string | null;
  defaultPayCurrency: string;
  payCurrencies: string[];
  canUseMobilePayIn: boolean;
  /** Comma-separated country names where mobile pay-in (e.g. M-Pesa) is supported */
  mobilePayInMarketsLabel: string;
  /** E.164 saved at registration — used to prefill payer mobile */
  registeredPhone?: string | null;
  userRole?: "INDIVIDUAL" | "CORPORATE";
}

interface Quote {
  fromCurrency: string;
  toCurrency: string;
  payAmount: number;
  rate: number;
  feeAmount: number;
  receiveAmount: number;
  quoteExpiresAt: string;
  indicative: boolean;
}

interface LookupOpt {
  value: string;
  label: string;
}

interface Beneficiary {
  id: string;
  deliveryChannel: "BANK_TRANSFER" | "MOBILE_MONEY";
  firstName: string;
  lastName: string;
  country?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  accountNumber?: string | null;
  swiftBic?: string | null;
  mobileMoneyProvider?: string | null;
  mobileNumber?: string | null;
}

interface CompanyAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  swiftBic?: string | null;
  iban?: string | null;
  currency: string;
  countryNote?: string | null;
  instructions?: string | null;
}

interface PaymentProof {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

interface TransferSupportingDocumentRow {
  id: string;
  docType: "INVOICE" | "BILL_OF_LADING";
  fileName: string;
  fileUrl: string;
}

interface TransferRow {
  id: string;
  referenceCode: string;
  status: string;
  payCurrency?: string | null;
  payAmount?: unknown;
  feeAmount?: unknown;
  receiveCurrency?: string | null;
  receiveAmount?: unknown;
  recipientCountryLabel?: string | null;
  payInMethod?: string | null;
  payerPhone?: string | null;
  beneficiary?: Beneficiary | null;
  paymentProofs?: PaymentProof[];
  supportingDocuments?: TransferSupportingDocumentRow[];
}

function alpha2FromCouCode(couCode: string): string | undefined {
  const u = couCode?.trim().toUpperCase();
  if (!u) return undefined;
  return countriesIso.alpha3ToAlpha2(u) || undefined;
}

function receiveCurrencyForCouCode(couCode: string): string {
  const a3 = couCode?.trim().toUpperCase();
  if (a3 && COU_CODE_TO_CURRENCY[a3]) return COU_CODE_TO_CURRENCY[a3];
  const a2 = alpha2FromCouCode(couCode);
  if (a2 && ALPHA2_TO_CURRENCY[a2]) return ALPHA2_TO_CURRENCY[a2];
  return "USD";
}

/** Map beneficiary `country` (country name) to catalog row for currency + filters. */
function resolveRecipientFromBeneficiaryCountry(
  countryLabel: string | null | undefined,
  countries: FlexCountry[],
): { couCode: string; couName: string } | null {
  const raw = (countryLabel ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  let fc = countries.find((c) => c.couName.trim().toLowerCase() === lower);
  if (!fc) {
    fc = countries.find(
      (c) =>
        c.couName.toLowerCase().includes(lower) ||
        lower.includes(c.couName.toLowerCase()),
    );
  }
  if (fc) return { couCode: fc.couCode, couName: fc.couName };

  try {
    const a2 = countriesIso.getAlpha2Code(raw, "en");
    if (typeof a2 === "string" && a2.length === 2) {
      const a3 = countriesIso.alpha2ToAlpha3(a2);
      if (a3) {
        const byAlpha3 = countries.find(
          (c) => c.couCode.toUpperCase() === a3.toUpperCase(),
        );
        if (byAlpha3)
          return { couCode: byAlpha3.couCode, couName: byAlpha3.couName };
        return { couCode: a3, couName: raw };
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

function maskAccount(n?: string | null) {
  if (!n || n.length < 4) return "····";
  return `····${n.slice(-4)}`;
}

function payoutDetailsForReceipt(b: Beneficiary): string {
  if (b.deliveryChannel === "BANK_TRANSFER") {
    return [
      b.bankName,
      b.branchName,
      b.accountNumber ? `Account ${maskAccount(b.accountNumber)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return (
    [b.mobileMoneyProvider, b.mobileNumber].filter(Boolean).join(" · ") || "—"
  );
}

function payCurrencyFlagCode(currency: string): string {
  return CURRENCY_TO_FLAG_ALPHA2[currency.toUpperCase()] ?? "US";
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const STEPS = [
  "Amount & corridor",
  "Beneficiary",
  "Source & purpose",
  "Pay & Review",
  "Confirmation",
];

const SELECT_FIELD =
  "w-full border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors";

/** Images + common documents for bank payment proof (browser/OS may still filter by picker). */
const PAYMENT_PROOF_ACCEPT =
  "image/*,.pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.ppt,.pptx,.csv,.heic,.heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,application/rtf";

/** Drop lookup rows with unusable empty `value` (defense in depth for API payloads). */
function filterLookupOpts(opts: LookupOpt[]): LookupOpt[] {
  return opts.filter((o) => String(o.value ?? "").trim() !== "");
}

type PayInKind = "" | "BANK_TRANSFER" | "MOBILE_MONEY";

/** Mirrors Step 3 Continue `disabled` rules and user-facing blocker copy. */
function evaluateStep3ContinueGate(opts: {
  submitting: boolean;
  sourceOfIncome: string;
  transferPurpose: string;
  relationship: string;
  payInMethod: PayInKind;
  userRole?: "INDIVIDUAL" | "CORPORATE";
  supportingDocumentsCount: number;
  payerPhone: string;
}): { continueDisabled: boolean; hintLines: string[] } {
  const hintLines: string[] = [];

  const noSource = !opts.sourceOfIncome.trim();
  const noPurpose = !opts.transferPurpose.trim();
  const noRelationship = !opts.relationship.trim();
  const noPayMethod = !opts.payInMethod;
  const corpNeedsSupportingDoc =
    opts.userRole === "CORPORATE" && opts.supportingDocumentsCount < 1;
  const mobilePhoneInvalidWhenRequired =
    opts.payInMethod === "MOBILE_MONEY" && !isValidE164Phone(opts.payerPhone);

  if (noSource) hintLines.push("Select source of income.");
  if (noPurpose) hintLines.push("Select purpose of transfer.");
  if (noRelationship) hintLines.push("Select relationship to recipient.");
  if (noPayMethod) {
    hintLines.push("Choose how you pay us — bank transfer or mobile money.");
  }
  if (corpNeedsSupportingDoc) {
    hintLines.push(
      "Upload at least one supporting document (invoice or bill of lading). Corporate transfers require this before you continue.",
    );
  }
  if (mobilePhoneInvalidWhenRequired) {
    hintLines.push(
      opts.payerPhone.trim().length > 0
        ? "Enter a valid mobile number for the selected country (check length and digits)."
        : "Enter your mobile number with country code (e.g. +254712345678).",
    );
  }

  const continueDisabled =
    opts.submitting ||
    noSource ||
    noPurpose ||
    noRelationship ||
    noPayMethod ||
    corpNeedsSupportingDoc ||
    mobilePhoneInvalidWhenRequired;

  return { continueDisabled, hintLines };
}

type BankProofRow = {
  clientId: string;
  remoteId?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  displayUrl: string;
  status: "uploading" | "saved" | "error";
  errorMessage?: string;
};

function isImageMime(mime: string) {
  return mime.startsWith("image/");
}

/** Themed sample accounts when API list is empty (dev). */
const DUMMY_PAYOUT_ACCOUNTS: CompanyAccount[] = [
  {
    id: "dev-1",
    bankName: "Atlas Clearing Bank",
    accountName: "Remit2Globe Client Trust — USD",
    accountNumber: "8844-2910-7731-02",
    swiftBic: "ATLSUS6N",
    iban: null,
    currency: "USD",
    countryNote: "New York, USA",
    instructions:
      "Use your transfer reference in the payment narrative. Credits are applied after reconciliation.",
  },
];

function SendMoneyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const beneficiaryQueryId = searchParams.get("beneficiaryId");
  const beneficiaryQueryProcessedRef = useRef<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [ctx, setCtx] = useState<SenderContext | null>(null);
  const [lookups, setLookups] = useState<{
    sourceOfIncome: LookupOpt[];
    transferPurpose: LookupOpt[];
    relationship: LookupOpt[];
  } | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const { countries: catalogCountries } = useCatalogCountries(true);

  const [payCurrency, setPayCurrency] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [recipientCouCode, setRecipientCouCode] = useState("");
  const [recipientCouName, setRecipientCouName] = useState("");
  const [receiveCurrency, setReceiveCurrency] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [transferId, setTransferId] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [transferRow, setTransferRow] = useState<TransferRow | null>(null);

  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [selectedBen, setSelectedBen] = useState<Beneficiary | null>(null);
  const [sourceOfIncome, setSourceOfIncome] = useState("");
  const [transferPurpose, setTransferPurpose] = useState("");
  const [relationship, setRelationship] = useState("");

  const [payInMethod, setPayInMethod] = useState<
    "BANK_TRANSFER" | "MOBILE_MONEY" | ""
  >("");
  const [payerPhone, setPayerPhone] = useState("");
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccount[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [postConfirmMessage, setPostConfirmMessage] = useState("");

  const [payCurrencyOpen, setPayCurrencyOpen] = useState(false);
  const [payCurrencySearch, setPayCurrencySearch] = useState("");
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");

  const [showAddBeneficiaryModal, setShowAddBeneficiaryModal] = useState(false);
  const [payReviewTermsAccepted, setPayReviewTermsAccepted] = useState(false);

  const bankProofInputRef = useRef<HTMLInputElement>(null);
  const bankProofsRef = useRef<BankProofRow[]>([]);
  const proofHydratedForTransferRef = useRef<string | null>(null);
  const [bankPaymentProofs, setBankPaymentProofs] = useState<BankProofRow[]>(
    [],
  );
  const [proofLightboxUrl, setProofLightboxUrl] = useState<string | null>(null);
  const [referenceCopied, setReferenceCopied] = useState(false);

  bankProofsRef.current = bankPaymentProofs;

  useEffect(() => {
    return () => {
      bankProofsRef.current.forEach((p) => {
        if (p.displayUrl.startsWith("blob:")) {
          URL.revokeObjectURL(p.displayUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (step === 4) setPayReviewTermsAccepted(false);
  }, [step]);

  useEffect(() => {
    if (step !== 5 || !transferId) return;
    if (proofHydratedForTransferRef.current === transferId) return;
    proofHydratedForTransferRef.current = transferId;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ data: { transfer: TransferRow } }>(
          `/remittance/transfers/${transferId}`,
        );
        if (cancelled) return;
        const t = data.data.transfer;
        setTransferRow(t);
        const proofs = t.paymentProofs ?? [];
        if (proofs.length > 0) {
          setBankPaymentProofs((prev) => {
            if (prev.some((p) => p.status === "uploading")) return prev;
            return proofs.map((p) => ({
              clientId: p.id,
              remoteId: p.id,
              fileName: p.fileName,
              mimeType: p.mimeType,
              fileSize: p.fileSize,
              displayUrl: p.fileUrl,
              status: "saved" as const,
            }));
          });
        }
      } catch {
        proofHydratedForTransferRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, transferId]);

  const addBeneficiaryLock = useMemo(() => {
    const name = recipientCouName.trim();
    if (!name) return null;
    return {
      couName: recipientCouName.trim(),
      couCode: recipientCouCode.trim() || undefined,
    };
  }, [recipientCouName, recipientCouCode]);

  const dedupedCatalogCountries = useMemo(() => {
    const byCode = new Map<string, FlexCountry>();
    for (const c of catalogCountries) {
      if (!byCode.has(c.couCode)) byCode.set(c.couCode, c);
    }
    return [...byCode.values()];
  }, [catalogCountries]);

  const corporateSupportingDocsForUi = useMemo(() => {
    const raw = transferRow?.supportingDocuments ?? [];
    return raw.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      docType:
        String(d.docType).toUpperCase() === "BILL_OF_LADING"
          ? ("BILL_OF_LADING" as const)
          : ("INVOICE" as const),
    }));
  }, [transferRow?.supportingDocuments]);

  const onCorporateSupportingDocUploaded = useCallback(
    (doc: {
      id: string;
      docType: "INVOICE" | "BILL_OF_LADING";
      fileName: string;
      fileUrl: string;
    }) => {
      setTransferRow((r) => {
        if (!r) return r;
        const list = r.supportingDocuments ?? [];
        const next = list.filter((d) => d.docType !== doc.docType).concat(doc);
        return { ...r, supportingDocuments: next };
      });
    },
    [],
  );

  /** Unique receive currencies from the full catalog (one representative country each). */
  const recipientCurrencyOptions = useMemo(() => {
    const byCurrency = new Map<string, RecipientReceiveOption>();
    for (const c of dedupedCatalogCountries) {
      const currency = receiveCurrencyForCouCode(c.couCode);
      const opt: RecipientReceiveOption = {
        currency,
        couCode: c.couCode,
        couName: c.couName,
      };
      const existing = byCurrency.get(currency);
      const preferred =
        PREFERRED_COU_CODE_FOR_RECEIVE_CURRENCY[currency.toUpperCase()];
      if (!existing) {
        byCurrency.set(currency, opt);
        continue;
      }
      if (preferred && c.couCode.toUpperCase() === preferred) {
        byCurrency.set(currency, opt);
      }
    }
    return [...byCurrency.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency),
    );
  }, [dedupedCatalogCountries]);

  const filteredRecipientCurrencyOptions = useMemo(() => {
    const q = recipientSearch.toLowerCase().trim();
    if (!q) return recipientCurrencyOptions;
    return recipientCurrencyOptions.filter(
      (opt) =>
        opt.currency.toLowerCase().includes(q) ||
        opt.couName.toLowerCase().includes(q),
    );
  }, [recipientCurrencyOptions, recipientSearch]);

  /** Avoid mismatched-flag flash before corridor state is applied. */
  const recipientDisplayCurrency = useMemo(
    () =>
      receiveCurrency ||
      recipientCurrencyOptions.find((o) => o.currency.toUpperCase() === "USD")
        ?.currency ||
      recipientCurrencyOptions[0]?.currency ||
      "",
    [receiveCurrency, recipientCurrencyOptions],
  );

  const filteredPayCurrencyOptions = useMemo(() => {
    if (!ctx) return [] as string[];
    const q = payCurrencySearch.toLowerCase().trim();
    const list = ctx.payCurrencies;
    if (!q) return list;
    return list.filter((cur) => cur.toLowerCase().includes(q));
  }, [ctx, payCurrencySearch]);

  const recipientIso2 = useMemo(
    () => (recipientCouCode ? alpha2FromCouCode(recipientCouCode) : undefined),
    [recipientCouCode],
  );

  const filteredBeneficiaries = useMemo(() => {
    const cur = receiveCurrency.trim().toUpperCase();
    if (!cur) return beneficiaries;
    return beneficiaries.filter((b) => {
      const resolved = resolveRecipientFromBeneficiaryCountry(
        b.country,
        dedupedCatalogCountries,
      );
      if (!resolved) return false;
      return receiveCurrencyForCouCode(resolved.couCode) === cur;
    });
  }, [beneficiaries, receiveCurrency, dedupedCatalogCountries]);

  const bankAccountsToShow = useMemo(() => {
    if (companyAccounts.length > 0) return companyAccounts;
    const cur = (payCurrency || "USD").toUpperCase();
    const match = DUMMY_PAYOUT_ACCOUNTS.filter((a) => a.currency === cur);
    return match.length > 0 ? match : DUMMY_PAYOUT_ACCOUNTS;
  }, [companyAccounts, payCurrency]);

  /** Amounts for the confirmation step (quote still in memory, or transfer from API). */
  const confirmationAmounts = useMemo(() => {
    if (quote) {
      const youSend = Number(quote.payAmount);
      const fee = Number(quote.feeAmount);
      return {
        fromCurrency: quote.fromCurrency,
        toCurrency: quote.toCurrency,
        youSend,
        fee,
        receive: Number(quote.receiveAmount),
        totalToPay: youSend + fee,
        hasRate: true as const,
        rate: quote.rate,
      };
    }
    const tr = transferRow;
    if (tr?.payAmount != null && tr.payCurrency) {
      const youSend = Number(tr.payAmount);
      const fee =
        tr.feeAmount != null && tr.feeAmount !== "" ? Number(tr.feeAmount) : 0;
      return {
        fromCurrency: tr.payCurrency,
        toCurrency: (tr.receiveCurrency ?? "—") as string,
        youSend,
        fee,
        receive:
          tr.receiveAmount != null && tr.receiveAmount !== ""
            ? Number(tr.receiveAmount)
            : null,
        totalToPay: youSend + fee,
        hasRate: false as const,
        rate: null as number | null,
      };
    }
    return null;
  }, [quote, transferRow]);

  const complianceLabels = useMemo(() => {
    if (!lookups) return null;
    return {
      source:
        lookups.sourceOfIncome.find((o) => o.value === sourceOfIncome)?.label ??
        sourceOfIncome,
      purpose:
        lookups.transferPurpose.find((o) => o.value === transferPurpose)
          ?.label ?? transferPurpose,
      relationship:
        lookups.relationship.find((o) => o.value === relationship)?.label ??
        relationship,
    };
  }, [lookups, sourceOfIncome, transferPurpose, relationship]);

  const step3ContinueGate = useMemo(
    () =>
      evaluateStep3ContinueGate({
        submitting,
        sourceOfIncome,
        transferPurpose,
        relationship,
        payInMethod,
        userRole: ctx?.userRole,
        supportingDocumentsCount: transferRow?.supportingDocuments?.length ?? 0,
        payerPhone,
      }),
    [
      submitting,
      sourceOfIncome,
      transferPurpose,
      relationship,
      payInMethod,
      ctx?.userRole,
      transferRow?.supportingDocuments?.length,
      payerPhone,
    ],
  );

  useEffect(() => {
    if (step !== 3 || !ctx) return;
    setPayInMethod((prev) => {
      if (!ctx.canUseMobilePayIn) return "BANK_TRANSFER";
      return prev || "BANK_TRANSFER";
    });
  }, [step, ctx]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ctxRes, lookRes, benRes] = await Promise.all([
        api.get<{ data: SenderContext }>("/remittance/context"),
        api.get<{
          data: {
            sourceOfIncome: LookupOpt[];
            transferPurpose: LookupOpt[];
            relationship: LookupOpt[];
          };
        }>("/remittance/lookups"),
        api.get<{ data: { beneficiaries: Beneficiary[] } }>("/beneficiaries", {
          params: { activeOnly: "true" },
        }),
      ]);
      const c = ctxRes.data.data;
      setCtx(c);
      setPayerPhone((prev) =>
        prev.trim() ? prev : (c.registeredPhone?.trim() ?? ""),
      );
      setPayCurrency(c.defaultPayCurrency || c.payCurrencies[0] || "USD");
      const d = lookRes.data.data;
      setLookups({
        sourceOfIncome: filterLookupOpts(d.sourceOfIncome),
        transferPurpose: filterLookupOpts(d.transferPurpose),
        relationship: filterLookupOpts(d.relationship),
      });
      setBeneficiaries(benRes.data.data.beneficiaries);
    } catch (e: unknown) {
      setError("Could not load send-money data. Try again later.");
      console.error(e);
    } finally {
      setLoading(false);
      setMounted(true);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!beneficiaryQueryId) {
      beneficiaryQueryProcessedRef.current = null;
      return;
    }
    if (loading || !beneficiaries.length || !dedupedCatalogCountries.length)
      return;

    const b = beneficiaries.find((x) => x.id === beneficiaryQueryId);
    if (!b) {
      if (beneficiaries.length > 0)
        beneficiaryQueryProcessedRef.current = beneficiaryQueryId;
      return;
    }

    if (beneficiaryQueryProcessedRef.current === beneficiaryQueryId) return;
    beneficiaryQueryProcessedRef.current = beneficiaryQueryId;

    const resolved = resolveRecipientFromBeneficiaryCountry(
      b.country,
      dedupedCatalogCountries,
    );
    if (resolved) {
      setRecipientCouCode(resolved.couCode);
      setRecipientCouName(resolved.couName);
      setReceiveCurrency(receiveCurrencyForCouCode(resolved.couCode));
    }
    setBeneficiaryId(b.id);
    setSelectedBen(b);
  }, [loading, beneficiaryQueryId, beneficiaries, dedupedCatalogCountries]);

  /** Default receive currency when none chosen yet. */
  useEffect(() => {
    if (loading) return;
    if (receiveCurrency) return;
    const opts = recipientCurrencyOptions;
    if (!opts.length) return;

    if (beneficiaryQueryId) {
      const ready =
        beneficiaries.length > 0 && dedupedCatalogCountries.length > 0;
      if (!ready) return;
      const b = beneficiaries.find((x) => x.id === beneficiaryQueryId);
      if (b) {
        const resolved = resolveRecipientFromBeneficiaryCountry(
          b.country,
          dedupedCatalogCountries,
        );
        if (resolved) return;
      }
    }

    const usd = opts.find((o) => o.currency.toUpperCase() === "USD");
    const pick = usd ?? opts[0];
    setReceiveCurrency(pick.currency);
    setRecipientCouCode(pick.couCode);
    setRecipientCouName(pick.couName);
  }, [
    loading,
    receiveCurrency,
    recipientCurrencyOptions,
    beneficiaryQueryId,
    beneficiaries,
    dedupedCatalogCountries,
  ]);

  /** Changing receive currency clears a beneficiary that no longer matches. */
  useEffect(() => {
    if (!selectedBen || !receiveCurrency.trim()) return;
    const resolved = resolveRecipientFromBeneficiaryCountry(
      selectedBen.country,
      dedupedCatalogCountries,
    );
    if (
      resolved &&
      receiveCurrencyForCouCode(resolved.couCode) !==
      receiveCurrency.trim().toUpperCase()
    ) {
      setSelectedBen(null);
      setBeneficiaryId("");
    }
  }, [receiveCurrency, selectedBen, dedupedCatalogCountries]);

  useEffect(() => {
    if (!payCurrencyOpen && !recipientOpen) return;
    const close = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest("[data-pay-currency-dropdown]"))
        setPayCurrencyOpen(false);
      if (!el.closest("[data-recipient-country-dropdown]"))
        setRecipientOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [payCurrencyOpen, recipientOpen]);

  const refreshQuote = useCallback(async () => {
    const amt = parseFloat(payAmount);
    if (!payCurrency || !receiveCurrency || !amt || amt <= 0) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    try {
      const { data } = await api.get<{ data: Quote }>("/remittance/quote", {
        params: {
          fromCurrency: payCurrency,
          toCurrency: receiveCurrency,
          payAmount: amt,
        },
      });
      setQuote(data.data);
      setError("");
    } catch {
      setQuote(null);
      setError(
        "No rate for this corridor yet. Try another currency pair or contact support.",
      );
    } finally {
      setQuoteLoading(false);
    }
  }, [payAmount, payCurrency, receiveCurrency]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshQuote();
    }, 400);
    return () => clearTimeout(t);
  }, [refreshQuote]);

  useEffect(() => {
    if (payInMethod !== "BANK_TRANSFER" || !payCurrency) return;
    if (step < 3 || step > STEPS.length) return;
    (async () => {
      try {
        const { data } = await api.get<{
          data: { accounts: CompanyAccount[] };
        }>("/remittance/company-accounts", {
          params: { currency: payCurrency },
        });
        setCompanyAccounts(data.data.accounts);
      } catch {
        setCompanyAccounts([]);
      }
    })();
  }, [step, payInMethod, payCurrency]);

  async function handleStep1Next() {
    if (!quote || !ctx) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post<{ data: { transfer: TransferRow } }>(
        "/remittance/transfers",
        {
          senderCountryIso2: ctx.senderCountryIso2,
          payCurrency: quote.fromCurrency,
          payAmount: quote.payAmount,
          recipientCountryLabel: recipientCouName,
          recipientCountryIso2: recipientIso2 ?? null,
          receiveCurrency: quote.toCurrency,
          receiveAmount: quote.receiveAmount,
          fxRateSnapshot: quote.rate,
          feeAmount: quote.feeAmount,
          quoteExpiresAt: quote.quoteExpiresAt,
        },
      );
      setTransferId(data.data.transfer.id);
      setReferenceCode(data.data.transfer.referenceCode);
      setTransferRow(data.data.transfer);
      setStep(2);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to save";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep2Next() {
    if (!transferId || !beneficiaryId) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.patch<{ data: { transfer: TransferRow } }>(
        `/remittance/transfers/${transferId}`,
        { step: 2, beneficiaryId },
      );
      setTransferRow(data.data.transfer);
      setStep(3);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep3Next() {
    if (!transferId || !ctx) return;
    if (!sourceOfIncome || !transferPurpose || !relationship) return;
    if (!payInMethod) {
      setError("Choose how you will pay us — bank transfer or mobile money.");
      return;
    }
    if (payInMethod === "MOBILE_MONEY") {
      if (!ctx.canUseMobilePayIn) {
        setError(
          "Mobile money pay-in is not available for your profile country.",
        );
        return;
      }
      const p = payerPhone.trim();
      if (!p) {
        setError(
          "Enter your mobile number with country code (e.g. +254712345678).",
        );
        return;
      }
      if (!isValidE164Phone(p)) {
        setError(
          "Enter a valid mobile number for the selected country (check length and digits).",
        );
        return;
      }
    }
    if (ctx.userRole === "CORPORATE") {
      const docCount = transferRow?.supportingDocuments?.length ?? 0;
      if (docCount < 1) {
        setError(
          "Corporate transfers require supporting documentation: upload either an invoice or a bill of lading.",
        );
        return;
      }
    }
    setSubmitting(true);
    setError("");
    try {
      const { data: data3 } = await api.patch<{
        data: { transfer: TransferRow };
      }>(`/remittance/transfers/${transferId}`, {
        step: 3,
        sourceOfIncome,
        transferPurpose,
        relationshipToRecipient: relationship,
      });
      setTransferRow(data3.data.transfer);
      const { data: data4 } = await api.patch<{
        data: { transfer: TransferRow };
      }>(`/remittance/transfers/${transferId}`, {
        step: 4,
        payInMethod,
        payerPhone:
          payInMethod === "MOBILE_MONEY" ? payerPhone.trim() : undefined,
      });
      setTransferRow(data4.data.transfer);
      setStep(4);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!transferId) return;
    if (!payReviewTermsAccepted) return;
    setSubmitting(true);
    setError("");
    setPostConfirmMessage("");
    try {
      const res = await api.post<{
        data: { transfer: TransferRow };
        message?: string;
      }>(`/remittance/transfers/${transferId}/confirm`);
      setTransferRow(res.data.data.transfer);
      setReferenceCode(res.data.data.transfer.referenceCode);
      setPostConfirmMessage(
        typeof res.data.message === "string" ? res.data.message : "",
      );
      setStep(5);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function addBankPaymentProofFiles(fileList: FileList | null) {
    if (!fileList?.length || !transferId) {
      if (!transferId) setError("Missing transfer. Refresh and try again.");
      return;
    }
    const files = Array.from(fileList);
    const pendingRows: BankProofRow[] = files.map((file, i) => ({
      clientId: `pending-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      displayUrl: URL.createObjectURL(file),
      status: "uploading",
    }));
    setBankPaymentProofs((prev) => [...prev, ...pendingRows]);
    const pendingClientIds = new Set(pendingRows.map((p) => p.clientId));

    const formData = new FormData();
    for (const f of files) {
      formData.append("files", f);
    }

    try {
      const res = await api.post<{
        data: { proofs: PaymentProof[] };
      }>(`/remittance/transfers/${transferId}/payment-proof`, formData, {
        transformRequest: [
          (data, headers) => {
            if (data instanceof FormData) {
              delete headers["Content-Type"];
            }
            return data;
          },
        ],
      });
      const proofs = res.data.data.proofs;
      setBankPaymentProofs((prev) => {
        const rest = prev.filter((p) => !pendingClientIds.has(p.clientId));
        for (const p of prev) {
          if (
            pendingClientIds.has(p.clientId) &&
            p.displayUrl.startsWith("blob:")
          ) {
            URL.revokeObjectURL(p.displayUrl);
          }
        }
        const saved: BankProofRow[] = proofs.map((proof) => ({
          clientId: proof.id,
          remoteId: proof.id,
          fileName: proof.fileName,
          mimeType: proof.mimeType,
          fileSize: proof.fileSize,
          displayUrl: proof.fileUrl,
          status: "saved",
        }));
        return [...rest, ...saved];
      });
      setTransferRow((row) =>
        row
          ? { ...row, paymentProofs: [...(row.paymentProofs ?? []), ...proofs] }
          : row,
      );
      setError("");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Upload failed. Check file type and size, then retry.";
      setBankPaymentProofs((prev) =>
        prev.map((p) =>
          pendingClientIds.has(p.clientId)
            ? { ...p, status: "error" as const, errorMessage: msg }
            : p,
        ),
      );
      setError(msg);
    }
  }

  async function removeBankProof(row: BankProofRow) {
    if (row.remoteId && transferId) {
      try {
        await api.delete(
          `/remittance/transfers/${transferId}/payment-proof/${row.remoteId}`,
        );
        setTransferRow((tr) =>
          tr
            ? {
              ...tr,
              paymentProofs: (tr.paymentProofs ?? []).filter(
                (p) => p.id !== row.remoteId,
              ),
            }
            : tr,
        );
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Could not remove file";
        setError(msg);
        return;
      }
    }
    if (row.displayUrl.startsWith("blob:")) {
      URL.revokeObjectURL(row.displayUrl);
    }
    setBankPaymentProofs((prev) =>
      prev.filter((p) => p.clientId !== row.clientId),
    );
    setError("");
  }

  function viewBankProof(p: BankProofRow) {
    if (isImageMime(p.mimeType)) {
      setProofLightboxUrl(p.displayUrl);
      return;
    }
    window.open(p.displayUrl, "_blank", "noopener,noreferrer");
  }

  function resetFlow() {
    beneficiaryQueryProcessedRef.current = null;
    router.replace("/send-money", { scroll: false });
    setStep(1);
    setTransferId(null);
    setReferenceCode(null);
    setTransferRow(null);
    setSelectedBen(null);
    setBeneficiaryId("");
    setSourceOfIncome("");
    setTransferPurpose("");
    setRelationship("");
    setPayInMethod("");
    setPayerPhone("");
    setPostConfirmMessage("");
    setQuote(null);
    setPayAmount("");
    setRecipientCouCode("");
    setRecipientCouName("");
    if (ctx) setPayCurrency(ctx.defaultPayCurrency || "USD");
    setPayCurrencyOpen(false);
    setRecipientOpen(false);
    setPayCurrencySearch("");
    setRecipientSearch("");
    setShowAddBeneficiaryModal(false);
    setError("");
    proofHydratedForTransferRef.current = null;
    setBankPaymentProofs((prev) => {
      prev.forEach((p) => {
        if (p.displayUrl.startsWith("blob:")) {
          URL.revokeObjectURL(p.displayUrl);
        }
      });
      return [];
    });
    setProofLightboxUrl(null);
    setReferenceCopied(false);
  }

  async function copyReferenceCode() {
    const ref = referenceCode ?? transferRow?.referenceCode;
    if (!ref) return;
    try {
      await navigator.clipboard.writeText(ref);
      setReferenceCopied(true);
      window.setTimeout(() => setReferenceCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function handleDownloadTransferReceipt() {
    const ben = selectedBen ?? transferRow?.beneficiary ?? null;
    if (!ben) return;
    const ref = (referenceCode ?? transferRow?.referenceCode ?? "").trim();
    if (!ref) return;
    const payInIsMobile =
      payInMethod === "MOBILE_MONEY" ||
      transferRow?.payInMethod === "MOBILE_MONEY";
    const payInIsBankTransfer =
      payInMethod === "BANK_TRANSFER" ||
      transferRow?.payInMethod === "BANK_TRANSFER";
    const amt = confirmationAmounts;
    downloadTransferReceiptPdf({
      referenceCode: ref,
      status: (transferRow?.status ?? "PENDING_PAYMENT").toString(),
      generatedAt: new Date(),
      amounts: amt
        ? {
          fromCurrency: amt.fromCurrency,
          toCurrency: amt.toCurrency,
          youSend: amt.youSend,
          fee: amt.fee,
          totalToPay: amt.totalToPay,
          receive: amt.receive,
          hasRate: amt.hasRate,
          rate: amt.hasRate && amt.rate != null ? amt.rate : null,
        }
        : null,
      recipientCountry: recipientCouName,
      beneficiary: {
        displayName: formatBeneficiaryName(ben),
        deliveryLabel:
          ben.deliveryChannel === "BANK_TRANSFER"
            ? "Bank transfer"
            : "Mobile money",
        payoutDetails: payoutDetailsForReceipt(ben),
      },
      compliance: complianceLabels,
      payInLabel: payInIsMobile
        ? "Mobile money (STK / collection to us)"
        : "Bank transfer to our company account",
      payerPhone: payInIsMobile
        ? payerPhone.trim() || transferRow?.payerPhone || null
        : null,
      bankAccounts: payInIsBankTransfer
        ? bankAccountsToShow.map((a) => ({
          bankName: a.bankName,
          accountName: a.accountName,
          accountNumber: a.accountNumber,
          swiftBic: a.swiftBic,
          iban: a.iban,
          currency: a.currency,
          countryNote: a.countryNote,
          instructions: a.instructions,
        }))
        : undefined,
      additionalNote: postConfirmMessage?.trim() || undefined,
    });
  }

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900">Send money</h1>
        <p className="text-sm text-slate-500 mt-1">
          Guided transfer rates are indicative until payment is confirmed.
        </p>
      </div>

      {step <= STEPS.length && (
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex items-center shrink-0">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${active
                      ? "bg-teal-600 text-white border-teal-600"
                      : done
                        ? "bg-teal-50 text-teal-800 border-teal-200"
                        : "bg-white text-slate-500 border-slate-200"
                    }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : <span>{n}</span>}
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {n < STEPS.length && (
                  <ChevronRight className="w-4 h-4 text-slate-300 mx-0.5" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Step 1 — calculator layout */}
      {step === 1 && ctx && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <p className="text-xs text-slate-500">
            Sending from your profile:{" "}
            <span className="font-medium text-slate-700">
              {ctx.senderCountryName ?? "—"}
              {ctx.senderCountryIso2 ? ` (${ctx.senderCountryIso2})` : ""}
            </span>
          </p>

          {
            //recipient country section
          }

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              What you pay
            </h2>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <label className="sr-only" htmlFor="pay-amount">
                  Amount you pay
                </label>
                <input
                  id="pay-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={payAmount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "");
                    setPayAmount(v);
                  }}
                  placeholder="0"
                  className="w-full bg-transparent border-0 border-b-2 border-slate-200 pb-2 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight placeholder:text-slate-300 focus:outline-none focus:border-teal-600 transition-colors"
                />
              </div>
              <div className="relative shrink-0" data-pay-currency-dropdown>
                <button
                  type="button"
                  onClick={() => {
                    setPayCurrencyOpen((o) => !o);
                    setPayCurrencySearch("");
                    setRecipientOpen(false);
                  }}
                  className="flex items-center gap-2 h-11 sm:h-12 pl-2.5 pr-2 min-w-[7rem] rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-50 text-left transition-colors"
                >
                  <span className="inline-flex h-8 w-8 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                    <Flag
                      code={payCurrencyFlagCode(payCurrency || "USD")}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {payCurrency || "—"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
                </button>
                {payCurrencyOpen && (
                  <div className="absolute z-50 right-0 mt-1 w-[min(100vw-2rem,16rem)] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <input
                        autoFocus
                        placeholder="Search currency…"
                        value={payCurrencySearch}
                        onChange={(e) => setPayCurrencySearch(e.target.value)}
                        className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                      />
                    </div>
                    <ul className="max-h-52 overflow-y-auto py-1">
                      {filteredPayCurrencyOptions.map((cur) => (
                        <li key={cur}>
                          <button
                            type="button"
                            onClick={() => {
                              setPayCurrency(cur);
                              setPayCurrencyOpen(false);
                            }}
                            className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-left hover:bg-teal-50 ${payCurrency === cur
                                ? "bg-teal-50 text-teal-800 font-medium"
                                : "text-slate-700"
                              }`}
                          >
                            <Flag
                              code={payCurrencyFlagCode(cur)}
                              className="w-6 h-4 rounded object-cover"
                            />
                            <span className="font-semibold">{cur}</span>
                          </button>
                        </li>
                      ))}
                      {filteredPayCurrencyOptions.length === 0 && (
                        <li className="px-3 py-3 text-sm text-slate-400 text-center">
                          No match
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end min-h-[2rem] items-center">
            {quoteLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            ) : quote ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-50/90 pl-1.5 pr-2.5 py-1 border border-slate-100 shadow-sm">
                <span className="inline-flex h-7 w-7 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                  <Flag
                    code={payCurrencyFlagCode(quote.fromCurrency)}
                    className="h-full w-full object-cover"
                  />
                </span>
                <p className="text-sm text-slate-700 tabular-nums">
                  <span className="font-semibold text-slate-800">
                    1 {quote.fromCurrency}
                  </span>
                  <span className="text-slate-400 mx-1">=</span>
                  <span className="font-semibold text-slate-800">
                    {fmtMoney(quote.rate)} {quote.toCurrency}
                  </span>
                </p>
                <span className="inline-flex h-7 w-7 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                  <Flag
                    code={payCurrencyFlagCode(quote.toCurrency)}
                    className="h-full w-full object-cover"
                  />
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-right">
                Enter amount and recipient to see rate
              </p>
            )}
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              What they get
            </h2>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
              <div className="flex-1 min-w-0 border-b-2 border-slate-200 pb-2">
                <span className="sr-only">Recipient receives</span>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums tracking-tight min-h-[2.5rem]">
                  {quote ? fmtMoney(Number(quote.receiveAmount)) : "—"}
                </p>
              </div>
              <div
                className="relative shrink-0"
                data-recipient-country-dropdown
              >
                <button
                  type="button"
                  onClick={() => {
                    setRecipientOpen((o) => !o);
                    setRecipientSearch("");
                    setPayCurrencyOpen(false);
                  }}
                  className="flex items-center gap-2 h-11 sm:h-12 pl-2.5 pr-2 min-w-[7rem] rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-50 text-left transition-colors"
                >
                  <span className="inline-flex h-8 w-8 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                    <Flag
                      code={payCurrencyFlagCode(
                        recipientDisplayCurrency || "USD",
                      )}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {recipientDisplayCurrency || "—"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
                </button>
                {recipientOpen && (
                  <div className="absolute z-50 right-0 mt-1 w-[min(100vw-2rem,18rem)] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <input
                        autoFocus
                        placeholder="Search currency or country…"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                      />
                    </div>
                    <ul className="max-h-52 overflow-y-auto py-1">
                      {filteredRecipientCurrencyOptions.map((opt) => (
                        <li key={opt.currency}>
                          <button
                            type="button"
                            onClick={() => {
                              setReceiveCurrency(opt.currency);
                              setRecipientCouCode(opt.couCode);
                              setRecipientCouName(opt.couName);
                              setRecipientOpen(false);
                            }}
                            className={`flex items-start gap-2.5 w-full px-3 py-2.5 text-sm text-left hover:bg-teal-50 ${receiveCurrency === opt.currency
                                ? "bg-teal-50 text-teal-800 font-medium"
                                : "text-slate-700"
                              }`}
                          >
                            <Flag
                              code={payCurrencyFlagCode(opt.currency)}
                              className="w-6 h-4 rounded object-cover shrink-0 mt-0.5"
                            />
                            <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                              <span className="font-semibold leading-tight text-[13px] sm:text-sm">
                                {opt.currency}
                              </span>
                              <span
                                className={`text-[11px] leading-snug line-clamp-2 ${receiveCurrency === opt.currency
                                    ? "text-teal-700/85"
                                    : "text-slate-500"
                                  }`}
                                title={opt.couName}
                              >
                                {opt.couName}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                      {filteredRecipientCurrencyOptions.length === 0 && (
                        <li className="px-3 py-3 text-sm text-slate-400 text-center">
                          No match
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 ">
            {quote
              ? `Fees applicable ${fmtMoney(Number(quote.feeAmount))} ${quote.fromCurrency}`
              : "Fees will appear when a quote is available."}
          </p>

          <button
            type="button"
            disabled={
              submitting || !quote || !receiveCurrency || !parseFloat(payAmount)
            }
            onClick={() => void handleStep1Next()}
            className="w-full h-12 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Send money
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm text-slate-600 sm:pt-0.5">
              Choose a beneficiary receiving{" "}
              <strong>{receiveCurrency || "this currency"}</strong>.
            </p>
            <button
              type="button"
              disabled={!receiveCurrency.trim()}
              title={
                receiveCurrency.trim()
                  ? undefined
                  : "Choose a receive currency first"
              }
              onClick={() => {
                if (!receiveCurrency.trim()) {
                  setError(
                    "Choose a receive currency before adding a beneficiary.",
                  );
                  return;
                }
                setError("");
                setShowAddBeneficiaryModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 h-10 shrink-0 px-4 rounded-lg border border-teal-200 bg-teal-50/70 text-teal-900 text-sm font-medium hover:bg-teal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              Add new beneficiary
            </button>
          </div>
          {filteredBeneficiaries.length === 0 ? (
            <p className="text-sm text-amber-800 bg-amber-50/90 border border-amber-100 rounded-lg p-3">
              No saved beneficiaries match this country yet. Use{" "}
              <span className="font-semibold">Add new beneficiary</span> to add
              one in the form that opens here; you stay on Send money and the
              new recipient appears in this list when it is saved.
            </p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {filteredBeneficiaries.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setBeneficiaryId(b.id);
                      setSelectedBen(b);
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${beneficiaryId === b.id
                        ? "border-teal-600 bg-teal-50"
                        : "border-slate-200 hover:border-slate-300"
                      }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {formatBeneficiaryName(b)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      {b.country && (
                        <>
                          <span className="inline-flex items-center gap-1">
                            {(() => {
                              const fc = dedupedCatalogCountries.find(
                                (x) =>
                                  x.couName.trim().toLowerCase() ===
                                  (b.country ?? "").trim().toLowerCase(),
                              );
                              return fc ? (
                                <FlexCountryFlag couCode={fc.couCode} />
                              ) : null;
                            })()}
                            {b.country}
                          </span>
                          <span>·</span>
                        </>
                      )}
                      {b.deliveryChannel === "BANK_TRANSFER" ? (
                        <span>
                          {b.bankName} · {b.accountNumber}
                        </span>
                      ) : (
                        <span>
                          {b.mobileMoneyProvider} · {b.mobileNumber}
                        </span>
                      )}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="flex-1 h-10 border border-slate-200 rounded-lg text-sm"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={!beneficiaryId || submitting}
              onClick={() => void handleStep2Next()}
              className="flex-1 h-10 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && lookups && ctx && (
        <div className="space-y-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Source of income
            </label>
            <select
              value={sourceOfIncome}
              onChange={(e) => setSourceOfIncome(e.target.value)}
              className={SELECT_FIELD}
            >
              <option value="">Source of income</option>
              {lookups.sourceOfIncome.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Purpose of transfer
            </label>
            <select
              value={transferPurpose}
              onChange={(e) => setTransferPurpose(e.target.value)}
              className={SELECT_FIELD}
            >
              <option value="">Purpose of transfer</option>
              {lookups.transferPurpose.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Relationship to recipient
            </label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className={SELECT_FIELD}
            >
              <option value="">Relationship to recipient</option>
              {lookups.relationship.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                How you pay us <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                Choose how you send funds <strong>to us</strong>. This is
                separate from how your beneficiary receives the payout.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPayInMethod("BANK_TRANSFER")}
                  className={`h-10 px-4 rounded-lg text-sm border ${payInMethod === "BANK_TRANSFER"
                      ? "bg-teal-600 text-white border-teal-600"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                >
                  Bank transfer
                </button>
                {ctx.canUseMobilePayIn ? (
                  <button
                    type="button"
                    onClick={() => setPayInMethod("MOBILE_MONEY")}
                    className={`h-10 px-4 rounded-lg text-sm border ${payInMethod === "MOBILE_MONEY"
                        ? "bg-teal-600 text-white border-teal-600"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                  >
                    Mobile money
                  </button>
                ) : (
                  <div className="flex-1 min-w-[12rem] rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">
                      Mobile money pay-in
                    </span>{" "}
                    is only available when your profile country is in a
                    supported market (e.g.{" "}
                    {ctx.mobilePayInMarketsLabel || "Kenya, Tanzania, Uganda"}
                    ). Your profile:{" "}
                    <span className="font-medium text-slate-800">
                      {ctx.senderCountryName ?? "—"}
                      {ctx.senderCountryIso2
                        ? ` (${ctx.senderCountryIso2})`
                        : ""}
                    </span>
                    . Everyone can use <strong>Bank transfer</strong>.
                  </div>
                )}
              </div>
            </div>

            {ctx.userRole === "CORPORATE" && (
              <CorporateSupportingDocumentsSection
                transferId={transferId}
                documents={corporateSupportingDocsForUi}
                disabled={submitting}
                onDocumentUploaded={onCorporateSupportingDocUploaded}
              />
            )}
            {ctx.userRole === "CORPORATE" &&
              (transferRow?.supportingDocuments?.length ?? 0) < 1 && (
                <p className="text-xs text-amber-800 bg-amber-50/90 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                  <strong>Corporate transfers:</strong> upload at least one
                  supporting document (invoice or bill of lading) before you can
                  continue.
                </p>
              )}

            {payInMethod === "MOBILE_MONEY" && ctx.canUseMobilePayIn && (
              <div className="space-y-2 rounded-xl border border-teal-100 bg-teal-50/40 p-4">
                <label
                  className="text-sm font-medium text-slate-800 block mb-1"
                  htmlFor="payer-phone-send-money"
                >
                  Your mobile number
                </label>
                <PhoneCountryInput
                  key={`payer-phone-${transferId ?? "new"}-${payInMethod}`}
                  id="payer-phone-send-money"
                  value={payerPhone}
                  onChange={setPayerPhone}
                  disabled={submitting}
                  defaultIso2={ctx.senderCountryIso2}
                  error={
                    payerPhone.trim().length > 0 &&
                      !isValidE164Phone(payerPhone)
                      ? "Enter a valid mobile number for the selected country (check length and digits)."
                      : undefined
                  }
                  hint={
                    <>
                      Search and pick your country code (same as on
                      registration), then enter your number without the leading
                      zero.
                    </>
                  }
                />
              </div>
            )}

            {payInMethod === "BANK_TRANSFER" && (
              <p className="text-xs text-slate-500 leading-relaxed">
                After you confirm this transfer on the next step, we will show
                our company bank details so you can pay from your banking app.
                Use your <strong>transfer reference</strong> in the payment
                description.
              </p>
            )}
          </div>

          {!submitting && step3ContinueGate.hintLines.length > 0 && (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-950"
            >
              <p className="text-xs font-medium text-amber-900 mb-1">
                To continue:
              </p>
              <ul className="text-xs text-amber-900/90 list-disc pl-4 space-y-0.5">
                {step3ContinueGate.hintLines.map((line, i) => (
                  <li key={`${i}:${line}`}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="flex-1 h-10 border border-slate-200 rounded-lg text-sm"
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={step3ContinueGate.continueDisabled}
              onClick={() => void handleStep3Next()}
              className="flex-1 h-10 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Review */}
      {step === 4 && quote && selectedBen && (
        <div className="space-y-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-sm">
          <h2 className="font-semibold text-slate-900">Summary</h2>
          <p className="text-xs text-slate-500">
            Review everything below. After you proceed, payment steps depend on
            whether you pay by bank or mobile money.
          </p>

          <dl className="space-y-3 divide-y divide-slate-100">
            <div className="pt-1 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Amounts
              </p>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">You pay</dt>
                <dd className="font-medium text-right">
                  {fmtMoney(Number(quote.payAmount))} {quote.fromCurrency}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Recipient gets</dt>
                <dd className="font-medium text-teal-700 text-right">
                  {fmtMoney(Number(quote.receiveAmount))} {quote.toCurrency}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Fees</dt>
                <dd className="text-right">
                  {fmtMoney(Number(quote.feeAmount))} {quote.fromCurrency}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Rate</dt>
                <dd className="text-right tabular-nums">
                  1 {quote.fromCurrency} = {fmtMoney(quote.rate)}{" "}
                  {quote.toCurrency}
                </dd>
              </div>
              <div className="flex justify-between gap-4 pt-1 border-t border-slate-100">
                <dt className="text-slate-700 shrink-0 font-medium py-2">
                  Total amount
                </dt>
                <dd className="font-semibold text-right tabular-nums text-slate-900 py-2">
                  {fmtMoney(Number(quote.payAmount) + Number(quote.feeAmount))}{" "}
                  {quote.fromCurrency}
                </dd>
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Corridor and reference
              </p>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Paying to (country)</dt>
                <dd className="font-medium text-right">{recipientCouName}</dd>
              </div>
              <div className="flex justify-between gap-4 pb-2">
                <dt className="text-slate-500 shrink-0">Transfer reference</dt>
                <dd className="font-mono text-xs font-semibold text-teal-800 text-right break-all">
                  {referenceCode ?? transferRow?.referenceCode ?? "—"}
                </dd>
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Recipient (payout)
              </p>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Beneficiary</dt>
                <dd className="font-medium text-right">
                  {formatBeneficiaryName(selectedBen)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Delivery channel</dt>
                <dd className="text-right">
                  {selectedBen.deliveryChannel === "BANK_TRANSFER"
                    ? "Bank transfer"
                    : "Mobile money"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 items-start">
                <dt className="text-slate-500 shrink-0">Payout account</dt>
                <dd className="text-right max-w-[65%] text-slate-800">
                  {selectedBen.deliveryChannel === "BANK_TRANSFER" ? (
                    <>
                      {selectedBen.bankName}
                      {selectedBen.branchName ? (
                        <span className="block text-xs text-slate-500 mt-0.5">
                          {selectedBen.branchName}
                        </span>
                      ) : null}
                      <span className="block text-xs text-slate-500 mt-0.5 font-mono">
                        {selectedBen.accountNumber
                          ? selectedBen.accountNumber
                          : "—"}
                      </span>
                    </>
                  ) : (
                    <>
                      {selectedBen.mobileMoneyProvider ?? "—"}
                      <span className="block text-xs text-slate-500 mt-0.5 font-mono">
                        {selectedBen.mobileNumber ?? "—"}
                      </span>
                    </>
                  )}
                </dd>
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                How you pay us
              </p>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Paying from</dt>
                <dd className="font-medium text-right">
                  {payInMethod === "MOBILE_MONEY"
                    ? "Mobile money"
                    : "Bank transfer"}
                </dd>
              </div>
              {payInMethod === "MOBILE_MONEY" && (
                <div className="flex justify-between gap-4 items-start">
                  <dt className="text-slate-500 shrink-0">Your phone</dt>
                  <dd className="font-mono text-xs text-right break-all">
                    {payerPhone.trim()}
                  </dd>
                </div>
              )}
              {payInMethod === "BANK_TRANSFER" && (
                <p className="text-xs text-slate-500 leading-relaxed">
                  After you proceed, our company bank details appear on the
                  final screen. Include your transfer reference in the payment
                  narrative.
                </p>
              )}
            </div>
          </dl>
          <div className="pt-4 border-t border-slate-100">
            <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:ring-offset-0 shrink-0"
                checked={payReviewTermsAccepted}
                onChange={(e) => setPayReviewTermsAccepted(e.target.checked)}
                aria-required="true"
              />
              <span className="leading-relaxed">
                I accept the terms and conditions
                <span className="text-red-500" aria-hidden>
                  {" "}
                  *
                </span>
              </span>
            </label>
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              className="flex-1 h-10 border border-slate-200 rounded-lg text-sm"
              onClick={() => setStep(3)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting || !payReviewTermsAccepted}
              onClick={() => void handleConfirm()}
              className="flex-1 h-10 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Proceed & Confirm
            </button>
          </div>
        </div>
      )}

      {/* Done — final step */}
      {step === 5 && (
        <div className="w-full max-w-4xl  bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
          <div className="w-full flex flex-col items-center text-center space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-50 flex items-center justify-center">
                <Check
                  className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600"
                  aria-hidden
                />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                  Transfer submitted
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Status:{" "}
                  <span className="font-medium text-slate-700">
                    PENDING_PAYMENT
                  </span>
                </p>
              </div>
            </div>

            {confirmationAmounts ? (
              <div className="w-full max-w-md rounded-xl border border-teal-100 bg-gradient-to-b from-teal-50/80 to-slate-50/60 p-3 sm:p-4 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-800/80">
                  Total to pay
                </p>
                <p className="mt-1 text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 tracking-tight">
                  {fmtMoney(confirmationAmounts.totalToPay)}{" "}
                  <span className="text-lg sm:text-xl font-semibold text-slate-800">
                    {confirmationAmounts.fromCurrency}
                  </span>
                </p>
                <div className="mt-3 space-y-1 text-xs text-slate-600 max-w-xs mx-auto text-left">
                  <div className="flex justify-between gap-4">
                    <span>Send amount</span>
                    <span className="tabular-nums text-slate-800">
                      {fmtMoney(confirmationAmounts.youSend)}{" "}
                      {confirmationAmounts.fromCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Fee</span>
                    <span className="tabular-nums text-slate-800">
                      {fmtMoney(confirmationAmounts.fee)}{" "}
                      {confirmationAmounts.fromCurrency}
                    </span>
                  </div>
                  {confirmationAmounts.receive != null ? (
                    <div className="flex justify-between gap-4 pt-1 border-t border-teal-100/80">
                      <span className="text-slate-500">Recipient gets</span>
                      <span className="font-medium tabular-nums text-teal-800">
                        {fmtMoney(confirmationAmounts.receive)}{" "}
                        {confirmationAmounts.toCurrency}
                      </span>
                    </div>
                  ) : null}
                  {confirmationAmounts.hasRate &&
                    confirmationAmounts.rate != null ? (
                    <p className="pt-1 text-[11px] text-slate-500 tabular-nums text-center">
                      1 {confirmationAmounts.fromCurrency} ={" "}
                      {fmtMoney(confirmationAmounts.rate)}{" "}
                      {confirmationAmounts.toCurrency}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="w-full max-w-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-center sm:text-left">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-500">
                  Transfer reference (use in payment)
                </p>
                <p
                  className="font-mono text-xs sm:text-sm font-semibold text-teal-800 break-all"
                  title={referenceCode ?? transferRow?.referenceCode ?? ""}
                >
                  {referenceCode ?? transferRow?.referenceCode ?? "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyReferenceCode()}
                className="shrink-0 self-center h-8 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center gap-1 mx-auto sm:ml-0 sm:mr-0"
              >
                {referenceCopied ? (
                  "Copied"
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-xs sm:text-sm font-medium text-center text-slate-800 mb-0 pb-2">
            Pay to our account
          </p>

          {postConfirmMessage ? (
            <p className="text-sm text-slate-700 text-center leading-relaxed max-w-lg mx-auto px-2">
              {postConfirmMessage}
            </p>
          ) : null}

          {(payInMethod === "BANK_TRANSFER" ||
            transferRow?.payInMethod === "BANK_TRANSFER") && (
              <div className="w-full max-w-3xl mx-auto space-y-3 text-center">
                <ul className="space-y-2 w-full text-left">
                  {bankAccountsToShow.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-lg border border-slate-200 bg-white p-2.5 sm:p-3 text-xs shadow-sm"
                    >
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <span className="font-semibold text-slate-900 leading-tight">
                          {a.bankName}
                        </span>
                        <span className="shrink-0 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-800">
                          {a.currency}
                        </span>
                      </div>
                      {a.countryNote ? (
                        <p className="text-[11px] text-slate-500 mb-1.5 line-clamp-1">
                          {a.countryNote}
                        </p>
                      ) : null}
                      <dl className="space-y-1 text-slate-700">
                        <div className="flex flex-wrap gap-x-1 gap-y-0">
                          <dt className="text-slate-400 shrink-0">Name</dt>
                          <dd className="font-medium text-slate-800 min-w-0">
                            {a.accountName}
                          </dd>
                        </div>
                        <div className="flex flex-wrap gap-x-1 gap-y-0 items-baseline">
                          <dt className="text-slate-400 shrink-0">Account</dt>
                          <dd className="font-mono font-semibold text-slate-900 break-all">
                            {a.accountNumber}
                          </dd>
                        </div>
                        {(a.swiftBic || a.iban) && (
                          <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-2 gap-y-0.5">
                            {a.swiftBic ? (
                              <span>
                                SWIFT{" "}
                                <span className="font-mono">{a.swiftBic}</span>
                              </span>
                            ) : null}
                            {a.iban ? (
                              <span>
                                IBAN{" "}
                                <span className="font-mono break-all">
                                  {a.iban}
                                </span>
                              </span>
                            ) : null}
                          </div>
                        )}
                        {a.instructions ? (
                          <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 line-clamp-2">
                            {a.instructions}
                          </p>
                        ) : null}
                      </dl>
                    </li>
                  ))}
                </ul>

                <div className="rounded-lg border border-dashed border-teal-200/80 bg-white p-3 sm:p-4 w-full text-left">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
                    <p className="text-xs text-slate-600 text-center sm:text-left flex-1 min-w-0">
                      <span className="font-medium text-slate-800">
                        Payment proof
                      </span>{" "}
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        Receipts or screenshots help us match your payment faster.
                      </span>
                    </p>
                    <div className="shrink-0 flex justify-center sm:justify-end">
                      <input
                        ref={bankProofInputRef}
                        type="file"
                        className="sr-only"
                        accept={PAYMENT_PROOF_ACCEPT}
                        multiple
                        onChange={(e) => {
                          void addBankPaymentProofFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => bankProofInputRef.current?.click()}
                        className="h-8 w-full sm:w-auto px-3 rounded-md border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        Upload
                      </button>
                    </div>
                  </div>
                  {bankPaymentProofs.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {bankPaymentProofs.map((p) => (
                        <li
                          key={p.clientId}
                          className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50/80 p-1.5"
                        >
                          <div className="h-8 w-8 shrink-0 rounded overflow-hidden bg-slate-200 flex items-center justify-center">
                            {isImageMime(p.mimeType) && p.status !== "error" ? (
                              <button
                                type="button"
                                onClick={() => viewBankProof(p)}
                                disabled={p.status === "uploading"}
                                className="h-full w-full block focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 disabled:opacity-50"
                                aria-label={`View ${p.fileName}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={p.displayUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ) : (
                              <FileText
                                className="w-4 h-4 text-slate-500"
                                aria-hidden
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-[11px] font-medium text-slate-800 truncate"
                              title={p.fileName}
                            >
                              {p.fileName}
                            </p>
                            <p className="text-[10px] text-slate-500 tabular-nums">
                              {p.status === "uploading" ? (
                                <span className="text-teal-700">Uploading…</span>
                              ) : p.status === "error" ? (
                                <span className="text-red-600">
                                  {p.errorMessage ?? "Upload failed"}
                                </span>
                              ) : p.fileSize >= 1024 * 1024 ? (
                                `${(p.fileSize / (1024 * 1024)).toFixed(1)} MB`
                              ) : (
                                `${(p.fileSize / 1024).toFixed(1)} KB`
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => viewBankProof(p)}
                              disabled={
                                p.status === "uploading" || p.status === "error"
                              }
                              className="p-1 rounded text-slate-600 hover:bg-white hover:text-teal-700 transition-colors disabled:opacity-40"
                              aria-label="View file"
                              title="View"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeBankProof(p)}
                              disabled={p.status === "uploading"}
                              className="p-1 rounded text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                              aria-label="Remove file"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            )}

          {payInMethod === "MOBILE_MONEY" ||
            transferRow?.payInMethod === "MOBILE_MONEY" ? (
            <p className="text-xs text-slate-600 leading-relaxed rounded-lg border border-teal-100 bg-teal-50/30 px-3 py-2 max-w-2xl mx-auto text-center">
              <span className="font-medium text-slate-800">Mobile money: </span>
              Approve the collection on{" "}
              <span className="font-mono text-[11px]">
                {payerPhone.trim() || transferRow?.payerPhone || "—"}
              </span>
              . We move to processing once funds are confirmed, then pay out to
              your beneficiary.
            </p>
          ) : null}

          {!(
            payInMethod === "MOBILE_MONEY" ||
            transferRow?.payInMethod === "MOBILE_MONEY"
          ) && (
              <p className="text-xs text-slate-600 leading-relaxed rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 max-w-2xl mx-auto text-center">
                Once the funds are credited to our account, the transfer will be
                automatically processed to your beneficiary account. The transfer
                status will be updated on the transaction history page
              </p>
            )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center items-stretch w-full max-w-md mx-auto">
            <button
              type="button"
              onClick={handleDownloadTransferReceipt}
              disabled={!selectedBen && !transferRow?.beneficiary}
              className="h-9 sm:h-10 flex-1 min-w-0 sm:min-w-[8rem] border border-slate-200 bg-white text-slate-800 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden />
              Receipt
            </button>
            <button
              type="button"
              // onClick={resetFlow}
              onClick={() => router.push("/transactions")}
              className="h-9 sm:h-10 flex-1 min-w-0 sm:min-w-[8rem] bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
            >
              View Transactions
            </button>
          </div>
        </div>
      )}

      {proofLightboxUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Payment proof preview"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 sm:p-6"
          onClick={() => setProofLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            onClick={() => setProofLightboxUrl(null)}
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proofLightboxUrl}
            alt="Payment proof"
            className="max-h-[min(90vh,900px)] max-w-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      <AddBeneficiaryModal
        open={showAddBeneficiaryModal}
        onClose={() => setShowAddBeneficiaryModal(false)}
        lockCountry={addBeneficiaryLock}
        onSuccess={async (created) => {
          try {
            const benRes = await api.get<{
              data: { beneficiaries: Beneficiary[] };
            }>("/beneficiaries", { params: { activeOnly: "true" } });
            const list = benRes.data.data.beneficiaries;
            setBeneficiaries(list);
            const row = list.find((x) => x.id === created.id);
            if (row) {
              setBeneficiaryId(row.id);
              setSelectedBen(row);
            }
          } catch {
            /* ignore */
          }
        }}
      />
    </div>
  );
}

export default function SendMoneyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
      }
    >
      <SendMoneyPageContent />
    </Suspense>
  );
}
