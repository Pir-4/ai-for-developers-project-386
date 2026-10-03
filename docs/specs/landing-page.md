# Specification: Landing Page

- **Stage**: feature 1 — landing page of the service.
- **Branch / PR**: `spec/landing-page` (this document). Implementation lands in
  `feat/landing-page` only after this spec is approved and merged.
- **Status**: v2 — user review feedback applied 2026-10-03 (§ 9).

## 1. Goal

The first page a visitor sees at `/`. It explains the product in 30 seconds and
leads the visitor to the booking flow.

Success criteria:

- After reading the page the visitor can answer: what the service is, how it
  works, whether it fits them, what to do next.
- Every block answers one question and does not duplicate other blocks.

## 2. Scope

In scope:

- a static page assembled from named components;
- test tooling for the `web` workspace (vitest + jsdom + Testing Library) —
  the project has no frontend tests today;
- header and footer navigation via in-page anchors;
- UI language switcher RU/EN (§ 6.1) — interface copy only.

Out of scope (later stages):

- the booking page itself (the "Create meeting" CTA is a placeholder, § 4.1);
- router, backend data, custom theme, analytics, burger menu;
- translating server-side data (slot times, user names) — the booking domain
  stays single-locale;
- SEO metadata beyond the existing `<title>`.

## 3. Page structure

Order of blocks, top to bottom. UI texts below are canonical for the default
locale (RU); the English locale mirrors this structure (§ 6.1). Implementation
must render exactly these strings (stored once in `web/src/content/landing.ts`,
§ 8 item 8).

### 3.1 Header — `SiteHeader`

Sticky single line: logo left, nav center/right, primary button right.

| Element                | Text / behavior |
|------------------------|-----------------|
| Logo (link to `/`)     | `Запись на звонок` |
| Nav link 1             | `Как это работает` → `#how` |
| Nav link 2             | `Для кого` → `#audiences` (leads to the three-audience section) |
| Language switcher      | `RU` / `EN` — toggles all UI copy (§ 6.1) |
| Primary button         | `Создать встречу` → § 4.1 |

### 3.2 Hero — `HeroSection`

- H1: `Запись на звонок за 30 секунд` («30 seconds» = booking speed, not slot
  length)
- Subheading: `Вы публикуете свободные слоты — гость выбирает удобное время
  сам. Никакой переписки «а вам удобно в 15:00 или в 15:30?».`
  (slot durations deliberately not in copy — the product will offer 15- and
  30-minute slots)
- Buttons: `Создать встречу` (primary, § 4.1) and `Как это работает`
  (secondary, `href="#how"`).
- No images or illustrations in this stage — text layout only.
- **Visual scale (contract)**: the hero is the dominant block of the page —
  clearly larger than every other section. H1 in the hero uses display-size
  typography (font size ≈ 2.5–3× body, Mantine `order={1}`+ / `clamp()`),
  vertical padding noticeably bigger than other sections (~64px+ on desktop).
  Header stays compact (≤ 64px height); content sections and footer use
  regular scales.

### 3.3 Steps — `HowItWorksSection` (`id="how"`)

H2: `Как это работает`. Exactly three steps in a real ordered list (§ 6):

1. `Опубликуйте слот` — `Отметьте свободные интервалы — утром, днём или
   вечером, когда вам удобно говорить.`
2. `Поделитесь ссылкой` — `Отправьте гостю ссылку на страницу записи — он
   увидит все свободные слоты сразу.`
3. `Созвонитесь` — `Гость выбирает время, встреча появляется в вашем списке
   ближайших звонков. Остаётся только позвонить.`

Desktop: horizontal card row. Mobile: vertical stack.

### 3.4 Audiences — `AudiencesSection` (`id="audiences"`)

H2: `Для кого этот сервис`. Exactly three cards, copy must match the product's
actual model (no accounts, no personal pages — do not invent features):

1. `Владельцу встреч` — `Вы управляете расписанием: публикуете только то
   время, которое действительно свободно, и видите все записи в одном списке.`
2. `Коллеге и команде` — `Не нужно согласовывать время встречи перепиской —
   откройте ссылку на запись и выберите слот, который ещё свободен.`
3. `Гостю без аккаунта` — `Запись занимает меньше минуты: имя, комментарий,
   слот — и всё. Регистрация не требуется.`

Desktop: single row. Mobile: stacked.

### 3.5 Closing CTA — `CtaSection` (`id="cta"`)

- H2: `Готовы перестать согласовывать время по переписке?`
- Supporting line: `Опубликуйте первый слот — ссылкой можно делиться уже сегодня.`
- Primary button: `Создать встречу` (§ 4.1).

