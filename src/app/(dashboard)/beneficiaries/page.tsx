"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { TrashIcon, Users } from "lucide-react";
import { AddBeneficiaryModal } from "@/components/beneficiaries/AddBeneficiaryModal";

type DeliveryChannel = "BANK_TRANSFER" | "MOBILE_MONEY";

interface Beneficiary {
  id: string;
  fullName: string;
  deliveryChannel: DeliveryChannel;
  country?: string;
  bankName?: string;
  accountNumber?: string;
  swiftBic?: string;
  mobileMoneyProvider?: string;
  mobileNumber?: string;
  createdAt: string;
}

export default function BeneficiariesPage() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    void loadBeneficiaries();
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
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this beneficiary?")) return;
    try {
      await api.delete(`/beneficiaries/${id}`);
      await loadBeneficiaries();
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? "Failed to delete beneficiary";
      alert(msg);
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
          type="button"
          onClick={openModal}
          className="h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Beneficiary
        </button>
      </div>

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
            type="button"
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
                  type="button"
                  onClick={() => void handleDelete(b.id)}
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

      <AddBeneficiaryModal
        open={showModal}
        onClose={closeModal}
        lockCountry={null}
        onSuccess={() => void loadBeneficiaries()}
      />
    </div>
  );
}
