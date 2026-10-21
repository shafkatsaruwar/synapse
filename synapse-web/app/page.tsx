import { AuthReturnNotice } from "@/components/auth/AuthReturnNotice";
import { CinematicHero } from "@/components/cinematic/CinematicHero";
import { Showcase } from "@/components/product/Showcase";

export default function HomePage() {
  return (
    <>
      <AuthReturnNotice />
      <CinematicHero />
      <Showcase />
    </>
  );
}
