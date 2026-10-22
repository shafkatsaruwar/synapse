"use client";

import { useState } from "react";
import {
  APPEARANCE_ACCENTS,
  APPEARANCE_SURFACES,
  APPEARANCE_THEMES,
  APPEARANCE_WALLPAPERS,
  DEFAULT_DEMO_LOOK,
  accentById,
  themeById,
  type DemoLook,
} from "@/lib/appearance-demo";

const TILTS = [-5, 3.5, -2, 4, -3.5, 2.5];

export function AppearanceDemo({ variant }: { variant: "stage" | "studio" }) {
  const [applied, setApplied] = useState<DemoLook>(DEFAULT_DEMO_LOOK);
  const [draft, setDraft] = useState<DemoLook>(DEFAULT_DEMO_LOOK);
  const [note, setNote] = useState("");

  const theme = themeById(draft.theme);
  const accent = accentById(draft.accent);
  const wallpaper = APPEARANCE_WALLPAPERS.find((item) => item.id === draft.wallpaper) ?? APPEARANCE_WALLPAPERS[0];
  const ground =
    wallpaper.colors.length >= 2
      ? `linear-gradient(165deg, ${wallpaper.colors.join(", ")})`
      : theme.background;
  const cardBackground = draft.surface === "solid" ? (theme.dark ? "#1C1A1B" : "#FFFFFF") : draft.surface === "glass" ? (theme.dark ? "rgba(255,250,247,0.14)" : "rgba(255,255,255,0.62)") : theme.card;
  const cardShadow = draft.surface === "soft" ? "0 10px 24px rgba(32, 24, 20, 0.08)" : "none";

  function patch(next: Partial<DemoLook>) {
    setDraft((current) => ({ ...current, ...next }));
    setNote("");
  }

  return (
    <div className={`appearance-demo appearance-demo-${variant}`}>
      {variant === "stage" ? (
        <div className="hang-row" role="list">
          {APPEARANCE_THEMES.map((item, index) => (
            <div key={item.id} className="hang" role="listitem" style={{ ["--tilt" as string]: `${TILTS[index]}deg` }}>
              <button
                type="button"
                className={draft.theme === item.id ? "is-selected" : ""}
                aria-pressed={draft.theme === item.id}
                onClick={() => patch({ theme: item.id })}
              >
                <span className="mini" style={{ background: item.background, borderColor: item.border }} aria-hidden="true">
                  <i style={{ background: item.bar }} />
                  <i />
                  <b>
                    <s style={{ background: item.bar }} />
                    <s />
                    <s />
                  </b>
                </span>
                <strong>{item.label}</strong>
                <small>{item.blurb}</small>
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className={variant === "stage" ? "preview-hang" : "preview-studio"}>
        {variant === "stage" ? <span className="preview-string" aria-hidden="true" /> : null}
        <div
          className={`live-preview surface-${draft.surface} mode-${draft.mode}`}
          style={{ background: ground, color: theme.text }}
        >
          <p className="live-kicker">Live preview</p>
          <h3 style={{ color: theme.text }}>Good evening, Alex</h3>
          <div className="live-cards">
            <article style={{ background: cardBackground, borderColor: theme.border, boxShadow: cardShadow, color: theme.text }}>
              <strong>Medications</strong>
              <span style={{ color: theme.muted }}>Vitamin D · 1 of 2 doses today</span>
            </article>
            <article style={{ background: cardBackground, borderColor: theme.border, boxShadow: cardShadow, color: theme.text }}>
              <strong>Appointments</strong>
              <span style={{ color: theme.muted }}>Check-in · Tomorrow 10:30 AM</span>
            </article>
            <div className="live-split">
              <article style={{ background: cardBackground, borderColor: theme.border, boxShadow: cardShadow, color: theme.text }}>
                <strong>Feeling</strong>
                <span style={{ color: theme.muted }}>Steady</span>
              </article>
              <article style={{ background: cardBackground, borderColor: theme.border, boxShadow: cardShadow, color: theme.text }}>
                <strong>Sick Mode</strong>
                <span style={{ color: theme.muted }}>Off</span>
              </article>
            </div>
          </div>
          <div className="live-tabs" style={{ color: theme.muted }} aria-hidden="true">
            <i style={{ background: accent.hex }} />
            <i />
            <i className="live-plus" style={{ background: accent.hex }} />
            <i />
            <i />
          </div>
          <p className="live-note" style={{ color: theme.muted }}>
            Demo information only — not your real health data.
          </p>
        </div>
      </div>

      <div className="appearance-controls">
        <fieldset>
          <legend>App experience</legend>
          <div className="mode-pair">
            <button type="button" aria-pressed={draft.mode === "simple"} onClick={() => patch({ mode: "simple" })}>
              <strong>Simple Mode</strong>
              <small>Larger controls and fewer distractions.</small>
            </button>
            <button type="button" aria-pressed={draft.mode === "full"} onClick={() => patch({ mode: "full" })}>
              <strong>Full Mode</strong>
              <small>The complete Synapse experience.</small>
            </button>
          </div>
        </fieldset>

        {variant === "studio" ? (
          <fieldset>
            <legend>Theme</legend>
            <div className="theme-grid">
              {APPEARANCE_THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={draft.theme === item.id}
                  onClick={() => patch({ theme: item.id })}
                >
                  <span className="mini" style={{ background: item.background, borderColor: item.border }} aria-hidden="true">
                    <i style={{ background: item.bar }} />
                    <i />
                  </span>
                  <strong>{item.label}</strong>
                  <small>{item.blurb}</small>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset>
          <legend>Accent color</legend>
          <div className="swatch-row">
            {APPEARANCE_ACCENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-pressed={draft.accent === item.id}
                onClick={() => patch({ accent: item.id })}
                style={{ background: item.hex }}
              >
                {draft.accent === item.id ? <span aria-hidden="true">✓</span> : null}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Wallpaper</legend>
          <div className="paper-row">
            {APPEARANCE_WALLPAPERS.map((item) => (
              <button key={item.id} type="button" aria-pressed={draft.wallpaper === item.id} onClick={() => patch({ wallpaper: item.id })}>
                <span
                  aria-hidden="true"
                  style={{
                    background: item.colors.length ? `linear-gradient(160deg, ${item.colors.join(", ")})` : "#F7F5F2",
                  }}
                />
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Surface style</legend>
          <div className="surface-list">
            {APPEARANCE_SURFACES.map((item) => (
              <button key={item.id} type="button" aria-pressed={draft.surface === item.id} onClick={() => patch({ surface: item.id })}>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.body}</small>
                </span>
                {draft.surface === item.id ? <em aria-hidden="true">✓</em> : null}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="appearance-actions">
          <button
            type="button"
            className="appearance-cancel"
            onClick={() => {
              setDraft(applied);
              setNote("Cancelled. The demo is back to the last applied look.");
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="appearance-apply"
            style={{ background: accent.hex }}
            onClick={() => {
              setApplied(draft);
              setNote("Applied on this demo. Nothing was saved to an account.");
            }}
          >
            Apply Appearance
          </button>
        </div>
        <p className="appearance-note" role="status">
          {note}
        </p>
      </div>
    </div>
  );
}
