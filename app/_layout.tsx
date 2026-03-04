import "react-native-gesture-handler";
import React from "react";
import { View, Text } from "react-native";

export default function RootLayout() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Synapse Boot Test</Text>
    </View>
  );
}
