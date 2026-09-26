// Grammar for the word sheet: conjugation, declension, comparison and rule notes.
// Irregular verbs come from data/verbs-de.js; regular forms are built by rule here.
(() => {
  const H = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const de = s => `<bdi class="gde">${H(s)}</bdi>`;
  const PERS = ["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"];
  const REFL = ["mich", "dich", "sich", "uns", "euch", "sich"];
  const AUX = { haben: "habe hast hat haben habt haben".split(" "), sein: "bin bist ist sind seid sind".split(" ") };
  const SEIN_VERBS = new Set(["gehen", "kommen", "fahren", "fliegen", "reisen", "schwimmen", "werden", "sein", "laufen", "bleiben", "passieren"]);
  const NO_GE = /^(be|ver|er|ent|emp|zer|ge|miss)/;

  /* ---------- Verbs ---------- */
  function regular(inf) {
    const stem = inf.endsWith("eln") || inf.endsWith("ern") ? inf.slice(0, -1) : inf.slice(0, -2);
    const eIns = /[td]$/.test(stem) || /[^lrhmn][mn]$/.test(stem);
    const sEnd = /(s|ß|z|x)$/.test(stem);
    const e = eIns ? "e" : "";
    const pr = [stem + "e", stem + (sEnd ? "t" : e + "st"), stem + e + "t", inf, stem + e + "t", inf];
    const t = stem + e + "te";
    const pt = [t, t + "st", t, t + "n", t + "t", t + "n"];
    const noGe = NO_GE.test(inf) || inf.endsWith("ieren") || /^(wiederholen|unterrichten)$/.test(inf);
    return { pr, pt, pp: (noGe ? "" : "ge") + stem + e + "t", aux: SEIN_VERBS.has(inf) ? "sein" : "haben" };
  }
  function verb(key) {
    const inf = key.replace(/_.*/, "");
    const d = (window.VERBS || {})[inf];
    const v = d ? { ...d, pr: d.pr.split(" "), pt: d.pt.split(" ") } : regular(inf);
    const tail = i => (v.refl ? " " + REFL[i] : "") + (v.sep ? " " + v.sep : "");
    const rows = PERS.map((p, i) => ({ p, pr: v.pr[i] + tail(i), pt: v.pt[i] + tail(i), pf: `${AUX[v.aux][i]}${v.refl ? " " + REFL[i] : ""}`, pp: v.pp }));
    return { inf, rows, aux: v.aux, pp: v.pp, irr: !!v.irr, sep: v.sep, refl: !!v.refl, modal: !!v.modal, stemChange: v.pr[1].slice(0, 2) !== v.pr[0].slice(0, 2) };
  }
  function verbNotes(v) {
    const n = [];
    if (v.irr) n.push(`بی‌قاعده (${de("unregelmäßig")}) است؛ صورت‌های گذشته‌اش را باید حفظ کرد: ${de(v.rows[0].pt)} · ${de(v.pp)}`);
    else n.push(`باقاعده است: گذشتهٔ ساده با ${de("-te")} و اسم مفعول با ${de("ge- … -t")} ساخته می‌شود: ${de(v.rows[0].pt)} · ${de(v.pp)}`);
    if (v.stemChange) n.push(`در ${de("du")} و ${de("er/sie/es")} ریشه عوض می‌شود: ${de(v.rows[1].pr)} · ${de(v.rows[2].pr)}`);
    if (v.sep) n.push(`جداشدنی است: پیشوند ${de(v.sep)} در زمان حال به آخر جمله می‌رود: ${de(`Ich ${v.rows[0].pr}.`)} — در اسم مفعول ${de("ge")} وسط می‌آید: ${de(v.pp)}`);
    if (v.refl) n.push(`انعکاسی است و ضمیر ${de("mich/dich/sich …")} لازم دارد: ${de(`ich ${v.rows[0].pr.split(" ").slice(0, 2).join(" ")}`)}`);
    if (v.modal) n.push(`فعل وجهی است؛ فعل اصلی به‌صورت مصدر به آخر جمله می‌رود: ${de(`Ich ${v.rows[0].pr} gut Deutsch sprechen.`)}`);
    n.push(v.aux === "sein"
      ? `پرفکت با ${de("sein")} ساخته می‌شود، چون حرکت یا تغییر حالت را نشان می‌دهد: ${de(`ich ${v.rows[0].pf} ${v.pp}`)}`
      : `پرفکت با ${de("haben")} ساخته می‌شود: ${de(`ich ${v.rows[0].pf} ${v.pp}`)}`);
    return n;
  }

  /* ---------- Nouns ---------- */
  const WEAK = { Name: ["Namen", "Namen", "Namens"], Herr: ["Herrn", "Herrn", "Herrn"], Student: ["Studenten", "Studenten", "Studenten"], Mensch: ["Menschen", "Menschen", "Menschen"], Pilot: ["Piloten", "Piloten", "Piloten"], Kollege: ["Kollegen", "Kollegen", "Kollegen"], Junge: ["Jungen", "Jungen", "Jungen"] };
  const ART = { der: ["der", "den", "dem", "des"], die: ["die", "die", "der", "der"], das: ["das", "das", "dem", "des"] };
  const INDEF = { der: ["ein", "einen", "einem", "eines"], die: ["eine", "eine", "einer", "einer"], das: ["ein", "ein", "einem", "eines"] };
  const CASES = ["Nominativ", "Akkusativ", "Dativ", "Genitiv"];
  function noun(word, art, plural) {
    const weak = WEAK[word];
    const gen = art === "die" ? word : weak ? weak[2] : word + (/(s|ß|x|z)$/.test(word) ? "es" : "s");
    const sg = [word, weak ? weak[0] : word, weak ? weak[1] : word, gen];
    const dp = plural && !/[ns]$/.test(plural) ? plural + "n" : plural;
    const pl = plural ? [plural, plural, dp, plural] : null;
    const rows = CASES.map((c, i) => ({ c, def: `${ART[art][i]} ${sg[i]}`, ind: `${INDEF[art][i]} ${sg[i]}`, pl: pl ? `${["die", "die", "den", "der"][i]} ${pl[i]}` : "" }));
    const n = [{ der: "مذکر", die: "مؤنث", das: "خنثی" }[art] + ` است؛ حرف تعریف معین ${de(art)} و نامعین ${de(INDEF[art][0])}.`];
    if (art === "der") n.push(`در حالت مفعولی (${de("Akkusativ")}) فقط حرف تعریف مذکر عوض می‌شود: ${de(`den ${sg[1]}`)} · ${de(`einen ${sg[1]}`)}`);
    if (weak) n.push(`از اسم‌های «ضعیف» (${de("n-Deklination")}) است و در همهٔ حالت‌ها جز فاعلی ${de("-n/-en")} می‌گیرد: ${de(`den ${sg[1]}`)}`);
    if (plural) n.push(`جمع: ${de("die " + plural)} — در ${de("Dativ")} جمع ${de("-n")} اضافه می‌شود: ${de("mit den " + dp)}`);
    return { rows, notes: n, hasPlural: !!plural };
  }

  /* ---------- Adjectives ---------- */
  const COMP = { gut: ["besser", "besten"], viel: ["mehr", "meisten"], gern: ["lieber", "liebsten"], groß: ["größer", "größten"], alt: ["älter", "ältesten"], jung: ["jünger", "jüngsten"], lang: ["länger", "längsten"], kurz: ["kürzer", "kürzesten"], kalt: ["kälter", "kältesten"], warm: ["wärmer", "wärmsten"], nah: ["näher", "nächsten"], hoch: ["höher", "höchsten"], oft: ["öfter", "häufigsten"], klug: ["klüger", "klügsten"], schwach: ["schwächer", "schwächsten"], stark: ["stärker", "stärksten"] };
  const NO_COMP = new Set(["perfekt", "absolut", "komplett", "super", "prima", "okay", "gleich", "erste", "letzte", "nächste", "beste", "besser", "tot", "ganz", "offensichtlich", "richtig", "falsch", "fünfundzwanzig", "zentral", "gemeinsam", "aktuell", "weiblich", "verschieden", "korrekt", "selbst", "klar", "willkommen", "andere"]);
  function adj(word) {
    if (NO_COMP.has(word)) return null;
    let c = COMP[word];
    if (!c) {
      const base = word.endsWith("el") ? word.slice(0, -2) + "l" : word.endsWith("euer") ? word.slice(0, -3) + "r" : word;
      c = [(word.endsWith("e") ? word + "r" : base + "er"), word + (/(d|t|s|ß|x|z|sch|eu|au)$/.test(word) ? "esten" : "sten")];
    }
    const stemA = word.endsWith("e") ? word.slice(0, -1) : word;
    return { pos: word, comp: c[0], sup: "am " + c[1], attr: [`ein ${stemA}er Tag`, `eine ${stemA}e Frage`, `ein ${stemA}es Buch`] };
  }

  /* ---------- Small words ---------- */
  const DAT = new Set(["aus", "bei", "mit", "nach", "seit", "von", "zu", "gegenüber"]);
  const AKK = new Set(["durch", "für", "gegen", "ohne", "um", "bis"]);
  const WECHSEL = new Set(["an", "auf", "hinter", "in", "neben", "über", "unter", "vor", "zwischen"]);
  const FUSE = { an: "an + dem = am · an + das = ans", in: "in + dem = im · in + das = ins", bei: "bei + dem = beim", von: "von + dem = vom", zu: "zu + dem = zum · zu + der = zur" };
  const SUB = new Set(["dass", "weil", "wenn", "ob", "als", "obwohl", "damit", "bevor", "nachdem"]);
  const COORD = new Set(["und", "oder", "aber", "denn", "sondern"]);
  const PERSONAL = { ich: ["ich", "mich", "mir"], du: ["du", "dich", "dir"], er: ["er", "ihn", "ihm"], sie: ["sie", "sie", "ihr"], es: ["es", "es", "ihm"], wir: ["wir", "uns", "uns"], ihr: ["ihr", "euch", "euch"], Sie: ["Sie", "Sie", "Ihnen"] };
  const POSS = new Set(["mein", "dein", "sein_poss", "unser", "euer", "ihr_poss", "Ihr"]);
  function smallNotes(word, p) {
    const n = []; let table = null;
    if (p.startsWith("حرف اضافه")) {
      if (DAT.has(word)) n.push(`همیشه با حالت ${de("Dativ")} می‌آید: ${de(word + " dem Freund")} · ${de(word + " der Schule")}`);
      else if (AKK.has(word)) n.push(`همیشه با حالت ${de("Akkusativ")} می‌آید: ${de(word + " den Freund")} · ${de(word + " die Schule")}`);
      else if (WECHSEL.has(word)) n.push(`دوحالته است: برای «کجا؟» (${de("Wo?")}) با ${de("Dativ")} و برای «به کجا؟» (${de("Wohin?")}) با ${de("Akkusativ")}: ${de(word + " der Schule")} ↔ ${de(word + " die Schule")}`);
      if (FUSE[word]) n.push(`با حرف تعریف ادغام می‌شود: ${de(FUSE[word])}`);
    }
    const SUBX = { dass: "Ich glaube, dass er kommt.", weil: "Ich lerne, weil ich Deutsch mag.", wenn: "Wenn ich Zeit habe, lese ich.", ob: "Ich weiß nicht, ob er kommt.", als: "Als ich klein war, spielte ich viel." };
    const COORDX = { und: "Ich lerne, und du hörst zu.", oder: "Kommst du, oder bleibst du?", aber: "Ich bin müde, aber ich lerne.", denn: "Ich lerne, denn ich will sprechen." };
    if (SUB.has(word)) n.push(`حرف ربط وابسته‌ساز است: فعل صرف‌شده به آخر جمله می‌رود${SUBX[word] ? ": " + de(SUBX[word]) : "."}`);
    if (COORDX[word]) n.push(`دو جمله را به هم وصل می‌کند و ترتیب کلمات را تغییر نمی‌دهد (جایگاه صفر): ${de(COORDX[word])}`);
    if (word === "sondern") n.push(`فقط بعد از جملهٔ منفی می‌آید: ${de("nicht A, sondern B")}`);
    if (PERSONAL[word] && /ضمیر/.test(p)) { const f = PERSONAL[word]; table = { head: ["Nominativ", "Akkusativ", "Dativ"], rows: [f] }; n.push(`ضمیر شخصی است و با نقش جمله عوض می‌شود: ${de(f.join(" · "))}`); }
    if (POSS.has(word)) {
      const s = word === "sein_poss" ? "sein" : word === "euer" ? "eur" : word;
      table = { head: ["", "maskulin", "feminin", "neutral", "Plural"], rows: [["Nom.", word === "euer" ? "euer" : s, s + "e", word === "euer" ? "euer" : s, s + "e"], ["Akk.", s + "en", s + "e", word === "euer" ? "euer" : s, s + "e"], ["Dat.", s + "em", s + "er", s + "em", s + "en"]] };
      n.push(`ضمیر ملکی است و مثل ${de("ein/eine")} صرف می‌شود.`);
    }
    const WX = { wie: "Wie heißt du?", was: "Was machst du?", wo: "Wo wohnst du?", woher: "Woher kommst du?", wohin: "Wohin fährst du?", wer: "Wer ist das?", wann: "Wann kommst du?", warum: "Warum lernst du Deutsch?" };
    if (p.startsWith("کلمهٔ پرسشی")) n.push(`در پرسش ${de("W-Frage")} کلمهٔ پرسشی در جایگاه اول و فعل در جایگاه دوم می‌آید${WX[word] ? ": " + de(WX[word]) : "."}`);
    if (p.startsWith("قید") && !p.includes("نفی")) n.push(`قید است و صرف نمی‌شود. اگر اول جمله بیاید، فعل بلافاصله بعد از آن (جایگاه دوم) می‌آید و فاعل بعد از فعل.`);
    if (word === "nicht") n.push(`${de("nicht")} فعل، صفت یا قید را منفی می‌کند؛ اسم با ${de("kein")} منفی می‌شود: ${de("Ich habe keine Zeit.")}`);
    return { notes: n, table };
  }

  window.Grammar = { verb, verbNotes, noun, adj, smallNotes, de, H };
})();
