"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { TrashIcon, Users } from "lucide-react";
type DeliveryChannel = "BANK_TRANSFER" | "MOBILE_MONEY";

interface Beneficiary {
  id: string;
  fullName: string;
  deliveryChannel: DeliveryChannel;
  // Bank Transfer
  country?: string;
  bankName?: string;
  accountNumber?: string;
  swiftBic?: string;
  // Mobile Money
  mobileMoneyProvider?: string;
  mobileNumber?: string;
  createdAt: string;
}

interface FormData {
  deliveryChannel: DeliveryChannel;
  fullName: string;
  // Bank Transfer
  country: string;
  bankName: string;
  accountNumber: string;
  swiftBic: string;
  // Mobile Money
  mobileMoneyProvider: string;
  mobileNumber: string;
}

const emptyForm: FormData = {
  deliveryChannel: "BANK_TRANSFER",
  fullName: "",
  country: "",
  bankName: "",
  accountNumber: "",
  swiftBic: "",
  mobileMoneyProvider: "",
  mobileNumber: "",
};

export default function BeneficiariesPage() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    loadBeneficiaries();
  }, []);

  async function loadBeneficiaries() {
    try {
      setIsLoading(true);
      const res = await api.get("/beneficiaries");
      setBeneficiaries(res.data.data.beneficiaries);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  function openModal() {
    setFormData(emptyForm);
    setErrors({});
    setSaveError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  function handleChange(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSaveError("");
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {};

    if (!formData.fullName.trim()) errs.fullName = "Full name is required";

    if (formData.deliveryChannel === "BANK_TRANSFER") {
      if (!formData.country.trim()) errs.country = "Country is required";
      if (!formData.bankName.trim()) errs.bankName = "Bank name is required";
      if (!formData.accountNumber.trim())
        errs.accountNumber = "Account number is required";
      if (!formData.swiftBic.trim())
        errs.swiftBic = "SWIFT/BIC code is required";
    }

    if (formData.deliveryChannel === "MOBILE_MONEY") {
      if (!formData.mobileMoneyProvider.trim())
        errs.mobileMoneyProvider = "Provider is required";
      if (!formData.mobileNumber.trim())
        errs.mobileNumber = "Mobile number is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSaving(true);
      setSaveError("");

      const payload: any = {
        deliveryChannel: formData.deliveryChannel,
        fullName: formData.fullName.trim(),
      };

      if (formData.deliveryChannel === "BANK_TRANSFER") {
        payload.country = formData.country.trim();
        payload.bankName = formData.bankName.trim();
        payload.accountNumber = formData.accountNumber.trim();
        payload.swiftBic = formData.swiftBic.trim();
      } else {
        payload.mobileMoneyProvider = formData.mobileMoneyProvider.trim();
        payload.mobileNumber = formData.mobileNumber.trim();
      }

      await api.post("/beneficiaries", payload);
      await loadBeneficiaries();
      closeModal();
    } catch (error: any) {
      setSaveError(
        error.response?.data?.message || "Failed to add beneficiary",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this beneficiary?")) return;
    try {
      await api.delete(`/beneficiaries/${id}`);
      await loadBeneficiaries();
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to delete beneficiary");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Beneficiaries
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your recipients for quick transfers
          </p>
        </div>
        <button
          onClick={openModal}
          className="h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Beneficiary
        </button>
      </div>

      {/* List */}
      {beneficiaries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center text-2xl text-slate-400 mb-4">
            <Users className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            No beneficiaries yet
          </h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Add beneficiaries to send money quickly
          </p>
          <button
            onClick={openModal}
            className="inline-flex items-center justify-center h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Add Your First Beneficiary
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {beneficiaries.map((b) => (
            <div
              key={b.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {b.fullName}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        b.deliveryChannel === "BANK_TRANSFER"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-purple-50 text-purple-700"
                      }`}
                    >
                      {b.deliveryChannel === "BANK_TRANSFER"
                        ? "Bank Transfer"
                        : "Mobile Money"}
                    </span>
                  </div>

                  {b.deliveryChannel === "BANK_TRANSFER" && (
                    <div className="space-y-1 text-xs text-slate-600">
                      <p className="flex items-center gap-1 mb-2">
                        <span className="text-slate-400">Country:</span>{" "}
                        {b.country}
                      </p>
                      <p className="mb-2">
                        <span className="text-slate-400">Bank:</span>{" "}
                        {b.bankName}
                      </p>
                      <p className="mb-2">
                        <span className="text-slate-400">Account:</span>{" "}
                        {b.accountNumber}
                      </p>
                      <p className="mb-2">
                        <span className="text-slate-400">SWIFT/BIC:</span>{" "}
                        {b.swiftBic}
                      </p>
                    </div>
                  )}

                  {b.deliveryChannel === "MOBILE_MONEY" && (
                    <div className="space-y-1 text-xs text-slate-600">
                      <p>
                        <span className="text-slate-400">Provider:</span>{" "}
                        {b.mobileMoneyProvider}
                      </p>
                      <p>
                        <span className="text-slate-400">Number:</span>{" "}
                        {b.mobileNumber}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(b.id)}
                  className="shrink-0 text-slate-400 hover:text-red-600 transition-colors"
                  title="Remove beneficiary"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Add New Beneficiary
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Delivery Channel */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Delivery Channel <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.deliveryChannel}
                  onChange={(e) =>
                    handleChange(
                      "deliveryChannel",
                      e.target.value as DeliveryChannel,
                    )
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                </select>
              </div>

              {/* Full Name */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Beneficiary Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
                    errors.fullName ? "border-red-400" : "border-slate-200"
                  }`}
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>
                )}
              </div>

              {/* Bank Transfer Fields */}
              {formData.deliveryChannel === "BANK_TRANSFER" && (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Country <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Kenya"
                      value={formData.country}
                      onChange={(e) => handleChange("country", e.target.value)}
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
                        errors.country ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                    {errors.country && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.country}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Equity Bank"
                      value={formData.bankName}
                      onChange={(e) => handleChange("bankName", e.target.value)}
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
                        errors.bankName ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                    {errors.bankName && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.bankName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Account Number / IBAN{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="0123456789"
                      value={formData.accountNumber}
                      onChange={(e) =>
                        handleChange("accountNumber", e.target.value)
                      }
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
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
                      SWIFT/BIC / Routing / Transit Number{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="EQBLKENA"
                      value={formData.swiftBic}
                      onChange={(e) => handleChange("swiftBic", e.target.value)}
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
                        errors.swiftBic ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                    {errors.swiftBic && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.swiftBic}
                      </p>
                    )}
                  </div>
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
                    <input
                      type="text"
                      placeholder="M-Pesa, MTN, etc."
                      value={formData.mobileMoneyProvider}
                      onChange={(e) =>
                        handleChange("mobileMoneyProvider", e.target.value)
                      }
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
                        errors.mobileMoneyProvider
                          ? "border-red-400"
                          : "border-slate-200"
                      }`}
                    />
                    {errors.mobileMoneyProvider && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.mobileMoneyProvider}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="+254712345678"
                      value={formData.mobileNumber}
                      onChange={(e) =>
                        handleChange("mobileNumber", e.target.value)
                      }
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
                        errors.mobileNumber
                          ? "border-red-400"
                          : "border-slate-200"
                      }`}
                    />
                    {errors.mobileNumber && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.mobileNumber}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Error */}
              {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {saveError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="flex-1 h-10 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Beneficiary"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
