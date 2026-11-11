# Still missing from the mockups (checked again after the work desktop v2)
Source: lapp-desk / lapp-blueprint / studio-v3 mockups and their notes. Done items are removed.

## Desktop
- LAPP menu: lock the screen (and sign out there); avatar upload in Settings.
- Red count on dock icons for waiting work (now only a state dot).
- Help menu in each app's menus (the Guide exists; the ⓘ button was removed on purpose).

## Studio · Script
- Word card tools: bold / italic / underline, colour, highlight, font; "Save to the lesson dictionary", "Correct", "Target word".
- Right-click: Format group (bold, italic, colour, highlight, font, clear) and Voice per line: feeling, pause after, pitch, "Render this line".
- Paste your own text or story → the AI finds the characters, assigns voices and splits scenes, without changing your text.

## Studio · Lesson app
- Goals with target words and grammar.
- Homework inside the lesson: quiz, spoken, written, with a deadline like "3 days after class" (now only on/off switches, nothing is generated).
- Access per lesson stricter than its folder's rule.
- History: every change (also the assistant's) logged and reversible.

## Studio · Voice desk (what is still open after section 4)
- Volume curve (points along a clip); now each clip has a volume, fades and ducking.
- Mix versions: keep earlier mixes and compare them (every line keeps its takes already).
- Word timing is estimated from word lengths; real alignment (forced alignment) later.

## Studio · Cast
- One voice per language (de / nl / pl) for each character; "AI" tag on characters the AI made; personality shapes how they speak (check what exists).

## Apps not built yet
- Grammar (the lesson's grammar sheet), Lesson dictionary, Slides from a page, Video (formats, look, own video).
- AI settings v2: routes (who does what, who takes over), usage & cost (30 days), compare on the same task, house style & privacy.
- System UI kit.
- Calendar, Finance (accounting), Messages, Mail, Friends — these are later steps in the priority list (5 and 6).

## Progress (sections of the "forgotten 5", built one by one with the owner's OK)
- [x] 1 Desktop: lock screen, waiting-work counts, Help menu, profile photo; Mac/Windows keys.
- [x] 2 Studio script: word card tools, lesson dictionary + target words, Format, voice per line, paste a text.
- [x] 3 Lesson app — DONE (owner approved; wait until tokens reset):
  goals show target words + grammar; real homework inside the lesson (quiz / spoken / written, deadline "N days after class", generated from the lines);
  access per lesson stricter than the folder rule; history: log every change (also the assistant's) with restore (needs a lesson_versions table).
- [x] 4 Voice desk: every line keeps takes (made or recorded with the microphone), "Make this line" / "Another take",
  "Make audio" makes only the changed lines and mixes; tracks for music / ambience / effects with move, cut, volume, fades,
  loop under the lesson and lowering under speech; pronunciation per word, feeling, speed, pitch, pause per line;
  subtitles (VTT, word timing in the course language); engines Piper, Chatterbox (natural, on demand), Azure (with its key);
  voice library: designed voices from a description (AI, or key words) and cloned voices with written consent + 10 s recording;
  right-click on line clips, sound clips, tracks and speakers; a Voice menu in the window.
- [ ] 5 Cast (voice per language, AI tag, personality shapes lines).
