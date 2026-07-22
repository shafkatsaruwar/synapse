import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  caregiverProfileStorage,
  roleStorage,
  type CaregiverProfile,
  type UserRole,
} from "@/lib/storage";
import { syncWidgetSnapshot } from "@/lib/widget-sync";

interface RoleContextValue {
  role: UserRole;
  caregiverProfile: CaregiverProfile | null;
  needsCaregiverOnboarding: boolean;
  setRole: (role: UserRole) => Promise<void>;
  saveCaregiverProfile: (profile: CaregiverProfile) => Promise<void>;
  refreshRole: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("self");
  const [caregiverProfile, setCaregiverProfile] = useState<CaregiverProfile | null>(null);

  const refreshRole = useCallback(async () => {
    const [savedRole, savedProfile] = await Promise.all([
      roleStorage.get(),
      caregiverProfileStorage.get(),
    ]);
    setRoleState(savedRole);
    setCaregiverProfile(savedProfile);
  }, []);

  useEffect(() => {
    refreshRole().catch(() => {});
  }, [refreshRole]);

  const setRole = useCallback(async (nextRole: UserRole) => {
    setRoleState(nextRole);
    await roleStorage.save(nextRole);
    const savedProfile = await caregiverProfileStorage.get();
    setCaregiverProfile(savedProfile);
    await syncWidgetSnapshot().catch(() => {});
  }, []);

  const saveCaregiverProfile = useCallback(async (profile: CaregiverProfile) => {
    const safeProfile: CaregiverProfile = {
      name: profile.name.trim(),
      age: Number.isFinite(profile.age) ? Math.max(0, Math.round(profile.age)) : 0,
      relation: profile.relation?.trim() || undefined,
      medications: profile.medications ?? [],
      appointments: profile.appointments ?? [],
      logs: profile.logs ?? [],
    };
    setCaregiverProfile(safeProfile);
    await caregiverProfileStorage.save(safeProfile);
    await syncWidgetSnapshot().catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      role,
      caregiverProfile,
      needsCaregiverOnboarding: role === "caregiver" && !caregiverProfile?.name?.trim(),
      setRole,
      saveCaregiverProfile,
      refreshRole,
    }),
    [caregiverProfile, refreshRole, role, saveCaregiverProfile, setRole]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    return {
      role: "self",
      caregiverProfile: null,
      needsCaregiverOnboarding: false,
      setRole: async () => {},
      saveCaregiverProfile: async () => {},
      refreshRole: async () => {},
    };
  }
  return ctx;
}
