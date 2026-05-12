"use client";

import { useState, useEffect, useCallback } from "react";
import { sessionApi as api } from "@/lib/api";
import {
  beneficiaryInitials,
  formatBeneficiaryName,
  maskAccountLast4,
  maskPhoneLast4,
} from "@/lib/beneficiaryDisplay";
import { AddBeneficiaryModal } from "@/components/beneficiaries/AddBeneficiaryModal";
import { BeneficiaryActiveToggle } from "@/components/beneficiaries/BeneficiaryActiveToggle";
import { ViewBeneficiaryModal } from "@/components/beneficiaries/ViewBeneficiaryModal";
import { AppDialog } from "@/components/ui/AppDialog";
import type { AppDialogProps } from "@/components/ui/AppDialog";
import { Loader } from "@/components/ui/Loader";
import {
  userFacingApiErrorMessage,
  userFacingApiMessageText,
} from "@/lib/user-facing-api-error";
import Link from "next/link";
import { Eye, Pencil, Plus, SendHorizontal, Trash2, Users } from "lucide-react";

type DeliveryChannel = "BANK_TRANSFER" | "MOBILE_MONEY";

interface Beneficiary {
  id: string;
  firstName: string;
  lastName: string;
  deliveryChannel: DeliveryChannel;
  country?: string;
  bankName?: string;
  branchName?: string | null;
  accountNumber?: string;
  swiftBic?: string;
  mobileMoneyProvider?: string;
  mobileNumber?: string;
  createdAt: string;
  /** false = hidden from Send money picker */
  active?: boolean;
}

type DialogFields = Pick<
  AppDialogProps,
  | "variant"
  | "title"
  | "message"
  | "destructive"
  | "confirmLabel"
  | "cancelLabel"
  | "onConfirm"
>;

const LIST_FAIL_FALLBACK =
  "Could not load beneficiaries. Please try again in a moment.";

