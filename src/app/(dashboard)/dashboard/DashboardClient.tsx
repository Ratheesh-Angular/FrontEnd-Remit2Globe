"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Lock,
  AlertCircle,
  Clock,
  ChevronRight,
  Wallet,
  Users,
  Send,
  SendHorizontal,
  Star,
} from "lucide-react";
import { sessionApi as api } from "@/lib/api";
import type { RemittanceTransferRow } from "@/lib/transfer-receipt-from-transfer";
import { RemittanceTransfersTable } from "@/components/transactions/RemittanceTransfersTable";
import { ViewTransactionModal } from "@/components/transactions/ViewTransactionModal";
import { Loader } from "@/components/ui/Loader";
import {
  formatBeneficiaryName,
  beneficiaryInitials,
} from "@/lib/beneficiaryDisplay";
import { FlexCountryFlag } from "@/components/country/FlexCountryFlag";
import { matchFlexCountryByLabel } from "@/lib/catalog-countries";
import { useCatalogCountries } from "@/hooks/useCatalogCountries";
import {
  getDeliveryChannelLabel,
  type BeneficiaryDeliveryChannel,
} from "@/lib/beneficiary-delivery-channels";
import { resolveFlexExchangeRate } from "@/lib/flex-forex-rate";
import {
  CURRENCY_TO_FLAG_ALPHA2,
  fmtFxRate,
  payCurrencyFlagCode,
} from "@/lib/send-money-currencies";
import countriesIso from "i18n-iso-countries";
import Flag from "react-world-flags";

interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: string;
  kycStatus?: string;
  createdAt?: string;
}

type Lookups = {
  sourceOfIncome: { value: string; label: string }[];
  transferPurpose: { value: string; label: string }[];
  relationship: { value: string; label: string }[];
};

/** Last transfers on dashboard + view modal — same UX as Transactions page table. */
function DashboardTransactionHistory() {
  const [rows, setRows] = useState<RemittanceTransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const loadTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{
        data: { transfers: RemittanceTransferRow[] };
      }>("/remittance/transfers", { params: { limit: "5" } });
      setRows(res.data.data.transfers);
    } catch (e) {
      console.error("Dashboard: could not load transactions", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTransfers();
  }, [loadTransfers]);

  useEffect(() => {
    let c = false;
    void api
      .get<{
        data: {
          sourceOfIncome: Lookups["sourceOfIncome"];
          transferPurpose: Lookups["transferPurpose"];
          relationship: Lookups["relationship"];
        };
      }>("/remittance/lookups")
      .then((res) => {
        if (c) return;
        setLookups({
          sourceOfIncome: res.data.data.sourceOfIncome,
          transferPurpose: res.data.data.transferPurpose,
          relationship: res.data.data.relationship,
        });
      })
      .catch(() => {
        if (!c) setLookups(null);
      });
    return () => {
      c = true;
    };
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex flex-row items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">
          Transaction history
        </h2>
        <Link
          href="/transactions"
          className="cursor-pointer shrink-0 inline-flex items-center gap-0.5 text-sm font-medium text-red-700 hover:text-red-800 transition-colors"
        >
          View all
          <ChevronRight className="w-4 h-4" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 flex justify-center">
          <Loader
            variant="inline"
            size="md"
            label="Loading recent transactions…"
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
          <p className="text-sm text-slate-600">
            No transfers yet.{" "}
            <Link
              href="/send-money"
              className="font-medium text-red-700 hover:text-red-800 underline-offset-2 hover:underline"
            >
              Send money
            </Link>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <RemittanceTransfersTable
          rows={rows}
          onViewTransfer={(id) => setViewId(id)}
        />
      )}

      <ViewTransactionModal
        open={viewId !== null}
        transferId={viewId}
        onClose={() => setViewId(null)}
        lookups={lookups}
        onTransferUpdated={() => void loadTransfers()}
      />
    </section>
  );
}

type FavouriteBeneficiary = {
  id: string;
  firstName: string;
  lastName: string;
  deliveryChannel: BeneficiaryDeliveryChannel;
  country?: string | null;
  bankName?: string | null;
  mobileMoneyProvider?: string | null;
  upiId?: string | null;
};

/** Fixed destination currencies for live rates (skip when equal to pay base). */
const DASHBOARD_RATE_DESTINATIONS = [
  "INR",
  "RWF",
  "TZS",
  "AED",
  "UGX",
  "KES",
] as const;

const CURRENCY_TO_COU3: Record<string, string> = {
  INR: "IND",
  RWF: "RWA",
  TZS: "TZA",
  AED: "ARE",
  UGX: "UGA",
  KES: "KEN",
};

function couCodeForCurrency(currency: string): string {
  const cur = currency.trim().toUpperCase();
  if (CURRENCY_TO_COU3[cur]) return CURRENCY_TO_COU3[cur];
  const a2 = CURRENCY_TO_FLAG_ALPHA2[cur];
  if (a2) {
    const a3 = countriesIso.alpha2ToAlpha3(a2);
    if (typeof a3 === "string") return a3;
  }
  return cur.slice(0, 3);
}

