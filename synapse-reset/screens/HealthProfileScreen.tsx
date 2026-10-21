import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert, Image } from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { raised } from "@/constants/raised";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { healthProfileStorage, settingsStorage, type HealthProfileInfo } from "@/lib/storage";
import { syncAllFromSettings } from "@/lib/notification-manager";
import { persistProfileImage } from "@/lib/profile-image";
import { syncWidgetSnapshot } from "@/lib/widget-sync";

interface HealthProfileScreenProps {
  /** Chrome already provides back/menu — do not render an in-screen Settings back. */
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
}

const EMPTY_PROFILE: HealthProfileInfo = {
  userRole: "self",
  widgetAppearance: "system",
  backupCriticalMedications: [],
  vaccines: [],
  surgeries: [],
};

export default function HealthProfileScreen(_props: HealthProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [profile, setProfile] = useState<HealthProfileInfo>(EMPTY_PROFILE);
  const [nameText, setNameText] = useState("");
  const [nameSaved, setNameSaved] = useState(true);
  const [ageText, setAgeText] = useState("");
  const [ageSaved, setAgeSaved] = useState(true);

  const loadData = useCallback(async () => {
    const [nextProfile, settings] = await Promise.all([
      healthProfileStorage.get(),
      settingsStorage.get(),
    ]);
    setProfile(nextProfile);
    setNameText(settings.name ?? "");
    setAgeText(nextProfile.age != null ? String(nextProfile.age) : "");
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const persistProfile = async (nextProfile: HealthProfileInfo) => {
    setProfile(nextProfile);
    await healthProfileStorage.save(nextProfile);
    await syncAllFromSettings().catch(() => {});
    syncWidgetSnapshot().catch(() => {});
  };

  const handleSaveName = async () => {
    const trimmed = nameText.trim();
    const settings = await settingsStorage.get();
    await settingsStorage.save({ ...settings, name: trimmed || settings.name || "You" });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNameSaved(true);
  };

  const handleSaveAge = async () => {
    const parsed = ageText.trim() === "" ? undefined : parseInt(ageText, 10);
    const nextProfile = { ...profile, age: Number.isNaN(parsed as number) ? undefined : parsed };
    await persistProfile(nextProfile);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAgeSaved(true);
  };

  const handlePickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Please allow photo library access to choose a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    const persistedUri = await persistProfileImage(result.assets[0].uri, profile.profileImageUri);
    await persistProfile({ ...profile, profileImageUri: persistedUri });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const profileInitial = (nameText.trim()?.[0] ?? "Y").toUpperCase();
  const topPad = Platform.OS === "web" ? 40 : 14;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>Name, photo, and age. Health history lives in You & Settings.</Text>

        <View style={styles.photoCard}>
          <Pressable
            style={styles.profileAvatar}
            onPress={handlePickProfileImage}
            accessibilityRole="button"
            accessibilityLabel={profile.profileImageUri ? "Change profile picture" : "Add profile picture"}
          >
            {profile.profileImageUri ? (
              <Image source={{ uri: profile.profileImageUri }} style={styles.profileAvatarImage} />
            ) : (
              <Text style={styles.profileAvatarText}>{profileInitial}</Text>
            )}
            <View style={styles.profileAvatarBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>
          <View style={styles.photoCopy}>
            <Text style={styles.photoTitle}>{profile.profileImageUri ? "Profile photo" : "Add a photo"}</Text>
            <Text style={styles.photoDesc}>
              {profile.profileImageUri
                ? "Tap to replace the picture used in your menu and profile."
                : "Optional. Shown in You & Settings and the side menu."}
            </Text>
            <Pressable
              style={styles.photoLink}
              onPress={handlePickProfileImage}
              accessibilityRole="button"
              accessibilityLabel={profile.profileImageUri ? "Change photo" : "Add photo"}
            >
              <Ionicons name="image-outline" size={15} color={C.tint} />
              <Text style={styles.photoLinkText}>
                {profile.profileImageUri ? "Change photo" : "Add photo"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.blockSpacer} />

        <View style={styles.ageCard}>
          <Text style={styles.ageLabel}>Name</Text>
          <TextInput
            style={styles.ageInput}
            value={nameText}
            onChangeText={(t) => {
              setNameText(t);
              setNameSaved(false);
            }}
            placeholder="What should we call you?"
            placeholderTextColor={C.textTertiary}
            accessibilityLabel="Name"
            autoCapitalize="words"
          />
          <Pressable
            style={({ pressed }) => [styles.ageSaveBtn, nameSaved && styles.ageSaveBtnSaved, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSaveName}
            accessibilityRole="button"
            accessibilityLabel={nameSaved ? "Name saved" : "Save name"}
          >
            <Ionicons name={nameSaved ? "checkmark-circle" : "save-outline"} size={16} color="#fff" />
            <Text style={styles.ageSaveBtnText}>{nameSaved ? "Saved" : "Save"}</Text>
          </Pressable>
        </View>

        <View style={styles.blockSpacer} />

        <View style={styles.ageCard}>
          <Text style={styles.ageLabel}>Age</Text>
          <TextInput
            style={styles.ageInput}
            value={ageText}
            onChangeText={(t) => {
              setAgeText(t.replace(/[^0-9]/g, ""));
              setAgeSaved(false);
            }}
            keyboardType="number-pad"
            placeholder="Enter your age"
            placeholderTextColor={C.textTertiary}
            maxLength={3}
            accessibilityLabel="Age"
          />
          <Pressable
            style={({ pressed }) => [styles.ageSaveBtn, ageSaved && styles.ageSaveBtnSaved, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSaveAge}
            accessibilityRole="button"
            accessibilityLabel={ageSaved ? "Age saved" : "Save age"}
          >
            <Ionicons name={ageSaved ? "checkmark-circle" : "save-outline"} size={16} color="#fff" />
            <Text style={styles.ageSaveBtnText}>{ageSaved ? "Saved" : "Save"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 24 },
    title: { fontWeight: "700", fontSize: 26, color: C.text, letterSpacing: -0.5, marginBottom: 8 },
    subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginBottom: 24 },
    photoCard: {
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 20,
      borderWidth: 1,
      borderColor: C.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      ...raised("md", "#55718F"),
    },
    profileAvatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: C.tintLight,
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
    },
    profileAvatarImage: { width: 72, height: 72, borderRadius: 36 },
    profileAvatarText: { fontWeight: "700", fontSize: 28, color: C.tint },
    profileAvatarBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: C.tint,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: C.surface,
    },
    photoCopy: { flex: 1, gap: 4 },
    photoTitle: { fontWeight: "600", fontSize: 16, color: C.text },
    photoDesc: { fontWeight: "400", fontSize: 13, color: C.textSecondary, lineHeight: 18 },
    photoLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, alignSelf: "flex-start" },
    photoLinkText: { fontWeight: "600", fontSize: 14, color: C.tint },
    ageCard: { backgroundColor: C.surface, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.border, ...raised("md", "#55718F") },
    ageLabel: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 8 },
    ageInput: {
      fontWeight: "400",
      fontSize: 16,
      color: C.text,
      backgroundColor: C.surfaceElevated,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 12,
    },
    ageSaveBtn: {
      backgroundColor: C.tint,
      borderRadius: 10,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    ageSaveBtnSaved: { backgroundColor: C.green },
    ageSaveBtnText: { fontWeight: "600", fontSize: 14, color: "#fff" },
    blockSpacer: { height: 12 },
  });
}
