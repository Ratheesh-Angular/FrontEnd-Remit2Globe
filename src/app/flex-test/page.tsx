"use client";

import { useState } from "react";
import { flexApiUrl } from "@/lib/flex-api";

export default function FlexTestPage() {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Flex API Test Panel</h1>

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
