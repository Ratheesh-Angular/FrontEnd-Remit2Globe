// "use client";

// import { useState, useEffect, useMemo, useRef } from "react";
// import { sessionApi as api } from "@/lib/api";
// import {
//   normalizeAba,
//   normalizeIfsc,
//   resolveBankIdentifierConfig,
//   validateBankIdentifier,
// } from "@/lib/beneficiary-bank-identifier";
// import { Loader } from "@/components/ui/Loader";
// import { FlexCountryFlag } from "@/components/country/FlexCountryFlag";
// import { CatalogCountrySelect } from "@/components/country/CatalogCountrySelect";
// import { useCatalogCountries } from "@/hooks/useCatalogCountries";
// import { useFlexCountries } from "@/hooks/useFlexCountries";
// import countriesIso from "i18n-iso-countries";
// import {
//   getCountryCallingCode,
//   parsePhoneNumberFromString,
//   type CountryCode,
// } from "libphonenumber-js";
// import { flexApiUrl } from "@/lib/flex-api";
// import { matchFlexCountryByLabel } from "@/lib/catalog-countries";
// import mobileMoneyProvidersData from "@/data/mobile-money-providers.json";
// import {
//   COU_CODE_TO_CURRENCY,
//   CURRENCY_TO_FLAG_ALPHA2,
// } from "@/lib/send-money-currencies";
// import {
//   getDeliveryChannelLabel,
//   getDeliveryChannels,
//   type BeneficiaryDeliveryChannel,
// } from "@/lib/beneficiary-delivery-channels";
// import Flag from "react-world-flags";

// interface FlexBank {
//   serviceType?: string;
//   bankCode: string;
//   bankName: string;
// }

// function alpha2FromCouCode(couCode: string): string | undefined {
//   const u = couCode?.trim().toUpperCase();
//   if (!u) return undefined;
//   return countriesIso.alpha3ToAlpha2(u) || undefined;
// }

// function dialCodeFromCouCode(couCode: string): string | undefined {
//   const a2 = alpha2FromCouCode(couCode);
//   if (!a2) return undefined;
//   try {
//     return getCountryCallingCode(a2 as CountryCode);
//   } catch {
//     return undefined;
//   }
// }

// function payCurrencyFlagCode(currency: string): string {
//   return CURRENCY_TO_FLAG_ALPHA2[currency.toUpperCase()] ?? "US";
// }

// export interface CreatedBeneficiaryPayload {
//   id: string;
//   firstName: string;
//   lastName: string;
//   deliveryChannel: BeneficiaryDeliveryChannel;
//   country?: string | null;
//   bankName?: string | null;
//   branchName?: string | null;
//   accountNumber?: string | null;
//   swiftBic?: string | null;
//   mobileMoneyProvider?: string | null;
//   mobileNumber?: string | null;
//   payoutCurrency?: string | null;
//   active?: boolean;
// }

// export type LockCountry = {
//   couName: string;
//   couCode?: string;
// };

// export type AddBeneficiaryModalProps = {
//   open: boolean;
//   onClose: () => void;
//   /** Called after a successful create, before `onClose`. May return a Promise. */
//   onSuccess?: (beneficiary: CreatedBeneficiaryPayload) => void | Promise<void>;
//   /** When set, destination country is fixed to this corridor (Flex list match). */
//   lockCountry?: LockCountry | null;
//   /** When set, modal loads this beneficiary and PATCHes on save instead of creating. */
//   editBeneficiaryId?: string | null;
//   /** If set, API errors are reported here instead of only inline `saveError`. */
//   onSubmitError?: (message: string) => void;
// };

// interface FormData {
//   deliveryChannel: BeneficiaryDeliveryChannel;
//   firstName: string;
//   lastName: string;
//   // Bank Transfer
//   country: string;
//   bankName: string;
//   branchName: string;
//   accountNumber: string;
//   confirmAccountNumber: string;
//   swiftBic: string;
//   payoutCurrency: string;
//   // Mobile Money
//   mobileMoneyProvider: string;
//   mobileNumber: string;
// }

// const emptyForm: FormData = {
//   deliveryChannel: "BANK_TRANSFER",
//   firstName: "",
//   lastName: "",
//   country: "",
//   bankName: "",
//   branchName: "",
//   accountNumber: "",
//   confirmAccountNumber: "",
//   swiftBic: "",
//   payoutCurrency: "",
//   mobileMoneyProvider: "",
//   mobileNumber: "",
// };

// function beneficiaryRecordToForm(b: CreatedBeneficiaryPayload): FormData {
//   const acct = String(b.accountNumber ?? "");
//   const channel: BeneficiaryDeliveryChannel =
//     b.deliveryChannel === "MOBILE_MONEY" ||
//     b.deliveryChannel === "PAYOUT_IN_PERSON"
//       ? b.deliveryChannel
//       : "BANK_TRANSFER";
//   return {
//     deliveryChannel: channel,
//     firstName: String(b.firstName ?? ""),
//     lastName: String(b.lastName ?? ""),
//     country: String(b.country ?? ""),
//     bankName: String(b.bankName ?? ""),
//     branchName: String(b.branchName ?? ""),
//     accountNumber: acct,
//     confirmAccountNumber: acct,
//     swiftBic: String(b.swiftBic ?? ""),
//     payoutCurrency: String(b.payoutCurrency ?? ""),
//     mobileMoneyProvider: String(b.mobileMoneyProvider ?? ""),
//     mobileNumber: "",
//   };
// }

// function nationalMobileFromStored(mobile: string | null | undefined): string {
//   const raw = String(mobile ?? "").trim();
//   if (!raw) return "";
//   try {
//     const p = parsePhoneNumberFromString(raw);
//     if (p?.nationalNumber) return String(p.nationalNumber);
//   } catch {
//     /* ignore */
//   }
//   return raw.replace(/\D/g, "");
// }

// export function AddBeneficiaryModal({
//   open,
//   onClose,
//   onSuccess,
//   lockCountry = null,
//   editBeneficiaryId = null,
//   onSubmitError,
// }: AddBeneficiaryModalProps) {
//   const countryLocked = Boolean(
//     lockCountry && (lockCountry.couName?.trim() || lockCountry.couCode?.trim()),
//   );

