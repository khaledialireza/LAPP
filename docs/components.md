# Shared, modular components (the rule and where each one lives)
Rule (owner): anything that exists at least twice must be one shared component. A page may place it, never copy or redefine it.
New things are built as a shared component first.

## Where they are
| File | What |
|---|---|
| `ui/kit.js` (`window.K`) | helpers `$ $$ esc LS(get set del raw setRaw keys) loc I IE events onLook`, keys (`MAC combo keyLabel`), dates (`ago time date dateTime clock`), `money size fileIcon words shuffle`, LAPP's lists (`COURSES LEVELS TOPICS TYPES flag opt`), dictionary (`dict meanings`), lessons (`lessonState lessonTone studioUrl openStudio newLesson`), API (`api apiAt`), `toast`, dialogs (`dialog ask confirm form`), `pop avatar speak drag sendFile upload sheet signOut inDesk` (`<html data-desk>`) |
| `ui/menu.js` (`K.menu`, `K.menuAt`) | the one menu: right-click, title-bar menus, taskbar, Files, Studio lines (search, sub-menus, keys, header slot, "ask the assistant") |
| `ui/kit.css` | the page reset, tokens (also `--ui-*` for l-select), `.b/.btn`, `.in`, `.k-search`, `.sw` switch, `.seg`, `.chip`, `.pl` pills, `.card`, `.opt` rows, `.kp` stat tiles, `.top` heading row, `.empty`, `.spin`, `.bar`, `.k-bars` chart, `.kbd`, `[data-tip]`, `.cols2/.cols3/.split`, `.li` (+`.kv`) list rows, `.opt.box`, `.k-nav` side lists, `.k-crumbs`, `.bar.thin`, `.pi` popover rows, toasts, dialogs, popovers, menu, avatar |
| `ui/lapp-ui.js` | `l-select`, `l-date` (every select and date field; `<option selected>` works too) |
| `ui/shell.js` | the page router for /admin and /s/… inside a window (old tab/split code removed); its toast/ask/confirm/menu are the kit's |
| `worker/src/util.js` | `fail pick str int cleanName`, lists (`LEVELS STAFF TEAM COURSES`), `enc b64 b64url sha`, `teamOf memberOf`, `aiLimit revConflict`, `blobPut blobGet`, `fileResponse uploadMeta` |
| `worker/src/index.js` · `pageHtml` | every panel page starts with `<!--LAPP:HEAD-->` (the shared head: fonts, kit, menu, language, icons, theme, pointer, l-select, window bridge) and uses `?v={{V}}`; `tools/bump.js` sets the one version `ASSET_V` |

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

## Audit 2 (deeper check of the whole system) — all done
| # | Thing | Was copied in | Now |
|---|---|---|---|
| 36 | Page head (fonts + 8 shared scripts, each with its own ?v=) | admin · school · studio · files · settings · manage (admin and school had no icons) | server `<!--LAPP:HEAD-->` + one `ASSET_V` |
| 37 | Page reset (`*`, `[hidden]`, buttons, focus ring, links) | 6 pages + desk.css | kit.css |
| 38 | LAPP's lists: courses, flags, levels, topics, lesson types | studio · school · admin · drive · app (client); lessons.js · school.js (server) | `K.COURSES…` · util `COURSES LEVELS` |
| 39 | "New lesson" form | admin (static dialog) · school · studio | `K.newLesson` |
| 40 | Opening a lesson in the studio | admin · school · drive ×4 · files | `K.openStudio` (a desktop window) |
| 41 | Course dictionary loading | studio · studio-menu | `K.dict`, `K.meanings` |
| 42 | Splitting a text into words | studio · studio-lesson · exercises | `K.words` (any language) |
| 43 | m:ss clock, shuffling | app · studio · exercises | `K.clock`, `K.shuffle` |
| 44 | Stop-word lists | app · exercises | `Practice.filler` |
| 45 | localStorage wrappers | app · i18n · account · auth · course · content · cursor · theme · frame · panel-i18n · studio · studio-menu · studio-lesson · settings | `K.LS` (the pointer setting was read wrongly: fixed) |
| 46 | Event channels | auth · account · desk core | `K.events` |
| 47 | "The look changed" listeners | theme · cursor · settings · studio-menu | `K.onLook` |
| 48 | Reading a key combination | desk core · frame | `K.combo` |
| 49 | Learner sheets | account · course | `K.sheet` |
| 50 | Sign out | desk · school ×2 | `K.signOut` |
| 51 | Student account menu | school (own dropdown) | `K.menuAt` |
| 52 | Status / role pills left over | drive `.t-*`/`.dv-chip.*` · admin `.r-*` · studio `.st-*` | `.pl` tones, `K.lessonTone` |
| 53 | Layout grids | admin `.two` · school `.g2/.g3` · studio `.cast/.board` · studio-lesson `.g2/.g3` | `.split`, `.cols2`, `.cols3` |
| 54 | List rows / key–value rows / toggle rows | admin `.list .r` `.tg` · school `.r` · studio-lesson `.kv` `.tg` | `.li`, `.li.kv`, `.opt`, `.opt.box` |
| 55 | Side section lists | settings `nav` · studio-lesson `.la nav` | `.k-nav` |
| 56 | Breadcrumbs / back links | files `.crumbs` · drive `.dv-crumb` · school `.crumb` · studio `.crumb` | `.k-crumbs` (frame.js turns a single back link into the window's back button) |
| 57 | Progress bars | desk `.bar` · studio-lesson `.bar2` | `.bar`, `.bar.thin` |
| 58 | Heading row | drive `.dv-top` | `.top` |
| 59 | Messages to a window | desk windows · system | `D.post` |
| 60 | Dead code | admin + school staff sidebars, studio rail, school's old lessons list, desk's ⓘ text | removed |
| 61 | Server: error, pick, hashing, team check (one copy missed "school disabled"), member check, file download (two safe-type lists), upload name header (X-Name vs X-File-Name; school names kept slashes) | index · ai · lessons · school · desk | `util.js` |

## Not merged — the owner decides (two features that do the same job)
- **Two lesson explorers**: the *Lesson library* (drive.js inside admin/school: folders with rules, map, board, AI ideas) and the *Files* app (lessons + files). Files was meant to replace "Content".
- **Two curriculum maps**: the studio's home (topic × level with gaps) and the library's Map view.
- **Two people managers**: admin *Users* (LAPP accounts) and the school's *People* (members) — different data, same screens.
- The learner app (style.css) keeps its own look by design; it shares the kit's behaviour (storage, toasts, api, sheets, words, voice).
