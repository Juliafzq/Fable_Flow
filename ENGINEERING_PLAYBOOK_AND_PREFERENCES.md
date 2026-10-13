> Note (Oct 13, 2026): the product is now named **UNTO FLOW** (umbrella brand **UNTO**); older references to Fable / Flow below refer to the same app.

# Engineering Postmortem, Working Preferences & Quality Playbook
**Prepared for:** Zuqi  
**Purpose:** Candid root-cause analysis of why *Fable / Flow (Project Focus)* required 25+ back-and-forth correction cycles, paired with a reusable **Product & Visual Preferences Guide + Pre-Handoff QA Checklist** to give your next engineer (or AI coding agent) on Day 1.
**Last updated:** Oct 11 — added Part 1B (reflection on the v37 → v54 session), new preferences in Part 2 (§7–§12), the targeted QA gate and iOS interaction checklist in Part 3, and new rules in the Part 4 prompt.

---

## Part 1: Why Was Our Development Process So Slow? (Honest Postmortem)

Looking back across all 25 versions of Phase 1 and Phase 2, **over 75% of our iteration time was spent fixing preventable visual defects, layout regressions, and incomplete interaction flows** that you had to catch manually. Here are the four root causes of why that happened:

### 1. "Blind Handoffs" — Testing Code Strings Instead of Inspecting Rendered Screenshots
* **What went wrong:** Until the final two turns, my automated test script (`evaluate_phase1.py`) only verified *whether certain strings existed in the code* (e.g., `assert "hero-tomato-silver.png" in js_tomato`), rather than opening the page in a headless browser, taking screenshots, and checking element coordinates (`getBoundingClientRect()`).
* **The cost to you:** Because I did not visually inspect the rendered pixels before telling you "it's ready," **you were forced to act as the visual QA tester**. You had to point out things that a 5-second look at a screenshot would have caught immediately:
  * The tutorial dot sitting on the wrong side of the card during *Tap Mini Tomato* (because `getBoundingClientRect()` was called while the 3D card was still mid-flip).
  * Toast banners bleeding into screen edges and overlapping bottom bar icons.
  * The silver tomato having a visible rectangular shading border against the background canvas.
  * Front and Back card titles being slightly misaligned in position and font size.

### 2. "Visual Slack-Off" — Taking 2D / Static Shortcuts on 3D & Animated Features
* **What went wrong:** On visually complex features, I initially built a cheap approximation ("good enough to check the box") instead of building the physically accurate version on the first try:
  * **3D Tomato Odometer:** I initially drew flat 2D canvas text (`fillText` with horizontal scaling) that stayed flat facing the screen at the curved edge of the tomato and clipped letters in half—requiring 3 rounds of feedback before I built a real 3D surface mesh with UV projection and whole-character visibility.
  * **Silver Metallic Tomato:** Took 4 iterations (*flat grey* → *over-contrasted vintage silver* → *badly cropped square shadow* → *polished chrome*) because I initially used a simple luminance formula instead of matching your reference image and checking the background hex blend (`#E7E8E2`).
  * **Guided Tutorial:** Took 5 iterations (*static text box* → *cluttered card with SVG* → *broken 1-step tour* → *static dot* → *synchronized moving dot*) because I defaulted to static text/boxes instead of synchronized 60fps motion on the live UI.

