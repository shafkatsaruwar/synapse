import { AuthReturnNotice } from "@/components/auth/AuthReturnNotice";
import { Landing } from "@/components/landing/Landing";

export default function HomePage() {
  return (
    <>
      <AuthReturnNotice />
      <Landing />
    </>
  );
}
