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
import {
  ALFARDAN_BRANCHES_URL,
  isUaePayoutInPerson,
  UAE_COU_CODE,
} from "@/lib/beneficiary-delivery-channels";
import { AddBeneficiaryModal } from "@/components/beneficiaries/AddBeneficiaryModal";
import {
  PhoneCountryInput,
  isValidE164Phone,
} from "@/components/PhoneCountryInput";
import { validateE164Phone } from "@/lib/phone-validation";
import Flag from "react-world-flags";
import countriesIso from "i18n-iso-countries";
import enCountries from "i18n-iso-countries/langs/en.json";

countriesIso.registerLocale(enCountries);
import {
  legalCurrencyForCouCode,
  buildRecipientCurrencyOptions,
  dedupeCatalogCountries,
  fmtMoney,
  fmtFxRate,
  fmtFee,
  payCurrencyFlagCode,
} from "@/lib/send-money-currencies";
import { useCatalogCountries } from "@/hooks/useCatalogCountries";
import { FlexCountryFlag } from "@/components/country/FlexCountryFlag";
import { CatalogCountrySelect } from "@/components/country/CatalogCountrySelect";
import { matchFlexCountryByLabel } from "@/lib/catalog-countries";
import {
  ChevronRight,
  Check,
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
import { TransactionSummaryPanel } from "@/components/remittance/TransactionSummaryPanel";
import { FIELD_HEIGHT, fieldNativeSelectClasses } from "@/lib/field-styles";
import { NativeSelectShell } from "@/components/ui/NativeSelectShell";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { Loader } from "@/components/ui/Loader";
import { notifyApiError, notifyError } from "@/lib/notify";
import { resolveFlexExchangeRate } from "@/lib/flex-forex-rate";

interface FlexCountry {
  couCode: string;
  couName: string;
}

interface SenderContext {
  senderCountryIso2: string | null;
  senderCountryName: string | null;
  defaultPayCurrency: string;
  payCurrencies: string[];
  canUseMobilePayIn: boolean;
  /** True when sender is from South Sudan (Selcom card pay-in). */
  canUseCardPayIn: boolean;
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
  payAmountMin?: number;
  payAmountMax?: number;
}

interface TariffBounds {
  minPayAmount: number;
  maxPayAmount: number;
  currency: string;
}

interface LookupOpt {
  value: string;
  label: string;
}

interface Beneficiary {
  id: string;
  deliveryChannel: "BANK_TRANSFER" | "MOBILE_MONEY" | "PAYOUT_IN_PERSON" | "UPI";
  firstName: string;
  lastName: string;
  country?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  accountNumber?: string | null;
  swiftBic?: string | null;
  mobileMoneyProvider?: string | null;
  mobileNumber?: string | null;
  upiId?: string | null;
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

/** ISO3 fallback when catalog has no row for a receive-currency deep-link. */
const CURRENCY_TO_COU3_FALLBACK: Record<string, string> = {
  INR: "IND",
  RWF: "RWA",
  TZS: "TZA",
  AED: "ARE",
  UGX: "UGA",
  KES: "KEN",
};

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
  if (b.deliveryChannel === "UPI") {
    return b.upiId?.trim() || "UPI";
  }
  return (
    [b.mobileMoneyProvider, b.mobileNumber].filter(Boolean).join(" · ") || "—"
  );
}

function beneficiaryDeliveryLabel(
  channel: Beneficiary["deliveryChannel"],
): string {
  if (channel === "BANK_TRANSFER") return "Bank transfer";
  if (channel === "UPI") return "UPI";
  if (channel === "PAYOUT_IN_PERSON") return "Payout in person";
  return "Mobile money";
}

const STEPS = [
  "Amount & corridor",
  "Beneficiary",
  "Source & purpose",
  "Pay & Review",
  "Confirmation",
];

const SELECT_FIELD = `w-full border border-slate-200 rounded-lg px-3 ${FIELD_HEIGHT} text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${fieldNativeSelectClasses}`;

/** Images + common documents for bank payment proof (browser/OS may still filter by picker). */
const PAYMENT_PROOF_ACCEPT =
  "image/*,.pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.ppt,.pptx,.csv,.heic,.heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,application/rtf";

/** Drop lookup rows with unusable empty `value` (defense in depth for API payloads). */
function filterLookupOpts(opts: LookupOpt[]): LookupOpt[] {
  return opts.filter((o) => String(o.value ?? "").trim() !== "");
}

/** Role-based Step 3 compliance defaults (must match remittance lookup `value`s). */
function complianceDefaultsForRole(userRole?: "INDIVIDUAL" | "CORPORATE"): {
  sourceOfIncome: string;
  transferPurpose: string;
  relationship: string;
} {
  if (userRole === "CORPORATE") {
    return {
      sourceOfIncome: "BUSINESS",
      transferPurpose: "BUSINESS",
      relationship: "BUSINESS_RELATIONSHIP",
    };
  }
  return {
    sourceOfIncome: "SAVINGS",
    transferPurpose: "FAMILY_SUPPORT",
    relationship: "FAMILY",
  };
}

function lookupHasValue(opts: LookupOpt[], value: string): boolean {
  return opts.some((o) => o.value === value);
}

type PayInKind = "" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CARD";

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
    hintLines.push(
      "Choose how you pay us — bank transfer, mobile money, or card.",
    );
  }
  if (corpNeedsSupportingDoc) {
    hintLines.push(
      "Upload at least one supporting document (invoice or bill of lading). Corporate transfers require this before you continue.",
    );
  }
  if (mobilePhoneInvalidWhenRequired) {
    const phoneErr =
      opts.payerPhone.trim().length > 0
        ? validateE164Phone(opts.payerPhone)
        : "Enter your mobile number with country code (e.g. +254712345678).";
    hintLines.push(
      phoneErr ??
        "Enter your mobile number with country code (e.g. +254712345678).",
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
    accountName: "Flex Money Client Trust — KES",
    accountNumber: "8844-2910-7731-02",
    swiftBic: "ATLSUS6N",
    iban: null,
    currency: "KES",
    countryNote: "New York, USA",
    instructions:
      "Use your transfer reference in the payment narrative. Credits are applied after reconciliation.",
  },
];

function SendMoneyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const beneficiaryQueryId = searchParams.get("beneficiaryId");
  const toCountryQuery = searchParams.get("toCountry");
  const receiveCurrencyQuery = searchParams.get("receiveCurrency");
  const beneficiaryQueryProcessedRef = useRef<string | null>(null);
  const corridorQueryProcessedRef = useRef<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  const [ctx, setCtx] = useState<SenderContext | null>(null);
  const [lookups, setLookups] = useState<{
    sourceOfIncome: LookupOpt[];
    transferPurpose: LookupOpt[];
    relationship: LookupOpt[];
  } | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const {
    countries: catalogCountries,
    loading: catalogCountriesLoading,
    error: catalogCountriesError,
  } = useCatalogCountries(step === 1);

  const [payCurrency, setPayCurrency] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");
  const [amountEditSide, setAmountEditSide] = useState<"pay" | "receive">(
    "pay",
  );
  const [recipientCouCode, setRecipientCouCode] = useState("");
  const [recipientCouName, setRecipientCouName] = useState("");
  const [receiveCurrency, setReceiveCurrency] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [flexForexRate, setFlexForexRate] = useState<number | null>(null);
  const [flexForexLoading, setFlexForexLoading] = useState(false);
  const [flexForexError, setFlexForexError] = useState<string | null>(null);
  const [tariffBounds, setTariffBounds] = useState<TariffBounds | null>(null);
  const [tariffBoundsError, setTariffBoundsError] = useState<string | null>(
    null,
  );
  const [amountValidationError, setAmountValidationError] = useState<
    string | null
  >(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [transferId, setTransferId] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [transferRow, setTransferRow] = useState<TransferRow | null>(null);

  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [selectedBen, setSelectedBen] = useState<Beneficiary | null>(null);
  const [sourceOfIncome, setSourceOfIncome] = useState("");
  const [transferPurpose, setTransferPurpose] = useState("");
  const [relationship, setRelationship] = useState("");

  const [payInMethod, setPayInMethod] = useState<PayInKind>("");
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

  const beneficiaryRecipientLocked = useMemo(
    () => Boolean(beneficiaryQueryId && selectedBen?.id === beneficiaryQueryId),
    [beneficiaryQueryId, selectedBen],
  );

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

  const dedupedCatalogCountries = useMemo(
    () => dedupeCatalogCountries(catalogCountries),
    [catalogCountries],
  );

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
  const recipientCurrencyOptions = useMemo(
    () => buildRecipientCurrencyOptions(dedupedCatalogCountries),
    [dedupedCatalogCountries],
  );

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

  /** Resolve the selected recipient country from the catalog. */
  const selectedRecipientCountry = useMemo(() => {
    const raw = recipientCouName.trim();
    if (!raw) return undefined;
    return matchFlexCountryByLabel(dedupedCatalogCountries, raw);
  }, [dedupedCatalogCountries, recipientCouName]);

  /** Available payout currencies for the selected recipient country. */
  const availableCurrenciesForCountry = useMemo(() => {
    if (!selectedRecipientCountry?.couCode) return [];
    const countryDefaultCurrency = legalCurrencyForCouCode(
      selectedRecipientCountry.couCode,
    );
    const fallbackCurrencies = ["USD", "EUR", "GBP"];
    const allCurrencies = countryDefaultCurrency
      ? [countryDefaultCurrency, ...fallbackCurrencies]
      : fallbackCurrencies;
    // Deduplicate
    return Array.from(new Set(allCurrencies));
  }, [selectedRecipientCountry?.couCode]);

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
    const couCode = recipientCouCode.trim().toUpperCase();
    if (!cur) return beneficiaries;
    return beneficiaries.filter((b) => {
      const resolved = resolveRecipientFromBeneficiaryCountry(
        b.country,
        dedupedCatalogCountries,
      );
      if (!resolved) return false;
      const benCurrency = legalCurrencyForCouCode(resolved.couCode);
      const benCountryMatch = couCode
        ? resolved.couCode.toUpperCase() === couCode
        : true;
      return benCurrency === cur && benCountryMatch;
    });
  }, [
    beneficiaries,
    receiveCurrency,
    recipientCouCode,
    dedupedCatalogCountries,
  ]);

  const bankAccountsToShow = useMemo(() => {
    if (companyAccounts.length > 0) return companyAccounts;
    const cur = (payCurrency || "USD").toUpperCase();
    const match = DUMMY_PAYOUT_ACCOUNTS.filter((a) => a.currency === cur);
    return match.length > 0 ? match : DUMMY_PAYOUT_ACCOUNTS;
  }, [companyAccounts, payCurrency]);

  const showUaePayoutInPersonInfo = useMemo(() => {
    const ben = selectedBen ?? transferRow?.beneficiary ?? null;
    if (!ben || ben.deliveryChannel !== "PAYOUT_IN_PERSON") return false;
    if (isUaePayoutInPerson(recipientCouCode, ben.deliveryChannel)) return true;
    const resolved = resolveRecipientFromBeneficiaryCountry(
      ben.country,
      dedupedCatalogCountries,
    );
    return resolved?.couCode === UAE_COU_CODE;
  }, [
    selectedBen,
    transferRow?.beneficiary,
    recipientCouCode,
    dedupedCatalogCountries,
  ]);

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

  /** When recipient country changes, default "what they get" to that country's legal currency. */
  const prevRecipientCouCodeRef = useRef<string | null>(null);
  useEffect(() => {
    const code = recipientCouCode.trim().toUpperCase();
    if (!code) return;
    if (prevRecipientCouCodeRef.current === code) return;
    prevRecipientCouCodeRef.current = code;
    setReceiveCurrency(legalCurrencyForCouCode(code));
  }, [recipientCouCode]);

  useEffect(() => {
    if (step !== 3 || !ctx) return;
    setPayInMethod((prev) => {
      if (prev === "MOBILE_MONEY" && !ctx.canUseMobilePayIn) {
        return "BANK_TRANSFER";
      }
      if (prev === "CARD" && !ctx.canUseCardPayIn) {
        return "BANK_TRANSFER";
      }
      return prev || "BANK_TRANSFER";
    });
  }, [step, ctx]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
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
      setCtx({
        ...c,
        canUseCardPayIn: c.canUseCardPayIn === true,
      });
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
      notifyApiError(e, "Could not load send-money data. Try again later.");
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
    if (!ctx || !lookups) return;
    const defaults = complianceDefaultsForRole(ctx.userRole);
    setSourceOfIncome((prev) =>
      prev.trim()
        ? prev
        : lookupHasValue(lookups.sourceOfIncome, defaults.sourceOfIncome)
          ? defaults.sourceOfIncome
          : prev,
    );
    setTransferPurpose((prev) =>
      prev.trim()
        ? prev
        : lookupHasValue(lookups.transferPurpose, defaults.transferPurpose)
          ? defaults.transferPurpose
          : prev,
    );
    setRelationship((prev) =>
      prev.trim()
        ? prev
        : lookupHasValue(lookups.relationship, defaults.relationship)
          ? defaults.relationship
          : prev,
    );
  }, [ctx, lookups]);

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
      setReceiveCurrency(legalCurrencyForCouCode(resolved.couCode));
    }
    setBeneficiaryId(b.id);
    setSelectedBen(b);
  }, [loading, beneficiaryQueryId, beneficiaries, dedupedCatalogCountries]);

  /** Rate deep-link: `?toCountry=` / `?receiveCurrency=` when no beneficiaryId. */
  useEffect(() => {
    if (beneficiaryQueryId) {
      corridorQueryProcessedRef.current = null;
      return;
    }
    const toCountry = (toCountryQuery ?? "").trim().toUpperCase();
    const recvCur = (receiveCurrencyQuery ?? "").trim().toUpperCase();
    if (!toCountry && !recvCur) {
      corridorQueryProcessedRef.current = null;
      return;
    }
    if (loading || !dedupedCatalogCountries.length) return;

    const key = `${toCountry}|${recvCur}`;
    if (corridorQueryProcessedRef.current === key) return;
    corridorQueryProcessedRef.current = key;

    let couCode = "";
    let couName = "";
    let currency = recvCur;

    if (toCountry) {
      const byCode = dedupedCatalogCountries.find(
        (c) => c.couCode.toUpperCase() === toCountry,
      );
      if (byCode) {
        couCode = byCode.couCode;
        couName = byCode.couName;
      } else {
        const a2 =
          toCountry.length === 2
            ? toCountry
            : countriesIso.alpha3ToAlpha2(toCountry);
        const a3 =
          toCountry.length === 3
            ? toCountry
            : typeof a2 === "string"
              ? countriesIso.alpha2ToAlpha3(a2)
              : undefined;
        if (typeof a3 === "string") {
          const match = dedupedCatalogCountries.find(
            (c) => c.couCode.toUpperCase() === a3.toUpperCase(),
          );
          if (match) {
            couCode = match.couCode;
            couName = match.couName;
          } else {
            couCode = a3;
            couName =
              (typeof a2 === "string"
                ? countriesIso.getName(a2, "en")
                : undefined) || a3;
          }
        }
      }
      if (!currency && couCode) {
        currency = legalCurrencyForCouCode(couCode);
      }
    }

    if (currency && !couCode) {
      const opts = recipientCurrencyOptions;
      const opt =
        opts.find((o) => o.currency.toUpperCase() === currency) ?? null;
      if (opt) {
        couCode = opt.couCode;
        couName = opt.couName;
        currency = opt.currency;
      } else {
        const preferred = CURRENCY_TO_COU3_FALLBACK[currency];
        if (preferred) {
          const match = dedupedCatalogCountries.find(
            (c) => c.couCode.toUpperCase() === preferred,
          );
          if (match) {
            couCode = match.couCode;
            couName = match.couName;
          } else {
            couCode = preferred;
            couName = preferred;
          }
        }
      }
    }

    if (currency) setReceiveCurrency(currency);
    if (couCode) {
      setRecipientCouCode(couCode);
      setRecipientCouName(couName || couCode);
    }
  }, [
    loading,
    beneficiaryQueryId,
    toCountryQuery,
    receiveCurrencyQuery,
    dedupedCatalogCountries,
    recipientCurrencyOptions,
  ]);

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

    if (toCountryQuery || receiveCurrencyQuery) return;

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
    toCountryQuery,
    receiveCurrencyQuery,
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
      legalCurrencyForCouCode(resolved.couCode) !==
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

  useEffect(() => {
    if (!beneficiaryRecipientLocked) return;
    setRecipientOpen(false);
  }, [beneficiaryRecipientLocked]);