//   const [formData, setFormData] = useState<FormData>(emptyForm);
//   const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
//     {},
//   );
//   const [isSaving, setIsSaving] = useState(false);
//   const [saveError, setSaveError] = useState("");
//   const [isConfirmingAccount, setIsConfirmingAccount] = useState(false);
//   const [localMobileNumber, setLocalMobileNumber] = useState("");
//   const { countries: flexCountries } = useFlexCountries(open);
//   const {
//     countries: catalogCountryList,
//     loading: catalogCountriesLoading,
//     error: catalogCountriesError,
//   } = useCatalogCountries(open);
//   const [flexBanks, setFlexBanks] = useState<FlexBank[]>([]);
//   const [banksLoading, setBanksLoading] = useState(false);
//   const [bankOpen, setBankOpen] = useState(false);
//   const [payoutCurrencyOpen, setPayoutCurrencyOpen] = useState(false);
//   const [bankSearch, setBankSearch] = useState("");
//   const [bankIdLookupStatus, setBankIdLookupStatus] = useState<
//     "idle" | "loading" | "ok" | "not_found" | "error"
//   >("idle");
//   const bankIdLookupGen = useRef(0);
//   const isEditMode = Boolean(editBeneficiaryId);
//   const [editLoading, setEditLoading] = useState(false);
//   const [editLoadError, setEditLoadError] = useState("");

//   const filteredFlexBanks = useMemo(() => {
//     const q = bankSearch.toLowerCase().trim();
//     if (!q) return flexBanks;
//     return flexBanks.filter(
//       (b) =>
//         b.bankName.toLowerCase().includes(q) ||
//         b.bankCode.toLowerCase().includes(q),
//     );
//   }, [flexBanks, bankSearch]);

//   /** Full static catalog (+ Flex fallback) with loose label match for flags / dial code. */
//   const selectedDestinationCountry = useMemo(() => {
//     const raw = formData.country.trim();
//     if (!raw) return undefined;
//     return (
//       matchFlexCountryByLabel(catalogCountryList, raw) ??
//       matchFlexCountryByLabel(flexCountries, raw)
//     );
//   }, [catalogCountryList, flexCountries, formData.country]);

//   const destinationCouCode = useMemo(() => {
//     if (selectedDestinationCountry?.couCode) {
//       return selectedDestinationCountry.couCode.toUpperCase();
//     }
//     if (lockCountry?.couCode?.trim()) {
//       return lockCountry.couCode.trim().toUpperCase();
//     }
//     return "";
//   }, [selectedDestinationCountry?.couCode, lockCountry?.couCode]);

//   const availableDeliveryChannels = useMemo(
//     () => getDeliveryChannels(destinationCouCode),
//     [destinationCouCode],
//   );

//   const payoutCurrencyOptions = useMemo(() => {
//     const defaultOptions = ["USD", "EUR", "GBP"];
//     const code = selectedDestinationCountry?.couCode;
//     let local = "";
//     if (code) {
//       local = COU_CODE_TO_CURRENCY[code.toUpperCase()] || "";
//     }
//     const all = local ? [local, ...defaultOptions] : defaultOptions;
//     return Array.from(new Set(all));
//   }, [selectedDestinationCountry?.couCode]);

//   const bankIdConfig = useMemo(
//     () => resolveBankIdentifierConfig(selectedDestinationCountry?.couCode),
//     [selectedDestinationCountry?.couCode],
//   );

//   /** When false (e.g. production without Flex IP allowlisting), bank name is a plain text field. */
//   const useFlexBankListUi = useMemo(() => {
//     const flexBankListFromApiEnabled =
//       process.env.NEXT_PUBLIC_ENABLE_FLEX_BANK_LIST !== "false";
//     return !bankIdConfig.hideFlexBankPicker && flexBankListFromApiEnabled;
//   }, [bankIdConfig.hideFlexBankPicker]);

//   /** Dropdown only while loading or when we have banks; otherwise allow manual entry so users are not blocked. */
//   const showFlexBankDropdown = useMemo(
//     () =>
//       Boolean(
//         useFlexBankListUi &&
//         formData.country?.trim() &&
//         (banksLoading || flexBanks.length > 0),
//       ),
//     [useFlexBankListUi, formData.country, banksLoading, flexBanks.length],
//   );

//   /** Get available mobile money providers for the selected country */
//   const availableMobileMoneyProviders = useMemo(() => {
//     const country = formData.country?.trim();
//     if (!country) return [];

//     const providers = (mobileMoneyProvidersData as Record<string, string[]>)[
//       country
//     ];
//     return providers || [];
//   }, [formData.country]);

//   useEffect(() => {
//     if (!bankOpen && !payoutCurrencyOpen) return;
//     const close = (e: MouseEvent) => {
//       const target = e.target as HTMLElement;
//       if (!target.closest("[data-bank-dropdown]")) setBankOpen(false);
//       if (!target.closest("[data-payout-dropdown]"))
//         setPayoutCurrencyOpen(false);
//     };
//     document.addEventListener("mousedown", close);
//     return () => document.removeEventListener("mousedown", close);
//   }, [bankOpen, payoutCurrencyOpen]);

//   useEffect(() => {
//     if (
//       !open ||
//       !lockCountry ||
//       flexCountries.length === 0 ||
//       editBeneficiaryId
//     )
//       return;
//     const byCode =
//       lockCountry.couCode &&
//       flexCountries.find(
//         (c) => c.couCode.toUpperCase() === lockCountry.couCode!.toUpperCase(),
//       );
//     const byName = flexCountries.find(
//       (c) =>
//         c.couName.trim().toLowerCase() ===
//         lockCountry.couName.trim().toLowerCase(),
//     );
//     const match = byCode || byName;
//     if (match) {
//       const name = match.couName != null ? String(match.couName) : "";
//       setFormData((prev) => ({ ...prev, country: name }));
//     }
//   }, [open, lockCountry, flexCountries, editBeneficiaryId]);

//   useEffect(() => {
//     if (!open) {
//       setEditLoadError("");
//       return;
//     }

//     if (editBeneficiaryId) {
//       let cancelled = false;
//       setEditLoading(true);
//       setEditLoadError("");
//       setErrors({});
//       setSaveError("");
//       setIsConfirmingAccount(false);
//       setBankOpen(false);
//       setPayoutCurrencyOpen(false);
//       setBankSearch("");
//       setBankIdLookupStatus("idle");
//       setFlexBanks([]);

