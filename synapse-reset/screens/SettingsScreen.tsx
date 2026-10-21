import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  Platform,
  useWindowDimensions,
  ScrollView,
  Alert,
  Share,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useDisplaySettings } from "@/contexts/DisplaySettingsContext";
import { useAppMode } from "@/contexts/AppModeContext";
import { useAuth } from "@/contexts/AuthContext";
import GlassView from "@/components/GlassView";
import { modalOverlay, modalSurface } from "@/lib/modal-colors";
import {
  healthProfileStorage,
  type HealthProfileInfo,
  type UserRole,
} from "@/lib/storage";
import { useRole } from "@/contexts/RoleContext";
import { syncAllFromSettings } from "@/lib/notification-manager";
import { syncWidgetSnapshot } from "@/lib/widget-sync";
import { raised } from "@/constants/raised";
import { getBackupStatus, backupNow, type BackupStatus } from "@/lib/backup";
import {
  connectAppleHealth,
  disconnectAppleHealth,
  getAppleHealthStatus,
  syncAppleHealthVitals,
  type AppleHealthStatus,
} from "@/lib/apple-health";
import {
  generatePatientLinkCode,
  getCaregiverLinkState,
  linkCaregiverWithCode,
  sendCaregiverReminder,
  unlinkCaregiverUser,
  type CaregiverLinkState,
} from "@/lib/caregiver-linking";

export type SettingsScreenVariant = "care" | "integrations";

interface SettingsScreenProps {
  /** care = roles/linking; integrations = Apple Health + assistant. Defaults to care. */
  variant?: SettingsScreenVariant;
  onResetApp?: () => void;
  onNavigate?: (screen: string) => void;
  onRestoreComplete?: () => void;
}

type CaregiverOnboardingStep =
  | "entry"
  | "role"
  | "patient-trust"
  | "patient-code"
  | "caregiver-intent"
  | "caregiver-code"
  | "confirmation";

