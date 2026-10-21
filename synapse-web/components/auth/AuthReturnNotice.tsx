"use client";

import { useEffect, useState } from "react";
import { readAuthCallback, stripAuthParams, type AuthCallback } from "@/lib/auth-callback";
import { AppStoreLink } from "@/components/ui/AppStoreLink";

export function AuthReturnNotice({ persistent = false }: { persistent?: boolean }) {
  const [callback, setCallback] = useState<AuthCallback | null>(null);

  useEffect(() => {
    const next = readAuthCallback(window.location.href);
    setCallback(next);
    if (!next.present) return;
    const cleaned = stripAuthParams(window.location.href);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (cleaned !== current) window.history.replaceState(window.history.state, "", cleaned);
  }, []);

  if (!callback?.present && !persistent) return null;

  const recovery = persistent || callback?.recovery;
  return (
    <aside className={persistent ? "auth-return auth-return-page" : "auth-return"} role="status">
      <p className="eyebrow">{recovery ? "Password reset" : "Email confirmation"}</p>
      <h2>{recovery ? "Finish this in the Synapse app." : "Return to the Synapse app."}</h2>
      <p>
        {recovery
          ? "This password-reset link opened in the browser. The new password is chosen in the Synapse iPhone app. Open the app and, if you still need a reset, request another email from the sign-in screen."
          : "This confirmation link opened in the browser. Open Synapse on your iPhone and sign in. This website cannot confirm the account inside the app."}
      </p>
      {callback?.present ? <p>The one-time token from the link was not saved, and it was removed from the address bar.</p> : null}
      <AppStoreLink placement={recovery ? "reset-password" : "email-confirm"}>Open the App Store</AppStoreLink>
    </aside>
  );
}
