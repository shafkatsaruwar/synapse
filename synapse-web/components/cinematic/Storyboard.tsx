import { AppStoreLink } from "@/components/ui/AppStoreLink";
import { PhoneFrame } from "@/components/product/PhoneFrame";
import { TodayScreen } from "@/components/product/screens";

const frames = [
  {
    title: "Your health. Everywhere.",
    body: "Medications. Appointments. Records. Important details. All in different places.",
    scene: "hanging",
  },
  {
    title: "Different places to look.",
    body: "Different apps. Different platforms. Different places to look.",
    scene: "scattered",
  },
  {
    title: "No more.",
    body: "The pieces come down and rest in one imperfect stack.",
    scene: "stack",
  },
  {
    title: "Your health life, finally in one place.",
    body: "Meet Synapse. Your personal health companion.",
    scene: "reveal",
  },
];

export function Storyboard() {
  return (
    <section className="storyboard" aria-labelledby="storyboard-title">
      <div className="storyboard-intro">
        <p className="eyebrow">Synapse</p>
        <h1 id="storyboard-title">Your health. Everywhere.</h1>
        <p className="lede">A lighter telling of the same story, without the 3D studio.</p>
        <div className="hero-actions">
          <AppStoreLink placement="storyboard" />
          <a className="btn btn-text" href="#showcase">
            Explore Synapse
          </a>
        </div>
      </div>
      <ol className="storyboard-frames">
        {frames.map((frame, index) => (
          <li key={frame.title} className={`story-frame story-${frame.scene}`}>
            <div className="story-stage" aria-hidden="true">
              {frame.scene === "reveal" ? (
                <PhoneFrame caption="">
                  <TodayScreen />
                </PhoneFrame>
              ) : (
                <div className={`stage stage-${frame.scene}`}>
                  <span />
                  <span />
                  <span />
                  <i />
                </div>
              )}
            </div>
            <div>
              <p className="eyebrow">0{index + 1}</p>
              <h2>{frame.title}</h2>
              <p>{frame.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
