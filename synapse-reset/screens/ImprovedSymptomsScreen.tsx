import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { StatusCard, EmptyState } from "@/components/ui";
import { UITokens, StatusColors } from "@/constants/ui-design";

const COMMON_SYMPTOMS = [
  "🤕 Headache",
  "😷 Cough",
  "🤢 Nausea",
  "🧠 Brain fog",
  "😫 Fatigue",
  "🌡️ Fever",
  "🤧 Congestion",
  "😴 Insomnia",
  "💓 Palpitations",
  "😰 Anxiety",
];

interface ImprovedSymptomsScreenProps {
  onActivateSickMode?: () => void;
  simpleOpenAddToken?: string;
}

export default function ImprovedSymptomsScreen({
  onActivateSickMode,
  simpleOpenAddToken,
}: ImprovedSymptomsScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
  const [severity, setSeverity] = useState(5);
  const [duration, setDuration] = useState("hours");
  const [durationValue, setDurationValue] = useState("1");
  const [notes, setNotes] = useState("");
  const [symptoms, setSymptoms] = useState<any[]>([]);

  const handleAddSymptom = () => {
    if (!selectedSymptom) return;

    const newSymptom = {
      id: Date.now().toString(),
      name: selectedSymptom,
      severity,
      duration: `${durationValue} ${duration}`,
      notes,
      timestamp: new Date().toISOString(),
    };

    setSymptoms([newSymptom, ...symptoms]);
    resetForm();
  };

  const resetForm = () => {
    setSelectedSymptom(null);
    setSeverity(5);
    setDuration("hours");
    setDurationValue("1");
    setNotes("");
  };

  const handleDeleteSymptom = (id: string) => {
    setSymptoms(symptoms.filter((s) => s.id !== id));
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Track Symptoms</Text>
          <Text style={styles.subtitle}>Log and monitor your symptoms</Text>
        </View>

        {/* Symptom Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Symptom</Text>
          <View style={styles.symptomGrid}>
            {COMMON_SYMPTOMS.map((symptom) => (
              <Pressable
                key={symptom}
                style={[
                  styles.symptomButton,
                  selectedSymptom === symptom && styles.symptomButtonActive,
                ]}
                onPress={() => setSelectedSymptom(symptom)}
              >
                <Text style={styles.symptomButtonText}>{symptom}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Severity Slider */}
        {selectedSymptom && (
          <View style={styles.section}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sectionTitle}>Severity Level</Text>
              <Text style={[styles.severityValue, { color: getSeverityColor(severity) }]}>
                {severity}/10
              </Text>
            </View>
            <View style={styles.sliderContainer}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <Pressable
                  key={num}
                  style={[
                    styles.sliderButton,
                    severity === num && styles.sliderButtonActive,
                    severity === num && {
                      backgroundColor: getSeverityColor(num),
                    },
                  ]}
                  onPress={() => setSeverity(num)}
                >
                  <Text
                    style={[
                      styles.sliderButtonText,
                      severity === num && styles.sliderButtonTextActive,
                    ]}
                  >
                    {num}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.severityLabels}>
              <Text style={styles.severityLabel}>Mild</Text>
              <Text style={styles.severityLabel}>Moderate</Text>
              <Text style={styles.severityLabel}>Severe</Text>
            </View>
          </View>
        )}

        {/* Duration */}
        {selectedSymptom && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duration</Text>
            <View style={styles.durationRow}>
              <TextInput
                style={styles.durationInput}
                placeholder="1"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={durationValue}
                onChangeText={setDurationValue}
              />
              <View style={styles.durationPickerRow}>
                {["minutes", "hours", "days"].map((unit) => (
                  <Pressable
                    key={unit}
                    style={[
                      styles.durationButton,
                      duration === unit && styles.durationButtonActive,
                    ]}
                    onPress={() => setDuration(unit)}
                  >
                    <Text
                      style={[
                        styles.durationButtonText,
                        duration === unit && styles.durationButtonTextActive,
                      ]}
                    >
                      {unit}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Notes */}
        {selectedSymptom && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g., triggered by stress, worse in morning..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        )}

        {/* Submit Button */}
        {selectedSymptom && (
          <View style={styles.section}>
            <Pressable
              style={styles.submitButton}
              onPress={handleAddSymptom}
            >
              <Text style={styles.submitButtonText}>✓ Log Symptom</Text>
            </Pressable>
          </View>
        )}

        {/* Logged Symptoms */}
        {symptoms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Symptoms</Text>
            {symptoms.map((symptom) => (
              <Pressable
                key={symptom.id}
                style={styles.symptomCard}
                onLongPress={() => handleDeleteSymptom(symptom.id)}
              >
                <View style={styles.symptomCardContent}>
                  <View style={styles.symptomCardHeader}>
                    <Text style={styles.symptomCardName}>
                      {symptom.name}
                    </Text>
                    <Text
                      style={[
                        styles.symptomCardSeverity,
                        { color: getSeverityColor(symptom.severity) },
                      ]}
                    >
                      {symptom.severity}/10
                    </Text>
                  </View>
                  <Text style={styles.symptomCardDuration}>
                    Duration: {symptom.duration}
                  </Text>
                  {symptom.notes && (
                    <Text style={styles.symptomCardNotes}>
                      {symptom.notes}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => handleDeleteSymptom(symptom.id)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>✕</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}

        {symptoms.length === 0 && !selectedSymptom && (
          <EmptyState
            icon="🏥"
            title="No symptoms logged"
            description="Select a symptom above to get started"
          />
        )}

        {/* Correlations */}
        {symptoms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pattern Detection</Text>
            <StatusCard
              icon={<Text style={{ fontSize: 20 }}>🔗</Text>}
              title="Headache Pattern"
              value="↑ 3x this week"
              subtitle="Often occurs after high stress days"
              status="warning"
            />
            <StatusCard
              icon={<Text style={{ fontSize: 20 }}>📊</Text>}
              title="Fatigue Correlation"
              value="Related to sleep"
              subtitle="Lower energy when sleep < 6 hours"
              status="info"
            />
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getSeverityColor(severity: number): string {
  if (severity <= 3) return StatusColors.success;
  if (severity <= 6) return StatusColors.warning;
  return StatusColors.danger;
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  header: {
    paddingHorizontal: UITokens.spacing.lg,
    paddingVertical: UITokens.spacing.lg,
  },
  title: {
    fontSize: UITokens.typography.h1.fontSize,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
    marginTop: UITokens.spacing.xs,
  },

  section: {
    paddingHorizontal: UITokens.spacing.lg,
    marginVertical: UITokens.spacing.lg,
  },
  sectionTitle: {
    fontSize: UITokens.typography.h3.fontSize,
    fontWeight: "600",
    color: colors.text,
    marginBottom: UITokens.spacing.md,
  },

  symptomGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: UITokens.spacing.sm,
  },
  symptomButton: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: UITokens.spacing.md,
    paddingVertical: UITokens.spacing.sm,
    borderRadius: UITokens.borderRadius.full,
    borderWidth: 2,
    borderColor: colors.border,
  },
  symptomButtonActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  symptomButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "500",
    color: colors.text,
  },

  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: UITokens.spacing.md,
  },
  severityValue: {
    fontSize: UITokens.typography.h3.fontSize,
    fontWeight: "700",
    color: colors.text,
  },
  sliderContainer: {
    flexDirection: "row",
    gap: UITokens.spacing.xs,
    marginBottom: UITokens.spacing.md,
  },
  sliderButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: UITokens.borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
  },
  sliderButtonActive: {
    borderColor: "transparent",
  },
  sliderButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  sliderButtonTextActive: {
    color: colors.text,
  },
  severityLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: UITokens.spacing.md,
  },
  severityLabel: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
    fontWeight: "500",
  },

  durationRow: {
    flexDirection: "row",
    gap: UITokens.spacing.md,
    alignItems: "center",
  },
  durationInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.md,
    color: colors.text,
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    minWidth: 60,
    textAlign: "center",
    borderWidth: 2,
    borderColor: colors.border,
  },
  durationPickerRow: {
    flex: 1,
    flexDirection: "row",
    gap: UITokens.spacing.sm,
  },
  durationButton: {
    flex: 1,
    paddingVertical: UITokens.spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: UITokens.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
  },
  durationButtonActive: {
    backgroundColor: colors.cyan,
    borderColor: colors.cyan,
  },
  durationButtonText: {
    fontSize: UITokens.typography.caption.fontSize,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  durationButtonTextActive: {
    color: colors.text,
  },

  notesInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.md,
    color: colors.text,
    fontSize: UITokens.typography.body.fontSize,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 80,
    textAlignVertical: "top",
  },

  submitButton: {
    backgroundColor: colors.green,
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.lg,
    minHeight: UITokens.touchTarget,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "700",
    color: "white",
  },

  symptomCard: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.md,
    marginBottom: UITokens.spacing.md,
    alignItems: "center",
  },
  symptomCardContent: {
    flex: 1,
  },
  symptomCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: UITokens.spacing.xs,
  },
  symptomCardName: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: colors.text,
  },
  symptomCardSeverity: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "700",
    color: colors.text,
  },
  symptomCardDuration: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
    marginBottom: UITokens.spacing.xs,
  },
  symptomCardNotes: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textTertiary,
    fontStyle: "italic",
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.redLight,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: UITokens.spacing.md,
  },
  deleteButtonText: {
    fontSize: 16,
    color: colors.red,
    fontWeight: "700",
  },

  spacer: {
    height: UITokens.spacing.xl,
  },
});

const styles = makeStyles(colors);
