import React, { useState } from "react";
import { Alert, Button, StyleSheet, View } from "react-native";
import { pickApps, requestAuthorization, startFocus, stopFocus } from "@/lib/screen-time-focus";

export default function MainScreen() {
  const [busy, setBusy] = useState(false);

  async function handleStartFocus() {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      await requestAuthorization();
      await pickApps();
      await startFocus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Focus mode could not be started.";
      Alert.alert("Focus Mode", message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStopFocus() {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      await stopFocus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Focus mode could not be stopped.";
      Alert.alert("Focus Mode", message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.buttonGroup}>
        <Button disabled={busy} onPress={handleStartFocus} title="Start Focus" />
        <Button disabled={busy} onPress={handleStopFocus} title="End Focus" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  buttonGroup: {
    gap: 12,
    width: "100%",
    maxWidth: 240,
  },
});
