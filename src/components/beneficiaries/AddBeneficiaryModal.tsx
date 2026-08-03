"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { sessionApi as api } from "@/lib/api";
import {
  normalizeAba,
  normalizeIfsc,
  normalizeIban,
  normalizeSortCode,
  normalizeBsb,
  expectedIbanLength,
  validateIban,
  IBAN_LENGTH_BY_COUNTRY,
  resolveBankIdentifierConfig,
  validateBankField,
  type BankField,
  type BankFieldKey,
} from "@/lib/beneficiary-bank-identifier";
import { Loader } from "@/components/ui/Loader";
import { notifyApiError } from "@/lib/notify";
import { NativeSelectShell } from "@/components/ui/NativeSelectShell";
import { fieldNativeSelectClasses } from "@/lib/field-styles";
import { FlexCountryFlag } from "@/components/country/FlexCountryFlag";
import { CatalogCountrySelect } from "@/components/country/CatalogCountrySelect";
import { useCatalogCountries } from "@/hooks/useCatalogCountries";
import { phoneCountryFromCouCode } from "@/lib/flex-country-phone";
import {
  nationalPhonePlaceholder,
  validateNationalPhoneDigits,
} from "@/lib/phone-validation";
import { useFlexCountries } from "@/hooks/useFlexCountries";
import countriesIso from "i18n-iso-countries";
import {
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { flexApiUrl } from "@/lib/flex-api";
import {
  buildMsisdnPayload,
  fetchFlexAccountVerify,
  fetchFlexMsisdnVerify,
  resolveAccountVerifyBankCode,
} from "@/lib/flex-verify";
import { validateUpiId, upiHandleFromId } from "@/lib/upi-validation";
import { validateUaeMobileNationalDigits } from "@/lib/uae-mobile-validation";
import { useAuthStore } from "@/store/auth.store";
import { matchFlexCountryByLabel } from "@/lib/catalog-countries";
import mobileMoneyProvidersData from "@/data/mobile-money-providers.json";
import {
  legalCurrencyForCouCode,
  CURRENCY_TO_FLAG_ALPHA2,
} from "@/lib/send-money-currencies";
import {
  beneficiaryNameLabelSuffix,
  getDeliveryChannelLabel,
  getDeliveryChannels,
  getDeliveryChannelsFromFlexServices,
  inferUaePayoutRecipientType,
  isUaePayoutInPerson,
  MOBILE_WALLET_ONLY_COUNTRY_CODES,
  FLEX_BANK_MEANS_PAYOUT_IN_PERSON_COUNTRY_CODES,
  PAYOUT_IN_PERSON_EMIRATES_ID_COUNTRY_CODE,
  payoutInPersonCollectionNotice,
  payoutInPersonIdFieldLabel,
  type BeneficiaryDeliveryChannel,
  type UaePayoutRecipientType,
} from "@/lib/beneficiary-delivery-channels";
import {
  emiratesIdFormatHint,
  sanitizeEmiratesId,
  validateEmiratesId,
} from "@/lib/emirates-id-validation";
import {
  isAllBanksCountry,
  isFlexBankServiceTypeAllowed,
  requiresActualBankNameInput,
} from "@/lib/beneficiary-flex-banks";
import Flag from "react-world-flags";

interface FlexBank {
  serviceType?: string;
  bankCode: string;
  bankName: string;
}

function alpha2FromCouCode(couCode: string): string | undefined {
  const u = couCode?.trim().toUpperCase();
  if (!u) return undefined;
  return countriesIso.alpha3ToAlpha2(u) || undefined;
}

function dialCodeFromCouCode(couCode: string): string | undefined {
  const a2 = alpha2FromCouCode(couCode);
  if (!a2) return undefined;
  try {
    return getCountryCallingCode(a2 as CountryCode);
  } catch {
    return undefined;
  }
}

function payCurrencyFlagCode(currency: string): string {
  return CURRENCY_TO_FLAG_ALPHA2[currency.toUpperCase()] ?? "US";
}

type VerifyHintState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; name: string }
  | { status: "error"; message: string };

function VerifyNameHint({ state }: { state: VerifyHintState }) {
  if (state.status === "idle") return null;
  if (state.status === "loading") {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        Looking up registered name…
      </div>
    );
  }
  if (state.status === "success") {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Registered as <span className="font-semibold">{state.name}</span>
        </span>
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {state.message}
    </div>
  );
}

export interface CreatedBeneficiaryPayload {
  id: string;
  firstName: string;
  lastName: string;
  deliveryChannel: BeneficiaryDeliveryChannel;
  country?: string | null;
  bankName?: string | null;
  flexBankName?: string | null;
  flexBankCode?: string | null;
  branchName?: string | null;
  accountNumber?: string | null;
  swiftBic?: string | null;
  iban?: string | null;
  sortCode?: string | null;
  routingNumber?: string | null;
  transitNumber?: string | null;
  bsb?: string | null;
  ifsc?: string | null;
  mobileMoneyProvider?: string | null;
  mobileNumber?: string | null;
  upiId?: string | null;
  payoutInPersonIdNumber?: string | null;
  payoutCurrency?: string | null;
  active?: boolean;
}

export type LockCountry = {
  couName: string;
  couCode?: string;
};

export type AddBeneficiaryModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called after a successful create, before `onClose`. May return a Promise. */
  onSuccess?: (beneficiary: CreatedBeneficiaryPayload) => void | Promise<void>;
  /** When set, destination country is fixed to this corridor (Flex list match). */
  lockCountry?: LockCountry | null;
  /** When set, payout currency is fixed to this value. */
  lockPayoutCurrency?: string | null;
  /** When set, modal loads this beneficiary and PATCHes on save instead of creating. */
  editBeneficiaryId?: string | null;
  /** If set, API errors are reported to the parent (e.g. toast) instead of locally. */
  onSubmitError?: (message: string) => void;
};

interface FormData {
  deliveryChannel: BeneficiaryDeliveryChannel;
  firstName: string;
  lastName: string;
  // Bank Transfer
  country: string;
  bankName: string;
  flexBankName: string;
  flexBankCode: string;
  branchName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  swiftBic: string;
  iban: string;
  confirmIban: string;
  sortCode: string;
  routingNumber: string;
  transitNumber: string;
  bsb: string;
  ifsc: string;
  payoutCurrency: string;
  // Mobile Money
  mobileMoneyProvider: string;
  mobileNumber: string;
  // India UPI
  upiId: string;
  // Payout in person
  payoutInPersonIdNumber: string;
  uaePayoutRecipientType: UaePayoutRecipientType | "";
}

const emptyForm: FormData = {
  deliveryChannel: "BANK_TRANSFER",
  firstName: "",
  lastName: "",
  country: "",
  bankName: "",
  flexBankName: "",
  flexBankCode: "",
  branchName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  swiftBic: "",
  iban: "",
  confirmIban: "",
  sortCode: "",
  routingNumber: "",
  transitNumber: "",
  bsb: "",
  ifsc: "",
  payoutCurrency: "",
  mobileMoneyProvider: "",
  mobileNumber: "",
  upiId: "",
  payoutInPersonIdNumber: "",
  uaePayoutRecipientType: "",
};

function isUaeCountryName(country: string): boolean {
  const c = country.trim().toLowerCase();
  return (
    c.includes("united arab emirates") || c === "uae" || c.includes("emirates")
  );
}

function beneficiaryRecordToForm(
  b: CreatedBeneficiaryPayload,
  options?: { destinationCouCode?: string },
): FormData {
  const acct = String(b.accountNumber ?? "");
  const channel: BeneficiaryDeliveryChannel =
    b.deliveryChannel === "MOBILE_MONEY" ||
    b.deliveryChannel === "PAYOUT_IN_PERSON" ||
    b.deliveryChannel === "UPI"
      ? b.deliveryChannel
      : "BANK_TRANSFER";
  const id = String(b.payoutInPersonIdNumber ?? "");
  const couCode = options?.destinationCouCode;
  const isUae =
    couCode === PAYOUT_IN_PERSON_EMIRATES_ID_COUNTRY_CODE ||
    isUaeCountryName(String(b.country ?? ""));
  const uaePayoutRecipientType: UaePayoutRecipientType | "" =
    channel === "PAYOUT_IN_PERSON" && isUae
      ? inferUaePayoutRecipientType(id)
      : "";
  return {
    deliveryChannel: channel,
    firstName: String(b.firstName ?? ""),
    lastName: String(b.lastName ?? ""),
    country: String(b.country ?? ""),
    bankName: String(b.bankName ?? ""),
    flexBankName: String(b.flexBankName ?? ""),
    flexBankCode: String(b.flexBankCode ?? ""),
    branchName: String(b.branchName ?? ""),
    accountNumber: acct,
    confirmAccountNumber: acct,
    swiftBic: String(b.swiftBic ?? ""),
    iban: String(b.iban ?? ""),
    confirmIban: String(b.iban ?? ""),
    sortCode: String(b.sortCode ?? ""),
    routingNumber: String(b.routingNumber ?? ""),
    transitNumber: String(b.transitNumber ?? ""),
    bsb: String(b.bsb ?? ""),
    ifsc: String(b.ifsc ?? ""),
    payoutCurrency: String(b.payoutCurrency ?? ""),
    mobileMoneyProvider: String(b.mobileMoneyProvider ?? ""),
    mobileNumber: "",
    upiId: String(b.upiId ?? ""),
    payoutInPersonIdNumber: id,
    uaePayoutRecipientType,
  };
}

