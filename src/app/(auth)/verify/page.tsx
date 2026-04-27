import { Suspense } from "react";
import VerifyContent from "./verify-content";

function VerifyLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <p className="text-slate-500 text-sm">Loading…</p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyLoading />}>
      <VerifyContent />
    </Suspense>
  );
}
