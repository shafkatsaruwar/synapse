import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const C = Colors.dark;

export default function MeetFounderScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: isWide ? 40 : Platform.OS === "web" ? 20 : 16,
          paddingBottom: isWide ? 40 : Platform.OS === "web" ? 118 : insets.bottom + 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Photo header */}
      <View style={styles.photoContainer}>
        <Image
          source={require("@/assets/images/founder.png")}
          style={styles.photo}
          resizeMode="cover"
        />
        <View style={styles.photoBadge}>
          <Text style={styles.photoBadgeText}>💊 Founder</Text>
        </View>
      </View>

      {/* Name & title */}
      <View style={styles.nameBlock}>
        <Text style={styles.name}>Mohammed Shafkat Saruwar</Text>
        <Text style={styles.tagline}>Building Synapse Health</Text>
        <View style={styles.taglineRow}>
          <Text style={styles.taglineItem}>🧠 Personal health, simplified</Text>
          <Text style={styles.taglineItem}>🎯 Focused on real-life usability</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Intro */}
      <View style={styles.introCard}>
        <Text style={styles.introText}>
          Hi, I'm Mohammed Shafkat Saruwar. I built Synapse Health to make managing your health feel calm — not like a chore.
        </Text>
      </View>

      {/* Section: Why Synapse */}
      <Section emoji="🧩" title="Why Synapse?">
        <Text style={styles.bodyText}>
          Managing health shouldn't feel overwhelming.{"\n"}
          Medications. Appointments. Daily check-ins.{"\n"}
          Most apps turn this into a chore.
        </Text>
        <Text style={styles.bodyText}>Synapse is different.</Text>
        <BulletList items={["No accounts", "No clutter", "No pressure"]} />
        <Text style={styles.bodyText}>Just a calm space to stay on track.</Text>
      </Section>

      {/* Section: Built With Purpose */}
      <Section emoji="⚙️" title="Built With Purpose">
        <Text style={styles.bodyText}>
          This app wasn't built for trends.{"\n"}
          It was built from experience.
        </Text>
        <Text style={styles.bodyText}>Every feature exists because it solves a real problem.</Text>
        <BulletList
          items={[
            "Daily logs that actually make sense",
            "Medication tracking that feels simple",
            "Emergency info when it matters most",
          ]}
        />
      </Section>

      {/* Section: Privacy First */}
      <Section emoji="🔒" title="Privacy First">
        <Text style={styles.bodyText}>Your data stays with you.</Text>
        <BulletList items={["No servers", "No tracking", "No accounts"]} />
        <Text style={styles.bodyText}>Everything lives on your device.</Text>
      </Section>

      {/* Section: What's Next */}
      <Section emoji="🚀" title="What's Next">
        <Text style={styles.bodyText}>Synapse is just getting started.</Text>
        <BulletList
          items={[
            "Smarter insights",
            "Better reminders",
            "Cleaner design",
            "More support for everyday health",
          ]}
        />
      </Section>

      {/* Section: A Note */}
      <View style={styles.noteCard}>
        <Text style={styles.noteSectionLabel}>✨ A Note</Text>
        <Text style={styles.noteText}>
          This isn't just an app.{"\n"}
          It's something I wish I had.{"\n\n"}
          And now, you do.
        </Text>
        <Text style={styles.noteSignature}>— Shafkat</Text>
      </View>
    </ScrollView>
  );
}

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEmoji}>{emoji}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 20 },

  photoContainer: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 8,
  },
  photo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: C.accent,
    backgroundColor: C.surface,
  },
  photoBadge: {
    marginTop: 10,
    backgroundColor: C.accentLight,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  photoBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.accent,
  },

  nameBlock: {
    alignItems: "center",
    marginBottom: 20,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: C.text,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  tagline: {
    fontSize: 14,
    fontWeight: "500",
    color: C.accent,
    marginTop: 4,
  },
  taglineRow: {
    marginTop: 8,
    gap: 4,
    alignItems: "center",
  },
  taglineItem: {
    fontSize: 13,
    color: C.textSecondary,
  },

  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 20,
  },

  introCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  introText: {
    fontSize: 15,
    color: C.text,
    lineHeight: 23,
    fontStyle: "italic",
  },

  section: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionEmoji: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.accent,
    letterSpacing: -0.3,
  },
  sectionBody: {
    gap: 8,
  },
  bodyText: {
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 21,
  },

  bulletList: {
    gap: 6,
    paddingLeft: 4,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
  },
  bulletText: {
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 20,
  },

  noteCard: {
    backgroundColor: C.accent,
    borderRadius: 14,
    padding: 22,
    marginTop: 4,
    marginBottom: 8,
  },
  noteSectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
    marginBottom: 10,
  },
  noteText: {
    fontSize: 16,
    color: "#FFFFFF",
    lineHeight: 26,
    fontStyle: "italic",
  },
  noteSignature: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 14,
    fontWeight: "600",
  },
});
