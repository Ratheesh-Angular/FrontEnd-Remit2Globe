import { Suspense } from "react";
import ForgotPasswordVerifyContent from "./forgot-password-verify-content";

function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <p className="text-slate-500 text-sm">Loading…</p>
    </div>
  );
}

export default function ForgotPasswordVerifyPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ForgotPasswordVerifyContent />
    </Suspense>
  );
}
