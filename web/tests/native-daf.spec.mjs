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

test('native volume updates are ordered and restored from the running service', async ({page}) => {
  await page.addInitScript(()=>{sessionStorage.setItem('fl_guest_mode','1');localStorage.setItem('fl_onboarding_completed','1');});
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-engine','ready');
  const result=await page.evaluate(async()=>{
    const calls=[];let release;const first=new Promise(r=>release=r);
    const plugin={setOptions:async opts=>{calls.push(opts);if(calls.length===1)await first;},status:async()=>({active:true,volume:32,delay:90})};
    const engine=window.dafAssistant;engine.nativePlugin=plugin;engine.nativeActive=true;engine.isActive=true;
    engine.setVolume(10);engine.setVolume(20);engine.setVolume(70);release();
    await new Promise(r=>setTimeout(r,25));const ordered=calls.map(c=>c.volume);
    await engine.syncNativeStatus();return {ordered,volume:document.getElementById('assistantVolSlider').value,delay:document.getElementById('assistantDelaySlider').value};
  });
  expect(result.ordered).toEqual([10,70]);expect(result.volume).toBe('32');expect(result.delay).toBe('90');
});

test('Web Audio monitor volume remains adjustable after compression', async ({page}) => {
  await page.addInitScript(()=>{sessionStorage.setItem('fl_guest_mode','1');localStorage.setItem('fl_onboarding_completed','1');});
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-engine','ready');await page.locator('#sidebarTabAsistent').click();
  const result=await page.evaluate(async()=>{
    const ctx=new AudioContext(),osc=ctx.createOscillator(),input=ctx.createGain();input.gain.value=0.6;osc.frequency.value=440;osc.connect(input);osc.start();
    window.audioCtx=ctx;window.mediaStreamSource=input;const e=window.dafAssistant;await e.startConversationMonitor();e.setPitch(0);
    async function level(v){e.setVolume(v);await new Promise(r=>setTimeout(r,250));const a=new Uint8Array(e.dafAnalyser.fftSize);e.dafAnalyser.getByteTimeDomainData(a);return Math.sqrt(a.reduce((sum,x)=>sum+((x-128)/128)**2,0)/a.length);}
    const quiet=await level(20),loud=await level(80),mute=await level(0);e.stop();osc.stop();await ctx.close();return {quiet,loud,mute};
  });
  expect(result.quiet).toBeGreaterThan(0.001);expect(result.loud/result.quiet).toBeGreaterThan(3.2);expect(result.mute).toBeLessThan(0.005);
});

