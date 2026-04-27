import axios from "axios";
import { getBackendApiBase } from "@/lib/backend-api-base";
//testing git main 08.04.2026

const api = axios.create({
  baseURL: getBackendApiBase(),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

export default api;
