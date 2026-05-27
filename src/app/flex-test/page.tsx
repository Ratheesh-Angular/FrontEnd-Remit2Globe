"use client";

import { useState } from "react";
import { flexApiUrl } from "@/lib/flex-api";

export default function FlexTestPage() {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [ifscCode, setIfscCode] = useState("");
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscResult, setIfscResult] = useState<any>(null);

  const callAPI = async (endpoint: string) => {
    try {
      setLoading(true);

      const res = await fetch(flexApiUrl(endpoint), { credentials: "include" });
      const data = await res.json();

      setResponse(data);
    } catch (err) {
      console.error(err);
      setResponse({ error: "Request failed" });
    } finally {
      setLoading(false);
    }
  };

  const getBanks = async (couCode: string) => {
    try {
      const res = await fetch(flexApiUrl(`/banks/${couCode}`), {
        credentials: "include",
      });
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      console.error(err);
      setResponse({ error: "Request failed" });
    }
  };

  const handleGetBanks = (couCode: string) => {
    if (couCode) {
      getBanks(couCode);
    }
  };

  const validateIfsc = async () => {
    const trimmed = ifscCode.trim().toUpperCase();
    if (!trimmed) {
      setIfscResult({
        success: false,
        error: "Enter an IFSC code",
      });
      return;
    }

    try {
      setIfscLoading(true);
      const res = await fetch(flexApiUrl("/ifsc-validate"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "IFSC", payload: trimmed }),
      });
      const data = await res.json().catch(() => ({ error: "Invalid JSON" }));
      setIfscResult({ httpStatus: res.status, ...data });
    } catch (err) {
      console.error(err);
      setIfscResult({ success: false, error: "Request failed" });
    } finally {
      setIfscLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Flex API Test Panel</h1>

      <div
        style={{
          marginBottom: "24px",
          padding: "16px",
          border: "1px solid #333",
          borderRadius: "8px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>IFSC validate (Flex)</h2>
        <p style={{ color: "#888", fontSize: "14px", marginTop: 0 }}>
          POSTs to our backend; server calls Flex{" "}
          <code style={{ color: "#0f0" }}>/ifscValidate</code> with{" "}
          <code style={{ color: "#0f0" }}>
            {`{ "type": "IFSC", "payload": "SBIN0001234" }`}
          </code>
          .
        </p>
        <p
          style={{
            color: "#888",
            fontSize: "14px",
            marginTop: "8px",
            marginBottom: 0,
          }}
        >
          If Flex returns{" "}
          <code style={{ color: "#fa0" }}>found: &quot;false&quot;</code> and{" "}
          <code style={{ color: "#fa0" }}>Utility can not be found</code> (e.g.
          errorCode <code style={{ color: "#fa0" }}>1002</code>), the request shape is
          usually correct; Flex is saying this lookup is not available on your sandbox
          (often the IFSC utility must be enabled on your tenant). Sample code with empty{" "}
          <code style={{ color: "#0f0" }}>type</code> /{" "}
          <code style={{ color: "#0f0" }}>payload</code> is a template—use real values.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            value={ifscCode}
            onChange={(e) => setIfscCode(e.target.value)}
            placeholder="e.g. HDFC0000123"
            maxLength={11}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #444",
              background: "#1a1a1a",
              color: "#eee",
              minWidth: "160px",
            }}
          />
          <button
            type="button"
            onClick={validateIfsc}
            disabled={ifscLoading}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium shadow hover:bg-teal-700 disabled:opacity-50"
          >
            {ifscLoading ? "Validating…" : "Validate IFSC"}
          </button>
        </div>
        {ifscResult != null && (
          <pre
            style={{
              background: "#111",
              color: "#0f0",
              padding: "10px",
              borderRadius: "5px",
              overflow: "auto",
              marginTop: "12px",
            }}
          >
            {JSON.stringify(ifscResult, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex gap-3 mb-5">
        <button
          onClick={() => callAPI("/token")}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow hover:bg-blue-700 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
        >
          Get Token
        </button>

        <button
          onClick={() => callAPI("/md5")}
          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium shadow hover:bg-green-700 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
        >
          Generate MD5
        </button>

        <button
          onClick={() => callAPI("/test")}
          className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium shadow hover:bg-purple-700 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
        >
          Test Protected API
        </button>

        <button
          onClick={() => callAPI("/countries")}
          className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium shadow hover:bg-orange-600 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
        >
          Get Countries
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {response?.data?.data && (
        <div style={{ marginBottom: "20px" }}>
          <label>Select Country: </label>

          <select
            style={{
              marginLeft: "10px",
              padding: "5px",
              borderRadius: "5px",
            }}
            onChange={(e) => handleGetBanks(e.target.value)}
          >
            <option value="">-- Select Country --</option>

            {response.data.data.map((country: any) => (
              <option key={country.couCode} value={country.couCode}>
                {country.couName}
              </option>
            ))}
          </select>
        </div>
      )}

      <pre
        style={{
          background: "#111",
          color: "#0f0",
          padding: "10px",
          borderRadius: "5px",
          overflow: "auto",
        }}
      >
        {JSON.stringify(response, null, 2)}
      </pre>
    </div>
  );
}
