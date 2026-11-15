(() => {
  "use strict";

  const scenes = {
    cafe: {
      title: "V kaviarni",
      caller: "Baristka",
      avatar: "☕",
      voiceGender: "female",
      goal: "Objednaj si dve kávy a povedz, či ich chceš tu alebo so sebou.",
      opening: "Dobrý deň, čo si dáte?",
      audioUrl: "/audio/scenarios/glide-cafe-opening-v2.mp3",
      branches: [
        [
          "So sebou",
          /\bso sebou\b|\bzabalit\b/,
          "Pripravím vám objednávku so sebou. Prajete si k nej aj niečo malé?",
        ],
        [
          "Na mieste",
          /\bna mieste\b|\btu pri stole\b|\bna stol\b/,
          "Dobre, donesiem vám ju k stolu. Prajete si k tomu vodu?",
        ],
        [
          "Dve kávy",
          /\b(?:dve|2) (?:velke |male )?kavy\b/,
          "Dve kávy. Dáte si ich tu alebo so sebou?",
        ],
        [
          "Upresniť objednávku",
          null,
          "Prepáčte, čo vám mám pripraviť? Pokojne mi objednávku povedzte ešte raz.",
        ],
      ],
      closing: "Ďakujem. Je to všetko, čo si prajete?",
    },
    doctor: {
      title: "Telefonát do ambulancie",
      caller: "Recepcia ambulancie",
      avatar: "📞",
      voiceGender: "female",
      goal: "Spýtaj sa na termín návštevy a dohodni čas, ktorý ti vyhovuje.",
      opening: "Ambulancia, prosím.",
      openingVoices: [
        "/audio/scenarios/glide-ambulancia-leda.mp3",
        "/audio/scenarios/glide-ambulancia-despina.mp3",
      ],
      branches: [
        [
          "Dohodnúť termín",
          /\btermin\w*\b|\bobjednat\w*\b/,
          "Najbližší voľný termín máme v piatok popoludní. Vyhovuje vám?",
        ],
        [
          "Zmeniť termín",
          /\bzmenit\w*\b|\bpresunut\w*\b/,
          "Na ktorý deň chcete návštevu presunúť?",
        ],
        ["Upresniť požiadavku", null, "Môžete mi povedať, kvôli čomu voláte?"],
      ],
      closing: "Rozumiem. Chcete si pred skončením hovoru ešte niečo overiť?",
    },
    shop: {
      title: "V predajni",
      caller: "Predavač",
      avatar: "🛍️",
      voiceGender: "male",
      goal: "Odpovedz, ako chceš zaplatiť.",
      opening: "V hotovosti alebo kartou?",
      audioUrl: "/audio/scenarios/glide-shop-opening-v2.mp3",
      branches: [
        ["Kartou", /\bkart\w*\b/, "Dobre, môžete priložiť kartu."],
        ["V hotovosti", /\bhotovost\w*\b|\bcash\b/, "Dobre, zaplatíte v hotovosti."],
        ["Upresniť platbu", null, "Prosím vás, ako chcete zaplatiť?"],
      ],
      closing: "Ďakujem pekne, dovidenia.",
    },
    own: {
      title: "Vlastná situácia",
      caller: "Partner v rozhovore",
      avatar: "💬",
      voiceGender: "male",
      goal: "",
      opening: "Haló, prosím?",
      audioUrl: "/audio/scenarios/glide-own-opening-base.mp3",
      branches: [
        [
          "Doplniť podrobnosti",
          /\bpotrebujem\b|\bchcel\w*\b|\bprosim\b/,
          "Rozumiem. Čo je pre vás v tejto situácii najdôležitejšie?",
        ],
        [
          "Skúsiť inú možnosť",
          /\binak\b|\bina\b|\biny\b|\binou\b/,
          "Aká iná možnosť by vám vyhovovala?",
        ],
        ["Upresniť povedané", null, "Môžete mi vlastnými slovami upresniť, čo potrebujete?"],
      ],
      closing: "Ďakujem. Ako by sme to mohli uzavrieť?",
    },
  };

  function normalize(text) {
    return String(text || "")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase("sk")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function interpret(sceneId, transcript) {
    const text = normalize(transcript);
    if (!text || !scenes[sceneId]) return null;
    // Never guess when words that change intent make an answer uncertain.
    const negative = /\b(?:nie|bez|neda|ne(?:mam|mas|maju|chc|potreb|vyhov|plat|zaplat|moz|fung|ber|prijim|viem|vedel)\w*)\b/;
    if (negative.test(text)) {
      // Resolve only clear contrasts between the two alternatives in these scenes.
      const parts = text.split(/\s+(?:ale|avsak)\s+/);
      const patterns = sceneId === "shop"
        ? [/\bkart\w*\b/, /\b(?:hotovost\w*|cash)\b/]
        : sceneId === "cafe" ? [/\bso sebou\b/, /\b(?:na mieste|tu pri stole|na stol)\b/] : null;
      if (!patterns || parts.length !== 2 || !negative.test(parts[0]) || negative.test(parts[1]) || /\bnie\s+(?:len|iba)\b/.test(parts[0])) return null;
      const rejected = patterns.map(pattern => pattern.test(parts[0]));
      const preferred = patterns.map(pattern => pattern.test(parts[1]));
      if (rejected.filter(Boolean).length !== 1 || preferred.filter(Boolean).length !== 1 || rejected.indexOf(true) === preferred.indexOf(true)) return null;
      return preferred.indexOf(true);
    }
    const found =
      scenes[sceneId]?.branches.flatMap(([, pattern], index) =>
        pattern?.test(text) ? [index] : [],
      ) || [];
    if (sceneId === "cafe" && text === "tu") return 1;
    if (sceneId === "cafe" && found.length === 2 && found.includes(2)) {
      return found.find((index) => index !== 2);
    }
    if (sceneId === "doctor" && found.includes(1)) return 1;
    return found.length === 1 ? found[0] : null;
  }

  let nextDoctorVoice = 0;
  function takeDoctorVoice(voices) {
    const key = "glide_doctor_opening_voice";
    let index = nextDoctorVoice;
    try {
      const stored = localStorage.getItem(key);
      if (stored === "0" || stored === "1") index = Number(stored);
      localStorage.setItem(key, String(1 - index));
    } catch {
      // Keep alternating in this session when browser storage is unavailable.
    }
    nextDoctorVoice = 1 - index;
    return voices[index];
  }

  const recordedLines = {
    cafe: { branches: ["cafe-branch-takeaway", "cafe-branch-table", "cafe-branch-coffee", "cafe-branch-clarify"], closing: "cafe-close" },
    doctor: { branches: ["doctor-branch-book", "doctor-branch-change", "doctor-branch-clarify"], closing: "doctor-close" },
    shop: { branches: ["shop-card-v2", "shop-cash-v2", "shop-clarify-v2"], closing: "shop-close-v2" },
    own: { branches: ["own-branch-details", "own-branch-other", "own-branch-clarify"], closing: "own-close" },
  };
  const newScenarios = [{"id":"job","title":"Pracovný telefonát","caller":"Personalistka","avatar":"💼","voiceGender":"female","goal":"Opýtaj sa na pracovnú ponuku a dohodni si ďalší krok.","opening":"Dobrý deň, personálne oddelenie, prosím?","branches":[["Záujem o ponuku","ponuk|prac|pozic|miest","Ďakujem za záujem. Kedy by ste mohli prísť na stretnutie?"],["Upresniť dôvod","","Prepáčte, môžete mi povedať, kvôli čomu voláte?"]],"closing":"Ďakujem, ozveme sa vám. Je to takto v poriadku?","followup":"Chceli by ste sa ešte na niečo spýtať?","surprise":"Ešte sa spýtam, vyhovovalo by vám dopoludnie?","voices":["Leda","Despina"]},{"id":"directions","title":"Pýtaš sa na cestu","caller":"Okoloidúci","avatar":"🧭","voiceGender":"male","goal":"Opýtaj sa na cestu na miesto, kam chceš ísť.","opening":"Dobrý deň, môžem vám pomôcť?","branches":[["Opýtať sa na cestu","cest|stanic|cent|kde|dostat","Jasné. Hľadáte zastávku alebo idete pešo?"],["Upresniť miesto","","Prepáčte, môžete mi ešte raz povedať, kam sa chcete dostať?"]],"closing":"Choďte rovno a potom odbočte doľava. Pomôže vám to?","followup":"Potrebujete ešte niečo upresniť?","surprise":"Ešte jedna vec, máte mapu v telefóne?","voices":["Charon","Achird"]},{"id":"restaurant","title":"Rezervácia stola","caller":"Obsluha reštaurácie","avatar":"🍽️","voiceGender":"female","goal":"Rezervuj stôl na čas a počet ľudí podľa seba.","opening":"Dobrý deň, reštaurácia, ako vám môžem pomôcť?","branches":[["Rezervovať stôl","rezerv|stol|miest","Na ktorý deň a pre koľko ľudí si prajete rezerváciu?"],["Upresniť požiadavku","","Prepáčte, môžete mi povedať, čo by ste potrebovali?"]],"closing":"Ďakujem, pozriem sa na voľné miesta. Je to všetko?","followup":"Prajete si ešte niečo doplniť?","surprise":"Ešte sa spýtam, vyhovoval by vám aj stôl pri okne?","voices":["Leda","Despina"]},{"id":"complaint","title":"Reklamácia objednávky","caller":"Pracovník predajne","avatar":"📦","voiceGender":"male","goal":"Vysvetli, čo sa stalo s objednávkou a čo by si potreboval/a.","opening":"Dobrý deň, ako vám môžem pomôcť?","branches":[["Problém s objednávkou","objednav|reklam|tovar|pokazen|chyba","Rozumiem. Môžete mi povedať, čo sa s objednávkou stalo?"],["Upresniť požiadavku","","Prepáčte, môžete mi ešte raz povedať, čo potrebujete vyriešiť?"]],"closing":"Pozriem sa na možnosti riešenia. Je to takto v poriadku?","followup":"Potrebujete ešte s niečím pomôcť?","surprise":"Ešte sa spýtam, máte číslo objednávky?","voices":["Charon","Achird"]}];
  const safeScenePatterns = {
    job: /\b(?:ponuk\w*|prac\w*|pozici\w*|volne miesto)\b/,
    directions: /\b(?:stanic\w*|vlakova stanica)\b/,
    restaurant: /\b(?:rezerv\w*|stol(?:a|u|om|y|ov|ik|ika|iku|ikom)?|miest(?:o|a|om|ach)?)\b/,
    complaint: /\b(?:objednav\w*|reklam\w*|tovar\w*|pokazen\w*|chyb\w*)\b/,
  };
  for (const entry of newScenarios) {
    if (entry.id === "directions") {
      entry.title = "Cesta na stanicu";
      entry.goal = "V modelovej situácii sa opýtaj na cestu na stanicu.";
      entry.branches[0][0] = "Opýtať sa na stanicu";
    }
    scenes[entry.id] = { ...entry, audioUrl: "/audio/scenarios/glide-" + entry.id + "-opening.mp3",
      branches: entry.branches.map(([label, pattern, text], index) => [label, pattern && index === 0 ? safeScenePatterns[entry.id] : null, text]) };
    recordedLines[entry.id] = { branches: entry.branches.map((_, i) => entry.id + "-branch-" + i), closing: entry.id + "-close" };
  }
  const recordedUrl = (id) => "/audio/scenarios/glide-" + id + ".mp3";

  const extraQuestions = {
    cafe: "Dáte si ešte niečo?",
    doctor: "Môžem vám ešte s niečím pomôcť?",
    shop: "Prosíte si aj bloček?",
    own: "Je ešte niečo, čo by ste chceli doplniť?",
  };
  const surpriseQuestions = {
    cafe: "Ešte sa spýtam, chcete kávu s mliekom?",
    doctor: "Ešte sa spýtam, ktorý deň vám najviac vyhovuje?",
    shop: "Ešte sa spýtam, potrebujete tašku?",
    own: "Ešte mi povedzte, kedy by vám to vyhovovalo?",
  };
  const alternateOpenings = {
    cafe: "cafe-opening-v2-alt",
    shop: "shop-opening-v2-alt",
    own: "own-opening-alt",
  };
  for (const entry of newScenarios) {
    extraQuestions[entry.id] = entry.followup;
    surpriseQuestions[entry.id] = entry.surprise;
    alternateOpenings[entry.id] = entry.id + "-opening-alt";
  }
  const turns = new Map();
  function nextTurn(sceneId) {
    const storageKey = "glide_conversation_turn_" + sceneId;
    let next = turns.get(sceneId) || 0;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "0" || saved === "1") next = Number(saved);
      localStorage.setItem(storageKey, String(1 - next));
    } catch (_) {}
    turns.set(sceneId, 1 - next);
    return next;
  }
  function lineUrl(plan, name) {
    return recordedUrl(name + (plan.alternateVoice ? "-alt" : ""));
  }

  function create(sceneId, goal) {
    const scene = scenes[sceneId];
    const turn = nextTurn(sceneId);
    const completed = completedSimulations();
    const bonusEligible = completed >= 2 && completed % 2 === 0;
    const openingAudio = scene.openingVoices
      ? takeDoctorVoice(scene.openingVoices)
      : turn ? recordedUrl(alternateOpenings[sceneId]) : scene.audioUrl;
    const alternateVoice = scene.openingVoices ? openingAudio.includes("-leda.mp3") : !!turn;
    const question = (promptText, audioUrl = null) => ({
      category: "conversation",
      caller: scene.caller,
      avatar: scene.avatar,
      voiceGender: scene.voiceGender,
      promptText,
      audioUrl,
    });
    return {
      sceneId,
      title: scene.title,
      goal,
      waitingForChoice: false,
      alternateVoice,
      alternateQuestion: !!turn,
      bonusEligible,
      tasks: [
        { word: "Začni rozhovor", question: question(scene.opening, openingAudio) },
        { word: "Reaguj vlastnými slovami", question: question(scene.branches.at(-1)[2], recordedUrl(recordedLines[sceneId].branches.at(-1) + (alternateVoice ? "-alt" : ""))) },
        { word: "Ukonči rozhovor", question: question(turn ? extraQuestions[sceneId] : scene.closing, recordedUrl((turn ? sceneId + "-followup" : recordedLines[sceneId].closing) + (alternateVoice ? "-alt" : ""))) },
      ].map((task) => ({ ...task, freeReply: true, attempts: 0 })),
    };
  }

  const dialog = document.createElement("div");
  dialog.id = "conversationDialog";
  dialog.className = "conversation-dialog conversation-surface";
  dialog.setAttribute("aria-labelledby", "conversationTitle");
  dialog.innerHTML = `
    <p class="conversation-eyebrow">TVOJ PRIESTOR NA ROZHOVOR</p>
    <h1 id="conversationTitle">Nácvik rozhovoru</h1>
    <p class="conversation-intro">Vyber si situáciu a trénuj vlastným tempom.</p>
    <div class="conversation-mode" role="group" aria-label="Typ rozhovoru">
      <button type="button" id="conversationPracticeMode" aria-pressed="true">Precvičiť v aplikácii</button>
      <button type="button" id="conversationLifeMode" aria-pressed="false">Môj skutočný rozhovor</button>
    </div>
    <p class="conversation-mode-help" id="conversationModeHelp">Aplikácia prehrá repliky a ty odpovedáš vlastnými slovami.</p>
    <details class="spontaneous-card" id="spontaneousActivities">
      <summary><span class="spontaneous-icon" aria-hidden="true">✦</span><span class="spontaneous-heading"><strong>Spontánne miniaktivity</strong><small>Tri krátke otázky · odpovedáš po svojom</small></span><span class="spontaneous-arrow" aria-hidden="true">⌄</span></summary>
      <p>Vyber si, čím chceš začať. Každá odpoveď je tvoja.</p>
      <div id="spontaneousChoices" class="spontaneous-choices"></div>
      <button type="button" id="spontaneousShuffle">Iné nápady ↻</button>
    </details>
    <form id="conversationForm">
      <span class="conversation-scene-label" id="conversationSceneLabel">Vyber situáciu</span>
      <p class="conversation-favorite-hint">Hviezdičkou si ulož obľúbené situácie navrch.</p>
      <div id="conversationSceneCards" class="conversation-scene-cards" role="group" aria-labelledby="conversationSceneLabel"></div>
      <select id="conversationScene" data-glide-select="scene-cards" aria-label="Situácia" aria-hidden="true" tabindex="-1" class="conversation-scene-select"></select>
      <label for="conversationGoal">Čo chceš povedať alebo vybaviť?</label>
      <textarea id="conversationGoal" maxlength="140" rows="2" required></textarea>
      <button class="btn-3d green full" id="conversationStart">Začať rozhovor</button>
      <div class="situation-actions"><button type="button" id="personalMapLesson">Lekcia v Ceste</button><button type="button" id="personalMapLife">Naplánovať malý krok</button></div>
      <small id="personalMapStatus" role="status"></small>
    </form>
    <button type="button" id="conversationPending" class="conversation-pending" hidden><span>Tvoj plán</span><strong id="conversationPendingTitle"></strong><span id="conversationPendingGoal"></span><span>Zaznamenať, ako to dopadlo →</span></button>
    <section id="conversationCheckin" hidden>
      <form id="conversationBeforeForm">
        <div class="life-heading"><span aria-hidden="true">✎</span><div><h3>Môj ďalší krok</h3><p>Naplánuj si rozhovor, ktorý chceš skúsiť.</p></div></div>
        <label for="conversationLifeGoal">Čo chceš vybaviť alebo povedať?</label>
        <textarea id="conversationLifeGoal" maxlength="140" rows="2" placeholder="Napríklad objednať sa k lekárovi"></textarea>
        <fieldset class="conversation-rating" id="conversationBeforeRating"></fieldset>
        <button type="submit" class="btn-3d green full">Uložiť môj plán</button>
        <button type="button" id="conversationAlreadyDone" class="lesson-quiet-action">Chcem zaznamenať rozhovor, ktorý už prebehol</button>
      </form>
      <form id="conversationCheckinForm">
        <h3>Po rozhovore</h3>
        <fieldset class="conversation-rating">
          <legend>Podarilo sa ti povedať, čo si chcel/a?</legend>
          <label><input type="radio" name="conversationOutcome" value="yes" required><span>Áno</span></label>
          <label><input type="radio" name="conversationOutcome" value="partly"><span>Čiastočne</span></label>
          <label><input type="radio" name="conversationOutcome" value="no"><span>Ešte nie</span></label>
        </fieldset>
        <fieldset class="conversation-rating">
          <legend>Ako náročný bol rozhovor?</legend>
          <label><input type="radio" name="conversationEffort" value="1" required><span>Zvládnuteľný</span></label>
          <label><input type="radio" name="conversationEffort" value="2"><span>Stredný</span></label>
          <label><input type="radio" name="conversationEffort" value="3"><span>Náročný</span></label>
        </fieldset>
        <fieldset class="conversation-rating" id="conversationAfterRating"></fieldset>
        <fieldset class="conversation-rating">
          <legend>Čo ti pomohlo? (voliteľné)</legend>
          <label><input type="checkbox" name="conversationHelp" value="pause"><span>Krátka pauza</span></label>
          <label><input type="checkbox" name="conversationHelp" value="onset"><span>Jemný začiatok</span></label>
          <label><input type="checkbox" name="conversationHelp" value="practice"><span>Príprava vopred</span></label>
          <label><input type="checkbox" name="conversationHelp" value="pace"><span>Vlastné tempo</span></label>
        </fieldset>
        <button class="btn-3d green full">Uložiť záznam</button>
      </form>
    </section>
    <p id="conversationRecommendation" role="status"></p>
  `;
  document.getElementById("conversationPage").append(dialog);

  const byId = (id) => document.getElementById(id);
  const sceneSelect = byId("conversationScene");
  const goalInput = byId("conversationGoal");
  const status = byId("conversationRecommendation");
  const checkin = byId("conversationCheckin");
  const beforeForm = byId("conversationBeforeForm");
  const afterForm = byId("conversationCheckinForm");
  const practiceMode = byId("conversationPracticeMode");
  const lifeMode = byId("conversationLifeMode");
  const conversationHelp = document.createElement("details");
  conversationHelp.id = "conversationHelp";
  conversationHelp.className = "conversation-help";
  conversationHelp.hidden = true;
  conversationHelp.innerHTML = '<summary>Pomôž mi začať ✨</summary><p id="conversationHelpQuestion"></p><p id="conversationHelpHint">Pokojne sa na chvíľu zastav. Odpoveď nemusí mať presné znenie – povedz ju po svojom.</p><button type="button" id="conversationReplay">Prehrať otázku znova</button><small id="conversationHelpStatus" role="status"></small>';
  byId("lessonConversationGoal").after(conversationHelp);
  let replayAudio = null;
  function stopReplay() {
    if (replayAudio) { replayAudio.pause(); replayAudio.currentTime = 0; replayAudio = null; }
  }
  byId("conversationReplay").onclick = () => {
    const question = duoLesson.currentWordItem?.question;
    const status = byId("conversationHelpStatus");
    if (byId("startBtn").disabled) { status.textContent = "Otázku si môžeš prehrať pred spustením ďalšieho pokusu."; return; }
    if (!question?.audioUrl) { status.textContent = "Nahrávka nie je k dispozícii. Otázku si môžeš prečítať vyššie."; return; }
    stopReplay(); status.textContent = "";
    const player = replayAudio = new Audio(question.audioUrl);
    player.onended = () => { if (replayAudio === player) replayAudio = null; };
    player.play().catch(() => { if (replayAudio === player) { replayAudio = null; status.textContent = "Nahrávku sa nepodarilo prehrať."; } });
  };
  byId("startBtn").addEventListener("click", stopReplay, true);
  const loadConversationItem = duoLesson.loadNextItem.bind(duoLesson);
  duoLesson.loadNextItem = function () {
    stopReplay(); loadConversationItem();
    const visible = !!this.isLessonActive && !!this.conversation && !this.conversation.miniActivity && !!this.currentWordItem;
    conversationHelp.hidden = !visible; conversationHelp.open = false;
    if (visible) {
      byId("conversationHelpQuestion").textContent = this.currentWordItem.question?.promptText || "Vypočuj si otázku a odpovedz po svojom.";
      byId("conversationHelpStatus").textContent = "";
    }
  };
  let openedFor;
  let pending;
  let lifeSceneId = "own";
  const key = () =>
    "glide_conversations_v1_" + (window.fluencyAuth?.getCurrentUser()?.id || "guest");
  const draftKey = () => key() + ":plan";
  const simulationKey = () => key() + ":simulations-completed";
  const experienceKey = () => key() + ":experiences";
  const preferenceKey = () => key() + ":practice-preference";
  const personalMapKey = () => key() + ":personal-map";
  function experiences() {
    try { const value = JSON.parse(localStorage.getItem(experienceKey()) || "[]"); return Array.isArray(value) ? value.filter(x => scenes[x.sceneId]) : []; }
    catch { return []; }
  }
  function practicePreference() {
    try { const value = JSON.parse(localStorage.getItem(preferenceKey()) || "null"); return value && scenes[value.sceneId] ? value : null; }
    catch { return null; }
  }
  function completedSimulations() {
    try { return Math.max(0, Number.parseInt(localStorage.getItem(simulationKey()), 10) || 0); }
    catch { return 0; }
  }
  for (const [id, label] of [
    ["Before", "Ako sa cítiš pred rozhovorom?"],
    ["After", "Ako sa cítiš po rozhovore?"],
  ]) {
    byId(`conversation${id}Rating`).innerHTML = `
      <legend>${label} (voliteľné)</legend>
      <label><input type="radio" name="feeling" value="calm"><span>Pokojne</span></label>
      <label><input type="radio" name="feeling" value="neutral"><span>Neutrálne</span></label>
      <label><input type="radio" name="feeling" value="tense"><span>Napäto</span></label>`;
  }
  const choiceBox = document.createElement("div");
  choiceBox.id = "conversationChoices";
  choiceBox.tabIndex = -1;
  choiceBox.className = "conversation-branches";
  choiceBox.hidden = true;
  byId("drawerContinueBtn").before(choiceBox);

  function savedMap() {
    try { const value = JSON.parse(localStorage.getItem(personalMapKey()) || "[]"); return Array.isArray(value) ? value.filter(id => Object.hasOwn(scenes, id)) : []; }
    catch { return []; }
  }
  const sceneItems = new Map();
  for (const [id, scene] of Object.entries(scenes)) {
    sceneSelect.add(new Option(scene.title, id));
    const item = document.createElement("div"); item.className = "conversation-scene-item";
    const card = document.createElement("button"); card.type = "button"; card.className = "conversation-scene-card";
    card.dataset.scene = id; card.setAttribute("aria-pressed", "false");
    const icon = document.createElement("span"); icon.className = "conversation-scene-icon"; icon.setAttribute("aria-hidden", "true"); icon.textContent = scene.avatar;
    const title = document.createElement("span"); title.textContent = scene.title;
    card.append(icon, title); card.addEventListener("click", () => select(id));
    const favorite = document.createElement("button"); favorite.type = "button"; favorite.className = "conversation-favorite";
    favorite.addEventListener("click", () => {
      const selected = savedMap();
      const next = selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id];
      try { localStorage.setItem(personalMapKey(), JSON.stringify(next)); renderMap(); favorite.focus({ preventScroll: true }); }
      catch { byId("personalMapStatus").textContent = "Obľúbenú situáciu sa nepodarilo uložiť v tomto zariadení."; }
    });
    item.append(card, favorite); sceneItems.set(id, { item, card, favorite });
  }
  function renderMap() {
    const favorites = savedMap(); const container = byId("conversationSceneCards");
    const ids = [...sceneItems.keys()].sort((a, b) => Number(favorites.includes(b)) - Number(favorites.includes(a)));
    for (const id of ids) {
      const { item, favorite } = sceneItems.get(id); const selected = favorites.includes(id);
      favorite.textContent = selected ? "★" : "☆";
      favorite.setAttribute("aria-pressed", String(selected));
      favorite.setAttribute("aria-label", selected ? `Odobrať ${scenes[id].title} z obľúbených` : `Pridať ${scenes[id].title} medzi obľúbené`);
      container.append(item);
    }
  }
  byId("personalMapLife").onclick = () => {
    const sceneId = sceneSelect.value; if (!scenes[sceneId]) return;
    if (pending) { byId("personalMapStatus").textContent = "Najprv dokonči alebo zaznamenaj uložený plán v časti Môj skutočný rozhovor."; return; }
    lifeSceneId = sceneId; byId("conversationLifeGoal").value = goalInput.value.trim() || scenes[sceneId].goal;
    showMode(true, false); byId("conversationLifeGoal").focus();
  };
  byId("personalMapLesson").onclick = () => {
    const sceneId = sceneSelect.value; if (!scenes[sceneId]) return;
    const lessonId = ({ cafe: "4.1", shop: "4.1", doctor: "5.2", job: "5.1", directions: "4.2", restaurant: "4.3", complaint: "5.3", own: "1.1" })[sceneId];
    const world = WORLDS_DATA.find(item => item.levels.some(level => level.id === lessonId));
    const level = world?.levels.find(item => item.id === lessonId);
    if (!level || !duoState.isUnlocked(lessonId)) { byId("personalMapStatus").textContent = "Táto lekcia je zatiaľ zamknutá. Pokračuj v Ceste svojím tempom."; return; }
    byId("navTabCesta").click(); duoLesson.openLevelPopover(level, world);
  };
  const miniPrompts = [
    ["Čo sa ti dnes podarilo?", "Opíš niečo, čo máš práve na očiach.", "Čo by si si teraz rád/rada dal/a?"],
    ["Ktoré miesto máš rád/rada a prečo?", "Čo by si chcel/a robiť cez víkend?", "Akú hudbu si naposledy počúval/a?"],
    ["Povedz svoj názor na ranné vstávanie.", "Čo by si odporučil/a návšteve svojho mesta?", "Opíš svoj obľúbený deň."],
  ];
  let miniSet = 0;
  function renderMiniChoices() {
    const box = byId("spontaneousChoices"); box.replaceChildren();
    miniPrompts[miniSet].forEach((prompt, index) => {
      const button = document.createElement("button"); button.type = "button"; button.textContent = prompt;
      button.onclick = () => {
        const ordered = [...miniPrompts[miniSet].slice(index), ...miniPrompts[miniSet].slice(0, index)];
        const plan = { miniActivity: true, title: "Spontánna chvíľka", goal: "Odpovedz vlastnými slovami. Neexistuje správna odpoveď.", tasks: ordered.map(word => ({ word, freeReply: true, attempts: 0 })) };
        duoLesson.launchSosDrill(plan); byId("startBtn").focus({ preventScroll: true });
      };
      box.append(button);
    });
  }
  byId("spontaneousShuffle").onclick = () => { miniSet = (miniSet + 1) % miniPrompts.length; renderMiniChoices(); };
  renderMiniChoices();
  function records() {
    try {
      const stored = JSON.parse(localStorage.getItem(key()) || "[]");
      return Array.isArray(stored)
        ? stored.filter((entry) => Object.hasOwn(scenes, entry?.sceneId))
        : [];
    } catch {
      return [];
    }
  }
  function recommend(entry) {
    if (entry.outcome !== "yes" || entry.effort >= 2 || entry.sceneId === "own")
      return entry.sceneId;
    const ids = ["cafe", "doctor", "shop", "directions", "restaurant", "job", "complaint"];
    return ids[(ids.indexOf(entry.sceneId) + 1) % ids.length];
  }
  function select(sceneId, goal) {
    sceneSelect.value = sceneId;
    byId("personalMapStatus").textContent = "";
    dialog.querySelectorAll(".conversation-scene-card").forEach((card) => card.setAttribute("aria-pressed", String(card.dataset.scene === sceneId)));
    goalInput.value = goal ?? scenes[sceneId].goal;
    goalInput.placeholder = "Napríklad dohodnúť si nový termín";
    window.GlideSelect?.refresh();
  }
  function showMode(life, after = false) {
    byId("conversationModeHelp").textContent = life
      ? "Naplánuj si skutočný rozhovor a po ňom si zaznamenaj svoju skúsenosť."
      : "Aplikácia prehrá repliky a ty odpovedáš vlastnými slovami.";
    practiceMode.setAttribute("aria-pressed", String(!life));
    lifeMode.setAttribute("aria-pressed", String(life));
    dialog.dataset.mode = life ? "life" : "practice";
    byId("conversationForm").hidden = life;
    byId("spontaneousActivities").hidden = life;
    const hasPendingCard = life && !!pending && !after;
    byId("conversationPending").hidden = !hasPendingCard;
    checkin.hidden = !life || hasPendingCard;
    beforeForm.hidden = after;
    afterForm.hidden = !after;
    if (life && pending) {
      lifeSceneId = pending.sceneId;
      byId("conversationLifeGoal").value = pending.goal;
    }
  }

  function selectedSituation() {
    const life = lifeMode.getAttribute("aria-pressed") === "true";
    const sceneId = life ? lifeSceneId : sceneSelect.value;
    const activeInput = life ? byId("conversationLifeGoal") : goalInput;
    const goal = activeInput.value.trim();
    if (openedFor !== key()) {
      status.textContent = "Účet sa zmenil. Otvor rozhovor znova.";
      return null;
    }
    if (!scenes[sceneId] || !goal) {
      status.textContent = "Doplň, čo chceš povedať alebo vybaviť.";
      activeInput.focus();
      return null;
    }
    return { sceneId, goal };
  }

  function open(plan) {
    openedFor = key();
    renderMap();
    beforeForm.reset();
    afterForm.reset();
    try {
      pending = JSON.parse(localStorage.getItem(draftKey()));
      if (!scenes[pending?.sceneId] || !pending.goal) pending = null;
    } catch { pending = null; }
    const entries = records();
    const last = entries.at(-1);
    const preference = practicePreference();
    const ids = ["cafe", "shop", "directions", "restaurant", "doctor", "job", "complaint"];
    const preferenceScene = preference && (preference.feeling === "hard" ? "cafe" : preference.feeling === "easy" ? ids[(Math.max(0, ids.indexOf(preference.sceneId)) + 1) % ids.length] : preference.sceneId);
    const next = plan?.sceneId || (preference && (!last || preference.date > last.date) ? preferenceScene : last ? recommend(last) : "cafe");
    select(next, plan?.goal ?? (last?.sceneId === next ? last.goal : undefined));
    lifeSceneId = plan?.sceneId || pending?.sceneId || "own";
    byId("conversationLifeGoal").value = plan?.goal || pending?.goal || "";
    byId("conversationPendingTitle").textContent = pending ? scenes[pending.sceneId].title : "";
    byId("conversationPendingGoal").textContent = pending?.goal || "";
    showMode(!!plan, !!plan);
    const successes = entries.filter((entry) => entry.outcome === "yes").length;
    status.textContent = preference && !plan && (!last || preference.date > last.date)
      ? `Podľa tvojho pocitu navrhujeme: ${scenes[next].title}. Môžeš si vybrať aj inú situáciu.`
      : last
      ? `Zaznamenané rozhovory: ${entries.length}. Cieľ splnený: ${successes}. Návrh na nácvik: ${scenes[recommend(last)].title}.`
      : "";

  }
  byId("conversationPending").onclick = () => showMode(true, true);
  practiceMode.onclick = () => showMode(false);
  lifeMode.onclick = () => showMode(true);
  byId("conversationAlreadyDone").onclick = () => {
    showMode(true, true);
    afterForm.querySelector("button").focus({ preventScroll: true });
  };
  beforeForm.onsubmit = (event) => {
    event.preventDefault();
    const situation = selectedSituation();
    if (!situation) return;
    const draft = { ...situation, beforeFeeling: new FormData(beforeForm).get("feeling") };
    try {
      localStorage.setItem(draftKey(), JSON.stringify(draft));
      pending = draft;
      byId("conversationPendingTitle").textContent = scenes[draft.sceneId].title;
      byId("conversationPendingGoal").textContent = draft.goal;
      showMode(true);
      status.textContent = "Plán je uložený. Po rozhovore sa môžeš vrátiť k záznamu.";
    } catch {
      status.textContent = "Plán sa nepodarilo uložiť na tomto zariadení.";
    }
  };
  sceneSelect.onchange = () => select(sceneSelect.value);

  byId("conversationForm").onsubmit = (event) => {
    event.preventDefault();
    const situation = selectedSituation();
    if (!situation || !checkin.hidden) return;
    duoLesson.launchSosDrill(create(situation.sceneId, situation.goal));
    byId("startBtn").focus({preventScroll:true});
  };
  byId("conversationCheckinForm").onsubmit = (event) => {
    event.preventDefault();
    const situation = selectedSituation();
    if (!situation) return;
    const form = new FormData(event.currentTarget);
    const entry = {
      ...situation,
      beforeFeeling: pending?.sceneId === situation.sceneId && pending.goal === situation.goal
        ? pending.beforeFeeling : null,
      afterFeeling: form.get("feeling"),
      helpedBy: form.getAll("conversationHelp"),
      outcome: form.get("conversationOutcome"),
      effort: Number(form.get("conversationEffort")),
      date: Date.now(),
    };
    try {
      const entries = [...records(), entry];
      localStorage.setItem(key(), JSON.stringify(entries));
      if (pending?.sceneId === entry.sceneId && pending.goal === entry.goal) {
        localStorage.removeItem(draftKey());
        pending = null;
      }
      beforeForm.reset();
      afterForm.reset();
      lifeSceneId = "own";
      byId("conversationLifeGoal").value = "";
      showMode(true);
      const next = recommend(entry);
      select(next, next === entry.sceneId ? entry.goal : undefined);
      status.textContent = `Záznam uložený. Nabudúce skús: ${scenes[next].title}.`;
    } catch {
      status.textContent = "Záznam sa nepodarilo uložiť na tomto zariadení.";
    }
  };

  byId("navTabRozhovory").addEventListener("click", () => open());

  const recap = document.createElement("button");
  recap.type = "button";
  recap.id = "conversationRecap";
  recap.className = "practice-button";
  recap.textContent = "Vyskúšať podobný rozhovor v živote";
  recap.hidden = true;
  recap.onclick = () => {
    const plan = duoLesson.conversation;
    duoLesson.finishCelebration();
    byId("navTabRozhovory").click();
    open(plan);
    showMode(true, false);
    byId("conversationCheckin").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  byId("celebrationSub").after(recap);

  const reflection = document.createElement("div");
  reflection.className = "conversation-reflection";
  reflection.hidden = true;
  reflection.innerHTML = '<p>Ako sa ti v rozhovore cítilo? <span>(nepovinné)</span></p><div><button type="button" data-feeling="easy">Pohodovo</button><button type="button" data-feeling="okay">Tak akurát</button><button type="button" data-feeling="hard">Náročné</button></div><small role="status"></small>';
  recap.after(reflection);
  reflection.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    const plan = duoLesson.conversation;
    if (!plan || !scenes[plan.sceneId]) return;
    try {
      localStorage.setItem(preferenceKey(), JSON.stringify({ sceneId: plan.sceneId, feeling: button.dataset.feeling, date: Date.now() }));
      reflection.querySelectorAll("button").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      reflection.querySelector("small").textContent = "Ďakujeme, ďalší návrh prispôsobíme tvojmu pocitu. Výber je stále na tebe.";
    } catch { reflection.querySelector("small").textContent = "Pocit sa nepodarilo uložiť na tomto zariadení."; }
  }));

  const progressCard = document.createElement("div");
  progressCard.className = "conversation-progress-card";
  progressCard.innerHTML = '<strong>Tvoje rozhovorové zážitky ✨</strong><p></p><form><label for="conversationWin">Malé víťazstvo (nepovinné)</label><input id="conversationWin" maxlength="120" placeholder="Čo sa ti podarilo?"><button type="submit">Uložiť</button></form><ul></ul><small>Uložené v tomto zariadení pre tvoj účet.</small>';
  document.querySelector(".profile-challenges")?.append(progressCard);
  function renderExperiences() {
    const unique = [...new Set(experiences().map(entry => entry.sceneId))];
    progressCard.querySelector("p").textContent = unique.length
      ? `Vyskúšané situácie: ${unique.map(id => scenes[id].title).join(" · ")}`
      : "Tvoje vyskúšané situácie sa objavia tu.";
    let wins = [];
    try { wins = JSON.parse(localStorage.getItem(key() + ":wins") || "[]"); if (!Array.isArray(wins)) wins = []; } catch (_) {}
    const list = progressCard.querySelector("ul"); list.replaceChildren();
    wins.slice(-5).reverse().forEach(win => { const item = document.createElement("li"); item.textContent = String(win); list.append(item); });
  }
  progressCard.querySelector("form").onsubmit = event => {
    event.preventDefault();
    const input = progressCard.querySelector("input"); const value = input.value.trim(); if (!value) return;
    try { const wins = JSON.parse(localStorage.getItem(key() + ":wins") || "[]"); localStorage.setItem(key() + ":wins", JSON.stringify([...(Array.isArray(wins) ? wins : []), value].slice(-50))); input.value = ""; renderExperiences(); } catch (_) {}
  };
  byId("navTabTelemetria")?.addEventListener("click", renderExperiences);

  let ambienceAudio = null;
  let ambiencePlan = null;
  function stopAmbience() {
    stopReplay();
    if (ambienceAudio) { ambienceAudio.pause(); ambienceAudio.currentTime = 0; }
    ambienceAudio = null;
    ambiencePlan = null;
  }
  function startAmbience(plan) {
    if (!plan || document.hidden || ambiencePlan === plan) return;
    stopAmbience();
    ambiencePlan = plan;
    ambienceAudio = new Audio(plan.sceneId === "cafe" || plan.sceneId === "shop"
      ? "/audio/scenarios/glide-cafe-ambience.mp3" : "/audio/scenarios/glide-room-ambience.mp3");
    ambienceAudio.loop = true;
    ambienceAudio.volume = 0.05;
    const player = ambienceAudio;
    player.play().catch(() => { if (ambienceAudio === player) stopAmbience(); });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAmbience();
  });

  function reset() {
    stopAmbience();
    choiceBox.hidden = true;
    choiceBox.replaceChildren();
    byId("drawerContinueBtn").disabled = false;
    recap.hidden = true;
    reflection.hidden = true;
  }

  function afterAttempt(lesson, result) {
    const plan = lesson.conversation;
    if (!plan || plan.miniActivity || !result.passed) return;
    // Progress reflects completed conversations and captured responses, not fluency.
    if (plan.bonusEligible && !plan.bonusAdded && lesson.completedItemsCount === 3 &&
        lesson.totalAttemptsCount === 3 && lesson.lessonQueue.length === 0) {
      const scene = scenes[plan.sceneId];
      plan.bonusAdded = true;
      lesson.lessonQueue.push({
        word: "Odpovedz na doplňujúcu otázku",
        question: { category: "conversation", caller: scene.caller, avatar: scene.avatar,
          voiceGender: scene.voiceGender, promptText: surpriseQuestions[plan.sceneId],
          audioUrl: lineUrl(plan, plan.sceneId + "-surprise") },
        freeReply: true, attempts: 0,
      });
      lesson.initialWordCount++;
    }
    if (lesson.completedItemsCount === 2 && plan.sceneId === "cafe" && !plan.alternateQuestion) {
      const closing = lesson.lessonQueue[0]?.question;
      if (closing && result.conversationChoice === 0) {
        closing.promptText = "Zabalím vám objednávku so sebou. Je to všetko?";
        closing.audioUrl = lineUrl(plan, "cafe-close-takeaway");
      }
      if (closing && result.conversationChoice === 1) {
        closing.promptText = "Prinesiem vám objednávku k stolu. Je to všetko?";
        closing.audioUrl = lineUrl(plan, "cafe-close-table");
      }
    }
    if (lesson.completedItemsCount !== 1) return;
    const scene = scenes[plan.sceneId];
    const next = lesson.lessonQueue[0];
    const continueButton = byId("drawerContinueBtn");
    function apply(index) {
      const branch = scene.branches[index];
      if (!branch || !next) return;
      next.question.promptText = branch[2];
      next.question.audioUrl = lineUrl(plan, recordedLines[plan.sceneId].branches[index]);
      plan.waitingForChoice = false;
      continueButton.disabled = false;
      choiceBox.hidden = true;
      byId("drawerSubtext").textContent = "Nasleduje doplňujúca otázka.";
    }
    if (Number.isInteger(result.conversationChoice) && scene.branches[result.conversationChoice]) {
      apply(result.conversationChoice);
      return;
    }
    plan.waitingForChoice = true;
    continueButton.disabled = true;
    choiceBox.replaceChildren();
    const prompt = document.createElement("p");
    prompt.textContent = "Ako má rozhovor pokračovať?";
    choiceBox.append(prompt);
    scene.branches.forEach(([label], index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.textContent = label;
      option.onclick = () => apply(index);
      choiceBox.append(option);
    });
    choiceBox.hidden = false;
    choiceBox.focus({preventScroll:true});
  }

  window.GlideConversation = {
    interpret,
    startAmbience,
    stopAmbience,
    afterAttempt,
    reset,
    showRecap(plan) {
      stopAmbience();
      if (plan?.miniActivity) { recap.hidden = true; reflection.hidden = true; return; }
      if (plan && !plan.completionRecorded) {
        plan.completionRecorded = true;
        try {
          localStorage.setItem(simulationKey(), String(completedSimulations() + 1));
          localStorage.setItem(experienceKey(), JSON.stringify([...experiences(), { sceneId: plan.sceneId, date: Date.now() }].slice(-100)));
        } catch (_) {}
      }
      recap.hidden = !plan;
      reflection.hidden = !plan;
      reflection.querySelector("small").textContent = "";
      reflection.querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", "false"));
      renderExperiences();
    },
  };
})();
