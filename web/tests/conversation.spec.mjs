import { test, expect } from "@playwright/test";
test.use({ baseURL: "http://localhost:3000" });

async function open(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem("fl_guest_mode", "1");
    localStorage.setItem("fl_onboarding_completed", "1");
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-engine", "ready");
  await page.locator("#sidebarTabDril").click();
}

async function speak(page, transcript) {
  await page.evaluate((text) => {
    noiseDb = -70;
    const frames = Array.from({ length: 130 }, (_, i) => {
      const voiced = i >= 20 && i < 100;
      const rms = voiced ? 0.08 : 0.0001;
      return {
        t: i * 10,
        rawDb: 20 * Math.log10(rms),
        rawRms: rms,
        fDb: 20 * Math.log10(rms),
        fRms: rms,
        dPrime: voiced ? 0.1 : 0.9,
        zcr: voiced ? 0.1 : 0.8,
        clipped: false,
      };
    });
    runPostHocEvaluation(
      frames,
      {
        ...analyzePhonetics("odpoveď"),
        freeReply: true,
        conversation: duoLesson.conversation.sceneId,
      },
      600,
      5500,
      text,
    );
  }, transcript);
}

test("café rehearsal follows both responses and recommends a next scene from the real-life check-in", async ({
  page,
}) => {
  await open(page);
  await page.locator("#sidebarTabRozhovory").click();

  await page.getByRole("button", { name: "Začať rozhovor", exact: true }).click();
  await expect(page.locator("#lessonConversationGoal")).toContainText("dve kávy");
  expect(await page.evaluate(() => lessonScenario().audioUrl)).toContain("glide-cafe-opening");
  await speak(page, "Dve veľké kávy");
  await page.locator("#drawerContinueBtn").click();
  expect(await page.evaluate(() => lessonScenario().promptText)).toContain("Dve kávy");
  expect(await page.evaluate(() => lessonScenario().audioUrl)).toContain("glide-cafe-branch-coffee.mp3");
  await speak(page, "so sebou");
  await page.locator("#drawerContinueBtn").click();
  expect(await page.evaluate(() => lessonScenario().promptText)).toContain("Zabalím");
  expect(await page.evaluate(() => lessonScenario().audioUrl)).toContain("glide-cafe-close-takeaway.mp3");
  await speak(page, "Áno, ďakujem");
  await page.locator("#drawerContinueBtn").click();
  await expect(page.locator("#celebrationTitle")).toHaveText("Rozhovor dokončený");
  await page.locator("#conversationRecap").click();
  await expect(page.locator("#conversationLifeGoal")).toHaveValue(/dve kávy/i);
  await page.locator("#conversationAlreadyDone").click();
  await page.locator(".conversation-rating label").filter({ hasText: "Áno" }).click();
  await page.locator(".conversation-rating label").filter({ hasText: "Zvládnuteľný" }).click();
  await page.getByRole("button", { name: "Uložiť záznam", exact: true }).click();
  await expect(page.locator("#conversationRecommendation")).toContainText(
    "Telefonát do ambulancie",
  );
  const entries = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("glide_conversations_v1_guest")),
  );
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ sceneId: "cafe", outcome: "yes", effort: 1 });
});

test("ambulance opening alternates both bundled voices across launches", async ({ page }) => {
  for (const voice of ["leda", "despina", "leda"]) {
    await open(page);
    await page.locator("#sidebarTabRozhovory").click();

    await page.getByRole("button", { name: "Telefonát do ambulancie", exact: true }).click();
    await page.getByRole("button", { name: "Začať rozhovor", exact: true }).click();
    const question = await page.evaluate(() => lessonScenario());
    expect(question.promptText).toBe("Ambulancia, prosím.");
    expect(question.audioUrl).toBe(`/audio/scenarios/glide-ambulancia-${voice}.mp3`);
  }
});

