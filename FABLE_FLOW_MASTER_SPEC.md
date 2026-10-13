# Fable / Flow — Master Product Requirements Document (v4.2) & Technical Implementation Plan

> **Authoritative Handoff & Phase 2 Execution Specification:**
> This master document consolidates the updated **Product Requirements Document (v4.2)** and **Technical Implementation Plan (v4.2)**, incorporating every visual preference, 3D surface-mesh rule, mirror-polished chrome silver shader specification, glossy single-highlight mini-tomato design, and QA/PM interaction fix completed in **Phase 1 (`v0.2.0-beta`)** so **Phase 2 (`v0.5.0-mvp`)** can be executed with 100% precision and zero regression.

---

# Part I: Product Requirements Document (v4.2)

## 1. Idea & Background

**A tactile, digital-analog tool space that increases a user's sense of lived fulfillment by restoring daily focus, accomplishment, and presence without coercive gamification, complex hierarchies, or productivity guilt.**

Project **Fable / Flow** delivers a calm, hyper-minimalist, physical-first environment built around two tactile objects—a **dual-sided index card** and a **photorealistic 3D heirloom tomato Pomodoro timer**—replaces abstract dashboards with organic, physical tools for daily planning, deep focus, and evening reflection.

---

## 2. Owner Visual & Tactile Preferences (Locked Baseline Across All Phases)

The following visual and interaction preferences are **mandatory requirements** across Phase 1, Phase 2, and Phase 3:

1. **Photorealistic Studio-Lit Heirloom Tomatoes & Seamless Background Feathering (`#E7E8E2`):**
   - All tomato sprites (`hero-tomato-*`, `grid-tomato-*`, `mini-tomato-*`) derive from the studio-lit sculpted heirloom tomato renders with extended canvas margins (`700×600` on Hero, `324×300` on Grid) whose cast shadows feather seamlessly into the exact `#E7E8E2` (`rgb(231, 232, 226)`) page background so **no square border or shading boundary line is ever visible**.
2. **Clean, Straight Equatorial Seam & Perspective-Accurate 3D Curve Numbers on Hero Tomato:**
   - The center opening (equatorial seam) on the Hero Tomato has a clean, smooth, un-stepped lip following $y_{\text{seam}}(u) = 258.8 + 0.5 u - 18.2 u^2 - 15.2 u^4$ (where $u = \frac{x - 250.5}{215.5} \in [-1, 1]$), with zero backward hook at the edges.
   - Measurement ticks (`1-min` minor, `5-min` medium, `10-min` major) and numbers (`0, 10, 20 ... 180`) wrap around a true 2x Retina 3D surface mesh (`bandX0 = 32..470`, `cx = 250.5`, `R_eq = 215.5`) with 4x horizontal supersampling, perspective-camera horizon projection ($\sin\theta_{\text{persp}} = 0.968 u$), upper-dome latitude relaxation, and bounded meridian tilt outside $\arcsin$.
   - Numbers on the sides foreshorten naturally in 3D perspective all the way to the physical silhouette edge ($|u| \in [0.968, 0.996]$) without early fade-out, top-clipping, or parallelogram skew.
3. **Mirror-Polished, High-Gloss Chrome Silver Metallic Completed Tomato (`#C8CDD4`):**
   - When a countdown finishes (`00:00`) or the user clicks `End (■)`, the tomato smoothly transitions into a **Mirror-Polished Chrome Silver Metallic** tomato (never dull vintage pewter).
   - **Surface & Edge Fidelity:**
     - **100% Natural Studio-Anti-Aliased Outer Edges:** Uses sub-pixel foreground opacity $\alpha(x,y)$ computed relative to local interior redness and composited directly over the local neutral background—eliminating any dark rim ring, pink halo, or cast-shadow speckles.
     - **Ultra-Smooth 3D Metallic Cheeks + Crisp 3D Stem Leaves:** Uses a $C^\infty$ paraboloid-dome normal (eliminating bottom-right crescent ridges) blended with 10-pass seam-aware body smoothing and a 3-pass edge-preserving bilateral filter inside a smooth 2D elliptical crown mask so the 3D stem and calyx leaf ridges remain sharp.
     - **One Luminous Studio Highlight & Dark Anthracite Etching:** Features one bright studio softbox reflection on the upper-left cheek and dark anthracite-charcoal etched markings (`▲` pointer, ticks, and numbers).