function formatBackupTime(value?: string | null) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not synced yet";
  return `Last synced ${date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export default function SettingsScreen({
  variant = "care",
  onNavigate,
  onRestoreComplete,
}: SettingsScreenProps) {
  const isCare = variant === "care";
  const isIntegrations = variant === "integrations";
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { user, signOut } = useAuth();
  const { appMode } = useAppMode();
  const { role: activeRole, caregiverProfile, setRole, saveCaregiverProfile, clearCaregiverMode } = useRole();
  const { textScale } = useDisplaySettings();
  const { colors: C, themeId } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeId), [C, themeId]);
  const authUserId = (user as { id?: string } | null)?.id ?? null;

  const [profile, setProfile] = useState<HealthProfileInfo>({ userRole: "self", widgetAppearance: "system", backupCriticalMedications: [] });
  const [roleDetailsEditing, setRoleDetailsEditing] = useState(false);

  const [appleHealthStatus, setAppleHealthStatus] = useState<AppleHealthStatus | null>(null);
  const [appleHealthBusy, setAppleHealthBusy] = useState(false);
  const [assistantBackup, setAssistantBackup] = useState<BackupStatus | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [caregiverLinkState, setCaregiverLinkState] = useState<CaregiverLinkState | null>(null);
  const [caregiverLinkBusy, setCaregiverLinkBusy] = useState(false);
  const [caregiverCodeCopied, setCaregiverCodeCopied] = useState(false);
  const [caregiverCodeNow, setCaregiverCodeNow] = useState(Date.now());
  const [showCaregiverOnboarding, setShowCaregiverOnboarding] = useState(false);
  const [caregiverOnboardingStep, setCaregiverOnboardingStep] = useState<CaregiverOnboardingStep>("entry");
  const [caregiverOnboardingCode, setCaregiverOnboardingCode] = useState("");
  const [caregiverOnboardingError, setCaregiverOnboardingError] = useState("");

  const loadData = useCallback(async () => {
    const profileInfo = await healthProfileStorage.get();
    setProfile(profileInfo);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshAppleHealthStatus = useCallback(() => {
    getAppleHealthStatus().then(setAppleHealthStatus).catch(() => {});
  }, []);

  const refreshAssistantBackup = useCallback(() => {
    if (!authUserId) {
      setAssistantBackup(null);
      return;
    }
    getBackupStatus(authUserId).then(setAssistantBackup).catch(() => setAssistantBackup(null));
  }, [authUserId]);

  const refreshCaregiverLinkState = useCallback(() => {
    getCaregiverLinkState(authUserId).then(setCaregiverLinkState).catch(() => setCaregiverLinkState(null));
  }, [authUserId]);

  useEffect(() => {
    refreshAppleHealthStatus();
  }, [refreshAppleHealthStatus]);

  useEffect(() => {
    refreshAssistantBackup();
  }, [refreshAssistantBackup]);

  useEffect(() => {
    refreshCaregiverLinkState();
  }, [refreshCaregiverLinkState, activeRole, profile.userRole]);

  useEffect(() => {
    const interval = setInterval(refreshCaregiverLinkState, 5000);
    return () => clearInterval(interval);
  }, [refreshCaregiverLinkState]);

  useEffect(() => {
    if (!caregiverLinkState?.pendingCode) return undefined;
    const interval = setInterval(() => setCaregiverCodeNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [caregiverLinkState?.pendingCode]);



  const handleSaveProfile = async (nextProfile: HealthProfileInfo) => {
    setProfile(nextProfile);
    await healthProfileStorage.save(nextProfile);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    syncAllFromSettings().catch(() => {});
    syncWidgetSnapshot().catch(() => {});
  };

  const updateRole = async (role: UserRole) => {
    setRoleDetailsEditing(false);
    await setRole(role);
    await handleSaveProfile({ ...profile, userRole: role });
  };

  const saveBackupRoleDetails = async (updates: Partial<HealthProfileInfo>) => {
    await handleSaveProfile({ ...profile, ...updates });
  };

  const handleAssistantSync = async () => {
    if (!authUserId) {
      onNavigate?.("auth");
      return;
    }
    Haptics.selectionAsync();
    setAssistantBusy(true);
    try {
      const { error } = await backupNow(authUserId);
      refreshAssistantBackup();
      if (error) {
        Alert.alert("Assistant sync failed", "Could not update the signed-in cloud copy. Try again after checking sign-in.");
      } else {
        Alert.alert("Synced", "Your signed-in cloud copy is updated for the assistant. iCloud backup on this device is unchanged.");
      }
    } catch {
      Alert.alert("Assistant sync failed", "Could not update the signed-in cloud copy.");
    } finally {
      setAssistantBusy(false);
    }
  };

  const handleAssistantSignOut = async () => {
    try {
      await signOut();
      setAssistantBackup(null);
    } catch {
      Alert.alert("Sign out failed", "Could not sign out right now.");
    }
  };

  const handleConnectAppleHealth = async () => {
    setAppleHealthBusy(true);
    try {
      const result = await connectAppleHealth();
      if (!result.ok) {
        Alert.alert("Apple Health", result.error || "Could not connect.");
        return;
      }
      const sync = await syncAppleHealthVitals(30);
      refreshAppleHealthStatus();
      if (sync.ok) {
        Alert.alert(
          "Apple Health connected",
          sync.imported > 0
            ? `Imported ${sync.imported} recent reading${sync.imported === 1 ? "" : "s"} into Vitals.`
            : "Connected. No new readings found in the last 30 days — open Vitals and tap Sync anytime.",
        );
      } else {
        Alert.alert("Connected", sync.error || "Connected, but sync could not finish. Try Sync again from Vitals.");
      }
    } finally {
      setAppleHealthBusy(false);
    }
  };

  const handleSyncAppleHealth = async () => {
    setAppleHealthBusy(true);
    try {
      const sync = await syncAppleHealthVitals(30);
      refreshAppleHealthStatus();
      if (sync.ok) {
        Alert.alert(
          "Synced",
          sync.imported > 0
            ? `Updated ${sync.imported} reading${sync.imported === 1 ? "" : "s"} from Apple Health.`
            : "No new Apple Health readings to import.",
        );
      } else {
        Alert.alert("Sync failed", sync.error || "Could not sync Apple Health.");
      }
    } finally {
      setAppleHealthBusy(false);
    }
  };

  const handleDisconnectAppleHealth = () => {
    Alert.alert(
      "Disconnect Apple Health?",
      "Synapse will stop syncing new readings. Existing imported vitals stay on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            await disconnectAppleHealth();
            refreshAppleHealthStatus();
          },
        },
      ],
    );
  };

  const handleRemoveCaregiverMode = () => {
    Haptics.selectionAsync();
    Alert.alert(
      "Remove caregiver mode?",
      "This clears the care recipient on this device and switches you back to Self. Linked remote caregivers can still be unlinked separately.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await clearCaregiverMode();
            setRoleDetailsEditing(false);
            setProfile((prev) => ({
              ...prev,
              userRole: "self",
              caredForName: undefined,
              caredForAge: undefined,
            }));
            await loadData();
            onRestoreComplete?.();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );
  };

  const openCaregiverOnboarding = () => {
    setCaregiverOnboardingStep("entry");
    setCaregiverOnboardingCode("");
    setCaregiverOnboardingError("");
    setShowCaregiverOnboarding(true);
    Haptics.selectionAsync().catch(() => {});
  };

  const closeCaregiverOnboarding = () => {
    setShowCaregiverOnboarding(false);
    setCaregiverOnboardingError("");
  };

  const preparePatientCaregiverCode = async () => {
    setCaregiverLinkBusy(true);
    setCaregiverOnboardingError("");
    try {
      if (activeRole !== "self" || profile.userRole !== "self") {
        await updateRole("self");
      }
      const result = await generatePatientLinkCode(authUserId);
      if (result.error || !result.code) {
        setCaregiverOnboardingError(result.error?.message ?? "We couldn’t create a code. Try again.");
        return;
      }
      await refreshCaregiverLinkState();
      setCaregiverCodeNow(Date.now());
      setCaregiverOnboardingStep("patient-code");
    } finally {
      setCaregiverLinkBusy(false);
    }
  };

  const completeCaregiverOnboardingLink = async () => {
    if (caregiverOnboardingCode.trim().length !== 6) return;
    setCaregiverLinkBusy(true);
    setCaregiverOnboardingError("");
    try {
      const result = await linkCaregiverWithCode(caregiverOnboardingCode, authUserId);
      if (result.error) {
        setCaregiverOnboardingError(result.error.message);
        return;
      }
      if (activeRole !== "caregiver" || profile.userRole !== "caregiver") {
        await updateRole("caregiver");
      }
      await refreshCaregiverLinkState();
      setCaregiverOnboardingStep("confirmation");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setCaregiverLinkBusy(false);
    }
  };

  const caregiverShareMessage = (code: string) =>
    `Hey, I’m using Synapse to stay on track with my health.\n\nHere’s my connection code: ${code}\nIt expires in 15 minutes.\n\nOpen Synapse → Caregiver → Enter code`;

  const handleShareCaregiverCode = async () => {
    const code = caregiverLinkState?.pendingCode;
    if (!code) return;
    await Haptics.selectionAsync().catch(() => {});
    await Share.share({ message: caregiverShareMessage(code) });
  };

  const handleCopyCaregiverCode = async () => {
    const code = caregiverLinkState?.pendingCode;
    if (!code) return;
    try {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(code);
      setCaregiverCodeCopied(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => setCaregiverCodeCopied(false), 1800);
    } catch {
      await Share.share({ message: code });
    }
  };

  const handleUnlinkCaregiverUser = (targetUserId: string) => {
    Alert.alert("Unlink caregiver connection?", "Missed-medication sharing will stop for this connection.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unlink",
        style: "destructive",
        onPress: async () => {
          setCaregiverLinkBusy(true);
          try {
            const result = await unlinkCaregiverUser(targetUserId, authUserId);
            if (result.error) {
              Alert.alert("Could not unlink", result.error.message);
              return;
            }
            await refreshCaregiverLinkState();
          } finally {
            setCaregiverLinkBusy(false);
          }
        },
      },
    ]);
  };

  const handleSendCaregiverReminder = async (patientUserId: string) => {
    Haptics.selectionAsync();
    setCaregiverLinkBusy(true);
    try {
      const result = await sendCaregiverReminder(patientUserId, "Don't forget your medication", authUserId);
      if (result.error) {
        Alert.alert("Could not send reminder", result.error.message);
        return;
      }
      Alert.alert("Reminder sent", "We sent a medication reminder.");
    } finally {
      setCaregiverLinkBusy(false);
    }
  };

  const saveSimpleRoleDetails = async () => {
    await saveBackupRoleDetails({
      caredForName: profile.userRole === "caregiver" ? profile.caredForName?.trim() || undefined : undefined,
      caredForAge: profile.userRole === "caregiver" && profile.caredForAge != null ? profile.caredForAge : undefined,
      backupEmergencyProtocols: undefined,
      backupCriticalMedications: profile.backupCriticalMedications ?? [],
    });
    if (profile.userRole === "caregiver") {
      await saveCaregiverProfile({
        name: profile.caredForName?.trim() || caregiverProfile?.name || "",
        age: profile.caredForAge ?? caregiverProfile?.age ?? 0,
        relation: caregiverProfile?.relation,
        medications: caregiverProfile?.medications ?? [],
        appointments: caregiverProfile?.appointments ?? [],
        logs: caregiverProfile?.logs ?? [],
      });
    }
    setRoleDetailsEditing(false);
  };

  const saveCareRecipientDetails = async () => {
    await saveBackupRoleDetails({
      caredForName: profile.caredForName?.trim() || undefined,
      caredForAge: profile.caredForAge != null ? profile.caredForAge : undefined,
      backupEmergencyProtocols: profile.backupEmergencyProtocols,
      backupCriticalMedications: profile.backupCriticalMedications ?? [],
    });
    await saveCaregiverProfile({
      name: profile.caredForName?.trim() || caregiverProfile?.name || "",
      age: profile.caredForAge ?? caregiverProfile?.age ?? 0,
      relation: caregiverProfile?.relation,
      medications: caregiverProfile?.medications ?? [],
      appointments: caregiverProfile?.appointments ?? [],
      logs: caregiverProfile?.logs ?? [],
    });
    setRoleDetailsEditing(false);
  };

  const caredForNameLabel = profile.caredForName?.trim() || "Add name";
  const caredForAgeLabel = profile.caredForAge != null ? `${profile.caredForAge} years old` : "Age not set";

  const contentPadding = {
    paddingTop: isWide ? 28 : Platform.OS === "web" ? 40 : 12,
    paddingBottom: isWide ? 40 : Platform.OS === "web" ? 118 : insets.bottom + 100,
    paddingHorizontal: 24,
  };
  const simpleContentPadding = {
    ...contentPadding,
    paddingTop: isWide ? 28 : Platform.OS === "web" ? 40 : insets.top + 24,
  };

  const simpleHeaderTitleSize = Math.round(28 * textScale);
  const simpleSectionTitleSize = Math.round(20 * textScale);
  const simpleBodySize = Math.round(17 * textScale);
  const simpleActionSize = Math.round(16 * textScale);
  const currentLinkRole: "patient" | "caregiver" = activeRole === "caregiver" || profile.userRole === "caregiver" ? "caregiver" : "patient";
  const linkedUsers = caregiverLinkState?.linkedUsers ?? [];
  const hasLinkedUsers = linkedUsers.length > 0;
  const linkCodeExpiresMs = caregiverLinkState?.pendingCodeExpiresAt ? new Date(caregiverLinkState.pendingCodeExpiresAt).getTime() : 0;
  const linkCodeSecondsLeft = linkCodeExpiresMs ? Math.max(0, Math.ceil((linkCodeExpiresMs - caregiverCodeNow) / 1000)) : 0;
  const linkCodeExpired = Boolean(caregiverLinkState?.pendingCode && linkCodeExpiresMs && linkCodeSecondsLeft <= 0);
  const linkCodeCountdownLabel = caregiverLinkState?.pendingCode
    ? linkCodeExpired
      ? "Expired"
      : `Expires in ${Math.floor(linkCodeSecondsLeft / 60)}:${String(linkCodeSecondsLeft % 60).padStart(2, "0")}`
    : "";

  const caregiverOnboardingBack = () => {
    setCaregiverOnboardingError("");
    if (caregiverOnboardingStep === "role") setCaregiverOnboardingStep("entry");
    else if (caregiverOnboardingStep === "patient-trust" || caregiverOnboardingStep === "caregiver-intent") setCaregiverOnboardingStep("role");
    else if (caregiverOnboardingStep === "patient-code") setCaregiverOnboardingStep("patient-trust");
    else if (caregiverOnboardingStep === "caregiver-code") setCaregiverOnboardingStep("caregiver-intent");
  };

  const caregiverOnboardingModal = (
    <Modal visible={showCaregiverOnboarding} transparent animationType="fade" onRequestClose={closeCaregiverOnboarding}>
      <View style={styles.caregiverOnboardingOverlay}>
        <ScrollView
          style={styles.caregiverOnboardingModal}
          contentContainerStyle={styles.caregiverOnboardingModalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.caregiverOnboardingTopRow}>
            {caregiverOnboardingStep !== "entry" && caregiverOnboardingStep !== "confirmation" ? (
              <Pressable style={styles.caregiverOnboardingIconButton} onPress={caregiverOnboardingBack} accessibilityLabel="Back">
                <Ionicons name="arrow-back" size={21} color={C.text} />
              </Pressable>
            ) : <View style={styles.caregiverOnboardingIconButton} />}
            <Pressable style={styles.caregiverOnboardingIconButton} onPress={closeCaregiverOnboarding} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={C.textSecondary} />
            </Pressable>
          </View>

          {caregiverOnboardingStep === "entry" ? (
            <>
              <View style={styles.caregiverOnboardingHeroIcon}>
                <Ionicons name="heart-outline" size={28} color={C.tint} />
              </View>
              <Text style={styles.caregiverOnboardingTitle}>Stay connected to care</Text>
              <Text style={styles.caregiverOnboardingBody}>
                Share the moments that matter, like missed medication, check-ins, and sick mode, with someone you trust.
              </Text>
              <View style={styles.caregiverTrustCallout}>
                <Ionicons name="shield-checkmark-outline" size={20} color={C.green} />
                <Text style={styles.caregiverTrustCalloutText}>You stay in control and can unlink anytime.</Text>
              </View>
              <Pressable style={styles.caregiverOnboardingPrimary} onPress={() => setCaregiverOnboardingStep("role")}>
                <Text style={styles.caregiverOnboardingPrimaryText}>Add someone</Text>
              </Pressable>
              <Pressable style={styles.caregiverOnboardingTextButton} onPress={closeCaregiverOnboarding}>
                <Text style={styles.caregiverOnboardingTextButtonText}>Skip</Text>
              </Pressable>
            </>
          ) : null}

          {caregiverOnboardingStep === "role" ? (
            <>
              <Text style={styles.caregiverOnboardingTitle}>How do you want to connect?</Text>
              <Text style={styles.caregiverOnboardingBody}>Choose the option that fits you. You can change this later.</Text>
              <Pressable
                style={styles.caregiverRoleChoice}
                onPress={() => {
                  setCaregiverOnboardingStep("patient-trust");
                }}
              >
                <View style={styles.caregiverRoleChoiceIcon}><Ionicons name="person-outline" size={22} color={C.tint} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.caregiverRoleChoiceTitle}>I want a caregiver</Text>
                  <Text style={styles.caregiverRoleChoiceBody}>Invite someone you trust to receive important alerts.</Text>
                </View>
                <Ionicons name="chevron-forward" size={19} color={C.textTertiary} />
              </Pressable>
              <Pressable
                style={styles.caregiverRoleChoice}
                onPress={() => {
                  setCaregiverOnboardingStep("caregiver-intent");
                }}
              >
                <View style={styles.caregiverRoleChoiceIcon}><Ionicons name="people-outline" size={22} color={C.tint} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.caregiverRoleChoiceTitle}>I’m helping someone</Text>
                  <Text style={styles.caregiverRoleChoiceBody}>Connect with a patient using their private code.</Text>
                </View>
                <Ionicons name="chevron-forward" size={19} color={C.textTertiary} />
              </Pressable>
            </>
          ) : null}

          {caregiverOnboardingStep === "patient-trust" ? (
            <>
              <View style={styles.caregiverOnboardingHeroIcon}><Ionicons name="lock-closed-outline" size={27} color={C.tint} /></View>
              <Text style={styles.caregiverOnboardingTitle}>Your health stays yours</Text>
              <Text style={styles.caregiverOnboardingBody}>Your caregiver only receives important alerts. Synapse does not share your full logs or detailed history.</Text>
              {["Only important care alerts", "No full health-data sharing", "Unlink whenever you want"].map((label) => (
                <View key={label} style={styles.caregiverBenefitRow}>
                  <Ionicons name="checkmark-circle" size={20} color={C.green} />
                  <Text style={styles.caregiverBenefitText}>{label}</Text>
                </View>
              ))}
              {caregiverOnboardingError ? <Text style={styles.caregiverOnboardingError}>{caregiverOnboardingError}</Text> : null}
              <Pressable style={[styles.caregiverOnboardingPrimary, caregiverLinkBusy && { opacity: 0.55 }]} onPress={preparePatientCaregiverCode} disabled={caregiverLinkBusy}>
                <Text style={styles.caregiverOnboardingPrimaryText}>{caregiverLinkBusy ? "Creating code..." : "Create approval code"}</Text>
              </Pressable>
            </>
          ) : null}

          {caregiverOnboardingStep === "patient-code" ? (
            <>
              <Text style={styles.caregiverOnboardingTitle}>Share this private code</Text>
              <Text style={styles.caregiverOnboardingBody}>Send it only to the person you want as your caregiver.</Text>
              <View style={[styles.caregiverOnboardingCodeBox, linkCodeExpired && styles.linkCodeBoxExpired]}>
                <Text style={[styles.caregiverOnboardingCode, linkCodeExpired && styles.linkCodeTextExpired]}>{caregiverLinkState?.pendingCode ?? "------"}</Text>
                <Text style={styles.linkCodeMeta}>{linkCodeCountdownLabel}</Text>
              </View>
              <Text style={styles.caregiverOnboardingPrivacy}>This code expires in 15 minutes for your privacy.</Text>
              <View style={styles.caregiverOnboardingActionRow}>
                <Pressable style={[styles.caregiverOnboardingPrimary, styles.caregiverOnboardingHalfButton]} onPress={handleShareCaregiverCode} disabled={linkCodeExpired}>
                  <Ionicons name="share-outline" size={18} color="#fff" />
                  <Text style={styles.caregiverOnboardingPrimaryText}>Share</Text>
                </Pressable>
                <Pressable style={[styles.caregiverOnboardingSecondary, styles.caregiverOnboardingHalfButton]} onPress={handleCopyCaregiverCode} disabled={linkCodeExpired}>
                  <Ionicons name="copy-outline" size={18} color={C.tint} />
                  <Text style={styles.caregiverOnboardingSecondaryText}>{caregiverCodeCopied ? "Copied" : "Copy"}</Text>
                </Pressable>
              </View>
              <Pressable style={styles.caregiverOnboardingTextButton} onPress={closeCaregiverOnboarding}>
                <Text style={styles.caregiverOnboardingTextButtonText}>Done</Text>
              </Pressable>
            </>
          ) : null}

          {caregiverOnboardingStep === "caregiver-intent" ? (
            <>
              <View style={styles.caregiverOnboardingHeroIcon}><Ionicons name="notifications-outline" size={27} color={C.tint} /></View>
              <Text style={styles.caregiverOnboardingTitle}>Helpful signals, not surveillance</Text>
              <Text style={styles.caregiverOnboardingBody}>You’ll receive a quiet nudge when something may need attention.</Text>
              {[
                ["medical-outline", "Missed medications"],
                ["calendar-outline", "Missed appointments"],
                ["shield-outline", "Sick mode activated"],
              ].map(([icon, label]) => (
                <View key={label} style={styles.caregiverBenefitRow}>
                  <Ionicons name={icon as React.ComponentProps<typeof Ionicons>["name"]} size={20} color={C.tint} />
                  <Text style={styles.caregiverBenefitText}>{label}</Text>
                </View>
              ))}
              <Text style={styles.caregiverOnboardingPrivacy}>The patient must approve the connection and can unlink anytime.</Text>
              <Pressable style={styles.caregiverOnboardingPrimary} onPress={() => setCaregiverOnboardingStep("caregiver-code")}>
                <Text style={styles.caregiverOnboardingPrimaryText}>Enter their code</Text>
              </Pressable>
            </>
          ) : null}

          {caregiverOnboardingStep === "caregiver-code" ? (
            <>
              <Text style={styles.caregiverOnboardingTitle}>Enter approval code</Text>
              <Text style={styles.caregiverOnboardingBody}>Ask the patient for the six-character code shown in their Synapse app.</Text>
              <TextInput
                style={styles.caregiverOnboardingInput}
                value={caregiverOnboardingCode}
                onChangeText={(text) => {
                  setCaregiverOnboardingError("");
                  setCaregiverOnboardingCode(text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
                }}
                placeholder="ABC123"
                placeholderTextColor={C.textTertiary}
                autoCapitalize="characters"
                maxLength={6}
              />
              {caregiverOnboardingError ? <Text style={styles.caregiverOnboardingError}>{caregiverOnboardingError}</Text> : null}
              <Pressable
                style={[styles.caregiverOnboardingPrimary, (caregiverLinkBusy || caregiverOnboardingCode.length !== 6) && { opacity: 0.5 }]}
                onPress={completeCaregiverOnboardingLink}
                disabled={caregiverLinkBusy || caregiverOnboardingCode.length !== 6}
              >
                <Text style={styles.caregiverOnboardingPrimaryText}>{caregiverLinkBusy ? "Connecting..." : "Link caregiver"}</Text>
              </Pressable>
            </>
          ) : null}

          {caregiverOnboardingStep === "confirmation" ? (
            <>
              <View style={[styles.caregiverOnboardingHeroIcon, { backgroundColor: C.green + "18" }]}>
                <Ionicons name="checkmark" size={30} color={C.green} />
              </View>
              <Text style={styles.caregiverOnboardingTitle}>You’re connected</Text>
              <Text style={styles.caregiverOnboardingBody}>Important care signals can now reach you. The patient remains in control of the connection.</Text>
              <Pressable
                style={styles.caregiverOnboardingPrimary}
                onPress={() => {
                  closeCaregiverOnboarding();
                  onNavigate?.("caregiverdashboard");
                }}
              >
                <Text style={styles.caregiverOnboardingPrimaryText}>Open caregiver dashboard</Text>
              </Pressable>
              <Pressable style={styles.caregiverOnboardingTextButton} onPress={closeCaregiverOnboarding}>
                <Text style={styles.caregiverOnboardingTextButtonText}>Done</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );

  const renderCaregiverLinkingSection = (simple = false) => (
    <View style={styles.embeddedLinkingSection}>
      <View style={styles.linkHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={simple ? [styles.simpleSettingsSectionTitle, { fontSize: simpleSectionTitleSize }] : styles.sectionTitle}>
            Caregiver linking
          </Text>
          <Text style={[styles.desc, simple && { fontSize: simpleBodySize, marginBottom: 0 }]}>
            Share missed-medication alerts with one trusted person.
          </Text>
        </View>
        <View style={[styles.linkStatusPill, hasLinkedUsers && styles.linkStatusPillLinked]}>
          <Text style={[styles.linkStatusText, hasLinkedUsers && styles.linkStatusTextLinked]}>{hasLinkedUsers ? "Linked" : "Not linked"}</Text>
        </View>
      </View>

      {currentLinkRole === "patient" ? (
        <View style={styles.linkSection}>
          {hasLinkedUsers ? (
            <Text style={styles.linkHelpText}>Caregiver alerts are active for this connection.</Text>
          ) : (
            <>
              <Text style={styles.linkHelpText}>Connect with one trusted person for important alerts and check-ins.</Text>
              <Pressable style={styles.secondaryBtn} onPress={openCaregiverOnboarding}>
                <Text style={styles.secondaryBtnText}>Set up connection</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : hasLinkedUsers ? null : (
        <View style={styles.linkSection}>
          <Text style={styles.linkHelpText}>Use the patient’s private approval code to connect.</Text>
          <Pressable style={styles.secondaryBtn} onPress={openCaregiverOnboarding}>
            <Text style={styles.secondaryBtnText}>Set up connection</Text>
          </Pressable>
        </View>
      )}

      {hasLinkedUsers ? (
        <View style={styles.linkedUsersWrap}>
          {linkedUsers.map((linkedUserId) => (
            <View key={linkedUserId} style={styles.linkedUserRow}>
              <View style={styles.linkedUserIcon}>
                <Ionicons name={currentLinkRole === "caregiver" ? "heart-outline" : "people-outline"} size={17} color={C.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkedUserTitle}>{currentLinkRole === "caregiver" ? "Linked patient" : "Linked caregiver"}</Text>
                <Text style={styles.linkedUserMeta} numberOfLines={1}>{linkedUserId}</Text>
              </View>
              {currentLinkRole === "caregiver" ? (
                <Pressable
                  style={styles.linkMiniButton}
                  onPress={() => handleSendCaregiverReminder(linkedUserId)}
                  disabled={caregiverLinkBusy}
                >
                  <Text style={styles.linkMiniButtonText}>Remind</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.linkMiniButton}
                onPress={() => handleUnlinkCaregiverUser(linkedUserId)}
                disabled={caregiverLinkBusy}
              >
                <Text style={styles.linkMiniButtonText}>Unlink</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (appMode === "simple" && isIntegrations) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[simpleContentPadding, styles.scrollViewContent, styles.simpleSettingsContent]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { fontSize: simpleHeaderTitleSize, marginBottom: 18 }]}>Integrations</Text>
          <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.simpleSettingsCard}>
            <Text style={[styles.simpleSettingsSectionTitle, { fontSize: simpleSectionTitleSize }]}>Apple Health</Text>
            <Text style={[styles.simpleSettingsPrompt, { fontSize: simpleBodySize }]}>
              {appleHealthStatus?.connected
                ? appleHealthStatus.lastSyncAt
                  ? `Connected · last sync ${new Date(appleHealthStatus.lastSyncAt).toLocaleString()}`
                  : "Connected"
                : Platform.OS === "ios"
                  ? "Not connected"
                  : "Apple Health is iOS-only"}
            </Text>
            <View style={styles.simpleSettingsButtonRow}>
              {appleHealthStatus?.connected ? (
                <>
                  <Pressable style={styles.simpleSettingsPrimaryButton} onPress={handleSyncAppleHealth} disabled={appleHealthBusy}>
                    <Text style={[styles.simpleSettingsPrimaryButtonText, { fontSize: simpleActionSize }]}>
                      {appleHealthBusy ? "Working..." : "Sync now"}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.simpleSettingsSecondaryButton} onPress={handleDisconnectAppleHealth} disabled={appleHealthBusy}>
                    <Text style={[styles.simpleSettingsSecondaryButtonText, { fontSize: simpleActionSize }]}>Disconnect</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={styles.simpleSettingsPrimaryButton}
                  onPress={handleConnectAppleHealth}
                  disabled={appleHealthBusy || Platform.OS !== "ios"}
                >
                  <Text style={[styles.simpleSettingsPrimaryButtonText, { fontSize: simpleActionSize }]}>
                    {appleHealthBusy ? "Working..." : "Connect"}
                  </Text>
                </Pressable>
              )}
            </View>
          </GlassView>
          <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.simpleSettingsCard}>
            <Text style={[styles.simpleSettingsSectionTitle, { fontSize: simpleSectionTitleSize }]}>Assistant access</Text>
            <Text style={[styles.simpleSettingsPrompt, { fontSize: simpleBodySize }]}>
              {authUserId ? formatBackupTime(assistantBackup?.lastSyncedAt) : "Sign in to enable optional assistant sync"}
            </Text>
            <View style={styles.simpleSettingsButtonRow}>
              {authUserId ? (
                <>
                  <Pressable style={styles.simpleSettingsPrimaryButton} onPress={handleAssistantSync} disabled={assistantBusy}>
                    <Text style={[styles.simpleSettingsPrimaryButtonText, { fontSize: simpleActionSize }]}>
                      {assistantBusy ? "Working..." : "Sync now"}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.simpleSettingsSecondaryButton} onPress={handleAssistantSignOut} disabled={assistantBusy}>
                    <Text style={[styles.simpleSettingsSecondaryButtonText, { fontSize: simpleActionSize }]}>Sign out</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={styles.simpleSettingsPrimaryButton} onPress={() => onNavigate?.("auth")}>
                  <Text style={[styles.simpleSettingsPrimaryButtonText, { fontSize: simpleActionSize }]}>Sign in</Text>
                </Pressable>
              )}
            </View>
          </GlassView>
          <Pressable style={styles.simpleSettingsSecondaryButton} onPress={() => onNavigate?.("settings")}>
            <Text style={[styles.simpleSettingsSecondaryButtonText, { fontSize: simpleActionSize }]}>Open Preferences</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (appMode === "simple") {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[simpleContentPadding, styles.scrollViewContent, styles.simpleSettingsContent]}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <Text style={[styles.title, { fontSize: simpleHeaderTitleSize, marginBottom: 18 }]}>Care & Sharing</Text>

          <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.simpleSettingsCard}>
            <Text style={[styles.simpleSettingsSectionTitle, { fontSize: simpleSectionTitleSize }]}>Role</Text>
            <Text style={[styles.simpleSettingsPrompt, { fontSize: simpleBodySize }]}>Who is this for?</Text>
            <View style={styles.simpleSettingsOptionStack}>
              {[
                { id: "self" as const, label: "Just me" },
                { id: "caregiver" as const, label: "I help someone" },
              ].map((option) => {
                const active = activeRole === option.id || (profile.userRole ?? "self") === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.simpleSettingsOptionButton, active && styles.simpleSettingsOptionButtonActive]}
                    onPress={() => updateRole(option.id)}
                  >
                    <Text style={[styles.simpleSettingsOptionText, { fontSize: simpleBodySize }, active && styles.simpleSettingsOptionTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {activeRole === "caregiver" || (profile.userRole ?? "self") === "caregiver" ? (
              <View style={styles.simplePersonCard}>
                <View style={styles.simplePersonHeader}>
                  <View style={styles.simplePersonAvatar}>
                    <Ionicons name="person-outline" size={20} color={C.tint} />
                  </View>
                  <View style={styles.simplePersonText}>
                    <Text style={[styles.simplePersonEyebrow, { fontSize: Math.max(11, simpleBodySize - 3) }]}>
                      Care recipient
                    </Text>
                    <Text style={[styles.simplePersonName, { fontSize: simpleSectionTitleSize }]}>
                      {caredForNameLabel}
                    </Text>
                    <Text style={[styles.simplePersonMeta, { fontSize: Math.max(12, simpleBodySize - 2) }]}>
                      {caredForAgeLabel}
                    </Text>
                  </View>
                  {!roleDetailsEditing ? (
                    <Pressable
                      style={styles.roleEditButton}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setRoleDetailsEditing(true);
                      }}
                    >
                      <Ionicons name="pencil-outline" size={15} color={C.tint} />
                      <Text style={styles.roleEditButtonText}>Edit</Text>
                    </Pressable>
                  ) : null}
                </View>
                {roleDetailsEditing ? (
                  <>
                    <View style={styles.simplePersonFieldRow}>
                      <View style={styles.simplePersonFieldName}>
                        <Text style={styles.roleInlineLabel}>Name</Text>
                        <TextInput
                          style={[styles.simpleSettingsInput, { fontSize: simpleBodySize }]}
                          value={profile.caredForName ?? ""}
                          onChangeText={(text) => setProfile((prev) => ({ ...prev, caredForName: text }))}
                          placeholder="Name"
                          placeholderTextColor={C.textTertiary}
                        />
                      </View>
                      <View style={styles.simplePersonFieldAge}>
                        <Text style={styles.roleInlineLabel}>Age</Text>
                        <TextInput
                          style={[styles.simpleSettingsInput, { fontSize: simpleBodySize }]}
                          value={profile.caredForAge != null ? String(profile.caredForAge) : ""}
                          onChangeText={(text) =>
                            setProfile((prev) => ({
                              ...prev,
                              caredForAge: text.trim() ? Math.max(0, parseInt(text, 10) || 0) : undefined,
                            }))
                          }
                          placeholder="Age"
                          placeholderTextColor={C.textTertiary}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                    <View style={styles.rolePersonActionRow}>
                      <Pressable
                        style={styles.roleCancelButton}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setProfile((prev) => ({
                            ...prev,
                            caredForName: caregiverProfile?.name || prev.caredForName,
                            caredForAge: caregiverProfile?.age || prev.caredForAge,
                          }));
                          setRoleDetailsEditing(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel editing care recipient"
                      >
                        <Text style={[styles.roleCancelButtonText, { fontSize: Math.max(13, simpleActionSize - 1) }]}>Cancel</Text>
                      </Pressable>
                      <Pressable style={[styles.personSaveButton, { flex: 1, marginTop: 0 }]} onPress={saveSimpleRoleDetails}>
                        <Text style={[styles.personSaveButtonText, { fontSize: simpleActionSize }]}>Save person</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
                <Pressable
                  style={styles.roleRemoveButton}
                  onPress={handleRemoveCaregiverMode}
                  accessibilityRole="button"
                  accessibilityLabel="Remove care recipient"
                >
                  <Ionicons name="trash-outline" size={16} color={C.red} />
                  <Text style={[styles.roleRemoveButtonText, { fontSize: Math.max(13, simpleActionSize - 1) }]}>
                    Remove care recipient
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {renderCaregiverLinkingSection(true)}
          </GlassView>
        </ScrollView>
        {caregiverOnboardingModal}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[contentPadding, styles.scrollViewContent]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <Text style={styles.title}>{isIntegrations ? "Integrations" : "Care & Sharing"}</Text>
        {isIntegrations ? (
          <Text style={[styles.desc, { marginBottom: 16 }]}>
            Connect optional services. Private CloudKit backup lives under Backup & Restore. Appearance and mode live in Preferences.
          </Text>
        ) : null}

        {isIntegrations ? (
        <>
        <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.card}>
          <Text style={styles.sectionTitle}>Assistant access</Text>
          <Text style={styles.desc}>
            Optional signed-in cloud copy so a personal Cursor assistant can read your own health data over MCP. This is separate from private iCloud backup. Not medical advice.
          </Text>
          <View style={styles.syncedBadge}>
            <Ionicons
              name={authUserId ? "sparkles-outline" : "lock-closed-outline"}
              size={15}
              color={authUserId ? C.green : C.textTertiary}
            />
            <Text style={[styles.syncedText, !authUserId && { color: C.textTertiary }]}>
              {authUserId
                ? formatBackupTime(assistantBackup?.lastSyncedAt)
                : "Sign in to enable assistant sync"}
            </Text>
          </View>
          <View style={styles.backupActions}>
            {authUserId ? (
              <>
                <Pressable
                  style={[styles.secondaryBtn, assistantBusy && { opacity: 0.55 }]}
                  onPress={handleAssistantSync}
                  disabled={assistantBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Sync health data for assistant"
                >
                  <Text style={styles.secondaryBtnText}>{assistantBusy ? "Working..." : "Sync now"}</Text>
                </Pressable>
                <Pressable
                  style={[styles.outlineBtn, assistantBusy && { opacity: 0.55 }]}
                  onPress={handleAssistantSignOut}
                  disabled={assistantBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out of assistant access"
                >
                  <Text style={styles.outlineBtnText}>Sign out</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => onNavigate?.("auth")}
                accessibilityRole="button"
                accessibilityLabel="Sign in for assistant access"
              >
                <Text style={styles.secondaryBtnText}>Sign in</Text>
              </Pressable>
            )}
          </View>
        </GlassView>

        <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.card}>
          <Text style={styles.sectionTitle}>Apple Health</Text>
          <Text style={styles.desc}>
            Connect Apple Health to import heart rate, blood pressure, weight, temperature, oxygen, blood glucose, sleep, and steps into Vitals. Read-only — Synapse does not write back to Apple Health. Not medical advice and not HIPAA.
          </Text>
          <View style={styles.syncedBadge}>
            <Ionicons
              name={appleHealthStatus?.connected ? "heart-circle-outline" : "heart-outline"}
              size={15}
              color={appleHealthStatus?.connected ? C.green : C.textTertiary}
            />
            <Text style={[styles.syncedText, !appleHealthStatus?.connected && { color: C.textTertiary }]}>
              {appleHealthStatus?.connected
                ? appleHealthStatus.lastSyncAt
                  ? `Connected · last sync ${new Date(appleHealthStatus.lastSyncAt).toLocaleString()}`
                  : "Connected"
                : appleHealthStatus?.reason
                  ? appleHealthStatus.reason
                  : Platform.OS === "ios"
                    ? "Not connected"
                    : "Apple Health is iOS-only"}
            </Text>
          </View>
          <View style={styles.backupActions}>
            {appleHealthStatus?.connected ? (
              <>
                <Pressable
                  style={[styles.secondaryBtn, appleHealthBusy && { opacity: 0.55 }]}
                  onPress={handleSyncAppleHealth}
                  disabled={appleHealthBusy || Platform.OS !== "ios"}
                >
                  <Text style={styles.secondaryBtnText}>{appleHealthBusy ? "Working..." : "Sync now"}</Text>
                </Pressable>
                <Pressable
                  style={[styles.outlineBtn, appleHealthBusy && { opacity: 0.55 }]}
                  onPress={handleDisconnectAppleHealth}
                  disabled={appleHealthBusy}
                >
                  <Text style={styles.outlineBtnText}>Disconnect</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.secondaryBtn, appleHealthBusy && { opacity: 0.55 }]}
                onPress={handleConnectAppleHealth}
                disabled={appleHealthBusy || Platform.OS !== "ios"}
              >
                <Text style={styles.secondaryBtnText}>{appleHealthBusy ? "Working..." : "Connect Apple Health"}</Text>
              </Pressable>
            )}
          </View>
        </GlassView>
        </>
        ) : null}

        {isCare ? (
        <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.card}>
          <Text style={styles.sectionTitle}>Role</Text>
          <Text style={[styles.desc, { marginBottom: 12 }]}>Tell Synapse who this setup is for so the app can stay context-aware.</Text>
          <View style={styles.roleRow}>
            {(["self", "caregiver", "backup"] as UserRole[]).map((roleOption) => {
              const active = activeRole === roleOption || (profile.userRole ?? "self") === roleOption;
              const label = roleOption === "self" ? "Self" : roleOption === "caregiver" ? "Caregiver" : "Backup Person";
              return (
                <Pressable
                  key={roleOption}
                  style={[styles.roleChip, active && styles.roleChipActive]}
                  onPress={() => updateRole(roleOption)}
                >
                  <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {activeRole === "caregiver" || (profile.userRole ?? "self") === "caregiver" ? (
            <View style={styles.rolePersonCard}>
              <View style={styles.rolePersonHeader}>
                <View style={styles.rolePersonAvatar}>
                  <Ionicons name="person-outline" size={22} color={C.tint} />
                </View>
                <View style={styles.rolePersonText}>
                  <Text style={styles.rolePersonEyebrow}>Care recipient</Text>
                  <Text style={styles.rolePersonName}>{caredForNameLabel}</Text>
                  <Text style={styles.rolePersonMeta}>{caredForAgeLabel}</Text>
                </View>
              </View>

              <View style={styles.rolePersonFieldRow}>
                <View style={styles.rolePersonFieldName}>
                  <Text style={styles.roleInlineLabel}>Name</Text>
                  <TextInput
                    style={styles.roleInlineInput}
                    value={profile.caredForName ?? ""}
                    onChangeText={(text) => {
                      setRoleDetailsEditing(true);
                      setProfile((prev) => ({ ...prev, caredForName: text }));
                    }}
                    placeholder="Name"
                    placeholderTextColor={C.textTertiary}
                  />
                </View>
                <View style={styles.rolePersonFieldAge}>
                  <Text style={styles.roleInlineLabel}>Age</Text>
                  <TextInput
                    style={styles.roleInlineInput}
                    value={profile.caredForAge != null ? String(profile.caredForAge) : ""}
                    onChangeText={(text) => {
                      setRoleDetailsEditing(true);
                      setProfile((prev) => ({
                        ...prev,
                        caredForAge: text.trim() ? Math.max(0, parseInt(text, 10) || 0) : undefined,
                      }));
                    }}
                    placeholder="Age"
                    placeholderTextColor={C.textTertiary}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={styles.rolePersonActionRow}>
                <Pressable
                  style={styles.roleCancelButton}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setProfile((prev) => ({
                      ...prev,
                      caredForName: caregiverProfile?.name || "",
                      caredForAge: caregiverProfile?.age || undefined,
                    }));
                    setRoleDetailsEditing(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing care recipient"
                >
                  <Text style={styles.roleCancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.personSaveButton, { flex: 1, marginTop: 0 }]} onPress={saveCareRecipientDetails}>
                  <Text style={styles.personSaveButtonText}>Save person</Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.roleRemoveButton}
                onPress={handleRemoveCaregiverMode}
                accessibilityRole="button"
                accessibilityLabel="Remove care recipient"
                testID="account-remove-care-recipient"
              >
                <Ionicons name="trash-outline" size={16} color={C.red} />
                <Text style={styles.roleRemoveButtonText}>Remove care recipient</Text>
              </Pressable>
            </View>
          ) : null}

          {(profile.userRole ?? "self") === "backup" ? (
            <View style={{ marginTop: 14, gap: 12 }}>
              <View>
                <Text style={styles.label}>Emergency protocols</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={profile.backupEmergencyProtocols ?? ""}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, backupEmergencyProtocols: text }))}
                  placeholder="What should a backup person know in an emergency?"
                  placeholderTextColor={C.textTertiary}
                  multiline
                />
              </View>
              <View>
                <Text style={styles.label}>Critical medications</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={(profile.backupCriticalMedications ?? []).map((item) => item.name).join("\n")}
                  onChangeText={(text) =>
                    setProfile((prev) => ({
                      ...prev,
                      backupCriticalMedications: text
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((name, index) => ({ id: `critical-${index}-${name}`, name })),
                    }))
                  }
                  placeholder="One per line, like emergency injection or rescue inhaler"
                  placeholderTextColor={C.textTertiary}
                  multiline
                />
              </View>
            </View>
          ) : null}

          {(profile.userRole ?? "self") === "backup" ? (
            <Pressable
              style={[styles.primaryBtn, { marginTop: 14 }]}
              onPress={() =>
                saveBackupRoleDetails({
                  caredForName: profile.caredForName?.trim() || undefined,
                  caredForAge: profile.userRole === "caregiver" && profile.caredForAge != null ? profile.caredForAge : undefined,
                  backupEmergencyProtocols: profile.backupEmergencyProtocols?.trim() || undefined,
                  backupCriticalMedications: (profile.backupCriticalMedications ?? []).filter((item) => item.name.trim()),
                })
              }
            >
              <Text style={styles.primaryBtnText}>Save role details</Text>
            </Pressable>
          ) : null}
          {renderCaregiverLinkingSection(false)}
        </GlassView>
        ) : null}

        {isIntegrations ? (
          <Pressable style={[styles.secondaryBtn, { marginBottom: 12 }]} onPress={() => onNavigate?.("editprofile")}>
            <Text style={styles.secondaryBtnText}>Backup & Restore</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      {caregiverOnboardingModal}
    </View>
  );
}

function makeStyles(C: Theme, themeId: string) {
  const solidModalSurface = modalSurface(C);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    scrollView: { flex: 1 },
    scrollViewContent: { flexGrow: 1 },
    title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 24 },
    simpleSettingsContent: { gap: 12 },
    simpleSettingsCard: { borderRadius: 28, padding: 20, gap: 14, overflow: "hidden", ...raised("md") },
    simpleSettingsSectionTitle: { fontWeight: "800", color: C.text, letterSpacing: -0.4 },
    simpleSettingsPrompt: { fontWeight: "600", color: C.textSecondary, marginBottom: 2 },
    simpleProfileRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    simpleProfileAvatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
    simpleProfileAvatarImage: { width: 82, height: 82, borderRadius: 41 },
    simpleProfileAvatarText: { fontWeight: "700", fontSize: 28, color: "#fff" },
    simpleProfileTextWrap: { flex: 1, minWidth: 0 },
    simpleProfileName: { fontWeight: "800", color: C.text, letterSpacing: -0.5 },
    simpleSettingsButtonRow: { flexDirection: "row", gap: 10 },
    simpleSettingsPrimaryButton: { minHeight: 54, paddingHorizontal: 18, borderRadius: 18, backgroundColor: C.tint, alignItems: "center", justifyContent: "center", flex: 1 },
    simpleSettingsPrimaryButtonText: { fontWeight: "800", color: "#fff", letterSpacing: -0.2 },
    simpleSettingsSecondaryButton: { minHeight: 54, paddingHorizontal: 18, borderRadius: 18, backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.3)", borderWidth: 1, borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)", alignItems: "center", justifyContent: "center", flex: 1 },
    simpleSettingsSecondaryButtonText: { fontWeight: "800", color: C.text, letterSpacing: -0.2 },
    simpleSettingsOptionStack: { gap: 10 },
    simpleSettingsOptionButton: { minHeight: 56, borderRadius: 18, backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.28)", borderWidth: 1, borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)", justifyContent: "center", paddingHorizontal: 18 },
    simpleSettingsOptionButtonActive: { borderColor: C.tint, backgroundColor: C.tintLight },
    simpleSettingsOptionText: { fontWeight: "700", color: C.textSecondary, letterSpacing: -0.2 },
    simpleSettingsOptionTextActive: { color: C.tint },
    simpleSettingsInputBlock: { gap: 10 },
    simpleSettingsInput: { minHeight: 56, borderRadius: 18, backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.34)", borderWidth: 1, borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)", paddingHorizontal: 18, color: C.text },
    simplePersonCard: {
      borderRadius: 24,
      padding: 14,
      gap: 12,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.26)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.82)",
      ...raised("sm"),
    },
    simplePersonHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    simplePersonAvatar: {
      width: 46,
      height: 46,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tintLight,
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.72)",
    },
    simplePersonText: { flex: 1, minWidth: 0 },
    simplePersonEyebrow: { fontWeight: "800", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
    simplePersonName: { fontWeight: "900", color: C.text, letterSpacing: -0.4 },
    simplePersonMeta: { fontWeight: "700", color: C.textSecondary, marginTop: 2 },
    simplePersonFieldRow: { flexDirection: "row", gap: 10 },
    simplePersonFieldName: { flex: 1.4, minWidth: 0 },
    simplePersonFieldAge: { flex: 0.8, minWidth: 86 },
    simpleSettingsToggleRow: { minHeight: 58, borderRadius: 18, backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.28)", borderWidth: 1, borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)", paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    simpleSettingsDangerWrap: { paddingTop: 6, marginTop: 10, borderTopWidth: 1, borderTopColor: C.border },
    simpleSettingsDangerButton: { minHeight: 56, borderRadius: 18, borderWidth: 1, borderColor: C.red + "55", alignItems: "center", justifyContent: "center", backgroundColor: C.surface },
    simpleSettingsDangerText: { fontWeight: "800", color: C.red, letterSpacing: -0.2 },
    editProfileLink: { fontWeight: "500", fontSize: 13, color: C.tint, marginTop: 4 },
    groupCard: { borderRadius: 30, padding: 18, marginBottom: 12, overflow: "hidden", ...raised("md") },
    groupHeader: { marginBottom: 14 },
    groupTitle: { fontWeight: "700", fontSize: 17, color: C.text },
    groupSubtitle: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 3 },
    tileGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    tileCard: {
      width: "48%",
      minHeight: 132,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.24)",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.78)",
      paddingHorizontal: 14,
      paddingVertical: 14,
      justifyContent: "flex-start",
      marginBottom: 12,
      ...raised("sm"),
    },
    tileIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    tileTitle: { fontWeight: "700", fontSize: 14, color: C.text, marginBottom: 4 },
    tileDesc: { fontWeight: "400", fontSize: 12, lineHeight: 17, color: C.textSecondary },
    card: { borderRadius: 28, padding: 20, marginBottom: 12, overflow: "hidden", ...raised("md") },
    cardGlass: { borderRadius: 28, marginBottom: 12, overflow: "hidden", ...raised("md") },
    cardPressable: { padding: 20 },
    sectionTitle: { fontWeight: "600", fontSize: 15, color: C.text, marginBottom: 4 },
    desc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginBottom: 14 },
    label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
    input: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.34)", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)" },
    textArea: { minHeight: 84, textAlignVertical: "top" },
    profileRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, minHeight: 50 },
    profileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    profileRowTitle: { fontWeight: "600", fontSize: 14, color: C.text },
    profileRowDesc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 2 },
    divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
    profileHeader: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
    profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
    profileAvatarImage: { width: 64, height: 64, borderRadius: 32 },
    profileAvatarText: { fontWeight: "600", fontSize: 22, color: "#fff" },
    profileInfo: { flex: 1, minWidth: 0 },
    profileGreeting: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginBottom: 2 },
    profileNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    profileFullName: { fontWeight: "700", fontSize: 18, color: C.text },
    editHint: { fontWeight: "500", fontSize: 12, color: C.textTertiary, marginTop: 4 },
    photoLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
    photoLinkText: { fontWeight: "600", fontSize: 13, color: C.tint },
    profileEmail: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 2 },
    statCardsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
    statCard: {
      flex: 1,
      backgroundColor: C.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.tint + "30",
      padding: 14,
      minHeight: 80,
      ...raised("sm"),
    },
    statCardLabel: { fontWeight: "600", fontSize: 12, color: C.textSecondary, marginTop: 6 },
    statCardValue: { fontWeight: "600", fontSize: 14, color: C.text, marginTop: 2 },
    accountRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center" },
    avatarText: { fontWeight: "600", fontSize: 16, color: C.tint },
    syncedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    syncedText: { fontWeight: "500", fontSize: 11, color: C.green },
    accountActions: { flexDirection: "row", gap: 10 },
    primaryBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    primaryBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
    secondaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.tintLight, alignItems: "center" },
    secondaryBtnText: { fontWeight: "600", fontSize: 14, color: C.tint },
    outlineBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" },
    outlineBtnText: { fontWeight: "600", fontSize: 14, color: C.text },
    backupActions: { flexDirection: "row", gap: 10, marginTop: 8 },
    embeddedLinkingSection: {
      marginTop: 22,
      paddingTop: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    linkHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    linkStatusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: C.tintLight, borderWidth: 1, borderColor: C.tint + "44" },
    linkStatusText: { fontWeight: "800", fontSize: 11, color: C.tint },
    linkStatusPillLinked: { backgroundColor: C.green + "18", borderColor: C.green + "55" },
    linkStatusTextLinked: { color: C.green },
    linkSection: { gap: 10, marginTop: 4 },
    linkLabel: { fontWeight: "700", fontSize: 13, color: C.textSecondary },
    linkHelpText: { fontWeight: "500", fontSize: 13, color: C.textTertiary, lineHeight: 18 },
    linkCodeBox: { borderRadius: 16, borderWidth: 1, borderColor: C.tint + "44", backgroundColor: C.tintLight, paddingHorizontal: 16, paddingVertical: 12 },
    linkCodeText: { fontWeight: "900", fontSize: 26, color: C.tint, letterSpacing: 4, textAlign: "center" },
    linkCodeMeta: { marginTop: 4, fontWeight: "700", fontSize: 11, color: C.textSecondary, textAlign: "center" },
    linkCodeBoxExpired: { backgroundColor: C.surface, borderColor: C.border },
    linkCodeTextExpired: { color: C.textTertiary },
    linkShareActions: { flexDirection: "row", gap: 10 },
    linkShareButton: { flex: 1.25, minHeight: 44, borderRadius: 12, backgroundColor: C.tint, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10 },
    linkShareButtonText: { fontWeight: "800", fontSize: 12, color: "#fff" },
    linkCopyButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: C.tintLight, borderWidth: 1, borderColor: C.tint + "33", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10 },
    linkCopyButtonText: { fontWeight: "800", fontSize: 12, color: C.tint },
    linkCopiedText: { fontWeight: "800", fontSize: 12, color: C.green, textAlign: "center" },
    linkRefreshButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 },
    linkRefreshText: { fontWeight: "800", fontSize: 12, color: C.tint },
    linkInput: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.34)", paddingHorizontal: 16, fontWeight: "900", fontSize: 18, color: C.text, letterSpacing: 2, textAlign: "center" },
    linkedUsersWrap: { gap: 8, marginTop: 4 },
    linkedUserRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.28)", padding: 10 },
    linkedUserIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.tintLight },
    linkedUserTitle: { fontWeight: "800", fontSize: 13, color: C.text },
    linkedUserMeta: { fontWeight: "600", fontSize: 10, color: C.textTertiary, marginTop: 2 },
    linkMiniButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", backgroundColor: C.surface },
    linkMiniButtonText: { fontWeight: "800", fontSize: 11, color: C.tint },
    caregiverOnboardingOverlay: {
      flex: 1,
      backgroundColor: modalOverlay(),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingVertical: 36,
    },
    caregiverOnboardingModal: {
      width: "100%",
      maxWidth: 460,
      maxHeight: "92%",
      borderRadius: 24,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: modalSurface(C),
      ...raised("lg"),
    },
    caregiverOnboardingModalContent: { padding: 22 },
    caregiverOnboardingTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    caregiverOnboardingIconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    caregiverOnboardingHeroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center", marginBottom: 18 },
    caregiverOnboardingTitle: { color: C.text, fontSize: 26, lineHeight: 31, fontWeight: "900", marginBottom: 10 },
    caregiverOnboardingBody: { color: C.textSecondary, fontSize: 16, lineHeight: 23, fontWeight: "500", marginBottom: 20 },
    caregiverTrustCallout: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, backgroundColor: C.green + "12", padding: 13, marginBottom: 22 },
    caregiverTrustCalloutText: { flex: 1, color: C.text, fontSize: 14, lineHeight: 19, fontWeight: "700" },
    caregiverOnboardingPrimary: { minHeight: 52, borderRadius: 14, backgroundColor: C.tint, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, marginTop: 12 },
    caregiverOnboardingPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "center" },
    caregiverOnboardingSecondary: { minHeight: 52, borderRadius: 14, backgroundColor: C.tintLight, borderWidth: 1, borderColor: C.tint + "33", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, marginTop: 12 },
    caregiverOnboardingSecondaryText: { color: C.tint, fontSize: 15, fontWeight: "800" },
    caregiverOnboardingTextButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 6 },
    caregiverOnboardingTextButtonText: { color: C.textSecondary, fontSize: 14, fontWeight: "700" },
    caregiverRoleChoice: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated, padding: 14, marginTop: 12 },
    caregiverRoleChoiceIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center" },
    caregiverRoleChoiceTitle: { color: C.text, fontSize: 15, fontWeight: "800", marginBottom: 3 },
    caregiverRoleChoiceBody: { color: C.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: "500" },
    caregiverBenefitRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 38 },
    caregiverBenefitText: { color: C.text, fontSize: 15, fontWeight: "600" },
    caregiverOnboardingError: { color: C.red, fontSize: 13, lineHeight: 18, fontWeight: "700", marginTop: 12 },
    caregiverOnboardingCodeBox: { borderRadius: 18, borderWidth: 1, borderColor: C.tint + "44", backgroundColor: C.tintLight, paddingHorizontal: 16, paddingVertical: 20, marginTop: 4 },
    caregiverOnboardingCode: { color: C.tint, fontSize: 32, fontWeight: "900", letterSpacing: 6, textAlign: "center" },
    caregiverOnboardingPrivacy: { color: C.textTertiary, fontSize: 13, lineHeight: 18, fontWeight: "600", textAlign: "center", marginTop: 12 },
    caregiverOnboardingActionRow: { flexDirection: "row", gap: 10 },
    caregiverOnboardingHalfButton: { flex: 1 },
    caregiverOnboardingInput: { minHeight: 62, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated, color: C.text, fontSize: 24, fontWeight: "900", letterSpacing: 5, textAlign: "center", paddingHorizontal: 16, marginVertical: 6 },
    roleRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    roleChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.3)",
    },
    roleChipActive: { borderColor: C.tint, backgroundColor: C.tintLight },
    roleChipText: { color: C.textSecondary, fontWeight: "600", fontSize: 13 },
    roleChipTextActive: { color: C.tint },
    rolePersonCard: {
      marginTop: 14,
      borderRadius: 24,
      padding: 14,
      gap: 12,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.26)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.82)",
      ...raised("sm"),
    },
    rolePersonHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    rolePersonAvatar: {
      width: 52,
      height: 52,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tintLight,
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.72)",
    },
    rolePersonText: { flex: 1, minWidth: 0 },
    rolePersonEyebrow: { fontWeight: "800", fontSize: 11, color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
    rolePersonName: { fontWeight: "900", fontSize: 20, color: C.text, letterSpacing: -0.5 },
    rolePersonMeta: { fontWeight: "700", fontSize: 13, color: C.textSecondary, marginTop: 2 },
    rolePersonFieldRow: { flexDirection: "row", gap: 10 },
    rolePersonFieldName: { flex: 1.4, minWidth: 0 },
    rolePersonFieldAge: { flex: 0.8, minWidth: 86 },
    roleEditButton: {
      minHeight: 38,
      paddingHorizontal: 12,
      borderRadius: 999,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: C.tintLight,
      borderWidth: 1,
      borderColor: C.tint + "35",
    },
    roleEditButtonText: { fontWeight: "900", fontSize: 12, color: C.tint },
    roleInlineLabel: { fontWeight: "800", fontSize: 11, color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
    roleInlineInput: {
      minHeight: 50,
      borderRadius: 16,
      paddingHorizontal: 14,
      fontWeight: "700",
      fontSize: 14,
      color: C.text,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.34)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)",
    },
    personSaveButton: {
      minHeight: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tint,
      ...raised("sm"),
    },
    personSaveButtonText: { fontWeight: "900", fontSize: 14, color: "#fff", letterSpacing: -0.2 },
    rolePersonActionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    roleCancelButton: {
      minHeight: 48,
      minWidth: 96,
      paddingHorizontal: 16,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)",
    },
    roleCancelButtonText: { fontWeight: "800", fontSize: 14, color: C.text },
    roleRemoveButton: {
      marginTop: 2,
      minHeight: 48,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: C.red,
      backgroundColor: C.redLight,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
    },
    roleRemoveButtonText: { fontWeight: "800", fontSize: 14, color: C.red },
    localHint: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginBottom: 12 },
    toggleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: C.surfaceElevated, justifyContent: "center", paddingHorizontal: 3 },
    toggleActive: { backgroundColor: C.tint },
    toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
    toggleThumbActive: { alignSelf: "flex-end" },
    saveBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
    saveBtnSaved: { backgroundColor: C.tint },
    saveBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
    overlay: { flex: 1, backgroundColor: modalOverlay(), justifyContent: "center", alignItems: "center", padding: 24 },
    modalActions: { flexDirection: "row", gap: 10 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
    cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
    resetAppBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 28, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: C.red + "30" },
    resetAppText: { fontWeight: "500", fontSize: 14, color: C.red },
    resetModal: { backgroundColor: solidModalSurface, borderRadius: 22, padding: 28, width: "100%", maxWidth: 320, borderWidth: 1, borderColor: C.border, alignItems: "center", ...raised("lg") },
    resetEmoji: { fontSize: 56, marginBottom: 16 },
    resetTitle: { fontWeight: "700", fontSize: 20, color: C.text, marginBottom: 8, textAlign: "center" },
    resetDesc: { fontWeight: "400", fontSize: 15, color: C.textSecondary, textAlign: "center", marginBottom: 24, lineHeight: 22 },
    resetConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.red, alignItems: "center" },
    resetConfirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
    appearanceModal: { maxWidth: 420, alignItems: "stretch" },
    notificationOption: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)",
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.28)",
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    appearanceGroupTitle: { fontWeight: "700", fontSize: 13, color: C.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.6 },
    sectionCheckbox: {
      width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: C.border,
      alignItems: "center", justifyContent: "center", backgroundColor: C.surface, marginRight: 12,
    },
    sectionCheckboxActive: { backgroundColor: C.tint, borderColor: C.tint },
    // Appearance / theme selector
    themeOption: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    themeOptionSelected: {
      borderColor: C.tint,
      backgroundColor: C.tintLight,
    },
    themeOptionContent: { flexDirection: "row", alignItems: "center", gap: 12 },
    themeRadio: {
      width: 20, height: 20, borderRadius: 10,
      borderWidth: 2, borderColor: C.border,
      alignItems: "center", justifyContent: "center",
    },
    themeRadioSelected: { borderColor: C.tint },
    themeRadioDot: {
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: C.tint,
    },
    themeOptionLabel: { fontWeight: "600", fontSize: 14, color: C.text },
    themeOptionDesc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 1 },
  });
}
