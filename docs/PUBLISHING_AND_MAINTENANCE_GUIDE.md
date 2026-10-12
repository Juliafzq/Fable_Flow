# Fable / Flow — Publishing & Maintenance Guide (International + Mainland China)

> **v2 — low-cost, phased.** Spend only what's needed now and add paid pieces once there's demand.
> **Brand setup:** the umbrella name is **being decided**. "Fable Studio" is out because of conflicts (an existing AI studio of that name, a "Fable" hotel chain, crowded lifestyle marks). Placeholders below: **`<brand-domain>`** (e.g. the personal-brand .com) and **`<brand>`**. The app is **Fable / Flow**.
> **Owners:** 🧑 = you (accounts, IDs, payments, legal) · 🤖 = me (code, configs, docs, QA).
> Prices and rules were checked in October 2026 and change over time. ⚠️ marks items to re-verify at the moment you act.

---

## Cost phases at a glance

| Phase | When | What you pay for | ≈ Cost |
|---|---|---|---|
| **A. Launch lean** | Now → international launch | Apple Developer Program **$99/yr** + one `.com` domain (**~$10–15/yr**) + Google Voice (free) | **≈ $110–115 in year one** |
| **B. Traction** | ~a few hundred active users, real sales, or photos near the free 1 GB | Supabase Pro **$25/mo**; optional iCloud+ email $12/yr | +$300–312/yr |
| **C. China** | When international shows traction and you want the mainland storefront | Mainland server (from **¥99/yr**), a filable domain if needed; filing itself is free | +~$15–45/yr |
| **D. Protect & expand** | Once the brand name is settled and products multiply | Trademarks (CN ≈ ¥300/class, US ≈ $350/class); P.O. box for EU privacy (optional); Google Play $25 once | one-off |

**Free or at-cost choices used in Phase A:**
- **Supabase free tier**, kept awake by a weekly automatic check-in + weekly backup (🤖 sets up via GitHub Actions)
- **Free email** on your domain (Zoho Mail Free, or Cloudflare Email Routing → your existing inbox)
- **Google Voice** number for Apple's EU contact field
- **GitHub Pages** for the website

---

## 0. Locked decisions

| Topic | Decision |
|---|---|
| Model | Free download → **14-day full trial** → free tier (**one card + one tomato**) or **Pro one-time ~$4.99–5.99** (≈ ¥25–30) |
| Extras | **Tip jar** (3 consumable tips); **50 founding beta users** get Pro via Offer Codes |
| Platforms | iPhone first (international + China), Android (Google Play) later, China Android only with a company |
| Domain / email | **One `.com` personal-brand domain** (`<brand-domain>`, doubles as your portfolio); `hello@<brand-domain>` via free email; add a filable China domain only in Phase C if needed |
| App web addresses | Portfolio at `<brand-domain>`; app at `flow.<brand-domain>`; China API (Phase C) `api-cn.<brand-domain>` |
| Backend | Phase A: **hosted Supabase free tier** (international). Phase B: Supabase Pro. Phase C: **self-hosted Supabase on a mainland server** for China |
| Launch order | International first. EU included **only if** you're comfortable declaring trader info (Google Voice + an address); otherwise launch without the EU and add it later. Mainland China in Phase C. |

```mermaid
flowchart LR
    A["Phase 1: Accounts & identity"] --> B["Phase 2: iOS app build"]
    A --> G["Phase 7: China filing track"]
    B --> C["Phase 3–4: Backend + website & legal"]
    C --> D["Phase 5: TestFlight beta"]
    D --> E["Phase 6: International App Store launch"]
    G --> H["China storefront release"]
    E --> H
    E --> I["Phase 8: Marketing"]
    H --> J["Phase 9: Ongoing maintenance"]
    I --> J
```

---

## Phase 1 — Accounts, identity & brand (week 0–1)

