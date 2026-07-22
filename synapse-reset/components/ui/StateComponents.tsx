import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { UITokens } from "@/constants/ui-design";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = "📭",
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description && (
        <Text style={styles.emptyDescription}>{description}</Text>
      )}
      {actionLabel && onAction && (
        <Pressable
          style={styles.emptyButton}
          onPress={onAction}
        >
          <Text style={styles.emptyButtonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator
        size="large"
        color="#EF4444"
        style={{ marginBottom: UITokens.spacing.md }}
      />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

interface SkeletonProps {
  width?: string | number;
  height?: number;
  borderRadius?: number;
}

export function SkeletonLoader({
  width = "100%",
  height = 20,
  borderRadius = UITokens.borderRadius.sm,
}: SkeletonProps) {
  return (
    <View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
      ]}
    />
  );
}

interface SectionSkeletonProps {
  lines?: number;
}

export function SectionSkeleton({ lines = 3 }: SectionSkeletonProps) {
  return (
    <View style={styles.sectionSkeleton}>
      <SkeletonLoader width="60%" height={16} />
      <View style={{ marginTop: UITokens.spacing.md }} />
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i}>
          <SkeletonLoader
            width={i === lines - 1 ? "80%" : "100%"}
            height={12}
          />
          <View style={{ marginTop: UITokens.spacing.sm }} />
        </View>
      ))}
    </View>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  retryLabel = "Try again",
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry && (
        <Pressable
          style={styles.errorButton}
          onPress={onRetry}
        >
          <Text style={styles.errorButtonText}>{retryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: UITokens.spacing.lg,
    minHeight: 300,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: UITokens.spacing.lg,
  },
  emptyTitle: {
    fontSize: UITokens.typography.h2.fontSize,
    fontWeight: "600",
    color: "#F3F4F6",
    marginBottom: UITokens.spacing.md,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: UITokens.typography.body.fontSize,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: UITokens.spacing.lg,
  },
  emptyButton: {
    backgroundColor: "#EF4444",
    paddingHorizontal: UITokens.spacing.lg,
    paddingVertical: UITokens.spacing.md,
    borderRadius: UITokens.borderRadius.md,
    minHeight: UITokens.touchTarget,
    justifyContent: "center",
  },
  emptyButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "white",
    textAlign: "center",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 300,
  },
  loadingText: {
    fontSize: UITokens.typography.body.fontSize,
    color: "#9CA3AF",
  },

  skeleton: {
    backgroundColor: "#374151",
    borderRadius: UITokens.borderRadius.sm,
  },
  sectionSkeleton: {
    padding: UITokens.spacing.lg,
    backgroundColor: "#1F2937",
    borderRadius: UITokens.borderRadius.md,
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: UITokens.spacing.lg,
    minHeight: 300,
  },
  errorIcon: {
    fontSize: 56,
    marginBottom: UITokens.spacing.lg,
  },
  errorTitle: {
    fontSize: UITokens.typography.h2.fontSize,
    fontWeight: "600",
    color: "#EF4444",
    marginBottom: UITokens.spacing.md,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: UITokens.typography.body.fontSize,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: UITokens.spacing.lg,
  },
  errorButton: {
    backgroundColor: "#EF4444",
    paddingHorizontal: UITokens.spacing.lg,
    paddingVertical: UITokens.spacing.md,
    borderRadius: UITokens.borderRadius.md,
    minHeight: UITokens.touchTarget,
    justifyContent: "center",
  },
  errorButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "white",
    textAlign: "center",
  },
});
