# UNTO FLOW — PRD & Implementation Plan v5

> Renamed from Fable / Flow to UNTO FLOW on Oct 13, 2026; umbrella brand: UNTO.
>
> **Live build:** `v54` · **https://juliafzq.github.io/Fable_Flow/** · repo `Juliafzq/Fable_Flow` (`main`)
>
> v5 consolidates the v4.7 baseline (Phase 3, `v36`) with every change shipped on **Oct 11 (v37 → v54)**. Where v5 and v4.7 disagree, **v5 wins**. Sections that didn't change (3D tomato rendering, silver completion state, photo layouts, Supabase backend, cost options) are summarized; their detailed specs in v4.7 still apply.

---

# Part I — Product Requirements

## 1. Product idea (unchanged)

A calm, tactile, digital-analog space that restores daily focus, accomplishment and presence without gamification or productivity guilt. It's built around two physical objects: a **dual-sided index card** (to-dos on the front, evening reflection on the back) and a **3D heirloom tomato Pomodoro timer**.

## 2. Locked visual & interaction principles

The v4.7 principles still hold: mockups beat text, minimal copy, photoreal tomatoes on `#E7E8E2`, identical front/back headers, unified card typography, and silent two-way flip. v5 adds:

| # | Principle | Detail |
|---|---|---|
| 2.1 | **One fixed spot per control** | A given button sits in the same bottom-bar slot on every screen (see §3.4). Controls never jump between screens. |
| 2.2 | **No duplicate controls** | One flip control per card: the bottom-bar Flip (plus swiping). The corner flip buttons tried in v44–v46 were removed. |
| 2.3 | **No extra steps** | Tapping "+ Add item" goes straight to typing with the keyboard up. No placeholder step, no confirmation step. |
| 2.4 | **Nothing moves when you start editing** | Tapping an item never changes the card's text size or row positions. |
| 2.5 | **Consistent on first touch** | Every tap works the first time: tap to edit, × to delete, flip. "Sometimes once, sometimes twice" counts as a bug. |
| 2.6 | **Language parity** | Chinese UI uses natural, app-native copy (not word-for-word). It must fit the same space as English, condensed where needed, and menus are identical in size in both languages. |

## 3. Functional requirements

### 3.1 Home, profile menu & onboarding

- **Profile menu: 6 rows, fixed 186 × 219 px in every language** (each row exactly 35 px tall):
  `Account` · `Home` · `About & Tour` · `Daily Reset` (dropdown 00:00–23:00) · `Sound` (On/Off) · **`Language` (dropdown: English / 简体中文)**.
- **Language works like Daily Reset.** Tapping the row opens the phone's picker. The language only changes when an option is picked; tapping the row alone never switches it.
- **About & Tour card:** unchanged in English. In Chinese:
  - each principle label sits on its own line above its description
  - the lead sentence breaks after the comma
  - the sign-off uses the regular font, not italic serif

### 3.2 Simplified Chinese (new)

- **Stays in English in both languages:** the name **UNTO FLOW**, all dates (`11 OCT`, `SUNDAY — OCT 11`, the date strip), and the monthly calendar.
- **Never translated:** user-typed text (tasks, reflections, timer titles). The built-in defaults `Example Task` / `Focus Session` display as `示例待办` / `专注时间`.
- **Persistence:** the choice is saved on the device and in the synced account state (`state.language`).
- **Approved terms:**
  - Top toggle: `卡片 / 番茄`
  - Card vocabulary: 待办 (to-do), 回顾 (reflection), 卡片堆 (stack)
  - About-card principles: `心怀目标 / 专心生活 / 融入心流`
  - About-card lines: `一个陪你过好充实每一天的小工具，围绕三个理念：` and `希望这个小工具，可以帮你专注于真实的生活，而不是这个 App。`
  - Tour button: `开始教程 →`
- **Condensed to fit:**
  - `每日换新` (Daily Reset)
  - `点击选择` (empty tomato)
  - `0–180` (time-input placeholder)
  - `输入 0–180 分钟或 02:30，回车确认` (time hint)

### 3.3 Guided tutorial: 9 steps

