import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, Platform, Alert, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { pharmacyStorage, type Pharmacy } from "@/lib/storage";

interface PharmaciesScreenProps {
  onBack: () => void;
}

export default function PharmaciesScreen({ onBack }: PharmaciesScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState<Pharmacy | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [hospital, setHospital] = useState("");

  const loadPharmacies = useCallback(async () => {
    const list = await pharmacyStorage.getAll();
    setPharmacies(list.sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  useEffect(() => {
    loadPharmacies();
  }, [loadPharmacies]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setAddress("");
    setHospital("");
    setEditingPharmacy(null);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (pharmacy: Pharmacy) => {
    setEditingPharmacy(pharmacy);
    setName(pharmacy.name);
    setPhone(pharmacy.phone ?? "");
    setAddress(pharmacy.address ?? "");
    setHospital(pharmacy.hospital ?? "");
    setShowModal(true);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const payload = {
      name: trimmedName,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      hospital: hospital.trim() || undefined,
    };

    if (editingPharmacy) {
      await pharmacyStorage.update(editingPharmacy.id, payload);
    } else {
      await pharmacyStorage.addOrGet(payload);
    }

    await loadPharmacies();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeModal();
  };

  const handleDelete = (pharmacy: Pharmacy) => {
    if (Platform.OS === "web") {
      pharmacyStorage.delete(pharmacy.id).then(() => loadPharmacies());
      return;
    }
    Alert.alert("Remove pharmacy", `Remove ${pharmacy.name} from your list?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await pharmacyStorage.delete(pharmacy.id);
          await loadPharmacies();
        },
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back to Account">
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Pharmacies</Text>
        <Pressable style={styles.addBtn} onPress={openAddModal} accessibilityRole="button" accessibilityLabel="Add pharmacy">
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hint}>Add pharmacies here, then choose them from the Medications screen when tracking refills.</Text>

        {pharmacies.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="storefront-outline" size={48} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No pharmacies yet</Text>
            <Text style={styles.emptyDesc}>Tap + to add your first pharmacy.</Text>
          </View>
        ) : (
          pharmacies.map((pharmacy) => (
            <Pressable
              key={pharmacy.id}
              style={styles.card}
              onPress={() => openEditModal(pharmacy)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${pharmacy.name}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{pharmacy.name}</Text>
                {pharmacy.hospital ? <Text style={styles.cardMeta}>{pharmacy.hospital}</Text> : null}
                {pharmacy.phone ? <Text style={styles.cardMeta}>{pharmacy.phone}</Text> : null}
                {pharmacy.address ? <Text style={styles.cardMeta} numberOfLines={2}>{pharmacy.address}</Text> : null}
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  style={styles.iconBtn}
                  onPress={(event) => {
                    event.stopPropagation();
                    if (pharmacy.phone?.trim()) Linking.openURL(`tel:${pharmacy.phone.replace(/\s/g, "")}`);
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={pharmacy.phone ? `Call ${pharmacy.name}` : `No phone saved for ${pharmacy.name}`}
                >
                  <Ionicons name="call-outline" size={20} color={pharmacy.phone ? C.tint : C.textTertiary} />
                </Pressable>
                <Pressable
                  style={styles.iconBtn}
                  onPress={(event) => {
                    event.stopPropagation();
                    if (pharmacy.address?.trim()) Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(pharmacy.address)}`);
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={pharmacy.address ? `Directions to ${pharmacy.name}` : `No address saved for ${pharmacy.name}`}
                >
                  <Ionicons name="navigate-outline" size={20} color={pharmacy.address ? C.tint : C.textTertiary} />
                </Pressable>
                <Pressable
                  style={styles.iconBtn}
                  onPress={(event) => { event.stopPropagation(); handleDelete(pharmacy); }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${pharmacy.name}`}
                >
                  <Ionicons name="trash-outline" size={20} color={C.textTertiary} />
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={closeModal}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>{editingPharmacy ? "Edit pharmacy" : "Add pharmacy"}</Text>
            <Text style={styles.label}>Pharmacy name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. CVS Pharmacy"
              placeholderTextColor={C.textTertiary}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. (555) 123-4567"
              placeholderTextColor={C.textTertiary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Pharmacy address"
              placeholderTextColor={C.textTertiary}
              value={address}
              onChangeText={setAddress}
              multiline
            />
            <Text style={styles.label}>Hospital</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mount Sinai"
              placeholderTextColor={C.textTertiary}
              value={hospital}
              onChangeText={setHospital}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, !name.trim() && { opacity: 0.5 }]} onPress={handleSave} disabled={!name.trim()}>
                <Text style={styles.confirmText}>{editingPharmacy ? "Save" : "Add"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingBottom: 16 },
    backBtn: { marginRight: 12, padding: 4 },
    title: { flex: 1, fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5 },
    addBtn: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 24, paddingBottom: 24 },
    hint: { fontSize: 13, color: C.textTertiary, marginBottom: 20 },
    empty: { alignItems: "center", paddingVertical: 80, gap: 8 },
    emptyTitle: { fontWeight: "600", fontSize: 17, color: C.text, marginTop: 16 },
    emptyDesc: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginTop: 8, textAlign: "center" },
    card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
    cardTitle: { fontWeight: "700", fontSize: 16, color: C.text },
    cardMeta: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
    cardActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconBtn: { padding: 2 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
    modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: C.border },
    modalTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 16 },
    label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
    input: { fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
    inputMultiline: { minHeight: 74, textAlignVertical: "top" },
    modalActions: { flexDirection: "row", gap: 10 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
    cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
    confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.tint, alignItems: "center" },
    confirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
  });
}