### 1.1 Domain 🧑
1. Register the chosen **`.com`** (`<brand-domain>`, ~$10–15/yr ⚠️).
   - **Option 1, register at Alibaba Cloud or Tencent Cloud with real-name verification (Chinese ID):** the same domain can later be ICP-filed for China, since `.com` is filable. One domain for everything.
   - **Option 2, register at Cloudflare (at-cost):** cheapest renewals. Transfer it to a Chinese registrar before Phase C (allowed 60 days after registration).
2. Turn on auto-renew. **An expired domain breaks email, website and (later) the ICP filing.**

### 1.2 Email 🧑 (I can write the DNS records)
- **Phase A, free:** **Zoho Mail Forever Free** (up to 5 addresses, send + receive, Zoho app/web only), **or** **Cloudflare Email Routing** (receive-only, forwards `hello@` to your existing inbox).
- **Later, optional ~$12/yr:** **iCloud+ Custom Email Domain**. Works in Apple Mail and reliably from mainland China.

Either way: add the provider's DNS records (MX, SPF, DKIM), create `hello@` and `support@`, and test from Gmail **and** a Chinese mailbox (QQ / 163).

### 1.3 Apple Developer Program 🧑
1. Enroll as an **Individual** ($99/yr; ¥688 if enrolled in mainland China) with **your legal name**. Use the **same legal name** as on your China ICP filing.
2. Your account's country determines tax forms and payouts: choose where your bank account and tax residency are.
3. **App Store Connect → Business:** sign the **Paid Applications Agreement**, fill in **tax** (W-9 if US; otherwise W-8BEN) and **banking**.
4. Apply to the **App Store Small Business Program** (15% commission instead of 30%).
5. **EU trader status (DSA):** you sell Pro and tips, so you **are a trader** in the EU. Apple publishes the address, phone and email on EU product pages.
   - **Phone:** a free **Google Voice** number (accepted).
   - **Address:** real address (free, but public in the EU) or a P.O. box (~$70–260/yr, private).
   - **If you don't declare:** the app is removed from the **27 EU storefronts only**; all other countries are unaffected, and you can add the EU later.

### 1.4 Trademarks 🧑 (Phase D; 🤖 can run the database search first)
- Settle the umbrella brand name first (see the naming shortlist doc), then file.
- **China first:** China is first-to-file, so file the umbrella name + "Fable / Flow" in **class 9** (software), plus **39 / 43** (travel, hospitality) once those businesses get close. CNIPA ≈ ¥270–300 per class ⚠️.
- **US:** USPTO (~$350 per class ⚠️) when budget allows.
- **Avoid plain "Fable"** as the trademarked mark: crowded name (Fable Studios Inc., Fable Hotels & Resorts, Xbox game series, Fable homeware, a book-club app).

**Phase 1 done when:** domain registered · free email working · Apple account active with agreements/tax/bank · Small Business Program applied · EU decision made (declare now, or launch without the EU).

---

## Phase 2 — Build the iOS app (weeks 1–4) 🤖 (you test on your iPhone)

The web app is wrapped as a native iOS app with **Capacitor**, using the same code.

