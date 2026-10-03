# UI Style Guide

Visual contract derived from the approved landing page (spec § 7, user review
2026-10-03: "keep this style for future pages"). **Every new page follows this
guide until the user explicitly says otherwise.** `docs/reference/*.png`
(gitignored) are references for app *logic and flow* (booking catalog → event
type → slots), not for visual style — the style is ours, as defined here.

## Foundation

- Mantine 9, **default theme**. No custom fonts, no brand palette, no logo
  artwork, no images, no animations — until the user asks.
- Acceptance bar: "clean generic SaaS, nothing broken-looking".
- One process serves API + static files — pages are plain client routes;
  do not introduce a router until a spec says so.

## Page skeleton

```text
<header>   banner    — sticky, height 60, bg var(--mantine-color-body),
                       border-bottom gray-3
<main>     main      — page sections
<footer>   contentinfo — border-top gray-3, py lg
```

Use `AppShell` (`header={{ height: 60 }} padding="md"`) with semantic
`<header>/<main>/<footer>` landmarks reachable as roles `banner`/`main`/
`contentinfo`.

## Header

- Logo: `Anchor` fw 700 → `/`, text `Запись на звонок` / `Call Booking`.
- Inline nav (`Anchor` size sm, `underline="never"`): visible from `xs` (576px)
  only (`visibleFrom="xs"`, stays in DOM below — hide visually, not from the
  tree).
- Right cluster: language switcher (`RU`/`EN`, `compact-xs`, always visible) +
  primary CTA (`compact-sm`). Header is one non-wrapping line (`wrap="nowrap"`,
  logo `clamp(0.875rem, 2.8vw, 1.1rem)`) — no second line at 320px.
- Header stays compact (≤ 64px); it must not compete with the hero.

## Hero (per page that has one)

- Dominant block of the page: H1 `Title order={1} fw={900}`,
  `fontSize: clamp(2.5rem, 6vw, 4rem)`, `lineHeight: 1.1`.
- Subheading: `Text size="xl" c="dimmed" maw={620}`.
- CTA row: primary `Button size="lg"` + secondary `variant="default" size="lg"`.
- Generous vertical padding (`calc(4rem + 6vw)`) — noticeably bigger than
  content sections (`py="xl"`).

## Content sections

- Each is a semantic `<section id="...">` with `scrollMarginTop: 80`
  (sticky header must not cover anchor targets).
- Wrapped in `Container size="lg" py="xl"`; narrow/centered blocks use `size="sm"`.
- Section heading: single `Title order={2}`; card titles `order={3}`; exactly
  one `order={1}` (hero) per page.
- Card rows: CSS grid `repeat(auto-fit, minmax(min(260px, 100%), 1fr))` with
  `gap="md"` — horizontal row on desktop, vertical stack on mobile, no
  breakpoint JS. Numbered sequences are real `<ol>`/`<li>`; a decorative
  number badge (`Text fw={900} c="blue"`) never replaces list semantics.
- Cards: `Card withBorder p="lg"`, body text `size="sm" c="dimmed"`.

## Buttons & links

- Primary action: filled `Button`; ghost action: `variant="default"`.
- CTA buttons are `Button component="a" href=...` — role **link**, not button
  (targets come from `web/src/links.ts`).
- Text links: `Anchor underline="never"`; external links get
  `target="_blank" rel="noopener noreferrer"` (the `rel`/`target` pair is a
  hard rule, asserted by tests).

## Copy & i18n

- Zero hardcoded UI strings in `.tsx` components.
- `web/src/content/landing.ts` holds `landingCopy = { ru, en }` (`as const`) —
  two locales, full coverage, RU is the default.
- `web/src/links.ts` holds every href in one place.
- `web/src/i18n.tsx`: `LandingLocaleProvider` + `useLanding()`; provider sets
  `<html lang>`, persists the choice in `localStorage['ui.locale']`, restores
  it on mount, falls back to `ru`. Switcher never changes hrefs/ids.

## Testing the look

- Visual acceptance = screenshots (desktop 1280 + mobile 375, both locales)
  against: hero dominance, no horizontal scroll, header fits, sections stack
  correctly. Keep screenshots out of the repo.
- DOM acceptance: query by role / accessible name / landmark only
  (Testing Library), expectations come from the spec's canonical strings —
  never from CSS or class names.
- `test/setup.ts` polyfills `matchMedia` + `ResizeObserver` and clears
  `localStorage` after each test.
