import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { clearDeveloperMode, enableDeveloperMode, getDeveloperMode } from "@/lib/developer-mode";
import {
  synapseHqStorage,
  type HqPriority,
  type HqStatus,
  type HqTaskStatus,
  type SynapseHqData,
} from "@/lib/synapse-hq-storage";
import { useTheme, type Theme } from "@/contexts/ThemeContext";

const ACCESS_CODE = "890427";
type HqTab = "ideas" | "features" | "sprint" | "insights";

const EMPTY_HQ_DATA: SynapseHqData = {
  ideas: [],
  features: [],
  sprintTasks: [],
  insights: [],
};

const TAB_OPTIONS: { key: HqTab; label: string }[] = [
  { key: "ideas", label: "Ideas" },
  { key: "features", label: "Features" },
  { key: "sprint", label: "Sprint" },
  { key: "insights", label: "Insights" },
];

const PRIORITIES: HqPriority[] = ["low", "medium", "high"];
const TASK_STATUSES: HqTaskStatus[] = ["todo", "doing", "done"];
const FEATURE_STATUSES: HqStatus[] = ["idea", "planned", "active", "done", "parked"];

const blankIdea = () => ({ title: "", why: "", impact: "", category: "", emotion: "", status: "idea" as HqStatus });
const blankFeature = () => ({
  name: "",
  problem: "",
  solution: "",
  scope: "",
  priority: "medium" as HqPriority,
  status: "planned" as HqStatus,
  mode: "",
  monetization: "",
  reducesThinking: true,
});
const blankTask = () => ({ title: "", featureId: "", status: "todo" as HqTaskStatus, priority: "medium" as HqPriority });
const blankInsight = () => ({ observation: "", insight: "", action: "", priority: "medium" as HqPriority });