### 3.6 Footer — `SiteFooter`

- Column "Продукт": links `Как это работает` (`#how`) and `Для кого`
  (`#audiences`) — same anchors as the header.
- Column "Проект": external link `GitHub` →
  `https://github.com/Pir-4/ai-for-developers-project-386`, `target="_blank"`,
  `rel` contains `noopener`.
- About line: `Учебный проект Хекслета` as an external link →
  `https://ru.hexlet.io/programs/ai-for-developers` (same wording as README),
  `target="_blank"`, `rel` contains `noopener`.

## 4. Navigation and URLs

- Single route `/`. No router in this stage (decision, § 9).
- Anchor ids are stable contract values: `how`, `audiences`, `cta`.
- Header and footer nav links point to `#how` / `#audiences`.

### 4.1 CTA placeholder behavior

- All `Создать встречу` buttons (header, hero, closing) render as
  `href="#cta"` — they scroll to the closing CTA section, because a booking
  page does not exist yet.
- No click handlers, no alerts, no disabled state.
- The target is defined once: `web/src/links.ts` exports
  `createMeetingHref` (currently `'#cta'`). Moving to the real booking page in
  a later stage is a one-line change plus test copy update.

## 5. Responsive behavior

- Mantine breakpoints: `xs` = 576px, `sm` = 768px.
- Below `xs`: header nav links are hidden (visually only — they stay in the
  DOM, § 8 tests cannot rely on viewport); logo, language switcher and the
  primary button remain. No burger in this stage.
- The header is a single non-wrapping line: the logo shrinks via
  `clamp(0.875rem, 2.8vw, 1.1rem)`, switcher `compact-xs`, CTA `compact-sm`.
- Steps and audience cards stack vertically (CSS auto-fit grid, no JS).
- 320px–1920px without horizontal scroll; verified manually via screenshot
  in both locales.

## 6. Accessibility (spec says what, implementation picks how)

- Exactly one `<h1>` (hero title); each of the three content sections below the
  hero has exactly one `<h2>`.
- Real landmarks: `<header>` (banner), `<main>`, `<footer>` (contentinfo) —
  Mantine `AppShell` must not swallow them.
- Steps are a programmatically ordered `<ol>`; a decorative number badge is
  not a substitute for the list structure.
- Anchor links are keyboard-focusable and scroll to the target section
  (`scroll-margin-top` so the sticky header does not cover the heading).
- Body text meets WCAG 2.1 AA contrast on both light and dark palettes of the
  default Mantine theme.
- Tests query by role, accessible name, or landmark — never by class or CSS.

### 6.1 Language switcher (i18n)

- Two locales: `ru` (default) and `en`. Full interface copy exists in both;
  no partial translation.
- The switcher lives in the header: two buttons `RU` and `EN`, visible at all
  breakpoints (it replaces nav links space-wise on mobile if needed — see § 5).
- Clicking a locale instantly re-renders every string on the page in that
  locale. Hrefs, anchor ids and external links never change (§ 4).
- Choice is remembered: `localStorage` key `ui.locale`; a returning visitor
  sees their last locale. Invalid/absent value → `ru`.
- `<html lang>` reflects the active locale (`lang="ru"` / `lang="en"`).
- English copy (canonical, mirrors § 3.1–3.6 structure):
  - logo: `Call Booking`; nav: `How it works`, `Who it is for`; CTA (mirrors
    `Создать встречу`): `Create a meeting`
  - hero H1: `Book a call in 30 seconds`; subheading: `Publish the slots that
    work for you — your guest picks a time without a single message back and
    forth.`
  - steps heading `How it works`; steps: `Publish a slot` / `Share the link`
    / `Get on the call` with bodies mirroring § 3.3
  - audiences heading `Who it is for`; cards: `For the meeting owner`,
    `For colleagues and teams`, `For guests without an account` mirroring § 3.4
  - closing CTA: `Ready to stop negotiating time over chat?` + supporting line
    mirroring § 3.5, button `Create a meeting`
  - footer: columns `Product` / `Project`, links mirror § 3.6 (the Hexlet line
    stays `Учебный проект Хекслета` — a proper noun of the school, no `en` variant)
  The implementation stores both variants as objects in
  `web/src/content/landing.ts`; the EN strings above are the target, and if a
  literal reads clumsy in tests, refine wording there and in the constants —
  the structure must stay 1:1 with § 3.

## 7. Visual design constraints

- Mantine 9, default theme. Explicitly excluded this stage: custom fonts,
  brand palette, logo artwork, images, animations.
