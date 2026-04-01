import React, { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";

export default function KeyboardDoneBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      setVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (Platform.OS !== "ios" || !visible) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.container,
          {
            bottom: Math.max(0, keyboardHeight - insets.bottom),
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={styles.spacer} />
        <Pressable style={styles.doneButton} onPress={() => Keyboard.dismiss()} accessibilityRole="button" accessibilityLabel="Done">
          <Text style={[styles.doneText, { color: colors.tint }]}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    left: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "absolute",
    right: 0,
  },
  spacer: {
    flex: 1,
  },
  doneButton: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  doneText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
