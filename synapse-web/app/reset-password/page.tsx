import type { Metadata } from "next";
import Link from "next/link";
import { AuthReturnNotice } from "@/components/auth/AuthReturnNotice";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Return to the app",
    description: "Password reset emails open here. The new password is set in the Synapse iPhone app.",
    path: "/reset-password",
  }),
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="page prose">
      <header className="page-hero">
        <p className="eyebrow">Account</p>
        <h1>Return to the Synapse app.</h1>
        <p className="lede">
          Password-reset mail from Synapse opens this page. Choosing a new password happens in the iPhone app. This website does not set a password and does not keep the link’s token.
        </p>
      </header>
      <AuthReturnNotice persistent />
      <p>
        Open Synapse on your iPhone. From the sign-in screen, request a new reset if this one has expired. If you already know your password, sign in there.
      </p>
      <p>
        <Link href="/">Back to the overview</Link>
      </p>
    </div>
  );
}