function nationalMobileFromStored(mobile: string | null | undefined): string {
  const raw = String(mobile ?? "").trim();
  if (!raw) return "";
  try {
    const p = parsePhoneNumberFromString(raw);
    if (p?.nationalNumber) return String(p.nationalNumber);
  } catch {
    /* ignore */
  }
  return raw.replace(/\D/g, "");
}

export function AddBeneficiaryModal({
  open,
  onClose,
  onSuccess,
  lockCountry = null,
  lockPayoutCurrency = null,
  editBeneficiaryId = null,
  onSubmitError,
}: AddBeneficiaryModalProps) {
  const countryLocked = Boolean(
    lockCountry && (lockCountry.couName?.trim() || lockCountry.couCode?.trim()),
  );
  const currencyLocked = Boolean(
    lockPayoutCurrency && lockPayoutCurrency.trim(),
  );

  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingAccount, setIsConfirmingAccount] = useState(false);
  const [isConfirmingIban, setIsConfirmingIban] = useState(false);
  const [localMobileNumber, setLocalMobileNumber] = useState("");
  const [msisdnVerify, setMsisdnVerify] = useState<VerifyHintState>({
    status: "idle",
  });
  const [accountVerify, setAccountVerify] = useState<VerifyHintState>({
    status: "idle",
  });
  const msisdnVerifyGen = useRef(0);
  const accountVerifyGen = useRef(0);
  const userRole = useAuthStore((s) => s.user?.role ?? "INDIVIDUAL");
  const { countries: flexCountries } = useFlexCountries(open);
  const {
    countries: catalogCountryList,
    loading: catalogCountriesLoading,
    error: catalogCountriesError,
  } = useCatalogCountries(open);
  const [flexBankCatalog, setFlexBankCatalog] = useState<FlexBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [payoutCurrencyOpen, setPayoutCurrencyOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankIdLookupStatus, setBankIdLookupStatus] = useState<
    "idle" | "loading" | "ok" | "not_found" | "error"
  >("idle");
  const bankIdLookupGen = useRef(0);
  const isEditMode = Boolean(editBeneficiaryId);
  const [editLoading, setEditLoading] = useState(false);
  const [editLoadError, setEditLoadError] = useState("");

  const flexBanks = useMemo(
    () =>
      flexBankCatalog.filter((b) =>
        isFlexBankServiceTypeAllowed(b.serviceType),
      ),
    [flexBankCatalog],
  );

  const filteredFlexBanks = useMemo(() => {
    const q = bankSearch.toLowerCase().trim();
    if (!q) return flexBanks;
    return flexBanks.filter(
      (b) =>
        b.bankName.toLowerCase().includes(q) ||
        b.bankCode.toLowerCase().includes(q),
    );
  }, [flexBanks, bankSearch]);

  /** Full static catalog (+ Flex fallback) with loose label match for flags / dial code. */
  const selectedDestinationCountry = useMemo(() => {
    const raw = formData.country.trim();
    if (!raw) return undefined;
    return (
      matchFlexCountryByLabel(catalogCountryList, raw) ??
      matchFlexCountryByLabel(flexCountries, raw)
    );
  }, [catalogCountryList, flexCountries, formData.country]);

  const destinationPhoneCountry = useMemo(() => {
    const code = selectedDestinationCountry?.couCode;
    if (!code) return null;
    return phoneCountryFromCouCode(code);
  }, [selectedDestinationCountry?.couCode]);

  const destinationCouCode = useMemo(() => {
    if (selectedDestinationCountry?.couCode) {
      return selectedDestinationCountry.couCode.toUpperCase();
    }
    if (lockCountry?.couCode?.trim()) {
      return lockCountry.couCode.trim().toUpperCase();
    }
    return "";
  }, [selectedDestinationCountry?.couCode, lockCountry?.couCode]);

  const isUaePayoutInPersonChannel = useMemo(
    () => isUaePayoutInPerson(destinationCouCode, formData.deliveryChannel),
    [destinationCouCode, formData.deliveryChannel],
  );

  const isUaeDestination = useMemo(
    () =>
      destinationCouCode === PAYOUT_IN_PERSON_EMIRATES_ID_COUNTRY_CODE ||
      isUaeCountryName(formData.country),
    [destinationCouCode, formData.country],
  );

  /** ISO alpha-2 for destination — used as IBAN length hint before prefix is typed. */
  const ibanHintAlpha2 = useMemo(() => {
    if (!destinationCouCode) return undefined;
    return countriesIso.alpha3ToAlpha2(destinationCouCode) || undefined;
  }, [destinationCouCode]);

  const bankIdConfig = useMemo(
    () =>
      resolveBankIdentifierConfig(
        formData.payoutCurrency,
        selectedDestinationCountry?.couCode,
        userRole,
      ),
    [formData.payoutCurrency, selectedDestinationCountry?.couCode, userRole],
  );

  /** When false (e.g. production without Flex IP allowlisting), bank name is a plain text field. */
  const useFlexBankListUi = useMemo(() => {
    const flexBankListFromApiEnabled =
      process.env.NEXT_PUBLIC_ENABLE_FLEX_BANK_LIST !== "false";
    return !bankIdConfig.hideFlexBankPicker && flexBankListFromApiEnabled;
  }, [bankIdConfig.hideFlexBankPicker]);

  const availableDeliveryChannels = useMemo(() => {
    if (!destinationCouCode) return [];
    if (!useFlexBankListUi) {
      return getDeliveryChannels(destinationCouCode);
    }
    if (banksLoading) {
      if (MOBILE_WALLET_ONLY_COUNTRY_CODES.has(destinationCouCode)) {
        return ["MOBILE_MONEY"] as BeneficiaryDeliveryChannel[];
      }
      if (
        FLEX_BANK_MEANS_PAYOUT_IN_PERSON_COUNTRY_CODES.has(destinationCouCode)
      ) {
        return [
          "MOBILE_MONEY",
          "PAYOUT_IN_PERSON",
        ] as BeneficiaryDeliveryChannel[];
      }
      return getDeliveryChannels(destinationCouCode);
    }
    return getDeliveryChannelsFromFlexServices(
      destinationCouCode,
      flexBankCatalog,
    );
  }, [destinationCouCode, useFlexBankListUi, banksLoading, flexBankCatalog]);

  const payoutCurrencyOptions = useMemo(() => {
    const defaultOptions = ["USD", "EUR", "GBP"];
    const code = selectedDestinationCountry?.couCode;
    const local = code ? legalCurrencyForCouCode(code) : "";
    const all = local ? [local, ...defaultOptions] : defaultOptions;
    return Array.from(new Set(all));
  }, [selectedDestinationCountry?.couCode]);

  const showActualBankNameInput = useMemo(
    () =>
      requiresActualBankNameInput(destinationCouCode, formData.flexBankName),
    [destinationCouCode, formData.flexBankName],
  );

  const bankPickerDisplayName = showActualBankNameInput
    ? formData.flexBankName
    : formData.bankName;

  /** Dropdown only while loading or when we have banks; otherwise allow manual entry so users are not blocked. */
  const showFlexBankDropdown = useMemo(
    () =>
      Boolean(
        useFlexBankListUi &&
        formData.country?.trim() &&
        (banksLoading || flexBanks.length > 0),
      ),
    [useFlexBankListUi, formData.country, banksLoading, flexBanks.length],
  );

  /** Get available mobile money providers for the selected country */
  const availableMobileMoneyProviders = useMemo(() => {
    const country = formData.country?.trim();
    if (!country) return [];

    const providers = (mobileMoneyProvidersData as Record<string, string[]>)[
      country
    ];
    return providers || [];
  }, [formData.country]);

  useEffect(() => {
    if (!bankOpen && !payoutCurrencyOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-bank-dropdown]")) setBankOpen(false);
      if (!target.closest("[data-payout-dropdown]"))
        setPayoutCurrencyOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [bankOpen, payoutCurrencyOpen]);

  useEffect(() => {
    if (
      !open ||
      !lockCountry ||
      flexCountries.length === 0 ||
      editBeneficiaryId
    )
      return;
    const byCode =
      lockCountry.couCode &&
      flexCountries.find(
        (c) => c.couCode.toUpperCase() === lockCountry.couCode!.toUpperCase(),
      );
    const byName = flexCountries.find(
      (c) =>
        c.couName.trim().toLowerCase() ===
        lockCountry.couName.trim().toLowerCase(),
    );
    const match = byCode || byName;
    if (match) {
      const name = match.couName != null ? String(match.couName) : "";
      setFormData((prev) => ({ ...prev, country: name }));
    }
  }, [open, lockCountry, flexCountries, editBeneficiaryId]);

  useEffect(() => {
    if (!open) {
      setEditLoadError("");
      return;
    }

    if (editBeneficiaryId) {
      let cancelled = false;
      setEditLoading(true);
      setEditLoadError("");
      setErrors({});
      setIsConfirmingAccount(false);
      setBankOpen(false);
      setPayoutCurrencyOpen(false);
      setBankSearch("");
      setBankIdLookupStatus("idle");
      setFlexBankCatalog([]);

      void api
        .get<{ data: { beneficiary: CreatedBeneficiaryPayload } }>(
          `/beneficiaries/${editBeneficiaryId}`,
        )
        .then((res) => {
          if (cancelled) return;
          const b = res.data.data.beneficiary;
          const match =
            matchFlexCountryByLabel(
              catalogCountryList,
              String(b.country ?? ""),
            ) ??
            matchFlexCountryByLabel(flexCountries, String(b.country ?? ""));
          setFormData(
            beneficiaryRecordToForm(b, { destinationCouCode: match?.couCode }),
          );
          setLocalMobileNumber(nationalMobileFromStored(b.mobileNumber));
          setEditLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setEditLoadError("Could not load beneficiary. Try again.");
            setEditLoading(false);
            setFormData({ ...emptyForm });
          }
        });

      return () => {
        cancelled = true;
      };
    }

    setEditLoading(false);
    setEditLoadError("");
    setFormData(
      lockCountry?.couName?.trim()
        ? {
            ...emptyForm,
            country: String(lockCountry.couName).trim(),
            payoutCurrency: lockPayoutCurrency?.trim() || "",
          }
        : { ...emptyForm },
    );
    setErrors({});
    setIsConfirmingAccount(false);
    setLocalMobileNumber("");
    setMsisdnVerify({ status: "idle" });
    setAccountVerify({ status: "idle" });
    msisdnVerifyGen.current += 1;
    accountVerifyGen.current += 1;
    setFlexBankCatalog([]);
    setBankOpen(false);
    setPayoutCurrencyOpen(false);
    setBankSearch("");
    setBankIdLookupStatus("idle");
  }, [open, lockCountry?.couName, lockPayoutCurrency, editBeneficiaryId]);

  useEffect(() => {
    if (!open || isEditMode || !destinationCouCode) return;
    if (useFlexBankListUi && banksLoading) return;
    const channels = availableDeliveryChannels;
    if (channels.length === 0) return;
    setFormData((prev) => {
      if (channels.includes(prev.deliveryChannel)) return prev;
      return { ...prev, deliveryChannel: channels[0] };
    });
  }, [
    open,
    destinationCouCode,
    isEditMode,
    availableDeliveryChannels,
    useFlexBankListUi,
    banksLoading,
  ]);

  useEffect(() => {
    if (!open) {
      setFlexBankCatalog([]);
      setBanksLoading(false);
      return;
    }
    if (!useFlexBankListUi) {
      setFlexBankCatalog([]);
      setBanksLoading(false);
      setBankOpen(false);
      return;
    }
    const couCode = selectedDestinationCountry?.couCode;
    if (!couCode) {
      setFlexBankCatalog([]);
      setBanksLoading(false);
      return;
    }
    const ac = new AbortController();
    setBanksLoading(true);
    fetch(flexApiUrl(`/banks/${encodeURIComponent(couCode)}`), {
      credentials: "include",
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        const rows = Array.isArray(json?.data) ? json.data : [];
        const catalog: FlexBank[] = [];
        for (const row of rows as {
          serviceType?: string;
          bankCode?: string;
          bankName?: string;
        }[]) {
          const serviceType = String(row?.serviceType ?? "").trim();
          const bankCode = String(row?.bankCode ?? "").trim();
          const bankName = String(row?.bankName ?? "").trim();
          if (bankCode && bankName) {
            catalog.push({ serviceType, bankCode, bankName });
          }
        }
        setFlexBankCatalog(catalog);
      })
      .catch(() => {
        if (!ac.signal.aborted) setFlexBankCatalog([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setBanksLoading(false);
      });
    return () => ac.abort();
  }, [open, selectedDestinationCountry?.couCode, useFlexBankListUi]);

  useEffect(() => {
    if (!open || formData.deliveryChannel !== "MOBILE_MONEY") {
      setMsisdnVerify({ status: "idle" });
      return;
    }

    const digits = localMobileNumber.replace(/\D/g, "");
    if (!digits || !selectedDestinationCountry) {
      setMsisdnVerify({ status: "idle" });
      return;
    }

    let valid = false;
    if (destinationPhoneCountry) {
      const mobileErr = validateNationalPhoneDigits(
        destinationPhoneCountry,
        localMobileNumber,
      );
      valid = !mobileErr;
    } else {
      valid = digits.length >= 7 && digits.length <= 15;
    }

    if (!valid) {
      setMsisdnVerify({ status: "idle" });
      return;
    }

    const dial = dialCodeFromCouCode(selectedDestinationCountry.couCode);
    const payload = buildMsisdnPayload(dial, digits);
    if (payload.length < 10) {
      setMsisdnVerify({ status: "idle" });
      return;
    }

    const gen = ++msisdnVerifyGen.current;
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setMsisdnVerify({ status: "loading" });
        try {
          const result = await fetchFlexMsisdnVerify(payload, ac.signal);
          if (gen !== msisdnVerifyGen.current) return;
          if (result.ok) {
            setMsisdnVerify({ status: "success", name: result.name });
          } else {
            setMsisdnVerify({ status: "error", message: result.error });
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (gen !== msisdnVerifyGen.current) return;
          setMsisdnVerify({
            status: "error",
            message: "Could not verify mobile number.",
          });
        }
      })();
    }, 500);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [
    open,
    formData.deliveryChannel,
    localMobileNumber,
    selectedDestinationCountry,
    destinationPhoneCountry,
  ]);

  useEffect(() => {
    if (!open) {
      setAccountVerify({ status: "idle" });
      return;
    }
    // UPI channel owns accountVerify separately (same Flex accountVerify API).
    if (formData.deliveryChannel !== "BANK_TRANSFER") {
      return;
    }

    const account = formData.accountNumber.trim();
    const confirm = formData.confirmAccountNumber.trim();
    const bankCode = resolveAccountVerifyBankCode({
      flexBankCode: formData.flexBankCode,
      ifsc: formData.ifsc,
      routingNumber: formData.routingNumber,
      bankIdConfig,
    });
    const couCode = destinationCouCode;

    if (!account || !confirm || account !== confirm || !bankCode || !couCode) {
      setAccountVerify({ status: "idle" });
      return;
    }

    const gen = ++accountVerifyGen.current;
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setAccountVerify({ status: "loading" });
        try {
          const result = await fetchFlexAccountVerify(
            { payload: confirm, bankCode, couCode },
            ac.signal,
          );
          if (gen !== accountVerifyGen.current) return;
          if (result.ok) {
            setAccountVerify({ status: "success", name: result.name });
          } else {
            setAccountVerify({ status: "error", message: result.error });
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (gen !== accountVerifyGen.current) return;
          setAccountVerify({
            status: "error",
            message: "Could not verify account number.",
          });
        }
      })();
    }, 500);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [
    open,
    formData.deliveryChannel,
    formData.accountNumber,
    formData.confirmAccountNumber,
    formData.flexBankCode,
    formData.ifsc,
    formData.routingNumber,
    bankIdConfig,
    destinationCouCode,
  ]);

  /** UPI ID → Flex accountVerify (registered name hint). */
  useEffect(() => {
    if (!open || formData.deliveryChannel !== "UPI") {
      return;
    }

    const upiResult = validateUpiId(formData.upiId);
    const handle = upiResult.isValid ? upiHandleFromId(formData.upiId) : null;
    const couCode = destinationCouCode || "IND";

    if (!upiResult.isValid || !handle || !upiResult.normalized) {
      setAccountVerify({ status: "idle" });
      return;
    }

    const gen = ++accountVerifyGen.current;
    const ac = new AbortController();
    setAccountVerify({ status: "loading" });

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await fetchFlexAccountVerify(
            {
              payload: upiResult.normalized!,
              bankCode: handle,
              couCode,
            },
            ac.signal,
          );
          if (gen !== accountVerifyGen.current) return;
          if (result.ok) {
            setAccountVerify({ status: "success", name: result.name });
          } else {
            setAccountVerify({
              status: "error",
              message: result.error || "Could not verify UPI ID",
            });
          }
        } catch (e) {
          if (gen !== accountVerifyGen.current) return;
          if (ac.signal.aborted) return;
          setAccountVerify({
            status: "error",
            message: e instanceof Error ? e.message : "Could not verify UPI ID",
          });
        }
      })();
    }, 500);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [open, formData.deliveryChannel, formData.upiId, destinationCouCode]);

  useEffect(() => {
    if (!open || formData.deliveryChannel !== "BANK_TRANSFER") return;

    const ifscFieldExists = bankIdConfig.fields.some(
      (f) => f.lookup === "ifsc",
    );
    const abaFieldExists = bankIdConfig.fields.some((f) => f.lookup === "aba");

    if (!ifscFieldExists && !abaFieldExists) {
      setBankIdLookupStatus("idle");
      return;
    }

    const isIfsc = ifscFieldExists;
    const triggerValue = isIfsc ? formData.ifsc : formData.routingNumber;

    const delay = setTimeout(() => {
      const gen = ++bankIdLookupGen.current;
      const finish = () => bankIdLookupGen.current === gen;

      if (isIfsc) {
        const code = normalizeIfsc(triggerValue);
        if (code.length !== 11) {
          if (finish()) setBankIdLookupStatus("idle");
          return;
        }
        if (finish()) setBankIdLookupStatus("loading");

        void (async () => {
          try {
            // India IFSC lookup via Flex (backend proxies POST /ifscValidate).
            // Previous Razorpay lookup kept below for reference — do not delete.
            // const res = await fetch(
            //   `/api/bank-lookup/ifsc/${encodeURIComponent(code)}`,
            // );
            // if (!finish()) return;
            // if (res.status === 404) {
            //   setBankIdLookupStatus("not_found");
            //   return;
            // }
            // if (!res.ok) {
            //   setBankIdLookupStatus("error");
            //   return;
            // }
            // const j = (await res.json()) as {
            //   bank?: string;
            //   branch?: string;
            //   swift?: string;
            // };
            // const bank = (j.bank ?? "").trim();
            // const branch = (j.branch ?? "").trim();

            const res = await api.post(
              "/flex/ifsc-validate",
              { type: "IFSC", payload: code },
              {
                validateStatus: (s) =>
                  (s >= 200 && s < 300) || s === 404 || s === 422,
              },
            );
            if (!finish()) return;

            if (res.status === 404 || res.status === 422) {
              setBankIdLookupStatus("not_found");
              return;
            }
            if (res.status < 200 || res.status >= 300) {
              setBankIdLookupStatus("error");
              return;
            }

            const body = res.data as {
              success?: boolean;
              data?: Record<string, unknown>;
            };
            if (body?.success === false) {
              setBankIdLookupStatus("not_found");
              return;
            }

            const flex =
              body?.data && typeof body.data === "object"
                ? body.data
                : ((body as Record<string, unknown>) ?? {});

            const pick = (...keys: string[]) => {
              for (const k of keys) {
                const v = flex[k];
                if (typeof v === "string" && v.trim()) return v.trim();
              }
              return "";
            };

            const bank = pick(
              "BANK",
              "bank",
              "bankName",
              "BANKNAME",
              "BankName",
            );
            const branch = pick(
              "BRANCH",
              "branch",
              "branchName",
              "BRANCHNAME",
              "BranchName",
            );
            if (!bank && !branch) {
              setBankIdLookupStatus("not_found");
              return;
            }

            setFormData((prev) => ({
              ...prev,
              bankName: bank || prev.bankName,
              branchName: branch || prev.branchName,
            }));
            setBankIdLookupStatus("ok");
          } catch {
            if (finish()) setBankIdLookupStatus("error");
          }
        })();
        return;
      }

      // ABA routing lookup
      const digits = normalizeAba(triggerValue);
      if (digits.length !== 9) {
        if (finish()) setBankIdLookupStatus("idle");
        return;
      }
      if (finish()) setBankIdLookupStatus("loading");

      void (async () => {
        try {
          const res = await fetch(
            `/api/bank-lookup/aba/${encodeURIComponent(digits)}`,
          );
          if (!finish()) return;
          if (res.status === 404) {
            setBankIdLookupStatus("not_found");
            return;
          }
          if (!res.ok) {
            setBankIdLookupStatus("error");
            return;
          }
          const j = (await res.json()) as {
            bank?: string;
            city?: string;
            state?: string;
          };
          const bank = (j.bank ?? "").trim();
          const branchLine = [j.city ?? "", j.state ?? ""]
            .map((s) => s.trim())
            .filter(Boolean)
            .join(", ");
          setFormData((prev) => ({
            ...prev,
            bankName: bank || prev.bankName,
            branchName: branchLine || prev.branchName,
          }));
          setBankIdLookupStatus("ok");
        } catch {
          if (finish()) setBankIdLookupStatus("error");
        }
      })();
    }, 450);

    return () => clearTimeout(delay);
  }, [
    open,
    formData.deliveryChannel,
    formData.payoutCurrency,
    selectedDestinationCountry?.couCode,
    formData.ifsc,
    formData.routingNumber,
  ]);

  function handleChange(field: keyof FormData, value: string) {
    const next = value == null ? "" : String(value);
    setFormData((prev) => ({ ...prev, [field]: next }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handlePayoutInPersonIdChange(raw: string) {
    const isUaeResident =
      isUaePayoutInPersonChannel &&
      formData.uaePayoutRecipientType === "RESIDENT";
    const isUaeVisitor =
      isUaePayoutInPersonChannel &&
      formData.uaePayoutRecipientType === "VISITOR";

    let next = raw;
    if (isUaeResident) {
      next = sanitizeEmiratesId(raw);
    } else if (isUaeVisitor) {
      next = raw
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase()
        .slice(0, 20);
    }

    setFormData((prev) => ({ ...prev, payoutInPersonIdNumber: next }));

    if (isUaeResident) {
      const formatError = validateEmiratesId(next, {
        allowEmpty: true,
        allowIncomplete: true,
      });
      setErrors((prev) => ({
        ...prev,
        payoutInPersonIdNumber: formatError ?? undefined,
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, payoutInPersonIdNumber: undefined }));
  }

  function handleUaePayoutRecipientTypeChange(type: UaePayoutRecipientType) {
    setFormData((prev) => ({
      ...prev,
      uaePayoutRecipientType: type,
      payoutInPersonIdNumber: "",
    }));
    setErrors((prev) => ({
      ...prev,
      uaePayoutRecipientType: undefined,
      payoutInPersonIdNumber: undefined,
    }));
  }

  function selectFlexBank(bank: FlexBank) {
    const needsActual = requiresActualBankNameInput(
      destinationCouCode,
      bank.bankName,
    );
    setFormData((prev) => ({
      ...prev,
      flexBankName: needsActual ? bank.bankName : "",
      flexBankCode: bank.bankCode,
      bankName: needsActual ? "" : bank.bankName,
    }));
    setErrors((prev) => ({
      ...prev,
      bankName: undefined,
      flexBankName: undefined,
    }));
    setBankOpen(false);
  }

  function applyDestinationCountryChange(couName: string) {
    const match =
      matchFlexCountryByLabel(catalogCountryList, couName) ??
      matchFlexCountryByLabel(flexCountries, couName);

    const defaultPayoutCurrency = match?.couCode
      ? legalCurrencyForCouCode(match.couCode)
      : "";

    setFormData((prev) => ({
      ...prev,
      country: couName,
      payoutCurrency: defaultPayoutCurrency,
      bankName: "",
      flexBankName: "",
      flexBankCode: "",
      branchName: "",
      accountNumber: "",
      confirmAccountNumber: "",
      swiftBic: "",
      iban: "",
      confirmIban: "",
      sortCode: "",
      routingNumber: "",
      transitNumber: "",
      bsb: "",
      ifsc: "",
      mobileMoneyProvider: "",
      upiId: "",
      payoutInPersonIdNumber: "",
      uaePayoutRecipientType: "",
    }));
    setLocalMobileNumber("");
    setMsisdnVerify({ status: "idle" });
    setAccountVerify({ status: "idle" });
    msisdnVerifyGen.current += 1;
    accountVerifyGen.current += 1;
    setBankIdLookupStatus("idle");
    setBankSearch("");
    setBankOpen(false);
    setErrors((prev) => ({
      ...prev,
      country: undefined,
      payoutCurrency: undefined,
      deliveryChannel: undefined,
      upiId: undefined,
    }));
  }

  function applyDeliveryChannelChange(channel: BeneficiaryDeliveryChannel) {
    setFormData((prev) => ({
      ...prev,
      deliveryChannel: channel,
      ...(channel !== "BANK_TRANSFER"
        ? {
            bankName: "",
            flexBankName: "",
            flexBankCode: "",
            branchName: "",
            accountNumber: "",
            confirmAccountNumber: "",
            swiftBic: "",
            iban: "",
            confirmIban: "",
            sortCode: "",
            routingNumber: "",
            transitNumber: "",
            bsb: "",
            ifsc: "",
          }
        : {}),
      ...(channel !== "MOBILE_MONEY" ? { mobileMoneyProvider: "" } : {}),
      ...(channel !== "UPI" ? { upiId: "" } : {}),
      ...(channel !== "PAYOUT_IN_PERSON"
        ? { payoutInPersonIdNumber: "", uaePayoutRecipientType: "" as const }
        : {}),
    }));
    if (channel !== "UPI") {
      /* keep localMobileNumber when switching among bank / MM / payout */
    } else {
      setLocalMobileNumber("");
    }
    setMsisdnVerify({ status: "idle" });
    setAccountVerify({ status: "idle" });
    msisdnVerifyGen.current += 1;
    accountVerifyGen.current += 1;
    setErrors((prev) => ({
      ...prev,
      deliveryChannel: undefined,
      upiId: undefined,
      mobileNumber: undefined,
      uaePayoutRecipientType: undefined,
      payoutInPersonIdNumber: undefined,
    }));
  }

  function getBankFieldValue(key: BankFieldKey): string {
    if (key === "iban") return formData.iban;
    if (key === "swiftBic") return formData.swiftBic;
    if (key === "sortCode") return formData.sortCode;
    if (key === "routingNumber") return formData.routingNumber;
    if (key === "transitNumber") return formData.transitNumber;
    if (key === "bsb") return formData.bsb;
    if (key === "ifsc") return formData.ifsc;
    return "";
  }

  function setBankFieldValue(key: BankFieldKey, value: string) {
    const formKey: keyof FormData =
      key === "iban"
        ? "iban"
        : key === "sortCode"
          ? "sortCode"
          : key === "routingNumber"
            ? "routingNumber"
            : key === "transitNumber"
              ? "transitNumber"
              : key === "bsb"
                ? "bsb"
                : key === "ifsc"
                  ? "ifsc"
                  : "swiftBic";
    handleChange(formKey, value);
  }

  function ibanLengthHintText(): string {
    if (!ibanHintAlpha2) return "International Bank Account Number";
    const len = IBAN_LENGTH_BY_COUNTRY[ibanHintAlpha2];
    if (!len) return "International Bank Account Number";
    const name = countriesIso.getName(ibanHintAlpha2, "en") || ibanHintAlpha2;
    return `${name} IBAN must be ${len} characters.`;
  }

  function normalizeBankFieldValue(field: BankField, raw: string): string {
    if (field.lookup === "ifsc") return normalizeIfsc(raw);
    if (field.lookup === "aba") return normalizeAba(raw);
    if (field.lookup === "iban") {
      const max = expectedIbanLength(raw, ibanHintAlpha2) ?? 34;
      return normalizeIban(raw, max);
    }
    if (field.key === "sortCode") return normalizeSortCode(raw);
    if (field.key === "bsb") return normalizeBsb(raw);
    if (field.maxLength) return raw.slice(0, field.maxLength);
    return raw;
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {};

    if (!formData.firstName.trim()) errs.firstName = "First name is required";
    if (!formData.lastName.trim()) errs.lastName = "Last name is required";
    if (!formData.country.trim())
      errs.country = "Destination country is required";
    if (!formData.payoutCurrency.trim()) {
      errs.payoutCurrency = "Payout currency is required";
    }

    if (
      destinationCouCode &&
      !availableDeliveryChannels.includes(formData.deliveryChannel)
    ) {
      errs.deliveryChannel =
        "Delivery channel is not available for this country";
    }

    if (formData.deliveryChannel === "BANK_TRANSFER") {
      if (showActualBankNameInput) {
        if (!formData.flexBankName.trim()) {
          errs.flexBankName = "Select a bank from the list";
        }
        if (!formData.bankName.trim()) {
          errs.bankName = "Enter the beneficiary bank name";
        }
      } else if (!formData.bankName.trim()) {
        errs.bankName = "Bank name is required";
      }

      const hasAccountField = bankIdConfig.fields.some(
        (f) => f.key === "accountNumber",
      );
      if (hasAccountField) {
        if (!formData.accountNumber.trim())
          errs.accountNumber = "Account number is required";
        if (!formData.confirmAccountNumber.trim())
          errs.confirmAccountNumber = "Please confirm account number";
        else if (formData.accountNumber !== formData.confirmAccountNumber)
          errs.confirmAccountNumber = "Account numbers do not match";
      }

      const hasIbanField = bankIdConfig.fields.some((f) => f.key === "iban");

      for (const field of bankIdConfig.fields) {
        if (field.key === "accountNumber") continue;
        const val = getBankFieldValue(field.key);
        if (field.required && !val.trim()) {
          errs[field.key as keyof FormData] = `${field.label} is required`;
        } else if (val.trim()) {
          const fieldErr =
            field.lookup === "iban"
              ? validateIban(val, {
                  hintAlpha2: ibanHintAlpha2,
                  required: field.required,
                })
              : validateBankField(field, val);
          if (fieldErr) errs[field.key as keyof FormData] = fieldErr;
        }
      }

      if (hasIbanField) {
        if (!formData.confirmIban.trim())
          errs.confirmIban = "Please confirm IBAN";
        else if (formData.iban !== formData.confirmIban)
          errs.confirmIban = "IBANs do not match";
      }
    }

    if (formData.deliveryChannel === "MOBILE_MONEY") {
      if (!formData.mobileMoneyProvider.trim())
        errs.mobileMoneyProvider = "Provider is required";
      if (!localMobileNumber.trim()) {
        errs.mobileNumber = "Mobile number is required";
      } else if (isUaeDestination) {
        const uae = validateUaeMobileNationalDigits(localMobileNumber);
        if (!uae.isValid)
          errs.mobileNumber = uae.error ?? "Invalid mobile number";
      } else if (destinationPhoneCountry) {
        const mobileErr = validateNationalPhoneDigits(
          destinationPhoneCountry,
          localMobileNumber,
        );
        if (mobileErr) errs.mobileNumber = mobileErr;
      } else {
        const digits = localMobileNumber.replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 15) {
          errs.mobileNumber = "Enter a valid mobile number (7–15 digits)";
        }
      }
    }

    if (
      isUaeDestination &&
      (formData.deliveryChannel === "BANK_TRANSFER" ||
        formData.deliveryChannel === "PAYOUT_IN_PERSON")
    ) {
      if (!localMobileNumber.trim()) {
        errs.mobileNumber = "Mobile number is required";
      } else {
        const uae = validateUaeMobileNationalDigits(localMobileNumber);
        if (!uae.isValid)
          errs.mobileNumber = uae.error ?? "Invalid mobile number";
      }
    }

    if (formData.deliveryChannel === "UPI") {
      const upiResult = validateUpiId(formData.upiId);
      if (!upiResult.isValid) {
        errs.upiId = upiResult.error ?? "Invalid UPI ID";
      }
    }

    if (formData.deliveryChannel === "PAYOUT_IN_PERSON") {
      if (isUaePayoutInPersonChannel) {
        // Recipient type + ID are optional for UAE; validate only when filled.
        if (formData.uaePayoutRecipientType === "RESIDENT") {
          if (formData.payoutInPersonIdNumber.trim()) {
            const formatError = validateEmiratesId(
              formData.payoutInPersonIdNumber,
            );
            if (formatError) errs.payoutInPersonIdNumber = formatError;
          }
        } else if (formData.uaePayoutRecipientType === "VISITOR") {
          const passport = formData.payoutInPersonIdNumber.trim();
          if (passport && passport.length > 20) {
            errs.payoutInPersonIdNumber = "Passport number is too long";
          }
        } else if (formData.payoutInPersonIdNumber.trim()) {
          const id = formData.payoutInPersonIdNumber.trim();
          const emiratesErr = validateEmiratesId(id, { allowEmpty: false });
          if (emiratesErr && id.startsWith("784")) {
            errs.payoutInPersonIdNumber = emiratesErr;
          } else if (emiratesErr && id.length > 20) {
            errs.payoutInPersonIdNumber = "Passport number is too long";
          }
        }
      } else if (!formData.payoutInPersonIdNumber.trim()) {
        errs.payoutInPersonIdNumber = `${payoutInPersonIdFieldLabel(destinationCouCode)} is required`;
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSaving(true);

      const payload: Record<string, unknown> = {
        deliveryChannel: formData.deliveryChannel,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      };

      payload.country = formData.country.trim();
      payload.payoutCurrency = formData.payoutCurrency.trim();

      if (formData.deliveryChannel === "BANK_TRANSFER") {
        payload.bankName = formData.bankName.trim();
        if (formData.flexBankName.trim()) {
          payload.flexBankName = formData.flexBankName.trim();
        }
        if (formData.flexBankCode.trim()) {
          payload.flexBankCode = formData.flexBankCode.trim();
        }
        payload.branchName = formData.branchName.trim() || undefined;
        payload.accountNumber =
          formData.confirmAccountNumber.trim() || undefined;

        for (const field of bankIdConfig.fields) {
          if (field.key === "accountNumber") continue;
          const val = getBankFieldValue(field.key).trim();
          if (val) payload[field.key] = val;
        }

        if (isUaeDestination) {
          const dial = selectedDestinationCountry
            ? dialCodeFromCouCode(selectedDestinationCountry.couCode)
            : "971";
          const digits = localMobileNumber.replace(/\D/g, "");
          const uae = validateUaeMobileNationalDigits(digits);
          payload.mobileNumber =
            uae.e164 ||
            (dial && digits ? `+${dial}${digits}` : digits || undefined);
        }
      } else if (formData.deliveryChannel === "MOBILE_MONEY") {
        payload.mobileMoneyProvider = formData.mobileMoneyProvider.trim();
        const dial = selectedDestinationCountry
          ? dialCodeFromCouCode(selectedDestinationCountry.couCode)
          : undefined;
        const digits = localMobileNumber.replace(/\D/g, "");
        if (isUaeDestination) {
          const uae = validateUaeMobileNationalDigits(digits);
          payload.mobileNumber =
            uae.e164 ||
            (dial && digits
              ? `+${dial}${digits}`
              : digits || localMobileNumber);
        } else {
          payload.mobileNumber =
            dial && digits ? `+${dial}${digits}` : digits || localMobileNumber;
        }
      } else if (formData.deliveryChannel === "UPI") {
        const upiResult = validateUpiId(formData.upiId);
        payload.upiId =
          upiResult.normalized ?? formData.upiId.trim().toLowerCase();
      } else if (formData.deliveryChannel === "PAYOUT_IN_PERSON") {
        if (formData.payoutInPersonIdNumber.trim()) {
          payload.payoutInPersonIdNumber =
            formData.payoutInPersonIdNumber.trim();
        }
        if (isUaePayoutInPersonChannel && formData.uaePayoutRecipientType) {
          payload.uaePayoutRecipientType = formData.uaePayoutRecipientType;
        }
        if (isUaeDestination) {
          const dial = selectedDestinationCountry
            ? dialCodeFromCouCode(selectedDestinationCountry.couCode)
            : "971";
          const digits = localMobileNumber.replace(/\D/g, "");
          const uae = validateUaeMobileNationalDigits(digits);
          payload.mobileNumber =
            uae.e164 ||
            (dial && digits ? `+${dial}${digits}` : digits || undefined);
        }
      }

      if (editBeneficiaryId) {
        const res = await api.patch<{
          success: boolean;
          data: { beneficiary: CreatedBeneficiaryPayload };
        }>(`/beneficiaries/${editBeneficiaryId}`, payload);
        const updated = res.data.data.beneficiary;
        await onSuccess?.(updated);
      } else {
        const res = await api.post<{
          success: boolean;
          data: { beneficiary: CreatedBeneficiaryPayload };
        }>("/beneficiaries", payload);
        const created = res.data.data.beneficiary;
        await onSuccess?.(created);
      }
      onClose();
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        (editBeneficiaryId
          ? "Failed to update beneficiary"
          : "Failed to add beneficiary");
      if (onSubmitError) {
        onSubmitError(msg);
      } else {
        notifyApiError(error, msg);
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (!open) return null;

  function renderDestinationMobileField(opts?: {
    showMsisdnHint?: boolean;
    uaeOnlyHint?: boolean;
  }) {
    const maxDigits = isUaeDestination
      ? 9
      : (destinationPhoneCountry?.maxDigits ?? 15);
    return (
      <div>
        <label className="text-sm font-medium text-slate-700 block mb-1.5">
          Mobile Number <span className="text-red-500">*</span>
        </label>
        <div
          className={`flex items-center border rounded-lg overflow-visible transition-all focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-600 bg-white ${
            errors.mobileNumber
              ? "border-red-400 focus-within:ring-red-400/20 focus-within:border-red-400"
              : "border-slate-200"
          }`}
        >
          <div className="flex-shrink-0">
            <div className="flex items-center gap-1.5 px-3 h-10 text-sm bg-slate-100 border-r border-slate-200 rounded-l-lg">
              {formData.country && selectedDestinationCountry ? (
                <>
                  <FlexCountryFlag
                    couCode={selectedDestinationCountry.couCode}
                  />
                  {dialCodeFromCouCode(selectedDestinationCountry.couCode) ? (
                    <span className="text-slate-700 font-medium">
                      +{dialCodeFromCouCode(selectedDestinationCountry.couCode)}
                    </span>
                  ) : (
                    <span className="text-slate-500 text-xs">—</span>
                  )}
                </>
              ) : (
                <span className="text-slate-400">Select country</span>
              )}
            </div>
          </div>

          <input
            type="tel"
            inputMode="numeric"
            placeholder={
              isUaeDestination
                ? ""
                : formData.country && destinationPhoneCountry
                  ? nationalPhonePlaceholder(destinationPhoneCountry)
                  : formData.country && selectedDestinationCountry
                    ? "National mobile number (7–15 digits)"
                    : "Select country first"
            }
            value={localMobileNumber}
            onChange={(e) => {
              if (!selectedDestinationCountry) return;
              const digits = e.target.value
                .replace(/\D/g, "")
                .slice(0, maxDigits);
              setLocalMobileNumber(digits);
              if (isUaeDestination && digits) {
                const uae = validateUaeMobileNationalDigits(digits);
                setErrors((prev) => ({
                  ...prev,
                  mobileNumber: uae.isValid
                    ? undefined
                    : digits.length >= 9
                      ? (uae.error ?? undefined)
                      : undefined,
                }));
              } else {
                setErrors((prev) => ({
                  ...prev,
                  mobileNumber: undefined,
                }));
              }
            }}
            disabled={!formData.country}
            className="flex-1 h-10 px-3 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-900 disabled:cursor-not-allowed font-mono tracking-wide"
          />
        </div>
        {/* {isUaeDestination || opts?.uaeOnlyHint ? (
          <p className="mt-1 text-xs text-slate-500">
            UAE mobile only (50, 52, 54, 55, 56, 58). Landlines are not allowed.
          </p>
        ) : null} */}
        {errors.mobileNumber && (
          <p className="mt-1 text-xs text-red-500">{errors.mobileNumber}</p>
        )}
        {opts?.showMsisdnHint ? <VerifyNameHint state={msisdnVerify} /> : null}
      </div>
    );
  }

  // ── Bank field display helpers ────────────────────────────────────────────
  const bankIdentFields = bankIdConfig.fields.filter(
    (f) => f.key !== "accountNumber",
  );
  const bankIbanField = bankIdentFields.find((f) => f.key === "iban") ?? null;
  const bankGroupableFields = bankIdentFields.filter((f) => f.key !== "iban");
  const bankFieldUseGrid = bankGroupableFields.length >= 2;
  const bankHasAccountField = bankIdConfig.fields.some(
    (f) => f.key === "accountNumber",
  );

  function renderSingleBankField(field: BankField) {
    const ibanMaxLen =
      field.lookup === "iban"
        ? (expectedIbanLength(formData.iban, ibanHintAlpha2) ?? 34)
        : undefined;

    const inputEl = (
      <>
        <label className="text-sm font-medium text-slate-700 block mb-1.5">
          {field.label}{" "}
          {field.required && <span className="text-red-500">*</span>}
        </label>
        <input
          type={field.key === "iban" && isConfirmingIban ? "password" : "text"}
          autoComplete="off"
          placeholder={field.placeholder}
          maxLength={ibanMaxLen}
          value={getBankFieldValue(field.key)}
          onChange={(e) => {
            const normalized = normalizeBankFieldValue(field, e.target.value);
            setBankFieldValue(field.key, normalized);
            if (field.key === "iban") {
              const ibanErr = normalized.trim()
                ? validateIban(normalized, {
                    hintAlpha2: ibanHintAlpha2,
                    required: field.required,
                  })
                : undefined;
              setErrors((prev) => ({
                ...prev,
                iban: ibanErr,
                confirmIban: formData.confirmIban
                  ? formData.confirmIban !== normalized
                    ? "IBANs do not match"
                    : validateIban(formData.confirmIban, {
                        hintAlpha2: ibanHintAlpha2,
                        required: true,
                      })
                  : prev.confirmIban,
              }));
            }
          }}
          onFocus={
            field.key === "iban" ? () => setIsConfirmingIban(false) : undefined
          }
          className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
            errors[field.key as keyof FormData]
              ? "border-red-400"
              : "border-slate-200"
          }`}
        />
        {(field.lookup === "iban" ? ibanLengthHintText() : field.hint) && (
          <p className="mt-1 text-xs text-slate-500">
            {field.lookup === "iban" ? ibanLengthHintText() : field.hint}
          </p>
        )}
        {(field.lookup === "ifsc" || field.lookup === "aba") && (
          <>
            {bankIdLookupStatus === "loading" && (
              <p className="mt-1 text-xs text-red-600">
                Looking up bank details…
              </p>
            )}
            {bankIdLookupStatus === "ok" && (
              <p className="mt-1 text-xs text-red-700">
                Bank and branch filled automatically. Edit below if needed.
              </p>
            )}
            {bankIdLookupStatus === "not_found" && (
              <p className="mt-1 text-xs text-amber-700">
                Code not found. Check it or enter bank and branch manually.
              </p>
            )}
            {bankIdLookupStatus === "error" && (
              <p className="mt-1 text-xs text-red-600">
                Lookup failed. Enter bank and branch manually.
              </p>
            )}
          </>
        )}
        {errors[field.key as keyof FormData] && (
          <p className="mt-1 text-xs text-red-500">
            {errors[field.key as keyof FormData]}
          </p>
        )}
      </>
    );

    if (field.key === "iban") {
      return (
        <>
          <div key="iban">{inputEl}</div>
          <div key="confirmIban">
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Confirm IBAN <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoComplete="off"
              placeholder="Re-enter IBAN"
              maxLength={
                expectedIbanLength(formData.confirmIban, ibanHintAlpha2) ?? 34
              }
              value={formData.confirmIban}
              onPaste={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onChange={(e) => {
                const max =
                  expectedIbanLength(e.target.value, ibanHintAlpha2) ?? 34;
                const normalized = normalizeIban(e.target.value, max);
                handleChange("confirmIban", normalized);
                setErrors((prev) => ({
                  ...prev,
                  confirmIban: !normalized.trim()
                    ? "Please confirm IBAN"
                    : normalized !== formData.iban
                      ? "IBANs do not match"
                      : validateIban(normalized, {
                          hintAlpha2: ibanHintAlpha2,
                          required: true,
                        }),
                }));
              }}
              onFocus={() => setIsConfirmingIban(true)}
              onBlur={() => setIsConfirmingIban(false)}
              className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
                errors.confirmIban ? "border-red-400" : "border-slate-200"
              }`}
            />
            {errors.confirmIban && (
              <p className="mt-1 text-xs text-red-500">{errors.confirmIban}</p>
            )}
          </div>
        </>
      );
    }

    return <div key={field.key}>{inputEl}</div>;
  }

  function renderIdentifierBlock() {
    return (
      <>
        {bankIbanField && renderSingleBankField(bankIbanField)}
        {bankFieldUseGrid ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bankGroupableFields.map((f) => renderSingleBankField(f))}
          </div>
        ) : (
          bankGroupableFields.map((f) => renderSingleBankField(f))
        )}
      </>
    );
  }

  const showForm = !editBeneficiaryId || (!editLoading && !editLoadError);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {isSaving && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-[2px]">
            <Loader
              variant="centered"
              size="xl"
              label={isEditMode ? "Saving changes…" : "Adding beneficiary…"}
              sublabel="Please wait."
            />
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditMode ? "Edit beneficiary" : "Add New Beneficiary"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className=" text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {editBeneficiaryId && editLoading && (
          <Loader
            variant="centered"
            className="py-20"
            size="xl"
            label="Loading beneficiary…"
          />
        )}

        {editBeneficiaryId && editLoadError && (
          <div className="p-8 text-center space-y-4">
            <p className="text-sm text-red-600">{editLoadError}</p>
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Close
            </button>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Destination Country <span className="text-red-500">*</span>
                </label>
                {countryLocked ? (
                  <>
                    <div className="flex items-center gap-2 w-full border border-slate-200 rounded-lg px-3 h-10 text-sm bg-slate-50 text-slate-800">
                      {selectedDestinationCountry ? (
                        <>
                          <FlexCountryFlag
                            couCode={selectedDestinationCountry.couCode}
                          />
                          <span className="font-medium">
                            {selectedDestinationCountry.couName}
                          </span>
                        </>
                      ) : (
                        <span className="font-medium">
                          {formData.country ||
                            lockCountry?.couName?.trim() ||
                            "—"}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-slate-400 shrink-0">
                        From transfer
                      </span>
                    </div>
                    {/* <p className="mt-1 text-xs text-slate-500">
                      Country matches the recipient you selected for this
                      transfer.
                    </p> */}
                  </>
                ) : (
                  <CatalogCountrySelect
                    value={formData.country}
                    onChange={applyDestinationCountryChange}
                    error={Boolean(errors.country)}
                    placeholder="Select destination country…"
                    countries={catalogCountryList}
                    countriesLoading={catalogCountriesLoading}
                    countriesError={catalogCountriesError}
                  />
                )}
                {errors.country && (
                  <p className="mt-1 text-xs text-red-500">{errors.country}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Payout Currency <span className="text-red-500">*</span>
                </label>
                {currencyLocked ? (
                  <>
                    <div className="flex items-center gap-2 w-full border border-slate-200 rounded-lg px-3 h-10 text-sm bg-slate-50 text-slate-800">
                      {formData.payoutCurrency ? (
                        <>
                          <Flag
                            code={payCurrencyFlagCode(formData.payoutCurrency)}
                            className="w-5 h-3.5 rounded object-cover shrink-0"
                          />
                          <span className="font-medium">
                            {formData.payoutCurrency}
                          </span>
                        </>
                      ) : (
                        <span className="font-medium">—</span>
                      )}
                      <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-slate-400 shrink-0">
                        From transfer
                      </span>
                    </div>
                    {/* <p className="mt-1 text-xs text-slate-500">
                      Currency matches the payment method you selected for this
                      transfer.
                    </p> */}
                  </>
                ) : (
                  <div className="relative" data-payout-dropdown>
                    <button
                      type="button"
                      disabled={!formData.country}
                      onClick={() => setPayoutCurrencyOpen((v) => !v)}
                      className={`cursor-pointer flex items-center gap-2 w-full border rounded-lg px-3 h-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
                        errors.payoutCurrency
                          ? "border-red-400 cursor-pointer"
                          : "border-slate-200 cursor-pointer"
                      } ${!formData.country ? "bg-slate-50 cursor-not-allowed opacity-50" : "bg-white"}`}
                    >
                      {formData.payoutCurrency ? (
                        <>
                          <Flag
                            code={payCurrencyFlagCode(formData.payoutCurrency)}
                            className="w-5 h-3.5 rounded object-cover shrink-0"
                          />
                          <span className="text-slate-900 truncate">
                            {formData.payoutCurrency}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">
                          {!formData.country
                            ? "Select country first"
                            : "Select currency"}
                        </span>
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

                    {payoutCurrencyOpen && payoutCurrencyOptions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                        <ul className="max-h-52 overflow-y-auto py-1">
                          {payoutCurrencyOptions.map((cur) => (
                            <li key={cur}>
                              <button
                                type="button"
                                onClick={() => {
                                  handleChange("payoutCurrency", cur);
                                  setPayoutCurrencyOpen(false);
                                }}
                                className={`cursor-pointer flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-red-50 hover:text-red-700 transition-colors ${
                                  formData.payoutCurrency === cur
                                    ? "bg-red-50 text-red-700 font-medium cursor-pointer"
                                    : "text-slate-700 cursor-pointer"
                                }`}
                              >
                                <Flag
                                  code={payCurrencyFlagCode(cur)}
                                  className="w-5 h-3.5 rounded object-cover shrink-0"
                                />
                                <span className="truncate">{cur}</span>
                                {formData.payoutCurrency === cur && (
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
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {errors.payoutCurrency && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.payoutCurrency}
                  </p>
                )}
              </div>
            </div>

            {/* Delivery Channel */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">
                Delivery Channel <span className="text-red-500">*</span>
              </label>
              <NativeSelectShell>
                <select
                  value={formData.deliveryChannel}
                  disabled={
                    isEditMode ||
                    !formData.country.trim() ||
                    availableDeliveryChannels.length === 0 ||
                    (useFlexBankListUi &&
                      banksLoading &&
                      Boolean(destinationCouCode))
                  }
                  onChange={(e) =>
                    applyDeliveryChannelChange(
                      e.target.value as BeneficiaryDeliveryChannel,
                    )
                  }
                  className={`w-full border border-slate-200 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${fieldNativeSelectClasses}`}
                >
                  {!formData.country.trim() ? (
                    <option value="BANK_TRANSFER">
                      Select destination country first
                    </option>
                  ) : (
                    availableDeliveryChannels.map((ch) => (
                      <option key={ch} value={ch}>
                        {getDeliveryChannelLabel(ch)}
                      </option>
                    ))
                  )}
                </select>
              </NativeSelectShell>
              {!formData.country.trim() ? (
                <p className="mt-1 text-xs text-slate-500">
                  Choose a destination country to see available delivery
                  channels.
                </p>
              ) : useFlexBankListUi && banksLoading ? (
                <p className="mt-1 text-xs text-slate-500">
                  Loading delivery options…
                </p>
              ) : null}
              {isEditMode && (
                <p className="mt-1 text-xs text-slate-500">
                  Delivery type cannot be changed. Add a new beneficiary to use
                  a different channel.
                </p>
              )}
              {errors.deliveryChannel && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.deliveryChannel}
                </p>
              )}
            </div>

            {formData.deliveryChannel === "PAYOUT_IN_PERSON" && (
              <>
                {isUaePayoutInPersonChannel ? (
                  <>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-2">
                        Recipient type{" "}
                        <span className="text-slate-400 font-normal">
                          (optional)
                        </span>
                      </label>
                      <div className="flex items-center gap-6 p-3 bg-slate-50 rounded-lg">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="uaePayoutRecipientType"
                            checked={
                              formData.uaePayoutRecipientType === "RESIDENT"
                            }
                            onChange={() =>
                              handleUaePayoutRecipientTypeChange("RESIDENT")
                            }
                            className="w-4 h-4 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-sm text-slate-700">
                            Resident
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="uaePayoutRecipientType"
                            checked={
                              formData.uaePayoutRecipientType === "VISITOR"
                            }
                            onChange={() =>
                              handleUaePayoutRecipientTypeChange("VISITOR")
                            }
                            className="w-4 h-4 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-sm text-slate-700">
                            Visitor
                          </span>
                        </label>
                      </div>
                      {errors.uaePayoutRecipientType && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.uaePayoutRecipientType}
                        </p>
                      )}
                    </div>

                    {formData.uaePayoutRecipientType === "RESIDENT" && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1.5">
                          Emirates Id Number{" "}
                          <span className="text-slate-400 font-normal">
                            (optional)
                          </span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder={emiratesIdFormatHint()}
                          autoComplete="off"
                          value={formData.payoutInPersonIdNumber}
                          onChange={(e) =>
                            handlePayoutInPersonIdChange(e.target.value)
                          }
                          className={`w-full border rounded-lg px-3 h-10 text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
                            errors.payoutInPersonIdNumber
                              ? "border-red-400"
                              : "border-slate-200"
                          }`}
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          15 digits starting with 784 (e.g.{" "}
                          {emiratesIdFormatHint()})
                        </p>
                        {errors.payoutInPersonIdNumber && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.payoutInPersonIdNumber}
                          </p>
                        )}
                      </div>
                    )}

                    {formData.uaePayoutRecipientType === "VISITOR" && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1.5">
                          Passport number{" "}
                          <span className="text-slate-400 font-normal">
                            (optional)
                          </span>
                        </label>
                        <input
                          type="text"
                          inputMode="text"
                          placeholder="Passport number"
                          autoComplete="off"
                          value={formData.payoutInPersonIdNumber}
                          onChange={(e) =>
                            handlePayoutInPersonIdChange(e.target.value)
                          }
                          className={`w-full border rounded-lg px-3 h-10 text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
                            errors.payoutInPersonIdNumber
                              ? "border-red-400"
                              : "border-slate-200"
                          }`}
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Visitor visa is required for transaction
                        </p>
                        {errors.payoutInPersonIdNumber && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.payoutInPersonIdNumber}
                          </p>
                        )}
                      </div>
                    )}

                    {renderDestinationMobileField({ uaeOnlyHint: true })}
                  </>
                ) : (
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      {payoutInPersonIdFieldLabel(destinationCouCode)}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="text"
                      placeholder={payoutInPersonIdFieldLabel(
                        destinationCouCode,
                      )}
                      autoComplete="off"
                      value={formData.payoutInPersonIdNumber}
                      onChange={(e) =>
                        handlePayoutInPersonIdChange(e.target.value)
                      }
                      className={`w-full border rounded-lg px-3 h-10 text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
                        errors.payoutInPersonIdNumber
                          ? "border-red-400"
                          : "border-slate-200"
                      }`}
                    />
                    {errors.payoutInPersonIdNumber && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.payoutInPersonIdNumber}
                      </p>
                    )}
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {payoutInPersonCollectionNotice(
                    destinationCouCode,
                    formData.country,
                  )}
                </div>
              </>
            )}

            {/* First / last name (as per bank account) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  First name
                  {beneficiaryNameLabelSuffix(
                    formData.deliveryChannel,
                    destinationCouCode,
                    isUaePayoutInPersonChannel
                      ? formData.uaePayoutRecipientType
                      : undefined,
                  )}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="First name"
                  autoComplete="given-name"
                  value={formData.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
                    errors.firstName ? "border-red-400" : "border-slate-200"
                  }`}
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Last name
                  {beneficiaryNameLabelSuffix(
                    formData.deliveryChannel,
                    destinationCouCode,
                    isUaePayoutInPersonChannel
                      ? formData.uaePayoutRecipientType
                      : undefined,
                  )}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Last name"
                  autoComplete="family-name"
                  value={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
                    errors.lastName ? "border-red-400" : "border-slate-200"
                  }`}
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Bank Transfer Fields */}
            {formData.deliveryChannel === "BANK_TRANSFER" && (
              <>
                {/* Identifier fields — BEFORE bank name when showIdentifiersFirst */}
                {bankIdConfig.showIdentifiersFirst && renderIdentifierBlock()}

                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">
                    {isAllBanksCountry(destinationCouCode)
                      ? "Payout provider"
                      : "Bank name"}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  {!showFlexBankDropdown ? (
                    <input
                      type="text"
                      disabled={Boolean(
                        useFlexBankListUi && !formData.country?.trim(),
                      )}
                      placeholder={
                        useFlexBankListUi && !formData.country?.trim()
                          ? "Select country first"
                          : useFlexBankListUi &&
                              formData.country?.trim() &&
                              !banksLoading &&
                              flexBanks.length === 0
                            ? "Type bank name (no list available for this country)"
                            : bankIdConfig.fields.some(
                                  (f) => f.lookup === "ifsc",
                                )
                              ? "Filled from IFSC or type manually"
                              : bankIdConfig.fields.some(
                                    (f) => f.lookup === "aba",
                                  )
                                ? "Filled from routing number or type manually"
                                : "Bank name"
                      }
                      value={formData.bankName}
                      onChange={(e) => handleChange("bankName", e.target.value)}
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
                        errors.bankName ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                  ) : (
                    <div className="relative" data-bank-dropdown>
                      <button
                        type="button"
                        disabled={!formData.country || banksLoading}
                        onClick={() => {
                          if (!formData.country || banksLoading) return;
                          setBankOpen((v) => !v);
                          setBankSearch("");
                        }}
                        className={`flex items-center gap-2 w-full border rounded-lg px-3 h-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors bg-white disabled:opacity-50 disabled:cursor-not-allowed ${
                          errors.bankName
                            ? "border-red-400"
                            : "border-slate-200"
                        } ${bankPickerDisplayName ? "text-slate-900" : "text-slate-400"}`}
                      >
                        {banksLoading ? (
                          <span>Loading banks…</span>
                        ) : bankPickerDisplayName ? (
                          <span className="truncate">
                            {bankPickerDisplayName}
                          </span>
                        ) : (
                          <span>Select bank…</span>
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

                      {bankOpen && flexBanks.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                          <div className="p-2 border-b border-slate-100">
                            <input
                              autoFocus
                              placeholder="Search bank…"
                              value={bankSearch}
                              onChange={(e) => setBankSearch(e.target.value)}
                              className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
                            />
                          </div>
                          <ul className="max-h-52 overflow-y-auto py-1">
                            {filteredFlexBanks.map((b, idx) => (
                              <li key={`${b.bankCode}-${b.bankName}-${idx}`}>
                                <button
                                  type="button"
                                  onClick={() => selectFlexBank(b)}
                                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-red-50 hover:text-red-700 transition-colors ${
                                    bankPickerDisplayName === b.bankName
                                      ? "bg-red-50 text-red-700 font-medium"
                                      : "text-slate-700"
                                  }`}
                                >
                                  <span className="truncate">{b.bankName}</span>
                                  {bankPickerDisplayName === b.bankName && (
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
                            ))}
                            {filteredFlexBanks.length === 0 && (
                              <li className="px-3 py-4 text-sm text-slate-400 text-center">
                                No banks match your search
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {errors.flexBankName && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.flexBankName}
                    </p>
                  )}
                  {errors.bankName && !showActualBankNameInput && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.bankName}
                    </p>
                  )}
                </div>

                {showActualBankNameInput && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Bank name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter the beneficiary's bank name"
                      value={formData.bankName}
                      onChange={(e) => handleChange("bankName", e.target.value)}
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
                        errors.bankName ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Enter the actual bank name (e.g. KBC, ING, Belfius).
                    </p>
                    {errors.bankName && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.bankName}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">
                    Branch name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Street"
                    value={formData.branchName}
                    onChange={(e) => handleChange("branchName", e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors"
                  />
                </div>

                {isUaeDestination
                  ? renderDestinationMobileField({ uaeOnlyHint: true })
                  : null}

                {/* Account Number + Confirm — only when accountNumber is in the field config */}
                {bankHasAccountField && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">
                        Account Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type={isConfirmingAccount ? "password" : "text"}
                        placeholder="0123456789"
                        value={formData.accountNumber}
                        onChange={(e) => {
                          handleChange("accountNumber", e.target.value);
                          if (
                            formData.confirmAccountNumber &&
                            e.target.value !== formData.confirmAccountNumber
                          ) {
                            setErrors((prev) => ({
                              ...prev,
                              confirmAccountNumber:
                                "Account numbers do not match",
                            }));
                          } else if (
                            formData.confirmAccountNumber &&
                            e.target.value === formData.confirmAccountNumber
                          ) {
                            setErrors((prev) => ({
                              ...prev,
                              confirmAccountNumber: undefined,
                            }));
                          }
                        }}
                        onFocus={() => setIsConfirmingAccount(false)}
                        className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
                          errors.accountNumber
                            ? "border-red-400"
                            : "border-slate-200"
                        }`}
                      />
                      {errors.accountNumber && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.accountNumber}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">
                        Confirm Account Number{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Re-enter account number"
                        value={formData.confirmAccountNumber}
                        onPaste={(e) => e.preventDefault()}
                        onCopy={(e) => e.preventDefault()}
                        onCut={(e) => e.preventDefault()}
                        onChange={(e) => {
                          handleChange("confirmAccountNumber", e.target.value);
                          if (
                            e.target.value &&
                            formData.accountNumber !== e.target.value
                          ) {
                            setErrors((prev) => ({
                              ...prev,
                              confirmAccountNumber:
                                "Account numbers do not match",
                            }));
                          } else {
                            setErrors((prev) => ({
                              ...prev,
                              confirmAccountNumber: undefined,
                            }));
                          }
                        }}
                        onFocus={() => setIsConfirmingAccount(true)}
                        onBlur={() => setIsConfirmingAccount(false)}
                        className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
                          errors.confirmAccountNumber
                            ? "border-red-400"
                            : "border-slate-200"
                        }`}
                      />
                      {errors.confirmAccountNumber && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.confirmAccountNumber}
                        </p>
                      )}
                      <VerifyNameHint state={accountVerify} />
                    </div>
                  </>
                )}

                {/* Identifier fields — AFTER account number when !showIdentifiersFirst */}
                {!bankIdConfig.showIdentifiersFirst && renderIdentifierBlock()}
              </>
            )}

            {/* Mobile Money Fields */}
            {formData.deliveryChannel === "MOBILE_MONEY" && (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">
                    Mobile Money Provider{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <NativeSelectShell>
                    <select
                      value={formData.mobileMoneyProvider}
                      onChange={(e) =>
                        handleChange("mobileMoneyProvider", e.target.value)
                      }
                      disabled={
                        !formData.country ||
                        availableMobileMoneyProviders.length === 0
                      }
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${fieldNativeSelectClasses} ${
                        errors.mobileMoneyProvider
                          ? "border-red-400"
                          : "border-slate-200"
                      } ${formData.mobileMoneyProvider ? "text-slate-900" : "text-slate-400"} ${!formData.country || availableMobileMoneyProviders.length === 0 ? "bg-slate-50 cursor-not-allowed" : ""}`}
                    >
                      <option value="">
                        {!formData.country
                          ? "Select country first"
                          : availableMobileMoneyProviders.length === 0
                            ? "No providers available for this country"
                            : "Select provider"}
                      </option>
                      {availableMobileMoneyProviders.map((provider) => (
                        <option key={provider} value={provider}>
                          {provider}
                        </option>
                      ))}
                    </select>
                  </NativeSelectShell>
                  {availableMobileMoneyProviders.length === 0 &&
                    formData.country && (
                      <p className="mt-1 text-xs text-amber-600">
                        No mobile money providers configured for{" "}
                        {formData.country}. Add providers in{" "}
                        mobile-money-providers.json or use bank transfer.
                      </p>
                    )}
                  {errors.mobileMoneyProvider && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.mobileMoneyProvider}
                    </p>
                  )}
                </div>

                {renderDestinationMobileField({ showMsisdnHint: true })}
              </>
            )}

            {formData.deliveryChannel === "UPI" && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  UPI ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="name@ybl"
                  value={formData.upiId}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase();
                    handleChange("upiId", value);
                    const result = validateUpiId(value);
                    setErrors((prev) => ({
                      ...prev,
                      upiId: result.isValid
                        ? undefined
                        : value.trim()
                          ? (result.error ?? undefined)
                          : undefined,
                    }));
                  }}
                  className={`w-full border rounded-lg px-3 h-10 text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
                    errors.upiId ? "border-red-400" : "border-slate-200"
                  }`}
                />
                {errors.upiId && (
                  <p className="mt-1 text-xs text-red-500">{errors.upiId}</p>
                )}
                <VerifyNameHint state={accountVerify} />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="cursor-pointer flex-1 h-10 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="cursor-pointer flex-1 h-10 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isEditMode ? "Saving…" : "Adding…"}
                  </>
                ) : isEditMode ? (
                  "Save changes"
                ) : (
                  "Add Beneficiary"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
