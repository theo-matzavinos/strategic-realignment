---
name: Strategic Realignment
description: A hidden-role card game that wears the team calendar a toxic workplace runs on.
colors:
  ground: '#191817'
  chrome: '#100f0e'
  raised: '#22211f'
  sunken: '#141312'
  line: '#312f2c'
  line-soft: '#272523'
  control-line: '#5a5650'
  fg: '#f1eeea'
  fg-muted: '#a29d96'
  fg-faint: '#8f8a83'
  brand: '#3b8ee8'
  brand-fill: '#2a74c9'
  brand-text: '#63a6f0'
  brand-fg: '#ffffff'
  ok: '#7fd49a'
  ok-bg: '#1d3626'
  bad: '#ff8a7a'
  bad-bg: '#3a1f1b'
  bad-fill: '#c0453b'
  warn: '#f0c06a'
  warn-bg: '#3a2c12'
  neutral-bg: '#2e2b28'
  busy: '#34312d'
  busy-alt: '#2a2825'
  busy-edge: '#7b766f'
  busy-fg: '#c9c3bb'
  open-line: '#4a4642'
  leadership: '#e05a4f'
  feature: '#4c8fe0'
  workaround: '#e8a93c'
  tests: '#2fb2a8'
  refactoring: '#6cbf5a'
  status: '#9a8cf0'
  workshop: '#c75bd6'
  paper: '#f4f1ec'
  paper-ink: '#1d1b18'
  paper-muted: '#615c55'
  paper-line: '#ddd8d0'
  seat-0: '#9fc5f8'
  seat-1: '#f4b183'
  seat-2: '#b4e3a8'
  seat-3: '#e3b4e8'
  seat-4: '#f8e08e'
  seat-5: '#a8e0dc'
  seat-6: '#f5a3a3'
  seat-7: '#c9c0f5'
  seat-8: '#d8cfa8'
  seat-9: '#9fd8b8'
typography:
  display:
    fontFamily: 'Figtree Variable, system-ui, sans-serif'
    fontSize: '30px'
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: '-0.02em'
  headline:
    fontFamily: 'Figtree Variable, system-ui, sans-serif'
    fontSize: '22px'
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: '-0.015em'
  title:
    fontFamily: 'Figtree Variable, system-ui, sans-serif'
    fontSize: '15px'
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: 'Figtree Variable, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: 'tnum'
  label:
    fontFamily: 'Figtree Variable, system-ui, sans-serif'
    fontSize: '12.5px'
    fontWeight: 600
    lineHeight: 1.35
  caption:
    fontFamily: 'Figtree Variable, system-ui, sans-serif'
    fontSize: '11.5px'
    fontWeight: 700
    lineHeight: 1.3
rounded:
  control-sm: '4px'
  control: '6px'
  surface: '8px'
  card: '10px'
  dialog: '12px'
components:
  button-primary:
    backgroundColor: '{colors.brand-fill}'
    textColor: '{colors.brand-fg}'
    rounded: '{rounded.control}'
    height: '36px'
  button-secondary:
    backgroundColor: '{colors.raised}'
    textColor: '{colors.fg}'
    rounded: '{rounded.control}'
    height: '36px'
  button-positive:
    backgroundColor: '{colors.ok-bg}'
    textColor: '{colors.ok}'
    rounded: '{rounded.control}'
  button-negative:
    backgroundColor: '{colors.bad-bg}'
    textColor: '{colors.bad}'
    rounded: '{rounded.control}'
  input:
    backgroundColor: '{colors.sunken}'
    textColor: '{colors.fg}'
    rounded: '{rounded.control}'
    height: '40px'
  tag-ok:
    backgroundColor: '{colors.ok-bg}'
    textColor: '{colors.ok}'
    typography: '{typography.caption}'
  tag-warn:
    backgroundColor: '{colors.warn-bg}'
    textColor: '{colors.warn}'
    typography: '{typography.caption}'
  tag-neutral:
    backgroundColor: '{colors.neutral-bg}'
    textColor: '{colors.fg-muted}'
    typography: '{typography.caption}'
  card:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.paper-ink}'
    rounded: '{rounded.card}'
    width: '176px'
    height: '214px'