//       void api
//         .get<{ data: { beneficiary: CreatedBeneficiaryPayload } }>(
//           `/beneficiaries/${editBeneficiaryId}`,
//         )
//         .then((res) => {
//           if (cancelled) return;
//           const b = res.data.data.beneficiary;
//           setFormData(beneficiaryRecordToForm(b));
//           setLocalMobileNumber(nationalMobileFromStored(b.mobileNumber));
//           setEditLoading(false);
//         })
//         .catch(() => {
//           if (!cancelled) {
//             setEditLoadError("Could not load beneficiary. Try again.");
//             setEditLoading(false);
//             setFormData({ ...emptyForm });
//           }
//         });

//       return () => {
//         cancelled = true;
//       };
//     }

//     setEditLoading(false);
//     setEditLoadError("");
//     setFormData(
//       lockCountry?.couName?.trim()
//         ? {
//             ...emptyForm,
//             country: String(lockCountry.couName).trim(),
//           }
//         : { ...emptyForm },
//     );
//     setErrors({});
//     setSaveError("");
//     setIsConfirmingAccount(false);
//     setLocalMobileNumber("");
//     setFlexBanks([]);
//     setBankOpen(false);
//     setPayoutCurrencyOpen(false);
//     setBankSearch("");
//     setBankIdLookupStatus("idle");
//   }, [open, lockCountry?.couName, editBeneficiaryId]);

//   useEffect(() => {
//     if (!open || isEditMode || !destinationCouCode) return;
//     const channels = getDeliveryChannels(destinationCouCode);
//     if (channels.length === 0) return;
//     setFormData((prev) => {
//       if (channels.includes(prev.deliveryChannel)) return prev;
//       return { ...prev, deliveryChannel: channels[0] };
//     });
//   }, [open, destinationCouCode, isEditMode]);

//   useEffect(() => {
//     if (!open) {
//       setFlexBanks([]);
//       setBanksLoading(false);
//       return;
//     }
//     if (formData.deliveryChannel !== "BANK_TRANSFER") {
//       setFlexBanks([]);
//       setBanksLoading(false);
//       return;
//     }
//     if (!useFlexBankListUi) {
//       setFlexBanks([]);
//       setBanksLoading(false);
//       setBankOpen(false);
//       return;
//     }
//     const couCode = selectedDestinationCountry?.couCode;
//     if (!couCode) {
//       setFlexBanks([]);
//       setBanksLoading(false);
//       return;
//     }
//     const ac = new AbortController();
//     setBanksLoading(true);
//     fetch(flexApiUrl(`/banks/${encodeURIComponent(couCode)}`), {
//       credentials: "include",
//       signal: ac.signal,
//     })
//       .then((r) => r.json())
//       .then((json) => {
//         const rows = Array.isArray(json?.data) ? json.data : [];
//         const banks: FlexBank[] = [];
//         for (const row of rows as { bankCode?: string; bankName?: string }[]) {
//           const bankCode = String(row?.bankCode ?? "").trim();
//           const bankName = String(row?.bankName ?? "").trim();
//           if (bankCode && bankName) banks.push({ bankCode, bankName });
//         }
//         setFlexBanks(banks);
//       })
//       .catch(() => {
//         if (!ac.signal.aborted) setFlexBanks([]);
//       })
//       .finally(() => {
//         if (!ac.signal.aborted) setBanksLoading(false);
//       });
//     return () => ac.abort();
//   }, [
//     open,
//     formData.deliveryChannel,
//     formData.country,
//     selectedDestinationCountry?.couCode,
//     useFlexBankListUi,
//   ]);

//   useEffect(() => {
//     if (!open || formData.deliveryChannel !== "BANK_TRANSFER") return;
//     const kind = bankIdConfig.lookup;
//     if (kind !== "ifsc" && kind !== "aba") {
//       setBankIdLookupStatus("idle");
//       return;
//     }

//     const delay = setTimeout(() => {
//       const gen = ++bankIdLookupGen.current;

//       const finish = () => {
//         if (bankIdLookupGen.current !== gen) return false;
//         return true;
//       };

//       if (kind === "ifsc") {
//         const code = normalizeIfsc(formData.swiftBic);
//         if (code.length !== 11) {
//           if (finish()) setBankIdLookupStatus("idle");
//           return;
//         }
//         if (finish()) setBankIdLookupStatus("loading");

//         void (async () => {
//           try {
//             const res = await fetch(
//               `/api/bank-lookup/ifsc/${encodeURIComponent(code)}`,
//             );
//             if (!finish()) return;
//             if (res.status === 404) {
//               setBankIdLookupStatus("not_found");
//               return;
//             }
//             if (!res.ok) {
//               setBankIdLookupStatus("error");
//               return;
//             }
//             const j = (await res.json()) as {
//               bank?: string;
//               branch?: string;
//             };
//             setFormData((prev) => ({
//               ...prev,
//               bankName: (j.bank ?? "").trim() || prev.bankName,
//               branchName: (j.branch ?? "").trim() || prev.branchName,
//             }));
//             setBankIdLookupStatus("ok");
//           } catch {
//             if (finish()) setBankIdLookupStatus("error");
//           }
//         })();
//         return;
//       }

//       const digits = normalizeAba(formData.swiftBic);
//       if (digits.length !== 9) {
//         if (finish()) setBankIdLookupStatus("idle");
//         return;
//       }
//       if (finish()) setBankIdLookupStatus("loading");

//       void (async () => {
//         try {
//           const res = await fetch(
//             `/api/bank-lookup/aba/${encodeURIComponent(digits)}`,
//           );
//           if (!finish()) return;
//           if (res.status === 404) {
//             setBankIdLookupStatus("not_found");
//             return;
//           }
//           if (!res.ok) {
//             setBankIdLookupStatus("error");
//             return;
//           }
//           const j = (await res.json()) as {
//             bank?: string;
//             city?: string;
//             state?: string;
//           };
//           const bank = (j.bank ?? "").trim();
//           const city = (j.city ?? "").trim();
//           const state = (j.state ?? "").trim();
//           const branchLine = [city, state].filter(Boolean).join(", ");
//           setFormData((prev) => ({
//             ...prev,
//             bankName: bank || prev.bankName,
//             branchName: branchLine || prev.branchName,
//           }));
//           setBankIdLookupStatus("ok");
//         } catch {
//           if (finish()) setBankIdLookupStatus("error");
//         }
//       })();
//     }, 450);

//     return () => clearTimeout(delay);
//   }, [
//     open,
//     formData.deliveryChannel,
//     bankIdConfig.lookup,
//     formData.swiftBic,
//     selectedDestinationCountry?.couCode,
//   ]);

