// Free speaking for story 1: retell, give your opinion, talk about feelings.
window.LESSONS[2].speak = {
  topics: [
    { de: "Erzähl die Geschichte nach", fa: "داستان را با کلمات خودت تعریف کن", ru: "Перескажи историю своими словами", uk: "Перекажи історію своїми словами",
      words: "Bauer Heinrich Maria Dorf Markt Gemüse Korb Körbe tragen schwer leicht Nachbarin Brot Großvater Wanderer Loch Löcher loslassen vergessen lächeln Last Bitterkeit einsam allein Geschichte erzählen" },
    { de: "Loslassen", fa: "رها کردن: چه چیزی را باید رها کنی؟", ru: "Отпускать: что тебе стоит отпустить?", uk: "Відпускати: що тобі варто відпустити?",
      words: "loslassen vergessen festhalten Erinnerung Kränkung Schmerz Enttäuschung Ärger frei Freiheit leicht schwer tragen Last verzeihen denken fühlen Angst Glück ruhig Frieden" },
    { de: "Glück und Dankbarkeit", fa: "خوشبختی و قدردانی: چه چیزهای کوچکی خوشحالت می‌کند؟", ru: "Счастье и благодарность: какие мелочи тебя радуют?", uk: "Щастя і вдячність: які дрібниці тебе радують?",
      words: "Glück glücklich Dankbarkeit dankbar Freude freuen lächeln Lächeln Sonne Freund Familie warm schön klein Moment Geschenk Frieden gut Herz" },
    { de: "Ein Nachbar hilft", fa: "کمک همسایه: از کسی کمک گرفته‌ای؟", ru: "Сосед помогает: тебе кто-то помогал?", uk: "Сусід допомагає: тобі хтось допомагав?",
      words: "Nachbar Nachbarin helfen Hilfe hilfsbereit freundlich besuchen bringen Brot Äpfel danke fragen reden zuhören allein einsam verstehen" }
  ],
  cues: [
    { de: "Fragen zur Geschichte", fa: "پرسش دربارهٔ داستان", items: [
      { q: "Wer ist Heinrich?", fa: "هاینریش کیست؟", need: [["bauer"], ["alt", "mann"], ["heinrich", "ist|war"]], ex: "Heinrich ist ein alter Bauer." },
      { q: "Was trägt Heinrich mit sich?", fa: "هاینریش چه چیزی با خودش حمل می‌کند؟", need: [["korb|körbe"]], ex: "Er trägt zwei unsichtbare Körbe." },
      { q: "Was ist im schweren Korb?", fa: "در سبد سنگین چیست؟", need: [["schlecht|schlechte|schlechten|kränkung|kränkungen|verletzung|verletzungen|erinnerung|erinnerungen|schmerz|enttäuschung"]], ex: "Die schlechten Erinnerungen." },
      { q: "Was bringt Maria?", fa: "ماریا چه می‌آورد؟", need: [["brot|äpfel|apfel"]], ex: "Sie bringt Brot und später Äpfel." },
      { q: "Was hat der Wanderer gesagt?", fa: "رهگذر چه گفت؟", need: [["loch|löcher|löchern"], ["loslassen|lass|loslässt"], ["fest|festhalten|verschließen"]], ex: "Der Korb für das Schlechte braucht Löcher." },
      { q: "Wie fühlt sich Heinrich am Ende?", fa: "هاینریش در پایان چه حسی دارد؟", need: [["leicht|leichter|frei|glücklich|froh|besser|gut|ruhig"], ["nicht", "allein|einsam"]], ex: "Er fühlt sich leichter und nicht mehr allein." }
    ] },
    { de: "Deine Meinung", fa: "نظر خودت", items: [
      { q: "Was hältst du von der Geschichte?", fa: "نظرت دربارهٔ داستان چیست؟", need: [["finde|gefällt|mag|schön|gut|interessant|traurig|wichtig|denke|glaube"]], ex: "Ich finde die Geschichte sehr schön." },
      { q: "Was möchtest du loslassen?", fa: "دوست داری چه چیزی را رها کنی؟", need: [["möchte|will|muss|sollte"], ["loslassen|vergessen"]], ex: "Ich möchte meinen Ärger loslassen." },
      { q: "Was macht dich glücklich?", fa: "چه چیزی خوشحالت می‌کند؟", need: [["glücklich|freue|freut|mag|liebe|gern"]], ex: "Meine Familie macht mich glücklich." },
      { q: "Wer hilft dir, wenn es dir schlecht geht?", fa: "وقتی حالت بد است، چه کسی کمکت می‌کند؟", need: [["hilft|helfen|hilfe"], ["freund|freundin|familie|mutter|vater|schwester|bruder|mann|frau|nachbar|nachbarin|niemand"]], ex: "Meine Freundin hilft mir." }
    ] }
  ]
};
