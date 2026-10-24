import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SELF_PROFILE_ID } from "@/lib/storage";
import {
  createProfile as createProfileRecord,
  deleteProfile as deleteProfileRecord,
  loadRegistry,
  loadRoleFlags,
  makeSelfProfile,
  migrateLegacyCaregiver,
  saveRoleFlags,
  setActiveProfile,
  updateProfile as updateProfileRecord,
  type NewProfileInput,
} from "@/lib/care/profiles";
import type { CareRoleFlags, LocalCareProfile, ProfileRegistry } from "@/lib/care/types";

interface CareProfileContextValue {
  ready: boolean;
  profiles: LocalCareProfile[];
  activeProfile: LocalCareProfile;
  /** True while viewing someone other than the device owner. */
  viewingOther: boolean;
  /** Bumps on every profile switch so screens can remount and reload the right person's data. */
  revision: number;
  roleFlags: CareRoleFlags;
  switchProfile: (id: string) => Promise<void>;
  createProfile: (input: NewProfileInput) => Promise<LocalCareProfile>;
  updateProfile: (id: string, patch: Partial<Omit<LocalCareProfile, "id" | "type" | "createdAt">>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  setRoleFlag: (role: keyof CareRoleFlags, value: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

const CareProfileContext = createContext<CareProfileContextValue | null>(null);

export function CareProfileProvider({ children }: { children: React.ReactNode }) {
  const [registry, setRegistry] = useState<ProfileRegistry>({ schemaVersion: 1, profiles: [makeSelfProfile()], activeProfileId: SELF_PROFILE_ID, legacyCaregiverMigrated: false });
  const [roleFlags, setRoleFlags] = useState<CareRoleFlags>({ caregiver: false, backup: false });
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    const reg = await loadRegistry();
    setRegistry(reg);
    setRoleFlags(await loadRoleFlags());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Copy-first migration of the old single caregiver profile, then load everything.
        const migrated = await migrateLegacyCaregiver();
        if (cancelled) return;
        setRegistry(migrated);
        setRoleFlags(await loadRoleFlags());
      } catch (e) {
        console.warn("care profile init failed", e);
      } finally {
        if (!cancelled) {
          setReady(true);
          setRevision((r) => r + 1);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const switchProfile = useCallback(async (id: string) => {
    const reg = await setActiveProfile(id);
    setRegistry(reg);
    setRevision((r) => r + 1);
  }, []);

  const createProfile = useCallback(async (input: NewProfileInput) => {
    const { registry: reg, profile } = await createProfileRecord(input);
    setRegistry(reg);
    if (input.type !== "connected_reference") {
      const flags = { ...(await loadRoleFlags()), caregiver: true };
      await saveRoleFlags(flags);
      setRoleFlags(flags);
    }
    return profile;
  }, []);

  const updateProfile = useCallback(async (id: string, patch: Partial<Omit<LocalCareProfile, "id" | "type" | "createdAt">>) => {
    setRegistry(await updateProfileRecord(id, patch));
  }, []);

  const deleteProfile = useCallback(async (id: string) => {
    const wasActive = registry.activeProfileId === id;
    const reg = await deleteProfileRecord(id);
    setRegistry(reg);
    if (wasActive) setRevision((r) => r + 1);
  }, [registry.activeProfileId]);

  const setRoleFlag = useCallback(async (role: keyof CareRoleFlags, value: boolean) => {
    const flags = { ...(await loadRoleFlags()), [role]: value };
    await saveRoleFlags(flags);
    setRoleFlags(flags);
  }, []);

  const activeProfile = registry.profiles.find((p) => p.id === registry.activeProfileId) ?? registry.profiles[0];

  const value = useMemo<CareProfileContextValue>(
    () => ({
      ready,
      profiles: registry.profiles,
      activeProfile,
      viewingOther: activeProfile.id !== SELF_PROFILE_ID,
      revision,
      roleFlags,
      switchProfile,
      createProfile,
      updateProfile,
      deleteProfile,
      setRoleFlag,
      refresh,
    }),
    [activeProfile, createProfile, deleteProfile, ready, refresh, registry.profiles, revision, roleFlags, setRoleFlag, switchProfile, updateProfile],
  );

  return <CareProfileContext.Provider value={value}>{children}</CareProfileContext.Provider>;
}

export function useCareProfiles(): CareProfileContextValue {
  const ctx = useContext(CareProfileContext);
  if (!ctx) {
    const self = makeSelfProfile();
    const noop = async () => {};
    return {
      ready: true,
      profiles: [self],
      activeProfile: self,
      viewingOther: false,
      revision: 0,
      roleFlags: { caregiver: false, backup: false },
      switchProfile: noop,
      createProfile: async () => self,
      updateProfile: noop,
      deleteProfile: noop,
      setRoleFlag: noop,
      refresh: noop,
    };
  }
  return ctx;
}
