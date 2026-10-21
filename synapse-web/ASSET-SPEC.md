# Synapse studio asset spec

Shared identity for the marketing site and a future film. Units, names, and phase boundaries below are the contract. Do not retune one without the other.

## Scale and coordinates

- 1 unit = 10 cm. Y is up. The table is the plane `y = 0`.
- The phone lies flat, screen up, centered at the origin. Footprint: width `0.74` (X), depth `1.56` (Z). Chassis thickness is `0.066`, lifted `0.016` so a rear camera bump can rest on the table. The glass face is the top surface.
- The body is an extruded rounded rectangle (corner radius about `0.11`), not a uniform rounded box. A uniform radius larger than half the thickness turns the phone into a capsule. The screen is a smaller glass slab. Today is a rounded canvas that fades in with `screenReveal`.
- Glass panels are boxes in local space: X width, Y height, Z thickness `0.02`. The face is local +Z. Hanging, they are nearly vertical. In the stack, rotation X is about `-π/2`, so the face points up and local height lies along Z.
- Strings are vertical. Anchor height is `y = 8.4`, above the frame. A string starts a little above the panel’s top center and runs up. It never follows a panel through the phone. Detach shortens the string upward until it is gone.
- Camera near `0.08`, far `40`. Desktop intro is about `(0.15, 2.08, 6.70)` looking at `(0, 1.45, 0.10)`, fov 30. Mobile uses the `MOBILE_CAM` keys in `lib/animation/scene-sample.ts` and a wider fov.

## Materials

| Surface | Desktop | Mobile |
| --- | --- | --- |
| Table | Standard, `#f3efe8`, roughness 0.96 | Same, fewer segments |
| Phone body | Physical metal, `#2e2e32`, roughness 0.26, clearcoat. Glass screen with a reflection streak. Rear bump on the underside. | Standard metal, fewer curve segments |
| Glass | Physical, transmission 0.86, roughness 0.12, ior 1.45, clearcoat | Standard, transparent, no transmission |
| Type on glass | Canvas texture, 1024×640, sRGB, basic material in front of the glass | Same textures |
| Phone screen | Canvas 780×1688, opacity driven by `screenReveal` | Same |
| String | Basic `#5c534c`, radius 0.0032 | Same |
| Contact shadow | Radial canvas under the phone and under settled layers | Same |

Foreign panel tints (not third-party brands): clay `#C4A08A` Dosebook, sage `#8EA592` Visitly, rose `#C9A39C` Daynote, muted rose `#C49AA3` Cardkeep, stone `#9AA3AE` Recorda. At ALIGN they crossfade to cream glass and the Synapse names. Marks are a single letter in a circle, drawn by us.

Lighting: warm hemisphere, a key from the upper front-right, a faint burgundy fill from the left. Desktop adds three lightformers. No HDR download. No neon, no purple sweep.

## Phase boundaries

Progress is scroll through the studio, 0 to 1, scrubbed both ways. Names:

| Phase | Progress | What the picture does |
| --- | --- | --- |
| INTRO | 0.00–0.10 | Phone on the table. Five panels hanging and swaying. “Your health. Everywhere.” |
| SCATTERED | 0.10–0.28 | Camera drifts between panels. “Different apps.” “Different platforms.” “Different places to look.” |
| DISCONNECTION | 0.28–0.36 | Camera eases back. Sway settles to still. “No more.” |
| RELEASE | 0.36–0.44 | Strings detach in order and retract upward. Panels stay put. |
| FALL | 0.44–0.60 | Each panel drops in place, turns, then settles. Not physics. |
| STACK | 0.60–0.72 | Imperfect stack above the phone. Small orbit while you linger. |
| ALIGN | 0.72–0.82 | Layers center, lose their tilt, take on the Synapse face. |
| MERGE | 0.82–0.91 | Layers tighten into the screen and fade. |
| REVEAL | 0.91–1.00 | Today, with fictional sample data. “Meet Synapse.” |

Fall order: How I’m Feeling, Medications, Appointments, Emergency, Records. Stack offsets are in `STACK_X` / `STACK_Z` (left/right and depth), with about `0.06` of vertical air between centers. Thickness is `0.02`, so the sheets do not intersect. Merge is the first time they are allowed to occupy the same volume, and they fade while they do.

## Framing for a commercial

- Hold STACK as the hero still: camera near `(0.95, 1.32, 3.55)`, look at the stack, phone still in frame.
- Hold REVEAL top-down enough to read Today: camera near `(0, 2.15, 2.28)`.
- Type on panels must stay at least a short title and one line. Do not put real patient data on either.
- Strings stay above the glass. If a panel tilts, the string’s lower end remains above the top center.
- Reduced motion and the static storyboard must still say the same four beats: scattered, “no more,” stack, Synapse.

## File names

- Mark: `public/brand/mark.png` (from `synapse-reset/assets/images/synapse-logo-light.png`)
- Founder portrait, story page only: `public/brand/founder.jpg`
- Choreography source of truth: `lib/animation/scene-sample.ts`
- Panel faces and the Today texture: `lib/screens/draw.ts`
- Tokens: `app/globals.css` and `lib/design-tokens/tokens.ts`

## Texture budgets

- Panel face 1024×640. Today screen 780×1688. Shadow disc 256×256.
- No video textures. No external HDR. The phone is extruded slabs (body, glass, camera bump) plus side buttons, a speaker slot, and a contact shadow. Panels are five thin boxes. Strings are five cylinders.
