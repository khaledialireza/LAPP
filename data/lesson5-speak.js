// Free speaking for «Goldlöckchen und die drei Bären».
window.LESSONS[4].speak = {
  topics: [
    { de: "Erzähl die Geschichte nach", fa: "داستان را با کلمات خودت تعریف کن", ru: "Перескажи историю своими словами", uk: "Перекажи історію своїми словами",
      words: "Goldlöckchen Bär Bären Haus Wald Brei Schüssel heiß Stuhl kaputt Bett schlafen einschlafen Angst laufen Tür klopfen essen groß klein" },
    { de: "Mein Frühstück", fa: "صبحانهٔ من: صبح چه می‌خوری؟", ru: "Мой завтрак: что ты ешь утром?", uk: "Мій сніданок: що ти їси вранці?",
      words: "Frühstück essen trinken Brot Brei Kaffee Tee Milch Ei Käse Butter heiß kalt Morgen gern lecker" },
    { de: "Mein Zimmer", fa: "اتاق من: چه چیزهایی در اتاقت هست؟", ru: "Моя комната: что в ней есть?", uk: "Моя кімната: що в ній є?",
      words: "Zimmer Bett Stuhl Tisch Fenster Tür groß klein gemütlich bequem schlafen Haus oben unten" }
  ],
  cues: [
    { de: "Fragen zur Geschichte", fa: "پرسش دربارهٔ داستان", items: [
      { q: "Wo wohnen die drei Bären?", fa: "سه خرس کجا زندگی می‌کنند؟", need: [["wald|haus"]], ex: "In einem kleinen Haus im Wald." },
      { q: "Warum gehen die Bären spazieren?", fa: "چرا خرس‌ها قدم می‌زنند؟", need: [["heiß|brei|warten"]], ex: "Der Brei ist zu heiß." },
      { q: "Wie heißt das Mädchen?", fa: "اسم دختر چیست؟", need: [["goldlöckchen"]], ex: "Sie heißt Goldlöckchen." },
      { q: "Welcher Brei ist gut?", fa: "کدام فرنی خوب است؟", need: [["dritte|dritten|kleine|kleinen|baby"]], ex: "Der Brei aus der dritten Schüssel." },
      { q: "Was passiert mit dem kleinen Stuhl?", fa: "چه بر سر صندلی کوچک می‌آید؟", need: [["kaputt"]], ex: "Er geht kaputt." },
      { q: "Was lernt Goldlöckchen?", fa: "موطلایی چه یاد می‌گیرد؟", need: [["fremd|fremde|fremdes|nicht|darf"]], ex: "Sie darf nicht in fremde Häuser gehen." }
    ] }
  ]
};
