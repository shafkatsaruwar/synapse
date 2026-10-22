import type { Testimonial } from "./testimonials";
import s from "./Landing.module.css";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function Column({ items, className, duration }: { items: Testimonial[]; className?: string; duration: number }) {
  return (
    <div className={`${s.col} ${className ?? ""}`}>
      <div className={s.colTrack} style={{ animationDuration: `${duration}s` }}>
        {[0, 1].map((copy) => (
          <div key={copy} className={s.colGroup} aria-hidden={copy === 1 ? true : undefined}>
            {items.map((t, i) => (
              <figure key={`${copy}-${i}`} className={s.quote}>
                <blockquote className={s.quoteText}>{t.text}</blockquote>
                <figcaption className={s.quoteAuthor}>
                  <span className={s.avatar} aria-hidden="true">
                    {initials(t.name)}
                  </span>
                  <span className={s.authorText}>
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TestimonialsColumns({ items }: { items: Testimonial[] }) {
  if (items.length === 0) return null;
  // Spread the quotes across three columns, like the template.
  const cols = [0, 1, 2].map((c) => items.filter((_, i) => i % 3 === c));
  return (
    <div className={s.colsWrap}>
      {cols[0]!.length > 0 && <Column items={cols[0]!} duration={26} />}
      {cols[1]!.length > 0 && <Column items={cols[1]!} duration={32} className={s.hideSm} />}
      {cols[2]!.length > 0 && <Column items={cols[2]!} duration={29} className={s.hideMd} />}
    </div>
  );
}