//   function handleChange(field: keyof FormData, value: string) {
//     const next = value == null ? "" : String(value);
//     setFormData((prev) => ({ ...prev, [field]: next }));
//     setErrors((prev) => ({ ...prev, [field]: undefined }));
//     setSaveError("");
//   }

//   function applyDestinationCountryChange(couName: string) {
//     const match =
//       matchFlexCountryByLabel(catalogCountryList, couName) ??
//       matchFlexCountryByLabel(flexCountries, couName);
//     const channels = getDeliveryChannels(match?.couCode ?? "");

//     setFormData((prev) => {
//       const nextChannel = channels.includes(prev.deliveryChannel)
//         ? prev.deliveryChannel
//         : (channels[0] ?? "BANK_TRANSFER");
//       return {
//         ...prev,
//         country: couName,
//         deliveryChannel: nextChannel,
//         payoutCurrency: "",
//         bankName: "",
//         branchName: "",
//         accountNumber: "",
//         confirmAccountNumber: "",
//         swiftBic: "",
//         mobileMoneyProvider: "",
//       };
//     });
//     setLocalMobileNumber("");
//     setBankIdLookupStatus("idle");
//     setBankSearch("");
//     setBankOpen(false);
//     setErrors((prev) => ({
//       ...prev,
//       country: undefined,
//       payoutCurrency: undefined,
//       deliveryChannel: undefined,
//     }));
//     setSaveError("");
//   }

//   function applyDeliveryChannelChange(channel: BeneficiaryDeliveryChannel) {
//     setFormData((prev) => ({
//       ...prev,
//       deliveryChannel: channel,
//       ...(channel !== "BANK_TRANSFER"
//         ? {
//             bankName: "",
//             branchName: "",
//             accountNumber: "",
//             confirmAccountNumber: "",
//             swiftBic: "",
//           }
//         : {}),
//       ...(channel !== "MOBILE_MONEY" ? { mobileMoneyProvider: "" } : {}),
//     }));
//     if (channel !== "MOBILE_MONEY") setLocalMobileNumber("");
//     setErrors((prev) => ({ ...prev, deliveryChannel: undefined }));
//     setSaveError("");
//   }

//   function validate(): boolean {
//     const errs: Partial<Record<keyof FormData, string>> = {};

//     if (!formData.firstName.trim()) errs.firstName = "First name is required";
//     if (!formData.lastName.trim()) errs.lastName = "Last name is required";
//     if (!formData.country.trim())
//       errs.country = "Destination country is required";
//     if (!formData.payoutCurrency.trim()) {
//       errs.payoutCurrency = "Payout currency is required";
//     }

//     if (
//       destinationCouCode &&
//       !availableDeliveryChannels.includes(formData.deliveryChannel)
//     ) {
//       errs.deliveryChannel =
//         "Delivery channel is not available for this country";
//     }

//     if (formData.deliveryChannel === "BANK_TRANSFER") {
//       if (!formData.bankName.trim()) errs.bankName = "Bank name is required";
//       if (!formData.accountNumber.trim())
//         errs.accountNumber = "Account number is required";
//       if (!formData.confirmAccountNumber.trim())
//         errs.confirmAccountNumber = "Please confirm account number";
//       else if (formData.accountNumber !== formData.confirmAccountNumber)
//         errs.confirmAccountNumber = "Account numbers do not match";
//       const idErr = validateBankIdentifier(
//         formData.swiftBic,
//         bankIdConfig.lookup,
//       );
//       if (idErr) errs.swiftBic = idErr;
//     }

//     if (formData.deliveryChannel === "MOBILE_MONEY") {
//       if (!formData.mobileMoneyProvider.trim())
//         errs.mobileMoneyProvider = "Provider is required";
//       if (!localMobileNumber.trim())
//         errs.mobileNumber = "Mobile number is required";
//       else {
//         const digits = localMobileNumber.replace(/\D/g, "");
//         if (digits.length < 7 || digits.length > 15)
//           errs.mobileNumber = "Enter a valid mobile number (7–15 digits)";
//       }
//     }

//     setErrors(errs);
//     return Object.keys(errs).length === 0;
//   }

//   async function handleSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     if (!validate()) return;

//     try {
//       setIsSaving(true);
//       setSaveError("");

//       const payload: Record<string, unknown> = {
//         deliveryChannel: formData.deliveryChannel,
//         firstName: formData.firstName.trim(),
//         lastName: formData.lastName.trim(),
//       };

//       payload.country = formData.country.trim();
//       payload.payoutCurrency = formData.payoutCurrency.trim();

//       if (formData.deliveryChannel === "BANK_TRANSFER") {
//         payload.bankName = formData.bankName.trim();
//         payload.branchName = formData.branchName.trim() || undefined;
//         payload.accountNumber = formData.confirmAccountNumber.trim();
//         payload.swiftBic = formData.swiftBic.trim();
//       } else if (formData.deliveryChannel === "MOBILE_MONEY") {
//         payload.mobileMoneyProvider = formData.mobileMoneyProvider.trim();
//         const dial = selectedDestinationCountry
//           ? dialCodeFromCouCode(selectedDestinationCountry.couCode)
//           : undefined;
//         const digits = localMobileNumber.replace(/\D/g, "");
//         payload.mobileNumber =
//           dial && digits ? `+${dial}${digits}` : digits || localMobileNumber;
//       }

//       if (editBeneficiaryId) {
//         const res = await api.patch<{
//           success: boolean;
//           data: { beneficiary: CreatedBeneficiaryPayload };
//         }>(`/beneficiaries/${editBeneficiaryId}`, payload);
//         const updated = res.data.data.beneficiary;
//         await onSuccess?.(updated);
//       } else {
//         const res = await api.post<{
//           success: boolean;
//           data: { beneficiary: CreatedBeneficiaryPayload };
//         }>("/beneficiaries", payload);
//         const created = res.data.data.beneficiary;
//         await onSuccess?.(created);
//       }
//       onClose();
//     } catch (error: any) {
//       const msg =
//         error.response?.data?.message ||
//         (editBeneficiaryId
//           ? "Failed to update beneficiary"
//           : "Failed to add beneficiary");
//       if (onSubmitError) {
//         onSubmitError(msg);
//       } else {
//         setSaveError(msg);
//       }
//     } finally {
//       setIsSaving(false);
//     }
//   }

//   if (!open) return null;

