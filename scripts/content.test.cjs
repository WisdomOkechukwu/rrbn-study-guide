/* eslint-disable @typescript-eslint/no-require-imports -- This is a Node CommonJS test harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const lectures = require('../app/data/lectures.json');
const questions = require('../app/data/questions.json');
function loadTS(relative) {
  const filename = path.resolve(__dirname,relative);
  const source = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  const mod = new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(source,filename);return mod.exports;
}
const { searchLectures } = loadTS('../app/search.ts');
const { topics,topicForSlide,topicQuestions } = loadTS('../app/topics.ts');
test('all questions have unique IDs, four distinct options, and valid source slides',()=>{
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 assert.equal(lectures.length,12);assert.equal(lectures.reduce((n,l)=>n+l.slides.length,0),447);
 for(const q of questions){assert.equal(q.options.length,4,q.id);assert.equal(new Set(q.options).size,4,q.id);assert.ok(q.answer>=0&&q.answer<4,q.id);assert.ok(lectures[q.lecture].slides[q.page-1]?.text,q.id);assert.ok(q.explanation.length>70,q.id);}
 for(const l of lectures){assert.ok(questions.some(q=>q.lecture===l.id));assert.ok(fs.existsSync(path.resolve(__dirname,'../public'+l.file)));for(const s of l.slides)for(const image of s.images)assert.ok(fs.existsSync(path.resolve(__dirname,'../public'+image)));}
});
test('natural language queries rank grounded source passages',()=>{
 const brown=searchLectures('Why does my film turn brown after some time?');assert.ok(brown.slice(0,3).some(r=>/wash|stain/i.test(r.snippet)),JSON.stringify(brown));
 const milky=searchLectures('Why is my film milky after fixing?');assert.ok(milky.slice(0,3).some(r=>/exhaust|milky|cloudy/i.test(r.snippet)));
 const cr=searchLectures('How is CR different from DR?');assert.ok(cr.slice(0,4).some(r=>r.lecture===3&&[28,39].includes(r.page)),JSON.stringify(cr));
 const scoped=searchLectures('How can I stop static marks?',6);assert.ok(scoped.length);assert.ok(scoped.every(r=>r.lecture===6));
 assert.deepEqual(searchLectures(''),[]);assert.deepEqual(searchLectures('flibbertigibbet xyzzy'),[]);
});
test('topic tests contain questions only from the current topic and cover every authored question',()=>{
 for(const q of questions){const t=topicForSlide(q.lecture,q.page);assert.ok(t,`No topic for ${q.id}`);assert.ok(topicQuestions(t).some(item=>item.id===q.id));}
 for(const t of topics){for(const q of topicQuestions(t)){assert.equal(q.lecture,t.lecture);assert.ok(q.page>=t.start&&q.page<=t.end);}}
});
test('Zustand records answers, preserves bookmarks, and finishes sessions only once',()=>{
 const memory = new Map();Object.defineProperty(globalThis,'localStorage',{value:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},configurable:true});
 global.window={localStorage:globalThis.localStorage};const {useStudy}=loadTS('../app/store.ts');const store=()=>useStudy.getState();
 store().toggleBookmark('q001');store().markKnown('q001',true);store().markKnown('q001',true);assert.equal(store().known.length,1);
 store().start(['q001','q002'],'practice',10,'Bones of the lower limb');assert.equal(store().session.focus,'Bones of the lower limb');assert.ok(store().session.expiresAt>Date.now());
 store().answer('q001',0,true);store().navigate(1);assert.equal(store().session.index,1);assert.equal(store().session.answers.q001,0);assert.equal(store().responses.q001.correct,true);
 store().finish(1);store().finish(1);assert.equal(store().history.length,1);assert.equal(store().history[0].correct,1);assert.equal(store().session.finished,true);
 store().clearSession();assert.equal(store().session,null);assert.deepEqual(store().bookmarks,['q001']);
 store().start(['q001'],'exam',0);assert.equal(store().session.expiresAt,null);assert.ok(memory.get('radia-study-v1'));
});

test('all restyled decks preserve original text, equations, diagrams and package content',()=>{
 const {execFileSync}=require('node:child_process');
 const result=JSON.parse(execFileSync('python3',[path.resolve(__dirname,'verify_powerpoints.py')],{encoding:'utf8'}));
 assert.equal(result.decks,12);assert.equal(result.slides,447);assert.equal(result.mathRuns,48);assert.ok(result.mediaParts>50);assert.ok(result.unchangedParts>500);
});

test('reviewed arithmetic answers are independently recalculated',()=>{
 const answer=id=>{const item=questions.find(q=>q.id===id);return item.options[item.answer];};
 assert.equal(answer('q173'),`${12/4} A`);
 assert.equal(answer('q175'),`${100+20+30} ohms`);
 assert.equal(answer('q176'),`${1/(1/50+1/50)} ohms`);
 assert.equal(answer('q177'),`${100+1/(1/50+1/50)} ohms`);
 assert.equal(answer('q179'),`${60/1} W`);
 assert.equal(answer('q180'),'Four times');
 assert.equal(require('../app/data/question-review.json').reviewedQuestionCount,questions.length);
});

 test('expanded bank uses original supporting slides across all ten decks',()=>{
 const added=questions.slice(300,500);assert.equal(added.length,200);
 for(let i=0;i<10;i++)assert.equal(added.filter(q=>q.lecture===i).length,20);
 for(const q of added){assert.equal(q.sourceOrigin,'provided-powerpoint');assert.equal(q.sourceEvidence,lectures[q.lecture].slides[q.page-1].text);}
 assert.equal(new Set(questions.map(q=>q.stem.toLowerCase().replace(/[^a-z0-9]/g,''))).size,questions.length);
 const answer=id=>{const q=questions.find(q=>q.id===id);return q.options[q.answer];};
 assert.equal(answer('q372'),`${5*3} J`);assert.equal(answer('q378'),`${240/4} W`);
 assert.equal(answer('q447'),`${200*.1} mAs`);
 assert.equal(answer('q476'),'Doubles the total heat');
 });

 test('new comprehension checks have exact slide excerpts and balanced deck coverage',()=>{
 const added=questions.slice(500,530);assert.equal(added.length,30);
 for(let i=0;i<10;i++)assert.equal(added.filter(q=>q.lecture===i).length,3);
 for(const q of added){
   const source=lectures[q.lecture].slides[q.page-1].text;
   assert.equal(q.sourceOrigin,'provided-powerpoint');assert.equal(q.sourceEvidence,source);
   assert.ok(source.includes(q.sourceExcerpt),q.id);assert.ok(q.explanation.includes(q.sourceExcerpt),q.id);
 }
 });

test('technique subjects have source-grounded questions for every teaching slide and searchable content',()=>{
 assert.equal(questions.length,640);
 for(const [id,code,count] of [[10,'MXT 209',36],[11,'MXT 301',24]]){
  const lecture=lectures[id];assert.equal(lecture.code,code);
  const pool=questions.slice(530,590).filter(q=>q.lecture===id);assert.equal(pool.length,count);
  for(const q of pool){
   const source=lecture.slides[q.page-1].text;
   assert.equal(q.sourceOrigin,'provided-powerpoint',q.id);assert.equal(q.sourceEvidence,source,q.id);
   assert.ok(q.sourceExcerpt&&source.includes(q.sourceExcerpt),q.id);
   assert.ok(q.explanation.length>70,q.id);
  }
  for(const slide of lecture.slides.slice(1))assert.ok(pool.some(q=>q.page===slide.page),`${code} slide ${slide.page}`);
  const matches=searchLectures(id===10?'lateral elbow positioning':'patella positioning',id);
  assert.ok(matches.length);assert.ok(matches.every(r=>r.lecture===id));
  assert.ok(fs.existsSync(path.resolve(__dirname,'../public/lectures/redesigned',path.basename(lecture.file))));
 }
});


test('fifty additional questions have unique stems and unrepeated verbatim source evidence',()=>{
 const added=questions.slice(590);assert.equal(added.length,50);
 const normalize=text=>text.toLowerCase().replace(/[^a-z0-9]/g,'');
 assert.equal(new Set(questions.map(q=>normalize(q.stem))).size,questions.length);
 for(let lecture=0;lecture<12;lecture++)assert.equal(added.filter(q=>q.lecture===lecture).length,lecture<10?4:5);
 const evidence=new Set();
 for(const q of added){
   const source=lectures[q.lecture].slides[q.page-1].text;
   assert.equal(q.sourceOrigin,'provided-powerpoint',q.id);assert.equal(q.sourceEvidence,source,q.id);
   assert.ok(q.sourceExcerpt&&source.includes(q.sourceExcerpt),q.id);
   const key=`${q.lecture}:${q.page}:${normalize(q.sourceExcerpt)}`;
   assert.ok(!evidence.has(key),q.id);evidence.add(key);
   assert.ok(!questions.slice(0,590).some(old=>old.lecture===q.lecture&&old.page===q.page&&normalize(old.sourceExcerpt||'')===normalize(q.sourceExcerpt)),q.id);
 }
});

test('study shuffles preserve each item once and avoid immediate boundary repeats',()=>{
 const {shuffle}=loadTS('../app/study-order.ts');
 const original=['a','b','c','d','e'];
 for(let round=0;round<100;round++){
  const order=shuffle(original,'a');assert.equal(order.length,original.length);
  assert.deepEqual([...order].sort(),original);assert.notEqual(order[0],'a');
  assert.deepEqual(original,['a','b','c','d','e']);
 }
 assert.deepEqual(shuffle([]),[]);assert.deepEqual(shuffle(['only'],'only'),['only']);
 assert.deepEqual(shuffle(['a','b'],'a'),['b','a']);
});
