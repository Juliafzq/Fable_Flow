# Install UNTO / FLOW on your Mac & Use Desktop Widgets

You have two great ways to run UNTO / FLOW on a Mac, plus full support for **Desktop Widgets** on macOS Sonoma (14.0+) and macOS Sequoia (15.0+).

---

## At a Glance: Company Mac vs. Personal Mac

| Feature | Company Mac (gMac) | Personal Mac |
|---|---|---|
| **Chrome Desktop App (PWA)** | ✅ **Recommended & Instant** (no Xcode, no IT approval needed) | ✅ Instant |
| **Native Mac App via Xcode** | ✅ Supported if Xcode is installed on your device | ✅ Supported |
| **Desktop Widget** | ✅ Yes (via iPhone Continuity or native Mac build) | ✅ Yes (via iPhone Continuity or native Mac build) |
| **7-Day Expiry?** | **No expiry on Mac** (only applies to iPhones) | **No expiry on Mac** |

> [!NOTE]
> On iOS devices, Apple's free developer accounts enforce a 7-day provisioning expiration. **On macOS, locally compiled apps do NOT expire after 7 days.** Once compiled on your Mac, it stays running indefinitely.

---

## Route 1: Instant Chrome Desktop App (Best for Company Mac)

If you are on a company Mac and want an instant, clean desktop app without messing with Xcode or corporate permissions:

1. Open Google Chrome on your Mac and go to:
   **<https://juliafzq.github.io/UNTO_FLOW/>**
2. In Chrome's address bar at the top right, click the **Install UNTO / FLOW** icon (a screen with a down arrow).
   *(Or click the three dots `⋮` in Chrome → **Cast, save, and share** → **Install UNTO / FLOW**)*.
3. Click **Install**.

### What you get:
- Runs in its own standalone, distraction-free macOS window (no URL bar, no tabs).
- Appears in your Mac's **Dock** and **Launchpad**.
- Stores cards and settings locally in your macOS user profile.
- Completely offline-capable with full sound and haptics support.
- 100% compliant with company security (it runs inside Chrome's secure sandbox, so Santa / IT policies won't block it).

---

## Route 2: Native Mac Catalyst App & Widget via Xcode

If you want the full native macOS application and native desktop widget:

1. **Open Xcode** on your Mac.
2. Open **`FableFlow.xcodeproj`** (at the root of this repository).
3. In the left project navigator, select the blue **FableFlow** project icon:
   - Under **TARGETS**, select **FableFlow** → **Signing & Capabilities** tab → select your **Personal Team** (or Apple ID).
   - Under **TARGETS**, select **UntoFlowWidgetExtension** → **Signing & Capabilities** tab → select the same Team.
4. In the top toolbar, click the target dropdown (next to the "FableFlow" scheme) and select:
   **My Mac (Mac Catalyst)**
5. Press **▶ Run** (or `⌘R`).

The app will compile and launch as a native macOS window, and register the widget with macOS.

---

## How to Add the Desktop Widget to your Mac

macOS Sonoma (14.0+) and macOS Sequoia (15.0+) support placing widgets directly on your Mac desktop.

### Method A: Using iPhone Continuity Widgets (Zero Mac build required!)
If you installed UNTO / FLOW on your iPhone via `docs/INSTALL_ON_IPHONE.md`:
1. On your Mac, go to **System Settings → Desktop & Dock**.
2. Scroll to the **Widgets** section and ensure **"Use iPhone widgets"** is toggled **ON**.
3. Right-click any empty space on your Mac desktop and select **Edit Widgets...**
4. Scroll or search for **UNTO / FLOW**.
5. Drag the tomato widget onto your desktop!
   *(Note: This works whenever your iPhone is nearby or on the same Wi-Fi network and signed into the same Apple ID).*

### Method B: From the Native Mac App (Route 2)
1. Build and run the app once via Xcode on your Mac (Route 2 above).
2. Right-click any empty space on your Mac desktop and select **Edit Widgets...**
3. Select **UNTO / FLOW** from the gallery and drag it to your desktop.
4. Clicking the widget launches UNTO / FLOW directly into a focus tomato session.
