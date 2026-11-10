# Next work (agreed in chat, build when asked)

## PRIORITY ORDER (proposed, owner to confirm)
1. Bugs now: windows open too small + mobile layout inside windows; one state-coloured window border.
2. Everything from the mockups that is missing (docs/missing.md): full Apps list, studio right-click + word card, Lesson app (translations & their settings), Cast/Characters app, Settings app (+ system-wide theme), Guide/ⓘ.
3. Platform core + admin.khaledi.eu / app.khaledi.eu (same panel, host decides apps & security).
4. AI that really acts (create user, open calendar…) with confirmation + voice input.
5. Accounting as a standalone app.
6. Calendar (+ Google Calendar), messages, mail, friends.
7. Studio project files saved locally/Drive, publish to us; Google Drive & Keep.
8. Screens app: classroom board (same laptop / smart TV via code + WebRTC), clinic queue, rate boards.
9. Desktop extras (groups, Alt+Tab, focus mode…), AI settings v2.
10. Later: CRM, clinic; held ideas: 2 sentences a day, creator marketplace.

## Accounting: a standalone, general system (replaces "school finance double-entry")
- Not only for schools: LAPP's owner uses it for their own finances too.
- Its own module/app on this platform (own window in /manage), not part of the school pages.
- Any "book" owner: a person, LAPP itself, a school. Schools are just one kind of user.
- Built so it can later be sold as an independent accounting product (owner has a plan for that).

## AI must act, not just give directions
- Today it only answers and can open/arrange windows. It must do real work, e.g. "create a new user", "open the calendar".
- Give it real actions (tools) for each part: users, schools, classes, lessons, finance…, always with a plan + "Do it" confirmation and the person's own permissions.
- If the asked page doesn't exist yet (e.g. calendar), it should say so clearly.

## Voice input for the AI
- Talk instead of typing: a mic button in the command center / AI chat, plus a hold-to-talk key.

## System-wide theme and colours in Settings
- A theme/colour setting in Settings that changes the whole system: desktop, every window (admin, school, studio) and menus.
- e.g. dark/light, accent colour, ready-made themes; saved with the account.

## Window frame looks doubled/square
- Now: a grey border + a separate 1px coloured ring (box-shadow) + a 2px coloured line on top of the title bar → looks like an extra square frame.
- Fix: one border only. Active window: the border itself takes the place colour (LAPP/school/studio); inactive: soft grey. Drop the extra ring and top line; keep rounded corners.
- Agreed: merge the three into ONE border that changes colour by the moment and the work in the window:
  - normal: the place colour (LAPP / school / studio), dim when the window isn't active;
  - AI working in it: moving LAPP gradient; background job (audio): soft pulse;
  - unsaved changes: amber; error: red; just saved / done: short green flash; recording (voice): pink.
  - Pages send their state up with postMessage {lapp:1, t:"state", state:"busy|dirty|error|ok|rec"}.

## Connect Google Drive, Calendar and Keep
- Each person can connect their own Google account (OAuth, per user, revocable; tokens kept server-side only).
- Drive: keep files on their own Drive, or work with them inside LAPP (open, preview, attach, put on the desktop) without copying to our storage.
- Calendar: show/sync their Google Calendar in our calendar (Phase 4) and the Today/Week widgets.
- Keep: their notes in LAPP (note widget, AI). Note: Google Keep's API is limited (mainly Workspace accounts) — check before promising.

## Studio project file format (save locally, publish to us)
- A LAPP lesson file (e.g. `.lapp`: one zip with JSON script + scenes + characters + media/audio) that holds a whole studio project.
- Drafts / half-done edits live on the person's own computer or their own Drive, not on our servers.
- Only when they PUBLISH does the lesson go to our system. Reason: teachers may make many half-done drafts; storing all of them would need huge space.
- Studio: Open file / Save / Save as, autosave to the local file (File System Access API where available, else download/upload), open from Drive.
- Our server keeps published lessons (+ maybe a small recent-draft cache with a limit).

