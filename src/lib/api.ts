import axios, { type InternalAxiosRequestConfig } from "axios";
import { getBackendApiBase, getBackendApiBaseServer } from "@/lib/backend-api-base";

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
    typeof window === "undefined" ? getBackendApiBaseServer() : "/api/backend",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

/**
 * Default JSON Content-Type breaks multipart: boundary is dropped and Express
 * multer sees no file. Let the runtime set multipart boundaries for FormData.
 */
sessionApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (config.data instanceof FormData) {
    const h = config.headers;
    if (h && typeof h.delete === "function") {
      h.delete("Content-Type");
    } else if (h && typeof h === "object") {
      delete (h as Record<string, unknown>)["Content-Type"];
      delete (h as Record<string, unknown>)["content-type"];
    }
  }
  return config;
});

export default publicApi;
