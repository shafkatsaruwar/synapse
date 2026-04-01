import React, { useCallback, useEffect, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  allergyStorage,
  conditionStorage,
  doctorsStorage,
  emergencyDoctorStorage,
  healthProfileStorage,
  settingsStorage,
  type AllergyInfo,
  type Doctor,
  type HealthCondition,
  type HealthProfileInfo,
  type UserSettings,
} from "@/lib/storage";
import { getMedList, type MedListItem } from "@/lib/med-list-storage";

const MAROON = "#800020";
const BG = "#FFFFFF";
const SURFACE = "#F5F5F5";
const DIVIDER = "#DDDDDD";
const TEXT_PRIMARY = "#111111";
const TEXT_SECONDARY = "#444444";
const RED_BG = "#FFF0F0";
const RED_BORDER = "#CC0000";

interface EmergencyProtocolScreenProps {
  onBack: () => void;
}

export default function EmergencyProtocolScreen({ onBack }: EmergencyProtocolScreenProps) {
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [profile, setProfile] = useState<HealthProfileInfo>({});
  const [conditions, setConditions] = useState<HealthCondition[]>([]);
  const [allergy, setAllergy] = useState<AllergyInfo | null>(null);
  const [meds, setMeds] = useState<MedListItem[]>([]);
  const [emergencyDoctor, setEmergencyDoctor] = useState<Doctor | null>(null);

  const loadData = useCallback(async () => {
    const [s, p, conds, a, medList, docs, emergencyDocId] = await Promise.all([
      settingsStorage.get(),
      healthProfileStorage.get(),
      conditionStorage.getAll(),
      allergyStorage.get(),
      getMedList(),
      doctorsStorage.getAll(),
      emergencyDoctorStorage.getDocId(),
    ]);
    setSettings(s);
    setProfile(p);
    setConditions(conds);
    setAllergy(a);
    setMeds(medList);
    setEmergencyDoctor(emergencyDocId ? (docs.find((d) => d.id === emergencyDocId) ?? null) : null);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [editingAge, setEditingAge] = useState(false);
  const [editAgeText, setEditAgeText] = useState("");

  const openAgeEdit = () => {
    setEditAgeText(profile.age != null ? String(profile.age) : "");
    setEditingAge(true);
  };

  const saveAge = async () => {
    const parsed = editAgeText.trim() === "" ? undefined : parseInt(editAgeText, 10);
    const newAge = parsed != null && !isNaN(parsed) ? parsed : undefined;
    await healthProfileStorage.save({ age: newAge });
    setProfile((p) => ({ ...p, age: newAge }));
    setEditingAge(false);
  };

  const callNumber = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;

  // Derive unique pharmacies from med list
  const pharmacies = (() => {
    const seen = new Set<string>();
    const result: { name: string; phone: string }[] = [];
    for (const m of meds) {
      const name = m.pharmacyName?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        result.push({ name, phone: m.pharmacyPhone?.trim() ?? "" });
      }
    }
    return result;
  })();

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={TEXT_PRIMARY} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.headerRow}>
          <Ionicons name="shield-half" size={30} color={MAROON} />
          <Text style={styles.pageTitle}>Emergency Protocol</Text>
        </View>
        <Text style={styles.pageSubtitle}>Critical medical information for first responders</Text>

        {/* ── Basic Info ── */}
        <Section title="Basic Info">
          <InfoRow label="Name" value={settings?.name || "—"} />
          <Divider />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age</Text>
            {profile.age != null ? (
              <Pressable style={styles.ageValueRow} onPress={openAgeEdit} accessibilityRole="button" accessibilityLabel="Edit age">
                <Text style={styles.infoValue}>{profile.age} years old</Text>
                <Ionicons name="pencil-outline" size={16} color={TEXT_SECONDARY} style={{ marginLeft: 6 }} />
              </Pressable>
            ) : (
              <Pressable onPress={openAgeEdit} accessibilityRole="button" accessibilityLabel="Add age">
                <Text style={styles.ageNotSet}>Age not set — tap to add</Text>
              </Pressable>
            )}
          </View>
        </Section>

        {/* ── Medical Conditions ── */}
        <Section title="Medical Conditions">
          {conditions.length === 0 ? (
            <Text style={styles.emptyText}>No conditions saved</Text>
          ) : (
            conditions.map((c, i) => (
              <React.Fragment key={c.id}>
                {i > 0 && <Divider />}
                <View style={styles.conditionRow}>
                  <Text style={styles.conditionName}>{c.name}</Text>
                  {c.requiresStressDose && (
                    <View style={styles.stressBadge}>
                      <Text style={styles.stressBadgeText}>Stress Dose</Text>
                    </View>
                  )}
                </View>
              </React.Fragment>
            ))
          )}
        </Section>

        {/* ── Allergies ── */}
        <View style={[styles.section, styles.allergySection]}>
          <Text style={[styles.sectionTitle, { color: RED_BORDER }]}>Allergies</Text>
          {!allergy?.hasAllergies ? (
            <Text style={styles.emptyText}>No allergies recorded</Text>
          ) : (
            <>
              <Text style={styles.allergyName}>{allergy.allergyName || "Allergy recorded"}</Text>
              {allergy.reactionDescription ? (
                <Text style={styles.allergyDesc}>{allergy.reactionDescription}</Text>
              ) : null}
              {allergy.hasEpiPen && (
                <View style={styles.epiPenRow}>
                  <Ionicons name="medkit" size={18} color={RED_BORDER} />
                  <Text style={styles.epiPenText}>
                    {"EpiPen"}
                    {allergy.primaryEpiPenLocation ? ` — ${allergy.primaryEpiPenLocation}` : ""}
                  </Text>
                </View>
              )}
              {allergy.noTreatmentConsequence ? (
                <Text style={styles.consequenceText}>
                  {"Without treatment: "}
                  {allergy.noTreatmentConsequence}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* ── Medications ── */}
        <Section title="Medications">
          {meds.length === 0 ? (
            <Text style={styles.emptyText}>No medications saved</Text>
          ) : (
            meds.map((m, i) => (
              <React.Fragment key={m.id}>
                {i > 0 && <Divider />}
                <View style={styles.medRow}>
                  <Text style={styles.medName}>{m.name}</Text>
                  {m.doses.map((d, di) => (
                    <Text key={di} style={styles.medDose}>
                      {d.dosage ? `${d.dosage} · ${d.time}` : d.time}
                    </Text>
                  ))}
                </View>
              </React.Fragment>
            ))
          )}
        </Section>

        {/* ── Emergency Contact ── */}
        <Section title="Emergency Contact">
          <Text style={styles.emptyText}>No emergency contact saved</Text>
        </Section>

        {/* ── Doctor ── */}
        <Section title="Primary Emergency Doctor">
          {emergencyDoctor ? (
            <View style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{emergencyDoctor.name}</Text>
                {emergencyDoctor.specialty ? (
                  <Text style={styles.contactDetail}>{emergencyDoctor.specialty}</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No emergency doctor set — tap to designate one in Settings
            </Text>
          )}
        </Section>

        {/* ── Pharmacy ── */}
        <Section title="Pharmacy">
          {pharmacies.length === 0 ? (
            <Text style={styles.emptyText}>No pharmacy saved</Text>
          ) : (
            pharmacies.map((p, i) => (
              <React.Fragment key={p.name}>
                {i > 0 && <Divider />}
                <View style={styles.contactRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{p.name}</Text>
                    {p.phone ? <Text style={styles.contactDetail}>{p.phone}</Text> : null}
                  </View>
                  {p.phone ? (
                    <Pressable
                      style={({ pressed }) => [styles.callBtn, { opacity: pressed ? 0.85 : 1 }]}
                      onPress={() => callNumber(p.phone)}
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${p.name}`}
                    >
                      <Ionicons name="call" size={16} color="#fff" />
                      <Text style={styles.callBtnText}>Call</Text>
                    </Pressable>
                  ) : null}
                </View>
              </React.Fragment>
            ))
          )}
        </Section>
      </ScrollView>

      <Modal visible={editingAge} transparent animationType="fade" onRequestClose={() => setEditingAge(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditingAge(false)}>
          <Pressable style={styles.modalBox} onPress={() => {}}>
            <Text style={styles.modalTitle}>Edit Age</Text>
            <TextInput
              style={styles.modalInput}
              value={editAgeText}
              onChangeText={(t) => setEditAgeText(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="Enter age"
              placeholderTextColor={TEXT_SECONDARY}
              maxLength={3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setEditingAge(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={saveAge}>
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 20 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  backText: { fontWeight: "600", fontSize: 16, color: TEXT_PRIMARY },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  pageTitle: { fontWeight: "800", fontSize: 26, color: TEXT_PRIMARY, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 15, color: TEXT_SECONDARY, marginBottom: 24, lineHeight: 22 },

  section: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: DIVIDER,
  },
  allergySection: {
    backgroundColor: RED_BG,
    borderColor: RED_BORDER,
    borderWidth: 2,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 20,
    color: TEXT_PRIMARY,
    marginBottom: 14,
  },

  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  infoLabel: { fontWeight: "600", fontSize: 16, color: TEXT_SECONDARY },
  infoValue: { fontWeight: "700", fontSize: 18, color: TEXT_PRIMARY },

  divider: { height: 1, backgroundColor: DIVIDER, marginVertical: 10 },
  emptyText: { fontSize: 16, color: TEXT_SECONDARY, fontStyle: "italic" },

  conditionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  conditionName: { fontWeight: "600", fontSize: 17, color: TEXT_PRIMARY, flex: 1 },
  stressBadge: { backgroundColor: MAROON + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  stressBadgeText: { fontWeight: "600", fontSize: 12, color: MAROON },

  allergyName: { fontWeight: "800", fontSize: 22, color: RED_BORDER, marginBottom: 8 },
  allergyDesc: { fontSize: 16, color: TEXT_PRIMARY, lineHeight: 24, marginBottom: 10 },
  epiPenRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, backgroundColor: "#FFE5E5", borderRadius: 8, padding: 10 },
  epiPenText: { fontWeight: "700", fontSize: 16, color: RED_BORDER },
  consequenceText: { fontSize: 15, color: TEXT_PRIMARY, lineHeight: 22, marginTop: 6, fontStyle: "italic" },

  medRow: { paddingVertical: 6 },
  medName: { fontWeight: "700", fontSize: 18, color: TEXT_PRIMARY, marginBottom: 4 },
  medDose: { fontSize: 15, color: TEXT_SECONDARY, marginLeft: 4, lineHeight: 22 },

  contactRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 12 },
  contactName: { fontWeight: "700", fontSize: 18, color: TEXT_PRIMARY },
  contactDetail: { fontSize: 15, color: TEXT_SECONDARY, marginTop: 2 },

  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: MAROON,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  callBtnText: { fontWeight: "700", fontSize: 16, color: "#fff" },

  ageValueRow: { flexDirection: "row", alignItems: "center" },
  ageNotSet: { fontSize: 16, color: TEXT_SECONDARY, fontStyle: "italic", textDecorationLine: "underline" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 32 },
  modalBox: { backgroundColor: "#fff", borderRadius: 18, padding: 24, width: "100%", maxWidth: 320 },
  modalTitle: { fontWeight: "700", fontSize: 20, color: TEXT_PRIMARY, marginBottom: 16, textAlign: "center" },
  modalInput: { fontSize: 32, fontWeight: "700", color: TEXT_PRIMARY, textAlign: "center", borderBottomWidth: 2, borderBottomColor: MAROON, paddingVertical: 8, marginBottom: 24 },
  modalActions: { flexDirection: "row", gap: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#F0F0F0", alignItems: "center" },
  modalCancelText: { fontWeight: "600", fontSize: 15, color: TEXT_SECONDARY },
  modalSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: MAROON, alignItems: "center" },
  modalSaveText: { fontWeight: "600", fontSize: 15, color: "#fff" },
});
