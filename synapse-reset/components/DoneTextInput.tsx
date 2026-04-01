import React from "react";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

const IOS_DONE_ACCESSORY_ID = "synapse-global-keyboard-done";

export default function DoneTextInput(props: TextInputProps) {
  const { colors } = useTheme();
  const accessoryId = Platform.OS === "ios" ? IOS_DONE_ACCESSORY_ID : undefined;

  return (
    <>
      <RNTextInput
        {...props}
        inputAccessoryViewID={accessoryId}
        returnKeyType={props.returnKeyType ?? "done"}
        blurOnSubmit={props.blurOnSubmit ?? true}
        onSubmitEditing={(event) => {
          props.onSubmitEditing?.(event);
          Keyboard.dismiss();
        }}
      />
      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={IOS_DONE_ACCESSORY_ID}>
          <View style={[styles.toolbar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={styles.spacer} />
            <Pressable style={styles.doneButton} onPress={() => Keyboard.dismiss()} accessibilityRole="button" accessibilityLabel="Done">
              <Text style={[styles.doneText, { color: colors.tint }]}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
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
