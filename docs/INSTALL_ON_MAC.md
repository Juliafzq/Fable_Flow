# Install UNTO / FLOW on your Mac & Use Desktop Widgets

There are two ways to run UNTO / FLOW on a Mac:

| | A. Chrome desktop app | B. Native Mac app (Xcode) |
|---|---|---|
| Setup time | ~10 seconds | 30–60 min (Xcode download) |
| Needs Xcode / Apple ID | No | Yes |
| Managed / work Mac | ✅ Works. Uses Chrome's built-in "Install app" | ⚠️ Usually blocked: managed Macs often refuse to run locally built apps |
| Dock, Launchpad, own window | ✅ | ✅ |
| Works offline, sounds, end bell | ✅ (bell rings while the app is open, even in the background) | ✅ |
| Updates | Automatic (loads the live site) | Automatic for design; rebuild for native changes |
| Desktop widget | Via your iPhone (see below) | ✅ Native widget |

---

## A. Chrome desktop app (recommended, especially on a work Mac)

1. Open **Google Chrome** and go to **<https://juliafzq.github.io/UNTO_FLOW/>**
   *(Tip: use a personal Chrome profile so your cards stay separate from work browsing.)*
2. Click the **Install** icon at the right end of the address bar (a monitor with a down arrow).
   If you don't see it: **⋮ menu → Cast, save, and share → Install UNTO / FLOW…**
3. Click **Install**. UNTO / FLOW opens in its own window, shaped like the phone app.
4. **Keep it in the Dock:** right-click the tomato icon in the Dock → **Options → Keep in Dock**.
   It's also in **Launchpad** and in Finder under `~/Applications/Chrome Apps`.

What you get:
- Its own window with no tabs or address bar. Clicking the Dock icon brings the open window forward instead of opening a second one.
- Cards and settings are saved on this Mac, in that Chrome profile. Use **Account → sign in** in the app if you want them synced with your phone.
- Works offline after the first open.

**To remove it:** open the app → **⋮** (top-right of its window) → **Uninstall UNTO / FLOW**.

> Note: the Chrome app and Safari/iPhone keep separate cards unless you sign in to sync.

---

## B. Native Mac app & widget via Xcode (personal Mac)

1. Install **Xcode** from the Mac App Store and open it once.
2. Open **`FableFlow.xcodeproj`** (top level of this repo).
3. Select the blue **FableFlow** project → for **both** targets **FableFlow** and **UntoFlowWidgetExtension**:
   **Signing & Capabilities → Team →** your *Personal Team* (your Apple ID).
4. In the toolbar, set the run destination to **My Mac (Mac Catalyst)**.
5. Press **▶ Run** (⌘R).

> On a **managed work Mac**, step 5 usually fails or the app is blocked when it launches. Managed Macs only run
> software from approved sources unless IT gives you a developer exception. Use option A there.

> With a free Apple ID, the signing profile may expire after 7 days, like on iPhone. If the app stops opening, press ▶ Run again.

---

## Desktop widget on a Mac

macOS Sonoma (14) and later can show widgets on the desktop.

**From your iPhone (no Mac build needed):** if UNTO / FLOW is installed on your iPhone (see `INSTALL_ON_IPHONE.md`)
and the Mac is signed in to the **same Apple ID**:
1. Mac **System Settings → Desktop & Dock → Widgets →** turn on **Use iPhone widgets**.
2. Right-click the desktop → **Edit Widgets…** → find **UNTO / FLOW** → drag it onto the desktop.

**From the native Mac app (option B):** after one ▶ Run, right-click the desktop → **Edit Widgets…** → **UNTO / FLOW**.
Add **Tomato** (small timer) and/or **Today's Card** (wide to-do list you can cross off).
See the widget table in `INSTALL_ON_IPHONE.md` for what each button does.

The Chrome desktop app (option A) can't add a widget. Chrome web apps don't support macOS widgets.
