# Shared, modular components (the rule and where each one lives)
Rule (owner): anything that exists at least twice must be one shared component. A page may place it, never copy or redefine it.
New things are built as a shared component first.

## Where they are
| File | What |
|---|---|
| `ui/kit.js` (`window.K`) | helpers `$ $$ esc LS loc I IE`, keys (`MAC`, `keyLabel`), dates (`ago time date dateTime`), `money`, `size`, `fileIcon`, `lessonState`, API (`api`, `apiAt(base, {next, signin, keepalive})`), `toast`, dialogs (`dialog ask confirm form`), `pop`, `avatar`, `speak`, `drag`, `upload`, `inDesk` |
| `ui/menu.js` (`K.menu`, `K.menuAt`) | the one menu: right-click, title-bar menus, taskbar, Files, Studio lines (search, sub-menus, keys, header slot, "ask the assistant") |
| `ui/kit.css` | tokens (also `--ui-*` for l-select), `.b/.btn`, `.in`, `.k-search`, `.sw` switch, `.seg`, `.chip`, `.pl` pills, `.card`, `.opt` rows, `.kp` stat tiles, `.top` heading row, `.empty`, `.spin`, `.bar`, `.k-bars` chart, `.kbd`, `[data-tip]`, `.cols2/.cols3`, `.pi` list rows, toasts, dialogs, popovers, menu, avatar |
| `ui/lapp-ui.js` | `l-select`, `l-date` (every select and date field; `<option selected>` works too) |
| `ui/shell.js` | the page router for /admin and /s/… inside a window (old tab/split code removed); its toast/ask/confirm/menu are the kit's |
| `worker/src/util.js` | `str int cleanName aiLimit revConflict blobPut blobGet` |

## The audit (all done)
| # | Thing | Was copied in | Now |
|---|---|---|---|
| 1 | Context menu | desk core · files · studio-menu · shell | `K.menu` |
| 2 | Dialogs confirm / ask / form | shell · desk · files · admin · school · studio · drive · browser `confirm()/prompt()` in studio | `K.dialog/ask/confirm/form` (admin's typed delete uses `K.confirm({type})`) |
| 3 | Toasts | shell · desk · admin · school · studio · files · app.js · account.js | `K.toast` (learner app: `{plain}` in its own skin in style.css) |
| 4 | API call | desk · admin · school · studio · files · settings · account.js | `K.api` / `K.apiAt` |
| 5 | `$ $$ esc LS` | 13 files | `K` |
| 6 | Time, date, money | desk · admin · school · files · lapp-ui | `K.ago/time/date/money/loc` |
| 7 | File kind, size, upload | desktop · files | `K.fileIcon/size/upload` |
| 8 | Speak (browser voice) | studio ×3 · studio-menu · app.js | `K.speak` |
| 9 | Drag to move / resize | windows · command center · desktop | `K.drag` |
| 10 | Opened alone → /manage | studio · files · settings · shell | `K.inDesk` |
| 11 | Popovers | desk · shell · system (info) | `K.pop` |
| 12 | Avatar | lock · taskbar · admin · settings | `K.avatar` |
| 13 | Colour tokens | desk.css · admin · school · studio · files · settings | kit.css `:root` |
| 14 | Buttons | 6 places, 4 heights | `.b/.btn` (one height 32, `.sm` 28) |
| 15 | Switch | admin · settings (school's colour dots are now `.swatch`) | `.sw` (desk resize corner renamed `.rz.bl`) |
| 16 | Segmented control | admin · settings · files · studio-lesson (`.seg2`) · desk title bar (`.wseg`) · drive (`.dv-seg`) | `.seg` (`.fill`, `.sm`) |
| 17 | Chips, pills, status badges | admin `.pl/.p-*` · school `.pl/*-p` · studio/files/admin `.st` | `.chip`, `.pl` + tones, `K.lessonState` |
| 18 | Cards and rows | admin · school · settings (`.row`) | `.card`, `.card.rows` + `.opt` |
| 19 | Empty states | admin · school · studio · files · desk | `.empty` (`.tight`) |
| 20 | Search field | admin `.srch` · files `.find` · menus | `.k-search` (menus use the menu's own) |
| 21 | Spinner, progress bar | studio · school · desk | `.spin`, `.bar` |
| 22 | Key caps | desk · studio-menu | `.kbd`, menu `kbd` |
| 23 | Selects | plain `<select>` in admin (AI), drive (rules), studio-lesson (due) | `l-select` |
| 24 | Pop animation, tooltips | desk · studio · studio-menu | `k-pop`, `[data-tip]` (`data-tip-side="end"`) |
| 25 | str / int | lessons · school · ai | `util.js` |
| 26 | Daily AI limit | index ×2 · lessons | `aiLimit` |
| 27 | Work-desktop pages | index ×3 | `deskPage` + `DESK_PAGES` (index.js) |
| 28 | Name clean-up | desk ×4 | `cleanName` |
| 29 | Blob parts | desk · lessons | `blobPut / blobGet` |
| 30 | "Someone else changed this" | lessons ×4 | `revConflict` |
| 31 | Stat tiles | admin · school · studio (`.kpis/.kp`) | `.kp` |
| 32 | Bar chart | admin `.bars` · studio `.spark2` | `.k-bars` |
| 33 | Page heading row | admin · school | `.top` |
| 34 | Dialog spacing | admin · school (flex gap) · studio (margins) | one rhythm in kit.css |
| 35 | Window "Actions" | admin/school ⌘K commands (dead inside windows) | `commands` → the title bar's Actions menu |

Tests: scratchpad k1–k5 (desktop, admin, school, files, settings, drag, server) plus the studio tests — all pass.