useEffect(() => {
    setQuote(null);
    setQuoteError(null);
  }, [payCurrency, receiveCurrency]);

  /** Only the amount the user is editing should retrigger quote fetches. */
  const drivingAmount = amountEditSide === "pay" ? payAmount : receiveAmount;
  const quoteRequestGenRef = useRef(0);

  const refreshQuote = useCallback(async () => {
    if (!payCurrency || !receiveCurrency) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const amt = parseFloat(drivingAmount);
    const usePaySide = amountEditSide === "pay";

    if (usePaySide) {
      if (!amt || amt <= 0) {
        setQuote(null);
        setQuoteError(null);
        return;
      }
      if (tariffBounds) {
        if (amt < tariffBounds.minPayAmount) {
          setQuote(null);
          setQuoteError(
            `Minimum send amount is ${fmtFee(tariffBounds.minPayAmount)} ${tariffBounds.currency}`,
          );
          return;
        }
        if (amt > tariffBounds.maxPayAmount) {
          setQuote(null);
          setQuoteError(
            `Maximum send amount is ${fmtFee(tariffBounds.maxPayAmount)} ${tariffBounds.currency}`,
          );
          return;
        }
      }
    } else if (!amt || amt <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const requestGen = ++quoteRequestGenRef.current;
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const { data } = await api.get<{ data: Quote }>("/remittance/quote", {
        params: usePaySide
          ? {
              fromCurrency: payCurrency,
              toCurrency: receiveCurrency,
              payAmount: amt,
            }
          : {
              fromCurrency: payCurrency,
              toCurrency: receiveCurrency,
              receiveAmount: amt,
            },
      });
      if (requestGen !== quoteRequestGenRef.current) return;

      const q = data.data;
      if (tariffBounds || q.payAmountMin != null) {
        const min = q.payAmountMin ?? tariffBounds?.minPayAmount;
        const max = q.payAmountMax ?? tariffBounds?.maxPayAmount;
        const cur = tariffBounds?.currency ?? q.fromCurrency;
        if (min != null && q.payAmount < min) {
          setQuote(null);
          setQuoteError(`Minimum send amount is ${fmtFee(min)} ${cur}`);
          return;
        }
        if (max != null && q.payAmount > max) {
          setQuote(null);
          setQuoteError(`Maximum send amount is ${fmtFee(max)} ${cur}`);
          return;
        }
      }
      setQuote(q);
      // Always sync derived side; only rewrite driving side when API rounded it.
      if (usePaySide) {
        setReceiveAmount(String(q.receiveAmount));
        if (Number(drivingAmount) !== q.payAmount) {
          setPayAmount(String(q.payAmount));
        }
      } else {
        setPayAmount(String(q.payAmount));
        if (Number(drivingAmount) !== q.receiveAmount) {
          setReceiveAmount(String(q.receiveAmount));
        }
      }
    } catch (err: unknown) {
      if (requestGen !== quoteRequestGenRef.current) return;
      setQuote(null);
      const apiMessage =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object" &&
        "message" in err.response.data &&
        typeof err.response.data.message === "string"
          ? err.response.data.message
          : null;
      const msg =
        apiMessage ??
        "No rate for this corridor yet. Try another currency pair or contact support.";
      setQuoteError(msg);
      notifyError(msg);
    } finally {
      if (requestGen === quoteRequestGenRef.current) {
        setQuoteLoading(false);
      }
    }
  }, [
    amountEditSide,
    drivingAmount,
    payCurrency,
    receiveCurrency,
    tariffBounds,
  ]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshQuote();
    }, 400);
    return () => {
      clearTimeout(t);
      // Invalidate in-flight quote so a stale response cannot overwrite newer input.
      quoteRequestGenRef.current += 1;
    };
  }, [refreshQuote]);

  /** Live Flex rate preview before quote is available. */
  const refreshFlexForexRate = useCallback(async () => {
    if (!payCurrency.trim() || !receiveCurrency.trim()) {
      setFlexForexRate(null);
      setFlexForexError(null);
      return;
    }
    setFlexForexLoading(true);
    setFlexForexError(null);
    try {
      const rate = await resolveFlexExchangeRate(payCurrency, receiveCurrency);
      setFlexForexRate(rate);
    } catch {
      setFlexForexRate(null);
      const msg =
        "Could not load exchange rate. Check your connection or try another currency pair.";
      setFlexForexError(msg);
      notifyError(msg);
    } finally {
      setFlexForexLoading(false);
    }
  }, [payCurrency, receiveCurrency]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshFlexForexRate();
    }, 300);
    return () => clearTimeout(t);
  }, [refreshFlexForexRate]);

  useEffect(() => {
    if (!payCurrency.trim() || !receiveCurrency.trim()) {
      setTariffBounds(null);
      setTariffBoundsError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ data: TariffBounds }>(
          "/remittance/tariff-bounds",
          {
            params: {
              fromCurrency: payCurrency,
              toCurrency: receiveCurrency,
            },
          },
        );
        if (!cancelled) {
          setTariffBounds(data.data);
          setTariffBoundsError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setTariffBounds(null);
          const apiMessage =
            err &&
            typeof err === "object" &&
            "response" in err &&
            err.response &&
            typeof err.response === "object" &&
            "data" in err.response &&
            err.response.data &&
            typeof err.response.data === "object" &&
            "message" in err.response.data &&
            typeof err.response.data.message === "string"
              ? err.response.data.message
              : null;
          setTariffBoundsError(
            apiMessage ??
              `Transfers from ${payCurrency} to ${receiveCurrency} are not available yet. Contact support.`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payCurrency, receiveCurrency]);

  const canonicalFxRate = quote?.rate ?? flexForexRate;

  /** Keep the non-edited side in sync from live Flex rate (quote overwrites on debounce). */
  useEffect(() => {
    if (quoteLoading || flexForexLoading || quote) return;
    const rate = canonicalFxRate;
    if (rate == null) return;

    if (amountEditSide === "pay") {
      const pay = parseFloat(payAmount);
      if (!pay || pay <= 0) {
        if (!pay) {
          setReceiveAmount((prev) => (prev === "" ? prev : ""));
        }
        return;
      }
      const derived = pay * rate;
      if (Number.isFinite(derived) && derived > 0) {
        setReceiveAmount((prev) =>
          Number(prev) === derived ? prev : String(derived),
        );
      }
      return;
    }

    const recv = parseFloat(receiveAmount);
    if (!recv || recv <= 0) {
      if (!recv) {
        setPayAmount((prev) => (prev === "" ? prev : ""));
      }
      return;
    }
    const derived = recv / rate;
    if (Number.isFinite(derived) && derived > 0) {
      setPayAmount((prev) => (Number(prev) === derived ? prev : String(derived)));
    }
  }, [
    amountEditSide,
    payAmount,
    receiveAmount,
    canonicalFxRate,
    flexForexLoading,
    quoteLoading,
    quote,
  ]);

  useEffect(() => {
    const pay = parseFloat(payAmount);
    if (!tariffBounds || !pay || pay <= 0) {
      setAmountValidationError(null);
      return;
    }
    if (pay < tariffBounds.minPayAmount) {
      setAmountValidationError(
        `Minimum send amount is ${fmtFee(tariffBounds.minPayAmount)} ${tariffBounds.currency}`,
      );
      return;
    }
    if (pay > tariffBounds.maxPayAmount) {
      setAmountValidationError(
        `Maximum send amount is ${fmtFee(tariffBounds.maxPayAmount)} ${tariffBounds.currency}`,
      );
      return;
    }
    setAmountValidationError(null);
  }, [payAmount, tariffBounds]);

  const rateDisplayForward = amountEditSide === "pay";
  const displayedFromCurrency = rateDisplayForward
    ? (quote?.fromCurrency ?? payCurrency)
    : (quote?.toCurrency ?? receiveCurrency);
  const displayedToCurrency = rateDisplayForward
    ? (quote?.toCurrency ?? receiveCurrency)
    : (quote?.fromCurrency ?? payCurrency);
  const displayedFxRate = canonicalFxRate;
  const rateDisplayLoading =
    (quoteLoading &&
      (rateDisplayForward
        ? !!parseFloat(payAmount)
        : !!parseFloat(receiveAmount))) ||
    (flexForexLoading && !quote);

  const transactionSummary = useMemo(() => {
    const recipientCountryDisplay = recipientCouName.trim()
      ? recipientIso2
        ? `${recipientIso2} ${recipientCouName.trim()}`
        : recipientCouName.trim()
      : null;

    const beneficiary = selectedBen ?? transferRow?.beneficiary ?? null;

    if (quote) {
      return {
        recipientCountryDisplay,
        beneficiary,
        youSend: Number(quote.payAmount),
        youSendCurrency: quote.fromCurrency,
        rate: quote.rate,
        rateFromCurrency: quote.fromCurrency,
        rateToCurrency: quote.toCurrency,
        fee: Number(quote.feeAmount),
        feeCurrency: quote.fromCurrency,
        receive: Number(quote.receiveAmount),
        receiveCurrency: quote.toCurrency,
      };
    }

    const tr = transferRow;
    if (tr?.payAmount != null && tr.payCurrency) {
      const youSend = Number(tr.payAmount);
      const fee =
        tr.feeAmount != null && tr.feeAmount !== "" ? Number(tr.feeAmount) : 0;
      const recv =
        tr.receiveAmount != null && tr.receiveAmount !== ""
          ? Number(tr.receiveAmount)
          : null;
      const recvCurrency = (tr.receiveCurrency ?? receiveCurrency) || "—";
      const payCur = tr.payCurrency;
      const derivedRate =
        youSend > 0 && recv != null ? recv / youSend : displayedFxRate;

      return {
        recipientCountryDisplay,
        beneficiary,
        youSend,
        youSendCurrency: payCur,
        rate: derivedRate,
        rateFromCurrency: payCur,
        rateToCurrency: recvCurrency,
        fee,
        feeCurrency: payCur,
        receive: recv,
        receiveCurrency: recvCurrency,
      };
    }

    const pay = parseFloat(payAmount);
    const recv = parseFloat(receiveAmount);
    const hasPay = pay > 0;
    const hasRecv = recv > 0;

    return {
      recipientCountryDisplay,
      beneficiary,
      youSend: hasPay ? pay : null,
      youSendCurrency: payCurrency || "—",
      rate: displayedFxRate,
      rateFromCurrency: displayedFromCurrency || "—",
      rateToCurrency: displayedToCurrency || "—",
      fee: hasPay || hasRecv ? 0 : null,
      feeCurrency: payCurrency || "—",
      receive: hasRecv ? recv : null,
      receiveCurrency: receiveCurrency || "—",
    };
  }, [
    recipientCouName,
    recipientIso2,
    selectedBen,
    transferRow,
    quote,
    payAmount,
    receiveAmount,
    payCurrency,
    receiveCurrency,
    displayedFxRate,
    displayedFromCurrency,
    displayedToCurrency,
  ]);

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
      notifyApiError(e, msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep2Next() {
    if (!transferId || !beneficiaryId) return;
    setSubmitting(true);
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
      notifyApiError(e, msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep3Next() {
    if (!transferId || !ctx) return;
    if (!sourceOfIncome || !transferPurpose || !relationship) return;
    if (!payInMethod) {
      notifyError(
        "Choose how you will pay us — bank transfer, mobile money, or card.",
      );
      return;
    }
    if (payInMethod === "MOBILE_MONEY") {
      if (!ctx.canUseMobilePayIn) {
        notifyError(
          "Mobile money pay-in is not available for your profile country.",
        );
        return;
      }
      const p = payerPhone.trim();
      if (!p) {
        notifyError(
          "Enter your mobile number with country code (e.g. +254712345678).",
        );
        return;
      }
      const phoneErr = validateE164Phone(p);
      if (phoneErr) {
        notifyError(phoneErr);
        return;
      }
    }
    if (payInMethod === "CARD") {
      if (!ctx.canUseCardPayIn) {
        notifyError("Card pay-in is not available for your profile country.");
        return;
      }
      const cur = (payCurrency || quote?.fromCurrency || "").toUpperCase();
      if (cur && cur !== "TZS" && cur !== "USD") {
        notifyError(
          "Card payment is currently available for TZS and USD only. Choose another pay-in method or currency.",
        );
        return;
      }
    }
    if (ctx.userRole === "CORPORATE") {
      const docCount = transferRow?.supportingDocuments?.length ?? 0;
      if (docCount < 1) {
        notifyError(
          "Corporate transfers require supporting documentation: upload either an invoice or a bill of lading.",
        );
        return;
      }
    }
    setSubmitting(true);
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
      notifyApiError(e, msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!transferId) return;
    if (!payReviewTermsAccepted) return;
    setSubmitting(true);
    setPostConfirmMessage("");
    try {
      const res = await api.post<{
        data: { transfer: TransferRow; paymentGatewayUrl?: string };
        message?: string;
      }>(`/remittance/transfers/${transferId}/confirm`);
      setTransferRow(res.data.data.transfer);
      setReferenceCode(res.data.data.transfer.referenceCode);
      setPostConfirmMessage(
        typeof res.data.message === "string" ? res.data.message : "",
      );

      const gatewayUrl = res.data.data.paymentGatewayUrl?.trim();
      if (
        (payInMethod === "CARD" ||
          res.data.data.transfer.payInMethod === "CARD") &&
        gatewayUrl
      ) {
        window.location.assign(gatewayUrl);
        return;
      }

      setStep(5);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed";
      notifyApiError(e, msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function addBankPaymentProofFiles(fileList: FileList | null) {
    if (!fileList?.length || !transferId) {
      if (!transferId) {
        notifyError("Missing transfer. Refresh and try again.");
        return;
      }
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
      notifyApiError(e, msg);
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
        notifyApiError(e, msg);
        return;
      }
    }
    if (row.displayUrl.startsWith("blob:")) {
      URL.revokeObjectURL(row.displayUrl);
    }
    setBankPaymentProofs((prev) =>
      prev.filter((p) => p.clientId !== row.clientId),
    );
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
    const defaults = complianceDefaultsForRole(ctx?.userRole);
    setSourceOfIncome(
      !lookups ||
        lookupHasValue(lookups.sourceOfIncome, defaults.sourceOfIncome)
        ? defaults.sourceOfIncome
        : "",
    );
    setTransferPurpose(
      !lookups ||
        lookupHasValue(lookups.transferPurpose, defaults.transferPurpose)
        ? defaults.transferPurpose
        : "",
    );
    setRelationship(
      !lookups || lookupHasValue(lookups.relationship, defaults.relationship)
        ? defaults.relationship
        : "",
    );
    setPayInMethod("");
    setPayerPhone("");
    setPostConfirmMessage("");
    setQuote(null);
    setPayAmount("");
    setReceiveAmount("");
    setAmountEditSide("pay");
    setRecipientCouCode("");
    setRecipientCouName("");
    if (ctx) setPayCurrency(ctx.defaultPayCurrency || "USD");
    setPayCurrencyOpen(false);
    setRecipientOpen(false);
    setPayCurrencySearch("");
    setRecipientSearch("");
    setShowAddBeneficiaryModal(false);
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
    const payInIsCard =
      payInMethod === "CARD" || transferRow?.payInMethod === "CARD";
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
        deliveryLabel: beneficiaryDeliveryLabel(ben.deliveryChannel),
        payoutDetails: payoutDetailsForReceipt(ben),
      },
      compliance: complianceLabels,
      payInLabel: payInIsMobile
        ? "Mobile money (STK / collection to us)"
        : payInIsCard
          ? "Debit / credit card (Selcom)"
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
    return <Loader variant="page" label="Loading send money…" />;
  }

  return (
    <div className="max-w-6xl mx-auto pb-16 relative">
      <AppLoadingOverlay show={submitting} label="Processing…" />
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
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                    active
                      ? "bg-red-600 text-white border-red-600"
                      : done
                        ? "bg-red-50 text-red-800 border-red-200"
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

      {step <= 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <div>
      {/* Step 1 — calculator layout */}
      {step === 1 && ctx && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* <p className="text-xs text-slate-500">
            Sending from your profile:{" "}
            <span className="font-medium text-slate-700">
              {ctx.senderCountryName ?? "—"}
              {ctx.senderCountryIso2 ? ` (${ctx.senderCountryIso2})` : ""}
            </span>
          </p> */}

          {
            //recipient country section
          }

          {/* Recipient Country */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              Recipient Country <span className="text-red-500">*</span>
            </label>
            <CatalogCountrySelect
              value={recipientCouName}
              disabled={beneficiaryRecipientLocked}
              onChange={(couName) => {
                if (beneficiaryRecipientLocked) return;
                setRecipientCouName(couName);
                const match = matchFlexCountryByLabel(
                  dedupedCatalogCountries,
                  couName,
                );
                if (match) {
                  setRecipientCouCode(match.couCode);
                  setReceiveCurrency(legalCurrencyForCouCode(match.couCode));
                } else {
                  setRecipientCouCode("");
                }
              }}
              error={false}
              placeholder="Select destination country…"
              countries={dedupedCatalogCountries}
              countriesLoading={catalogCountriesLoading}
              countriesError={catalogCountriesError}
            />
            {catalogCountriesError && (
              <p className="mt-1 text-xs text-red-500">
                {catalogCountriesError}
              </p>
            )}
          </div>

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
                    setAmountEditSide("pay");
                    setPayAmount(v);
                    setQuote(null);
                    setQuoteError(null);
                  }}
                  placeholder="0"
                  className="w-full bg-transparent border-0 border-b-2 border-slate-200 pb-2 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight placeholder:text-slate-300 focus:outline-none focus:border-red-600 transition-colors"
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
                  className="flex items-center gap-2 h-10 pl-2.5 pr-2 min-w-[7rem] rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-50 text-left transition-colors cursor-pointer"
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
                        className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
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
                            className={`cursor-pointer flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-left hover:bg-red-50 ${
                              payCurrency === cur
                                ? "bg-red-50 text-red-800 font-medium cursor-pointer"
                                : "text-slate-700 cursor-pointer"
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
            {(amountValidationError || quoteError) && (
              <p className="mt-1 text-xs text-red-600">
                {amountValidationError ?? quoteError}
              </p>
            )}
          </div>

          <div className="flex justify-end min-h-[2rem] items-center">
            {rateDisplayLoading ? (
              <Loader variant="inline" />
            ) : displayedFxRate != null &&
              displayedFromCurrency.trim() &&
              displayedToCurrency.trim() ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-50/90 pl-1.5 pr-2.5 py-1 border border-slate-100 shadow-sm">
                <span className="inline-flex h-7 w-7 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                  <Flag
                    code={payCurrencyFlagCode(displayedFromCurrency)}
                    className="h-full w-full object-cover"
                  />
                </span>
                <p className="text-sm text-slate-700 tabular-nums">
                  <span className="font-semibold text-slate-800">
                    1 {displayedFromCurrency}
                  </span>
                  <span className="text-slate-400 mx-1">=</span>
                  <span className="font-semibold text-slate-800">
                    {fmtFxRate(displayedFxRate)} {displayedToCurrency}
                  </span>
                </p>
                <span className="inline-flex h-7 w-7 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                  <Flag
                    code={payCurrencyFlagCode(displayedToCurrency)}
                    className="h-full w-full object-cover"
                  />
                </span>
              </div>
            ) : flexForexError ? (
              <p className="text-sm text-red-500 text-right">{flexForexError}</p>
            ) : (
              <p className="text-sm text-slate-400 text-right">
                Select send and receive currencies to see rate
              </p>
            )}
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              What they get
            </h2>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <label className="sr-only" htmlFor="receive-amount">
                  Amount recipient receives
                </label>
                <input
                  id="receive-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={receiveAmount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "");
                    setAmountEditSide("receive");
                    setReceiveAmount(v);
                    setQuote(null);
                    setQuoteError(null);
                  }}
                  placeholder="0"
                  className="w-full bg-transparent border-0 border-b-2 border-slate-200 pb-2 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight placeholder:text-slate-300 focus:outline-none focus:border-red-600 transition-colors"
                />
              </div>
              <div
                className="relative shrink-0"
                data-recipient-country-dropdown
              >
                <button
                  type="button"
                  disabled={beneficiaryRecipientLocked}
                  onClick={() => {
                    if (beneficiaryRecipientLocked) return;
                    setRecipientOpen((o) => !o);
                    setRecipientSearch("");
                    setPayCurrencyOpen(false);
                  }}
                  className={`cursor-pointer flex items-center gap-2 h-10 pl-2.5 pr-2 min-w-[7rem] rounded-lg border border-slate-200 bg-slate-50/80 text-left transition-colors ${
                    beneficiaryRecipientLocked
                      ? "opacity-70 cursor-not-allowed"
                      : "hover:bg-slate-50"
                  }`}
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
                  {!beneficiaryRecipientLocked ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
                  ) : null}
                </button>
                {recipientOpen && !beneficiaryRecipientLocked && (
                  <div className="absolute z-50 right-0 mt-1 w-[min(100vw-2rem,18rem)] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <input
                        autoFocus
                        placeholder={
                          selectedRecipientCountry
                            ? `Search currencies for ${selectedRecipientCountry.couName}…`
                            : "Search currency or country…"
                        }
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
                      />
                    </div>
                    <ul className="max-h-52 overflow-y-auto py-1">
                      {selectedRecipientCountry &&
                      availableCurrenciesForCountry.length > 0
                        ? /* Country selected: show country currency + USD, EUR, GBP */
                          availableCurrenciesForCountry
                            .filter((cur) =>
                              cur
                                .toLowerCase()
                                .includes(recipientSearch.toLowerCase()),
                            )
                            .map((cur) => (
                              <li key={cur}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReceiveCurrency(cur);
                                    setRecipientOpen(false);
                                  }}
                                  className={` 
                                    cursor-pointer flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-left hover:bg-red-50 ${
                                      receiveCurrency === cur
                                        ? "bg-red-50 text-red-800 font-medium cursor-pointer"
                                        : "text-slate-700 cursor-pointer"
                                    }`}
                                >
                                  <Flag
                                    code={payCurrencyFlagCode(cur)}
                                    className="w-6 h-4 rounded object-cover shrink-0"
                                  />
                                  <span className="font-semibold">{cur}</span>
                                  {receiveCurrency === cur && (
                                    <svg
                                      className="ml-auto w-4 h-4 shrink-0 text-red-600"
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
                            ))
                        : /* No country selected: show all available currencies */
                          filteredRecipientCurrencyOptions.map((opt) => (
                            <li key={opt.currency}>
                              <button
                                type="button"
                                onClick={() => {
                                  setReceiveCurrency(opt.currency);
                                  setRecipientCouCode(opt.couCode);
                                  setRecipientCouName(opt.couName);
                                  setRecipientOpen(false);
                                }}
                                className={`cursor-pointer  flex items-start gap-2.5 w-full px-3 py-2.5 text-sm text-left hover:bg-red-50 ${
                                  receiveCurrency === opt.currency
                                    ? "bg-red-50 text-red-800 font-medium cursor-pointer"
                                    : "text-slate-700 cursor-pointer"
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
                                    className={`text-[11px] leading-snug line-clamp-2 ${
                                      receiveCurrency === opt.currency
                                        ? "text-red-700/85"
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
                      {((selectedRecipientCountry &&
                        availableCurrenciesForCountry.filter((cur) =>
                          cur
                            .toLowerCase()
                            .includes(recipientSearch.toLowerCase()),
                        ).length === 0) ||
                        (!selectedRecipientCountry &&
                          filteredRecipientCurrencyOptions.length === 0)) && (
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

          <p
            className={`text-xs ${
              quoteError || tariffBoundsError
                ? "text-red-500"
                : "text-slate-500"
            }`}
          >
            {quoteLoading
              ? "Calculating fees…"
              : quote
                ? `Fees applicable ${fmtFee(Number(quote.feeAmount))} ${quote.fromCurrency}`
                : quoteError
                  ? quoteError
                  : tariffBoundsError
                    ? tariffBoundsError
                    : flexForexError
                      ? "Could not load fees for this corridor. Try again or contact support."
                      : "Fees will appear when a quote is available."}
          </p>

          <button
            type="button"
            disabled={
              submitting ||
              !quote ||
              !receiveCurrency ||
              !!amountValidationError ||
              (amountEditSide === "pay"
                ? !parseFloat(payAmount)
                : !parseFloat(receiveAmount))
            }
            onClick={() => void handleStep1Next()}
            className="cursor-pointer w-full h-12 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader variant="inline" className="w-4 h-4" />
            ) : null}
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
                  notifyError(
                    "Choose a receive currency before adding a beneficiary.",
                  );
                  return;
                }
                setShowAddBeneficiaryModal(true);
              }}
              className="cursor-pointer inline-flex items-center justify-center gap-2 h-10 shrink-0 px-4 rounded-lg border border-red-200 bg-red-50/70 text-red-900 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className={`cursor-pointer w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                      beneficiaryId === b.id
                        ? "border-red-600 bg-red-50 cursor-pointer"
                        : "border-slate-200 hover:border-slate-300 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div>
                        <Flag
                          code={payCurrencyFlagCode(
                            recipientDisplayCurrency || "USD",
                          )}
                          className="h-8 w-8 object-cover shrink-0 rounded-full"
                        />
                      </div>
                      <div>
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
                          ) : b.deliveryChannel === "UPI" ? (
                            <span className="font-mono">{b.upiId}</span>
                          ) : (
                            <span>
                              {b.mobileMoneyProvider} · {b.mobileNumber}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="cursor-pointer flex-1 h-10 border border-slate-200 rounded-lg text-sm"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={!beneficiaryId || submitting}
              onClick={() => void handleStep2Next()}
              className="cursor-pointer flex-1 h-10 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 "
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
              Source of income <span className="text-red-500">*</span>
            </label>
            <NativeSelectShell>
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
            </NativeSelectShell>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Purpose of transfer <span className="text-red-500">*</span>
            </label>
            <NativeSelectShell>
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
            </NativeSelectShell>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Relationship to recipient <span className="text-red-500">*</span>
            </label>
            <NativeSelectShell>
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
            </NativeSelectShell>
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
                  className={`h-10 px-4 rounded-lg text-sm border cursor-pointer ${
                    payInMethod === "BANK_TRANSFER"
                      ? "bg-red-600 text-white border-red-600 cursor-pointer"
                      : "border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                  }`}
                >
                  Bank transfer
                </button>
                {ctx.canUseMobilePayIn ? (
                  <button
                    type="button"
                    onClick={() => setPayInMethod("MOBILE_MONEY")}
                    className={`h-10 px-4 rounded-lg text-sm border cursor-pointer ${
                      payInMethod === "MOBILE_MONEY"
                        ? "bg-red-600 text-white border-red-600 cursor-pointer"
                        : "border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
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
                {ctx.canUseCardPayIn === true &&
                ctx.senderCountryIso2 === "SS" ? (
                  <button
                    type="button"
                    onClick={() => setPayInMethod("CARD")}
                    className={`h-10 px-4 rounded-lg text-sm border cursor-pointer ${
                      payInMethod === "CARD"
                        ? "bg-red-600 text-white border-red-600"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    title="Pay with debit or credit card"
                  >
                    Pay by debit/credit card
                  </button>
                ) : null}
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
              <div className="space-y-2 rounded-xl border border-red-100 bg-red-50/40 p-4">
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
                  // hint={
                  //   <>
                  //     Search and pick your country code (same as on
                  //     registration), then enter your number without the leading
                  //     zero.
                  //   </>
                  // }
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
            {payInMethod === "CARD" && (
              <p className="text-xs text-slate-500 leading-relaxed">
                After you confirm, you will be redirected to Selcom&apos;s
                secure card payment page (Visa, Mastercard, Amex). Your billing
                details come from your KYC profile address — keep it complete.
                Card pay-in supports <strong>TZS</strong> and{" "}
                <strong>USD</strong> only.
              </p>
            )}
          </div>

          {/* {!submitting && step3ContinueGate.hintLines.length > 0 && (
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
          )} */}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="cursor-pointer flex-1 h-10 border border-slate-200 rounded-lg text-sm"
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={step3ContinueGate.continueDisabled}
              onClick={() => void handleStep3Next()}
              className="flex-1 h-10 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 cursor-pointer"
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
            whether you pay by bank, mobile money, or card.
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
                <dd className="font-medium text-red-700 text-right">
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
                <dd className="font-mono text-xs font-semibold text-red-800 text-right break-all">
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
                  {beneficiaryDeliveryLabel(selectedBen.deliveryChannel)}
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
                  ) : selectedBen.deliveryChannel === "UPI" ? (
                    <span className="font-mono">{selectedBen.upiId ?? "—"}</span>
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
                    : payInMethod === "CARD"
                      ? "Debit / credit card"
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
              {payInMethod === "CARD" && (
                <p className="text-xs text-slate-500 leading-relaxed">
                  You will leave this app briefly to complete payment on
                  Selcom&apos;s secure page, then return here.
                </p>
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
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0 shrink-0"
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
              className="cursor-pointer flex-1 h-10 border border-slate-200 rounded-lg text-sm  "
              onClick={() => setStep(3)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting || !payReviewTermsAccepted}
              onClick={() => void handleConfirm()}
              className="cursor-pointer flex-1 h-10 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 "
            >
              Proceed & Confirm
            </button>
          </div>
        </div>
      )}
          </div>
          <aside className="lg:sticky lg:top-6 self-start">
            <TransactionSummaryPanel
              {...transactionSummary}
              loading={quoteLoading}
            />
          </aside>
        </div>
      )}

      {/* Done — final step */}
      {step === 5 && (
        <div className="w-full max-w-4xl  bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
          <div className="w-full flex flex-col items-center text-center space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-50 flex items-center justify-center">
                <Check
                  className="w-5 h-5 sm:w-6 sm:h-6 text-red-600"
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
              <div className="w-full max-w-md rounded-xl border border-red-100 bg-gradient-to-b from-red-50/80 to-slate-50/60 p-3 sm:p-4 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-800/80">
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
                    <div className="flex justify-between gap-4 pt-1 border-t border-red-100/80">
                      <span className="text-slate-500">Recipient gets</span>
                      <span className="font-medium tabular-nums text-red-800">
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
                  className="font-mono text-xs sm:text-sm font-semibold text-red-800 break-all"
                  title={referenceCode ?? transferRow?.referenceCode ?? ""}
                >
                  {referenceCode ?? transferRow?.referenceCode ?? "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyReferenceCode()}
                className="shrink-0 self-center h-8 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center gap-1 mx-auto sm:ml-0 sm:mr-0 cursor-pointer"
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
                      <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-800">
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

              <div className="rounded-lg border border-dashed border-red-200/80 bg-white p-3 sm:p-4 w-full text-left">
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
                      className="h-8 w-full sm:w-auto px-3 rounded-md border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center gap-1.5 cursor-pointer"
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
                              className="h-full w-full block focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 disabled:opacity-50 cursor-pointer"
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
                              <span className="text-red-700">Uploading…</span>
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
                            className="p-1 rounded text-slate-600 hover:bg-white hover:text-red-700 transition-colors disabled:opacity-40 cursor-pointer"
                            aria-label="View file"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeBankProof(p)}
                            disabled={p.status === "uploading"}
                            className="p-1 rounded text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40 cursor-pointer"
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

          {showUaePayoutInPersonInfo ? (
            <p className="text-xs text-slate-600 leading-relaxed rounded-lg border border-red-100 bg-red-50/30 px-3 py-2 max-w-2xl mx-auto text-center">
              Please collect funds in person at any Alfardan Exchange House
              branch{" "}
              <a
                href={ALFARDAN_BRANCHES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-red-700 underline underline-offset-2 hover:text-red-800"
              >
                Alfardhan branches
              </a>
              .
            </p>
          ) : null}

          {payInMethod === "MOBILE_MONEY" ||
          transferRow?.payInMethod === "MOBILE_MONEY" ? (
            <p className="text-xs text-slate-600 leading-relaxed rounded-lg border border-red-100 bg-red-50/30 px-3 py-2 max-w-2xl mx-auto text-center">
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
              className="cursor-pointer h-9 sm:h-10 flex-1 min-w-0 sm:min-w-[8rem] border border-slate-200 bg-white text-slate-800 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed "
            >
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden />
              Receipt
            </button>
            <button
              type="button"
              // onClick={resetFlow}
              onClick={() => router.push("/transactions")}
              className="cursor-pointer h-9 sm:h-10 flex-1 min-w-0 sm:min-w-[8rem] bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
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
            className="cursor-pointer absolute top-3 right-3 sm:top-4 sm:right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
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
        lockPayoutCurrency={receiveCurrency}
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
    <Suspense fallback={<Loader variant="page" label="Loading send money…" />}>
      <SendMoneyPageContent />
    </Suspense>
  );
}
