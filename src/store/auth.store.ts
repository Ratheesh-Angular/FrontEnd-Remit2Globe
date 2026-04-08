import { create } from "zustand";

interface User {
  id: string;
  email: string | null;
  phone: string | null;
  role: "INDIVIDUAL" | "CORPORATE";
  kycStatus: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SUSPENDED";
  createdAt: string;
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => set({ user: null }),
}));
