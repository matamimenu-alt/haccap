import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthUser = {
  id: string;
  email: string;
  fullNameAr: string;
  fullNameEn: string;
  preferredLocale: 'ar' | 'en';
  avatarUrl: string | null;
  companyId: string;
  branchIds: string[];
  roles: string[];
};

type State = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (opts: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  updateUser: (user: AuthUser) => void;
  clear: () => void;
};

export const useAuthStore = create<State>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) => set({ accessToken, refreshToken, user }),
      updateUser: (user) => set({ user }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'rcos.auth' },
  ),
);