4. **Shiny, Single-Highlight Small Card Tomato Icons (`mini-tomato-*`):**
   - The small tomato icons on Today's Card Front are rendered from the clean `mini_grey` silhouette template with smooth $C^\infty$ 3D dome shading, **zero horizontal strips/bands**, **zero pink outer/stem halo**, and **just ONE crisp specular highlight** on the upper-left cheek.
5. **Clean White Front Card (No Background Dots) & Straight Horizontal Left-to-Right Strikethrough/Erase:**
   - Today's Card Front uses a clean, crisp white surface (`#FDFDFB`) with **zero background dots**.
   - Dragging `Left → Right` across a task draws a **straight horizontal** graphite strikethrough centered vertically on the text; dragging `Left → Right` across a crossed-out task **erases the line from Left to Right**.
6. **Clean Initial State — Single `"Example Task"` Only:**
   - Fresh state initialization starts with **one single `"Example Task"`** (`01 Example Task`) assigned to Tomato #1 (`25:00`), without hardcoded demo clutter (`Math Study`, `Build Deck`, etc.).

---

## 3. Detailed Functional Requirements & User Flows

### A. Pillar 1: Flow / Engagement (6-Pomodoro Grid & Single Big Hero Tomato)

1. **6-Tomato Grid View (`2×3` Layout — Screen 2):**
   - **6 Slots Matching the 6 Card Tasks:**
     1. Slot 1 (Top-Left): Deep Crimson (`#8B1E24`)
     2. Slot 2 (Top-Right): Warm Terracotta (`#C84B31`)
     3. Slot 3 (Middle-Left): Rich Dark Burgundy (`#5E192A`)
     4. Slot 4 (Middle-Right): Sun-Ripened Coral (`#D96B52`)
     5. Slot 5 (Bottom-Left): Golden Persimmon (`#C96A2B`)
     6. Slot 6 (Bottom-Right): Spiced Garnet (`#9E2A3B`)
   - **Unassigned Grey State:** Matte neutral grey (`#8E8D8A`) with `Tap to assign` vertically centered on the tomato body (`top: 52%`).
   - **Assigned Active State:** Shows the shortened Task Title exactly as typed (upper/lower case kept, `max-width: 152px`, ellipsis) + Digital Readout (`MM:SS` for `≤ 60m`, `HH:MM:SS` for `> 60m`) centered on the tomato body, with inline `[Play ▶ / Pause ||]` and `[End ■]` buttons below.
   - **Completed Silver Metallic State:** Smoothly transitions to `grid-tomato-silver.png` with dark anthracite readout text, disabled Play button (`opacity: 0.28`), and the `End (■)` button transformed into **`Reset (↺)`**.
   - **Grid Click Navigation Rule:**
     - Clicking any **assigned (colored or silver) tomato body** on the Grid **navigates to the Single Big Hero Tomato page** for that slot. (Clicking a tomato on the Grid **never** unassigns it. Unassigning is only done from the `✕ Unassign Tomato` item in the Hero or Grid task dropdown.)
     - Clicking an **unassigned grey tomato** (or tapping the subtitle below an assigned Grid tomato) opens the Task Assignment Dropdown, which **excludes any task already assigned to another tomato**.