//   const showForm = !editBeneficiaryId || (!editLoading && !editLoadError);

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
//       <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
//         {isSaving && (
//           <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-[2px]">
//             <Loader
//               variant="centered"
//               size="xl"
//               label={isEditMode ? "Saving changes…" : "Adding beneficiary…"}
//               sublabel="Please wait."
//             />
//           </div>
//         )}
//         {/* Header */}
//         <div className="flex items-center justify-between p-5 border-b border-slate-200">
//           <h2 className="text-lg font-semibold text-slate-900">
//             {isEditMode ? "Edit beneficiary" : "Add New Beneficiary"}
//           </h2>
//           <button
//             type="button"
//             onClick={onClose}
//             disabled={isSaving}
//             className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
//           >
//             <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
//               <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
//             </svg>
//           </button>
//         </div>

//         {editBeneficiaryId && editLoading && (
//           <Loader
//             variant="centered"
//             className="py-20"
//             size="xl"
//             label="Loading beneficiary…"
//           />
//         )}

//         {editBeneficiaryId && editLoadError && (
//           <div className="p-8 text-center space-y-4">
//             <p className="text-sm text-red-600">{editLoadError}</p>
//             <button
//               type="button"
//               onClick={onClose}
//               className="h-10 px-5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
//             >
//               Close
//             </button>
//           </div>
//         )}

//         {/* Form */}
//         {showForm && (
//           <form onSubmit={handleSubmit} className="p-5 space-y-4">
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//               <div>
//                 <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                   Destination Country <span className="text-red-500">*</span>
//                 </label>
//                 {countryLocked ? (
//                   <>
//                     <div className="flex items-center gap-2 w-full border border-slate-200 rounded-lg px-3 h-10 text-sm bg-slate-50 text-slate-800">
//                       {selectedDestinationCountry ? (
//                         <>
//                           <FlexCountryFlag
//                             couCode={selectedDestinationCountry.couCode}
//                           />
//                           <span className="font-medium">
//                             {selectedDestinationCountry.couName}
//                           </span>
//                         </>
//                       ) : (
//                         <span className="font-medium">
//                           {formData.country ||
//                             lockCountry?.couName?.trim() ||
//                             "—"}
//                         </span>
//                       )}
//                       <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-slate-400 shrink-0">
//                         From transfer
//                       </span>
//                     </div>
//                     <p className="mt-1 text-xs text-slate-500">
//                       Country matches the recipient you selected for this
//                       transfer.
//                     </p>
//                   </>
//                 ) : (
//                   <CatalogCountrySelect
//                     value={formData.country}
//                     onChange={applyDestinationCountryChange}
//                     error={Boolean(errors.country)}
//                     placeholder="Select destination country…"
//                     countries={catalogCountryList}
//                     countriesLoading={catalogCountriesLoading}
//                     countriesError={catalogCountriesError}
//                   />
//                 )}
//                 {errors.country && (
//                   <p className="mt-1 text-xs text-red-500">{errors.country}</p>
//                 )}
//               </div>

//               <div>
//                 <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                   Payout Currency <span className="text-red-500">*</span>
//                 </label>
//                 <div className="relative" data-payout-dropdown>
//                   <button
//                     type="button"
//                     disabled={!formData.country}
//                     onClick={() => setPayoutCurrencyOpen((v) => !v)}
//                     className={`flex items-center gap-2 w-full border rounded-lg px-3 h-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
//                       errors.payoutCurrency
//                         ? "border-red-400"
//                         : "border-slate-200"
//                     } ${!formData.country ? "bg-slate-50 cursor-not-allowed opacity-50" : "bg-white"}`}
//                   >
//                     {formData.payoutCurrency ? (
//                       <>
//                         <Flag
//                           code={payCurrencyFlagCode(formData.payoutCurrency)}
//                           className="w-5 h-3.5 rounded object-cover shrink-0"
//                         />
//                         <span className="text-slate-900 truncate">
//                           {formData.payoutCurrency}
//                         </span>
//                       </>
//                     ) : (
//                       <span className="text-slate-400">
//                         {!formData.country
//                           ? "Select country first"
//                           : "Select currency"}
//                       </span>
//                     )}
//                     <svg
//                       className="ml-auto w-4 h-4 text-slate-400 shrink-0"
//                       viewBox="0 0 20 20"
//                       fill="currentColor"
//                     >
//                       <path
//                         fillRule="evenodd"
//                         d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
//                         clipRule="evenodd"
//                       />
//                     </svg>
//                   </button>

//                   {payoutCurrencyOpen && payoutCurrencyOptions.length > 0 && (
//                     <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
//                       <ul className="max-h-52 overflow-y-auto py-1">
//                         {payoutCurrencyOptions.map((cur) => (
//                           <li key={cur}>
//                             <button
//                               type="button"
//                               onClick={() => {
//                                 handleChange("payoutCurrency", cur);
//                                 setPayoutCurrencyOpen(false);
//                               }}
//                               className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-red-50 hover:text-red-700 transition-colors ${
//                                 formData.payoutCurrency === cur
//                                   ? "bg-red-50 text-red-700 font-medium"
//                                   : "text-slate-700"
//                               }`}
//                             >
//                               <Flag
//                                 code={payCurrencyFlagCode(cur)}
//                                 className="w-5 h-3.5 rounded object-cover shrink-0"
//                               />
//                               <span className="truncate">{cur}</span>
//                               {formData.payoutCurrency === cur && (
//                                 <svg
//                                   className="ml-auto w-4 h-4 shrink-0 text-red-600"
//                                   viewBox="0 0 20 20"
//                                   fill="currentColor"
//                                 >
//                                   <path
//                                     fillRule="evenodd"
//                                     d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
//                                     clipRule="evenodd"
//                                   />
//                                 </svg>
//                               )}
//                             </button>
//                           </li>
//                         ))}
//                       </ul>
//                     </div>
//                   )}
//                 </div>
//                 {errors.payoutCurrency && (
//                   <p className="mt-1 text-xs text-red-500">
//                     {errors.payoutCurrency}
//                   </p>
//                 )}
//               </div>
//             </div>