- Acceptance bar: "clean generic SaaS landing, nothing broken-looking".

## 8. Verification (acceptance criteria)

Definition of done: `make lint` and `make test` pass locally; CI green.
TDD order is mandatory: tests are committed before the components they cover
and fail on first run (red), then implementation turns them green.

Functional test cases:

1. One H1 with canonical hero text; one H2 with canonical section text for
   each of the three sections below the hero (`how`, `audiences`, `cta`).
2. `banner`, `main`, `contentinfo` landmarks exist; all content sections are
   inside `main`.
3. Header nav links `Как это работает` / `Для владельцев` have hrefs `#how` /
   `#audiences`; both ids exist on the page inside `main`.
4. Steps section renders an ordered list with exactly 3 items, each item
   containing its canonical title.
5. Audiences section renders exactly 3 cards with canonical titles.
6. Closing CTA section has id `cta` and a link/button named `Создать встречу`
   with `href="#cta"`; header and hero primary CTAs share the same href from
   `links.ts`.
7. Footer contains the two nav links with the same hrefs as the header and two
   external links (GitHub, Hexlet) with `target="_blank"` and `rel` containing
   `noopener`.
8. Canonical strings live in `web/src/content/landing.ts`; components import
   them (tests import the same constants and assert rendering — no duplicated
   literals).

9. Language switcher (§ 6.1): RU renders by default; clicking `EN` swaps every
   string on the page to the English copy while hrefs/anchor ids stay
   unchanged; `<html lang>` follows the locale; the choice persists across a
   fresh render (`localStorage`); clicking `RU` switches back. All § 8.1–8.7
   structural cases must hold in both locales (run at least the heading and
   landmark cases for EN too).

Tooling acceptance:

10. `web` gets devDependencies: `vitest@^3` (matches the server pin),
   `@testing-library/react`, `@testing-library/jest-dom`,
   `@testing-library/user-event`. `jsdom@^26` is a **root** devDependency:
   vitest is hoisted to the workspace root and resolves `jsdom` from there,
   and jsdom@27 is unusable on local Node 22.11 (its CSS stack `require()`s
   an ESM-only package; `require(esm)` needs Node ≥ 22.12 — same pinning
   rationale as AGENTS.md "Version pins"). Scripts: `web` `"test": "vitest run"` +
   `"test:watch": "vitest"`; root `npm test` runs both workspaces; `make test`
   keeps working unchanged.
11. Vitest config for `web`: `environment: 'jsdom'`; setup file polyfills
    `matchMedia` and `ResizeObserver` (Mantine/AppShell need them in jsdom),
    imports `@testing-library/jest-dom/vitest`, and clears `localStorage`
    after each test (locale persistence must not leak between cases).

Manual visual check (screenshot, not automated): the hero reads as the
dominant block per § 3.2; layout stacks without horizontal scroll at 375px;
header (logo + switcher + CTA) fits at 375px in both locales.

## 9. Decision log

- 2026-10-03 — Navigation model: in-page anchors, single route, no router
  (user-approved). The booking page does not exist yet; a router would be
  speculative scope.
- 2026-10-03 — Process: two PRs (user-approved). This PR is the SDD gate and
  must be reviewed and merged before implementation starts; PR #2 implements
  on `feat/landing-page` test-first.
- 2026-10-03 — Design: default Mantine theme, no bespoke visuals (user-approved).
- 2026-10-03 — CTA is an anchor placeholder to `#cta` (user-approved).
- 2026-10-03 — Design reference screenshots appeared in `docs/reference/`
  after this spec merged (user instruction: "follow the spec; we'll decide
  later whether to align with the reference"). The spec stays authoritative;
  reference alignment is a separate future decision, not this stage.
- 2026-10-03 — User review of PR #6 (three items, now in this spec):
  1. nav label `Для владельцев` → `Для кого` (the link goes to the
     three-audience section, not owner-only);
  2. copy must not claim slot length — the product will offer 15- **and**
     30-minute slots. NOTE: `docs/api.md` still says "a slot is exactly 30
     minutes"; updating the API contract (variable durations) is a
     **backend-stage task**, tracked by this decision line only;
  3. UI language switcher RU/EN added to scope (§ 6.1) — interface strings
     only, server data stays locale-independent.
- 2026-10-03 — User approved the landing style; frozen into `docs/ui-style.md`
  as the visual contract for all future pages. `docs/reference/*.png` are
  flow/logic references (booking catalog → event type → slots), not style.

## 10. Open questions

None — resolved with the user on 2026-10-03 (see § 9).
