# Next work (agreed in chat, build when asked)

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
