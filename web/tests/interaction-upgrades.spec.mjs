import { test, expect } from '@playwright/test';
test.use({ baseURL: 'http://localhost:3000' });
async function open(page) {
  await page.addInitScript(() => { sessionStorage.setItem('fl_guest_mode','1'); localStorage.setItem('fl_onboarding_completed','1'); });
  await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-engine','ready');
}
test('personal map saves choices and connects conversation, lesson, and real-life plan', async ({page}) => {
  await open(page); await page.locator('#sidebarTabRozhovory').click();
  await page.locator('#personalSituationMap summary').click();
  await page.locator('#personalSituationChoices button').filter({hasText:'V kaviarni'}).click();
  await page.locator('#personalSituationChoices button').filter({hasText:'V predajni'}).click();
  await expect(page.locator('#personalSituationActions')).toBeVisible();
  await page.locator('.personal-map-active-choices button').filter({hasText:'V kaviarni'}).click();
  await page.locator('#personalMapConversation').click();
  await expect(page.locator('.conversation-scene-card[data-scene="cafe"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#personalMapLife').click();
  await expect(page.locator('#conversationLifeGoal')).toHaveValue(/dve kávy/i);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-engine','ready');
  await page.locator('#sidebarTabRozhovory').click(); await page.locator('#personalSituationMap summary').click();
  await expect(page.locator('#personalSituationChoices button').filter({hasText:'V kaviarni'})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#personalSituationChoices button').filter({hasText:'V predajni'})).toHaveAttribute('aria-pressed','true');
  await page.locator('#personalSituationChoices button').filter({hasText:'Vlastná situácia'}).click();
  await page.locator('#personalMapLesson').click();
  await expect(page.locator('#nodePopoverBackdrop')).toHaveClass(/active/);
  await expect(page.locator('#popoverTitle')).toContainText('1.1');
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
  await expect(page.locator('#lessonTechniqueDemo')).toContainText('a → áno');
  expect(await page.locator('#lessonTechniqueDemo .technique-wave i').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await page.evaluate(() => { window.__demos=[]; window.Audio=class { constructor(url){this.url=url;window.__demos.push(this)} play(){return Promise.resolve()} pause(){this.paused=true} }; });
  await page.locator('#lessonTechniqueDemo .technique-audio').click();
  expect(await page.evaluate(() => window.__demos[0].url)).toContain('glide-technique-onset.mp3');
  await page.locator('#startLessonBtn').click();
  expect(await page.evaluate(() => window.__demos[0].paused)).toBe(true);
  await page.locator('.lesson-hint > summary').click();
  await expect(page.locator('#activeTechniqueDemo')).toBeVisible();
  await page.locator('#activeTechniqueDemo summary').click();
  await expect(page.locator('#activeTechniqueDemo')).toContainText('Jemný začiatok hlasu');
});
