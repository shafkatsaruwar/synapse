"use client";

import { APP_STORE_URL } from "@/lib/design-tokens/tokens";
import { track } from "@/lib/analytics";

type Props = {
  className?: string;
  children?: React.ReactNode;
  placement: string;
};

export function AppStoreLink({ className, children, placement }: Props) {
  return (
    <a
      className={className ?? "btn btn-primary"}
      href={APP_STORE_URL}
      rel="noopener noreferrer"
      onClick={() => track("app_store_click", { id: placement })}
    >
      {children ?? "Download on the App Store"}
    </a>
  );
}
