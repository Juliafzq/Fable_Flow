# Fable / Flow — Master Product Requirements Document (v4.5) & Technical Implementation Plan

> **Authoritative Spec & Phase 2 (`v0.7.0-mvp` / `v28`) Completion Baseline:**
> This master document consolidates the **Product Requirements Document (v4.5)** and **Technical Implementation Plan (v4.5)**, documenting every feature, visual preference, 3D shader refinement, typography rule, gesture mechanic, onboarding flow, retrospective card creation flow, dynamic system date refresh, past-card `Edit`/`Done` mode, photo detail lightbox, single-photo expanded layout, and inline on-card task typing implemented through **Phase 1 (`v0.2.0-beta`)** and **Phase 2 (`v0.7.0-mvp` / `v28`)**, plus the **Phase 3 Publishing, Login & Cloud Sync Plan**.

---

# Part I: Product Requirements Document (v4.5)

## 1. Idea & Background

**A tactile, digital-analog tool space that increases a user's sense of lived fulfillment by restoring daily focus, accomplishment, and presence without coercive gamification, complex hierarchies, or productivity guilt.**

Project **Fable / Flow** delivers a calm, hyper-minimalist, physical-first environment built around two tactile objects—a **dual-sided index card** and a **photorealistic 3D heirloom tomato Pomodoro timer**—replacing abstract dashboards with organic, physical tools for daily planning, deep focus, and evening reflection.

---

## 2. Owner Visual & Tactile Preferences (Locked Baseline Across All Phases)

The following visual and interaction preferences are **mandatory requirements** across Phase 1, Phase 2, and Phase 3:

1. **Photorealistic Studio-Lit Heirloom Tomatoes & Seamless Background Feathering (`#EAE8E3` / `#E7E8E2`):**
   - All tomato sprites (`home-tomato.png`, `hero-tomato-*`, `grid-tomato-*`, `mini-tomato-*`) derive from the studio-lit sculpted heirloom tomato renders with extended canvas margins (`500×500` on Hero, `700×600` on Home centered on the `0` marker & `▲` pointer apex, `340×340` on Grid) whose cast shadows feather seamlessly into the page background so **no square border or cropping boundary is ever visible**.
2. **Clean Equatorial Seam & Unclipped Perspective-Accurate 3D Curve Numbers on Hero Tomato:**
   - The center opening (equatorial seam) on the Hero Tomato has a clean, smooth lip following $y_{\text{seam}}(u) = 258.8 + 0.5 u - 18.2 u^2 - 15.2 u^4$ (where $u = \frac{x - 250.5}{215.5} \in [-1, 1]$).
   - Measurement ticks (`1-min` minor, `5-min` medium, `10-min` major) and numbers (`0, 10, 20 ... 180`) wrap around a true 2x Retina 3D surface mesh (`texH = 92 * K`, `meshHalfH = 44`, `numCenterY = 47.0 * K`, `padX = 16 * K`, tight `rimFade` at `|u| > 0.962`) with 4x horizontal supersampling so every character (`0`–`180`) is **100% shown with zero top, bottom, or side clipping**.
3. **Satin-Polished, Crisp-Edged, Zero-Color-Bleed Silver Metallic Completed Tomato (`docs/mockup-images/silver-sphere-ref.png`):**
   - When a countdown finishes (`00:00`) or the user clicks `End (■)`, the tomato smoothly transitions (`620ms` cross-fade) into a **Satin-Polished Silver Metallic** tomato (`hero-tomato-silver.png`, `grid-tomato-silver.png`, `mini-tomato-silver.png`).
   - **True Reference-Sphere Coordinates & Un-Pinched Reflection (`scripts/extract_mockup_assets.py`):**
     - Samples the 12-pass Gaussian-smoothed spherical studio reflection field from `docs/mockup-images/silver-sphere-ref.png` at its exact sphere coordinates (`cx=276.0, cy=151.0, r=108.5`) using smooth ellipsoidal coordinates `(nx_ell, by_ell)` so reflections wrap smoothly around the lower belly without pinching.
   - **Crisp 1.5px Studio Anti-Aliased Edge & Zero Red/Warm Color Bleed:**
     - Uses a tight `1.5px` studio silhouette ramp (`sig` `11.0..22.5`) combined with a Euclidean contour-distance (`dist_edge`) Fresnel metallic rim and a 100% desaturated `#E7E8E2` studio background/shadow with a 5px neutral collar—eliminating any blurry boundary or warm/red bounce-light color bleed.
     - On the 6-Tomato Grid, `.grid-tomato-wrap.is-silver-completed .grid-tomato-img:not(.grid-tomato-silver-img)` transitions to `opacity: 0` so the underlying colored tomato never bleeds around the silver tomato's silhouette.