export default function BeneficiariesPage() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const [dialog, setDialog] = useState<DialogFields | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [listLoadError, setListLoadError] = useState<string | null>(null);

  const formModalOpen = showAddModal || editId !== null;

  const closeDialog = useCallback(() => {
    if (!dialogLoading) setDialog(null);
  }, [dialogLoading]);

  const loadBeneficiaries = useCallback(async (opts?: { quiet?: boolean }) => {
    const quiet = opts?.quiet ?? false;
    try {
      if (quiet) setListRefreshing(true);
      else setIsLoading(true);
      const res = await api.get("/beneficiaries");
      setBeneficiaries(res.data.data.beneficiaries);
      setListLoadError(null);
    } catch (e) {
      console.error(e);
      if (!quiet) {
        setListLoadError(userFacingApiErrorMessage(e, LIST_FAIL_FALLBACK));
      }
    } finally {
      if (quiet) setListRefreshing(false);
      else setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBeneficiaries();
  }, [loadBeneficiaries]);

  function openDeleteConfirm(id: string, name: string) {
    setDialog({
      variant: "confirm",
      title: "Remove beneficiary?",
      message: `${name} will be removed from your list. This cannot be undone.`,
      destructive: true,
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setDialogLoading(true);
        try {
          await api.delete(`/beneficiaries/${id}`);
          setDialog(null);
          await loadBeneficiaries({ quiet: true });
          setDialog({
            variant: "success",
            title: "Beneficiary removed",
            message: "Your list has been updated.",
          });
        } catch (error: unknown) {
          setDialog({
            variant: "error",
            title: "Could not remove beneficiary",
            message: userFacingApiErrorMessage(error, "Please try again."),
          });
        } finally {
          setDialogLoading(false);
        }
      },
    });
  }

  function handleFormSuccess(isEdit: boolean) {
    void loadBeneficiaries({ quiet: true });
    setDialog({
      variant: "success",
      title: isEdit ? "Beneficiary updated" : "Beneficiary added",
      message: isEdit
        ? "Their details have been saved."
        : "You can use them for sending money anytime.",
    });
  }

  if (isLoading) {
    return (
      <Loader
        variant="page"
        size="xl"
        label="Loading beneficiaries…"
        sublabel="Fetching your saved recipients."
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-10 relative">
      {listLoadError ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm text-amber-950">{listLoadError}</p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadBeneficiaries()}
              className="h-9 px-3 rounded-lg text-sm font-medium bg-amber-800 text-white hover:bg-amber-900 transition-colors"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setListLoadError(null)}
              className="h-9 px-3 rounded-lg text-sm font-medium text-amber-900 bg-amber-100 hover:bg-amber-200/80 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {listRefreshing && (
        <div className="absolute top-0 right-0 z-10">
          <Loader variant="inline" size="sm" label="Updating…" />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Beneficiaries
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            Recipients you send money to. View full details anytime or update
            their information.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditId(null);
            setShowAddModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl shadow-sm shadow-teal-600/20 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add beneficiary
        </button>
      </div>

      {beneficiaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-8 py-16 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            No beneficiaries yet
          </h3>
          <p className="text-sm text-slate-500 mt-1 mb-6 max-w-sm mx-auto">
            Save a recipient once — then sending is faster next time.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add your first beneficiary
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {beneficiaries.map((b) => {
            const isBank = b.deliveryChannel === "BANK_TRANSFER";
            const subtitle = isBank
              ? b.bankName?.trim() || "Bank account"
              : b.mobileMoneyProvider?.trim() || "Mobile wallet";
            const masked = isBank
              ? maskAccountLast4(b.accountNumber)
              : maskPhoneLast4(b.mobileNumber);
            const name = formatBeneficiaryName(b);

            const isActive = b.active !== false;

            return (
              <li key={b.id}>
                <div
                  className={`group rounded-2xl border bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-all ${
                    isActive
                      ? "border-slate-200 hover:border-slate-300"
                      : "border-slate-200/80 border-dashed opacity-95"
                  }`}
                >
                  <div className="flex gap-4">
                    <div
                      className="shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center text-sm font-semibold shadow-inner"
                      aria-hidden
                    >
                      {beneficiaryInitials(b)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-semibold text-slate-900 truncate">
                            {name}
                          </h3>
                          <p className="text-sm text-slate-600 mt-0.5 truncate">
                            {subtitle}
                          </p>
                          <p className="text-xs font-mono text-slate-500 mt-1.5 tracking-wide">
                            {masked}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] uppercase font-semibold tracking-wide px-2 py-1 rounded-md ${
                            isBank
                              ? "bg-sky-50 text-sky-800"
                              : "bg-violet-50 text-violet-800"
                          }`}
                        >
                          {isBank ? "Bank" : "Mobile"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-3 mt-4 pt-3 border-t border-slate-100 sm:flex-row sm:items-center sm:flex-wrap sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          {isActive ? (
                            <Link
                              href={`/send-money?beneficiaryId=${encodeURIComponent(b.id)}`}
                              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm shadow-teal-600/20"
                            >
                              <SendHorizontal className="w-3.5 h-3.5" />
                              Send money
                            </Link>
                          ) : (
                            <p className="text-xs text-slate-500 max-w-[14rem]">
                              You can’t send money to inactive recipients.. Turn
                              on <span className="font-medium">Active</span> to
                              use them.
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewId(b.id)}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                        </div>
                        <div className="flex items-center gap-2 sm:ml-auto">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 hidden sm:inline">
                            Status
                          </span>
                          <BeneficiaryActiveToggle
                            beneficiaryId={b.id}
                            active={isActive}
                            onChange={(next) => {
                              setBeneficiaries((prev) =>
                                prev.map((row) =>
                                  row.id === b.id
                                    ? { ...row, active: next }
                                    : row,
                                ),
                              );
                            }}
                            onError={(message) => {
                              setDialog({
                                variant: "error",
                                title: "Could not update status",
                                message: userFacingApiMessageText(
                                  message,
                                  "Please try again.",
                                ),
                              });
                            }}
                          />
                        </div>
                        {/* <button
                          type="button"
                          onClick={() => {
                            setShowAddModal(false);
                            setEditId(b.id);
                          }}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteConfirm(b.id, name)}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors ml-auto sm:ml-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button> */}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AddBeneficiaryModal
        open={formModalOpen}
        onClose={() => {
          setShowAddModal(false);
          setEditId(null);
        }}
        lockCountry={null}
        editBeneficiaryId={editId}
        onSuccess={async () => {
          handleFormSuccess(editId !== null);
        }}
        onSubmitError={(message) => {
          setDialog({
            variant: "error",
            title: editId
              ? "Could not save changes"
              : "Could not add beneficiary",
            message: userFacingApiMessageText(
              message,
              "Something went wrong. Please try again.",
            ),
          });
        }}
      />

      <ViewBeneficiaryModal
        open={viewId !== null}
        beneficiaryId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(id) => {
          setShowAddModal(false);
          setEditId(id);
        }}
        onDeleted={() => void loadBeneficiaries({ quiet: true })}
      />

      {dialog ? (
        <AppDialog
          open
          onClose={closeDialog}
          loading={dialogLoading}
          variant={dialog.variant}
          title={dialog.title}
          message={dialog.message}
          destructive={dialog.destructive}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          onConfirm={dialog.onConfirm}
        />
      ) : null}
    </div>
  );
}
