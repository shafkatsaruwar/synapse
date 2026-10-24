import React, { useCallback, useEffect, useState } from "react";
import { Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCareProfiles } from "@/contexts/CareProfileContext";
import { loadConnections } from "@/lib/care/connections";
import { freshnessLabel, loadSharedData } from "@/lib/care/sharing";
import type { CareConnection, StoredSharedData } from "@/lib/care/types";
import { Body, Notice, PrimaryButton, ScreenHeader, SecondaryButton } from "@/components/care/ui";
import { SharedCopy } from "@/screens/CareConnectionsScreen";

/**
 * What you see while a connected person's reference profile is open. It shows only the saved copies
 * they chose to share. It is view-only and never mixes with your own records.
 */
export default function ReferenceProfileScreen({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { activeProfile, switchProfile } = useCareProfiles();
  const [conn, setConn] = useState<CareConnection | null>(null);
  const [shared, setShared] = useState<StoredSharedData | null>(null);

  const load = useCallback(async () => {
    const id = activeProfile.connectionId;
    if (!id) return;
    setConn((await loadConnections()).find((c) => c.id === id) ?? null);
    setShared(await loadSharedData(id));
  }, [activeProfile.connectionId]);
  useEffect(() => {
    void load();
  }, [load]);

  const latest = shared ? [shared.med_schedule, shared.upcoming_appointments, shared.med_confirmations, shared.selected_records, shared.emergency_info].filter(Boolean).map((x) => x!.provenance.importedAt).sort().pop() : undefined;
  const topPad = width >= 768 ? 28 : Platform.OS === "web" ? 40 : 8;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
      <ScreenHeader title={activeProfile.displayName} subtitle={freshnessLabel(latest)} />
      <Notice icon="eye-outline">View-only. This is a saved copy of what {activeProfile.displayName} chose to share. It isn't live and it can't be edited here.</Notice>
      {shared ? <SharedCopy shared={shared} /> : <Body>Nothing has been shared yet.</Body>}
      <View style={{ gap: 10, marginTop: 16 }}>
        {conn ? <PrimaryButton label="Open connection" onPress={() => onNavigate?.("careconnections")} /> : null}
        <SecondaryButton label="Back to my own health" onPress={() => void switchProfile("self")} />
      </View>
    </ScrollView>
  );
}