---

# Design System: Strategic Realignment

Recorded from what the lobby and the room page ship after the Sprint Calendar redesign (slices 1–4). The approved plan and mock live in the work-evidence folder `sr-sprint-calendar-redesign`; product truth is `PRODUCT.md`. Tokens live once, in `src/ui/theme.css`; Tailwind reads them through `@theme inline`.

## Overview

**Creative North Star: "The team calendar, straight-faced."**

The game wears the software a toxic workplace runs on: a dark group calendar. The room is a week view. The sprint's phases sit on its days, players are attendees, booked cards are "Busy · private" blocks, and Leadership's demand arrives as a required invite. The parody is never announced. It's carried by direct product semantics in a familiar frame, with a straight face, so the joke lands the way the rules' does: sabotage looks exactly like the normal process.

The only things that leave the calendar's flat, dense chrome are the playing cards. They're light paper with a colored type band, sitting in a hand tray on the dark table, so a hand reads as a hand at a glance across a call.

Dark only. There is no light theme in this pass.

**Key Characteristics:**

- A dense, tabular calendar: hour rows, day columns, small type, tabular numerals.
- Color means something: card types, status and the brand blue for "you" and "now". Nothing is decorative.
- Paper cards are the one tactile object; everything else is flat chrome.
- What the rules hide never appears, not even as a layout hint.

## Colors

Warm near-black surfaces with one blue for you and now, status pairs for ok/bad/warn, and seven card-type hues.

### Primary