2. **Single Big Hero Tomato View (Screen 3):**
   - **Dual Time-Setting Methods:**
     - **Method 1 — Twist the 3D Tomato (`1-Minute` Resolution):** Drag horizontally `Right → Left` to wind up or `Left → Right` to unwind in **1-minute (`3°`) notched increments** from `00:00` up to `03:00:00` (`180 minutes` / `540°`).
     - **The top half twists with the dial (v56):** the leaves, stem collar and shoulders turn with the numbers (same direction, about the same surface speed); the bottom half, pointer, stem and studio light stay put. Rendered by re-projecting the sprite's top half on a fitted surface-of-revolution model (`HeroTomato3DView._drawTwistLayer`). The 5 leaves make one 72° step per 25 min, so `00:00`, `25:00`, `50:00`… show the original picture; a ±1 min cross-fade at 12.5 / 37.5 / 62.5… min hands over between equivalent leaf poses.
     - **Method 2 — Tap on Digits to Type Time (`#hero-readout`):** Tapping the digital readout opens an inline time input bar (`0–180` minutes or `HH:MM` format like `02:30`) plus quick preset pills (`15m`, `25m`, `45m`, `60m`, `90m`, `120m`, `150m`, `180m`), immediately rotating the 3D tomato.
   - **Dynamic `HH:MM:SS` (`00:00:00`) Readout Above 60 Minutes:**
     - Displays `MM:SS` when remaining/elapsed time is `≤ 60 minutes` (`3600s`), and automatically formats as **`HH:MM:SS` (`00:00:00`)** (e.g., `02:30:00` at `50px` font size) when `> 60 minutes`.
   - **Inline Hero Task Assignment / Reassignment (`#hero-subtitle`):**
     - Tapping the task subtitle (`01 / Example Task ▾` or `TAP TO ASSIGN ▾`; task titles show exactly as typed) directly below the Hero readout opens an inline dropdown right on the Hero page to assign an unassigned task, switch tasks, enter a `+ Custom Title...`, or unassign.
   - **Two-Step End (`■`) → Polished Silver Metallic → Reset (`↺`) Safety Flow:**
     - When a countdown finishes (`00:00`) or the user clicks `End (■)`, the tomato smoothly transitions (`620ms` cubic cross-fade) into **Mirror-Polished Chrome Silver Metallic** (`isCompleted = true`) and `End (■)` becomes **`Reset (↺)`**, preventing accidental clearing.
     - Clicking `Reset (↺)` restores the active Heirloom Red shade and resets the countdown to `lastConfiguredSeconds` (e.g., `25:00`).
     - Twisting the dial or typing a new time on a completed silver tomato automatically transitions it back to active red.
   - **Zero-Second Countdown Play Guard:** Pressing `Play (▶)` at `00:00` in Countdown mode is blocked with a clear guidance banner (`"Wind the tomato or tap the digits to set a duration before starting"`).
   - **Stopwatch (`⏱`) Whole-Minute Rotation & Resume Safety:**
     - Tapping `[Stopwatch ⏱]` when already in Stopwatch mode toggles Play/Pause without wiping elapsed time.
     - Switching from an active/paused Countdown with progress to Stopwatch prompts confirmation first.
     - In Stopwatch mode, the 3D tomato rotates forward **only on whole elapsed minutes** (`+3°` per full minute).
   - **Authentic Mechanical Pomodoro Ending Bell (rings several times):**
     - At `00:00` the kitchen-timer bell rings **3 times, ~1.8 s apart** (`playCompletionAlarm`; each ring = escapement grace tap + full brass strike). All rings are queued on the audio clock up front; **any tap silences it**.
     - Rings **on time while you're on another tab or app**, as long as the browser keeps the page running (a fresh one-shot wake-up is armed for the due time from user actions and the page-hidden event, so background throttling can't delay it).
     - Coming back long after a timer finished while the phone was asleep plays **one soft chime**. Ending a timer yourself (`End ■`) plays one chime.
     - **Web limit:** a locked iPhone or a backgrounded iOS web app pauses the page, so web code can't ring at the due time without either taking over the audio session (pauses the user's music) or a push server. The native app (Phase 2) uses a scheduled local notification with the bell sound.

### B. Pillar 2: Purpose & Presence (Dual-Sided Card, Stack & Calendar)

1. **Front of Today's Card (Clean White To-Do Card — Screen 1, Completed in Phase 1):**
   - Clean white cardstock (`#FDFDFB`, zero dots), stamped `TUESDAY — OCT 06`, maximum 6 flat tasks (`01`–`06`), `+ Add item` row when `< 6` tasks, zero vertical scroll.
   - **Single-Tap Task Edit & Delete Modal:** Tapping a task's text once opens the Edit Task Modal containing `Delete (🗑)`, `Cancel`, and `Save`. Deleting a task removes it, re-indexes remaining tasks, and **automatically resets any tomato assigned to that task back to Matte Neutral Grey**.
   - **Straight Horizontal `Left → Right` Strikethrough & `Left → Right` Erase (`Δx > +15 px`, `±25°`):** First `Left → Right` drag draws a straight horizontal graphite line; second `Left → Right` drag erases it from Left to Right.
   - **Right-Side Shiny Single-Highlight Mini-Tomato Triggers:**
     - Tapping a **grey** mini-tomato lights it up (assigns a timer slot) **and navigates to the Hero Tomato page**.
     - Tapping a **lit (colored or silver)** mini-tomato on the Front Card **opens that tomato's Hero timer page** (assignment, title and any running timer are untouched). Unassigning lives only on the Hero page and the Grid page (`✕ Unassign Tomato` in their dropdowns).
