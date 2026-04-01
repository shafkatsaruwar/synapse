import React from "react";
import { Keyboard, TextInput as RNTextInput, type TextInputProps } from "react-native";

export default function DoneTextInput(props: TextInputProps) {
  return (
    <RNTextInput
      {...props}
      returnKeyType={props.returnKeyType ?? "done"}
      blurOnSubmit={props.blurOnSubmit ?? true}
      onSubmitEditing={(event) => {
        props.onSubmitEditing?.(event);
        Keyboard.dismiss();
      }}
    />
  );
}
