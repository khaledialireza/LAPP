# Duplicates to unify into shared, modular components (audit of the whole system)
Rule (owner): anything that exists at least twice must be one shared component.
Found by checking ui/*.js, ui/desk/*.js, worker/src/*.html, app.js, account.js and the worker's .js files.

## Front end — behaviour (one file each in ui/, loaded by every page)
| # | Thing | Copies now in |
|---|---|---|
| 1 | Context menu (search, sub-menus, keys, icons, "ask the assistant", header slot like the word card) | desk/core.js · files.html · studio-menu.js |
| 2 | Dialogs: confirm / ask a name / form | shell.js · desk/core.js · files.html · admin · school · studio (form) · drive.js |
| 3 | Toasts | shell.js · desk/core.js · admin · school · studio · files · app.js · account.js |
| 4 | API call (fetch + X-LAPP + errors + 401) | desk/core.js · admin · school · studio · files · account.js |
| 5 | Small helpers $, $$, esc, LS (localStorage) | 8–13 files |
| 6 | Time and date: "5 min ago", times, dates, money | shell · desk · admin · school · files · lapp-ui · app · account |
| 7 | File helpers: kind→icon, size, upload with drag & drop | desk/desktop.js · files.html |
| 8 | Speak a line (browser voice with speed/pitch/feeling) | studio.html · studio-menu.js · app.js |
| 9 | Drag to move / resize | windows · command center · desktop · shell · school |
| 10 | "Opened alone → go to /manage" | studio · files · settings · shell.js |
| 11 | Popovers (above a button) | desk/core.js (pop) · taskbar previews · shell |
| 12 | Avatar (photo or initial) | desk/lock.js · admin · settings · manage |

## Front end — look (one stylesheet ui/kit.css + the theme tokens)
| # | Thing | Copies now in |
|---|---|---|
| 13 | Colour tokens (:root --bg, --p1 …) | desk.css · admin · school · studio · files · settings · shell |
| 14 | Buttons (.b / .btn, primary, danger, small) | admin · school · studio · files · settings · desk.css |
| 15 | Switch (on/off) | admin · school · settings |
| 16 | Segmented control (List/Grid, A/B/C…) | admin · files · settings · studio-lesson · desk (title bar) |
| 17 | Chips / tags / status badges | admin · school · studio · files |
| 18 | Cards / sections / rows (key → value) | admin · school · settings · studio-lesson |
| 19 | Empty states | admin · school · studio · files · desk |
| 20 | Search field | shell · studio-menu · files · command center |
| 21 | Spinner, progress bar | studio · school · studio-lesson · desk |
| 22 | Key caps (kbd) | shell · studio-menu · desk |
| 23 | Select (l-select) and inputs | lapp-ui.js (exists) — used by some pages, plain <select> in others |
| 24 | Pop-in animation, tooltips | desk.css · studio-menu · studio (data-tip) |

## Server
| # | Thing | Copies now in |
|---|---|---|
| 25 | str / int clean-up helpers | lessons.js · school.js (+ inline in index.js, desk.js) |
| 26 | Daily AI limit | index.js (assist, assist/groups) · lessons.js (limitAi) |
| 27 | "Pages of the work desktop" (/manage, /files, /settings: signed in + works here) | index.js ×3 |
| 28 | Name clean-up (files, folders) | desk.js ×4 |
| 29 | Blob storage in parts (save / read / delete) | desk.js · lessons.js · school.js |
| 30 | "Someone else changed this" (rev check) | lessons.js ×4 |

## Plan
1. ui/kit.js — helpers (5), API (4), toasts (3), dialogs (2), time/date/money (6), popover (11), avatar (12), speak (8), drag (9), standalone redirect (10), file helpers (7).
2. ui/menu.js — the one context menu (1).
3. ui/kit.css — tokens from theme.js + buttons, switch, segmented, chips, cards, empty, search, spinner, progress, kbd, animations, tooltips (13–24).
4. Every page and the desktop use them; their own copies are deleted.
5. worker/src/util.js — 25–30 for the server.