type LiveRateRow = {
  from: string;
  to: string;
  toCouCode: string;
  rate: number | null;
  error?: boolean;
};

function DashboardFavouriteBeneficiaries() {
  const { countries: catalogCountries } = useCatalogCountries(true);
  const [rows, setRows] = useState<FavouriteBeneficiary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const res = await api.get<{
          data: { beneficiaries: FavouriteBeneficiary[] };
        }>("/beneficiaries/favorites");
        if (!cancelled) setRows(res.data.data.beneficiaries ?? []);
      } catch (e) {
        console.error("Dashboard: could not load favourites", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          <Star
            className="w-3.5 h-3.5 text-amber-500 fill-amber-500"
            aria-hidden
          />
          Favourite beneficiaries
        </h2>
        <Link
          href="/beneficiaries"
          className="text-xs font-medium text-red-700 hover:text-red-800"
        >
          Manage
        </Link>
      </div>

      {loading ? (
        <div className="px-4 py-8 flex justify-center">
          <Loader variant="inline" size="sm" label="Loading…" />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-slate-600">
            No favourites yet. Star recipients on the beneficiaries page.
          </p>
          <Link
            href="/beneficiaries"
            className="inline-flex mt-3 text-sm font-medium text-red-700 hover:text-red-800"
          >
            Add new
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((b) => {
            const name = formatBeneficiaryName(b);
            const countryRow = b.country?.trim()
              ? matchFlexCountryByLabel(catalogCountries, b.country.trim())
              : undefined;
            const channelLabel =
              b.deliveryChannel === "BANK_TRANSFER"
                ? b.bankName?.trim() || "Bank"
                : b.deliveryChannel === "MOBILE_MONEY"
                  ? b.mobileMoneyProvider?.trim() || "Mobile"
                  : b.deliveryChannel === "UPI"
                    ? b.upiId?.trim() || "UPI"
                    : getDeliveryChannelLabel(b.deliveryChannel);
            const place = [b.country?.trim(), channelLabel]
              .filter(Boolean)
              .join(" · ");

            return (
              <li
                key={b.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80"
              >
                <div
                  className="shrink-0 w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center"
                  aria-hidden
                >
                  {countryRow ? (
                    <FlexCountryFlag
                      couCode={countryRow.couCode}
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: 9999,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-500">
                      {beneficiaryInitials(b)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{place}</p>
                </div>
                <Link
                  href={`/send-money?beneficiaryId=${encodeURIComponent(b.id)}`}
                  title="Send money"
                  aria-label={`Send money to ${name}`}
                  className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-700 transition-colors"
                >
                  <SendHorizontal className="w-3.5 h-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DashboardLiveExchangeRates() {
  const [baseCurrency, setBaseCurrency] = useState<string>("");
  const [rates, setRates] = useState<LiveRateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const ctxRes = await api.get<{
          data: { defaultPayCurrency?: string; payCurrencies?: string[] };
        }>("/remittance/context");
        const base = (
          ctxRes.data.data.defaultPayCurrency ||
          ctxRes.data.data.payCurrencies?.[0] ||
          ""
        )
          .trim()
          .toUpperCase();
        if (cancelled) return;
        setBaseCurrency(base);

        if (!base) {
          setRates([]);
          return;
        }

        const dests = DASHBOARD_RATE_DESTINATIONS.filter((d) => d !== base);
        const settled = await Promise.allSettled(
          dests.map(async (to) => {
            const rate = await resolveFlexExchangeRate(base, to);
            return {
              from: base,
              to,
              toCouCode: couCodeForCurrency(to),
              rate,
            } satisfies LiveRateRow;
          }),
        );

        if (cancelled) return;
        setRates(
          settled.map((result, i) => {
            const to = dests[i]!;
            if (result.status === "fulfilled") return result.value;
            return {
              from: base,
              to,
              toCouCode: couCodeForCurrency(to),
              rate: null,
              error: true,
            };
          }),
        );
      } catch (e) {
        console.error("Dashboard: could not load exchange rates", e);
        if (!cancelled) {
          setBaseCurrency("");
          setRates([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900">
          Live exchange rates
        </h2>
        {baseCurrency ? (
          <p className="text-xs text-slate-500 mt-0.5">
            Based on your pay currency ({baseCurrency})
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="px-4 py-8 flex justify-center">
          <Loader variant="inline" size="sm" label="Loading rates…" />
        </div>
      ) : rates.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-slate-600">
            Exchange rates are unavailable right now.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rates.map((row) => {
            const flag = payCurrencyFlagCode(row.to).toLowerCase();
            const href = `/send-money?receiveCurrency=${encodeURIComponent(row.to)}&toCountry=${encodeURIComponent(row.toCouCode)}`;
            return (
              <li
                key={`${row.from}-${row.to}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80"
              >
                <span
                  className="shrink-0 w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center ring-1 ring-slate-200"
                  aria-hidden
                >
                  <Flag
                    code={flag}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {row.from} / {row.to}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.rate != null
                      ? fmtFxRate(row.rate)
                      : row.error
                        ? "Unavailable"
                        : "—"}
                  </p>
                </div>
                <Link
                  href={href}
                  title={`Send ${row.to}`}
                  aria-label={`Send money receiving ${row.to}`}
                  className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-700 transition-colors"
                >
                  <SendHorizontal className="w-3.5 h-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function DashboardClient({ user }: { user: User }) {
  const router = useRouter();

  const displayName = user?.name?.trim() || null;

  const isKycPending = user?.kycStatus === "PENDING";
  const isKycSubmitted = user?.kycStatus === "SUBMITTED";
  const isKycApproved = user?.kycStatus === "APPROVED";
  const isKycRejected = user?.kycStatus === "REJECTED";

  return (
    <div className="max-w-8xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Welcome back{displayName ? `, ${displayName}` : ""}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{user?.email ?? ""}</p>
      </div>

      {/* KYC Banner — PENDING */}
      {isKycPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-amber-800">
              Complete your verification to start sending money
            </h2>
            <p className="text-sm text-amber-700 mt-1">
              We need to verify your identity before you can make transfers. It
              only takes a few minutes.
            </p>
          </div>
          <button
            onClick={() => router.push("/onboarding/profile")}
            className="cursor-pointer shrink-0 inline-flex items-center justify-center h-10 px-5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Complete KYC <AlertCircle className="w-4 h-4 ml-2 font-bold" />
          </button>
        </div>
      )}

      {/* KYC Banner — SUBMITTED / under review */}
      {isKycSubmitted && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-blue-800">
              Your application is under review
            </h2>
            <p className="text-sm text-blue-700 mt-1">
              We are reviewing your documents. This usually takes few minutes.
              We will notify you once it is done.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center justify-center h-10 px-5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">
            In Review <Clock className="w-4 h-4 ml-2 font-bold" />
          </span>
        </div>
      )}

      {/* KYC Banner — REJECTED */}
      {isKycRejected && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-red-800">
              Verification unsuccessful
            </h2>
            <p className="text-sm text-red-700 mt-1">
              Your documents were not accepted. Please resubmit with valid
              documents.
            </p>
          </div>
          <button
            onClick={() => router.push("/onboarding/profile")}
            className="shrink-0 inline-flex items-center justify-center h-10 px-5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Resubmit KYC →
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ActionCard
          title="Wallet Balance"
          description="$ 0.00"
          locked={!isKycApproved}
          onClick={() => router.push("/wallet")}
          icon={<Wallet className="w-6 h-6" />}
        />
        <ActionCard
          title="Beneficiaries"
          description="Manage recipients"
          locked={!isKycApproved}
          onClick={() => router.push("/beneficiaries")}
          icon={<Users className="w-6 h-6" />}
        />
        <ActionCard
          title="Send Money"
          description="Transfer funds internationally"
          locked={!isKycApproved}
          onClick={() => router.push("/send-money")}
          icon={<Send className="w-6 h-6" />}
        />
        {/* <ActionCard
          title="Transactions"
          description="View your transfer history"
          locked={!isKycApproved}
          onClick={() => router.push("/transactions")}
        /> */}
      </div>

      {/* Transactions left; favourites + live rates right */}
      {isKycApproved ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 min-w-0">
            <DashboardTransactionHistory />
          </div>
          <div className="space-y-4 min-w-0">
            <DashboardFavouriteBeneficiaries />
            <DashboardLiveExchangeRates />
          </div>
        </div>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
          <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden />
          <p className="text-sm text-slate-600">
            Complete verification to view your transaction history here.
          </p>
          <button
            type="button"
            onClick={() => router.push("/onboarding/profile")}
            className="cursor-pointer mt-3 text-sm font-medium text-red-700 hover:text-red-800"
          >
            Go to onboarding
          </button>
        </section>
      )}
    </div>
  );
}

// ── Helper components ──

function ActionCard({
  title,
  description,
  locked,
  onClick,
  icon,
}: {
  title: string;
  description: string;
  locked: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <div
      onClick={() => !locked && onClick()}
      className={`
        bg-white border border-slate-200 rounded-xl p-5 transition-all
        ${
          locked
            ? "opacity-50 cursor-not-allowed"
            : "hover:border-red-300 hover:shadow-sm cursor-pointer"
        }
      `}
    >
      <div className="flex items-start align-center">
        <div>
          {icon && <div className="w-8 h-8 mr-1 text-red-500 pt-1">{icon}</div>}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>
        {locked ? (
          <span className="text-slate-300 text-base">
            <Lock className="w-5 h-5" />
          </span>
        ) : (
          <></>
        )}
      </div>
    </div>
  );
}
