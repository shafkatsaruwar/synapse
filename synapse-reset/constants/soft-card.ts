import { Platform, type ViewStyle } from "react-native";

export type SoftCardTone = "light" | "dark";

/**
 * Apple-inspired soft elevation for Quietly Human / Soft Evergreen surfaces.
 * Keeps cards readable on #F7F8FA without harsh outlines or heavy drop shadows.
 */
export function softCardElevation(tone: SoftCardTone = "light"): ViewStyle {
  if (tone === "dark") {
    return {
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      ...Platform.select<ViewStyle>({
        ios: {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
        },
        android: {
          elevation: 3,
        },
        default: {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
        },
      }),
    };
  }

  return {
    borderWidth: 1,
    borderColor: "#E5E9EB",
    ...Platform.select<ViewStyle>({
      ios: {
        shadowColor: "#172B3A",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: "#172B3A",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
    }),
  };
}

/** Full soft-card surface: elevated white/charcoal fill + soft edge treatment. */
export function softCardSurface(
  options: { tone?: SoftCardTone; backgroundColor: string; borderRadius?: number } 
): ViewStyle {
  const tone = options.tone ?? "light";
  return {
    backgroundColor: options.backgroundColor,
    borderRadius: options.borderRadius ?? 22,
    ...softCardElevation(tone),
  };
}