4. **Shiny, Single-Highlight Small Card Tomato Icons (`mini-tomato-*`):**
   - The small tomato icons on Today's Card Front are rendered with smooth $C^\infty$ 3D dome shading, **zero horizontal strips/bands**, **zero pink outer/stem halo**, and **one crisp specular highlight** on the upper-left cheek.
5. **Identical Front & Back Card Header Typography & Position + Unified Card Task Typography:**
   - Today's Card Front uses a clean white surface (`#FDFDFB`, zero background dots).
   - **Identical Single-Line Front & Back Date Title:** Both `.card-header-bar` (Front) and `.card-back-header-bar` (Back) use identical padding (`clamp(16px, 2.6dvh, 24px) 26px clamp(12px, 1.8dvh, 16px)`) and single-line non-wrapping typography (`font-size: clamp(18.5px, 2.8dvh, 21px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; white-space: nowrap`) so even the longest weekday headers (`WEDNESDAY — OCT 07`, `THURSDAY — OCT 08`) never wrap onto two lines next to the `Edit` / `Done` button.
   - **Unified Font Size Per Card (`fitUnifiedCardTaskTypography`):** All task numbers (`.task-index`), task titles (`.task-title`), inline inputs (`.task-inline-input`), and `+ Add item` on a card share the **exact same unified font size** (`24px` baseline), stepping down uniformly (`24px` → `16.5px` floor) only when the entire vertical card page is filled.
   - **Multi-Line Pencil Strikethrough & Erase (`getTaskRowLineSegments`):** Dragging `Left → Right` across a multi-line task draws (or erases from `Left → Right`) a dry-graphite pencil line across **every wrapped line of text**.
6. **Two-Way Silent 3D Card Flip (`Left ↔ Right`):**
   - Both Today's Card (`#daily-card-3d`) and Archived Stack Cards (`#stack-card-3d`) flip `180°` in **both directions** (`Right → Left` or `Left → Right` swipe, or tapping `[Flip]`), silent on audio with light tactile haptics.
7. **Concise, Minimalist Toast Copy (Zero Design Rationales in UI):**
   - All toast pills (`showTelemetryToast`) and notification banners (`showNotificationBanner`) state only the direct status or action (e.g., `"Task length limit reached"`, `"Reflection length limit reached"`, `"Task deleted"`, `"Card added for OCT 03"`) and **never** explain design rationales (such as *"to keep text away from edge"*) or internal mechanics.

---

## 3. Detailed Functional Requirements & Phase 2 (`v28`) Updates

### A. Minimalist 2-Object Homepage (`01-home-page.png` — Screen 0)

1. **Exact Mockup Typography, Proportions & Vertical Center-Line Alignment:**
   - **Top Header (`#home-brand-title`):** Centered `'FABLE / FLOW'` in `12.5px` sans-serif (`weight: 400`, `letter-spacing: 0.24em`, `#3A3936`) with the minimalist `[Profile Icon]` in the top-right corner.
   - **Upper Object — Miniature Daily Card (`#home-mini-card`):** `334×222px` horizontal white card (`max-width: 85vw`, `max-height: 27dvh`) stamped in the top-left with the current system short date (e.g., **`11 OCT`**).
   - **Lower Object — Centered 3D Heirloom Tomato (`#home-tomato-btn`):** Photorealistic studio-lit Crimson Tomato (`assets/tomatoes/home-tomato.png`, cropped symmetrically around `x=385` so the `0` marker and `▲` pointer apex lie on the exact `50%` vertical center line of the viewport).

### B. Minimalist Profile Popover & 8-Step Motion-Driven Guided Tutorial

1. **Minimalist Top-Right Profile Popover (`#profile-modal-overlay`):**
   - Anchored in the top-right with four controls: **`Home`**, **`Guided Tour`**, **`Daily Reset`** (`00:00`–`23:00`, default `05:00`), and **`Sound`** (`On` / `Off`).
