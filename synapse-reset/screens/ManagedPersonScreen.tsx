import React, { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { useCareProfiles } from "@/contexts/CareProfileContext";
import { useRole } from "@/contexts/RoleContext";
import TextInput from "@/components/DoneTextInput";
import { Body, Card, Notice, Pill, PrimaryButton, Row, ScreenHeader, SecondaryButton, SectionLabel } from "@/components/care/ui";
import { ContactHoursEditor, TimeZoneField } from "@/components/care/pickers";
import CaregiverSetupFlow from "@/components/care/CaregiverSetupFlow";
import { profileAgeLabel, removeLegacyCopies } from "@/lib/care/profiles";
import type { LocalCareProfile } from "@/lib/care/types";

interface ManagedPersonScreenProps {
  onBack?: () => void;
  onRemoved?: () => void;
  onNavigate?: (key: string) => void;
}

/** "People I Care For": every caregiver-managed profile on this iPhone, and the editor for one. */
export default function ManagedPersonScreen({ onBack, onRemoved, onNavigate }: ManagedPersonScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors: C } = useTheme();
  const { profiles, activeProfile, switchProfile, deleteProfile, updateProfile } = useCareProfiles();
  const { refreshRole } = useRole();
  const managed = profiles.filter((p) => p.type === "caregiver_managed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const editing = managed.find((p) => p.id === editingId) ?? null;
  const topPad = width >= 768 ? 28 : Platform.OS === "web" ? 40 : insets.top + 10;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: width >= 768 ? 40 : insets.bottom + 118 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {editing ? (
        <Editor
          profile={editing}
          isActive={activeProfile.id === editing.id}
          onBack={() => setEditingId(null)}
          onSwitch={async () => { await switchProfile(editing.id); void Haptics.selectionAsync(); onNavigate?.("dashboard"); }}
          onSave={async (patch) => { await updateProfile(editing.id, patch); await refreshRole(); }}
          onDelete={async () => { await deleteProfile(editing.id); await refreshRole(); setEditingId(null); if (managed.length <= 1) onRemoved?.(); }}
        />
      ) : (
        <>
          <ScreenHeader title="People I Care For" subtitle="Each person keeps their own medications, appointments, and records on this iPhone." onBack={onBack} />
          <Card>
            {managed.length === 0 ? <Body>You haven't added anyone yet.</Body> : null}
            {managed.map((p) => (
              <Row key={p.id} icon="person-outline" title={p.displayName} subtitle={[p.relationship, profileAgeLabel(p), p.id === activeProfile.id ? "Viewing now" : null].filter(Boolean).join(" · ") || "On this iPhone"} onPress={() => setEditingId(p.id)} right={p.id === activeProfile.id ? <Pill label="Viewing" tone="good" /> : undefined} />
            ))}
          </Card>
          <View style={{ gap: 10, marginTop: 12 }}>
            <PrimaryButton label="Add someone" icon="person-add-outline" onPress={() => setSetupOpen(true)} />
            <SecondaryButton label="Care Connections" icon="link-outline" onPress={() => onNavigate?.("careconnections")} />
          </View>
          <Notice>Everything for a person stays in their own profile. Nothing is mixed with your own health information.</Notice>
        </>
      )}
      <CaregiverSetupFlow
        visible={setupOpen}
        onClose={() => setSetupOpen(false)}
        onConnect={() => onNavigate?.("careconnections")}
      />
    </ScrollView>
  );
}

function Editor({ profile, isActive, onBack, onSwitch, onSave, onDelete }: { profile: LocalCareProfile; isActive: boolean; onBack: () => void; onSwitch: () => void; onSave: (patch: Partial<LocalCareProfile>) => Promise<void>; onDelete: () => Promise<void> }) {
  const { colors: C } = useTheme();
  const [name, setName] = useState(profile.displayName);
  const [relation, setRelation] = useState(profile.relationship ?? "");
  const [age, setAge] = useState(profile.legacyAge ? String(profile.legacyAge) : "");
  useEffect(() => {
    setName(profile.displayName);
    setRelation(profile.relationship ?? "");
    setAge(profile.legacyAge ? String(profile.legacyAge) : "");
  }, [profile]);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Add their name.");
      return;
    }
    await onSave({ displayName: name.trim(), relationship: relation.trim() || undefined, legacyAge: profile.dateOfBirth ? profile.legacyAge : age.trim() ? Math.max(0, parseInt(age, 10) || 0) : undefined });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const cleanLegacy = () =>
    Alert.alert(
      "Clean up your own lists?",
      `Older versions kept ${profile.displayName}'s medications and appointments in your own lists. They've been copied here. This removes those older copies from your own lists. Nothing is removed from ${profile.displayName}'s profile.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clean up", style: "destructive", onPress: async () => { const r = await removeLegacyCopies(profile.id); Alert.alert("Done", `Removed ${r.medications} medication${r.medications === 1 ? "" : "s"} and ${r.appointments} appointment${r.appointments === 1 ? "" : "s"} from your own lists.`); } },
      ],
    );

  const confirmDelete = () =>
    Alert.alert(
      `Delete ${profile.displayName}'s profile?`,
      "This permanently deletes their medications, appointments, records, and Check-In settings from this iPhone. It can't be undone, and it doesn't affect anyone else's phone.",
      [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void onDelete() }],
    );

  return (
    <>
      <ScreenHeader title={profile.displayName} subtitle="Caregiver-managed profile on this iPhone" onBack={onBack} />
      <Card>
        <PrimaryButton label={isActive ? "Viewing this profile" : `View ${profile.displayName}'s health`} onPress={onSwitch} disabled={isActive} icon="eye-outline" />
      </Card>
      <SectionLabel>Details</SectionLabel>
      <Card>
        <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={C.textTertiary} style={fieldStyle(C)} accessibilityLabel="Name" />
        {profile.dateOfBirth ? <Row title="Date of birth" subtitle={profile.dateOfBirth} /> : <TextInput value={age} onChangeText={setAge} placeholder="Age" placeholderTextColor={C.textTertiary} keyboardType="number-pad" style={fieldStyle(C)} accessibilityLabel="Age" />}
        <TextInput value={relation} onChangeText={setRelation} placeholder="Relationship (optional)" placeholderTextColor={C.textTertiary} style={fieldStyle(C)} accessibilityLabel="Relationship" />
        <PrimaryButton label="Save" onPress={save} />
      </Card>
      <SectionLabel>Time zones</SectionLabel>
      <Card>
        <TimeZoneField value={profile.timeZone} onChange={(tz) => onSave({ timeZone: tz })} label="Where they live" />
        <TimeZoneField value={profile.medScheduleTimeZone} onChange={(tz) => onSave({ medScheduleTimeZone: tz })} label="Their medication times are in" />
        <Body>Medication times are read in their medication time zone, so Check-In reminders stay right even when you're in a different time zone, and across daylight saving changes.</Body>
        <ContactHoursEditor value={profile.contactHours} onChange={(v) => onSave({ contactHours: v })} />
      </Card>
      <SectionLabel>Care role</SectionLabel>
      <Card>
        <Row title={profile.guardianClaim === "self_declared" ? "Parent or guardian (self-declared)" : "Caregiver"} subtitle="Synapse can't verify legal guardianship, so this is never shown as verified." />
      </Card>
      <SectionLabel>Housekeeping</SectionLabel>
      <View style={{ gap: 10 }}>
        <SecondaryButton label="Remove older copies from my own lists" icon="layers-outline" onPress={cleanLegacy} />
        <SecondaryButton label="Delete this profile" icon="trash-outline" destructive onPress={confirmDelete} />
      </View>
    </>
  );
}

const fieldStyle = (C: { text: string; border: string; surfaceElevated: string }) => ({ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated, paddingHorizontal: 12, fontSize: 16, color: C.text }) as const;
