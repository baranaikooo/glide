import { test, expect } from '@playwright/test';
test.use({ baseURL: 'http://localhost:3000' });
async function open(page) {
  await page.addInitScript(() => { sessionStorage.setItem('fl_guest_mode','1'); localStorage.setItem('fl_onboarding_completed','1'); });
  await page.goto('/', { waitUntil: 'domcontentloaded' }); await expect(page.locator('html')).toHaveAttribute('data-engine','ready');
}
test('one situation picker preserves saved favorites and links to practice, lesson and real life', async ({page}) => {
  await page.addInitScript(() => { if (!localStorage.getItem('test-map-seeded')) { localStorage.setItem('glide_conversations_v1_guest:personal-map', JSON.stringify(['shop'])); localStorage.setItem('test-map-seeded','1'); } });
  await open(page); await page.locator('#sidebarTabRozhovory').click();
  await expect(page.locator('#personalSituationMap')).toHaveCount(0);
  await expect(page.locator('#conversationSceneCards .conversation-scene-item').first()).toContainText('V predajni');
  await expect(page.getByRole('button',{name:'Odobrať V predajni z obľúbených'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Pridať V kaviarni medzi obľúbené'}).click();
  await page.getByRole('button',{name:'V kaviarni',exact:true}).click();
  await expect(page.locator('.conversation-scene-card[data-scene="cafe"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#personalMapLife, #personalMapLesson')).toHaveCount(0);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-engine','ready');
  await page.locator('#sidebarTabRozhovory').click();
  await expect(page.getByRole('button',{name:'Odobrať V kaviarni z obľúbených'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Odobrať V predajni z obľúbených'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Odobrať V predajni z obľúbených'}).click();
  await expect(page.locator('#conversationSceneCards .conversation-scene-item').first()).toContainText('V kaviarni');
  await page.getByRole('button',{name:'Vlastná situácia',exact:true}).click();
  await expect(page.locator('.conversation-scene-card[data-scene=own]')).toHaveAttribute('aria-pressed','true');
});
test('conversation help repeats the current question and stops before recording', async ({page}) => {
  await open(page); await page.locator('#sidebarTabRozhovory').click();
  await page.getByRole('button',{name:'Začať rozhovor',exact:true}).click();
  await page.locator('#conversationHelp summary').click();
  await expect(page.locator('#conversationHelpQuestion')).toHaveText('Dobrý deň, čo si dáte?');
  await page.evaluate(() => { window.__testPlayers=[]; window.Audio=class { constructor(url){this.url=url;window.__testPlayers.push(this)} play(){return Promise.resolve()} pause(){this.paused=true} }; });
  await page.locator('#conversationReplay').click();
  expect(await page.evaluate(() => window.__testPlayers[0].url)).toContain('glide-cafe-opening-v2.mp3');
  await page.evaluate(() => { document.getElementById('startBtn').dispatchEvent(new MouseEvent('click',{bubbles:true})); });
  expect(await page.evaluate(() => window.__testPlayers[0].paused)).toBe(true);
});
test('spontaneous mini activities use free answers and do not create conversation history', async ({page}) => {
  await open(page); await page.locator('#sidebarTabRozhovory').click();
  await page.locator('#spontaneousActivities summary').click();
  await page.locator('#spontaneousShuffle').click();
  await page.locator('#spontaneousChoices button').first().click();
  expect(await page.evaluate(() => ({mini:duoLesson.conversation.miniActivity, mode:duoLesson.currentLevel.mode, free:duoLesson.currentWordItem.freeReply}))).toEqual({mini:true,mode:'standard',free:true});
  await expect(page.locator('#conversationHelp')).toBeHidden();
  for(let i=0;i<3;i++) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('dsp-evaluation-complete',{detail:{passed:true,freeReply:true,meta:{freeReply:true}}})));
    await page.locator('#drawerContinueBtn').click();
  }
  await expect(page.locator('#celebrationTitle')).toHaveText('Chvíľka dokončená');
  expect(await page.evaluate(() => localStorage.getItem('glide_conversations_v1_guest:simulations-completed'))).toBeNull();
});
test('lesson technique demos have audio and respect reduced motion', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'}); await open(page);
  await page.locator('#world-section-1 .path-node-btn').first().click();
  await page.locator('#lessonTechnique summary').click();
  await expect(page.locator('#lessonTechniqueDemo')).toContainText('A → auto');
  expect(await page.locator('#lessonTechniqueDemo .technique-wave i').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await page.evaluate(() => { window.__demos=[]; window.Audio=class { constructor(url){this.url=url;window.__demos.push(this)} play(){return Promise.resolve()} pause(){this.paused=true} }; });
  await page.locator('#lessonTechniqueDemo .technique-audio').click();
  expect(await page.evaluate(() => window.__demos[0].url)).toContain('glide-lesson-example-1-1.mp3');
  await page.locator('#startLessonBtn').click();
  expect(await page.evaluate(() => window.__demos[0].paused)).toBe(true);
  await page.locator('.lesson-hint > summary').click();
  await expect(page.locator('#activeTechniqueDemo')).toBeVisible();
  await page.locator('#activeTechniqueDemo summary').click();
  await expect(page.locator('#activeTechniqueDemo')).toContainText('Jemný nábeh: A a O');
});

test('every lesson has its own spoken example and topic-specific steps', async ({page}) => {
  await open(page);
  await page.evaluate(() => { window.__guides=[]; window.Audio=class { constructor(url){this.url=url;window.__guides.push(url)} play(){return Promise.resolve()} pause(){} }; });
  const guideResults = await page.evaluate(() => {
    const output=[];
    for (const world of WORLDS_DATA) for (const level of world.levels) {
      duoLesson.openLevelPopover(level, world);
      document.querySelector('#lessonTechniqueDemo .technique-audio').click();
      output.push({id:level.id,title:document.querySelector('#lessonTechniqueTitle').textContent,
        firstStep:document.querySelector('#lessonTechniqueSteps li').textContent,
        file:window.__guides.at(-1), expert:document.querySelector('#lessonTechniqueDemo .technique-expert-link')?.href || null});
    }
    return output;
  });
  expect(guideResults).toHaveLength(25);
  expect(new Set(guideResults.map(x=>x.file)).size).toBe(25);
  for (const item of guideResults) {
    expect(item.file).toBe(`/audio/scenarios/glide-lesson-example-${item.id.replace('.', '-')}.mp3`);
    const response=await page.request.get(item.file);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/audio/);
  }
  expect(guideResults.find(x=>x.id==='1.2').title).toContain('E a I');
  expect(guideResults.find(x=>x.id==='2.2').title).toContain('V so samohláskou');
  expect(guideResults.find(x=>x.id==='3.1').title).toContain('pri P');
  expect(guideResults.find(x=>x.id==='4.3').title).toContain('bločku');
  expect(guideResults.find(x=>x.id==='5.2').title).toContain('ambulancie');
  expect(guideResults.find(x=>x.id==='1.1').expert).toContain('asha.org/practice-portal/clinical-topics/fluency-disorders');
  expect(guideResults.find(x=>x.id==='3.1').expert).toContain('asha.org/practice-portal/clinical-topics/fluency-disorders');
});