test("a real-life plan survives reload and adds optional reflection to the same entry", async ({ page }) => {
  await open(page);
  await page.locator("#sidebarTabRozhovory").click();

  await page.getByRole("button", { name: "Môj skutočný rozhovor" }).click();
  await expect(page.locator("#conversationSceneCards")).toBeHidden();
  await page.locator("#conversationLifeGoal").fill("Objednať sa k lekárovi");
  await page.locator("#conversationBeforeRating").getByText("Napäto", { exact: true }).click();
  await page.getByRole("button", { name: "Uložiť môj plán" }).click();
  await open(page);
  await page.locator("#sidebarTabRozhovory").click();

  await page.getByRole("button", { name: "Môj skutočný rozhovor" }).click();
  await expect(page.locator("#conversationPending")).toContainText("Objednať sa k lekárovi");
  await page.locator("#conversationPending").click();
  await expect(page.getByRole("heading", { name: "Po rozhovore" })).toBeVisible();
  const reflection = page.locator("#conversationCheckinForm");
  await reflection.getByText("Áno", { exact: true }).click();
  await reflection.getByText("Zvládnuteľný", { exact: true }).click();
  await page.locator("#conversationAfterRating").getByText("Pokojne", { exact: true }).click();
  await page.getByText("Krátka pauza", { exact: true }).click();
  await page.getByRole("button", { name: "Uložiť záznam" }).click();
  const saved = await page.evaluate(() => ({
    plan: localStorage.getItem("glide_conversations_v1_guest:plan"),
    entries: JSON.parse(localStorage.getItem("glide_conversations_v1_guest")),
  }));
  expect(saved.plan).toBeNull();
  expect(saved.entries).toHaveLength(1);
  expect(saved.entries[0]).toMatchObject({
    sceneId: "own", goal: "Objednať sa k lekárovi", beforeFeeling: "tense", afterFeeling: "calm", helpedBy: ["pause"],
  });
});

test("a custom situation and a missing transcript preserve the user's choice of follow-up", async ({
  page,
}) => {
  await open(page);
  await page.locator("#sidebarTabRozhovory").click();

    await page.getByRole("button", { name: "Vlastná situácia", exact: true }).click();
  await page.locator("#conversationGoal").fill("Spýtať sa na prestup na vlak");
  await page.getByRole("button", { name: "Začať rozhovor", exact: true }).click();
  await expect(page.locator("#lessonConversationGoal")).toHaveText("Spýtať sa na prestup na vlak");
  await speak(page, "");
  await expect(page.locator("#drawerContinueBtn")).toBeDisabled();
  await page.keyboard.press("Enter");
  await expect(page.locator("#targetWord")).toHaveText("Začni rozhovor");
  await page.getByRole("button", { name: "Skúsiť inú možnosť", exact: true }).click();
  await page.locator("#drawerContinueBtn").click();
  expect(await page.evaluate(() => lessonScenario().promptText)).toContain("iná možnosť");
});

test("word library finds accentless queries and uses the selected word in a drill", async ({
  page,
}) => {
  await open(page);
  await page.locator("#vocabularyOpen").click();
  await page.locator("#vocabularySearch").fill("ciapka");
  await expect(page.locator("#vocabularyWords button")).toHaveText("čiapka");
  await page.getByRole("button", { name: "čiapka", exact: true }).click();
  await expect(page.locator("#wordInput")).toHaveValue("čiapka");
  await page.locator("#launchSosDrillBtn").click();
  await expect(page.locator("#targetWord")).toHaveText("ČIAPKA");
});

test("shop asks about payment and follows the selected response", async ({ page }) => {
  await open(page);
  await page.locator("#sidebarTabRozhovory").click();
  await page.getByRole("button", { name: "V predajni", exact: true }).click();
  await page.getByRole("button", { name: "Začať rozhovor", exact: true }).click();
  const first = await page.evaluate(() => lessonScenario());
  expect(first.promptText).toBe("V hotovosti alebo kartou?");
  expect(first.audioUrl).toContain("glide-shop-opening-v2.mp3");
  expect(await page.evaluate(() => window.GlideConversation.interpret("shop", "v hotovosti"))).toBe(1);
  await speak(page, "Kartou, prosím");
  await page.locator("#drawerContinueBtn").click();
  const next = await page.evaluate(() => lessonScenario());
  expect(next.promptText).toBe("Dobre, môžete priložiť kartu.");
  expect(next.audioUrl).toContain("glide-shop-card-v2.mp3");
});

