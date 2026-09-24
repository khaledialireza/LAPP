// هر درس جدید: یک آبجکت به این آرایه اضافه کنید.
// transcript: متن خام با قالب «**نام:** جمله» — هر خط یک جمله.
window.LESSONS = [
  {
    id: 1,
    title: "Sich vorstellen",
    fa: "معرفی خود",
    level: "A1",
    audio: "audio/lesson1.mp3",
    summary: "نام، سن، اهل کجا، محل زندگی، شغل و سرگرمی — رسمی (Sie) و دوستانه (du).",
    phrases: [
      ["Hallo, ich bin …", "سلام، من … هستم", "دوستانه"],
      ["Mein Name ist …", "اسم من … است", "رسمی‌تر"],
      ["Ich heiße …", "اسمم … است", ""],
      ["Wie heißt du? / Wie heißen Sie?", "اسمت چیه؟ / اسم شما چیست؟", "du / Sie"],
      ["Woher kommst du? / Woher kommen Sie?", "اهل کجایی؟ / اهل کجا هستید؟", "du / Sie"],
      ["Ich komme aus …", "من اهل … هستم", "مبدأ"],
      ["Wo wohnst du?", "کجا زندگی می‌کنی؟", ""],
      ["Ich wohne in …", "من در … زندگی می‌کنم", "محل فعلی"],
      ["Was machst du beruflich?", "شغلت چیه؟", ""],
      ["Ich bin Lehrer / Lehrerin.", "من معلم (مرد / زن) هستم", "‎-in = مؤنث"],
      ["Wie alt bist du? / Wie alt sind Sie?", "چند سالته؟ / چند سال دارید؟", "du / Sie"],
      ["Ich bin 30 Jahre alt.", "من ۳۰ سالمه", ""],
      ["Was sind deine Hobbys?", "سرگرمی‌هات چیه؟", ""],
      ["Was machst du gern in deiner Freizeit?", "در وقت آزاد چه کاری دوست داری؟", ""],
      ["Ich koche gern.", "آشپزی دوست دارم", "gern = با علاقه"],
      ["Schön dich kennenzulernen!", "از آشنایی‌ات خوشحالم!", "دوستانه"],
      ["Schön Sie kennenzulernen!", "از آشنایی با شما خوشوقتم!", "رسمی"]
    ],
    vocab: [
      ["sich vorstellen", "خود را معرفی کردن", "to introduce oneself"],
      ["der Name", "نام", "name"],
      ["heißen", "نامیده شدن", "to be called"],
      ["kommen aus", "اهل … بودن", "to come from"],
      ["wohnen", "زندگی کردن (سکونت)", "to live"],
      ["der Beruf", "شغل", "job"],
      ["beruflich", "از نظر شغلی", "professionally"],
      ["der Lehrer / die Lehrerin", "معلم (مرد / زن)", "teacher"],
      ["der Arzt / die Ärztin", "پزشک (مرد / زن)", "doctor"],
      ["der Student / die Studentin", "دانشجو", "student"],
      ["das Hobby / die Hobbys", "سرگرمی", "hobby"],
      ["die Freizeit", "اوقات فراغت", "free time"],
      ["das Alter", "سن", "age"],
      ["gern", "با علاقه", "gladly"],
      ["reisen", "سفر کردن", "to travel"],
      ["kochen", "آشپزی کردن", "to cook"],
      ["lesen", "خواندن", "to read"],
      ["formell", "رسمی", "formal"],
      ["locker", "خودمانی", "casual"],
      ["kennenlernen", "آشنا شدن", "to get to know"]
    ],
    quiz: [
      { q: "«Woher kommst du?» یعنی…", a: ["اهل کجایی؟", "کجا زندگی می‌کنی؟", "چند سالته؟", "شغلت چیه؟"], c: 0 },
      { q: "شکل رسمی «Wie heißt du?» کدام است؟", a: ["Wie heißen Sie?", "Wie heißt ihr?", "Wer bist du?", "Wie alt sind Sie?"], c: 0 },
      { q: "Anna: «Ich komme aus Bremen, aber ich wohne in …»", a: ["Berlin", "Bremen", "München", "Zürich"], c: 0 },
      { q: "مؤنث «Arzt» چیست؟", a: ["Ärztin", "Arztin", "Arztine", "Ärzte"], c: 0 },
      { q: "Ben چند سال دارد؟", a: ["32", "25", "28", "100"], c: 0 },
      { q: "برای رئیس یا در مدرسه از کدام استفاده می‌کنیم؟", a: ["Sie", "du", "ihr", "wir"], c: 0 },
      { q: "«Schön dich kennenzulernen» یعنی…", a: ["از آشنایی‌ات خوشحالم", "خداحافظ", "حالت چطوره؟", "خوش آمدی"], c: 0 },
      { q: "۲۵ به آلمانی:", a: ["fünfundzwanzig", "zwanzigfünf", "fünfzwanzig", "zweifünf"], c: 0 },
      { q: "«Stell dir vor…» در جملهٔ «Stell dir vor, wir fliegen nach Bali!» یعنی…", a: ["تصور کن…", "خودت را معرفی کن…", "بایست…", "بپرس…"], c: 0 },
      { q: "سرگرمی‌های Anna:", a: ["Reisen und Filme gucken", "Lesen und Kochen", "Jazz und Gitarre", "Skateboard fahren"], c: 0 }
    ],
    template: [
      ["Hallo, ich heiße", "name", "Anna"],
      ["Ich bin", "age", "28", "Jahre alt."],
      ["Ich komme aus", "from", "Bremen", "."],
      ["Ich wohne in", "city", "Berlin", "."],
      ["Ich bin", "job", "Lehrerin", "."],
      ["Meine Hobbys sind", "hobby", "Reisen und Filme gucken", "."],
      ["Schön dich kennenzulernen!"]
    ],
    transcript: `
**Anna:** Hallo zusammen! Herzlich willkommen bei "Daily German Talk"!
**Ben:** Hallo! Wie geht's euch? Wir freuen uns, dass ihr da seid.
**Anna:** Ich bin die Anna.
**Ben:** Und ich bin der Ben.
**Anna:** So Ben, wie geht's dir heute?
**Ben:** Mir geht's sehr gut, danke. Und dir, Anna?
**Anna:** Mir geht's prima. Ich habe heute Morgen Kaffee getrunken. Sehr wichtig!
**Ben:** Ah ja, Kaffee ist super wichtig. Was hast du am Wochenende gemacht?
**Anna:** Am Samstag war ich im Park. Das Wetter war schön. Und du?
**Ben:** Ich war faul. Ich habe zu Hause ein Buch gelesen und Musik gehört.
**Anna:** Das klingt auch sehr schön. Entspannung ist gut.
**Ben:** Okay, fangen wir an mit dem Thema. Anna, wie stellt man sich vor? Was sagt man zuerst?
**Anna:** Ganz einfach. Zuerst sagt man: "Hallo" oder "Guten Tag". Dann sagt man seinen Namen. Zum Beispiel: "Hallo, ich bin Anna."
**Ben:** "Hallo, ich bin Ben."
**Anna:** Das ist einfach.
**Ben:** Sehr gut. Man kann auch sagen: "Mein Name ist Anna." Das ist ein bisschen formeller. "Mein Name ist Ben." Formell wie im Büro?
**Anna:** Ja, genau! Mit einem Chef oder in der Schule. "Hallo, ich bin..." ist freundlich und locker, so wie wir jetzt hier reden.
**Ben:** Perfekt! Und nach dem Namen, was kommt dann?
**Anna:** Oft sagt man, woher man kommt. "Ich komme aus..." Zum Beispiel: "Ich komme aus Deutschland."
**Ben:** "Ich komme aus Österreich." *Zwinker* Nein, Spaß! Ich komme auch aus Deutschland.
**Anna:** Ben, sei ehrlich! Also: "Ich komme aus Berlin" oder "Ich komme aus Köln."
**Ben:** Verstehe. Und wie ist das mit "wohnen"? "Ich wohne in..."?
**Anna:** Ja, das ist auch sehr wichtig. "Ich wohne in München" oder "Ich wohne in Hamburg."
**Ben:** Also: "Ich wohne in Frankfurt." Stimmt das?
**Anna:** Ja, das stimmt! Heute bist du aber kreativ.
**Ben:** Okay, okay. Ich wohne wirklich in Berlin. So: Name, Herkunft, Wohnort. Was noch?
**Anna:** Vielleicht der Beruf. "Ich bin Lehrerin" oder "Ich bin Student."
**Ben:** Und ich bin... ich bin Künstler. Nein, ich bin auch Lehrer.
**Anna:** Ben ist ein sehr lustiger Lehrer, glaube ich.
**Ben:** Danke! So, lass uns das alles zusammen üben. Stelle dich mir bitte vor, Anna.
**Anna:** Gerne. Atme tief ein, sprich langsam und klar. "Hallo, ich bin Anna. Ich komme aus Bremen, aber jetzt wohne ich in Berlin. Ich bin Deutschlehrerin. Und du?"
**Ben:** Sehr schön! Jetzt ich: "Guten Tag, mein Name ist Ben Schmidt. Ich komme aus Berlin und wohne auch hier. Ich bin Lehrer und ich mag Kaffee sehr."
**Anna:** Das wissen wir! Super! Jetzt machen wir eine kleine Situation. Stell dir vor, wir sind auf einer Party. Wir kennen uns nicht.
**Ben:** Ah, eine Party, okay. Hallo!
**Anna:** Hallo! Ich bin Anna. Und du?
**Ben:** Ich bin Ben. Schön dich kennenzulernen.
**Anna:** Schön dich kennenzulernen. Das ist eine wichtige Phrase, Leute: "Schön dich kennenzulernen" oder formell: "Schön Sie kennenzulernen."
**Ben:** Ja, "Schön dich kennenzulernen." Woher kommst du, Anna?
**Anna:** Ich komme aus Bremen. Und du, Ben, bist du aus Berlin?
**Ben:** Ja, genau. Ich bin aus Berlin. Ich wohne hier in Prenzlauer Berg.
**Anna:** Ah, cool! Ich wohne auch in Prenzlauer Berg. Was machst du beruflich?
**Ben:** Ich bin Lehrer. Ich unterrichte Kunst. Und du?
**Anna:** Ich bin auch Lehrerin. Ich unterrichte Deutsch. Wir haben viel gemeinsam.
**Ben:** Wirklich? Das ist lustig. Magst du Musik?
**Anna:** Ja, ich mag Musik sehr. Ich höre gern Popmusik, und du?
**Ben:** Ich mag Jazz und ich spiele ein bisschen Gitarre.
**Anna:** Wow, das ist toll! So, jetzt kennen wir uns besser.
**Ben:** Ja, das war ein gutes Gespräch. Jetzt lass uns eine andere Situation machen. Vielleicht in der Schule mit einem neuen Studenten, formeller.
**Anna:** Gute Idee! Du bist der Lehrer, Ben, ich bin ein neuer Student. Mein Name ist... Luka.
**Ben:** Guten Morgen! Sie sind neu hier, richtig?
**Anna:** Ja, genau. Guten Morgen! Mein Name ist Luka Meyer. Schön Sie kennenzulernen.
**Ben:** Schön Sie kennenzulernen! Ich bin Ben Schmidt, Ihr Lehrer. Woher kommen Sie, Herr Meyer?
**Anna:** Ich komme aus der Schweiz, aus Zürich.
**Ben:** Ah, aus der Schweiz! Willkommen in Berlin! Wo wohnen Sie jetzt?
**Anna:** Ich wohne in Mitte, in der Nähe vom Alexanderplatz.
**Ben:** Das ist sehr zentral, das ist gut. Was machen Sie beruflich? Sind Sie Student?
**Anna:** Ja, ich bin Student. Ich studiere Informatik.
**Ben:** Sehr interessant! Viel Erfolg in Berlin!
**Anna:** Vielen Dank, Herr Schmidt.
**Ben:** Puh, formell sein ist anstrengend!
**Anna:** Aber du warst sehr gut. Siehst du, die Zuschauer: "Sie" für formell, "du" für freundlich.
**Ben:** Wichtig! Jetzt eine Frage: Wie sagt man "How old are you?"?
**Anna:** Ah, das ist: "Wie alt bist du?" Oder formell: "Wie alt sind Sie?"
**Ben:** Und die Antwort: "Ich bin..."?
**Anna:** Genau! "Ich bin 30 Jahre alt" oder einfach "Ich bin 30."
**Ben:** Also, ich bin 25 Jahre alt. Ein Traum!
**Anna:** Ben, du bist mindestens 30! Sei ein Vorbild!
**Ben:** Okay, okay. Ich bin 32 Jahre alt. Und du, Anna?
**Anna:** Ich bin 28. So, jetzt wissen wir das auch.
**Ben:** Was kann man noch fragen? Vielleicht über Hobbys?
**Anna:** Ja: "Was sind deine Hobbys?" oder "Was machst du gern in deiner Freizeit?"
**Ben:** Meine Hobbys sind Lesen und Musik hören, und ich koche gern.
**Anna:** Oh, das ist toll. Ich koche nicht gern, ich esse gern! Meine Hobbys sind Reisen und Filme gucken.
**Ben:** Reisen ist super. Wohin reist du gern?
**Anna:** Ich reise gern nach Italien. Ich liebe das Essen und das Wetter.
**Ben:** Ich reise gern nach Skandinavien. Ich mag die Natur.
**Anna:** Sehr schön! So, jetzt stellen wir uns noch einmal komplett vor, mit allen Informationen, für die Zuschauer zum Mitsprechen.
**Ben:** Perfekte Idee! Ich fange an. Ich spreche langsam und deutlich, mit kleinen Pausen: "Hallo, mein Name ist Ben Schmidt. Ich bin 32 Jahre alt. Ich komme aus Berlin und wohne auch hier. Ich bin Lehrer. Meine Hobbys sind Lesen, Musik und Kochen. Schön dich kennenzulernen."
**Anna:** Schön dich kennenzulernen auch! Super, Ben! Jetzt ich: "Guten Tag, ich heiße Anna Weber. Ich bin 28 Jahre alt. Ich komme aus Bremen, aber ich wohne jetzt in Berlin. Ich bin Deutschlehrerin. In meiner Freizeit reise ich gern und ich gucke Filme. Schön dich kennenzulernen."
**Ben:** Wunderbar! Das war ein komplettes Selbstgespräch!
**Anna:** Sich vorstellen, nicht Selbstgespräch! Ein Selbstgespräch ist, wenn du mit dir selbst redest.
**Ben:** Ah, tut mir leid! Sich vorstellen. Jetzt können sich unsere Zuschauer auch vorstellen.
**Anna:** Genau, ihr könnt das üben! Sprecht mit uns! Sagt euren Namen, woher ihr kommt, was ihr macht...
**Ben:** Keine Angst, langsam anfangen! "Hallo, ich bin..." dein Name. Das ist ein super Anfang.
**Anna:** Absolut! So, wir haben noch ein bisschen Zeit. Lass uns ein Spiel spielen!
**Ben:** Ein Spiel? Was für ein Spiel?
**Anna:** Wir stellen uns vor, aber mit falschen Informationen. Die Zuschauer müssen den Fehler finden.
**Ben:** Oh, das ist lustig! Okay, ich beginne. Ich versuche ernst zu wirken: "Hallo, ich bin Vladimir. Ich komme aus Australien. Ich wohne in einem kleinen Dorf. Ich bin Pilot. Ich bin 100 Jahre alt. Meine Hobbys sind Skateboard fahren und Videospiele."
**Anna:** Ben, das ist alles falsch! Du bist nicht Vladimir, du bist Ben! Du kommst nicht aus Australien und du bist nicht 100 Jahre alt!
**Ben:** Okay, vielleicht war das zu offensichtlich. Dein Turn!
**Anna:** Okay, hört zu! Ich spreche mit normaler Stimme: "Guten Tag, ich bin Sophie. Ich komme aus Wien in Österreich. Ich wohne in einem großen Haus. Ich bin Ärztin. Ich bin 40 Jahre alt. Ich mag Schwimmen und Tanzen."
**Ben:** Hm, das klingt fast richtig! Aber dein Name ist nicht Sophie, sondern Anna! Und du kommst nicht aus Wien und du bist nicht 40!
**Anna:** Richtig, sehr gut beobachtet! Das war schwieriger.
**Ben:** Das hat Spaß gemacht! Jetzt wissen unsere Zuschauer, wie man sich vorstellt.
**Anna:** Genau, ihr könnt das üben. Sprecht mit uns, sagt euren Namen, woher ihr kommt, was ihr macht.
**Ben:** Keine Angst, langsam anfangen: "Hallo, ich bin..." dein Name. Das ist ein super Anfang.
**Anna:** So Ben, wir haben heute viel über "sich vorstellen" gesprochen.
**Ben:** Ja, das stimmt. Jetzt ist es Zeit für unser Mini-Vokabeltraining. Wir wiederholen die wichtigsten Wörter und Sätze.
**Anna:** Genau, Leute! Holt euch einen Tee oder Kaffee, macht es euch gemütlich und wiederholt mit uns!
**Ben:** Unser erstes und wichtigstes Wort ist: "sich vorstellen". Ich sag's mal langsam: "sich vor-stel-len". Anna, was bedeutet das?
**Anna:** "Sich vorstellen" means "to introduce oneself". It's a reflexive verb. That sounds complicated, but it just means you do it to yourself. "I introduce myself" -> "Ich stelle mich vor."
**Ben:** Und "Ich stelle mich vor" und "Wir stellen uns vor". Kann man das Wort auch anders verwenden?
**Anna:** Ja, aber Achtung! "Sich etwas vorstellen" kann auch "to imagine something" bedeuten. Zum Beispiel: "Stell dir vor, wir fliegen nach Bali!" ("Imagine we fly to Bali!")
**Ben:** Ah ja, "Stell dir vor, ich kann fliegen!"
**Anna:** Ben, du bist so ein Vogel! Aber für heute meinen wir "sich vorstellen" nur für "introductions". Also Leute, wiederholt nach uns: "sich vorstellen".
**Ben:** Sehr gut! Nächstes sehr, sehr wichtiges Wort: "der Name".
**Anna:** "Der Name", das ist easy: "Name". "My name is Ben" -> "Mein Name ist Ben." Richtig! Und wie fragt man danach?
**Ben:** "Wie heißt du?" Das ist die freundliche Frage, oder formell: "Wie heißen Sie?"
**Anna:** Perfekt! Und die Antwort ist: "Ich heiße Anna" oder "Mein Name ist Anna." Beides ist korrekt. Sagt mal mit uns: "Wie heißt du?" Und jetzt: "Mein Name ist..."
**Ben:** Okay, nächster großer Punkt: "woher kommen" und "wo wohnen". Das ist manchmal schwierig.
**Anna:** Ja, lass es uns erklären! "Woher kommst du?" ("Where are you from?") Das ist deine Herkunft, dein Origin. "Ich komme aus Deutschland", "Ich komme aus Spanien."
**Ben:** Und "Wo wohnst du?" ("Where do you live?") Das ist deine aktuelle Adresse. "Ich wohne in Berlin", "Ich wohne in München." Oft ist es das Gleiche, aber nicht immer.
**Anna:** Gutes Beispiel, Ben, sag du es!
**Ben:** Also: "Ich komme aus Berlin und ich wohne in Berlin." Alles in einem Ort.
**Anna:** Und ich: "Ich komme aus Bremen, aber ich wohne in Berlin." Zwei verschiedene Orte. Versteht ihr den Unterschied?
**Ben:** Lasst uns üben! Anna, woher kommst du?
**Anna:** Ich komme aus Bremen. Ben, wo wohnst du?
**Ben:** Ich wohne in Berlin.
**Anna:** Super! So Zuschauer, euer Turn! Stellt euch die Frage: "Woher komme ich?" und antwortet: "Ich komme aus..." Und dann: "Wo wohne ich?" -> "Ich wohne in..."
**Ben:** Jetzt ein Wort für die Arbeit: "beruflich". "Was machst du beruflich?"
**Anna:** That means "What do you do for a living?" or "What's your job?"
**Ben:** Und die Antwort beginnt immer mit: "Ich bin..." ("I am..."). Anna, was machst du beruflich?
**Anna:** Ich bin Lehrerin. Und du, Ben?
**Ben:** Ich bin Lehrer. Wir können auch sagen: "Ich bin Student", "Ich bin Arzt", "Ich bin Kellnerin", "Ich bin Ingenieur."
**Anna:** Wichtig: Bei weiblichen Berufen endet es oft auf "-in": "Lehrer" -> "Lehrerin", "Arzt" -> "Ärztin".
**Ben:** Richtig! Also Leute, was macht ihr beruflich? Sagt: "Ich bin..."
**Anna:** So, jetzt wird es spannender: Das Wort "das Hobby". Die Pluralform ist "die Hobbys".
**Ben:** "Das Hobby", sehr einfach, es ist genau wie im Englischen. "Was sind deine Hobbys?"
**Anna:** Oder man kann fragen: "Was machst du gern in deiner Freizeit?" ("What do you like to do in your free time?")
**Ben:** Meine Hobbys sind Lesen und Musik hören, und ich koche gern. Anna, was sind deine Hobbys?
**Anna:** Meine Hobbys sind Reisen und Filme gucken, und ich schwimme gern.
**Ben:** Okay Zuschauer, jetzt seid ihr dran! Was sind eure Hobbys? Sagt drei Sätze: "Meine Hobbys sind... und ich... gern." Zum Beispiel: "Meine Hobbys sind Lesen und Sport, und ich koche gern."
**Anna:** Wir haben ein neues Wort heute gelernt: "das Alter" ("the age").
**Ben:** Wie fragt man danach?
**Anna:** "Wie alt bist du?" (freundlich) oder "Wie alt sind Sie?" (formell).
**Ben:** Und die Antwort ist: "Ich bin... Jahre alt" oder einfach "Ich bin 30."
**Anna:** Achtung bei den Zahlen, sie sind manchmal komisch: Nicht "twenty-five", sondern "fünfundzwanzig" ("five and twenty").
**Ben:** Genau! "Ich bin 28" und "Ben ist 32." So Leute, wie alt seid ihr? Sagt: "Ich bin... Jahre alt."
**Anna:** Jetzt machen wir eine kleine Challenge! Ich nenne ein Wort auf Englisch und du, Ben, sagst es auf Deutsch, okay?
**Ben:** Okay, ich bin bereit!
**Anna:** First word: "To introduce oneself".
**Ben:** Das ist "sich vorstellen", nicht schwer!
**Anna:** Sehr gut! Next: "Where do you live?"
**Ben:** "Wo wohnst du?" oder "Wo wohnen Sie?"
**Anna:** Perfect! Next: "Job".
**Ben:** Hm, "der Beruf" oder "Was machst du beruflich?"
**Anna:** Super! Last one: "Hobbies".
**Ben:** "Die Hobbys", easy!
**Anna:** Du bist der Beste, Ben! So Zuschauer, könnt ihr das auch? Versucht es!
**Ben:** Jetzt machen wir das Gegenteil: Ich sage Deutsch und du sagst Englisch, oder unsere Zuschauer sagen es in ihren Köpfen.
**Anna:** Machen wir!
**Ben:** Erstes Wort: "woher kommen".
**Anna:** "Where are you from?", easy!
**Ben:** Nächstes: "Ich bin Studentin."
**Anna:** "I am a student (female)."
**Ben:** Sehr schön! Letztes: "Schön dich kennenzulernen."
**Anna:** "Nice to meet you!" Das ist das Wichtigste am Ende! Wow, das waren viele Vokabeln! Wir wiederholen schnell alle zusammen.
**Ben:** Wir holen: das war "sich vorstellen", "der Name", "wohnen"...
**Anna:** ..."kommen aus"...
**Ben:** ..."beruflich"...
**Anna:** ..."das Hobby"...
**Ben:** ..."das Alter"...
**Anna:** ...und der wichtigste Satz: "Schön dich kennenzulernen!" So, das war heute sehr viel. Wir haben gelernt, wie man sich komplett vorstellt.
**Ben:** Ja, mit Name, Alter, Herkunft, Wohnort, Beruf und Hobbys. Ihr könnt jetzt ein ganzes Gespräch führen!
**Anna:** Genau! Jetzt ist es Zeit für die Frage des Tages. Und heute ist die Frage sehr einfach, weil ihr alle Wörter kennt.
**Ben:** Wie heißt du, woher kommst du und was ist dein Lieblingshobby?
**Anna:** Das bedeutet: "What's your name?", "Where are you from?" and "What is your favorite hobby?"
**Ben:** Bitte, bitte schreibt eure Antwort in die Kommentare unten, wir wollen alle euch kennenlernen!
**Anna:** Schreibt zum Beispiel: "Hallo, ich bin Maria. Ich komme aus Italien. Mein Lieblingshobby ist Tanzen."
**Ben:** Oder: "Guten Tag, ich heiße Tom. Ich komme aus Kanada. Mein Lieblingshobby ist Fußball."
**Anna:** Wir lesen alle Kommentare und antworten. Wir freuen uns darauf!
**Ben:** Vielen Dank, dass ihr heute dabei wart! Ihr habt das großartig gemacht!
**Anna:** Macht's gut, übt weiter und bis zum nächsten Mal!
`
  }
];
