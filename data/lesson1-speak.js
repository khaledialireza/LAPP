// Free speaking for lesson 1: topics (with the words that belong to them) and
// prompt sets (each prompt lists what an answer must contain).
// need: list of alternatives; each alternative is a list of word patterns that must all
// appear ("a|b" = either word). Matching is on normalised words (lower case, umlauts kept).
window.LESSONS[0].speak = {
  topics: [
    { de: "Stell dich vor", fa: "خودت را معرفی کن: اسم، اهل کجا، کجا زندگی می‌کنی، شغل", ru: "Представься: имя, откуда ты, где живёшь, профессия", uk: "Представся: ім'я, звідки ти, де живеш, професія",
      words: "heißen Name sein kommen aus woher wohnen in Herkunft Wohnort Beruf beruflich arbeiten Lehrer Lehrerin Student Studentin Künstler Arzt Ärztin Ingenieur Pilot Kellnerin studieren unterrichten alt Jahr Alter vorstellen" },
    { de: "Dein Wochenende", fa: "آخر هفته‌ات: کجا بودی، چه کردی، هوا چطور بود؟", ru: "Твои выходные: где был, что делал, какая была погода?", uk: "Твої вихідні: де був, що робив, яка була погода?",
      words: "Wochenende Samstag Sonntag Park Wetter schön faul Haus Buch lesen Musik hören machen Entspannung trinken Kaffee Tee gemütlich heute Morgen spielen gehen" },
    { de: "Hobbys und Freizeit", fa: "سرگرمی‌ها و اوقات فراغت: چه دوست داری، چه بازی می‌کنی؟", ru: "Хобби и свободное время: что любишь, во что играешь?", uk: "Хобі та вільний час: що любиш, у що граєш?",
      words: "Hobby Freizeit gern mögen lieben spielen Gitarre Jazz Musik hören lesen Buch kochen essen reisen Film gucken Natur Sport Fußball schwimmen tanzen Videospiel Skateboard fahren Lieblingshobby" },
    { de: "Beruf und Arbeit", fa: "شغل و کار: چه کاره‌ای، کجا کار می‌کنی، کارت چطور است؟", ru: "Профессия и работа: кем работаешь, где, как тебе работа?", uk: "Професія та робота: ким працюєш, де, як тобі робота?",
      words: "Beruf beruflich Arbeit arbeiten Büro Chef Schule Lehrer Lehrerin unterrichten Student Studentin studieren Informatik Kunst Künstler Arzt Ärztin Ingenieur Pilot Kellnerin interessant anstrengend Erfolg spannend Traum" }
  ],
  cues: [
    { de: "Kennenlernen", fa: "آشنایی", items: [
      { q: "Wie heißt du?", fa: "اسمت چیست؟", need: [["heiße"], ["name"], ["ich", "bin"]], ex: "Ich heiße Ali. / Mein Name ist Ali." },
      { q: "Woher kommst du?", fa: "اهل کجایی؟", need: [["komme", "aus"], ["bin", "aus"]], ex: "Ich komme aus dem Iran." },
      { q: "Wo wohnst du jetzt?", fa: "الان کجا زندگی می‌کنی؟", need: [["wohne"], ["lebe"]], ex: "Ich wohne in Hamburg." },
      { q: "Was machst du beruflich?", fa: "شغلت چیست؟", need: [["arbeite"], ["beruf|beruflich"], ["studiere"], ["bin", "lehrer|lehrerin|student|studentin|arzt|ärztin|ingenieur|pilot|künstler|künstlerin|kellnerin|kellner"]], ex: "Ich bin Lehrer. / Ich arbeite als Ingenieur." },
      { q: "Wie alt bist du?", fa: "چند سالته؟", need: [["jahre|jahr"], ["alt"]], ex: "Ich bin 25 Jahre alt." },
      { q: "Was sind deine Hobbys?", fa: "سرگرمی‌هایت چیست؟", need: [["hobby|hobbys|gern|gerne|mag|liebe|spiele|lese|höre|koche|schwimme|tanze|reise|gucke"]], ex: "Ich spiele gern Gitarre und lese viel." }
    ] },
    { de: "Mein Wochenende", fa: "آخر هفتهٔ من", items: [
      { q: "Was hast du am Wochenende gemacht?", fa: "آخر هفته چه کار کردی؟", need: [["war"], ["habe|hab"], ["bin"]], ex: "Am Samstag war ich im Park." },
      { q: "Wie war das Wetter?", fa: "هوا چطور بود؟", need: [["wetter|schön|sonnig|warm|kalt|regen|regnet|gut|schlecht"]], ex: "Das Wetter war schön." },
      { q: "Was trinkst du am Morgen?", fa: "صبح‌ها چه می‌نوشی؟", need: [["kaffee|tee|wasser|saft|milch|trinke"]], ex: "Ich trinke am Morgen Kaffee." },
      { q: "Was machst du heute noch?", fa: "امروز دیگر چه کار می‌کنی؟", need: [["mache|gehe|lerne|lese|höre|koche|spiele|treffe|arbeite|schlafe|besuche"]], ex: "Heute lerne ich Deutsch." }
    ] }
  ]
};
