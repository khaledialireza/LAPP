// Free speaking for «Im Restaurant».
window.LESSONS[3].speak = {
  topics: [
    { de: "Im Restaurant bestellen", fa: "سفارش در رستوران: چه می‌خوری و می‌نوشی؟", ru: "Заказ в ресторане: что ешь и пьёшь?", uk: "Замовлення в ресторані: що їси й п’єш?",
      words: "Restaurant Tisch Speisekarte bestellen möchten nehmen hätte gern Vorspeise Hauptgericht Nachtisch Suppe Salat Schnitzel Pommes Spaghetti Pizza trinken Wasser Cola Rechnung bezahlen" },
    { de: "Mein Lieblingsessen", fa: "غذای مورد علاقه‌ام", ru: "Моё любимое блюдо", uk: "Моя улюблена страва",
      words: "Lieblingsessen Essen lecker gern mögen lieben kochen Fleisch Gemüse Reis Nudeln Pizza Suppe süß scharf salzig schmecken Mutter Restaurant" },
    { de: "Ein Abend im Restaurant", fa: "یک شب در رستوران: کی و کجا رفتی؟ چطور بود؟", ru: "Вечер в ресторане: когда и куда ходил? Как было?", uk: "Вечір у ресторані: коли й куди ходив? Як було?",
      words: "Restaurant war Essen lecker Kellner Kellnerin nett Rechnung bezahlen Trinkgeld satt Hunger Durst Freund Abend teuer billig" }
  ],
  cues: [
    { de: "Im Restaurant", fa: "در رستوران", items: [
      { q: "Guten Abend! Haben Sie reserviert?", fa: "عصر بخیر! رزرو کرده‌اید؟", need: [["nein|ja"], ["reserviert|tisch"]], ex: "Nein. Ist ein Tisch für zwei Personen frei?" },
      { q: "Was möchten Sie als Vorspeise?", fa: "به‌عنوان پیش‌غذا چه میل دارید؟", need: [["hätte|möchte|nehme|für"], ["suppe|salat|vorspeise"]], ex: "Ich hätte gern eine Tomatensuppe." },
      { q: "Und als Hauptgericht?", fa: "و غذای اصلی؟", need: [["hätte|möchte|nehme|für"], ["schnitzel|spaghetti|pizza|pasta|fisch|fleisch|gulasch|braten|nudeln|reis"]], ex: "Ich nehme das Schnitzel mit Pommes." },
      { q: "Möchten Sie etwas trinken?", fa: "چیزی میل دارید بنوشید؟", need: [["wasser|cola|saft|apfelsaft|bier|wein|tee|kaffee|fanta|limo"]], ex: "Ein Wasser, bitte." },
      { q: "Hat es Ihnen geschmeckt?", fa: "خوشتان آمد؟", need: [["lecker|gut|super|ausgezeichnet|toll|geschmeckt"]], ex: "Ja, es war sehr lecker." },
      { q: "Möchten Sie noch einen Nachtisch?", fa: "دسر هم میل دارید؟", need: [["satt|nein|danke|rechnung|ja|gerne"]], ex: "Nein, danke. Ich bin satt. Die Rechnung, bitte." },
      { q: "Zusammen oder getrennt?", fa: "با هم یا جدا؟", need: [["zusammen|getrennt"]], ex: "Zusammen, bitte. Mit Karte." }
    ] }
  ]
};
