// Free speaking for lesson 2: topics and prompt sets (see data/lesson1-speak.js for the format).
window.LESSONS[1].speak = {
  topics: [
    { de: "Deine Hobbys", fa: "سرگرمی‌هایت: چه کارهایی دوست داری، سرگرمی مورد علاقه‌ات چیست؟", ru: "Твои хобби: что ты любишь делать, какое у тебя любимое хобби?", uk: "Твої хобі: що ти любиш робити, яке в тебе улюблене хобі?",
      words: "Hobby Lieblings- gern lieber am liebsten lesen spielen Sport Fußball schwimmen Musik hören Instrument Gitarre kochen backen malen fotografieren spazieren Freizeit Spaß machen interessieren" },
    { de: "Hobbys mit Freunden", fa: "با دوستانت چه کار می‌کنی؟ کجا می‌روید؟", ru: "Что ты делаешь с друзьями? Куда вы ходите?", uk: "Що ти робиш із друзями? Куди ви ходите?",
      words: "Freund treffen Kino Café Kaffee reden Fußball spielen gehen ins Komödie Film zusammen sozial lustig Wochenende" },
    { de: "Musik, Filme, Bücher", fa: "موسیقی، فیلم و کتاب مورد علاقه‌ات", ru: "Твои любимые музыка, фильмы и книги", uk: "Твої улюблені музика, фільми й книжки",
      words: "Musik hören Rock Jazz Genre Instrument Gitarre Film sehen schauen Serie Komödie Kino Buch lesen Roman Zeitung Lieblings- langweilig entspannend spannend" },
    { de: "Hobbys im Sommer und im Winter", fa: "سرگرمی‌های تابستان و زمستان", ru: "Хобби летом и зимой", uk: "Хобі влітку та взимку",
      words: "Sommer Winter schwimmen Schwimmbad Ski Schneeballschlacht spazieren Wald Park Sonne Wetter warm gefährlich aufregend gesund frisch Luft" }
  ],
  cues: [
    { de: "Meine Hobbys", fa: "سرگرمی‌های من", items: [
      { q: "Was sind deine Hobbys?", fa: "سرگرمی‌هایت چیست؟", need: [["hobbys|hobby"], ["gern|gerne|mag|liebe"]], ex: "Meine Hobbys sind Lesen und Fußball." },
      { q: "Was ist dein Lieblingshobby?", fa: "سرگرمی مورد علاقه‌ات چیست؟", need: [["lieblingshobby"], ["am", "liebsten"], ["gern|gerne|liebe"]], ex: "Mein Lieblingshobby ist Kochen." },
      { q: "Spielst du ein Instrument?", fa: "سازی می‌زنی؟", need: [["spiele"], ["kein|nicht|nein"]], ex: "Ja, ich spiele Gitarre. / Nein, ich spiele kein Instrument." },
      { q: "Was für Musik hörst du gern?", fa: "چه جور موسیقی دوست داری؟", need: [["höre|mag|liebe"], ["musik|pop|rock|jazz|popmusik|klassik|rap|hiphop"]], ex: "Ich höre gern Popmusik." },
      { q: "Was machst du nicht gern?", fa: "چه کاری دوست نداری؟", need: [["nicht", "gern|gerne"], ["langweilig"], ["keinen", "spaß"]], ex: "Ich koche nicht gern. / Aufräumen ist langweilig." }
    ] },
    { de: "Freizeit mit Freunden", fa: "وقت آزاد با دوستان", items: [
      { q: "Was machst du gern mit deinen Freunden?", fa: "با دوستانت چه کار دوست داری؟", need: [["treffe|gehen|spielen|reden|trinken|kochen|machen|sehen|schauen"]], ex: "Wir gehen ins Kino und trinken Kaffee." },
      { q: "Wohin geht ihr oft?", fa: "اغلب کجا می‌روید؟", need: [["ins|in|zum|zur|nach"]], ex: "Wir gehen oft ins Kino." },
      { q: "Welche Filme magst du?", fa: "چه فیلم‌هایی دوست داری؟", need: [["komödien|filme|actionfilme|krimis|dramen|mag|liebe|gern|gerne"]], ex: "Ich mag Komödien." },
      { q: "Wofür interessierst du dich?", fa: "به چه علاقه داری؟", need: [["interessiere", "für"]], ex: "Ich interessiere mich für Fotografie." }
    ] }
  ]
};