//             {/* Delivery Channel */}
//             <div>
//               <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                 Delivery Channel <span className="text-red-500">*</span>
//               </label>
//               <select
//                 value={formData.deliveryChannel}
//                 disabled={
//                   isEditMode ||
//                   !formData.country.trim() ||
//                   availableDeliveryChannels.length === 0
//                 }
//                 onChange={(e) =>
//                   applyDeliveryChannelChange(
//                     e.target.value as BeneficiaryDeliveryChannel,
//                   )
//                 }
//                 className="w-full border border-slate-200 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
//               >
//                 {!formData.country.trim() ? (
//                   <option value="BANK_TRANSFER">
//                     Select destination country first
//                   </option>
//                 ) : (
//                   availableDeliveryChannels.map((ch) => (
//                     <option key={ch} value={ch}>
//                       {getDeliveryChannelLabel(ch)}
//                     </option>
//                   ))
//                 )}
//               </select>
//               {!formData.country.trim() ? (
//                 <p className="mt-1 text-xs text-slate-500">
//                   Choose a destination country to see available delivery
//                   channels.
//                 </p>
//               ) : null}
//               {isEditMode && (
//                 <p className="mt-1 text-xs text-slate-500">
//                   Delivery type cannot be changed. Add a new beneficiary to use
//                   a different channel.
//                 </p>
//               )}
//               {errors.deliveryChannel && (
//                 <p className="mt-1 text-xs text-red-500">
//                   {errors.deliveryChannel}
//                 </p>
//               )}
//             </div>

//             {/* First / last name (as per bank account) */}
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//               <div>
//                 <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                   First name (as per bank account){" "}
//                   <span className="text-red-500">*</span>
//                 </label>
//                 <input
//                   type="text"
//                   placeholder="First name"
//                   autoComplete="given-name"
//                   value={formData.firstName}
//                   onChange={(e) => handleChange("firstName", e.target.value)}
//                   className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
//                     errors.firstName ? "border-red-400" : "border-slate-200"
//                   }`}
//                 />
//                 {errors.firstName && (
//                   <p className="mt-1 text-xs text-red-500">
//                     {errors.firstName}
//                   </p>
//                 )}
//               </div>
//               <div>
//                 <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                   Last name (as per bank account){" "}
//                   <span className="text-red-500">*</span>
//                 </label>
//                 <input
//                   type="text"
//                   placeholder="Last name"
//                   autoComplete="family-name"
//                   value={formData.lastName}
//                   onChange={(e) => handleChange("lastName", e.target.value)}
//                   className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
//                     errors.lastName ? "border-red-400" : "border-slate-200"
//                   }`}
//                 />
//                 {errors.lastName && (
//                   <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>
//                 )}
//               </div>
//             </div>

//             {/* Bank Transfer Fields */}
//             {formData.deliveryChannel === "BANK_TRANSFER" && (
//               <>
//                 {bankIdConfig.showIdentifierBeforeBankDetails && (
//                   <div>
//                     <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                       {bankIdConfig.fieldLabel}{" "}
//                       <span className="text-red-500">*</span>
//                     </label>
//                     <input
//                       type="text"
//                       autoComplete="off"
//                       placeholder={bankIdConfig.placeholder}
//                       value={formData.swiftBic}
//                       onChange={(e) => {
//                         const raw = e.target.value;
//                         const v =
//                           bankIdConfig.lookup === "ifsc"
//                             ? normalizeIfsc(raw)
//                             : bankIdConfig.lookup === "aba"
//                               ? normalizeAba(raw)
//                               : raw;
//                         handleChange("swiftBic", v);
//                       }}
//                       className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
//                         errors.swiftBic ? "border-red-400" : "border-slate-200"
//                       }`}
//                     />
//                     <p className="mt-1 text-xs text-slate-500">
//                       {bankIdConfig.hint}
//                     </p>
//                     {bankIdLookupStatus === "loading" && (
//                       <p className="mt-1 text-xs text-red-600">
//                         Looking up bank details…
//                       </p>
//                     )}
//                     {bankIdLookupStatus === "ok" && (
//                       <p className="mt-1 text-xs text-red-700">
//                         Bank and branch were filled automatically. you can edit
//                         them below if needed.
//                       </p>
//                     )}
//                     {bankIdLookupStatus === "not_found" && (
//                       <p className="mt-1 text-xs text-amber-700">
//                         Code not found. Check it, or enter bank and branch
//                         manually.
//                       </p>
//                     )}
//                     {bankIdLookupStatus === "error" && (
//                       <p className="mt-1 text-xs text-red-600">
//                         Lookup failed. Enter bank and branch manually.
//                       </p>
//                     )}
//                     {errors.swiftBic && (
//                       <p className="mt-1 text-xs text-red-500">
//                         {errors.swiftBic}
//                       </p>
//                     )}
//                   </div>
//                 )}

//                 <div>
//                   <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                     Bank name <span className="text-red-500">*</span>
//                   </label>
//                   <input
//                     type="text"
//                     // disabled={Boolean(
//                     //   useFlexBankListUi && !formData.country?.trim(),
//                     // )}
//                     // placeholder={
//                     //   useFlexBankListUi && !formData.country?.trim()
//                     //     ? "Select country first"
//                     //     : useFlexBankListUi &&
//                     //       formData.country?.trim() &&
//                     //       !banksLoading &&
//                     //       flexBanks.length === 0
//                     //       ? "Type bank name"
//                     //       : bankIdConfig.lookup === "ifsc"
//                     //         ? "Filled from IFSC or type manually"
//                     //         : bankIdConfig.lookup === "aba"
//                     //           ? "Filled from routing number or type manually"
//                     //           : "Bank name"
//                     // }
//                     placeholder="Bank name"
//                     value={formData.bankName}
//                     onChange={(e) => handleChange("bankName", e.target.value)}
//                     className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
//                       errors.bankName ? "border-red-400" : "border-slate-200"
//                     }`}
//                   />
//                   {/* {!showFlexBankDropdown ? (
//                     <input
//                       type="text"
//                       disabled={Boolean(
//                         useFlexBankListUi && !formData.country?.trim(),
//                       )}
//                       placeholder={
//                         useFlexBankListUi && !formData.country?.trim()
//                           ? "Select country first"
//                           : useFlexBankListUi &&
//                               formData.country?.trim() &&
//                               !banksLoading &&
//                               flexBanks.length === 0
//                             ? "Type bank name (no list available for this country)"
//                             : bankIdConfig.lookup === "ifsc"
//                               ? "Filled from IFSC or type manually"
//                               : bankIdConfig.lookup === "aba"
//                                 ? "Filled from routing number or type manually"
//                                 : "Bank name"
//                       }
//                       value={formData.bankName}
//                       onChange={(e) => handleChange("bankName", e.target.value)}
//                       className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
//                         errors.bankName ? "border-red-400" : "border-slate-200"
//                       }`}
//                     />
//                   ) : (
//                     <div className="relative" data-bank-dropdown>
//                       <button
//                         type="button"
//                         disabled={!formData.country || banksLoading}
//                         onClick={() => {
//                           if (!formData.country || banksLoading) return;
//                           setBankOpen((v) => !v);
//                           setBankSearch("");
//                         }}
//                         className={`flex items-center gap-2 w-full border rounded-lg px-3 h-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors bg-white disabled:opacity-50 disabled:cursor-not-allowed ${
//                           errors.bankName
//                             ? "border-red-400"
//                             : "border-slate-200"
//                         } ${formData.bankName ? "text-slate-900" : "text-slate-400"}`}
//                       >
//                         {banksLoading ? (
//                           <span>Loading banks…</span>
//                         ) : formData.bankName ? (
//                           <span className="truncate">{formData.bankName}</span>
//                         ) : (
//                           <span>Select bank…</span>
//                         )}
//                         <svg
//                           className="ml-auto w-4 h-4 text-slate-400 shrink-0"
//                           viewBox="0 0 20 20"
//                           fill="currentColor"
//                         >
//                           <path
//                             fillRule="evenodd"
//                             d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
//                             clipRule="evenodd"
//                           />
//                         </svg>
//                       </button>

