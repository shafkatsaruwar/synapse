import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const SYNAPSE_HQ_KEY = "synapse_hq_product_tool";

export type HqStatus = "idea" | "planned" | "active" | "done" | "parked";
export type HqTaskStatus = "todo" | "doing" | "done";
export type HqPriority = "low" | "medium" | "high";

export interface HqIdea {
  id: string;
  title: string;
  why: string;
  impact: string;
  category: string;
  emotion: string;
  status: HqStatus;
}

export interface HqFeature {
  id: string;
  name: string;
  problem: string;
  solution: string;
  scope: string;
  priority: HqPriority;
  status: HqStatus;
  mode: string;
  monetization: string;
  reducesThinking: boolean;
}

export interface HqSprintTask {
  id: string;
  title: string;
  featureId: string;
  status: HqTaskStatus;
  priority: HqPriority;
}

export interface HqInsight {
  id: string;
  observation: string;
  insight: string;
  action: string;
  priority: HqPriority;
}

export interface SynapseHqData {
  ideas: HqIdea[];
  features: HqFeature[];
  sprintTasks: HqSprintTask[];
  insights: HqInsight[];
}

const EMPTY_HQ_DATA: SynapseHqData = {
  ideas: [],
  features: [],
  sprintTasks: [],
  insights: [],
};

function withId<T extends object>(item: T): T & { id: string } {
  return { ...item, id: Crypto.randomUUID() };
}

async function saveData(data: SynapseHqData) {
  await AsyncStorage.setItem(SYNAPSE_HQ_KEY, JSON.stringify(data));
}

export const synapseHqStorage = {
  get: async (): Promise<SynapseHqData> => {
    try {
      const raw = await AsyncStorage.getItem(SYNAPSE_HQ_KEY);
      if (!raw) return EMPTY_HQ_DATA;
      const parsed = JSON.parse(raw) as Partial<SynapseHqData>;
      return {
        ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
        features: Array.isArray(parsed.features) ? parsed.features : [],
        sprintTasks: Array.isArray(parsed.sprintTasks) ? parsed.sprintTasks : [],
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      };
    } catch (error) {
      console.warn("Synapse HQ read failed", error);
      return EMPTY_HQ_DATA;
    }
  },
  saveIdea: async (idea: Omit<HqIdea, "id">) => {
    const current = await synapseHqStorage.get();
    const next = withId(idea);
    await saveData({ ...current, ideas: [next, ...current.ideas] });
    return next;
  },
  saveFeature: async (feature: Omit<HqFeature, "id">) => {
    const current = await synapseHqStorage.get();
    const next = withId(feature);
    await saveData({ ...current, features: [next, ...current.features] });
    return next;
  },
  saveSprintTask: async (task: Omit<HqSprintTask, "id">) => {
    const current = await synapseHqStorage.get();
    const next = withId(task);
    await saveData({ ...current, sprintTasks: [next, ...current.sprintTasks] });
    return next;
  },
  saveInsight: async (insight: Omit<HqInsight, "id">) => {
    const current = await synapseHqStorage.get();
    const next = withId(insight);
    await saveData({ ...current, insights: [next, ...current.insights] });
    return next;
  },
  updateSprintTaskStatus: async (id: string, status: HqTaskStatus) => {
    const current = await synapseHqStorage.get();
    await saveData({
      ...current,
      sprintTasks: current.sprintTasks.map((task) => task.id === id ? { ...task, status } : task),
    });
  },
};
