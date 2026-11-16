/* Local account-scoped checkpoints and optional round breaks for Path lessons. */
(function (root) {
  "use strict";
  const key = () => "glide_path_sessions_v1_" + (root.fluencyAuth?.getCurrentUser()?.id || "guest");
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(key()) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  };
  let owner = null;
  function valid(s, level) {
    return (
      s?.version === 1 &&
      s.levelId === level.id &&
      ["short", "full"].includes(s.size) &&
      Array.isArray(s.queue) &&
      s.queue.length <= 64 &&
      s.queue.every(
        (t) =>
          t &&
          typeof t.word === "string" &&
          typeof t.id === "string" &&
          Number.isInteger(t.round) &&
          t.round >= 0 &&
          t.round <= 2,
      ) &&
      Number.isInteger(s.total) &&
      s.total >= 6 &&
      s.total <= 64 &&
      Number.isInteger(s.completed) &&
      s.completed >= 0 &&
      s.completed + s.queue.length === s.total &&
      Number.isInteger(s.attempts) &&
      s.attempts >= 0 &&
      Array.isArray(s.seenRounds) &&
      s.seenRounds.every((r) => r === 1 || r === 2)
    );
  }
  function saved(level) {
    const candidates = Object.values(read()).filter((s) => valid(s, level));
    const full = candidates
      .filter((s) => s.size === "full")
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    if (full) return full;
    const old = candidates
      .filter((s) => s.size === "short")
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    if (!old) return null;
    // Retain participation credit from an older short checkpoint; no extra reward.
    const plan = root.GlideLessonPlan.build(level, root.QUESTION_BANK || [], () => 0);
    const completed = Math.min(old.completed, plan.tasks.length);
    return {
      ...old,
      size: "full",
      total: plan.tasks.length,
      completed,
      queue: plan.tasks.slice(completed),
    };
  }
  function prepare(level) {
    owner = key();
    const size = "full";
    const checkpoint = saved(level);
    if (checkpoint) return checkpoint;
    const plan = root.GlideLessonPlan.build(level, root.QUESTION_BANK || []);
    return {
      version: 1,
      levelId: level.id,
      size,
      queue: plan.tasks,
      total: plan.tasks.length,
      completed: 0,
      attempts: 0,
      seenRounds: [],
      voiceIntroPlayed: false,
    };
  }
  function save(c) {
    if (!c.isLessonActive || c.isSosDrill || !c.pathSession) return true;
    if (owner !== key()) return false;
    const all = read();
    for (const [slot, value] of Object.entries(all)) {
      if (value?.levelId === c.currentLevel.id && value.size === "short") delete all[slot];
    }
    all[c.currentLevel.id + ":full"] = {
      version: 1,
      updatedAt: Date.now(),
      levelId: c.currentLevel.id,
      size: c.pathSession.size,
      queue: c.lessonQueue,
      total: c.initialWordCount,
      completed: c.completedItemsCount,
      attempts: c.totalAttemptsCount,
      seenRounds: c.seenRounds || [],
      voiceIntroPlayed: c.voiceIntroPlayed,
    };
    try {
      localStorage.setItem(key(), JSON.stringify(all));
      return true;
    } catch {
      const status = document.getElementById("statusAlert");
      if (status)
        status.textContent = "Pokrok sa nepodarilo uložiť. Úložisko zariadenia môže byť plné.";
      return false;
    }
  }
  function clear(c) {
    if (owner !== key()) return;
    const all = read();
    delete all[c.currentLevel.id + ":" + c.pathSession.size];
    try {
      localStorage.setItem(key(), JSON.stringify(all));
    } catch {}
  }
  function pause(c) {
    if (!save(c)) {
      if (!confirm("Pokrok sa nepodarilo uložiť. Odísť aj tak?")) return;
    }
    roundDialog.close();
    c.isLessonActive = false;
    root.abortActiveDspSession?.();
    c.exitFocusMode();
  }
  // Examples are tailored to each lesson; generated speech is illustrative, not clinician-verified.
  const lessonGuides = {"1.1":{"id":"1.1","title":"Jemný nábeh: A a O","type":"onset","steps":["Pohodlne uvoľni ústa.","Začni samohlásku A jemne a postupne pridaj hlas.","Dopovedz slovo „auto“ bez ponáhľania."],"hint":"Začni hlas postupne, bez tlačenia a bez núteného šepotu.","caption":"A → auto","guide":"V tejto lekcii skús jemný začiatok samohlásky A. Začni tichšie, postupne pridaj hlas a dopovedz slovo. Napríklad: auto.","example":"Auto."},"1.2":{"id":"1.2","title":"Jemný nábeh: E a I","type":"onset","steps":["Uvoľni ústa a vyber si pohodlný hlas.","Začni samohlásku I jemne.","Pokračuj do slova „isto“."],"hint":"Začiatok hlasu nech postupne zosilnie do bežnej hlasitosti.","caption":"I → isto","guide":"Skús jemný začiatok samohlásky I. Začni hlas potichu, potom plynulo pokračuj. Napríklad: isto.","example":"Isto."},"1.3":{"id":"1.3","title":"Jemný nábeh: U a Ô","type":"onset","steps":["Pery prirodzene zaokrúhli.","Začni U jemne, bez tlačenia.","Pokračuj slovom „ulica“."],"hint":"Zaokrúhlenie pier nech je pohodlné, bez prehnaného pohybu.","caption":"U → ulica","guide":"Skús jemný začiatok hlásky U. Pery prirodzene zaokrúhli, hlas nechaj postupne zosilnieť. Napríklad: ulica.","example":"Ulica."},"1.4":{"id":"1.4","title":"Jemný začiatok mena","type":"onset","steps":["Vyber si meno, ktoré chceš povedať.","Prvú samohlásku začni jemne.","Pokračuj menom prirodzeným tempom."],"hint":"Nemusíš pred slovom nasilu vydychovať ani vkladať ďalší zvuk.","caption":"A → Andrea","guide":"Pri mene začni prvú samohlásku jemne a plynulo pokračuj. Nemusíš pred slovom nasilu vydychovať. Napríklad: Andrea.","example":"Andrea."},"1.5":{"id":"1.5","title":"Samohlásky v dlhšom slove","type":"onset","steps":["Vyber si dlhšie slovo.","Prvú samohlásku začni jemne.","Zvyšok slova povedz vlastným tempom."],"hint":"Techniku môžeš použiť aj len na začiatku slova.","caption":"A → autobus","guide":"V dlhšom slove sa sústreď iba na pohodlný začiatok. Potom slovo dopovedz svojím tempom. Napríklad: autobus.","example":"Autobus."},"2.1":{"id":"2.1","title":"Spojenie M so samohláskou","type":"linking","steps":["Pery jemne spoj pri M.","Nechaj hlas plynule prejsť do A.","Pokračuj slovom „mama“."],"hint":"Prechod si vyskúšaj bez tlačenia; nemusíš hlásku naťahovať.","caption":"M → A → mama","guide":"Jemne spoj pery pri M a skús plynulo prejsť do A. Potom dopovedz celé slovo. Napríklad: mama.","example":"Mama."},"2.2":{"id":"2.2","title":"Spojenie V so samohláskou","type":"linking","steps":["Jemne priblíž horné zuby k dolnej pere.","Začni V pohodlným hlasom.","Prejdi do slova „voda“."],"hint":"Dotyk aj hlas môžu zostať ľahké a prirodzené.","caption":"V → O → voda","guide":"Pri hláske V jemne priblíž horné zuby k dolnej pere. Potom prejdi do samohlásky. Napríklad: voda.","example":"Voda."},"2.3":{"id":"2.3","title":"Plynulý prechod pri L","type":"linking","steps":["Jazyk jemne prilož za horné zuby.","Začni L pohodlne.","Prejdi do slova „lampa“."],"hint":"Sústreď sa na ľahký prechod, nie na dokonalú výslovnosť.","caption":"L → A → lampa","guide":"Pri L jemne prilož jazyk za horné zuby a prejdi do samohlásky. Napríklad: lampa.","example":"Lampa."},"2.4":{"id":"2.4","title":"Ľahký kontakt pri B","type":"contact","steps":["Jemne spoj pery na začiatku B.","Pery uvoľni a pokračuj hlasom.","Dopovedz slovo „brat“."],"hint":"Kontakt pier môže byť ľahký, bez silného stláčania.","caption":"pery → B → brat","guide":"Na začiatku B jemne spoj pery. Potom ich uvoľni a pokračuj v slove. Napríklad: brat.","example":"Brat."},"2.5":{"id":"2.5","title":"Ľahký začiatok dlhého slova","type":"linking","steps":["Vyber si dlhšie slovo.","Prvý kontakt urob jemne.","Pokračuj bez núteného spomaľovania."],"hint":"Ak chceš, krátko sa zastav medzi myšlienkami, nie vynútene v každom slove.","caption":"B → Bratislava","guide":"Pri dlhšom slove začni pohodlným ľahkým kontaktom a pokračuj svojím tempom. Napríklad: Bratislava.","example":"Bratislava."},"3.1":{"id":"3.1","title":"Ľahký kontakt pri P","type":"contact","steps":["Jemne spoj pery na P.","Pery uvoľni bez silného stlačenia.","Pokračuj slovom „Peter“."],"hint":"Začiatok môže byť krátky a prirodzený.","caption":"pery → P → Peter","guide":"Pri hláske P jemne spoj pery, potom ich uvoľni a pokračuj. Napríklad: Peter.","example":"Peter."},"3.2":{"id":"3.2","title":"Ľahký začiatok pri K","type":"contact","steps":["Pohodlne priprav jazyk na K.","Nesnaž sa vytvoriť silný tlak.","Pokračuj slovom „káva“."],"hint":"Netreba kontrolovať presnú polohu jazyka, dôležité je pohodlie.","caption":"K → káva","guide":"Pri K sa nesnaž vytvoriť silný tlak. Začni pohodlne a pokračuj slovom. Napríklad: káva.","example":"Káva."},"3.3":{"id":"3.3","title":"Pohodlný začiatok Š","type":"linking","steps":["Jemne začni hlásku Š.","Pokračuj zvyškom slova.","Povedz „škola“ vlastným tempom."],"hint":"Š nemusíš nasilu predlžovať.","caption":"Š → škola","guide":"Skús pohodlne začať hlásku Š a pokračovať do slova bez núteného predlžovania. Napríklad: škola.","example":"Škola."},"3.4":{"id":"3.4","title":"Skupina spoluhlások","type":"contact","steps":["Pozri sa na prvé hlásky slova.","Začni ich pohodlne bez tlačenia.","Dopovedz „štvrtok“ svojím tempom."],"hint":"Cieľom je povedať slovo, nie dodržať časový limit.","caption":"ŠT → štvrtok","guide":"Pri skupine spoluhlások začni pohodlne a dopovedz celé slovo vlastným tempom. Napríklad: štvrtok.","example":"Štvrtok."},"3.5":{"id":"3.5","title":"Začiatok dlhšieho slova","type":"contact","steps":["Vyber si slovo.","Začni prvú hlásku ľahko.","Pokračuj celým slovom."],"hint":"Nemusíš kontrolovať každú hlásku zvlášť.","caption":"K → knižnica","guide":"V dlhšom slove skús ľahký začiatok a zvyšok povedz po svojom. Napríklad: knižnica.","example":"Knižnica."},"4.1":{"id":"4.1","title":"Odpoveď pri platení","type":"conversation","steps":["Vypočuj si otázku o platení.","Daj si čas na odpoveď.","Povedz spôsob platby vlastnými slovami."],"hint":"Nemusíš použiť konkrétnu formuláciu.","caption":"otázka → vlastná odpoveď","guide":"Vypočuj si otázku o platení. Môžeš sa na chvíľu zastaviť a odpovedať vlastnými slovami.","example":"Kartou, prosím."},"4.2":{"id":"4.2","title":"Odpoveď na zákaznícku kartu","type":"conversation","steps":["Vypočuj si otázku o karte.","Rozhodni sa, čo chceš povedať.","Odpovedz svojím tempom."],"hint":"Odpoveď môže byť krátka alebo dlhšia.","caption":"otázka → rozhodnutie → odpoveď","guide":"Vypočuj si otázku o zákazníckej karte. Rozhodni sa, čo chceš povedať, a odpovedz po svojom.","example":"Nie, ďakujem."},"4.3":{"id":"4.3","title":"Odpoveď na otázku o bločku","type":"conversation","steps":["Vypočuj si otázku o bločku.","Rozhodni sa, či ho chceš.","Odpovedz vlastnými slovami."],"hint":"Odpoveď nie je predpísaná.","caption":"otázka → odpoveď","guide":"Vypočuj si otázku o bločku. Rozhodni sa podľa seba a povedz odpoveď vlastnými slovami.","example":"Áno, poprosím."},"4.4":{"id":"4.4","title":"Odpoveď na otázku o taške","type":"conversation","steps":["Vypočuj si otázku o taške.","Premysli si, čo potrebuješ.","Odpovedz po svojom."],"hint":"Nie je potrebná presná veta.","caption":"otázka → odpoveď","guide":"Vypočuj si otázku o taške. Premysli si, čo potrebuješ, a odpovedz vlastnými slovami.","example":"Mám vlastnú."},"4.5":{"id":"4.5","title":"Viac otázok pri pokladni","type":"pause","steps":["Vypočuj si jednu otázku.","Odpovedz vlastnými slovami.","Medzi otázkami si dopraj chvíľu."],"hint":"Pauza je možnosť, nie povinnosť.","caption":"otázka · pauza · odpoveď","guide":"Pri viacerých otázkach postupuj po jednej. Ak chceš, medzi otázkou a odpoveďou si dopraj chvíľu.","example":"Kartou, prosím. Ďakujem."},"5.1":{"id":"5.1","title":"Telefonát s kuriérom","type":"conversation","steps":["Vypočuj si, kto volá.","Povedz, čo potrebuješ.","Pokračuj vlastným tempom."],"hint":"Pri telefonáte si môžeš dať čas aj na prvé slová.","caption":"počúvam → odpovedám","guide":"Predstav si telefonát s kuriérom. Vypočuj si volajúceho a odpovedz svojím spôsobom.","example":"Dobrý deň, pri telefóne."},"5.2":{"id":"5.2","title":"Telefonát do ambulancie","type":"conversation","steps":["Vypočuj si úvod hovoru.","Povedz, s čím voláš.","Ak chceš, opýtaj sa na termín."],"hint":"Môžeš použiť vlastnú situáciu a vlastné slová.","caption":"počúvam → môj dôvod","guide":"Pri telefonáte do ambulancie si vypočuj úvod a povedz vlastnými slovami, s čím voláš.","example":"Dobrý deň, volám kvôli termínu."},"5.3":{"id":"5.3","title":"Telefonát do servisu","type":"conversation","steps":["Vypočuj si otázku zo servisu.","Stručne opíš, čo potrebuješ.","Doplň podrobnosti podľa seba."],"hint":"Nemusíš pripraviť dokonalé vysvetlenie.","caption":"otázka → môj opis","guide":"V telefonáte do servisu sa môžeš najprv krátko zastaviť. Potom povedz vlastnými slovami, čo potrebuješ.","example":"Dobrý deň, potrebujem opravu."},"5.4":{"id":"5.4","title":"Nečakaný hovor s kuriérom","type":"conversation","steps":["Vypočuj si volajúceho.","Daj si chvíľu na reakciu.","Odpovedz, čo potrebuješ povedať."],"hint":"Aj pri nečakanom hovore máš čas hovoriť po svojom.","caption":"zazvoní → počúvam → odpovedám","guide":"Pri nečakanom hovore si môžeš vypočuť otázku a dať si chvíľu na odpoveď. Hovor vlastným tempom.","example":"Áno, čakám balík."},"5.5":{"id":"5.5","title":"Uzavretie rozhovoru","type":"pause","steps":["Vypočuj si poslednú otázku.","Povedz, čo ešte chceš doplniť.","Rozlúč sa vlastnými slovami."],"hint":"Pauza pred rozlúčkou je v poriadku.","caption":"odpoveď · pauza · rozlúčka","guide":"Na konci rozhovoru môžeš povedať, čo ešte potrebuješ, a rozlúčiť sa vlastnými slovami.","example":"Ďakujem pekne, dovidenia."}};
  let demoPlayer = null;
  function stopDemo() {
    if (demoPlayer) { demoPlayer.pause(); demoPlayer.currentTime = 0; demoPlayer = null; }
  }
  function renderDemo(container, example) {
    container.replaceChildren();
    if (!example) return;
    const visual = document.createElement("div"); visual.className = "technique-visual guided-technique"; visual.dataset.technique = example.type; visual.dataset.stage = "0";
    visual.innerHTML = '<div class="technique-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="technique-stage-copy"><strong></strong><span aria-live="polite"></span></div>';
    visual.querySelector("strong").textContent = example.caption;
    const current = visual.querySelector("span");
    const steps = document.createElement("div"); steps.className = "technique-stage-buttons"; steps.setAttribute("role", "group"); steps.setAttribute("aria-label", "Kroky ukážky");
    function selectStage(index) {
      visual.dataset.stage = String(index); current.textContent = example.steps[index];
      [...steps.children].forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    }
    example.steps.forEach((step, index) => {
      const button = document.createElement("button"); button.type = "button"; button.textContent = String(index + 1); button.setAttribute("aria-label", "Krok " + (index + 1) + ": " + step);
      button.onclick = () => { stopDemo(); selectStage(index); }; steps.append(button);
    });
    const button = document.createElement("button"); button.type = "button"; button.className = "technique-audio"; button.textContent = "▶ Vypočuť ukážku";
    const info = document.createElement("small"); info.className = "technique-audio-info";
    info.textContent = Number(example.id.split(".")[0]) >= 4
      ? "AI hlas je len príklad. V rozhovore odpovedz vlastnými slovami."
      : "AI hlas je ilustračný a nie je logopédom overený. Presné vykonanie techniky si môžeš overiť s logopédom.";
    button.onclick = () => {
      if (document.body.classList.contains("in-lesson") && document.getElementById("startBtn")?.disabled) { info.textContent = "Postup si môžeš prehrať pred ďalším pokusom."; return; }
      stopDemo(); selectStage(0);
      const audio = demoPlayer = new Audio('/audio/scenarios/glide-lesson-example-' + example.id.replace('.', '-') + '.mp3');
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      audio.onended = () => { if (demoPlayer === audio) { demoPlayer = null; if (!reducedMotion) selectStage(2); } };
      audio.play().catch(() => { if (demoPlayer === audio) { demoPlayer = null; info.textContent = "Nahrávku sa nepodarilo prehrať. Kroky si môžeš prečítať a vybrať vyššie."; } });
    };
    container.append(visual, steps, button, info);
    if (example.type === 'onset' || example.type === 'contact' || example.type === 'linking') {
      const video = document.createElement('a'); video.target = '_blank'; video.rel = 'noopener noreferrer';
      video.href = 'https://www.asha.org/practice-portal/clinical-topics/fluency-disorders/';
      video.textContent = 'Odborný zdroj k technikám (anglicky) ↗'; video.className = 'technique-expert-link'; container.append(video);
    }
    selectStage(0);
  }
  document.getElementById("startBtn")?.addEventListener("click", stopDemo, true);
  document.getElementById("exitLessonBtn")?.addEventListener("click", stopDemo, true);
  document.getElementById("popoverCloseBtn")?.addEventListener("click", stopDemo, true);
  document.getElementById("startLessonBtn")?.addEventListener("click", stopDemo, true);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopDemo(); });
  const activeTechnique = document.createElement("details");
  activeTechnique.id = "activeTechniqueDemo"; activeTechnique.className = "active-technique-demo"; activeTechnique.hidden = true;
  activeTechnique.innerHTML = '<summary>Ukážka techniky ✨</summary><strong></strong><ol class="lesson-technique-steps"></ol><p></p><div></div>';
  document.getElementById("targetMeta")?.after(activeTechnique);
  activeTechnique.addEventListener("toggle", () => { if (!activeTechnique.open) stopDemo(); });

  function describe(level) {
    const count = document.getElementById("popoverWordCount");
    const start = document.getElementById("startLessonBtn");
    const checkpoint = saved(level);
    const total = root.GlideLessonPlan.isBoss(level) ? 16 : 12;
    count.textContent = checkpoint
      ? `${checkpoint.completed} / ${checkpoint.total} hotovo · uložené`
      : `${total} úloh · 3 kolá`;
    start.querySelector("span").textContent = checkpoint
      ? "POKRAČOVAŤ V LEKCII"
      : "SPUSTIŤ TRÉNING";
    const technique = document.getElementById("lessonTechnique");
    const example = lessonGuides[level.id];
    technique.open = false;
    technique.hidden = !example;
    if (!example) return;
    document.getElementById("lessonTechniqueTitle").textContent = example.title;
    document.getElementById("lessonTechniqueHint").textContent = example.hint;
    renderDemo(document.getElementById("lessonTechniqueDemo"), example);
    document.getElementById("lessonTechniqueSteps").replaceChildren(
      ...example.steps.map((step) => {
        const item = document.createElement("li");
        item.textContent = step;
        return item;
      }),
    );
  }
  const roundDialog = document.createElement("dialog");
  roundDialog.id = "lessonRoundDialog";
  roundDialog.className = "lesson-round-dialog";
  roundDialog.setAttribute("aria-labelledby", "lessonRoundTitle");
  roundDialog.setAttribute("aria-describedby", "lessonRoundDescription");
  roundDialog.innerHTML =
    '<div class="round-celebration" aria-hidden="true">✦</div><p class="lesson-eyebrow">MALÝ MÍĽNIK</p><h2 id="lessonRoundTitle">Prvé kolo je za tebou</h2><p id="lessonRoundDescription"></p><button class="btn-3d green full" id="lessonRoundContinue" type="button">Ďalšie kolo</button><button class="lesson-quiet-action" id="lessonRoundPause" type="button">Odložiť na neskôr</button>';
  document.body.append(roundDialog);
  const repeat = document.createElement("button");
  repeat.id = "lessonRepeat";
  repeat.type = "button";
  repeat.className = "lesson-quiet-action";
  repeat.textContent = "Zopakovať pre seba (+1 úloha)";
  document.getElementById("drawerContinueBtn")?.insertAdjacentElement("beforebegin", repeat);
  repeat.hidden = true;
  const pauseButton = document.createElement("button");
  pauseButton.id = "lessonPause";
  pauseButton.type = "button";
  pauseButton.className = "lesson-quiet-action";
  pauseButton.textContent = "Odložiť lekciu";
  document.querySelector(".lesson-toggles")?.insertAdjacentElement("afterend", pauseButton);
  pauseButton.onclick = () => pause(duoLesson);
  const model = duoLesson;
  document.getElementById("continuePathBtn")?.addEventListener(
    "click",
    (e) => {
      const entries = Object.values(read()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      for (const snapshot of entries) {
        const world = WORLDS_DATA.find((w) => w.levels.some((l) => l.id === snapshot.levelId));
        const level = world?.levels.find((l) => l.id === snapshot.levelId);
        if (level && valid(snapshot, level)) {
          e.stopImmediatePropagation();
          model.openLevelPopover(level, world);
          return;
        }
      }
    },
    true,
  );
  const open = model.openLevelPopover.bind(model);
  model.openLevelPopover = function (...args) {
    open(...args);
    const level = args[0];
    describe(level);
  };
  const next = model.loadNextItem.bind(model);
  model.loadNextItem = function () {
    next();
    if (!this.isSosDrill && this.pathSession && this.isLessonActive) {
      const demo = lessonGuides[this.currentLevel?.id];
      activeTechnique.hidden = !demo;
      activeTechnique.open = false;
      const hintSummary = document.querySelector(".lesson-hint > summary");
      if (hintSummary) hintSummary.textContent = demo ? "Tip a ukážka techniky" : "Tip k cvičeniu";
      if (demo) {
        activeTechnique.querySelector("strong").textContent = demo.title;
        activeTechnique.querySelector("p").textContent = demo.hint;
        activeTechnique.querySelector("ol").replaceChildren(...demo.steps.map(step => { const item = document.createElement("li"); item.textContent = step; return item; }));
        renderDemo(activeTechnique.querySelector("div"), demo);
      }
      save(this);
      const item = this.currentWordItem;
      const eyebrow = document.querySelector(".lesson-eyebrow");
      if (eyebrow)
        eyebrow.textContent = `${item.round + 1}. KOLO · ${root.GlideLessonPlan.roundNames[item.round].toUpperCase()}`;
      if (pauseButton) pauseButton.hidden = false;
      const stage = document.getElementById("lessonScreen");
      stage.dataset.taskKind = item.kind;
      if (item.freeReply && item.kind === "sentence")
        document.getElementById("targetWord").textContent = item.word;
      repeat.hidden = true;
    } else {
      activeTechnique.hidden = true;
      const hintSummary = document.querySelector(".lesson-hint > summary");
      if (hintSummary) hintSummary.textContent = "Tip k cvičeniu";
      pauseButton.hidden = true;
      repeat.hidden = true;
      document.getElementById("lessonScreen").removeAttribute("data-task-kind");
      const eyebrow = document.querySelector(".lesson-eyebrow");
      if (eyebrow) eyebrow.textContent = "VLASTNÝM TEMPOM";
    }
  };
  const result = model.handleAttemptResult.bind(model);
  model.handleAttemptResult = function (data) {
    result(data);
    save(this);
    repeat.hidden = this.isSosDrill || !data.passed || this.initialWordCount >= 64;
  };
  const advance = model.handleDrawerContinue.bind(model);
  model.handleDrawerContinue = function () {
    if (this.conversation?.waitingForChoice) return;
    if (!document.getElementById("feedbackDrawer")?.classList.contains("active")) return;
    const current = this.currentWordItem,
      next = this.lessonQueue[0];
    if (
      !this.isSosDrill &&
      this.pathSession &&
      next &&
      current &&
      next.round > current.round &&
      !(this.seenRounds || []).includes(next.round)
    ) {
      document.getElementById("feedbackDrawer").classList.remove("active");
      this.seenRounds.push(next.round);
      const stored = save(this);
      document.getElementById("lessonRoundTitle").textContent =
        next.round === 1 ? "Rozohriatie je za tebou!" : "Hlavná výzva zvládnutá!";
      document.getElementById("lessonRoundDescription").textContent =
        `Ďalej: ${root.GlideLessonPlan.roundNames[next.round].toLowerCase()}. Pokračuj, keď budeš chcieť. ${stored ? "Pokrok je priebežne uložený na tomto zariadení." : "Pokrok sa nepodarilo uložiť. Skús uvoľniť úložisko zariadenia."}`;
      roundDialog.showModal();
      return;
    }
    advance();
  };
  document.getElementById("lessonRoundContinue").onclick = () => {
    roundDialog.close();
    model.loadNextItem();
  };
  document.getElementById("lessonRoundPause").onclick = () => pause(model);
  roundDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    pause(model);
  });
  repeat.onclick = () => {
    if (repeat.hidden || !model.currentWordItem) return;
    const clone = {
      ...model.currentWordItem,
      id: model.currentWordItem.id + "-repeat-" + crypto.randomUUID(),
      attempts: 0,
    };
    model.lessonQueue.unshift(clone);
    model.initialWordCount++;
    save(model);
    repeat.hidden = true;
    model.updateLessonProgress();
    document.getElementById("drawerSubtext").textContent = "Pridaná jedna dobrovoľná úloha.";
  };
  const exit = model.confirmExitLesson.bind(model);
  model.confirmExitLesson = function () {
    if (!this.isSosDrill && this.pathSession) pause(this);
    else exit();
  };
  root.addEventListener("pagehide", () => save(model));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save(model);
  });
  root.addEventListener("dsp-evaluation-complete", () => save(model));
  // New scenario text uses on-device speech if no bundled recording exists.
  for (const question of root.GlideLessonPlan.questions()) {
    if (!root.QUESTION_BANK.some((q) => q.id === question.id)) root.QUESTION_BANK.push(question);
  }
  root.GlideLessons = { prepare, save, clear, pause, saved };
})(window);