//                       {bankOpen && flexBanks.length > 0 && (
//                         <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
//                           <div className="p-2 border-b border-slate-100">
//                             <input
//                               autoFocus
//                               placeholder="Search bank…"
//                               value={bankSearch}
//                               onChange={(e) => setBankSearch(e.target.value)}
//                               className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
//                             />
//                           </div>
//                           <ul className="max-h-52 overflow-y-auto py-1">
//                             {filteredFlexBanks.map((b, idx) => (
//                               <li key={`${b.bankCode}-${b.bankName}-${idx}`}>
//                                 <button
//                                   type="button"
//                                   onClick={() => {
//                                     handleChange("bankName", b.bankName);
//                                     setBankOpen(false);
//                                   }}
//                                   className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-red-50 hover:text-red-700 transition-colors ${
//                                     formData.bankName === b.bankName
//                                       ? "bg-red-50 text-red-700 font-medium"
//                                       : "text-slate-700"
//                                   }`}
//                                 >
//                                   <span className="truncate">{b.bankName}</span>
//                                   {formData.bankName === b.bankName && (
//                                     <svg
//                                       className="ml-auto w-4 h-4 shrink-0 text-red-600"
//                                       viewBox="0 0 20 20"
//                                       fill="currentColor"
//                                     >
//                                       <path
//                                         fillRule="evenodd"
//                                         d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
//                                         clipRule="evenodd"
//                                       />
//                                     </svg>
//                                   )}
//                                 </button>
//                               </li>
//                             ))}
//                             {filteredFlexBanks.length === 0 && (
//                               <li className="px-3 py-4 text-sm text-slate-400 text-center">
//                                 No banks match your search
//                               </li>
//                             )}
//                           </ul>
//                         </div>
//                       )}
//                     </div>
//                   )} */}
//                   {errors.bankName && (
//                     <p className="mt-1 text-xs text-red-500">
//                       {errors.bankName}
//                     </p>
//                   )}
//                 </div>

//                 <div>
//                   <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                     Branch name
//                   </label>
//                   <input
//                     type="text"
//                     placeholder="e.g. Main Street"
//                     value={formData.branchName}
//                     onChange={(e) => handleChange("branchName", e.target.value)}
//                     className="w-full border border-slate-200 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors"
//                   />
//                 </div>

//                 <div>
//                   <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                     Account Number / IBAN{" "}
//                     <span className="text-red-500">*</span>
//                   </label>
//                   <input
//                     type={isConfirmingAccount ? "password" : "text"}
//                     placeholder="0123456789"
//                     value={formData.accountNumber}
//                     onChange={(e) => {
//                       handleChange("accountNumber", e.target.value);
//                       // Inline validation if confirm field has value
//                       if (
//                         formData.confirmAccountNumber &&
//                         e.target.value !== formData.confirmAccountNumber
//                       ) {
//                         setErrors((prev) => ({
//                           ...prev,
//                           confirmAccountNumber: "Account numbers do not match",
//                         }));
//                       } else if (
//                         formData.confirmAccountNumber &&
//                         e.target.value === formData.confirmAccountNumber
//                       ) {
//                         setErrors((prev) => ({
//                           ...prev,
//                           confirmAccountNumber: undefined,
//                         }));
//                       }
//                     }}
//                     onFocus={() => setIsConfirmingAccount(false)}
//                     className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
//                       errors.accountNumber
//                         ? "border-red-400"
//                         : "border-slate-200"
//                     }`}
//                   />
//                   {errors.accountNumber && (
//                     <p className="mt-1 text-xs text-red-500">
//                       {errors.accountNumber}
//                     </p>
//                   )}
//                 </div>

//                 <div>
//                   <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                     Confirm Account Number / IBAN{" "}
//                     <span className="text-red-500">*</span>
//                   </label>
//                   <input
//                     type="text"
//                     placeholder="Re-enter account number"
//                     value={formData.confirmAccountNumber}
//                     onPaste={(e) => e.preventDefault()}
//                     onCopy={(e) => e.preventDefault()}
//                     onCut={(e) => e.preventDefault()}
//                     onChange={(e) => {
//                       handleChange("confirmAccountNumber", e.target.value);
//                       // Inline validation
//                       if (
//                         e.target.value &&
//                         formData.accountNumber !== e.target.value
//                       ) {
//                         setErrors((prev) => ({
//                           ...prev,
//                           confirmAccountNumber: "Account numbers do not match",
//                         }));
//                       } else {
//                         setErrors((prev) => ({
//                           ...prev,
//                           confirmAccountNumber: undefined,
//                         }));
//                       }
//                     }}
//                     onFocus={() => setIsConfirmingAccount(true)}
//                     onBlur={() => setIsConfirmingAccount(false)}
//                     className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
//                       errors.confirmAccountNumber
//                         ? "border-red-400"
//                         : "border-slate-200"
//                     }`}
//                   />
//                   {errors.confirmAccountNumber && (
//                     <p className="mt-1 text-xs text-red-500">
//                       {errors.confirmAccountNumber}
//                     </p>
//                   )}
//                 </div>