## Windows open too small and pages inside look like mobile (bug)
- Why: pages in a window (iframe) decide their layout by the WINDOW's width, not the screen's. A new window is 66% of the desktop (max 1100px); on a laptop that's ~850–950px, which hits the pages' "small screen" rules (shell ≤1100px, school ≤1000px) → compact/mobile-like layout.
- Fix:
  - New windows open big: ~90% of the desktop (or maximised when the screen is < 1440px wide; first window always maximised). Remember the last size per app.
  - Inside windows (embed mode) use the desktop layout down to ~700px; only real phones (< 600px) get the mobile layout. Move the pages from screen media queries to container queries / embed-aware breakpoints.

## Platform vision: standalone admin at admin.khaledi.eu (agreed direction, critical)
- The system becomes a business platform; each business type gets its own apps (windows):
  language school (school, calendar, finance) · content creator (studio, media) · exchange office (accounting) · company (CRM) · doctor (practice + patients) · platform owner (packages, servers, users).
- LAPP (learning) = one product/app set on the platform; lapp.khaledi.eu stays the learner site.
- Layers: CORE (accounts, tenants/organisations, roles, app catalog, plans & billing, files, AI, notifications, desktop) + APPS (school, studio, accounting, CRM, clinic…). A tenant only sees the apps its plan includes.
- admin.khaledi.eu = owner console: tenants, plans/packages, app catalog & feature flags, users, servers/usage/costs (AI, storage), billing, logs/audit, support access (logged), system health.
- Customer workspace: the /manage desktop on its own host (e.g. app.khaledi.eu or <tenant>.khaledi.eu, later custom domains).
- Admin security: host-only cookie for admin, mandatory 2FA/passkey, Cloudflare Access/IP allowlist, own session, full audit log, never embeddable.
- Data: one D1 core now; later a database per tenant for isolation. Clinic = health data (GDPR special category) and exchange = financial rules (KYC/AML) → extra compliance before selling.
- Order proposed: 1) core split (tenants, app catalog, plans) 2) admin.khaledi.eu console 3) school + studio as apps 4) accounting (first general app) 5) CRM 6) clinic last.
- UPDATE (agreed): admin.khaledi.eu and app.khaledi.eu are the SAME panel (one codebase, the same /manage desktop, windows, command center, AI).
  The host only changes context and rules: on admin.* the platform-owner apps (tenants, plans, app catalog, servers, users, audit) appear and stricter security applies (2FA, Access/IP, own host-only cookie); on app.* the tenant's apps appear. Not two systems.

## Classroom TV board over local Wi-Fi
- Teacher shows class content on the classroom TV as a digital board they control; control traffic should go over the school Wi-Fi, not our server.
- Plan: TV opens a LAPP "board" page (smart-TV browser / stick / any PC) and shows a short code (+QR). Teacher types the code in a "Show on screen" window.
  Pairing (a few KB) goes through our server once; then WebRTC connects the two devices DIRECTLY over the LAN (data channel for board commands/strokes, optional screen/window stream). Keeps working if the internet drops after pairing.
- Fully server-free discovery isn't possible in a normal browser (no LAN scan). Options for that: QR-only pairing (offline, clunkier) or a native TV app (Android TV) with local discovery — later.
- Board features: show slide/lesson/line, pen & highlighter, timer, student answers, multiple screens, teacher phone as remote.
- Reuses today's live class board (Durable Object) as fallback when direct connection fails (TURN-free LAN, server relay fallback).
- UPDATE (agreed): no native app. Two modes:
  1. Same laptop on the TV (HDMI/cable or screen share): teacher opens "Board mode" in a second browser window on the TV screen. The two windows talk inside the laptop (BroadcastChannel) — no network, no Wi-Fi needed. Window Management API (where supported) can put it full-screen on the second screen in one click.
  2. Smart TV: open the board page, enter/scan the code → server approves → WebRTC direct to the TV over the LAN, server only for pairing; relay fallback.
- Make it a CORE "Screens / Display" app for every business, not just schools: classroom board · clinic queue numbers ("now serving") · exchange-office rate board · company lobby/KPI dashboards. Paired screens are managed per organisation (name, room, what it shows, revoke).
