import React, { useState, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Modal, Platform, useWindowDimensions, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { documentStorage, medicationStorage, medComparisonStorage, type DocumentExtraction } from "@/lib/storage";
import { analyzeDocument, compareMedications } from "@/lib/api";
import { formatDate, getToday } from "@/lib/date-utils";

const C = Colors.dark;

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [documents, setDocuments] = useState<DocumentExtraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<DocumentExtraction | null>(null);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [showComparison, setShowComparison] = useState(false);

  const loadData = useCallback(async () => {
    const docs = await documentStorage.getAll();
    setDocuments(docs.sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const pickAndAnalyze = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.base64) return;

      setLoading(true);
      setLoadingMsg("Analyzing document...");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const asset = result.assets[0];
      const mimeType = asset.mimeType || "image/jpeg";
      const analysis = await analyzeDocument(asset.base64, mimeType);

      setLoadingMsg("Saving results...");
      const saved = await documentStorage.save({
        date: getToday(),
        imageUri: asset.uri,
        diagnoses: analysis.diagnoses || [],
        medications: analysis.medications || [],
        labResults: analysis.labResults || [],
        followUpDates: analysis.followUpDates || [],
        doctorInstructions: analysis.doctorInstructions || [],
        summary: analysis.summary || "Document analyzed",
      });

      if (analysis.medications?.length > 0) {
        setLoadingMsg("Comparing medications...");
        const currentMeds = await medicationStorage.getAll();
        const activeMeds = currentMeds.filter((m) => m.active);
        if (activeMeds.length > 0) {
          const comparison = await compareMedications(
            activeMeds.map((m) => ({ name: m.name, dosage: m.dosage, frequency: Array.isArray(m.timeTag) ? m.timeTag.join(", ") : m.timeTag })),
            analysis.medications
          );
          await medComparisonStorage.save({
            date: getToday(),
            documentId: saved.id,
            newMeds: comparison.new || [],
            stoppedMeds: comparison.stopped || [],
            doseChanged: comparison.doseChanged || [],
            unchanged: comparison.unchanged || [],
            summary: comparison.summary || "Comparison complete",
          });
          setComparisonResult(comparison);
          setShowComparison(true);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to analyze document");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Document", "Remove this extracted document?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await documentStorage.delete(id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setSelectedDoc(null);
        loadData();
      }},
    ]);
  };

  const flagColor = (flag: string) => {
    if (flag === "high") return C.red;
    if (flag === "low") return C.orange;
    return C.green;
  };

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, {
        paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
        paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
      }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Documents</Text>
        <Text style={styles.subtitle}>Upload medical documents for AI-powered extraction</Text>

        <Pressable style={({ pressed }) => [styles.uploadCard, { opacity: pressed ? 0.9 : 1 }]} onPress={pickAndAnalyze} disabled={loading} accessibilityRole="button" accessibilityLabel="Upload document" accessibilityHint="Pick a photo of a lab report, prescription, or doctor note for AI analysis">
          {loading ? (
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color={C.tint} />
              <Text style={styles.loadingText}>{loadingMsg}</Text>
            </View>
          ) : (
            <View style={styles.uploadContent}>
              <View style={styles.uploadIcon}>
                <Ionicons name="cloud-upload-outline" size={32} color={C.tint} />
              </View>
              <Text style={styles.uploadTitle}>Upload Document</Text>
              <Text style={styles.uploadSubtitle}>Photo of lab report, prescription, or doctor note</Text>
            </View>
          )}
        </Pressable>

        {documents.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No documents yet</Text>
            <Text style={styles.emptySubtext}>Upload a medical document to extract diagnoses, medications, labs, and follow-ups</Text>
          </View>
        )}

        {documents.map((doc) => (
          <Pressable key={doc.id} style={({ pressed }) => [styles.docCard, { opacity: pressed ? 0.9 : 1 }]} onPress={() => setSelectedDoc(doc)} accessibilityRole="button" accessibilityLabel={`Document from ${formatDate(doc.date)}, ${doc.summary}`}>
            <View style={styles.docHeader}>
              <View style={styles.docIconWrap}>
                <Ionicons name="document-text" size={20} color={C.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docDate}>{formatDate(doc.date)}</Text>
                <Text style={styles.docSummary} numberOfLines={2}>{doc.summary}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
            </View>
            <View style={styles.docTags}>
              {doc.diagnoses.length > 0 && <View style={[styles.tag, { backgroundColor: C.redLight }]}><Text style={[styles.tagText, { color: C.red }]}>{doc.diagnoses.length} diagnoses</Text></View>}
              {doc.medications.length > 0 && <View style={[styles.tag, { backgroundColor: C.tintLight }]}><Text style={[styles.tagText, { color: C.tint }]}>{doc.medications.length} medications</Text></View>}
              {doc.labResults.length > 0 && <View style={[styles.tag, { backgroundColor: C.greenLight }]}><Text style={[styles.tagText, { color: C.green }]}>{doc.labResults.length} lab results</Text></View>}
              {doc.followUpDates.length > 0 && <View style={[styles.tag, { backgroundColor: C.orangeLight }]}><Text style={[styles.tagText, { color: C.orange }]}>{doc.followUpDates.length} follow-ups</Text></View>}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={!!selectedDoc} transparent animationType="slide">
        <View style={styles.modalFull}>
          <View style={[styles.modalHeader, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
            <Pressable onPress={() => setSelectedDoc(null)} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Ionicons name="arrow-back" size={22} color={C.text} />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Document Details</Text>
            <Pressable onPress={() => selectedDoc && handleDelete(selectedDoc.id)} style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel="Delete document" hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Ionicons name="trash-outline" size={20} color={C.red} />
            </Pressable>
          </View>
          {selectedDoc && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalDate}>{formatDate(selectedDoc.date)}</Text>
              <Text style={styles.modalSummary}>{selectedDoc.summary}</Text>

              {selectedDoc.diagnoses.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="medkit" size={16} color={C.red} />
                    <Text style={styles.sectionTitle}>Diagnoses</Text>
                  </View>
                  {selectedDoc.diagnoses.map((d, i) => (
                    <View key={i} style={styles.listItem}>
                      <View style={[styles.dot, { backgroundColor: C.red }]} />
                      <Text style={styles.listText}>{d}</Text>
                    </View>
                  ))}
                </View>
              )}

              {selectedDoc.medications.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="medical" size={16} color={C.tint} />
                    <Text style={styles.sectionTitle}>Medications</Text>
                  </View>
                  {selectedDoc.medications.map((m, i) => (
                    <View key={i} style={styles.medItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.medName}>{m.name}</Text>
                        <Text style={styles.medDetail}>{m.dosage} - {m.frequency}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: m.status === "new" ? C.greenLight : m.status === "stopped" ? C.redLight : C.tintLight }]}>
                        <Text style={[styles.statusText, { color: m.status === "new" ? C.green : m.status === "stopped" ? C.red : C.tint }]}>{m.status}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {selectedDoc.labResults.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="flask" size={16} color={C.green} />
                    <Text style={styles.sectionTitle}>Lab Results</Text>
                  </View>
                  {selectedDoc.labResults.map((l, i) => (
                    <View key={i} style={styles.labItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.labTest}>{l.test}</Text>
                        <Text style={styles.labRef}>Ref: {l.referenceRange || "N/A"}</Text>
                      </View>
                      <View style={styles.labRight}>
                        <Text style={[styles.labValue, { color: flagColor(l.flag) }]}>{l.value} {l.unit}</Text>
                        <Text style={[styles.labFlag, { color: flagColor(l.flag) }]}>{l.flag}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {selectedDoc.followUpDates.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="calendar" size={16} color={C.orange} />
                    <Text style={styles.sectionTitle}>Follow-up Dates</Text>
                  </View>
                  {selectedDoc.followUpDates.map((f, i) => (
                    <View key={i} style={styles.listItem}>
                      <View style={[styles.dot, { backgroundColor: C.orange }]} />
                      <View>
                        <Text style={styles.listText}>{f.date} - {f.doctor}</Text>
                        <Text style={styles.listSubtext}>{f.purpose}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {selectedDoc.doctorInstructions.length > 0 && (
                <View style={[styles.section, { marginBottom: 40 }]}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="clipboard" size={16} color={C.purple} />
                    <Text style={styles.sectionTitle}>Instructions</Text>
                  </View>
                  {selectedDoc.doctorInstructions.map((inst, i) => (
                    <View key={i} style={styles.listItem}>
                      <Text style={styles.instrNum}>{i + 1}.</Text>
                      <Text style={[styles.listText, { flex: 1 }]}>{inst}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal visible={showComparison} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowComparison(false)}>
          <Pressable style={styles.compModal} onPress={() => {}}>
            <Text style={styles.compTitle}>Medication Changes Detected</Text>
            <Text style={styles.compSubtitle}>{comparisonResult?.summary}</Text>

            {comparisonResult?.new?.length > 0 && (
              <View style={styles.compSection}>
                <View style={[styles.compBadge, { backgroundColor: C.greenLight }]}>
                  <Ionicons name="add-circle" size={14} color={C.green} />
                  <Text style={[styles.compBadgeText, { color: C.green }]}>New Medications</Text>
                </View>
                {comparisonResult.new.map((m: any, i: number) => (
                  <Text key={i} style={styles.compItem}>{m.name} {m.dosage}</Text>
                ))}
              </View>
            )}

            {comparisonResult?.stopped?.length > 0 && (
              <View style={styles.compSection}>
                <View style={[styles.compBadge, { backgroundColor: C.redLight }]}>
                  <Ionicons name="remove-circle" size={14} color={C.red} />
                  <Text style={[styles.compBadgeText, { color: C.red }]}>Stopped</Text>
                </View>
                {comparisonResult.stopped.map((m: any, i: number) => (
                  <Text key={i} style={styles.compItem}>{m.name} - {m.reason}</Text>
                ))}
              </View>
            )}

            {comparisonResult?.doseChanged?.length > 0 && (
              <View style={styles.compSection}>
                <View style={[styles.compBadge, { backgroundColor: C.orangeLight }]}>
                  <Ionicons name="swap-horizontal" size={14} color={C.orange} />
                  <Text style={[styles.compBadgeText, { color: C.orange }]}>Dose Changed</Text>
                </View>
                {comparisonResult.doseChanged.map((m: any, i: number) => (
                  <Text key={i} style={styles.compItem}>{m.name}: {m.oldDosage} → {m.newDosage}</Text>
                ))}
              </View>
            )}

            <Pressable style={styles.compCloseBtn} onPress={() => setShowComparison(false)} accessibilityRole="button" accessibilityLabel="Dismiss medication comparison">
              <Text style={styles.compCloseText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5 },
  subtitle: { fontWeight: "400", fontSize: 13, color: C.textSecondary, marginTop: 4, marginBottom: 20 },
  uploadCard: { backgroundColor: C.surface, borderRadius: 14, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: C.tint, borderStyle: "dashed" },
  uploadContent: { alignItems: "center" },
  uploadIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  uploadTitle: { fontWeight: "600", fontSize: 16, color: C.text, marginBottom: 4 },
  uploadSubtitle: { fontWeight: "400", fontSize: 12, color: C.textSecondary },
  loadingContent: { alignItems: "center", paddingVertical: 12 },
  loadingText: { fontWeight: "500", fontSize: 14, color: C.tint, marginTop: 12 },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontWeight: "600", fontSize: 16, color: C.textSecondary, marginTop: 12 },
  emptySubtext: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 4, textAlign: "center", maxWidth: 260 },
  docCard: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  docHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  docIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center" },
  docDate: { fontWeight: "600", fontSize: 13, color: C.text },
  docSummary: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  docTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontWeight: "500", fontSize: 10 },
  modalFull: { flex: 1, backgroundColor: C.background },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  modalHeaderTitle: { flex: 1, fontWeight: "600", fontSize: 16, color: C.text, textAlign: "center" },
  deleteBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  modalBody: { padding: 24, paddingBottom: 60 },
  modalDate: { fontWeight: "500", fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  modalSummary: { fontWeight: "400", fontSize: 14, color: C.text, lineHeight: 20, marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontWeight: "600", fontSize: 15, color: C.text },
  listItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  listText: { fontWeight: "400", fontSize: 13, color: C.text },
  listSubtext: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: 2 },
  medItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  medName: { fontWeight: "500", fontSize: 14, color: C.text },
  medDetail: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontWeight: "500", fontSize: 10, textTransform: "uppercase" },
  labItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  labTest: { fontWeight: "500", fontSize: 13, color: C.text },
  labRef: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: 2 },
  labRight: { alignItems: "flex-end" },
  labValue: { fontWeight: "600", fontSize: 14 },
  labFlag: { fontWeight: "500", fontSize: 10, textTransform: "uppercase", marginTop: 2 },
  instrNum: { fontWeight: "600", fontSize: 13, color: C.purple, minWidth: 20 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  compModal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 400, borderWidth: 1, borderColor: C.border },
  compTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 6 },
  compSubtitle: { fontWeight: "400", fontSize: 13, color: C.textSecondary, marginBottom: 18, lineHeight: 18 },
  compSection: { marginBottom: 16 },
  compBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, alignSelf: "flex-start", marginBottom: 8 },
  compBadgeText: { fontWeight: "600", fontSize: 12 },
  compItem: { fontWeight: "400", fontSize: 13, color: C.text, marginLeft: 10, marginBottom: 4 },
  compCloseBtn: { backgroundColor: C.tint, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 6 },
  compCloseText: { fontWeight: "600", fontSize: 14, color: "#fff" },
});
