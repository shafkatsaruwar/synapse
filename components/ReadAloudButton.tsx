import React, { useState, useCallback } from "react";
import { StyleSheet, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface ReadAloudButtonProps {
  getText: () => string;
}

export default function ReadAloudButton({ getText }: ReadAloudButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handlePress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    const text = getText();
    if (!text.trim()) return;
    setIsSpeaking(true);
    Speech.speak(text, {
      rate: 0.95,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [isSpeaking, getText]);

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [
          styles.button,
          isSpeaking && styles.buttonActive,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={handlePress}
        accessibilityLabel={isSpeaking ? "Stop reading aloud" : "Read screen aloud"}
        accessibilityRole="button"
      >
        <Ionicons
          name={isSpeaking ? "stop" : "volume-high"}
          size={22}
          color="#fff"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 140,
    right: 20,
    zIndex: 100,
  },
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonActive: {
    backgroundColor: C.red,
  },
});