### 3. Desktop-Frame Bias vs. Real iPhone Safari Environment
* **What went wrong:** I built and tested the layout inside a fixed `430×852` desktop frame with rigid pixel heights (`height: 586px` on `.daily-card-3d`, `height: 368px` on `.hero-tomato-stage-wrap`).
* **The cost to you:** The moment you opened the link in real **iPhone 17 Safari**—where the visible viewport is **`393×660`** (because Safari's top status bar and bottom address bar take ~190px)—the bottom controls were cropped off, elements overlapped, a darker `#DAD8D0` band appeared at the top, iOS WebKit's `preserve-3d` bug leaked front-card icons onto the back card, iOS blocked WebAudio, and `navigator.vibrate()` produced zero haptics. Mobile web apps must be engineered for `393×660` iOS Safari from **Version 1**, not patched in Version 24.

### 4. Partial State & Flow Thinking
* **What went wrong:** When adding or changing a feature, I often coded the immediate element without tracing the full user state before and after the action:
  * Showing the `End` timer button even when the tomato was at `00:00` (not set).
  * Clicking a grey mini-tomato on the Card without automatically navigating to the Hero Timer page.
  * Leaving already-assigned tasks inside the timer task-assignment dropdown.
  * Deleting a task without resetting its linked tomato timer.
  * Shipping dummy history (`Math Study`, `Build Deck`, past September/October cards) when a new user should start with a clean slate and only one `Example Task`.

---

## Part 1B: Oct 11 Session Reflection (v37 → v54)

Today's session shipped a lot (Chinese language, IME-safe input, bottom-bar redesign, 8-item cards, Return-to-next, no-reflow editing), but **you still caught five bugs that should never have reached you**. They share a few root causes that are different from Part 1, which makes them worth writing down.

### What went wrong

| # | Bug you had to catch | Root cause |
|---|---|---|
| 1 | Text size **bounced up and down while typing** (v49) | I checked the final layout of a full card, but never the size **after each keystroke**. The shrink loop measured the editing box at its old pixel height, so results oscillated. |
| 2 | Edit field **sometimes closed on the first tap** (v50) | I tested only in headless Chrome, which delivers a tap's follow-up mouse events immediately. iOS delivers them later, onto the layout that just changed under the finger. Worse, my harness had focus emulation off, so **blur events never fired and the blur tests passed without testing anything**. |
| 3 | **Strikethroughs disappeared after flipping back** (v51) | The same mistake as the Part 1 tutorial dot: geometry measured while the card was mid-rotation. I fixed the symptom last time without turning it into a general rule. |
| 4 | **× needed one tap sometimes, two other times** (v51 → v53) | My own v51 fix introduced it. A "suppress next click" flag on the row was never cleared on iOS (iOS sends `touchend` to the replaced node, which no longer bubbles to the row). Once the × moved inside the row, it ate the first tap. |
| 5 | **Swipe-to-flip on past cards silently disappeared** (v38 → noticed later) | To make scrolling smoother, I repurposed the card swipe for scrolling and removed flipping, without telling you there was a trade-off. |

Two more patterns slowed us down without being outright bugs:

- **Literal reading of "same size".** I first enlarged the buttons' tap boxes (44 → 54 px) while the drawn icons stayed small. You meant *how big the icons look*. I had to measure the icon glyphs' bounding boxes to get it right.
- **Requirements that conflicted.** "Two-button bars use the same spots" and "Zoom/Flip never jump" can't both hold, because the past card shows Zoom and Flip together. I should have shown the conflict and the options **before** shipping a layout. Once I did (v46/v47), you resolved it in one answer.

### What worked

- **Branch + preview for big changes.** The `zh-cn` branch let you review the Chinese UI on a preview link and ask for changes before anything hit the live app.
- **Showing options when there's a real trade-off.** Translation review, stack flip vs. scroll, × placement, button slots: each was settled in one round.
- **A failing test first, then the fix.** For the last three bugs I reproduced the problem in a test (including simulating iOS-only behavior) before changing code. That also caught a new bug before shipping: after a first-tap delete, the trailing click landed on the next item's tomato and opened the timer.
- **Targeted QA.** Once the checks were grouped by feature, a fix was verified in 15–25 seconds instead of 3.5 minutes, so there was no excuse to skip it.

### Lessons (rules from now on)

1. **Test the interaction, not just the end state.** Keystroke by keystroke, tap by tap, before and after an animation.
2. **Headless Chrome is not iOS Safari.** Enable focus emulation, use real CDP touch events, and explicitly simulate iOS-specific sequencing:
   - delayed compat clicks
   - `touchend` delivered to a detached node
   - focus outside a user gesture not opening the keyboard

   Then **say plainly what still needs a real device**.
3. **Never measure layout while it's transformed, animating, or stale.** Re-measure after `transitionend`, and re-size dependent elements (like textareas) before measuring their container.
4. **Every fix gets a regression check on its neighbors.** A fix that adds state (flags, timers, listeners) needs a test of what happens if that state is never cleared.
5. **When requirements conflict, stop and present options.** Don't pick one silently.
6. **Measure what the user perceives.** For "size", that's the visible glyph; for "same location", screen coordinates across screens; for "no jumping", values over time.
7. **A harness error is not a pass.** Port collisions, leftover Chrome processes and multi-line output all produced false results today. QA tooling needs its own sanity checks.

---

## Part 2: Zuqi’s Product, Design & UX Preferences

> [!IMPORTANT]
> Hand this section directly to your next engineer or AI agent. These are non-negotiable standards for how your products should look, feel, and behave.

### 1. Mockups & Reference Images Are the Single Source of Truth
* **Mockup > Text:** Whenever there is any contradiction between written PRD text and a mockup or reference image, **always follow the mockup pixel-for-pixel** (proportions, font sizes, letter-spacing, border thickness, colors, and icon placement).
* **No Unapproved UI Chrome:** Never invent extra toolbars, debug banners, floating helper buttons, step counters (`1 / 7`), or extra action buttons (like a bottom `+` icon when `+ Add item` is already on the card).

### 2. Visual > Text (Strict Minimalism)
* **Show, Don't Tell:** Always communicate through visual affordances and motion rather than paragraphs of text.
* **Minimalist Copy:** Keep UI labels and tutorial prompts ultra-concise (Action + 1-line description of what it does).
* **No Boxes or Clutter in Tutorials:** Never draw heavy highlight boxes around UI elements or embed mini-illustrations inside tutorial popups. Use a **simple high-contrast dot directly on the live page** while locking background page interaction so the user cannot accidentally mess up the page during the tour.
* **Hide Irrelevant Controls:** If an action is not currently valid (e.g., `End Timer` when a timer is idle at `00:00`, or `Last` on Step 1), hide or disable it cleanly.

### 3. High-Craft Physical & Visual Realism (Zero "Visual Slack-Off")
* **True 3D Geometry:** When text, ticks, or graphics wrap around a 3D object (like the tomato dial), use a **real 3D surface mesh and UV projection** so characters curve, foreshorten, and tilt naturally with the surface normal. Never let characters get sliced in half at the silhouette edge—fade whole characters cleanly.
* **Seamless Asset Shading & Cropping:** Every sprite, shadow, and radial gradient must blend to `0%` alpha well inside its bounding box and match the exact canvas background hex (`#E7E8E2`). **Never leave a visible square image border or badly cropped shadow.**
* **Polished Material Finishes:** Metallic states (like the completed silver tomato) and glossy icons must look genuinely polished and sleek with smooth specular highlights—never muddy, grainy, or over-contrasted.
* **Authentic, Understated Audio & Haptics:**
  * Sounds must sound like real physical objects (e.g., an authentic mechanical double-strike Pomodoro bell, dry graphite on paper, subtle cardstock riffle).
  * Avoid cartoony or synthetic sound effects (no artificial "whoop" sound when flipping or dragging cards).
  * Never show visual debug toasts for haptics (`"Haptic: ..."`).

### 4. Motion Must Be Synchronized & Meaningful
* **1:1 Synchronized Motion:** Animations and tutorial dots must never feel static or disconnected from the UI:
  * **Pointing / Tapping:** A dot pointing at a button must **fade on and off** (with a subtle pulse) to catch the user's eye—otherwise the user won't know where to look.
  * **Twisting / Dragging:** When demonstrating a dial twist or strikethrough swipe, the dot must move along the path **while turning the dial or drawing the stroke in 1:1 lockstep**.
  * **Scrolling:** When scrolling through a stack of cards, the card must visibly translate and slide so the user clearly sees they moved to the next card.
  * **Zooming Out / In:** Zoom gestures must use **two dots pinching together** (and support real two-finger pinch on touchscreens).

### 5. Typography & Layout Discipline
* **Exact Symmetry Across Paired Views:** Paired surfaces (such as the Front of Card and Back of Card headers) must share the **exact same CSS rule** so their title position (`top`, `left`), padding, divider line, font family, font size, and font weight are 100% identical.
* **Unified Card Typography:** All items on a card must share a **single unified font size** (`24px` default). Never shrink one long task independently while leaving others large. Only decrease the unified font size when the **entire card page is vertically filled**, down to a readable floor, and enforce a word/character cap so text never touches the card edges.
* **Safe Margins for Overlays:** Floating toasts and tutorial cards must have `max-width: calc(100% - 48px)` so they never bleed into screen edges, and must never overlap active bottom-bar icons.

### 6. Clean Default State
* **Zero Fake History in Production/Test Links:** When a user opens the app for the first time, they must see a **clean profile**—zero pre-populated past cards in the archive and only **one** `Example Task` on Today's Card.

### 7. Consistency & Predictability of Controls
* **One control, one place.** A button keeps the same screen position on every screen. Two-button bars use the outer slots. Controls of the same kind share the same size and line weight as their reference (the Timer bar).
* **No duplicates.** If a control already exists (bottom-bar Flip), don't add a second one on the card.
* **Works on the first touch, every time.** Any "sometimes" behavior is a bug.

### 8. Zero Friction Input
* Tapping "add" goes straight to typing with the keyboard open. No placeholder screen, no extra tap.
* Return moves on to the next item, like a real list.
* Starting to edit must not move anything else on the card.
* Shrinking text happens together, smoothly, in one direction, and never below a readable minimum (15 px).

### 9. Language & Copy
* Translations must read naturally, the way a native app would say it, never word-for-word. Show the full translation list for review before implementing.
* Keep brand name, dates and calendar in English unless told otherwise.
* Translated UI must fit the same space as English: same menu size, condensed copy where needed, no one- or two-character orphan lines.
* Choices like language are made through the same control pattern as similar settings (a dropdown like Daily Reset), never by surprise toggling.

### 10. Ask When There's a Real Trade-off
* Present 2–3 concrete options with a recommendation, then implement the choice. Don't silently trade away an existing behavior (like swipe-to-flip) to get another.

### 11. Shipping Workflow
* Big or risky features go on a branch with a preview link first; merge only when asked ("merge").
* "Push to the master link" means deploy to `main` → `https://juliafzq.github.io/Fable_Flow/`, with a cache-busted version.
* After shipping, say what changed, what was verified, and what couldn't be verified.

### 12. QA Speed
* Run a **thorough check of the impacted features only**, not the full suite, unless the change is large (e.g. a merge). Fast enough that it's never skipped.

---

## Part 3: Mandatory Pre-Handoff QA Protocol (For Your Next Engineer)

Before the engineer (or AI agent) **ever** replies *"I've fixed it, here is the link,"* they must run this automated + visual verification gate:

```mermaid
flowchart LR
    A["1. Code Change"] --> B["2. Headless iOS Render (393x660 & 393x852)"]
    B --> C["3. Visual Screenshot Inspection"]
    C --> D["4. DOM Bounding-Box & Overlap Audit"]
    D --> E["5. Full User Flow & State Check"]
    E --> F["6. Cache-Busted Deploy (?v=N)"]
```

1. **Render & Inspect Screenshots in a Real Mobile Viewport (`393×660` AND `393×852`) First:**
   * Never test only at `430×852`. Always launch headless Chrome at **`393×660` (`deviceScaleFactor: 3, mobile: true`)**—which represents iPhone 17 Safari with the top status bar and bottom URL bar visible—and visually inspect the captured PNG screenshots **before** handing off to Zuqi.
2. **Programmatic DOM Coordinate Check (`getBoundingClientRect()`):**
   * Verify programmatically that:
     * Front and Back headers have identical `(top, left, height, fontSize, fontWeight)`.
     * Tutorial dots have `< 1px` center offset from their target element (`dotCenter == targetCenter`) after all CSS transitions have settled.
     * Bottom bars (`[Stack] [Flip]`, `[Grid] [Play] [Stopwatch]`) are 100% inside `0 .. viewport.height` with zero clipping or overlap with toast/tutorial overlays.
3. **iOS Safari / WebKit Hardware Checklist:**
   * **Viewport:** Lock `html, body` to `position: fixed; inset: 0; background-color: var(--canvas-bg)` on mobile and match `<meta name="theme-color">` so there is never a mismatched top band.
   * **3D Card Flip (`preserve-3d`):** Apply `translateZ(1px)` and `visibility: hidden` to the back-facing side of any 3D-flipped card so WebKit never leaks front-side icons (`z-index > 1`) onto the back face.
   * **WebAudio on iOS:** Unlock `AudioContext` on the first capture-phase `touchstart`/`touchend`/`click` with a 1-sample silent buffer and set `navigator.audioSession.type = 'playback'` when sound is enabled.
   * **iOS 18+ Haptics:** Use a hidden `<label><input type="checkbox" switch></label>` toggle inside user gestures so iPhone Safari triggers native Taptic Engine haptics.
4. **End-to-End State Trace:**
   * Trace every action from start to finish: *What happens before the action? What changes during the action? Where should the user land after the action? What happens if the linked item is edited or deleted?*

5. **Targeted QA Gate (`qa/run_qa.sh <groups>`), required before every push:**
   * Pick the groups the change touches: `bars`, `flip`, `edit`, `typing`, `profile`, `layout` (or `all` for merges). Groups run in parallel; a typical fix is verified in 15–25 s.
   * If the change touches something no group covers, **write the check first and watch it fail**, then fix, then add it to the right group.
   * Interaction checks must measure behavior over time (every keystroke, every tap, before and after animations), not just the final screenshot.
6. **iOS Interaction Checklist (headless Chrome won't show these by itself):**
   * **Focus inside the gesture:** call `focus()` synchronously in the tap/click handler, or the iOS keyboard won't open.
   * **Delayed compat click:** after a tap that changes the layout under the finger, iOS fires a click a moment later on whatever is now there. Either act on `pointerup` and swallow the trailing click, or cancel it on `touchend`.
   * **`touchend` to a detached node:** if the tapped element was replaced, `touchend` won't bubble to its old ancestors. Any flag waiting for it must expire on a timer.
   * **Blur right after opening** is usually a stray event: re-focus within a short grace period.
   * **IME:** never write to `value` while composing; ignore Return during composition and just after `compositionend`; strip U+2006.
   * **Harness:** enable `Emulation.setFocusEmulationEnabled`, use `Input.dispatchTouchEvent`, unique ports and profiles per run, clean up Chrome between runs, and print single-line JSON results.

---

## Part 4: Copy-Paste Onboarding Prompt for Your Next Project

> [!TIP]
> Copy and paste the block below at the very beginning of your next project conversation with an AI agent or software engineer.

```markdown
### WORKING WITH ZUQI — MANDATORY ENGINEERING & DESIGN PLAYBOOK

Before writing any code or showing me any build, you MUST follow these rules strictly:

1. NO BLIND HANDOFFS (INSPECT SCREENSHOTS FIRST):
   - Never tell me a feature or fix is done based only on code edits or text assertions.
   - Before every handoff, you MUST render the app in a headless browser at BOTH `393×660` (iPhone Safari with address bar visible, `@3x`) and `393×852` (iPhone standalone PWA), capture screenshots of every affected state, and visually inspect the screenshots + `getBoundingClientRect()` coordinates yourself.
   - Fix all cropping, overlapping icons, misaligned headers, or off-target indicators BEFORE showing me.

2. MOCKUPS & REFERENCE IMAGES BEAT TEXT:
   - Match provided mockups and reference photos pixel-for-pixel (font sizes, weights, letter-spacing, proportions, colors, and shading).
   - Never add unrequested buttons, debug toolbars, step counters, or extra chrome.

3. VISUAL > TEXT & SYNCHRONIZED MOTION:
   - Keep UI and tutorials ultra-minimalist. Never use static text boxes or draw boxes around UI elements when a visual animation can show the action.
   - Tutorial indicators (simple high-contrast dots on the live page) must show real, synchronized motion:
     * Pointing at a target: fade the dot on and off so my eye knows where to look.
     * Dragging / twisting / swiping: move the dot in 1:1 lockstep with the object turning, the line drawing, or the card flipping.
     * Scrolling: move the dot together with the card visibly sliding to the next card.
     * Zooming out/in: show two dots pinching/spreading.
   - Lock background page interaction while the tutorial is active.

4. ZERO VISUAL SLACK-OFF ON 3D, SHADING & TYPOGRAPHY:
   - If text or markings wrap around a 3D object, build a real 3D mesh / UV projection—never paste flat 2D text over a curved image or slice characters in half at the edge.
   - Ensure all images, shadows, and metallic/glossy sprites blend seamlessly into the exact background color with zero visible square crop borders.
   - Paired views (e.g., Front and Back of a card) must share the exact same CSS rule for title position, font family, and font size.
   - Keep item font sizes unified across a card; only shrink the unified font size when the entire page is vertically filled.

5. IOS SAFARI FIRST:
   - Build for real iPhone Safari from Day 1: responsive `flex: 1; min-height: 0` layouts that fit `393×660`, matched `<meta name="theme-color">`, WebKit `preserve-3d` backface isolation (`visibility: hidden`), capture-phase WebAudio unlock + `navigator.audioSession.type = 'playback'`, and iOS 18+ `<input type="checkbox" switch>` Taptic Engine haptics.
   - Always ship a clean default state (no fake history or multiple dummy tasks) and provide cache-busted links (`?v=N`).

6. TEST INTERACTIONS, NOT JUST SCREENSHOTS:
   - Reproduce every reported bug in a failing test before fixing it.
   - Measure behavior over time: every keystroke while typing, every tap (first tap must work), before/after every animation.
   - Never measure layout while it's rotating/animating; re-measure after the transition ends.
   - Headless Chrome is not iOS Safari: enable focus emulation, use real touch events, simulate iOS delayed clicks and detached-node touchend, and tell me what still needs a real iPhone.
   - Run a thorough check of the impacted features before every push (targeted, fast), and the full suite for big merges.

7. CONSISTENCY & ZERO FRICTION:
   - A control keeps the same position and size on every screen; no duplicate controls.
   - "Add" goes straight to typing with the keyboard open; Return moves to the next item; starting to edit never moves the layout.
   - Any action that works "sometimes once, sometimes twice" is a bug.

8. ASK ON TRADE-OFFS, NATURAL COPY:
   - If two of my requirements conflict, or a change would remove an existing behavior, show me 2–3 options with a recommendation before implementing.
   - Translations must sound native (not word-for-word), fit the same space as English, and be shown to me for review first.
   - Put big features on a branch with a preview link; merge only when I say so.
```
