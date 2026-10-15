# Install UNTO / FLOW on your iPhone (free, no developer license)

This builds the real iPhone app from this repo with **Xcode** on your Mac and your **normal Apple ID**.
No paid Apple Developer Program needed. It's for personal testing before publishing.

> The app is a native shell around the live web app (`https://juliafzq.github.io/UNTO_FLOW/`), so every
> design / feature update I push shows up in the app automatically. You only rebuild in Xcode for
> native changes (widget, notifications) or to renew the 7-day free install.

## What you get (vs. Safari "Add to Home Screen")

| | Add to Home Screen | This app |
|---|---|---|
| Icon, full screen, same look & features | ✅ | ✅ |
| Sounds while the app is open | ✅ | ✅ |
| **Timer alert + bell when the app is closed / phone locked** | ❌ | ✅ |
| Home Screen & Lock Screen widget (opens a tomato in one tap) | ❌ | ✅ |
| Works offline | ✅ | Needs internet when the app is opened (it loads the live site) |

## One-time setup (about 30–60 min, mostly the Xcode download)

1. **Install Xcode** from the Mac App Store (free, large download). Open it once and let it finish
   installing components. If asked which platforms to install, tick **iOS**.
2. **Add your Apple ID**: Xcode → Settings → **Accounts** → **+** → Apple ID → sign in.
   You'll get a team called "**Your Name (Personal Team)**".
3. **Get the project**: on <https://github.com/Juliafzq/UNTO_FLOW> click **Code → Download ZIP**, and unzip it.
   (Or in Terminal: `git clone https://github.com/Juliafzq/UNTO_FLOW.git`.)

## Build & install

1. In the unzipped folder, double-click **`FableFlow.xcodeproj`**, the one at the **top level**.
   Ignore the older copy inside "Project Focus Beta".
2. In the left sidebar click the blue **FableFlow** project icon, then:
   - Under **TARGETS** select **FableFlow** → **Signing & Capabilities** tab → **Team**: choose your *Personal Team*.
   - Select **UntoFlowWidgetExtension** → **Signing & Capabilities** → **Team**: choose the same *Personal Team*.
3. **Plug your iPhone into the Mac** with a cable. Unlock it and tap **Trust This Computer** if asked.
4. On the iPhone: **Settings → Privacy & Security → Developer Mode → On** (the phone restarts). This option
   only appears after the phone has been connected to Xcode once; if you don't see it yet, do step 5 first.
5. At the top of the Xcode window, set the run destination (next to "FableFlow") to **your iPhone**.
6. Press **▶ Run** (or ⌘R). The first build takes a few minutes.
7. If the app won't open with "Untrusted Developer": on the iPhone go to
   **Settings → General → VPN & Device Management → your Apple ID → Trust**, then open the app again.
8. When the app asks to **send notifications, tap Allow**. That's what makes the bell ring when the app is closed.

### Add the widget
Long-press the Home Screen → **Edit → Add Widget** → search **UNTO / FLOW** → pick a size.
For the Lock Screen: long-press the Lock Screen → **Customize → Lock Screen → widgets row**.

| Size | What it does |
|---|---|
| **Small** | A tomato with a countdown. **− / +** sets the length (5-minute steps, 5 to 180 min). Tap the tomato to start, again to pause; **■** stops. The bell rings at 00:00. |
| **Medium** | Same tomato with big countdown digits, plus today's to-do list from the front of your card. Tap a task to cross it out (tap again to undo). The app picks up the change next time it's open. |
| **Lock Screen** | Shows the live countdown while a tomato runs. |

Tapping anywhere else on the widget opens the app on a fresh tomato.

> The widget's timer runs inside the widget, separate from the four tomatoes in the app.
> The to-do list appears after you open the app once (it hands today's tasks to the widget).

> **Mac Desktop Widget tip:** If you have macOS Sonoma (14.0+) or Sequoia (15.0+), you can also put this exact widget on your Mac desktop without building a Mac app! Go to Mac **System Settings → Desktop & Dock → enable "Use iPhone widgets"**, then right-click your Mac desktop and click **Edit Widgets...** to add it. See [INSTALL_ON_MAC.md](INSTALL_ON_MAC.md) for details.

## The 7-day limit (free Apple ID)

Apps signed with a free Personal Team **stop opening after 7 days**. Your data is kept. To renew:
plug the phone into the Mac, open the project, press **▶ Run** again (about 1 minute). Your tasks and cards stay.

## Sharing with friends (free Apple ID)

- **They don't need Xcode.** Plug *their* iPhone into *your* Mac, select it as the run destination, press Run.
  They also turn on Developer Mode and Trust your Apple ID on their phone (steps 4 and 7).
- The same **7-day expiry** applies to their install, and renewing means plugging into your Mac again.
- A free Apple ID only covers a few test phones, so this suits 1–3 close testers.
- Anyone can always use the **web link / Add to Home Screen** version with no install.
- For a real beta with many testers installing from a link (TestFlight, builds last 90 days), you need the
  paid Apple Developer Program (\$99/yr). That's the same account you'd need to publish anyway.

## If something goes wrong

| Message | Fix |
|---|---|
| "Failed to register bundle identifier" / "not available" | Click the blue project icon → **PROJECT FableFlow** (not a target) → **Build Settings** → search `APP_BUNDLE_ID_BASE` → change `com.juliafzq.untoflow` to something unique like `com.yourname.untoflow`. App and widget both update. |
| "Signing requires a development team" | Pick your Personal Team for **both** targets (step 2). |
| "Developer Mode disabled" | iPhone Settings → Privacy & Security → Developer Mode → On. |
| "Your maximum number of apps has been reached" | Free accounts can have only a few test apps per phone. Delete another test app you built, then Run again. |
| Signing error mentioning **Keychain Sharing** or `keychain-access-groups` | Click the blue project icon → for **both** targets open **Signing & Capabilities** → delete the **Keychain Sharing** box (trash icon). The widget timer still works; only the to-do list stops updating from the app. |
| Any red build error | Take a screenshot of the error (or copy the text from the Issue navigator, ⌘5) and send it to me. |
