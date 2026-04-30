"use client";

import { useRouter } from "next/navigation";

type Props = {
  submittedAt: Date;
  /** Extra compliance copy for business onboarding */
  variant?: "individual" | "business";
};

function TimelineStep({
  number,
  label,
  description,
  done,
  active,
  isLast,
}: {
  number: number;
  label: string;
  description: string;
  done?: boolean;
  active?: boolean;
  isLast?: boolean;
}) {
  return (
    <li className="relative flex gap-4">
      {!isLast && (
        <span
          className="absolute left-[15px] top-8 h-[calc(100%+0.5rem)] w-px bg-slate-200"
          aria-hidden
        />
      )}
      <div
        className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          done
            ? "bg-teal-600 text-white"
            : active
              ? "border-2 border-teal-600 bg-teal-50 text-teal-800"
              : "bg-slate-100 text-slate-400"
        }`}
      >
        {done ? (
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          number
        )}
      </div>
      <div className="min-w-0 flex-1 pb-8 pt-0.5">
        <p
          className={`text-sm font-medium ${
            done || active ? "text-slate-900" : "text-slate-400"
          }`}
        >
          {label}
        </p>
        <p
          className={`mt-0.5 text-xs ${
            done || active ? "text-slate-500" : "text-slate-400"
          }`}
        >
          {description}
        </p>
      </div>
    </li>
  );
}

export function KycSubmittedPanel({
  submittedAt,
  variant = "individual",
}: Props) {
  const router = useRouter();

  return (
    <div className="space-y-8 py-1 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-teal-50">
        <svg
          className="h-10 w-10 text-teal-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>

      <div>
        <h3 className="text-xl font-semibold text-slate-900">
          Application Submitted Successfully
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">
          Your KYC application has been submitted. Our compliance team will
          review your documents within 24 hours.
          {variant === "business" ? (
            <>
              {" "}
              Automated and manual checks may include AML, sanctions screening,
              and business authenticity validation before approval or rejection.
            </>
          ) : null}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-left">
        <h4 className="mb-4 text-sm font-semibold text-slate-900">
          Verification Progress
        </h4>
        <ol className="space-y-0">
          <TimelineStep
            number={1}
            label="Application Submitted"
            description="Your documents have been uploaded"
            done
          />
          <TimelineStep
            number={2}
            label="Documents Under Review"
            description="Our team is verifying your identity"
            active
          />
          <TimelineStep
            number={3}
            label={
              variant === "business"
                ? "Compliance review"
                : "Identity Verification"
            }
            description={
              variant === "business"
                ? "AML, PEP/sanctions and business checks"
                : "Final compliance checks"
            }
          />
          <TimelineStep
            number={4}
            label="Account Activation"
            description="Ready to send money"
            isLast
          />
        </ol>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-left">
        <div className="flex gap-3">
          <svg
            className="mt-0.5 h-5 w-5 shrink-0 text-blue-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">
              What happens next?
            </p>
            <p className="mt-1 text-sm text-blue-700">
              You will receive an email notification once your application has
              been reviewed. You can check your application status anytime from
              your dashboard.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-teal-600 px-6 text-sm font-medium text-white transition-colors hover:bg-teal-700"
      >
        Back to Dashboard
      </button>

      <p className="text-xs text-slate-400">
        Submitted on{" "}
        {submittedAt.toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}
