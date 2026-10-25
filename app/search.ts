import lectures from './data/lectures.json';
import questions from './data/questions.json';

const stop = new Set('a an the is are was were be been being of on in at to for from by and or as with that this these those it its what which who how why when where can could should would do does did i my me we our you your please explain tell about between difference happens happen make makes give show find read want need understand mean means causes cause caused much many more most into than not all has have had if so'.split(' '));
const groups = [
  ['different','difference','compare','comparison','versus','vs','distinction'],
  ['milky','cloudy','cloudiness','clearing','fixing','fixer','thiosulfate'],
  ['brown','yellow','stain','staining','washing','residual','thiosulfate','archival'],
  ['blurry','blurred','blurring','blur','sharpness','unsharp','contact','motion'],
  ['black','dark','density','development','developer','metallic','silver'],
  ['fog','foggy','fogging','haze','safelight','leak'],
  ['static','branching','tree','discharge','humidity'],
  ['cr','computed','photostimulable','phosphor','laser','psl'],
  ['dr','digital','panel','tft','selenium','scintillator','photodiode'],
  ['pacs','archiving','archive','retrieval','storage'],
  ['ris','worklist','appointment','registration','workflow'],
  ['dicom','communication','exchange','format'],
  ['dose','radiation','alara','exposure','protection'],
  ['timer','time','duration','cycle','processing'],
  ['temperature','warm','hot','heat','thermostat'],
  ['nerve','innervation','innervated','supply'],
  ['artery','arterial','blood','supply'],
  ['hip','acetabulum','acetabular','femoral'],
  ['shoulder','glenohumeral','glenoid','humerus'],
  ['knee','patella','patellar','tibial','popliteal'],
  ['ankle','talus','malleolar','mortise','dorsiflexion'],
  ['wrist','carpal','scaphoid','tunnel'],
  ['foot','tarsal','arch','calcaneus'],
  ['electricity','electrical','voltage','current','resistance','ohm'],
  ['consent','permission','autonomy','refusal'],
  ['infection','infectious','hygiene','handwashing','precautions'],
  ['reaction','allergy','allergic','contrast','swelling','emergency'],
  ['privacy','confidential','confidentiality','security','password'],
  ['recovery','recover','reclaim','conservation','silver'],
];
function stem(s: string) { return s.length > 5 ? s.replace(/(?:ing|ed|es|s)$/, '') : s; }
function tokenize(text: string) { return text.toLowerCase().replace(/x[ -]rays?/g,'xray').match(/[a-z0-9]+/g)?.filter(t => t.length > 1 && !stop.has(t)).map(stem) || []; }
const synonymMap = new Map<string,Set<string>>();
for (const group of groups) for (const token of group.map(stem)) {
  const terms = synonymMap.get(token) || new Set<string>();
  for (const word of group.map(stem)) if (word !== token) terms.add(word);
  synonymMap.set(token,terms);
}
const records = lectures.flatMap(l => l.slides.filter(s => s.text.trim().length > 45).map(s => {
  const related = questions.filter(q => q.lecture === l.id && q.page === s.page);
  const text = `${l.title} ${l.code} ${s.text} ${related.map(q => `${q.stem} ${q.options[q.answer]} ${q.explanation}`).join(' ')}`;
  const tokens = tokenize(text); const frequencies = new Map<string,number>();
  for (const t of tokens) frequencies.set(t,(frequencies.get(t)||0)+1);
  return { lecture: l.id, page: s.page, title: s.title, text: s.text, note: s.note, tokens, frequencies, heading: new Set(tokenize(s.title)), code:l.code, lectureTitle:l.title };
}));
const averageLength = records.reduce((n,r)=>n+r.tokens.length,0)/records.length;
const frequency = new Map<string,number>();
for (const record of records) for (const term of record.frequencies.keys()) frequency.set(term,(frequency.get(term)||0)+1);
export type SearchResult = { lecture: number; page: number; title: string; snippet: string; lectureTitle: string; code: string; score: number; note: string | null | undefined };
export function searchLectures(query: string, lectureId?: number, limit = 8): SearchResult[] {
  const original = [...new Set(tokenize(query))];
  if (!original.length) return [];
  const weighted = new Map<string,number>(original.map(t=>[t,1]));
  for (const term of original) for (const related of synonymMap.get(term)||[]) if (!weighted.has(related)) weighted.set(related,.19);
  return records.filter(r=>lectureId===undefined||r.lecture===lectureId).map(r=>{
    let score=0, matches=0;
    for (const [term,weight] of weighted) {
      const tf = r.frequencies.get(term)||0;
      if (!tf) continue;
      const idf = Math.log(1+(records.length-(frequency.get(term)||0)+.5)/((frequency.get(term)||0)+.5));
      score += weight*idf*(tf*2.2)/(tf+1.2*(.25+.75*r.tokens.length/averageLength));
      if (r.heading.has(term)) score+=weight*idf*.5;
      if (weight===1)matches++;
    }
    if(matches===0)score*=.25;
    score*=1+matches/Math.max(original.length,1)*.7;
    if (/COURSE OUTLINE|Table of contents|^OUTLINE/m.test(r.text)) score*=.2;
    const paragraphs = r.text.split('\n').filter(p=>p.trim().length>3);
    const ranked = paragraphs.map((text,i)=>({text,i,score:tokenize(text).reduce((sum,t)=>sum+(weighted.get(t)||0)*Math.log(1+(records.length+.5)/((frequency.get(t)||0)+.5)),0)})).sort((a,b)=>b.score-a.score);
    const best=ranked[0];
    const excerpt=best ? paragraphs.slice(Math.max(0,best.i-1),best.i+2).join(' ') : r.text;
    return { lecture:r.lecture,page:r.page,title:r.title,lectureTitle:r.lectureTitle,code:r.code,snippet:excerpt.length>470?excerpt.slice(0,467)+'…':excerpt,score,note:r.note };
  }).filter(r=>r.score>1.2).sort((a,b)=>b.score-a.score).slice(0,limit);
}
