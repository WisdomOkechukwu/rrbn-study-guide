import type { Session, Result } from './store';
export type ProgressData = { name:string; theme:'light'|'dark'; bookmarks:string[]; known:string[]; seenSlides:Record<string,number>; responses:Record<string,{selected:number;correct:boolean;date:string}>; history:Result[]; session:Session|null; minutes:number };
export function freshProgress():ProgressData {return {name:'Student',theme:'light',bookmarks:[],known:[],seenSlides:{},responses:{},history:[],session:null,minutes:30};}
export function progressData(state:ProgressData):ProgressData {return {name:state.name,theme:state.theme,bookmarks:state.bookmarks,known:state.known,seenSlides:state.seenSlides,responses:state.responses,history:state.history,session:state.session,minutes:state.minutes};}
export function validProgress(value:unknown):value is ProgressData {
 if(!value || typeof value!=='object')return false;
 const s=value as ProgressData;
 const ids=(v:unknown)=>Array.isArray(v)&&v.length<=10000&&v.every(id=>typeof id==='string'&&/^q\d{3,5}$/.test(id));
 const record=(v:unknown)=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
 if(typeof s.name!=='string'||s.name.length>100||!['light','dark'].includes(s.theme)||!ids(s.bookmarks)||!ids(s.known)||!record(s.seenSlides)||!record(s.responses)||!Number.isFinite(s.minutes)||s.minutes<0||s.minutes>1440||!Array.isArray(s.history)||s.history.length>100)return false;
 if(!Object.entries(s.seenSlides).every(([id,page])=>/^\d+$/.test(id)&&Number.isInteger(page)&&page>=1&&page<=10000))return false;
 if(!Object.entries(s.responses).every(([id,r])=>/^q\d{3,5}$/.test(id)&&r&&Number.isInteger(r.selected)&&r.selected>=0&&r.selected<4&&typeof r.correct==='boolean'&&typeof r.date==='string'))return false;
 if(!s.history.every(r=>r&&typeof r.id==='string'&&typeof r.date==='string'&&Number.isInteger(r.total)&&r.total>0&&Number.isInteger(r.correct)&&r.correct>=0&&r.correct<=r.total&&['practice','exam'].includes(r.mode)&&Number.isFinite(r.seconds)&&r.seconds>=0))return false;
 if(s.session!==null){const r=s.session;if(!r||typeof r.id!=='string'||!ids(r.ids)||r.ids.length===0||!['practice','exam'].includes(r.mode)||!Number.isInteger(r.index)||r.index<0||r.index>=r.ids.length||!record(r.answers)||!Object.entries(r.answers).every(([id,n])=>r.ids.includes(id)&&Number.isInteger(n)&&n>=0&&n<4)||!(r.expiresAt===null||Number.isFinite(r.expiresAt))||!Number.isFinite(r.duration)||r.duration<0||!Number.isFinite(r.startedAt)||typeof r.finished!=='boolean'||!(r.focus===undefined||typeof r.focus==='string'))return false;}
 return true;
}
