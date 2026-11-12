# Next work (agreed in chat, build when asked)
Rule: only items the owner approved are recorded as agreed; anything else is marked [PROPOSAL, NOT CONFIRMED].

## PRIORITY ORDER v2 (approved; building steps 1+2 now)
DONE (approved): the whole system is modular — every part that exists twice becomes one shared component (full list and plan: docs/components.md: ui/kit.js, ui/menu.js, ui/kit.css, worker/src/util.js; every page switches to them and its own copies are deleted). Rule from now on: anything new is built as a shared component first.
Then: the forgotten sections 4 (voice desk — DONE) and 5 (cast — next, only with the owner's OK), see docs/missing.md.
Voice desk setup (owner, when wanted): Azure voices need the secrets AZURE_SPEECH_KEY + AZURE_SPEECH_REGION in GitHub and AZURE_TTS=1 on the Worker; Chatterbox installs itself on the first job that uses it (slow the first time, then cached).

Steps 1+2 (approved to build), split into parts in this order:
 1a. Foundation: modular window/app components; standard window (title bar = name + menus + app buttons, no inner top bar); device detection → desktop layout inside windows; one state-coloured border; no place tag; own SVG icon layer.
 1b. Taskbar: dock (pinned + running), counts, state on icons, live previews, workspaces per organisation, AI-chosen grouping (task groups / work type / file).
 1c. Command center: fixed height, visual scope buttons, calm empty state, AI chat inside with the box at the bottom, one action panel; notifications & running as taskbar popovers.
 1d. Files app (Content → Files) + the smart lesson parts move to the Studio library.
 2.  Everything missing from the mockups (docs/missing.md): all apps, studio right-click + word card, Lesson app with translations & settings, Cast app, Settings app + system theme, Guide/ⓘ.
Then:
 3. Platform core + admin.khaledi.eu / app.khaledi.eu (one panel).
 4. AI that really acts + voice input.
 5. Accounting (standalone).
 6. Calendar (+ Google Calendar), messages, mail, friends.
 7. Studio project files on the user's computer/Drive (publish to us); Drive/OneDrive/Keep in Files.
 8. Screens app (class board, clinic queue, rate boards).
 9. Desktop extras, AI settings v2.
 10. Later: CRM, clinic; held: 2 sentences a day, creator marketplace.

### Added to steps 1+2 (agreed)
- No in-page top bar inside windows: the window title bar already has the app name. Remove the big page heading/top bar in embed mode.
- The page's buttons move into the title bar (compact, tidy): e.g. Users → Export · New school · + Add user; Script → EN/FA/RU/UK · ⚙ · Rewrite all · Listen · Approve all; Content → Files/Map/Board · New folder · + New lesson.
- A menu bar in the title bar, left, right after the title (File / Edit / View / … per app): every option, action and setting of the app lives there; not everything must be on screen.
- Place tag (agreed, final): no tag normally. Show the organisation's name as a tag ONLY when the same app is open for two organisations at the same time.
- Taskbar: stop grouping by app category ("LAPP", "Studio · …", "Files") — it's one system. Instead WORKSPACES per organisation (like virtual desktops): e.g. "My work / LAPP", "Sprachschule Berlin", "School B". Each workspace has its own windows, desktop layout and taskbar; a small workspace switcher on the taskbar (and a key) moves between them. Studio windows belong to the workspace whose lesson it is.
- Taskbar made useful (agreed proposal):
  - Pinned apps + running windows in ONE row of icons (like a dock): pin your favourite apps; a running app gets a dot under it; the active one a longer bar. Click a pinned app = open it; click a running one = bring/minimise.
  - Several windows of the same app (e.g. 3 lessons in Script) = one icon with a count; click → a small list with live previews to pick one.
  - The icon shows the window's STATE (same colours as the window border): unsaved dot (amber), AI working (gradient ring), audio being made (progress ring), error (red dot), done (green flash). You see what needs you without opening anything.
  - Hover: live preview + quick actions (close, left/right half). Drag to reorder, middle-click to close.
  - Workspace switcher appears only when the person has more than one organisation.
  - Grouping (approved): several ways — task groups (below), by type of work, or by open file/project — and the AI decides the best grouping automatically (the person can still change it). Task groups, approved as one of the options: "task groups" (like saved projects). The person (or the AI, as a suggestion) puts windows that belong to one job together, e.g. "Ein Bier, bitte!" = Script + Voice desk + Video, or "Month-end" = Journal + Bank + Reports.
    - A group is one capsule on the taskbar with its name and colour; click = bring the whole group back in its saved layout (snap positions); minimise/close the group in one go.
    - Saved with the account: reopen a group tomorrow exactly as it was. Drag a window onto a capsule to add it; drag out to remove.
    - Auto-suggest: windows of the same lesson (or same customer/case later) are offered as a group ("Group these 3?"), never forced.
  - Example "Students of School A and School B at once": normally each school is its own workspace (switch with the switcher). To compare side by side, open School B's Students in the current workspace (or drag its window across): both windows then show the org tag ("Students · School A" / "Students · School B") and the org's colour on the border; on the taskbar it's one Students icon with "2", and its list shows each window with the school name and colour dot.
- One standard window structure for every app (title bar, menus, toolbar actions, status, body). A change to "windows" applies to all windows.
- Modular, component-based: a shared window/app component library (title bar, menus, buttons, dialogs, lists, toasts) and each app as its own module that declares its menus/actions/title — not hard-coded in one heavy file. Pages post their menus/actions to the host (postMessage) until they become native modules.
- Content → becomes a core "Files" app (like Finder/Explorer) for the whole system — APPROVED, IMPORTANT AND REQUIRED:
  - One file system for every app: folders, list/grid/columns views, preview, search, tags, drag & drop, rename, move, bin, sharing & permissions, recent, favourites.
  - Storage providers behind it: LAPP storage, the desktop, later Google Drive, OneDrive, Dropbox… shown and managed inside, the same way.
  - Every app reads/writes files through it (open/save dialogs are the same everywhere). Lessons are files of the studio project type: double-click opens the studio.
  - The smart lesson parts (curriculum map, board, AI ideas, level/approval rules, new lesson) move to the Studio as its "Library / Curriculum" view.
  - Generic folder permissions stay in Files; lesson-only rules (level, approved before publish) live in the Studio.
  - Everything the Studio makes is a file in Files: lesson (project file), character/identity, voice, audio track, video, slides, grammar sheet, dictionary, homework/practice set… each with its own type, icon, preview and "open with Studio". Publishing marks/copies the file into LAPP; drafts can live on the user's own drive.
- Command center: cleaner (approved):
  - No row of 8 tabs. Empty state = only: Suggested (max 2) · Recent (apps, lessons, files mixed, ~6 one-line rows) · a single row of pinned app icons. Hide empty sections ("Nothing new" never shown).
  - It is the brain of the system: calm, fast, useful. Typing searches everything.
  - Visual scope, not syntax: 4–5 small icon buttons inside the search bar (All · Apps · Files/Lessons · People · ✦ AI) with tooltips; picking one shows it as a token in the field ("Files ×"). Prefixes (> # @ ?) stay only as a hidden shortcut for power users, never required.
  - AI chat is not a tab: Tab/↵ on "Ask the AI" turns the panel into the chat; Esc goes back.
  - Fixed panel height (e.g. min(560px, 70vh)) in every mode: the panel never grows with content; the list/chat scrolls inside. Chat mode: messages scroll, the question box is pinned at the bottom like a chat app, newest message in view.
  - Bugs seen: header shows "LAPP AI · LAPP AI" (provider name repeated); for "calendar" the AI offered Dashboard — it must say the calendar doesn't exist yet (until it does).
  - Notifications and running work leave the panel: bell / spinner on the taskbar open their own small popovers.
  - One-line rows (title + muted place on the same line), narrower panel (~560px), smaller paddings.
  - Lesson rows lose the 3 buttons: ↵ opens the script; → (or hover) opens an action panel (Script, Voice, Insights, pin, share, ask AI) — the same action panel for every item type.
  - Footer: only "↵ open · → actions · Tab ask AI"; settings and shortcuts go to the avatar menu / a small ⚙ in the search bar.

## Two kinds of users: roots and their members (approved 2026-11-12; replaces the three groups below)
- A root user owns an independent space: a company (like LAPP), a school, a clinic, or one person on their own.
- A member works under one root. The root creates and manages its members in its own Users app.
- A root sees only its own members. The platform owner is just one more root.
- The root defines what it is, in its profile, by itself: the system suggests no type, no roles and no apps.
- App store: every app lives in one store. The root installs the apps it needs and decides which of its members
  (or roles it made) may use each one. Users, Files, Settings and the App Store are always there.
- LAPP is one root that installed the language studio apps.
- Open: does a member account belong to exactly one root (someone working for two roots has two accounts, opened
  side by side as linked accounts)?

## The platform gets its own name: KX5 (approved 2026-11-12, temporary)
- The management system is no longer "LAPP": it is a standalone platform (an OS for organisations). Its temporary
  name is KX5 (short for KixVix); the domain for now is kixvix.com (we already own it). Candidates for the final
  name: KixVix, Askr (Old Norse: the ash tree, the first man; domain idea askros.app). The name may change later, so it must live in one setting,
  never hard-coded.
- LAPP becomes one organisation on the platform (a language-learning company) with its own apps
  (Lesson library, Studio, Characters, the learner site at lapp.khaledi.eu) — not part of the platform's admin.
- [PROPOSAL, NOT CONFIRMED] Three layers: platform core (accounts, organisations, roles, desk, generic apps) →
  platform owner (an organisation with only platform apps: organisations by name/ID, alerts, support access,
  plan catalogue) → organisations (LAPP, schools, companies, clinics), each with installable app modules.

## Privacy: nobody sees other people's data, not even the root (approved 2026-11-11)
- LAPP itself is one organisation like any other; its admins see only their own organisation (the LAPP team).
- Of every other person or organisation we see only the name and its unique 10-character ID.
- Support access only with consent: the person gives their ID → support sends a request (e-mail, in-app; SMS when
  they turned on 2-step sign-in) → they approve → support can see all their data and logs to fix the problem.
  For an organisation its admin approves. [PROPOSAL, NOT CONFIRMED: access lasts 24 h, can be withdrawn any time,
  and every support action shows in the person's own history.]
- Phone number: only for 2-step sign-in, optional, set by the person in their profile.
- Abuse: we may suspend an account without consent, but still never see its data. We act on alerts built from
  reports and system signals (e.g. one account signed in from different countries at the same time → VPN or a
  break-in → alert → suspend).
- Invoices are shown inside the system, to the person in their own account; we keep no e-mail for them.
- Plans and subscriptions are not accounting: a simple subscriptions app tracks packages, plans and simple money
  actions. Accounting is a separate app one installs; it connects to the data it needs.

## Users app: people, roles and permissions only (approved 2026-11-11; its three groups are replaced by roots and members)
- Nothing about money in it: plans, subscriptions, invoices and payments live in the finance app.
- It works by context: in the LAPP workspace it manages the platform; inside an organisation, that organisation's people.
- Three groups, at most 3 levels, shown as a tree beside the list:
  1. LAPP team → roles (Admin, Manager, Designer, and new roles you make)
  2. Individuals → by use (learners now; independent tutors/creators later) + custom groups (e.g. beta testers)
  3. Organisations → type (language school, company, clinic, …) → each organisation → its roles
- Roles are not fixed: each organisation type has a template of roles; an organisation can add roles and change what each role may do.
- Statuses (active, invited, unverified, disabled) are filters, not groups.
- Technical: org roles are hard-coded today (admin, teacher, finance, student); they need a roles/permissions table.
- Linked accounts (built): one person signs in to several of their own accounts; windows grouped per account.

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
- A studio project file that holds a whole project (script, scenes, characters, media/audio). The file extension/name is decided LATER by the owner — don't pick one yet.
- Drafts / half-done edits live on the person's own computer or their own Drive, not on our servers.
- Only when they PUBLISH does the lesson go to our system. Reason: teachers may make many half-done drafts; storing all of them would need huge space.
- Studio: Open file / Save / Save as, autosave to the local file (File System Access API where available, else download/upload), open from Drive.
- Our server keeps published lessons (+ maybe a small recent-draft cache with a limit).

## Windows open too small and pages inside look like mobile (bug)
- Why: pages in a window (iframe) decide their layout by the WINDOW's width, not the screen's. A new window is 66% of the desktop (max 1100px); on a laptop that's ~850–950px, which hits the pages' "small screen" rules (shell ≤1100px, school ≤1000px) → compact/mobile-like layout.
- Fix (approved): do NOT just make windows bigger. The system detects the DEVICE (desktop vs phone/tablet: pointer type, screen size, the host's mode) — not the window's width — and every app inside a window opens in its desktop layout sized to the window. The host tells the page "desktop" (e.g. ?embed=1&device=desktop / postMessage); pages use that plus container queries instead of screen-width media queries. Only a real phone gets the mobile layout.

## Platform vision: standalone admin at admin.khaledi.eu (agreed direction, critical)
- The system becomes a business platform; each business type gets its own apps (windows):
  language school (school, calendar, finance) · content creator (studio, media) · exchange office (accounting) · company (CRM) · doctor (practice + patients) · platform owner (packages, servers, users).
- LAPP (learning) = one product/app set on the platform; lapp.khaledi.eu stays the learner site.
- Layers: CORE (accounts, tenants/organisations, roles, app catalog, plans & billing, files, AI, notifications, desktop) + APPS (school, studio, accounting, CRM, clinic…). A tenant only sees the apps its plan includes.
- admin.khaledi.eu = owner console: tenants, plans/packages, app catalog & feature flags, users, servers/usage/costs (AI, storage), billing, logs/audit, support access (logged), system health.
- Customer workspace: the /manage desktop on its own host (e.g. app.khaledi.eu or <tenant>.khaledi.eu, later custom domains).
- Admin security: host-only cookie for admin, mandatory 2FA/passkey, Cloudflare Access/IP allowlist, own session, full audit log, never embeddable.
- Data: one D1 core now; later a database per tenant for isolation. Clinic = health data (GDPR special category) and exchange = financial rules (KYC/AML) → extra compliance before selling.
- Order (approved): 1) core split (tenants, app catalog, plans) 2) admin.khaledi.eu console 3) school + studio as apps 4) accounting (first general app) 5) CRM 6) clinic last.
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

## Icons: own SVG set, no emoji/system icons (agreed)
- Replace emoji/system icons everywhere (taskbar, windows, menus, command center, apps, files, desktop) with one consistent SVG icon set.
- Don't depend on one source (approved): our own icon layer (icon names → SVG) that can take icons from several open sets (Lucide ISC, Phosphor MIT, Tabler MIT…) and our own drawings; swapping a set changes nothing in the apps. Bundled locally as one SVG sprite (ui/icons.svg) + a small icon() helper/component; no CDN. Keep the licence file.
- App icons: the same stroke icons on a coloured LAPP-gradient tile, so apps look like one family. Flags for courses stay as small SVG flags.