- **Calendar blue** (`brand` #3b8ee8): your slot's outline, the current day's underline and name, the current sprint, focus rings, text selection and the caret. 5.25:1 on `ground`.
- **Button blue** (`brand-fill` #2a74c9): filled primary buttons and the selected day tab. It's deeper than `brand` so white text reaches 4.73:1; the mock's #3b8ee8 fill gave 3.38:1. Hover and press go darker, never lighter: hover mixes in 8% black (5.72:1) and press 14% (6.57:1). A lighter hover (10% white) dropped to 3.94:1.
- **Tint blue** (`brand-text` #63a6f0): blue text on a `brand` tint, such as "Your slot", where `brand` reaches only 4.4:1.

### Card types

Each card type has a hue, used for its band, its tint on calendar events and its reveal row: **leadership** (#e05a4f, demands), **feature** (#4c8fe0), **workaround** (#e8a93c), **tests** (#2fb2a8), **refactoring** (#6cbf5a), **status** (#9a8cf0), **workshop** (#c75bd6). Band text is `paper-ink`, which is 4.7:1 or better on every one; white was as low as 2.06:1.

### Status

- **ok** (#7fd49a on `ok-bg` #1d3626): booked, voted, ready, a met demand, the Yes button.
- **bad** (#ff8a7a on `bad-bg` #3a1f1b): errors, missed demands, incidents, Debt, the Management Plant, the No button. `bad-fill` (#c0453b) is the all-hands band, with white text at 5.05:1.
- **warn** (#f0c06a on `warn-bg` #3a2c12): audited, nominee, "plays face up next sprint".

### Neutral

- **Ground** (#191817): the page and the calendar grid.
- **Chrome** (#100f0e): the top bar.
- **Raised** (#22211f): the attendee panel, dialogs, secondary buttons.
- **Sunken** (#141312): the tracks strip, the hand tray and inputs.
- **Line** (#312f2c) and **line-soft** (#272523): borders and the faint hour rows.
- **Text** `fg` (#f1eeea), `fg-muted` (#a29d96), `fg-faint` (#8f8a83). `fg-faint` replaces the mock's #75706a, which measured 3.3–3.9:1; the new value is 4.7:1 or more on every surface.
- **Busy** hatch (`busy` / `busy-alt` with a `busy-edge` stripe and `busy-fg` text) and the dashed `open-line`: calendar slots.
- **Paper** (#f4f1ec) with `paper-ink`, `paper-muted` and `paper-line`: card faces only.
- **Seats** (`seat-0` to `seat-9`): light fills for attendee initials in `paper-ink`, one per seat.

### Named Rules

**The Contrast Floor Rule.** Body text is 4.5:1 or better against its actual background, including event meta lines (the tone mixed 35% into `fg`), dimmed events (`opacity-70`, not the mock's 50%) and card effects on paper (the type hue mixed 55% into `paper-ink`).

**The Blue Means You Rule.** `brand` marks you and now: your slot, your reveal row, the current day and sprint, focus. Don't spend it on decoration.

## Typography

**Font:** Figtree Variable (`@fontsource-variable/figtree`, with its italic axis), falling back to `system-ui`. Tabular numerals everywhere (`font-variant-numeric: tabular-nums` on `html`).

**Character:** a friendly geometric sans that looks like productivity software, bold enough at 800 to carry track numbers and card names.

### Hierarchy

- **Display** (800, 30px, 1.1, −0.02em): the titles of the two invites, the waiting room's and the end's (24px on a phone).
- **Headline** (800, 22px, 1.2): panel headings outside the game, such as "Join this room".
- **Title** (700, 15px, 1.3): day names, event titles ("Sprint Review", "Retro · now"), the Now hint.
- **Body** (400, 14px, 1.4): running text.
- **Label** (600, 12.5px, 1.35): event text, slots, tags' neighbors, section headings in the tray and attendee panel.
- **Caption** (700, 11.5px): tags, card bands, hour labels.
- One-off sizes, kept local: track values (800, 26px; 20px on a phone), card names (800, 18px; 15px on a phone), card effects (700, 14px), the brand name in the top bar (800, 16px), and the lobby's hero: its headline (800, 44px, 1.05, −0.03em; 32px on a phone) and lead (16px, `fg-muted`, 60ch), the Reminder's title (800, 26px; 22px on a phone) and the poll's stamp (caption, uppercase, tracked 0.12em).

### Named Rules

**The Calendar Density Rule.** Headings are small and separated by weight, not size, as calendar software does. The display size belongs to the invites; only the lobby's hero headline is larger, since it's the one page that has to sell the game.

## Layout

Breakpoint: `desk:` is 1280px and up; `max-desk:` is the phone day view below 1280px. The whole week plus attendees needs about 1040px (Friday's Ready button during the review), so narrower windows and tablets get the day view rather than a squeezed table.

**Desktop**, top to bottom:

1. **Top bar** (56px, `chrome`): the SR mark and name; "Team calendar" with the room code chip and its copy button (the code is the `h1`); "Sprint n of 4" ×4, done/current/upcoming, not navigation (the current sprint only on the day view); the connection status and Reconnect. When its contents don't fit on one row, such as "Connection lost" with Reconnect on a phone, the sprint and status wrap onto a second row, right-aligned; nothing shrinks under its neighbour.
2. **Tracks strip** (`sunken`, columns `1.7fr 1fr 1fr 1fr 280px`): Progress `n / target` with a bar, Morale with four pips, Debt with "incident at 3", Audits left, and a "Now" cell with the phase hint ("Game over" with "Show result" at the end).
3. **The table** (`minmax(0,1fr) 280px`): the week on the left, attendees on the right.
   - The week is a CSS grid `52px var(--week-columns)` with three rows: day headers, lanes (subgrid, so headers align), and the Debt band. The hour gutter and 64px hour rows are background texture that never sets the height.
   - Column widths follow the current day: contribute `1.1fr 2fr 1fr 0.9fr`, the review `0.8fr 1fr 2fr 1.2fr`, the vote `0.8fr 1fr 1.5fr 1.7fr`. The current day is underlined in `brand` and carries `aria-current="date"`.
   - The current day: Tue–Wed while the team books; Thursday from the reveal until a vote opens; Friday once it has. After the game, Friday if a vote ended it, otherwise Thursday.
4. **Hand tray** (`sunken`, `220px minmax(0,1fr) 280px`, sticky at the bottom): your role, your hand, the phase's action.

**Phone** (below 1280px): a compact top bar (mark, code chip, current sprint only, status; the sprint and status take a second row while the connection is down); the tracks as a 4-up strip with the Now cell only at the end; four day tabs in one row (all four always visible) that follow the phase until you tap another day; one lane; attendees as wrapping pills; the tray as a sticky bottom sheet with the role as a pill, sideways-scrolling cards and a full-width action. No horizontal page scroll at 390px.

**Lanes:**

- **Mon · Demand:** the demand as a "Required · from Leadership" event (name, flavor line, requirement, penalty), dimmed after the reveal; then "Earlier demands".
- **Tue–Wed · Contribute:** one slot per player in seat order, two columns. "Busy · private" (hatched) when booked, "Open" (dashed) when not, "Your slot" (blue outline) for you, which shows your card once booked; the audited player is named ("Chidi · audited, books face up"). After the reveal, every slot is a dim "Busy".
- **Thu · Sprint Review:** during the retro and after the game, one row per card in `lastReveal.cards` order exactly, yours marked "You", the audited card last and attributed, a dashed "1 removed, unseen" row under One Week; then meeting notes (Progress `+n`, the demand's outcome, any incident). While the team books, a dim placeholder.
- **Fri · Retro:** the poll ("Audit Chidi?", the yes threshold, Yes/No, voted so far without how), then the "Retro · now" event: the nomination, "plays face up next sprint", and "Ready for sprint n".

**Attendees:** a seat-colored initial, name, "(you)", host and cards in hand, and state tags for the phase. Built to hold 10 rows.

**Outside the game.** These pages center one raised panel (`raised`, a `line` border, `rounded-dialog`, `shadow-dialog`) under a top bar, in a `minmax(0,1fr)` grid column so a fixed-width panel never widens the page. They switch at `md:` (768px), not `desk:`, since they have no week to fit.

- **Lobby (`/`):** a top bar with the brand only; the hero headline "Your release ships in four sprints. / One of you would rather it didn’t." and its lead; then one panel split into "New team calendar" (name, Create room, primary with the calendar icon) and "Join with a code" (code, name, Join room, secondary), side by side from `md:` with a `line` between, stacked below. The code input is uppercase, 800, tracked 0.3em.
- **Waiting room** (`app-waiting-room`, the room's lobby phase): a 640px meeting invite. A `brand-fill` band "Meeting invite · Sprint 1 kickoff"; the title "Release: Q3 Platform Excellence"; "Organizer Ana (you) · join with code ETNQ" and "4 sprints · 5–7 attendees · one of you works for management"; one row per player with "(you, host)" / "(you)" / "(host)" and an "Accepted" tag; below the minimum, a "Waiting for at least n more. Share the code." row (outside the attendee list) with a plus in a `neutral-bg` circle. The host's footer has "Start sprint 1", disabled below the minimum with "Needs 5 to start." beside it as its description; everyone else's reads "Waiting for the host to start the game."
- **Join refusal:** "Join this room" in a 430px panel styled like a half of the lobby's, with the join form minus the code.
- **Invalid code:** "This isn't a room code." with a "Back to the lobby" link button, in the same panel.
- **Loading:** "Loading the room…" in `fg-muted`, centered.

Spacing is tight inside a group (4–8px) and separated by lines rather than gaps between groups: calendars are dense.

## Elevation & Depth

The calendar is flat: depth comes from tonal surfaces (`chrome` < `sunken` < `ground` < `raised`) and 1px lines. Only real objects cast shadows.

### Shadow Vocabulary

- **Card** (`shadow-card`: `inset 0 1px 0 rgb(255 255 255 / .6), 0 8px 18px rgb(0 0 0 / .45), 0 2px 4px rgb(0 0 0 / .3)`): a playing card resting on the table.
- **Card lifted** (`0 0 0 3px var(--brand)` plus `shadow-card-lifted`): the selected card, raised 14px (6px on a phone).
- **Tray** (`shadow-tray`: `0 -10px 24px rgb(0 0 0 / .45)`): the sticky bottom sheet on a phone.
- **Dialog** (`shadow-dialog`): the end invite and the Reminder, over a blurred scrim (`--scrim`, `backdrop-blur 3px`); also the panels outside the game, which float on the page the same way.

## Shapes

Small radii, like work software: 4px for reveal rows and small buttons, 6px for controls and events, 8px for panels and day tabs, 10px for cards, 12px for dialogs. Tags and the phone's role and attendee pills are fully round.

Calendar events carry a 3px inset edge in their tone (`shadow-[inset_3px_0_0_var(--event-tone)]`) over a 22% tint of it. That edge is the calendar's own event shape, approved in the mock; it's the one place a side stripe belongs. Don't reuse it on panels or alerts.

## Components

All in `src/ui` unless noted; each merges a `class` input with `cn`.

- **Button** (`foldButton`): `primary` (brand-fill), `secondary` (raised with a line), `positive` / `negative` (the poll's Yes/No), `ghost`, `link`; sizes `sm` 32px, `md` 36px, `lg` 44px. Disabled keeps focus (`focusableWhenDisabled`) at 50% opacity.
- **Input** (`foldInput`): `sunken`, 40px, 16px semibold text, `control-line` border, brand border and ring on focus.
- **Field** parts: label in `label`, descriptions in `fg-muted`, errors in `bad` with the circle-alert icon.
- **Tag** (`foldTag`): a round caption pill; tones `neutral`, `ok`, `warn`, `bad`. Text carries the meaning.
- **Icons**: the `@lucide/angular` components, one per icon (`<svg lucideLock class="size-4 shrink-0">`): lock, check, copy, triangle-alert, circle-alert, calendar, clock, plus (the waiting room's open seat), and bell for the Reminder. 16px, 2px stroke, `currentColor`, and hidden from assistive technology when they have no `title`, so the text beside them carries the meaning. Inside a button or tag, the parent sizes them.
- **Card** (`fold-card`): the playing card. Anatomy, top to bottom: a type band in the card's hue with its kind ("Testing") and "Contribution" (hidden on a phone); the name (800, 18px); the effect (700, 14px, the hue mixed into ink); the italic flavor line pushed to the bottom (hidden on a phone); a footer tag ("Counts as Testing"). 176×214px, 138×176px on a phone. `selected` lifts it; `nameId` names a control by the card's name alone.
- **Calendar event** (`appCalendarEvent`, in the room route): the event block, toned per card type or demand, with `dim`.
- **Seat avatar** (room route): a light seat color (`--seat-0` to `--seat-9`) with a dark initial; decorative, since the name is always beside it.

## Wording

The rules' nouns stay exactly as `docs/rules.md` has them: Progress, Target, Morale, Debt, Audits left, Contribute, Retro, Sprint Review, Delivery Team, Management Plant, and the card and demand names. Only verbs and statuses come from the calendar: **Book** a card, **Busy · private**, **Booked / Not booked / Audited / Nominee / Voted / Voting… / Ready / Not ready**, **Accepted** in the waiting room, **Reminder** pop-ups, **Start sprint 1**, and **You** on your own revealed card.

The voice is deadpan corporate: "Required · from Leadership", "A booked card is final. The others see only “Busy”.", "MANDATORY · All-hands · Attendance is required". Controls name their action ("Book Feature Work", "Ready for sprint 3"); refusals use the server's own message.

## Motion

One authored moment per big event, each an exponential ease-out (`ease-out-expo`, `cubic-bezier(0.16, 1, 0.3, 1)`) from an already-visible resting state, moving only transform, opacity and `scale`. The one deliberate exception is the meeting notes' count-up, which interpolates a registered integer (`--count`) behind a CSS counter: it repaints one short number for 640ms, which the approved plan asks for and a 4×-throttled phone capture showed costs nothing measurable. Small state changes keep their short transitions: card hover and selection (250ms), button presses, the dim fade.

**Where it lives.** `Moments` (`src/routes/rooms/$code/moments.ts`), provided once by the room table, derives every moment from two successive views the page received (`linkedSignal` over the room input). Its first view has no predecessor, so a load or reload renders the settled state and replays nothing. The keyframes are `--animate-*` tokens in `src/ui/theme.css`, used with `motion-safe:`; the few script moves (the booking flight, the column re-flow, the week slide, the shake, the invite) go through `Moments.animate`, which plays nothing under reduced motion. Each move belongs to the phase and sprint it started in: it stops, leaving its element at rest, as soon as the table moves to another phase or sprint (the next sprint, or the result), and when the table goes. The open Reminder and a held reveal end the same way, so nothing from one sprint plays over the next or over the result.

1. **Booking.** Your picked card is already lifted. When your booking lands, a copy of it flies from the hand into "Your slot", shrinking to the slot's width and fading as the slot fades in (620ms). Only on your screen, and only when this page sent the booking. Everyone else's new Busy block settles in (380ms, from 8px above at 104%), which is public: who has booked is.
2. **Contribute → retro.**
   1. A Reminder: "Now · Thursday" · "Sprint Review" · "n contributions, shuffled. Turning them over…", with a 2.5s countdown bar.
   2. While it's open the reveal is held: the rows are in the DOM, face down (their turn animation paused), the week keeps Tue–Wed's columns, and the Progress bar and Morale pips keep the sprint before.
   3. When it closes, the days slide to Thursday's columns (360ms, position only), then the rows turn over one every 180ms (`rotateX` 520ms), in `lastReveal.cards` order: a row's delay is its index in the payload and nothing else. The audited card follows, then the removed one.
   4. Then the meeting notes rise in and their Progress counts up from 0 (a CSS counter on a registered `--count`; the real number is in the DOM for assistive technology), the Progress bar fills and a lost Morale pip drains (700ms), and an incident shakes the week (460ms).
3. **Vote outcome.** A "Passed" (warn) or "Failed" (muted) stamp lands on the poll (420ms, from 160%), when the last vote arrives. It stays as part of the settled poll; it repeats the outcome line, so it's hidden from assistive technology. A passed audit drains a Morale pip.
4. **Retro → next sprint.** The week slides in from the right (520ms), and a Reminder announces the demand: "Now · Monday · Sprint n", its name, its requirement and penalty.
5. **End.** The all-hands invite slides up over a fading backdrop (560ms), the first time it opens after the game ended on this page. "Show result" reopens it without motion.

**The Reminder** is non-modal on purpose. It never takes focus and never blocks input: its scrim and its card let presses through, and only Dismiss takes one. Any press anywhere or Esc closes it, and a press over the scrim or the card still reaches the control under it, in one tap. It closes by itself after 2.5s, or on Dismiss. It sits first in the table's DOM, so a keyboard reaches Dismiss right after the top bar, never mid-action; if focus is on Dismiss when it closes, focus goes back to where it came from. When reduced motion turns on while the card shows, the card becomes the banner and focus on its Dismiss moves to the banner's Dismiss. It's announced through a polite live region. The card is the mock's: a `chrome` header with the bell, "Now · …" in `brand-text`, the title at a one-off 26px (22px on a phone), the countdown in `brand`, and a footer "Closes by itself" with Dismiss.

**Reduced motion** (`prefers-reduced-motion: reduce`): nothing flips, slides, flies or shakes, and nothing is held: the state appears at once. The Reminder is a static banner under the top bar, without a scrim or countdown, and still closes by itself, on Dismiss, a press or Esc. The preference can change mid-game: turning reduction on stops every running or delayed move and lets go of a held reveal at once, and the open Reminder becomes the banner without a slide. Turning it off moves only later moments: a reveal or Reminder that arrived or was showing under reduction stays settled, and an entrance it cut short doesn't start over.

**Hidden information.** No moment's order, timing or origin may follow a seat, slot or attendee: the rows turn in payload order, the Busy settle follows public booking state, and the booking flight shows only on the booker's own screen.

## Do's and Don'ts

- **Do** render anything about cards only from fields the view sends, in the order it sends them. Never order, group or animate reveal rows by seat.
- **Do** keep the role box identical for both roles.
- **Do** name every section as a labelled region and every button by its visible text.
- **Do** theme browser surfaces from the palette: selection, focus rings, the caret, scrollbars.
- **Don't** add a light theme or use raw hex in templates; add a token to `theme.css` instead.
- **Don't** use `brand` for decoration, or white text on a card hue.
- **Don't** nest events inside events; stack them in the lane.
- **Don't** show who booked what before the reveal, or the removed card ever.