| # | Title (EN · 中文) | What the animation shows |
|---|---|---|
| 1 | Tap Card or Tomato · 点击卡片或番茄 | Dot alternates between the mini card and the tomato's `0` marker on the center line |
| 2 | Front Page · Daily To-Dos · 卡片正面 · 今日待办 | **"Add up to 8 tasks. Swipe to cross out, swipe again to undo"**: first swipe draws the pencil line, second swipe erases it |
| 3 | Flip Page · Daily Reflection | Swipe flips the card to the black reflection side and back |
| 4 | Tap Mini Tomato | Dot taps the small tomato next to a to-do |
| 5 | Turn Tomato Dial · 转动番茄 | "Swipe across the tomato to turn the dial": dot turns the dial 25:00 → 30:00 in lockstep |
| 6 | **Tap Digits to Type Time · 点数字输入时间** (new) | Dot taps the readout, the editor opens, "4" then "45" is typed, dot taps Set, the readout shows 45:00 |
| 7 | Tomato Grid · 6 Focus Timers | Dot pulses on a grid tomato and its title |
| 8 | Scroll Stack · Past Cards | **"Swipe the date bar to browse past cards"**: dot slides along the date strip while cards slide |
| 9 | Zoom Out · Monthly Calendar | Two dots pinch while the card zooms out to the calendar |

### 3.4 Bottom bars (all screens)

- **Same geometry as the Timer bar everywhere:**
  - same height, inset and row
  - **54 px buttons**
  - icon glyphs **~31–34 px with a 2.6 px line**, matching the timer icons
- **Slots** (4 columns, same x-positions as the Timer bar):

| Screen | Slot 1 | Slot 2 | Slot 3 | Slot 4 |
|---|---|---|---|---|
| Timer | Grid | Play/Pause | Stop (hidden when unset; slot stays empty) | Stopwatch |
| Today's card | Stack | – | – | Flip |
| Past card | Return | Flip | Trash | Zoom out |
| Past day with no card | Return | – | – | Zoom out |
| Calendar | Return | – | – | Zoom in |

- **Rule:** two-button bars always use slots **1 and 4**. Return and Zoom are in the same place on the stack and calendar screens.
- **Stack screen background:** the area behind the card and behind the buttons is one continuous `#E7E8E2`. The card's shadow fades out smoothly instead of ending in a hard line above the buttons.

### 3.5 Flipping cards

- **Ways to flip:**
  - the bottom-bar Flip button (Today and past cards)
  - a horizontal swipe on the card, in either direction, on both Today's card and past cards
- **Swipe sensitivity:** a swipe counts at **≥ 16 px** horizontal, or a quick flick of ≥ 10 px. The angle tolerance is loose (|dx| > 0.9·|dy|).
  - The card takes all touches (`touch-action: none`), so the browser can't cancel slightly diagonal swipes.
  - If the browser does cancel a swipe, it's judged by the last finger position.
- **On the front of Today's card:**
  - left-to-right across a task's text crosses it out, or un-crosses it
  - right-to-left, or a swipe on empty space, flips the card
- **While typing in a field, swiping never flips** (protects Chinese handwriting input). Otherwise, swiping on the reflection area flips the card.
- **Browsing past cards:** swipe the date strip, swipe the side edges or peeking cards, or tap a date. A swipe on the card itself flips it.
- **Pencil strikethroughs are redrawn when a flip finishes**, so crossed-out items stay crossed out after flipping back.

### 3.6 To-do items

- **Up to 8 items per card**, on Today's card and on past cards. The tomato grid stays at **6 timers**.
- **Adding:**
  - "+ Add item" opens an empty typing line with the cursor and keyboard immediately, with no placeholder.
  - While you type, the "+ Add item" row keeps its space invisibly, so saving doesn't shift the layout.
- **Return key:**
  - **Adding:** Return saves the item and immediately opens the next new line, keeping the keyboard up. Return on an empty line just closes it.
  - **Editing:** Return saves and moves to the next item, or starts a new one after the last.
  - **Chinese and other IME input:** Return that confirms a Pinyin or other IME candidate only confirms the candidate.
  - **Full card:** at 8 items, Return just saves.
