import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useCareProfiles } from "@/contexts/CareProfileContext";
import { profileAgeLabel } from "@/lib/care/profiles";
import { Pill } from "./ui";

/**
 * Always visible while someone else's profile is open, so it's never unclear whose records are on screen.
 * Also the way back to your own health.
 */
export default function ActiveProfileBanner() {
  const { colors: C } = useTheme();
  const { activeProfile, viewingOther, profiles, switchProfile } = useCareProfiles();
  const [open, setOpen] = useState(false);
  const choices = profiles.filter((p) => p.type !== "connected_reference");
  if (!viewingOther && choices.length <= 1) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.bar, { backgroundColor: viewingOther ? C.tintLight : C.surfaceElevated, borderColor: viewingOther ? C.tint : C.border }]}
        accessibilityRole="button"
        accessibilityLabel={viewingOther ? `Viewing ${activeProfile.displayName}'s profile. Tap to switch.` : "Viewing your own health. Tap to switch profile."}
      >
        <Ionicons name={viewingOther ? "eye-outline" : "person-outline"} size={16} color={viewingOther ? C.tint : C.textSecondary} />
        <Text style={[styles.text, { color: C.text }]} numberOfLines={1}>
          {viewingOther ? `Viewing ${activeProfile.displayName}` : "Your health"}
        </Text>
        <Text style={[styles.switch, { color: C.tint }]}>Switch</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close">
          <View style={[styles.sheet, { backgroundColor: C.background, borderColor: C.border }]}>
            <Text style={[styles.sheetTitle, { color: C.text }]} accessibilityRole="header">Whose health are you viewing?</Text>
            <ScrollView>
              {choices.map((p) => {
                const on = p.id === activeProfile.id;
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.option, { borderColor: C.border }]}
                    onPress={async () => { await switchProfile(p.id); setOpen(false); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${p.type === "self" ? "My own health" : p.displayName}${on ? ", selected" : ""}`}
                  >
                    <Ionicons name={p.type === "self" ? "person-circle-outline" : "person-outline"} size={22} color={C.tint} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, { color: C.text }]}>{p.type === "self" ? "My own health" : p.displayName}</Text>
                      <Text style={{ color: C.textSecondary, fontSize: 12 }}>{p.type === "self" ? "Your records" : [p.relationship, profileAgeLabel(p), "On this iPhone"].filter(Boolean).join(" · ")}</Text>
                    </View>
                    {on ? <Pill label="Viewing" tone="good" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 6, marginBottom: 2, paddingHorizontal: 12, minHeight: 40, borderRadius: 14, borderWidth: 1 },
  text: { flex: 1, fontWeight: "700", fontSize: 13 },
  switch: { fontWeight: "700", fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "70%", borderWidth: 1 },
  sheetTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56 },
  optionTitle: { fontWeight: "700", fontSize: 15 },
});
