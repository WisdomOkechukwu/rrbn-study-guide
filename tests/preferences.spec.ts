import { test,expect } from '@playwright/test';

async function contrast(page:import('@playwright/test').Page,selector:string){return page.locator(selector).first().evaluate(el=>{
 const lum=(s:string)=>{const [r,g,b]=(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
 let parent:Element|null=el,bg='rgb(255,255,255)';while(parent){const value=getComputedStyle(parent).backgroundColor;if(value!=='rgba(0, 0, 0, 0)'&&value!=='transparent'){bg=value;break;}parent=parent.parentElement;}
 const a=lum(getComputedStyle(el).color),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 });}

test('Gen Z brand, eager hero and dark study surfaces remain readable on desktop and mobile',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await expect(page.locator('.brand img')).toHaveAttribute('src',/radia-genz/);
 await expect(page.locator('.continue-course-cover img')).toHaveAttribute('loading','eager');
 await expect(page.locator('link[rel="icon"][href="/brand/radia-genz.png"]')).toHaveCount(1);
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 for(const selector of ['.learning-welcome h1','.continue-course-body h2','.continue-course-body p','.learning-snapshot p'])expect(await contrast(page,selector),selector).toBeGreaterThanOrEqual(4.5);
 await page.screenshot({path:'/tmp/radia-dark-dashboard.png',fullPage:true});
 await page.getByRole('button',{name:'Practice questions',exact:true}).click();
 for(const selector of ['.practice-mode-card.green h2','.practice-mode-card.green p','.practice-mode-card.cream h2','.practice-mode-card.cream p'])expect(await contrast(page,selector),selector).toBeGreaterThanOrEqual(4.5);
 await page.getByRole('button',{name:'Start practice',exact:true}).click();
 for(const selector of ['.setup-modal h2','.setup-modal>p','.field-label select','.timer-input input'])expect(await contrast(page,selector),selector).toBeGreaterThanOrEqual(4.5);
 await page.getByRole('button',{name:'Let’s begin',exact:true}).click();
 for(const selector of ['.question-stem','.answer-option'])expect(await contrast(page,selector),selector).toBeGreaterThanOrEqual(4.5);
 await page.locator('.answer-option').first().click();
 expect(await contrast(page,'.explanation p')).toBeGreaterThanOrEqual(4.5);
 await page.getByRole('button',{name:'Save & leave',exact:true}).click();
 await page.getByRole('button',{name:'Lecture library',exact:true}).click();
 await page.getByRole('button',{name:'Read Medical Image Processing',exact:true}).click();
 for(const selector of ['.slide-paper h1','.slide-content-lines p'])expect(await contrast(page,selector),selector).toBeGreaterThanOrEqual(4.5);
 await page.screenshot({path:'/tmp/radia-dark-reader.png'});
 await page.getByRole('button',{name:'Close reader',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Open navigation',exact:true}).click();
 await page.getByRole('button',{name:'Flashcards',exact:true}).click();
 await expect(page.locator('.flashcard')).toBeVisible();
 expect(await contrast(page,'.flashcard h2')).toBeGreaterThanOrEqual(4.5);
 await page.screenshot({path:'/tmp/radia-dark-mobile-flashcard.png'});
 await page.getByRole('button',{name:'Exit flashcards',exact:true}).click();
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');expect(errors).toEqual([]);
});

test('SQLite restores a profile without its browser backup and confirmed reset clears study data only',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Edit student profile',exact:true}).click();
 await expect(page.locator('.storage-status')).toHaveText('Saved to SQLite');
 await page.getByPlaceholder('Your first name').fill('Ada');
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await page.getByRole('button',{name:'Practice questions',exact:true}).click();
 await page.getByRole('button',{name:'Start practice',exact:true}).click();
 await page.getByRole('button',{name:'Let’s begin',exact:true}).click();
 await page.getByRole('button',{name:'Save question',exact:true}).click();
 await page.locator('.answer-option').first().click();
 await expect.poll(async()=>{const res=await page.request.get('/api/progress');return (await res.json()).state?.name;}).toBe('Ada');
 await expect.poll(async()=>{const res=await page.request.get('/api/progress');return Object.keys((await res.json()).state?.responses||{}).length;}).toBe(1);
 await page.evaluate(()=>localStorage.removeItem('radia-study-v1'));
 await page.reload();
 await expect(page.locator('.top-avatar')).toHaveText('A');
 await page.getByRole('button',{name:'Edit student profile',exact:true}).click();
 await expect(page.locator('.storage-status')).toHaveText('Saved to SQLite');
 await page.getByRole('button',{name:'Clear everything & start afresh',exact:true}).click();
 await expect(page.getByText('Clear all your study data?',{exact:true})).toBeVisible();
 let res=await page.request.get('/api/progress');expect((await res.json()).state.bookmarks).toHaveLength(1);
 await page.getByRole('button',{name:'Keep my progress',exact:true}).click();
 await expect(page.getByText('Clear all your study data?',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Clear everything & start afresh',exact:true}).click();
 await page.getByRole('button',{name:'Yes, start afresh',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.top-avatar')).toHaveText('S');
 res=await page.request.get('/api/progress');expect((await res.json()).state).toBeNull();
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('radia-study-v1')!).state);
 expect(state.responses).toEqual({});expect(state.bookmarks).toEqual([]);expect(state.known).toEqual([]);expect(state.history).toEqual([]);expect(state.seenSlides).toEqual({});expect(state.session).toBeNull();expect(state.name).toBe('Student');
 await expect(page.locator('.home-course-grid .course-card')).toHaveCount(4);
 await page.getByRole('button',{name:'Lecture library',exact:true}).click();
 await expect(page.locator('.library-grid .course-card')).toHaveCount(10);
 expect((await page.request.get('/lectures/lecture-1.pptx')).status()).toBe(200);
 await page.reload();await expect(page.locator('.top-avatar')).toHaveText('S');
});

test('failed reset preserves data and database mutations reject malformed or cross-origin input',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Edit student profile',exact:true}).click();
 await expect(page.locator('.storage-status')).toHaveText('Saved to SQLite');
 await page.getByPlaceholder('Your first name').fill('Keep me');await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await expect.poll(async()=>{const res=await page.request.get('/api/progress');return (await res.json()).state?.name;}).toBe('Keep me');
 expect((await page.request.put('/api/progress',{data:{name:42}})).status()).toBe(400);
 expect((await page.request.delete('/api/progress',{headers:{origin:'https://unrelated.example'}})).status()).toBe(403);
 await page.route('**/api/progress',route=>route.request().method()==='DELETE'?route.fulfill({status:503,json:{error:'Test outage'}}):route.continue());
 await page.getByRole('button',{name:'Edit student profile',exact:true}).click();await page.getByRole('button',{name:'Clear everything & start afresh',exact:true}).click();await page.getByRole('button',{name:'Yes, start afresh',exact:true}).click();
 await expect(page.locator('.reset-settings [role="alert"]')).toContainText('progress has been kept');
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('radia-study-v1')!).state);expect(state.name).toBe('Keep me');
});

test('newer unsaved browser edits survive a later database timestamp',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Edit student profile',exact:true}).click();
 await expect(page.locator('.storage-status')).toHaveText('Saved to SQLite');
 await page.getByPlaceholder('Your first name').fill('Earlier');await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await expect.poll(async()=>{const res=await page.request.get('/api/progress');return (await res.json()).state?.name;}).toBe('Earlier');
 const old=(await (await page.request.get('/api/progress')).json()).state;
 await page.route('**/api/progress',route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{error:'Temporary save failure'}}):route.continue());
 await page.getByRole('button',{name:'Edit student profile',exact:true}).click();await page.getByPlaceholder('Your first name').fill('Newest');await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await page.getByRole('button',{name:'Edit student profile',exact:true}).click();await expect(page.locator('.storage-status')).toContainText('Browser backup active');
 // APIRequestContext bypasses browser interception: simulate an old in-flight save finishing late.
 expect((await page.request.put('/api/progress',{data:old})).status()).toBe(200);
 await page.unroute('**/api/progress');await page.reload();
 await expect(page.locator('.top-avatar')).toHaveText('N');
 await expect.poll(async()=>{const res=await page.request.get('/api/progress');return (await res.json()).state?.name;}).toBe('Newest');
});