2. **8-Step Motion-Driven Live Page Guided Tutorial (`#onboarding-overlay`, `#tour-page-dot`, `#tour-page-dot-2`):**
   - Launches automatically on first visit (`hasCompletedOnboarding: false`) and is accessible anytime via **Profile → Guided Tour**.
   - **60fps Motion & Attention Fading:** Pointing steps fade the dot smoothly on and off (`opacity: 0.08 ↔ 1.0`) with a ripple ring; gesture steps move the dot in 1:1 lockstep with the live UI element.
   - **8-Step End-to-End Flow:**
     1. **`Tap Card or Tomato` (`#screen-home`):** Both dots align strictly on the `50%` vertical center line (`overlayRect.width * 0.5`), alternating between the mini-card center and the exact **`0` marker** on the tomato (`box.top + box.height * 0.457`).
     2. **`Front Page · Daily To-Dos` (`#screen-card`, Front):** Dot moves `Left → Right` across `01 Example Task` while live-drawing the dry-graphite pencil strikethrough.
     3. **`Flip Page · Daily Reflection` (`#screen-card`, Front ↔ Back):** Dot swipes across the card while turning the card `0° → -180°` in 3D to reveal the Matte Black Evening Reflection journal.
     4. **`Tap Mini Tomato` (`#screen-card`, Front):** Card snaps to `0°` (`setInstantCardRotation`) so the pulsing dot lands squarely on `.task-mini-tomato-img` and lights it up crimson on press.
     5. **`Turn Tomato Dial` (`#screen-hero`):** Immediately follows Step 4—dot moves along the Hero Tomato equator while turning the 3D tomato (`25:00 → 30:00`) in 1:1 lockstep.
     6. **`Tomato Grid · 6 Focus Timers` (`#screen-grid`):** Dot fades on and off on Quadrant 1's tomato body and title.
     7. **`Scroll Stack · Past Cards` (`#screen-stack`):** Dot moves horizontally with the card (`translateX`) and triggers a natural two-card sliding transition between past cards.
     8. **`Zoom Out · Monthly Calendar` (`#screen-stack` → `#screen-calendar`):** Two dots (`#tour-page-dot` & `#tour-page-dot-2`) pinch inward while the Stack card smoothly shrinks (`scale(1) → scale(0.24)`) and fades out over the Monthly Calendar underneath.

### C. Pillar 1: Flow / Engagement (6-Pomodoro Grid & Single Big Hero Tomato)

1. **6-Tomato Grid View (`2×3` Layout — Screen 2):**
   - Split tap targets on assigned tomatoes (body opens Hero Timer; title opens inline Edit/Reassign dropdown).
2. **Single Big Hero Tomato View (Screen 3):**
   - `1-minute` (`6.0°`) bidirectional dial + Tap-on-Digits inline time editor (`0–180m` / `HH:MM`).
   - `End Timer (■)` is hidden whenever a tomato has not been set (`!isTimerSlotSet(slot)`).
   - Two-step `End (■)` → Crisp Satin-Polished Silver Metallic → `Reset (↺)` flow.

### D. Pillar 2: Purpose & Presence (Inline Task Typing, Past-Card Edit/View Mode, Lightbox & Adaptive Photo Layout)

1. **Direct Inline On-Card Task Entry & Editing (`startInlineAddTask` & `startInlineEditTask` — Screen 1 & Screen 4):**
   - **No Modal Popup for Task Entry:** In Today's Card mode (`#screen-card`) and on Past Cards when in `Edit` mode (`#screen-stack`), clicking **`+ Add item`** appends a new `.task-row` directly on the card face containing an auto-wrapping `<textarea rows="1" class="task-inline-input">` so the user types directly on the card.
   - **Direct Inline Task Editing & Deletion:** Clicking an existing task's text on Today's Card (or on a Past Card in `Edit` mode) replaces the title in-place with `.task-inline-input` and an inline `×` delete button (`.task-inline-delete-btn`). Pressing `Enter` or tapping outside (`blur`) saves the task; pressing `Escape` cancels; clearing the text or tapping `×` removes the item.
