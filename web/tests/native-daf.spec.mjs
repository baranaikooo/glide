import { test, expect } from '@playwright/test';
test.use({baseURL:'http://localhost:3000'});
test('native feedback survives navigation and hiding; controls and explicit stop reach native service', async ({page}) => {
  await page.addInitScript(() => { sessionStorage.setItem('fl_guest_mode','1'); localStorage.setItem('fl_onboarding_completed','1'); });
  await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-engine','ready');
  await page.locator('#sidebarTabAsistent').click();
  await page.evaluate(() => { window.__nativeCalls=[]; window.dafAssistant.nativePlugin={start:async opts=>{window.__nativeCalls.push(['start',opts]);return {active:true}},stop:async()=>window.__nativeCalls.push(['stop']),setOptions:async opts=>window.__nativeCalls.push(['options',opts]),status:async()=>({active:true})}; });
  page.on('dialog', d => d.accept());
  await page.locator('#assistantToggle').click(); await expect.poll(()=>page.evaluate(()=>window.dafAssistant.nativeActive)).toBe(true);
  expect(await page.locator('#assistantPitchSlider').count()).toBe(0);
  await page.evaluate(()=>{window.dafAssistant.setDelay(110);window.dafAssistant.setVolume(28);Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.locator('#sidebarTabCesta').click(); expect(await page.evaluate(()=>window.dafAssistant.isActive)).toBe(true);
  let calls=await page.evaluate(()=>window.__nativeCalls);expect(calls).toContainEqual(['options',{delay:110}]);expect(calls).toContainEqual(['options',{volume:28}]);expect(calls.some(x=>x[0]==='stop')).toBe(false);
  await page.evaluate(()=>window.dafAssistant.stop()); await expect.poll(()=>page.evaluate(()=>window.__nativeCalls.some(x=>x[0]==='stop'))).toBe(true);
});