test("conversation alternates voice and closing question between attempts", async ({ page }) => {
  for (const alternate of [false, true]) {
    await open(page);
    await page.locator("#sidebarTabRozhovory").click();
    await page.getByRole("button", { name: "Začať rozhovor", exact: true }).click();
    const plan = await page.evaluate(() => duoLesson.conversation);
    expect(plan.alternateVoice).toBe(alternate);
    expect(plan.tasks[0].question.audioUrl.includes("-alt.mp3")).toBe(alternate);
    expect(plan.tasks[2].question.promptText === "Dáte si ešte niečo?").toBe(alternate);
    expect(plan.tasks[2].question.audioUrl.includes("-alt.mp3")).toBe(alternate);
  }
});

test("ambience starts automatically and stops on audio release", async ({ page }) => {
  await open(page);
  await page.locator("#sidebarTabRozhovory").click();
  await expect(page.locator("#conversationAmbience, #conversationAmbienceVolume")).toHaveCount(0);
  await page.getByRole("button", { name: "Začať rozhovor", exact: true }).click();
  const state = await page.evaluate(() => {
    const players = [];
    window.Audio = class {
      constructor(url) { this.url = url; players.push(this); }
      play() { this.played = true; return Promise.resolve(); }
      pause() { this.paused = true; }
    };
    GlideConversation.startAmbience(duoLesson.conversation);
    GlideConversation.startAmbience(duoLesson.conversation);
    const result = { count: players.length, volume: players[0].volume, played: players[0].played, loop: players[0].loop };
    window.releaseGlideAudio();
    result.paused = players[0].paused;
    return result;
  });
  expect(state).toEqual({ count: 1, volume: 0.05, played: true, loop: true, paused: true });
});

test("additional question appears after completed practice and accepted replies", async ({ page }) => {
  await open(page);
  await page.evaluate(() => localStorage.setItem("glide_conversations_v1_guest:simulations-completed", "2"));
  await page.locator("#sidebarTabRozhovory").click();
  await page.getByRole("button", { name: "Začať rozhovor", exact: true }).click();
  expect(await page.evaluate(() => duoLesson.conversation.bonusEligible)).toBe(true);
  await speak(page, "Dve veľké kávy");
  await page.locator("#drawerContinueBtn").click();
  await speak(page, "so sebou");
  await page.locator("#drawerContinueBtn").click();
  await speak(page, "Áno, ďakujem");
  await page.locator("#drawerContinueBtn").click();
  const bonus = await page.evaluate(() => ({ question: lessonScenario(), count: duoLesson.initialWordCount }));
  expect(bonus.count).toBe(4);
  expect(bonus.question.promptText).toBe("Ešte sa spýtam, chcete kávu s mliekom?");
  expect(bonus.question.audioUrl).toContain("glide-cafe-surprise");
  await expect(page.locator("#lessonContextBadge")).toContainText("4 z 4");
  await speak(page, "Nie, ďakujem");
  await page.locator("#drawerContinueBtn").click();
  await expect(page.locator("#celebrationTitle")).toHaveText("Rozhovor dokončený");
  expect(await page.evaluate(() => localStorage.getItem("glide_conversations_v1_guest:simulations-completed"))).toBe("3");
});