2. **Past Card `Edit` / `Done` Mode (`#stack-front-edit-btn` & `#stack-back-edit-btn` — Screen 4):**
   - Both the Front and Back headers of archived Stack cards include a pill toggle button (`Edit` in View Mode; `Done` in Edit Mode, styled via `.stack-card-edit-btn` and `.stack-card-edit-btn-dark`).
   - Navigating to another date or zooming out automatically resets `isStackEditMode = false` (while newly created retrospective cards start with `isStackEditMode = true` so the user can immediately type tasks).
   - **Front of Past Card in View Mode (`!isStackEditMode`):**
     - Hides **`+ Add item`** (`#stack-add-item-row`).
     - Task titles are read-only for text editing (while still supporting pencil swipe strikethrough).
   - **Back of Past Card in View Mode (`!isStackEditMode`):**
     - Reflection `<textarea>` (`#stack-card-back-reflection`) is `readOnly = true` with no placeholder text.
     - **0 Photos Attached:** Hides `#stack-card-back-photos` completely—no `+ Attach Photo` placeholder boxes are shown.
     - **1 Photo Attached (Expanded Single-Photo Layout):** Applies `.single-photo-layout` to `.card-back-body` and `.single-photo-expanded` (`flex: 1; min-height: 46%; max-height: 100%`) to `#stack-card-back-photos`. `adjustReflectionTypography` sizes the reflection `<textarea>` to its actual content height (`Math.min(maxTextH, scrollHeight + 4)`) so the reflection text and the expanded single picture together make up the whole card back without overlapping into each other.
     - **Photo Detail Lightbox (`#photo-lightbox-overlay`):** Clicking any picture on a past card when not in edit mode (or on Today's card) opens the picture in full-screen detail (`openPhotoLightbox(photoSrc)`), dismissible by tapping the backdrop, the `×` button (`#photo-lightbox-close`), or `Escape`.
3. **Retrospective Card Creation for Past Days (`#screen-calendar` & `#screen-stack`):**
   - Clicking any past date on the **Monthly Calendar** (`#screen-calendar`) or on the **Stack Date Strip** (`#stack-date-strip`) zooms into `#screen-stack` for that date.
   - If that past date does not have an archived card yet (`!this.state.archiveCards[dateKey]`), `#screen-stack` renders a **dashed empty card slot** (`.stack-retro-empty-slot`) inside the card face reading **`+ Add Card for <DATE>`** (*"Add daily to-dos & reflection retrospectively"*).
   - Tapping the dashed slot creates a dual-sided card for that date in `archiveCards`, immediately opening it in `Edit` mode (`isStackEditMode = true`) and highlighting that date with `.has-card` on the Monthly Calendar.
4. **Natural Two-Card Stack Scrolling & Smooth Zoom Transitions:**
   - `_spawnOutgoingStackCardClone` + `animateStackCardScroll` glides the outgoing card off-screen while the incoming card slides in (`360ms cubic-bezier(0.22, 1, 0.36, 1)`).
   - `zoomOutStackToCalendar` & `zoomInCalendarToStack` smoothly shrink (`scale(1) → scale(0.24)`) or expand (`scale(0.28) → scale(1)`) the Stack card over `#screen-calendar`.
5. **Dynamic System Logical Date Refresh & Cross-iPhone Autofit:**
   - Automatically refreshes Today's date (`getCurrentLogicalDateString(dailyResetHour)`) on load, `visibilitychange`, `focus`, and wall-clock tick.
   - Uses `100%` locked mobile viewport (`@media (max-width: 520px)`), `env(safe-area-inset-top/bottom)`, and `dvh`-scaled flex containers so the UI autofits with zero horizontal or vertical overflow across iPhone SE/Mini (`375×560`), iPhone 14/15/16 (`390×664` Safari / `390×844` standalone), and iPhone Pro Max (`430×745`).

---

# Part II: Phase 2 (`v0.7.0-mvp` / `v28`) Technical Implementation Summary

## 1. File-by-File Architecture (`v0.7.0-mvp` / `v28` — Complete & Verified)

| File Path | Phase 2 (`v28`) Implementation Responsibilities |
| :--- | :--- |
| [`index.html`](file:///usr/local/google/home/zuqi/github/ProjectFocus/index.html) | Defines all 6 screens (`#screen-home`, `#screen-card`, `#screen-grid`, `#screen-hero`, `#screen-stack`, `#screen-calendar`), `#stack-front-edit-btn` & `#stack-back-edit-btn` header buttons, `#photo-lightbox-overlay` (`#photo-lightbox-img`, `#photo-lightbox-close`), Profile Popover, 8-step Guided Tutorial overlay, and `?v=20261010_v28` asset references. |
| [`css/style.css`](file:///usr/local/google/home/zuqi/github/ProjectFocus/css/style.css) | Implements cross-iPhone responsive autofit (`dvh` + safe-area insets), single-line non-wrapping `.card-date-title` / `.card-back-date-title`, `.stack-card-edit-btn` / `.stack-card-edit-btn-dark`, `.task-inline-input` & `.task-inline-delete-btn` on-card task editing, `.card-back-body.single-photo-layout` + `.card-back-photos-row.single-photo-expanded`, and `.photo-lightbox-overlay`. |
| [`js/app.js`](file:///usr/local/google/home/zuqi/github/ProjectFocus/js/app.js) | Implements `toggleStackEditMode()`, `openPhotoLightbox()` / `closePhotoLightbox()`, `startInlineAddTask()` / `startInlineEditTask()`, adaptive 0/1/2 photo rendering in `renderPhotoSlotsDOM()` and `adjustReflectionTypography()`, dynamic system date refresh, retrospective card creation, two-card stack scroll transitions, smooth shrink/expand calendar zoom, and 8-step Guided Tour. |
| [`js/tomato3D.js`](file:///usr/local/google/home/zuqi/github/ProjectFocus/js/tomato3D.js) | Implements `HeroTomato3DView` with tight `rimFade` (`|u| > 0.962`) and `GridTomatoRenderer` for the 6 heirloom shades, grey unassigned state, and bleed-free silver metallic state. |
| [`scripts/extract_mockup_assets.py`](file:///usr/local/google/home/zuqi/github/ProjectFocus/scripts/extract_mockup_assets.py) | Crops `home-tomato.png` symmetrically around `x=385` and generates `hero-tomato-silver.png`, `grid-tomato-silver.png`, and `mini-tomato-silver.png` with a crisp `1.5px` studio silhouette ramp and zero color bleed. |

---

# Part III: Phase 3 — Publishing, User Login & Cloud Sync Options (Cost Breakdown)

When publishing **Fable / Flow** so real users can sign in, sync their daily cards/timers/reflections/photos across devices, and use the app normally, there are **two layers of cost**:
1. **Backend (User Login + Database + Photo Storage):** Can be **$0/month** up to thousands of active users.
2. **Distribution (How users install/open the app):** Ranges from **$0/year** (Web App / PWA) to **$99/year** (Apple iOS App Store).

## 1. Backend Stack (Login + Database + Photo Storage): **$0 / month**

| Option | Auth (Sign In) | Database (Cards & Timers) | Photo Storage (Card Back) | Free Tier Limits | Cost After Free Tier |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Option A: Supabase (Recommended)** | Unlimited Email/Password, Magic Link, Google, and Apple Sign-In (`50,000 MAUs` free) | `500 MB` Postgres DB with Row-Level Security (RLS) (`~250,000+` daily cards) | `1 GB` Object Storage (`~5,000–8,000` compressed card-back photos) | **$0 / month** (up to `50,000` Monthly Active Users) | **$25 / month** (`Pro` tier: `100k MAUs`, `8 GB` DB, `100 GB` photos) |
| **Option B: Firebase (Google Spark Plan)** | Unlimited Email, Google, and Apple Sign-In (`50,000 MAUs` free) | Cloud Firestore: `1 GiB` storage, `50,000` reads/day, `20,000` writes/day free | Cloudflare R2 (`10 GB/mo` free) or Firebase Storage | **$0 / month** | Pay-as-you-go (pennies per thousand operations beyond free quota) |

> [!TIP]
> **Why Client-Side Photo Compression Keeps Storage Nearly Free:**
> Because Fable / Flow already compresses card-back photos on the client (`max 900px`, JPEG `0.78`, `~120–180 KB` per photo), `1 GB` of free storage holds **~6,000–8,000 photos** at **$0/month**.

## 2. Hosting & Distribution Options: **$0 to $99 / year**

| Distribution Path | How Users Access & Log In | Upfront / Annual Cost | Pros & Tradeoffs |
| :--- | :--- | :--- | :--- |
| **Path 1: Progressive Web App (PWA) on GitHub Pages / Cloudflare Pages / Vercel** | Users visit your URL (or custom domain) on iPhone/Android/Desktop, log in, and tap **Add to Home Screen** for a full-screen icon with offline support. | **$0 / month** hosting<br>*(Optional custom `.com` / `.app` domain: **~$10–$12 / year**)* | **100% Free** to launch immediately; instant updates with no App Store review wait. Users install from Safari/Chrome rather than searching the App Store. |
| **Path 2: Native iOS App Store + Google Play Store (via Capacitor wrapper)** | Wraps our exact HTML/CSS/JS codebase in **Capacitor** (`@capacitor/ios`, `@capacitor/android`) so users download **Fable / Flow** directly from the Apple App Store / Google Play Store and use native Sign in with Apple / Google. | **Apple Developer Program:** **$99 / year**<br>**Google Play Console:** **$25 one-time fee** | Gives you a real App Store listing, native iOS haptics, and native Sign in with Apple—without rewriting any UI code. |

---

## 3. Public Mobile Testing Link (`v28`)

- **Public Mobile Test Link:**
  - **`https://juliafzq.github.io/ProjectFocus/?v=28`**