2. **Back of Today's Card (Matte Black Reflection Journal — Phase 2):**
   - Triggered by a `Right → Left` swipe (`Δx < -40 px`, `±35°`) or tapping the center `[Flip Icon]`.
   - Matte black surface (`#141413`) with white typography (`#FAF9F5`) stamped `TUESDAY — OCT 06`.
   - **Adaptive Font Scaling (`20pt` → `13pt` Floor + Scroll Fallback):** Automatically scales reflection typography down to `13pt` as the user types more text, enabling vertical scroll only after reaching `13pt`.
   - **0 to 2 Framed Photo Slots:** Supports attaching up to 2 compressed photos (`≤ 1600px`) framed side-by-side at the bottom of the card.
3. **Minimalist Homepage, Automatic 5:00 AM Rollover, Card Stack & Calendar Zoom (Phase 2):**
   - **Minimalist Homepage (`01-home-page.png`):** Centered `'FABLE / FLOW'` title, top-right `[Profile Icon]`, mini white card stamped `06 OCT`, and photorealistic 3D Crimson Tomato resting on `#E7E8E2`.
   - **5:00 AM Daily Boundary:** Rolls over at `05:00:00 AM` local time (`currentTime - 5 hours`) with **zero unfinished task rollover**.
   - **Card Stack Viewer (`06-stack-detail.png`):** Top chronological date strip (`OCT 01 02 03 04 (05) 06`), center card carousel with retroactive Front/Back editing, and 4-icon bottom bar (`[Return ↩]`, `[Zoom Out 🔍-]`, `[Flip]`, `[Trash 🗑]` with permanent delete confirmation modal + banner notification).
   - **Monthly Calendar Zoom-Out View (`07-calendar-view.png`):** Entered via pinch-in or `[Zoom Out 🔍-]`; displays stacked monthly grids (`SEPTEMBER 2026`, `OCTOBER 2026`) with highlighted card dates and a 2-icon bottom bar (`[Return ↩]`, `[Zoom In 🔍+]`).

---

# Part II: Technical Implementation Plan & Phase 2 Execution Blueprint

## 1. Phase 1 Locked Implementation Architecture (`v0.2.0-beta` — Complete)

| File Path | Locked Phase 1 Implementation Responsibilities |
| :--- | :--- |
| `scripts/extract_mockup_assets.py` | Extracts clean studio tomatoes (`hero-tomato-0..5.png`, `grid-tomato-0..5.png`, `*-grey.png`), feathers `#E7E8E2` cast shadows (`feather_background_to_canvas_bg`), renders the **Mirror-Polished Chrome Silver Metallic** tomatoes (`recolor_silver_metallic` using sub-pixel $\alpha(x,y)$ edge compositing, $C^\infty$ paraboloid-dome normals, 10-pass seam-aware smoothing, 3-pass bilateral crown filter, and one studio softbox highlight), and renders the **Shiny Single-Highlight Mini-Tomato Icons** (`render_shiny_mini_tomato`). |
| `js/tomato3D.js` | Implements `HEIRLOOM_PALETTE`, `getTomatoSeamY(x)`, and `HeroTomato3DView` (`_buildOdometerTextureStrip` with `1m`/`5m`/`10m` ticks + `_buildTomato3DMesh` with perspective-camera horizon mapping $\sin\theta_{\text{persp}} = 0.968 u$, upper-dome latitude relaxation, bounded meridian tilt outside $\arcsin$, 4x horizontal supersampling, and 620ms silver metallic cross-fade). |
| `js/odometerPhysics.js` | Implements 1-minute (`3°`) bidirectional dial physics (`MINUTES_PER_NOTCH = 1`, `DEGREES_PER_NOTCH = 3`, `MAX_MINUTES = 180`, `MAX_DEGREES = 540`) and whole-minute Stopwatch forward rotation (`+3°` per elapsed whole minute). |
| `js/cardGestureMath.js` | Implements pixel-locked gesture disambiguation (`Left → Right` `Δx > +15 px, ±25°` = straight horizontal strikethrough or Left-to-Right erase; `Right → Left` `Δx < -40 px, ±35°` = `180°` 3D card flip) and the 5:00 AM `LogicalDayService`. |
| `js/sensoryEngine.js` | Implements WebAudio procedural foley & haptics: ratchet notch clicks, escapement ticks, graphite stroke, eraser rub, cardstock 180° flip whoosh, stack riffle ticks, trash crumple, and the **mechanical Pomodoro bell**: `playCompletionAlarm` (3 rings at 00:00, tap to stop) and `playCompletionChime` (one ring). |
| `js/app.js` & `css/style.css` | Coordinates all screens, 6-tomato `2×3` Grid, Hero Tomato inline time editor (`#hero-time-editor`), `HH:MM:SS` (`> 60m`) formatting, Hero subtitle inline task dropdown, two-step `End (■)` → Silver Metallic → `Reset (↺)` flow, single-tap task Edit/Delete modal with cascade tomato reset, and top pill sub-view memory. |