- **Editing an item:**
  - Tapping an item turns its text into an edit field in place, with the cursor.
  - The **× delete button appears in the mini tomato's spot** at the same size; on past cards it floats in the right margin.
  - Text keeps its full width, so **nothing rewraps or shrinks** (measured: 0 px row shift on Today's card, ≤ 1 px on past cards).
- **Deleting:**
  - Tapping × once deletes the item. Nothing else is triggered: no timer assignment, no navigation.
  - Clearing an item's text and saving also deletes it.
- **Shrink to fit:**
  - All items on a card share one text size: **24 px by default**.
  - When the card fills up, all lines shrink together. Padding, the number column and the mini tomatoes scale with the text.
  - **Minimum 15 px.** If a card were still too full at 15 px, the list scrolls (scrollbar hidden) instead of clipping.
  - While typing, the size only ever steps down; it never bounces back up, and it doesn't change on save.
- **Past day with no card:** a dashed slot reads **"Add tasks / reflections retrospectively"** / `补写待办 / 回顾` (no date, no subtitle).

### 3.7 Timer

- **Tap-to-type editor:**
  - **No preset pills.** The editor shows only the input, `Set`, and a one-line hint.
  - The placeholder is shown smaller (34 px) so it fits; typed digits stay large.
  - Full-width digits and the `：` colon (from Chinese keyboards) are accepted.
- **Short titles on tomatoes:** CJK titles are trimmed by character count (≈7 characters on grid tomatoes), since Chinese has no word spaces.

### 3.8 Text input in every language (new)

Every editable field (inline tasks, both reflections, the title dialog, the timer input) is safe for Chinese Pinyin and handwriting, Japanese, Korean and other IME keyboards:

- the app never rewrites a field's text while a word is still being composed
- Return/Escape are ignored while a candidate is being confirmed
- iOS's internal Pinyin separator (U+2006) is removed when the word is committed
- no extra spaces are added
- editable fields explicitly allow text selection

### 3.9 Platform & delivery

- **Live link:** repo renamed to **`Fable_Flow`**; the live link is `https://juliafzq.github.io/Fable_Flow/`.
- **Updates:** a home-screen install picks up new versions automatically when it's reopened or brought back to the foreground (service worker checks for updates on resume; network-first with no-cache).
- **Portrait lock:** the manifest requests portrait. If the phone rotates anyway, a CSS counter-rotation keeps the app upright, and touch coordinates are remapped.
- **Sign-in:** Google (`G`) and Apple buttons; Supabase auth and sync (see v4.7 Part III). `scripts/provision_supabase.py` provisions a project.
- **Narrow phones (≤ 340 px, e.g. iPhone SE 1st gen):** past-card date header and Edit pill are slightly smaller so nothing clips.

---

# Part II — Implementation Plan

## 1. Change log (Oct 11)

| Version | Change |
|---|---|
| v37 | Repo renamed to `Fable_Flow`; Google/Apple sign-in buttons; Supabase provisioner script |
| v38 | Natural-direction date-strip scrolling with momentum; carousel scrolling; portrait lock |
| v39–v40 | Service worker cache-bust; home-screen app auto-updates on resume and when a new version takes over |
| v41 | IME-safe input across all fields (Chinese Pinyin & handwriting, JP, KR) |
| v42–v44 (`zh-cn` branch) | Simplified Chinese (`js/i18n.js`), Language row, tutorial uncross step, type-digits tutorial step, swipe-to-flip restored on past cards, flip buttons on card faces, easier swipe, presets removed, Chinese overflow tuning |
| merge | `zh-cn` → `main` |
| v45–v49 | Bottom bars unified with Timer bar (size, slots, glyph size); corner flip buttons removed; final slot order Return/Flip/Trash/Zoom; seamless stack background; Return → next item; 8 items per card; 15 px font floor |
| v50 | "+ Add item" focuses immediately (no placeholder step); text size only steps down while typing |
| v51 | × in the tomato slot (no reflow); tap-to-edit focuses during the tap; iOS's delayed click after the opening tap is blocked; a stray early blur is ignored |
| v52 | Strikethroughs redrawn after the flip animation |
| v53 | × deletes on first tap; the click that trails a delete is ignored |
| v54 | Language is a dropdown like Daily Reset |

## 2. File-by-file

| File | Responsibilities added or changed in v5 |
|---|---|
| `index.html` | Language `<select>` in the profile menu; bottom bars (stack/calendar/card); stack card header has `Edit` only; no corner flip buttons; time editor without presets |
| `css/style.css` | **Unified bottom bars:** 4-column grid, 54 px buttons, per-icon glyph sizing with non-scaling 2.6 px stroke, fixed `grid-column`/`grid-row: 1` per button ID, two-button `.two-buttons` state<br>**Typing & editing:** `--task-fs`-driven row/tomato/index sizing; `.is-overflowing` scroll fallback; `.add-row-reserved`; `.is-inline-editing` × placement<br>**Stack screen:** shadow fade (stage `margin-bottom: -48px`)<br>**Other:** `html.lang-zh` tuning; fixed 35 px profile rows; IME `user-select: text`; ≤ 340 px tweaks |
| `js/app.js` | **Language:** `initLanguage`/`applyLanguage`; `this.t()`; `displayTaskTitle()`<br>**Tutorial:** 9 steps (uncross animation; type-digits step; date-strip scroll demo)<br>**Flip:** `bindTwoWayCardFlipOnWrapper` on both cards (16 px / flick thresholds, last-position on cancel, `isActivelyTypingIn`); `redrawStrikesAfterFlip`<br>**Items:** `MAX_CARD_TASKS = 8`; `fitUnifiedCardTaskTypography` (15 px floor, inline textarea re-measured at each size, `--task-fs`, overflow class); `startInlineAddTask(isStack, focusNow)` / `startInlineEditTask(row, task, isStack, focusNow)` (Return → next, IME guards, 600 ms blur grace)<br>**Tap reliability:** delayed-click blocking with 350 ms expiry that never blocks ×; × deletes on `pointerup` + `swallowNextClick(500)`<br>**Platform:** stack `.two-buttons` toggle; portrait lock (`initMobilePortraitLock`, `getPointerXY`); SW auto-update |
| `js/i18n.js` (new) | English-keyed dictionary (EN fallback), `t(key, params)`, `setLanguage`, `registerStaticI18n` (captures static text/attributes **before** any user content renders), `applyStaticI18n` |
| `js/odometerPhysics.js` | CJK-aware `formatShortTomatoTitle`; full-width digit / `：` parsing in `parseTypedTimeInput` |
| `sw.js`, `manifest.json` | Network-first no-cache SW (`fable-flow-cache-v54`, precaches `i18n.js`); portrait orientation |
| `js/supabaseSync.js`, `scripts/provision_supabase.py` | Google/Apple OAuth buttons; project provisioning |
| `qa/` (new) | Targeted QA harness (see §4) |

## 3. Key mechanisms (why they exist)

1. **Never measure geometry while a card is rotated.** Positions read mid-flip come out squashed or mirrored. Strikethroughs are redrawn on `transitionend` (650 ms fallback); the tutorial uses `setInstantCardRotation` before measuring.
2. **Shrink-to-fit must measure the real layout at each candidate size.** The fit loop re-sizes the editing textarea's height at every step; otherwise the size oscillates while typing.
3. **iOS tap sequencing.** A tap that changes the layout under the finger gets a delayed follow-up click on whatever is there now. The app therefore:
   - opens edit fields and focuses them during the tap itself (this also keeps the keyboard up)
   - cancels the opening tap's follow-up click, with an expiring flag (iOS may deliver that `touchend` to the replaced node)
   - never blocks the × button
   - performs deletions on `pointerup` and ignores the click that trails them
4. **IME.** The app tracks `compositionstart/end` and `isComposing`, ignores `keyCode 229`, and ignores Return within 120 ms of `compositionend`. It never assigns `value` while a word is still being composed.
5. **Static i18n capture order.** `registerStaticI18n` runs before the first render, so user-typed text can never be captured and "translated".

## 4. QA gate (required before every push)

`qa/run_qa.sh <groups>`: headless Chrome with mobile emulation, **focus emulation on**, real touch events via CDP, groups run in parallel.

| Group | Checks |
|---|---|
| `bars` | Every button in its agreed slot on all screens; same row as the Timer bar; no corner flip buttons |
| `flip` | Flip buttons, swipe, interrupted swipe; past card: swipe flips, edges scroll; strikethroughs keep ≥ 80 % of their ink after flip |
| `edit` | 12 real taps open editing; stray blur ignored, real blur saves; × deletes; × deletes on first tap with no side effects (iOS leftover-flag case simulated); editing causes no reflow |
| `typing` | Return → next item, 8-item cap, card fits; text size never increases while typing and doesn't change on save (375 and 390 px) |
| `profile` | Language dropdown doesn't switch on tap; picking switches; persists after reload; menu size identical in EN/ZH |
| `layout` | Chinese overflow audit on every screen and tutorial step at 375×667 and 320×568 (slowest; run for copy or layout changes) |

**Process for every change:** reproduce the reported bug in a failing test → fix → run the impacted groups → inspect screenshots → bump `?v=` and the SW cache name → push → state what headless Chrome can't verify.

## 5. Open items

- **Real-iPhone confirmation** of the iOS tap fixes (v51/v53). They're tested by simulating iOS's behavior, not on a device.
- **Monetization** (first 100 users free, then paid): discussed, not implemented.
- **App Store distribution** (Capacitor, $99/yr) and home-screen widgets: not started. Widgets need a native app.
- Grid-dropdown long titles are truncated with "…" by design. Revisit if users need the full title there.