export function useSynapseHQPanel(onDeveloperModeChange?: (isDeveloper: boolean) => void) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [visible, setVisible] = useState(false);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [activeTab, setActiveTab] = useState<HqTab>("ideas");
  const [data, setData] = useState<SynapseHqData>(EMPTY_HQ_DATA);
  const [showAdd, setShowAdd] = useState(false);
  const [ideaDraft, setIdeaDraft] = useState(blankIdea);
  const [featureDraft, setFeatureDraft] = useState(blankFeature);
  const [taskDraft, setTaskDraft] = useState(blankTask);
  const [insightDraft, setInsightDraft] = useState(blankInsight);

  const loadHqData = useCallback(async () => {
    setData(await synapseHqStorage.get());
  }, []);

  const open = useCallback(async () => {
    const saved = await getDeveloperMode();
    setAccessCode("");
    setIsDeveloper(saved?.isDeveloper === true);
    if (saved?.isDeveloper === true) {
      await loadHqData();
    }
    setVisible(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, [loadHqData]);

  const close = useCallback(() => {
    setVisible(false);
    setAccessCode("");
    setShowAdd(false);
  }, []);

  const submitCode = useCallback(async () => {
    if (accessCode.trim() !== ACCESS_CODE) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert("Access denied", "That code is not valid.");
      return;
    }

    await enableDeveloperMode();
    setIsDeveloper(true);
    setAccessCode("");
    await loadHqData();
    onDeveloperModeChange?.(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [accessCode, loadHqData, onDeveloperModeChange]);

  const exitDeveloperMode = useCallback(async () => {
    await clearDeveloperMode();
    setIsDeveloper(false);
    setAccessCode("");
    setVisible(false);
    setShowAdd(false);
    onDeveloperModeChange?.(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [onDeveloperModeChange]);

  const saveIdea = useCallback(async () => {
    if (!ideaDraft.title.trim()) return;
    await synapseHqStorage.saveIdea({
      ...ideaDraft,
      title: ideaDraft.title.trim(),
      why: ideaDraft.why.trim(),
      impact: ideaDraft.impact.trim(),
      category: ideaDraft.category.trim(),
      emotion: ideaDraft.emotion.trim(),
    });
    setIdeaDraft(blankIdea());
    setShowAdd(false);
    await loadHqData();
  }, [ideaDraft, loadHqData]);

  const saveFeature = useCallback(async () => {
    if (!featureDraft.name.trim()) return;
    await synapseHqStorage.saveFeature({
      ...featureDraft,
      name: featureDraft.name.trim(),
      problem: featureDraft.problem.trim(),
      solution: featureDraft.solution.trim(),
      scope: featureDraft.scope.trim(),
      mode: featureDraft.mode.trim(),
      monetization: featureDraft.monetization.trim(),
    });
    setFeatureDraft(blankFeature());
    setShowAdd(false);
    await loadHqData();
  }, [featureDraft, loadHqData]);

  const saveTask = useCallback(async () => {
    if (!taskDraft.title.trim()) return;
    await synapseHqStorage.saveSprintTask({ ...taskDraft, title: taskDraft.title.trim() });
    setTaskDraft(blankTask());
    setShowAdd(false);
    await loadHqData();
  }, [loadHqData, taskDraft]);

  const saveInsight = useCallback(async () => {
    if (!insightDraft.observation.trim() && !insightDraft.action.trim()) return;
    await synapseHqStorage.saveInsight({
      ...insightDraft,
      observation: insightDraft.observation.trim(),
      insight: insightDraft.insight.trim(),
      action: insightDraft.action.trim(),
    });
    setInsightDraft(blankInsight());
    setShowAdd(false);
    await loadHqData();
  }, [insightDraft, loadHqData]);

  const moveTask = useCallback(async (id: string, status: HqTaskStatus) => {
    await synapseHqStorage.updateSprintTaskStatus(id, status);
    await loadHqData();
  }, [loadHqData]);

  const activeSprintTasks = useMemo(
    () => data.sprintTasks.filter((task) => task.status !== "done").slice(0, 5),
    [data.sprintTasks]
  );
  const sprintTaskIds = useMemo(() => new Set(activeSprintTasks.map((task) => task.id)), [activeSprintTasks]);
  const sprintTasksForBoard = useMemo(
    () => data.sprintTasks.filter((task) => task.status === "done" || sprintTaskIds.has(task.id)),
    [data.sprintTasks, sprintTaskIds]
  );

  return {
    open,
    element: (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close Synapse HQ" />
          <View style={styles.panel}>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>Synapse HQ</Text>
                <Text style={styles.title}>{isDeveloper ? "Internal Product Tool" : "Enter Access Code"}</Text>
              </View>
              <Pressable onPress={close} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={C.text} />
              </Pressable>
            </View>

            {isDeveloper ? (
              <View style={styles.hqShell}>
                <View style={styles.tabRow}>
                  {TAB_OPTIONS.map((tab) => (
                    <Pressable
                      key={tab.key}
                      style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
                      onPress={() => {
                        setActiveTab(tab.key);
                        setShowAdd(false);
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: activeTab === tab.key }}
                    >
                      <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{TAB_OPTIONS.find((tab) => tab.key === activeTab)?.label}</Text>
                  <Pressable
                    style={styles.addButton}
                    onPress={() => setShowAdd((current) => !current)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${activeTab}`}
                  >
                    <Ionicons name={showAdd ? "remove" : "add"} size={18} color="#fff" />
                  </Pressable>
                </View>

                <ScrollView style={styles.hqScroll} contentContainerStyle={styles.hqContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {showAdd && activeTab === "ideas" ? (
                    <View style={styles.formCard}>
                      <HqInput value={ideaDraft.title} onChangeText={(title) => setIdeaDraft((prev) => ({ ...prev, title }))} placeholder="Idea title" styles={styles} />
                      <HqInput value={ideaDraft.why} onChangeText={(why) => setIdeaDraft((prev) => ({ ...prev, why }))} placeholder="Why it matters" styles={styles} />
                      <View style={styles.formRow}>
                        <HqInput value={ideaDraft.impact} onChangeText={(impact) => setIdeaDraft((prev) => ({ ...prev, impact }))} placeholder="Impact" styles={styles} />
                        <HqInput value={ideaDraft.category} onChangeText={(category) => setIdeaDraft((prev) => ({ ...prev, category }))} placeholder="Category" styles={styles} />
                      </View>
                      <HqInput value={ideaDraft.emotion} onChangeText={(emotion) => setIdeaDraft((prev) => ({ ...prev, emotion }))} placeholder="Emotion" styles={styles} />
                      <SaveButton label="Save Idea" onPress={saveIdea} disabled={!ideaDraft.title.trim()} styles={styles} />
                    </View>
                  ) : null}

                  {showAdd && activeTab === "features" ? (
                    <View style={styles.formCard}>
                      <HqInput value={featureDraft.name} onChangeText={(name) => setFeatureDraft((prev) => ({ ...prev, name }))} placeholder="Feature name" styles={styles} />
                      <HqInput value={featureDraft.problem} onChangeText={(problem) => setFeatureDraft((prev) => ({ ...prev, problem }))} placeholder="Problem" styles={styles} />
                      <HqInput value={featureDraft.solution} onChangeText={(solution) => setFeatureDraft((prev) => ({ ...prev, solution }))} placeholder="Solution" styles={styles} />
                      <View style={styles.formRow}>
                        <HqInput value={featureDraft.scope} onChangeText={(scope) => setFeatureDraft((prev) => ({ ...prev, scope }))} placeholder="Scope" styles={styles} />
                        <HqInput value={featureDraft.mode} onChangeText={(mode) => setFeatureDraft((prev) => ({ ...prev, mode }))} placeholder="Mode" styles={styles} />
                      </View>
                      <HqInput value={featureDraft.monetization} onChangeText={(monetization) => setFeatureDraft((prev) => ({ ...prev, monetization }))} placeholder="Monetization" styles={styles} />
                      <ChipRow label="Priority" values={PRIORITIES} selected={featureDraft.priority} onSelect={(priority) => setFeatureDraft((prev) => ({ ...prev, priority }))} styles={styles} />
                      <ChipRow label="Status" values={FEATURE_STATUSES} selected={featureDraft.status} onSelect={(status) => setFeatureDraft((prev) => ({ ...prev, status }))} styles={styles} />
                      <Pressable style={styles.toggleRow} onPress={() => setFeatureDraft((prev) => ({ ...prev, reducesThinking: !prev.reducesThinking }))}>
                        <Text style={styles.toggleText}>Reduces thinking</Text>
                        <Ionicons name={featureDraft.reducesThinking ? "checkbox" : "square-outline"} size={22} color={featureDraft.reducesThinking ? C.tint : C.textTertiary} />
                      </Pressable>
                      <SaveButton label="Save Feature" onPress={saveFeature} disabled={!featureDraft.name.trim()} styles={styles} />
                    </View>
                  ) : null}

                  {showAdd && activeTab === "sprint" ? (
                    <View style={styles.formCard}>
                      <HqInput value={taskDraft.title} onChangeText={(title) => setTaskDraft((prev) => ({ ...prev, title }))} placeholder="Task title" styles={styles} />
                      <HqInput value={taskDraft.featureId} onChangeText={(featureId) => setTaskDraft((prev) => ({ ...prev, featureId }))} placeholder="Feature ID optional" styles={styles} />
                      <ChipRow label="Priority" values={PRIORITIES} selected={taskDraft.priority} onSelect={(priority) => setTaskDraft((prev) => ({ ...prev, priority }))} styles={styles} />
                      <SaveButton label="Save Task" onPress={saveTask} disabled={!taskDraft.title.trim()} styles={styles} />
                    </View>
                  ) : null}

                  {showAdd && activeTab === "insights" ? (
                    <View style={styles.formCard}>
                      <HqInput value={insightDraft.observation} onChangeText={(observation) => setInsightDraft((prev) => ({ ...prev, observation }))} placeholder="Observation" styles={styles} multiline />
                      <HqInput value={insightDraft.insight} onChangeText={(insight) => setInsightDraft((prev) => ({ ...prev, insight }))} placeholder="Insight" styles={styles} multiline />
                      <HqInput value={insightDraft.action} onChangeText={(action) => setInsightDraft((prev) => ({ ...prev, action }))} placeholder="Action" styles={styles} multiline />
                      <ChipRow label="Priority" values={PRIORITIES} selected={insightDraft.priority} onSelect={(priority) => setInsightDraft((prev) => ({ ...prev, priority }))} styles={styles} />
                      <SaveButton label="Save Insight" onPress={saveInsight} disabled={!insightDraft.observation.trim() && !insightDraft.action.trim()} styles={styles} />
                    </View>
                  ) : null}

                  {activeTab === "ideas" ? (
                    data.ideas.length === 0 ? <EmptyState text="No ideas yet." styles={styles} /> : data.ideas.map((idea) => (
                      <View key={idea.id} style={styles.listCard}>
                        <Text style={styles.cardTitle}>{idea.title}</Text>
                        {!!idea.why && <Text style={styles.cardBody}>{idea.why}</Text>}
                        <MetaLine values={[idea.status, idea.category, idea.impact, idea.emotion]} styles={styles} />
                      </View>
                    ))
                  ) : null}

                  {activeTab === "features" ? (
                    data.features.length === 0 ? <EmptyState text="No features yet." styles={styles} /> : data.features.map((feature) => (
                      <View key={feature.id} style={styles.featureCard}>
                        <View style={styles.cardTopRow}>
                          <Text style={styles.cardTitle}>{feature.name}</Text>
                          <Text style={styles.priorityPill}>{feature.priority}</Text>
                        </View>
                        <MetaLine values={[feature.status, feature.mode || "mode open", feature.reducesThinking ? "less thinking" : "neutral"]} styles={styles} />
                      </View>
                    ))
                  ) : null}

                  {activeTab === "sprint" ? (
                    <>
                      <Text style={styles.limitText}>Active: {activeSprintTasks.length}/5</Text>
                      <View style={styles.kanban}>
                        {TASK_STATUSES.map((status) => (
                          <View key={status} style={styles.kanbanColumn}>
                            <Text style={styles.kanbanTitle}>{status === "todo" ? "To Do" : status === "doing" ? "Doing" : "Done"}</Text>
                            {sprintTasksForBoard.filter((task) => task.status === status).map((task) => (
                              <Pressable
                                key={task.id}
                                style={styles.taskCard}
                                onPress={() => moveTask(task.id, nextTaskStatus(task.status))}
                                accessibilityRole="button"
                                accessibilityLabel={`Move ${task.title}`}
                              >
                                <Text style={styles.taskTitle}>{task.title}</Text>
                                <Text style={styles.taskMeta}>{task.priority}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}

                  {activeTab === "insights" ? (
                    data.insights.length === 0 ? <EmptyState text="No insights yet." styles={styles} /> : data.insights.map((insight) => (
                      <View key={insight.id} style={styles.listCard}>
                        {!!insight.observation && <Text style={styles.cardBody}>Obs: {insight.observation}</Text>}
                        {!!insight.insight && <Text style={styles.cardBody}>Insight: {insight.insight}</Text>}
                        {!!insight.action && <Text style={styles.cardTitle}>Action: {insight.action}</Text>}
                        <MetaLine values={[insight.priority]} styles={styles} />
                      </View>
                    ))
                  ) : null}

                  <Pressable
                    style={({ pressed }) => [styles.exitRow, pressed && styles.pressed]}
                    onPress={exitDeveloperMode}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: true }}
                    accessibilityLabel="Exit Developer Mode"
                  >
                    <View style={styles.toggleOn}>
                      <View style={styles.toggleKnob} />
                    </View>
                    <Text style={styles.exitText}>Exit Developer Mode</Text>
                  </Pressable>
                </ScrollView>
              </View>
            ) : (
              <View style={styles.content}>
                <TextInput
                  value={accessCode}
                  onChangeText={setAccessCode}
                  placeholder="Access code"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  style={styles.input}
                  autoFocus
                  onSubmitEditing={submitCode}
                  returnKeyType="done"
                />
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, (!accessCode.trim() || pressed) && styles.primaryButtonDim]}
                  onPress={submitCode}
                  disabled={!accessCode.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Unlock Synapse HQ"
                >
                  <Text style={styles.primaryButtonText}>Unlock</Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    ),
  };
}

function HqInput({
  value,
  onChangeText,
  placeholder,
  multiline,
  styles,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#8B8B93"
      style={[styles.hqInput, multiline && styles.hqInputMultiline]}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
    />
  );
}

function SaveButton({
  label,
  onPress,
  disabled,
  styles,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.saveButton, (disabled || pressed) && styles.primaryButtonDim]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function ChipRow<T extends string>({
  label,
  values,
  selected,
  onSelect,
  styles,
}: {
  label: string;
  values: T[];
  selected: T;
  onSelect: (value: T) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.chipBlock}>
      <Text style={styles.chipLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {values.map((value) => (
          <Pressable
            key={value}
            style={[styles.chip, selected === value && styles.chipActive]}
            onPress={() => onSelect(value)}
          >
            <Text style={[styles.chipText, selected === value && styles.chipTextActive]}>{value}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function EmptyState({ text, styles }: { text: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function MetaLine({ values, styles }: { values: string[]; styles: ReturnType<typeof makeStyles> }) {
  const clean = values.map((value) => value.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  return <Text style={styles.metaLine}>{clean.join(" / ")}</Text>;
}

function nextTaskStatus(status: HqTaskStatus): HqTaskStatus {
  if (status === "todo") return "doing";
  if (status === "doing") return "done";
  return "todo";
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 22,
      backgroundColor: "rgba(0,0,0,0.54)",
    },
    panel: {
      width: "100%",
      maxWidth: 680,
      maxHeight: "88%",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      padding: 20,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
      marginBottom: 18,
    },
    eyebrow: {
      fontWeight: "800",
      fontSize: 12,
      color: C.textSecondary,
      textTransform: "uppercase",
    },
    title: {
      fontWeight: "800",
      fontSize: 23,
      color: C.text,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
    },
    content: {
      gap: 14,
    },
    hqShell: {
      gap: 14,
      minHeight: 420,
    },
    tabRow: {
      flexDirection: "row",
      gap: 6,
      padding: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
    },
    tabButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    tabButtonActive: {
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    tabText: {
      fontWeight: "800",
      fontSize: 12,
      color: C.textSecondary,
    },
    tabTextActive: {
      color: C.text,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionTitle: {
      fontWeight: "800",
      fontSize: 20,
      color: C.text,
    },
    addButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tint,
    },
    hqScroll: {
      minHeight: 320,
      maxHeight: 520,
    },
    hqContent: {
      gap: 10,
      paddingBottom: 4,
    },
    formCard: {
      gap: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
    },
    formRow: {
      flexDirection: "row",
      gap: 10,
    },
    hqInput: {
      flex: 1,
      minHeight: 44,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      color: C.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      fontWeight: "600",
    },
    hqInputMultiline: {
      minHeight: 72,
    },
    saveButton: {
      minHeight: 46,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tint,
    },
    chipBlock: {
      gap: 7,
    },
    chipLabel: {
      fontWeight: "800",
      fontSize: 12,
      color: C.textSecondary,
      textTransform: "uppercase",
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      minHeight: 34,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    chipActive: {
      borderColor: C.tint,
      backgroundColor: C.tintLight,
    },
    chipText: {
      fontWeight: "800",
      fontSize: 12,
      color: C.textSecondary,
      textTransform: "capitalize",
    },
    chipTextActive: {
      color: C.tint,
    },
    toggleRow: {
      minHeight: 44,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    toggleText: {
      fontWeight: "800",
      fontSize: 13,
      color: C.text,
    },
    listCard: {
      gap: 6,
      padding: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
    },
    featureCard: {
      gap: 8,
      padding: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
    },
    cardTitle: {
      flex: 1,
      fontWeight: "800",
      fontSize: 15,
      color: C.text,
      lineHeight: 20,
    },
    cardBody: {
      fontWeight: "600",
      fontSize: 13,
      color: C.textSecondary,
      lineHeight: 18,
    },
    metaLine: {
      fontWeight: "800",
      fontSize: 11,
      color: C.textTertiary,
      textTransform: "uppercase",
    },
    priorityPill: {
      overflow: "hidden",
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      backgroundColor: C.tintLight,
      color: C.tint,
      fontWeight: "900",
      fontSize: 11,
      textTransform: "uppercase",
    },
    limitText: {
      fontWeight: "800",
      fontSize: 12,
      color: C.textSecondary,
      textTransform: "uppercase",
    },
    kanban: {
      flexDirection: "row",
      gap: 8,
      minHeight: 220,
    },
    kanbanColumn: {
      flex: 1,
      gap: 8,
      padding: 8,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
    },
    kanbanTitle: {
      fontWeight: "900",
      fontSize: 12,
      color: C.text,
      textTransform: "uppercase",
    },
    taskCard: {
      gap: 5,
      padding: 9,
      borderRadius: 10,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    taskTitle: {
      fontWeight: "800",
      fontSize: 12,
      color: C.text,
      lineHeight: 16,
    },
    taskMeta: {
      fontWeight: "800",
      fontSize: 10,
      color: C.textTertiary,
      textTransform: "uppercase",
    },
    emptyState: {
      minHeight: 100,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
    },
    emptyText: {
      fontWeight: "800",
      fontSize: 14,
      color: C.textSecondary,
    },
    input: {
      minHeight: 54,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
      color: C.text,
      paddingHorizontal: 14,
      fontSize: 18,
      fontWeight: "700",
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tint,
    },
    primaryButtonDim: {
      opacity: 0.72,
    },
    primaryButtonText: {
      fontWeight: "800",
      fontSize: 16,
      color: "#fff",
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
    },
    statusIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tintLight,
    },
    statusTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    statusTitle: {
      fontWeight: "800",
      fontSize: 15,
      color: C.text,
    },
    statusText: {
      fontWeight: "600",
      fontSize: 13,
      color: C.textSecondary,
      marginTop: 2,
    },
    exitRow: {
      minHeight: 54,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
    },
    pressed: {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    },
    toggleOn: {
      width: 46,
      height: 28,
      borderRadius: 14,
      backgroundColor: C.red,
      padding: 3,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    toggleKnob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "#fff",
    },
    exitText: {
      flex: 1,
      fontWeight: "800",
      fontSize: 15,
      color: C.text,
    },
  });
}