| # | Task | Notes |
|---|---|---|
| 2.1 | Capacitor iOS project; Bundle ID e.g. **`com.<brand>.flow`** (reverse of your domain; can't be changed after the first upload) | Built in Xcode on your Mac |
| 2.2 | App icon set, launch screen, iPhone-only at first | iPad later |
| 2.3 | **StoreKit 2 purchases** | `Pro` (non-consumable), `Tip S/M/L` (consumables), **Restore Purchases** button |
| 2.4 | **Trial & free tier** | Trial start saved on device + account; after 14 days: one card + one tomato; older cards kept (never deleted) and unlocked with Pro |
| 2.5 | **Offer Codes** support | Redeem sheet for the 50 founding Pro codes |
| 2.6 | **Timer-end notification** | Local notification scheduled when a timer starts (the background-timer fix from v55 + a real lock-screen alert) |
| 2.7 | **Sign-in** | Email + Apple (+ Google internationally). Apple requires **in-app account deletion** for apps with accounts → add "Delete account & data" |
| 2.8 | **Data export** | GDPR-friendly "Export my data" (JSON / images) |
| 2.9 | **Region routing** | International ↔ China backend chosen at sign-up from the App Store country, with an option to change |
| 2.10 | **Privacy manifest** (`PrivacyInfo.xcprivacy`) | Required by Apple; declares data use and required-reason APIs |
| 2.11 | **Privacy-friendly analytics** | Retention day 1/7/14/30, trial → Pro conversion; no ad tracking (keeps "Data Not Linked to You" labels simple) |
| 2.12 | **China-specific UI** | First-launch privacy consent dialog (PIPL); filing number in About; Google sign-in hidden for China accounts |
| 2.13 | QA | Run `qa/run_qa.sh` on the web layer + a device checklist on your iPhone (purchases in the StoreKit sandbox, notifications, offline, sleep/wake) |

---

## Phase 3 — Backend (weeks 2–4)

### 3.1 International (hosted Supabase) 🤖 + 🧑 billing
1. **Phase A: stay on the free tier**:
   - **keep-alive:** a weekly automatic database check-in (GitHub Actions, free) so the project never pauses after 7 days of inactivity
   - **backups:** a weekly automatic backup (database dump to a private storage location) in place of Pro's daily backups
   - **upgrade later in one click** in the dashboard (no migration, no code change) when you reach a few hundred active users, real sales volume, or ~1 GB of photos
2. Tables:
   - `fable_flow_user_state` (existing)
   - `entitlements` (pro, trial_started_at, region)
   - `purchases` (verified App Store transactions)
3. **Verify purchases** server-side via the App Store Server API, or use **RevenueCat** (unifies Apple/Google later).
4. **Account deletion endpoint:** deletes auth user + state + photos.

### 3.2 Mainland China (self-hosted Supabase): see Phase 7
It starts once the ICP filing is underway.

---

## Phase 4 — Website & legal pages (weeks 2–3) 🤖 (you review)

| Page | URL | Required for |
|---|---|---|
| Landing page (EN/中文) | `flow.<brand-domain>` | App Store "Marketing URL", press |
| **Privacy policy** (EN + 中文, says where data is stored per region) | `/privacy` | App Store, China filing, GDPR, PIPL |
| **Terms of use** | `/terms` | Purchases, EU |
| **Support** (contact `support@<brand-domain>`, FAQ, restore purchases, delete account) | `/support` | App Store "Support URL" |
| Portfolio + brand home | `<brand-domain>` | Personal portfolio and umbrella brand |

**Hosting:**
- **International:** GitHub Pages with the custom domain + free HTTPS ($0).
- **China (Phase C):** after ICP filing, mirror the site on the mainland server, since GitHub Pages is slow or unreliable inside China.

The same domain is also your **personal portfolio**: `<brand-domain>` (portfolio + brand), with the app at `flow.<brand-domain>`.

---

## Phase 5 — Beta with TestFlight (weeks 4–6)

1. 🤖 Upload builds from Xcode; 🧑 invite **internal testers** (up to 100, no review).
2. **External TestFlight** (up to 10,000; first build needs a short beta review) for your **50 founding users**: collect feedback in a simple form.
3. Track trial → Pro behavior with sandbox purchases.
4. **Exit criteria:** no crashes; purchases, restore, trial expiry, notifications and sync work in both regions; Chinese UI fits.

---

## Phase 6 — International App Store launch (week 6–7)

### 6.1 App Store Connect setup 🧑 (🤖 prepares all text/assets)

| Item | What to enter |
|---|---|
| App record | Name "Fable / Flow" (must be unique; have a backup like "Fable / Flow: Card & Timer"), subtitle, Bundle ID, SKU |
| Localizations | **English (US)** + **Chinese (Simplified)**: name, subtitle, description, keywords, What's New |
| Screenshots | Required largest iPhone size (6.9") ⚠️; 3–6 per language; optional preview video |
| Pricing | App free; in-app purchases: Pro ~$4.99–5.99 (Apple sets regional equivalents; set ¥25–30 for China manually); Tips $1.99 / $4.99 / $9.99 |
| Availability | **All countries except mainland China and Russia** (add China in Phase 7). If you haven't declared EU trader info, the EU storefronts stay unavailable until you do. |
| App Privacy | Data types collected (email, user content), linked to user, not used for tracking |
| Age rating | Questionnaire (likely 4+) |
| Export compliance | Uses only standard HTTPS → exempt |
| App Review notes | Demo account + how to test Pro (sandbox) and the timer |
| Contact | `support@<brand-domain>`; EU trader info verified (if selling in the EU) |

### 6.2 Submit & release
1. Submit build + in-app purchases together (first-time IAPs are reviewed with the app).
2. Review typically takes 24–48 h. Fix any rejections, resubmit.
3. Use **manual release** so you control launch day; optionally **phased release** (7-day rollout).
4. After launch: generate **50 Offer Codes** for Pro and send them to the founding beta users.

---

## Phase 7 — China track (cost phase C: start once international shows traction; ~3–6 weeks)

| # | Step | Owner | Time |
|---|---|---|---|
| 7.1 | Buy a **mainland server** (Shanghai/Beijing region) at the provider holding your domain. Lean start: **Alibaba 2 vCPU/2 GB at ¥99/yr** (same price on renewal; enough for a slim Supabase, i.e. Postgres + Auth + REST, at small scale). Upgrade to 4 GB when needed. | 🧑 | day 1 |
| 7.2 | **ICP filing for `<brand-domain>`** (individual, `.com` is filable; the domain must sit at a Chinese registrar under your real name): ID, face check in the provider's app, MIIT SMS verification within 24 h, provincial review. Describe it as a personal productivity tool. | 🧑 | 1–3 weeks |
| 7.3 | Install **self-hosted Supabase** (Docker), same schema/RLS; domestic email sender (DirectMail/SES) for auth mails; daily backups to OSS/COS; HTTPS cert for `api-cn.<brand-domain>` | 🤖 (you provide server access) | 2–3 days |
| 7.4 | **App备案** for Fable / Flow: app name, Bundle ID, iOS signing public key + SHA-1, backend domain `api-cn.<brand-domain>`, no third-party SDKs that need disclosure (or list them) | 🧑 (🤖 extracts cert values) | 1–3 weeks |
| 7.5 | China privacy policy (PIPL: purposes, data stored in China, how to delete, contact); first-launch consent dialog | 🤖 | — |
| 7.6 | App Store Connect: enter the **App备案 number** for the China storefront; Chinese metadata/screenshots; China price; **add mainland China to Availability**; submit an update | 🧑 | 1–2 days review |
| 7.7 | Show the filing number in the app (About) and on the China website footer | 🤖 | — |

**Keep it filing-safe:**
- no public user posts or comments
- no regulated categories (news, education, medical, finance)
- describe the app consistently everywhere (app name = filing name = store name)

---

## Phase 8 — Launch & marketing (from launch week)

| Channel | Action |
|---|---|
| App Store featuring | Submit **"Nominate for featuring"** in App Store Connect ~2–4 weeks before a notable release |
| English | Product Hunt launch, Reddit (r/productivity, r/iosapps, r/getdisciplined), a short demo video, personal network |
| Chinese | **小红书** (aesthetic posts: card + tomato), **少数派** article/listing, 即刻; CN screenshots in Chinese |
| Shareable moments | "Share today's card" image (Forest-style organic spread); possible future feature |
| Reviews | Gentle in-app review prompt (Apple's `requestReview`) after day 7 or a completed 14-card stack; never during focus |
| Press kit | Icon, screenshots, 1-paragraph story (Fable Studio), contact email |

---

## Phase 9 — Ongoing maintenance

### Weekly
- Read App Store reviews (reply to every one in the first months) and support email.
- Check crash reports (Xcode Organizer) and sales/trial conversion.

### Monthly
- Supabase usage and backups (international); mainland server health, disk, backups, OS security updates.
- Test a **restore from backup** every quarter.
- Regional pricing sanity check; Offer Code inventory.

### Each release
1. QA gate (impacted groups) + device checklist.
2. Bump version/build; What's New in EN + 中文.
3. TestFlight → submit → manual or phased release.
4. If the backend changes: run the migration on **both** Supabase copies.

### Yearly calendar

| When | Task |
|---|---|
| Spring (≈ April) ⚠️ | Apple usually starts requiring builds with the **latest Xcode/iOS SDK**: update and resubmit before the deadline |
| WWDC (June) | Plan support for the new iOS; test betas |
| Apple membership date | **Renew $99** (auto-renew on); expiry removes the app from sale |
| Domain date | Renew `<brand-domain>`. **An expired domain breaks email, website and the ICP filing.** |
| Server date | Renew the mainland server (an expired server can lead to filing problems) |
| Supabase / iCloud+ | Monthly billing; keep the card valid |
| Any time info changes | Update **EU trader info**, **ICP filing info** (address/phone/name), tax forms, bank |
| Trademarks | Track examination; respond to office actions; renew every 10 years (China/US) |

### Rules to keep
- **ICP:** the filed site/app must stay live and match the filing; change the filing before changing the app's nature or adding user-generated content.
- **Privacy:** honor delete/export requests (in-app tools cover most); update the privacy policy when data use changes.
- **Never delete user data on expiry** (trial or region moves). It's a core brand promise.

---

## Phase 10 — Android later (summary)

| Step | International | China |
|---|---|---|
| Account | Google Play Console **$25 one-time** | Per-store accounts (Huawei, Xiaomi, OPPO, vivo, 应用宝) |
| Gate | **12+ testers in a closed test for 14 consecutive days** (new personal accounts) | **软著** (software copyright certificate, ~1–2 months) + add Android to the App备案 |
| Payments | Google Play Billing (15%) | Paid apps / IAP mostly company-only → do China Android with a company |
| Shared | Same code (Capacitor Android), same backend, same account-based Pro | Same China backend |

---

## Timeline (realistic, solo + me)

| Week | International (Phases A–B) | China (Phase C, later) |
|---|---|---|
| 0–1 | Pick brand name → `.com` domain, free email, Apple enrollment, agreements/tax/bank, EU decision | — |
| 1–4 | iOS build (Capacitor, purchases, trial, notifications, deletion, region routing ready but China off) | — |
| 2–4 | Free-tier backend + keep-alive + weekly backups; portfolio + app website & legal pages | — |
| 4–6 | TestFlight with 50 founding users | — |
| 6–7 | **International launch** | — |
| 7+ | Marketing, updates; **upgrade Supabase when traction hits** | When ready: server ¥99/yr → ICP (1–3 wks) → self-host → App备案 (1–3 wks) → **China storefront** |
| Later | Android (Google Play, $25) | China Android (company) |

## Yearly cost summary (approx.)

| Item | Phase A (launch) | Phase B (traction) | Phase C (China) |
|---|---|---|---|
| Apple Developer Program | $99 | $99 | $99 |
| `.com` brand domain | ~$10–15 | ~$10–15 | ~$10–15 (at a Chinese registrar for filing) |
| Email | $0 (Zoho / forwarding) | $0–12 | $0–12 |
| Hosted Supabase | $0 (free + keep-alive) | $300 | $300 |
| Mainland server + storage/email | — | — | ~$15–45 (¥99 server + small usage) |
| EU address (optional) | $0 (Google Voice + own address, or skip the EU) | $0–260 | $0–260 |
| **Total / year** | **≈ $110–115** | **≈ $410–690** | **≈ $425–735** |

Plus Apple's 15% of sales. One-offs when needed: Google Play $25, trademarks (CN ≈ ¥300/class, US ≈ $350/class).

---

## Your next three actions 🧑
1. **Pick the umbrella name** from the shortlist (`Brand_Name_Shortlist.md`), then register its `.com`.
2. Set up **free email** (`hello@<brand-domain>`) with Zoho Free or Cloudflare forwarding.
3. Enroll in the **Apple Developer Program**. Then I start Phase 2 (the iOS wrapper) on a new branch.
