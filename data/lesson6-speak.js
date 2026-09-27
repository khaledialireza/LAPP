// Free speaking for «Des Kaisers neue Kleider».
window.LESSONS[5].speak = {
  topics: [
    { de: "Erzähl die Geschichte nach", fa: "داستان را با کلمات خودت تعریف کن", ru: "Перескажи историю своими словами", uk: "Перекажи історію своїми словами",
      words: "Kaiser Kleidung Kleider Männer Weber Stoff Webstuhl Gold dumm klug sehen sagen Angst Minister Parade Kind nackt Wahrheit lachen schämen" },
    { de: "Ehrlichkeit", fa: "صداقت: همیشه حقیقت را می‌گویی؟", ru: "Честность: ты всегда говоришь правду?", uk: "Чесність: ти завжди кажеш правду?",
      words: "Wahrheit ehrlich Ehrlichkeit lügen sagen Angst mutig Freund wichtig immer manchmal nie denken glauben" },
    { de: "Meine Kleidung", fa: "لباس‌های من: چه می‌پوشی؟ چه دوست داری؟", ru: "Моя одежда: что ты носишь, что любишь?", uk: "Мій одяг: що ти носиш, що любиш?",
      words: "Kleidung Kleider anziehen tragen Hose Hemd Jacke Schuhe schön teuer billig kaufen Farbe Mode gern lieben" }
  ],
  cues: [
    { de: "Fragen zur Geschichte", fa: "پرسش دربارهٔ داستان", items: [
      { q: "Was liebt der Kaiser?", fa: "امپراتور چه چیزی را دوست دارد؟", need: [["kleidung|kleider"]], ex: "Er liebt schöne Kleidung." },
      { q: "Wer kommt in die Stadt?", fa: "چه کسانی به شهر می‌آیند؟", need: [["männer|weber|betrüger"]], ex: "Zwei Männer kommen in die Stadt." },
      { q: "Wer kann die Kleidung nicht sehen?", fa: "چه کسی نمی‌تواند لباس را ببیند؟", need: [["dumm|dumme|dummen"]], ex: "Dumme Menschen können sie nicht sehen." },
      { q: "Warum sagt der Minister nichts?", fa: "چرا وزیر چیزی نمی‌گوید؟", need: [["angst"], ["dumm"]], ex: "Er hat Angst." },
      { q: "Wer sagt die Wahrheit?", fa: "چه کسی حقیقت را می‌گوید؟", need: [["kind"]], ex: "Ein kleines Kind." },
      { q: "Was lernen wir?", fa: "چه یاد می‌گیریم؟", need: [["wahrheit|ehrlich|ehrlichkeit"]], ex: "Man soll immer die Wahrheit sagen." }
    ] }
  ]
};
