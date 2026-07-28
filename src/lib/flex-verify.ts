import { flexApiUrl } from "@/lib/flex-api";

const FLEX_SUCCESS_CODES = new Set(["0", "100"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isFoundFalse(value: unknown): boolean {
  const o = asRecord(value);
  if (!o) return false;
  const found = o.found;
  return found === false || found === "false";
}

function pickNameField(o: Record<string, unknown>): string | null {
  const candidates = [
    o.registeredName,
    o.accountName,
    o.accountHolderName,
    o.name,
    o.customerName,
    o.payload,
    o.message,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

export type FlexVerifyParseResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

/** Parse Flex MSISDN/account verify payload from backend `{ success, data }`. */
export function parseFlexVerifyName(data: unknown): FlexVerifyParseResult {
  const root = asRecord(data);
  if (!root) {
    return { ok: false, error: "Unexpected response" };
  }

  const flexBody = asRecord(root.data) ?? root;

  if (isFoundFalse(flexBody)) {
    const errorMsg =
      typeof flexBody.errorMsg === "string" && flexBody.errorMsg.trim()
        ? flexBody.errorMsg.trim()
        : "No registered name found for this number or account.";
    return { ok: false, error: errorMsg };
  }

  const errorCode =
    typeof flexBody.errorCode === "string"
      ? flexBody.errorCode.trim()
      : typeof flexBody.code === "string"
        ? flexBody.code.trim()
        : "";

  if (errorCode && !FLEX_SUCCESS_CODES.has(errorCode)) {
    const errorMsg =
      typeof flexBody.errorMsg === "string" && flexBody.errorMsg.trim()
        ? flexBody.errorMsg.trim()
        : typeof flexBody.message === "string" && flexBody.message.trim()
          ? flexBody.message.trim()
          : "Verification failed.";
    return { ok: false, error: errorMsg };
  }

  const nested = asRecord(flexBody.data);
  const name =
    pickNameField(flexBody) ??
    (nested ? pickNameField(nested) : null) ??
    (typeof flexBody.payload === "string" &&
    flexBody.payload.trim() &&
    !/^\d+$/.test(flexBody.payload.trim())
      ? flexBody.payload.trim()
      : null);

  if (name) {
    return { ok: true, name };
  }

  return { ok: false, error: "No registered name returned." };
}

export function buildMsisdnPayload(
  dialCode: string | null | undefined,
  localDigits: string,
): string {
  const national = localDigits.replace(/\D/g, "");
  const dial = String(dialCode ?? "").replace(/\D/g, "");
  return `${dial}${national}`.replace(/\D/g, "");
}

export async function fetchFlexMsisdnVerify(
  msisdn: string,
  signal?: AbortSignal,
): Promise<FlexVerifyParseResult> {
  try {
    const res = await fetch(flexApiUrl("/msisdn-verify"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: msisdn }),
      signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      const error =
        (typeof json?.error === "string" && json.error) ||
        "Could not verify mobile number.";
      return { ok: false, error };
    }
    return parseFlexVerifyName(json);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    return { ok: false, error: "Network error while verifying mobile number." };
  }
}

export async function fetchFlexAccountVerify(
  input: { payload: string; bankCode: string; couCode: string },
  signal?: AbortSignal,
): Promise<FlexVerifyParseResult> {
  try {
    const res = await fetch(flexApiUrl("/account-verify"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: input.payload.trim(),
        bankCode: input.bankCode.trim(),
        couCode: input.couCode.trim().toUpperCase(),
      }),
      signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      const error =
        (typeof json?.error === "string" && json.error) ||
        "Could not verify account number.";
      return { ok: false, error };
    }
    return parseFlexVerifyName(json);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    return { ok: false, error: "Network error while verifying account." };
  }
}
