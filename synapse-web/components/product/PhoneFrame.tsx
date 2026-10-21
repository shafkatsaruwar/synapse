import type { ReactNode } from "react";

export function PhoneFrame({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <figure className="device">
      <div className="device-shell">
        <div className="device-screen">{children}</div>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