test("new scenes have recorded voices and natural branching", async ({ page }) => {
  await open(page);
  await page.locator("#sidebarTabRozhovory").click();
  for (const name of ["Pracovný telefonát", "Cesta na stanicu", "Rezervácia stola", "Reklamácia objednávky"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Rezervácia stola", exact: true }).click();
  await page.getByRole("button", { name: "Začať rozhovor", exact: true }).click();
  expect(await page.evaluate(() => lessonScenario().audioUrl)).toContain("glide-restaurant-opening.mp3");
  await speak(page, "Chcem rezervovať stôl");
  await page.locator("#drawerContinueBtn").click();
  expect(await page.evaluate(() => lessonScenario().promptText)).toContain("pre koľko ľudí");
  expect(await page.evaluate(() => lessonScenario().audioUrl)).toContain("restaurant-branch-0.mp3");
});

test("self-confirmed unheard response advances and offers a choice of follow-up", async ({ page }) => {
  await open(page);
  await page.locator("#sidebarTabRozhovory").click();
  await page.getByRole("button", { name: "Začať rozhovor", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("dsp-evaluation-complete", { detail: { passed: false, freeReply: true, meta: { freeReply: true, conversation: "cafe" } } })));
  await expect(page.locator("#practiceCorrect")).toBeVisible();
  await page.locator("#practiceCorrect").click();
  await expect(page.locator("#drawerContinueBtn")).toBeDisabled();
  await page.getByRole("button", { name: "Dve kávy", exact: true }).click();
  await page.locator("#drawerContinueBtn").click();
  expect(await page.evaluate(() => lessonScenario().promptText)).toContain("Dve kávy");
});

test("optional feeling guides next suggestion and profile remembers experiences and wins", async ({ page }) => {
  await open(page);
  await page.locator("#sidebarTabRozhovory").click();
  await page.getByRole("button", { name: "Začať rozhovor", exact: true }).click();
  await speak(page, "Dve veľké kávy");
  await page.locator("#drawerContinueBtn").click();
  await speak(page, "so sebou");
  await page.locator("#drawerContinueBtn").click();
  await speak(page, "Áno, ďakujem");
  await page.locator("#drawerContinueBtn").click();
  await page.getByRole("button", { name: "Pohodovo", exact: true }).click();
  await expect(page.locator(".conversation-reflection small")).toContainText("Výber je stále na tebe");
  await page.locator("#conversationRecap").click();
  await page.getByRole("button", { name: "Precvičiť v aplikácii" }).click();
  await page.locator("#navTabRozhovory").evaluate(node => node.click());
  await expect(page.locator("#conversationRecommendation")).toContainText("V predajni");
  await page.locator("#navTabTelemetria").evaluate(node => node.click());
  await expect(page.locator(".conversation-progress-card").filter({ hasText: "Tvoje rozhovorové zážitky" })).toContainText("V kaviarni");
  await page.locator("#conversationWin").fill("Objednal som kávu");
  await page.locator("#conversationWin").evaluate(el => el.form.requestSubmit());
  await expect(page.locator(".conversation-progress-card li")).toHaveText("Objednal som kávu");
  const challenge=page.locator(".conversation-progress-card").filter({ hasText: "Malý nápad na dnes" });
  await expect(challenge).toBeVisible();
  await challenge.getByRole("button", { name: "Iný nápad" }).click();
  await challenge.getByRole("button", { name: "Upraviť a uložiť" }).click();
  await expect(page.locator("#practiceSituation")).toHaveValue(/cestu/);
});


test("intent handling is cautious with negation and boundaries across scenarios", async ({ page }) => {
  await open(page);
  const cases = [
    ["shop", "Nemám kartu", null], ["shop", "Kartou nezaplatím", null],
    ["shop", "Nie kartou, ale v hotovosti", 1], ["shop", "Nie v hotovosti, ale kartou", 0],
    ["shop", "Nie len kartou, ale aj v hotovosti", null], ["shop", "kartou alebo v hotovosti", null],
    ["shop", "Kartou, prosím", 0], ["shop", "V hotovosti", 1],
    ["cafe", "Nechcem so sebou", null], ["cafe", "Nie so sebou, ale na mieste", 1],
    ["cafe", "Nie na mieste, ale so sebou", 0], ["cafe", "Dve veľké kávy so sebou", 0],
    ["doctor", "Chcem zmeniť termín", 1], ["doctor", "Nechcem zmeniť termín", null],
    ["restaurant", "Potrebujem stolicu", null], ["restaurant", "Chcem rezervovať stôl", 0],
    ["directions", "Kde je nemocnica?", null], ["directions", "Kde je stanica?", 0],
    ["job", "Volám kvôli pracovnej ponuke", 0], ["job", "Nechcem tú pracovnú ponuku", null],
    ["complaint", "Mám pokazený tovar", 0], ["complaint", "Nemám problém s tovarom", null],
    ["own", "Chcel by som niečo doplniť", 0], ["unknown", "Ahoj", null],
  ];
  for (const [scene, text, expected] of cases) {
    const actual = await page.evaluate(([id, value]) => GlideConversation.interpret(id, value), [scene, text]);
    expect(actual, `${scene}: ${text}`).toBe(expected);
  }
});

test("ambiguous payment never starts an incorrect branch and lets the user choose", async ({ page }) => {
  await open(page);
  await page.locator("#sidebarTabRozhovory").click();
  await page.getByRole("button", { name: "V predajni", exact: true }).click();
  await page.getByRole("button", { name: "Začať rozhovor", exact: true }).click();
  await speak(page, "Nemám kartu");
  await expect(page.locator("#drawerContinueBtn")).toBeDisabled();
  await page.getByRole("button", { name: "V hotovosti", exact: true }).click();
  await page.locator("#drawerContinueBtn").click();
  const next = await page.evaluate(() => lessonScenario());
  expect(next.promptText).toBe("Dobre, zaplatíte v hotovosti.");
  expect(next.audioUrl).toContain("glide-shop-cash-v2.mp3");
});

test("every situation and voice chooses the correct branch recording", async ({ page }) => {
  const fixtures = {
    cafe: ["cafe-branch-takeaway", "cafe-branch-table", "cafe-branch-coffee", "cafe-branch-clarify"],
    doctor: ["doctor-branch-book", "doctor-branch-change", "doctor-branch-clarify"],
    shop: ["shop-card-v2", "shop-cash-v2", "shop-clarify-v2"],
    own: ["own-branch-details", "own-branch-other", "own-branch-clarify"],
    job: ["job-branch-0", "job-branch-1"], directions: ["directions-branch-0", "directions-branch-1"],
    restaurant: ["restaurant-branch-0", "restaurant-branch-1"], complaint: ["complaint-branch-0", "complaint-branch-1"],
  };
  for (const [scene, branches] of Object.entries(fixtures)) {
    for (let turn = 0; turn < 2; turn++) {
      await open(page);
      await page.locator("#sidebarTabRozhovory").click();
      await page.locator(`.conversation-scene-card[data-scene="${scene}"]`).click();
      if (scene === "own") await page.locator("#conversationGoal").fill("Chcem sa niečo spýtať");
      await page.locator("#conversationStart").click();
      const plan = await page.evaluate(() => structuredClone(duoLesson.conversation));
      const expectedAlternate = scene === "doctor" ? turn === 0 : turn === 1;
      expect(plan.alternateVoice, `${scene}, turn ${turn}`).toBe(expectedAlternate);
      for (let index = 0; index < branches.length; index++) {
        const selected = await page.evaluate(({ plan, index }) => {
          const lesson = { conversation: plan, completedItemsCount: 1, totalAttemptsCount: 1, lessonQueue: [{ question: {} }] };
          GlideConversation.afterAttempt(lesson, { passed: true, conversationChoice: index });
          return lesson.lessonQueue[0].question;
        }, { plan, index });
        const expected = `/audio/scenarios/glide-${branches[index]}${expectedAlternate ? "-alt" : ""}.mp3`;
        expect(selected.audioUrl).toBe(expected);
        expect((await page.request.get(expected)).status()).toBe(200);
      }
    }
  }
});