//                 {!bankIdConfig.showIdentifierBeforeBankDetails && (
//                   <div>
//                     <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                       {bankIdConfig.fieldLabel}{" "}
//                       <span className="text-red-500">*</span>
//                     </label>
//                     <input
//                       type="text"
//                       autoComplete="off"
//                       placeholder={bankIdConfig.placeholder}
//                       value={formData.swiftBic}
//                       onChange={(e) => {
//                         const raw = e.target.value;
//                         const v =
//                           bankIdConfig.lookup === "ifsc"
//                             ? normalizeIfsc(raw)
//                             : bankIdConfig.lookup === "aba"
//                               ? normalizeAba(raw)
//                               : raw;
//                         handleChange("swiftBic", v);
//                       }}
//                       className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
//                         errors.swiftBic ? "border-red-400" : "border-slate-200"
//                       }`}
//                     />
//                     <p className="mt-1 text-xs text-slate-500">
//                       {bankIdConfig.hint}
//                     </p>
//                     {errors.swiftBic && (
//                       <p className="mt-1 text-xs text-red-500">
//                         {errors.swiftBic}
//                       </p>
//                     )}
//                   </div>
//                 )}
//               </>
//             )}

//             {/* Mobile Money Fields */}
//             {formData.deliveryChannel === "MOBILE_MONEY" && (
//               <>
//                 <div>
//                   <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                     Mobile Money Provider{" "}
//                     <span className="text-red-500">*</span>
//                   </label>
//                   <select
//                     value={formData.mobileMoneyProvider}
//                     onChange={(e) =>
//                       handleChange("mobileMoneyProvider", e.target.value)
//                     }
//                     disabled={
//                       !formData.country ||
//                       availableMobileMoneyProviders.length === 0
//                     }
//                     className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-colors ${
//                       errors.mobileMoneyProvider
//                         ? "border-red-400"
//                         : "border-slate-200"
//                     } ${formData.mobileMoneyProvider ? "text-slate-900" : "text-slate-400"} ${!formData.country || availableMobileMoneyProviders.length === 0 ? "bg-slate-50 cursor-not-allowed" : ""}`}
//                   >
//                     <option value="">
//                       {!formData.country
//                         ? "Select country first"
//                         : availableMobileMoneyProviders.length === 0
//                           ? "No providers available for this country"
//                           : "Select provider"}
//                     </option>
//                     {availableMobileMoneyProviders.map((provider) => (
//                       <option key={provider} value={provider}>
//                         {provider}
//                       </option>
//                     ))}
//                   </select>
//                   {availableMobileMoneyProviders.length === 0 &&
//                     formData.country && (
//                       <p className="mt-1 text-xs text-amber-600">
//                         No mobile money providers configured for{" "}
//                         {formData.country}. Add providers in{" "}
//                         mobile-money-providers.json or use bank transfer.
//                       </p>
//                     )}
//                   {errors.mobileMoneyProvider && (
//                     <p className="mt-1 text-xs text-red-500">
//                       {errors.mobileMoneyProvider}
//                     </p>
//                   )}
//                 </div>

//                 <div>
//                   <label className="text-sm font-medium text-slate-700 block mb-1.5">
//                     Mobile Number <span className="text-red-500">*</span>
//                   </label>
//                   <div
//                     className={`flex items-center border rounded-lg overflow-visible transition-all focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-600 bg-white ${
//                       errors.mobileNumber
//                         ? "border-red-400 focus-within:ring-red-400/20 focus-within:border-red-400"
//                         : "border-slate-200"
//                     }`}
//                   >
//                     <div className="flex-shrink-0">
//                       <div className="flex items-center gap-1.5 px-3 h-10 text-sm bg-slate-100 border-r border-slate-200 rounded-l-lg">
//                         {formData.country && selectedDestinationCountry ? (
//                           <>
//                             <FlexCountryFlag
//                               couCode={selectedDestinationCountry.couCode}
//                             />
//                             {dialCodeFromCouCode(
//                               selectedDestinationCountry.couCode,
//                             ) ? (
//                               <span className="text-slate-700 font-medium">
//                                 +
//                                 {dialCodeFromCouCode(
//                                   selectedDestinationCountry.couCode,
//                                 )}
//                               </span>
//                             ) : (
//                               <span className="text-slate-500 text-xs">—</span>
//                             )}
//                           </>
//                         ) : (
//                           <span className="text-slate-400">Select country</span>
//                         )}
//                       </div>
//                     </div>

//                     <input
//                       type="tel"
//                       inputMode="numeric"
//                       placeholder={
//                         formData.country && selectedDestinationCountry
//                           ? "National mobile number (7–15 digits)"
//                           : "Select country first"
//                       }
//                       value={localMobileNumber}
//                       onChange={(e) => {
//                         if (!selectedDestinationCountry) return;
//                         const digits = e.target.value
//                           .replace(/\D/g, "")
//                           .slice(0, 15);
//                         setLocalMobileNumber(digits);
//                         setErrors((prev) => ({
//                           ...prev,
//                           mobileNumber: undefined,
//                         }));
//                       }}
//                       disabled={!formData.country}
//                       className="flex-1 h-10 px-3 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-900 disabled:cursor-not-allowed font-mono tracking-wide"
//                     />
//                   </div>
//                   {errors.mobileNumber && (
//                     <p className="mt-1 text-xs text-red-500">
//                       {errors.mobileNumber}
//                     </p>
//                   )}
//                 </div>
//               </>
//             )}

//             {formData.deliveryChannel === "PAYOUT_IN_PERSON" && (
//               <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
//                 The beneficiary will collect funds in person in{" "}
//                 {formData.country || "the selected country"}. No bank or mobile
//                 wallet details are required.
//               </div>
//             )}

//             {/* Error */}
//             {saveError && !onSubmitError && (
//               <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
//                 {saveError}
//               </div>
//             )}

//             {/* Actions */}
//             <div className="flex gap-3 pt-2">
//               <button
//                 type="button"
//                 onClick={onClose}
//                 disabled={isSaving}
//                 className="flex-1 h-10 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
//               >
//                 Cancel
//               </button>
//               <button
//                 type="submit"
//                 disabled={isSaving}
//                 className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
//               >
//                 {isSaving ? (
//                   <>
//                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
//                     {isEditMode ? "Saving…" : "Adding…"}
//                   </>
//                 ) : isEditMode ? (
//                   "Save changes"
//                 ) : (
//                   "Add Beneficiary"
//                 )}
//               </button>
//             </div>
//           </form>
//         )}
//       </div>
//     </div>
//   );
// }
// dsdsd;
