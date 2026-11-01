import { AuthReturnNotice } from "@/components/auth/AuthReturnNotice";
import { Landing } from "@/components/landing/Landing";
import { KatanaPageView } from "@/components/ui/KatanaPageView";

export default function HomePage() {
  return (
    <>
      <KatanaPageView path="/" />
      <AuthReturnNotice />
      <Landing />
    </>
  );
}
