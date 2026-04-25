import { NextRequest, NextResponse } from "next/server";

const COUNTRIES_NOW =
  "https://countriesnow.space/api/v0.1/countries/states";

type CountriesNowState = { name: string; state_code?: string };

type CountriesNowBody = {
  error?: boolean;
  msg?: string;
  data?: { name?: string; states?: CountriesNowState[] };
};

/**
 * GET /api/geo/states?country=United%20States
 * Proxies Countries Now (free, no API key) so the browser is not subject to
 * CORS, and we normalize the response to a list of state/region names.
 */
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country")?.trim() ?? "";
  if (!country) {
    return NextResponse.json(
      { error: "country query parameter is required" },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(COUNTRIES_NOW, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    });
  } catch {
    return NextResponse.json(
      { stateNames: [] as string[], error: "Network error loading states" },
      { status: 200 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { stateNames: [] as string[], error: `HTTP ${res.status}` },
      { status: 200 },
    );
  }

  const json = (await res.json()) as CountriesNowBody;
  if (json.error || !json.data?.states?.length) {
    return NextResponse.json({
      stateNames: [] as string[],
      error: null as string | null,
    });
  }

  const stateNames = json.data.states
    .map((s) => (typeof s.name === "string" ? s.name.trim() : ""))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ stateNames, error: null as string | null });
}
