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

test('exercise requests and verifies headset microphone and releases it on exit', async ({page}) => {
  await page.addInitScript(() => { sessionStorage.setItem('fl_guest_mode','1'); localStorage.setItem('fl_onboarding_completed','1'); });
  await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-engine','ready');
  const result=await page.evaluate(async()=>{
    const calls=[]; const plugin={prepareExercise:async()=>{calls.push('prepare');return {bluetooth:true}},verifyExercise:async()=>calls.push('verify'),releaseExercise:async()=>calls.push('release')};
    window.Capacitor={getPlatform:()=> 'android',isPluginAvailable:name=>name==='GlideDaf',Plugins:{GlideDaf:plugin}};
    const ctx=new AudioContext();const stream=ctx.createMediaStreamDestination().stream;navigator.mediaDevices.getUserMedia=async()=>stream;
    await window.setupAudio();const active=window.micStream.active;window.releaseGlideAudio();await new Promise(r=>setTimeout(r,0));await ctx.close();return {calls,active};
  });
  expect(result.active).toBe(true); expect(result.calls).toEqual(['prepare','verify','release']);
});

test('exercise refuses unverified bluetooth input and releases microphone', async ({page}) => {
  await page.addInitScript(() => { sessionStorage.setItem('fl_guest_mode','1'); localStorage.setItem('fl_onboarding_completed','1'); });
  await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-engine','ready');
  const result=await page.evaluate(async()=>{
    const calls=[]; const plugin={prepareExercise:async()=>({bluetooth:true}),verifyExercise:async()=>{throw Error('headset unavailable')},releaseExercise:async()=>calls.push('release')};
    window.Capacitor={getPlatform:()=> 'android',isPluginAvailable:name=>name==='GlideDaf',Plugins:{GlideDaf:plugin}};
    const ctx=new AudioContext(),stream=ctx.createMediaStreamDestination().stream;navigator.mediaDevices.getUserMedia=async()=>stream;
    let message='';try{await window.setupAudio()}catch(e){message=e.message}const state=stream.getAudioTracks()[0].readyState;await ctx.close();return {message,state,calls};
  });
  expect(result.message).toBe('headset unavailable');expect(result.state).toBe('ended');expect(result.calls).toContain('release');
});

test('conversation transfers active assistant to shared headset stream and keeps self-monitoring', async ({page}) => {
  await page.addInitScript(()=>{sessionStorage.setItem('fl_guest_mode','1');localStorage.setItem('fl_onboarding_completed','1');});
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-engine','ready');
  const result=await page.evaluate(async()=>{
    const calls=[];const plugin={stop:async()=>calls.push('stop'),prepareExercise:async()=>{calls.push('prepare');return {bluetooth:true}},verifyExercise:async()=>calls.push('verify'),releaseExercise:async()=>calls.push('release')};
    window.Capacitor={getPlatform:()=> 'android',isPluginAvailable:name=>name==='GlideDaf',Plugins:{GlideDaf:plugin}};
    window.dafAssistant.nativePlugin=plugin;window.dafAssistant.nativeActive=true;window.dafAssistant.isActive=true;
    duoLesson.conversation={miniActivity:false};const ctx=new AudioContext();const stream=ctx.createMediaStreamDestination().stream;navigator.mediaDevices.getUserMedia=async()=>stream;
    await window.setupAudio();const active=window.dafAssistant.isActive,usingNative=window.dafAssistant.nativeActive;window.releaseGlideAudio();await new Promise(r=>setTimeout(r,0));await ctx.close();return {calls,active,usingNative};
  });
  expect(result.active).toBe(true);expect(result.usingNative).toBe(false);expect(result.calls).toEqual(['stop','prepare','verify','release']);
});
