import { story } from "@/lib/feature-content/content";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Our Story",
  description: "Why Synapse exists, in the words already published inside the app — and nothing invented beyond that.",
  path: "/story",
});

export default function StoryPage() {
  return (
    <div className="page story-page">
      <header className="page-hero">
        <p className="eyebrow">Our Story</p>
        <h1>Built so health admin can feel calm.</h1>
      </header>
      <figure className="founder">
        <img src="/brand/founder.jpg" alt="Founder of Synapse" width={960} height={700} />
        <figcaption>
          {story.name}
          <span>{story.role}</span>
        </figcaption>
      </figure>
      <blockquote>
        <p>“{story.quote}”</p>
        <footer>— From Meet the Founder in the app</footer>
      </blockquote>
      {story.paragraphs.map((paragraph) => (
        <p key={paragraph} className="story-p">
          {paragraph}
        </p>
      ))}
      <ul className="story-points">
        {story.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <p className="story-p">
        You do not need an account to use Synapse. Health logs stay on the device unless you export a backup file yourself. This page does not add a biography beyond the short note already in the app.
      </p>
    </div>
  );
}