---

## 2. Phase 2 (`v0.5.0-mvp`) Step-by-Step Execution Plan

Phase 2 builds the three remaining MVP tracks directly on top of the locked Phase 1 codebase without altering any Phase 1 timer or front-card behavior:

### Track 2A: Minimalist 2-Object Homepage (`01-home-page.png`)
1. Add `#screen-home` in `index.html` and homepage styling in `css/style.css`:
   - Global top bar displays centered `'FABLE / FLOW'` title on the Homepage and morphs into the `Card | Timer` segmented pill inside Card, Timer, Stack, and Calendar views.
   - Upper stage displays the physical mini white card stamped `06 OCT` (`LogicalDayService.miniCardDateStamp`); clicking zooms smoothly into `#screen-card`.
   - Lower stage displays the photorealistic 3D Crimson Hero Tomato (`hero-tomato-0.png` with equatorial markings and `▲` pointer); clicking zooms smoothly into the active Timer view.

### Track 2B: Matte Black Card Back Reflection Journal (`05-card-back.png`)
1. Upgrade `.card-face-back` inside `#daily-card-3d` in `index.html`, `css/style.css`, and `js/app.js`:
   - Matte black cardstock (`#141413`) with top-left `TUESDAY — OCT 06` header and subtle divider rule.
   - **Adaptive Journal Textarea (`#journal-reflection-input`):** Dynamically measures content height on input and scales font size smoothly from `20px` down to the **`13px` minimum floor**; once text at `13px` exceeds the card body height, locks at `13px` and enables vertical scrolling.
   - **Dual Framed Photo Slots (`#journal-photo-grid`):** Supports 0, 1, or 2 attached photos at the bottom of the matte black card with client-side canvas downscaling (`≤ 1600px` max dimension) and one-tap photo removal/replacement.

### Track 2C: Chronological Card Stack Archive, 5:00 AM Rollover & Calendar Zoom (`06-stack-detail.png` & `07-calendar-view.png`)
1. Upgrade `FableFlowApp` state storage in `js/app.js` to store a chronological dictionary of `DailyCard` records keyed by `logicalDateKey` (`YYYY-MM-DD` with 5:00 AM boundary), pre-seeded with realistic past archive dates (`OCT 01`–`OCT 05`) plus Today (`OCT 06`) so the Stack and Calendar can be inspected immediately:
   - Crossing 5:00 AM automatically archives the previous day's card into the Stack and initializes Today's new card clean (with **zero rollover** of uncrossed tasks).
2. Add `#screen-stack` (`06-stack-detail.png`):
   - Top horizontal date strip (`OCT 01   02   03   04   (05)   06`) with solid black circle on the selected date and riffle audio/haptic ticks.
   - Center peeking card stage supporting full retroactive editing of both the White Front (tasks + `Left → Right` strikethrough/erase) and Matte Black Back (reflection + photos).
   - **4-Icon Bottom Bar:** `[Return ↩]` (returns to Today's Card), `[Zoom Out 🔍-]` (opens Monthly Calendar View), `[Flip]` (flips archived card `180°`), and `[Trash 🗑]` (opens permanent delete confirmation dialog → deletes card → shows `"Card permanently deleted"` notification banner).
3. Add `#screen-calendar` (`07-calendar-view.png`):
   - Vertically stacked monthly calendar grids (`SEPTEMBER 2026`, `OCTOBER 2026`) with soft grey circles on dates with archived cards and a solid black circle on the selected date.
   - Supports pinch-to-zoom (`MagnificationGesture` / wheel-pinch) between Stack Detail and Calendar View, plus the **2-icon bottom bar**: `[Return ↩]` and `[Zoom In 🔍+]`.
