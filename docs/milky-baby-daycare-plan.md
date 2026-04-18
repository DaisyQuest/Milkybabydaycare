# Milky Baby Daycare Website Plan

## 1) Creative Direction

### Core vibe
- **Theme:** pastel + bubbly + anime-inspired kawaii energy.
- **Mood words:** dreamy, playful, sparkly, welcoming, silly, soft.
- **Primary joke:** "Welcome to Milky Baby Daycare — are you picking up or dropping off?"
- **Tone:** intentionally over-the-top cute, self-aware, and cheerful.

### Visual style goals
- Rounded everything (cards, buttons, panels, speech bubbles).
- Puffy cloud-like backgrounds and floating sticker decorations.
- Soft gradients (lavender, baby pink, mint, sky blue, cream).
- Tiny motion loops: bobbing, twinkling stars, bouncing mascot.
- Sparkle overlays and heart/bubble particles on interactions.

### Safety rails for style
- Keep text readable over animated backgrounds.
- Respect reduced-motion users with equivalent non-animated state.
- Keep joke non-offensive and clearly playful.

---

## 2) User Experience / Page Narrative

## Single-page flow
1. **Hero entrance**
   - Big title: "Welcome to Milky Baby Daycare!"
   - Subtitle: "Are you picking up or dropping off?"
   - Two giant CTA buttons:
     - "I’m Picking Up"
     - "I’m Dropping Off"
2. **Choice reaction panel**
   - Clicking either CTA triggers a playful response card with animated confetti/bubbles.
   - Optional random one-liner pool to keep it funny on repeat visits.
3. **Fun extras zone**
   - "Daily Cuteness Meter"
   - "Naptime Alert"
   - "Snack Forecast"
4. **Footer**
   - "This is a joke fan-style site. 100% cuteness, 0% seriousness."

### Interaction design
- Buttons scale up on hover and "squish" on click.
- Speech-bubble modal appears for results, with character mascot reaction.
- Background particles move slowly at different layers (parallax-like feel).
- Micro-sounds (optional and muted by default) behind explicit user interaction only.

---

## 3) Technical Architecture

## Proposed stack
- **HTML5 + CSS + vanilla JavaScript** (lightweight and easy to maintain).
- No framework required for current scope.
- Structure for future portability to React/Svelte if needed.

### File structure target
- `index.html`
- `styles/`
  - `tokens.css` (color, spacing, typography, z-index)
  - `base.css`
  - `components.css`
  - `animations.css`
- `scripts/`
  - `app.js` (bootstrap)
  - `state.js` (state + event routing)
  - `ui.js` (DOM rendering)
  - `effects.js` (particles, sparkles)
- `assets/`
  - `img/`, `icons/`, `audio/`
- `tests/`
  - unit + integration + accessibility smoke checks

### State model (minimal)
- `selection`: `"pickup" | "dropoff" | null`
- `reducedMotion`: boolean
- `themeVariant`: optional string
- `messageIndex`: number (for randomized response line)

---

## 4) Animation Plan (Maximum Fun, Controlled Complexity)

## Animation tiers

### Tier 1 (must-have)
- Floating gradient blobs in background.
- Gentle mascot idle bobbing.
- CTA hover pulse and click squish.
- Sparkle twinkle loop.

### Tier 2 (should-have)
- Click-triggered bubble burst particles.
- Staggered card reveal transitions.
- Interactive sticker wiggle on hover.

### Tier 3 (nice-to-have)
- Custom cursor trail (hearts/stars).
- Day/night pastel mode swap.
- Tiny "combo" effect for repeated button presses.

### Performance constraints
- Keep animation to `transform` and `opacity` whenever possible.
- Limit simultaneously active particles.
- Cap effect duration and clean nodes to avoid leaks.
- Maintain smoothness on mid-range mobile devices.

---

## 5) Accessibility + Usability Requirements

- Color contrast passes WCAG for body text and controls.
- Keyboard navigation for all controls and modal flows.
- Visible focus ring designed to match theme.
- `prefers-reduced-motion` disables/simplifies non-essential animation.
- Clear labels and semantic HTML (`main`, `header`, `button`, etc.).
- Joke context is obvious and not misleading.

---

## 6) Testing Strategy (Full Branch Coverage Target)

## Testing philosophy
Because this project is animation-heavy, we should avoid "visual-only confidence." Every branch in interaction logic should be covered with deterministic tests, while visual behavior gets snapshot + lightweight E2E checks.

### Unit tests (logic)
- Selection handler:
  - sets `pickup` path correctly
  - sets `dropoff` path correctly
  - ignores invalid action input branch
- Message resolver:
  - deterministic branch with seeded randomness
  - fallback branch when message list empty
- Reduced motion resolver:
  - branch true when media query matches
  - branch false otherwise

### DOM integration tests
- Initial render state assertions.
- CTA click updates response panel content.
- Modal open/close with keyboard and click.
- Focus management branch checks (focus trap on/off states).
- Cleanup branch for destroyed particle nodes.

### Accessibility tests
- Axe-based smoke checks for top-level page and modal.
- Keyboard traversal test through all interactive controls.
- Reduced motion mode test confirms animation class toggles are disabled.

### End-to-end tests
- Main user flow:
  - load page
  - choose pickup
  - verify themed response and animation class presence
- alternate flow:
  - choose dropoff
  - verify alternate response path
- resilient flow:
  - repeated rapid clicks do not duplicate stuck overlays

### Coverage goals
- Branch coverage: **100% target** for JS logic modules.
- Line coverage: **95%+** minimum.
- Function coverage: **100%** on custom modules.
- CI should fail on branch coverage regression.

### Suggested tooling
- **Vitest** + **@testing-library/dom** for unit/integration.
- **Playwright** for end-to-end and optional visual snapshots.
- **axe-core** checks in integration/E2E.
- **c8** for coverage enforcement.

---

## 7) Delivery Phases

### Phase 0: Foundation
- Establish file structure and design tokens.
- Build static hero and CTA layout.
- Add baseline lint/test setup.

### Phase 1: Core interactions
- Implement selection state and response panel.
- Add must-have animations (Tier 1).
- Add unit + integration tests for all core branches.

### Phase 2: Delight pass
- Add particle effects and stagger reveals (Tier 2).
- Add polish and accessibility refinements.
- Expand tests for animation toggles and cleanup branches.

### Phase 3: Quality lock
- Run full coverage gate.
- Run E2E flows across desktop/mobile sizes.
- Tune performance and remove flaky effects.

---

## 8) Risks & Mitigations

- **Risk:** animation overload hurts readability/performance.
  - **Mitigation:** tiered animation rollout + strict performance budgets.
- **Risk:** flaky tests due to timers/animation timing.
  - **Mitigation:** fake timers + deterministic seeds + test IDs.
- **Risk:** accessibility regressions as visuals evolve.
  - **Mitigation:** mandatory a11y checks in CI pipeline.

---

## 9) Immediate Next Step Recommendation

Start with **Phase 0 + Phase 1 skeleton** in one implementation pass:
1. Create semantic page layout.
2. Wire selection state and response rendering.
3. Add reduced-motion support.
4. Land complete test scaffolding with branch coverage checks enabled from day one.

