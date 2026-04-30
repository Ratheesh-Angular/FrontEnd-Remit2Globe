import axios from "axios";
import { getBackendApiBase } from "@/lib/backend-api-base";

/**
 * Direct backend — browser calls that must hit the API origin (login/register/OTP,
 * Set-Cookie on API host; cookies not required from Next origin).
 */
export const publicApi = axios.create({
  baseURL: getBackendApiBase(),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

/**
 * Same-origin BFF (`/api/backend/*`) — reads mirrored httpOnly `token` on the Next host
 * and forwards `Cookie: token=…` to Express. Use for all authenticated client requests.
 */
export const sessionApi = axios.create({
  baseURL:
    typeof window === "undefined" ? getBackendApiBase() : "/api/backend",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

export default publicApi;
