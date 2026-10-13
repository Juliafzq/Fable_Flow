# UNTO / FLOW — Project Focus Beta (`v0.2.0-beta`)

**A Tactile Daily Ritual & 4-Pomodoro Focus App**

This repository contains the **Phase 1 Beta ("Project Focus Beta")** implementation of **UNTO / FLOW** (formerly Fable / Flow), built iteratively from **Milestone 0 (`v0.1.0-alpha` — Foundation & Data Layer)** through **Milestone 1 (`v0.2.0-beta` — Core Tactile Loop: Card Front + 4-Pomodoro Timer + Sensory Engine)** in strict alignment with `docs/PRD-v4.md` and `docs/Implementation-Plan.md`.

---

## 1. Quick Start — Interactive Browser Preview

To launch the live interactive **Project Focus Beta** app on your Cloudtop:

```bash
./start.sh
```

Then open **`http://zuqi.c.googlers.com:8090`** in your browser.

---

## 2. What’s Included in Project Focus Beta (Phase 0 & Phase 1)

### A. Global Top Navigation Bar (Mockups `02`, `03`, `04`)
- **Centered `Card | Timer` Segmented Pill:** Active view highlighted in a solid black rounded pill (`#080808`) with crisp white text; inactive view in muted warm charcoal.
- **Top-Right `[Profile]` Icon:** Minimalist person outline icon for quick access to local-first status & settings.

### B. Pillar 1 — Front of Today’s Card (`docs/mockup-images/04-card-front.png`)
- **300gsm Cotton Cardstock Surface (`#FAF9F5`) on Warm Stone Canvas (`#E7E5DE`):**
  - Stamped uppercase header (`TUESDAY — OCT 06`) above a clean horizontal divider line.
  - Subtle `22px` dot-grid texture across the card body.
  - **6-Task Hard Cap & Zero Vertical Scroll:** Holds up to 6 flat numbered tasks (`01` through `06`) with zero subtasks and zero vertical scrolling.
  - **`+ Add item` Row:** Appears below the last task whenever `< 6` tasks exist and automatically hides when all 6 slots are full.
  - **Right-Aligned Miniature 3D Heirloom Tomato Icons:** Colored in each quadrant’s signature Heirloom Red shade when assigned (`#8B1E24` Deep Crimson on `01 Math Study`, `#C84B31` Warm Terracotta on `02 Build Deck`) or Matte Neutral Gray (`#858585` on `03 Pick Up Package`) when unassigned. Tapping a tomato icon assigns the task and opens the 3D Hero Timer.
  - **Pixel-Direction Gesture Disambiguation Rules:**
    - **`Left → Right` Drag (`Δx > +15 px` within `±25°` horizontal cone) on a task row:** Draws a textured **graphite pencil strikethrough** across the task (or erases it if already crossed out) with synchronized graphite scratch audio and haptic feedback.
    - **`Right → Left` Drag (`Δx < -40 px` within `±35°` horizontal cone) on the card:** Triggers a `180°` 3D card flip animation with paper swoosh audio.
  - **3 Bottom Bar Action Icons:** Left `[Stack]`, Center `[Flip]`, Right `[+ Add]`.

### C. Pillar 2 — 4-Pomodoro `2×2` Grid View (`docs/mockup-images/03-grid-timer.png`)
- **Balanced `2×2` Grid with Thin Crosshairs (`+`):**
  - **Unassigned Tomatoes:** Rendered in sculpted 3D **Matte Neutral Gray** with `"Tap to assign"` centered on the body.
  - **Assigned Tomatoes:** Transition to 4 distinct **Heirloom Red** shades:
    1. Top-Left (Slot 0): **Deep Crimson (`#8B1E24`)** — `MATH STUDY / 02:30`
    2. Top-Right (Slot 1): **Warm Terracotta (`#C84B31`)** — `BUILD DECK / 00:45`
    3. Bottom-Left (Slot 2): **Rich Dark Burgundy (`#5E192A`)**
    4. Bottom-Right (Slot 3): **Sun-Ripened Coral (`#D96B52`)**
  - **Floating Dark Task Assignment Dropdown:** Tapping an unassigned tomato or task title opens the floating menu (`+ Custom Title... ⌄` in a solid black header + Today’s Card tasks in crisp white rows + `Clear Assignment`).
  - **Inline Controls & 1-Active-Timer Rule:** Assigned tomatoes display inline `Play ▶ / Pause ||` and `End ■` buttons directly below the tomato. Starting any timer automatically pauses any other running timer.
  - **Decoupled Task Strikethrough:** Ending (`■`) or completing (`00:00`) a timer plays the soft completion chime and resets the dial to `00:00` without crossing out the task on Today’s Card.

### D. Pillar 3 — Single Big Hero Tomato View (`docs/mockup-images/02-hero-timer.png`)
- **Upper-Left Tabular Digital Readout:** Huge bold readout (`02:30`) with uppercase task subtitle (`01 / MATH STUDY`) directly below.
- **Bidirectional 3-Turn Odometer 3D Heirloom Tomato (`0–180` Minutes):**
  - Dragging **`Right → Left`** winds the countdown **UP** in 5-minute (`30°`) mechanical ratchet notches across **Turn 1 (`0–60`m)**, **Turn 2 (`65–120`m)**, and **Turn 3 (`125–180`m)**.
  - Dragging **`Left → Right`** unwinds/decrements the countdown **DOWN** in 5-minute (`30°`) notches all the way back to `00:00`.
  - Equatorial odometer numbers dynamically update per turn (displaying `130  140  150  160  170` above the white `▲` pointer at `150` minutes / `02:30`).
- **4 Bottom Control Bar Icons:** `[2×2 Grid ⊞]`, `[Play ▶ / Pause ||]`, `[End / Reset ■]`, `[Stopwatch Toggle ⏱✓]`.

---

## 3. Running the Automated Evaluation Suite

Run the Phase 0 & Phase 1 automated evaluation script at any time:

```bash
python3 tests/evaluate_phase1.py
```
