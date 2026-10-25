'use client';
import { useEffect,useRef,useState } from 'react';
import { useStudy } from './store';
import { freshProgress,progressData,validProgress } from './progress-data';

type Status='loading'|'saved'|'saving'|'offline';
export function useProgressSync(){
 const [status,setStatus]=useState<Status>('loading');
 const [resetting,setResetting]=useState(false);
 const controller=useRef<{reset:()=>Promise<void>;flush:()=>void}|null>(null);
 useEffect(()=>{
  let alive=true,initialized=false,paused=false,generation=0;
  let timer:ReturnType<typeof setTimeout>|undefined;
  let queue=Promise.resolve();
  const update=(status:Status)=>{if(alive)setStatus(status);};
  const save=()=>{
   if(!initialized||paused||!alive)return;
   const payload=JSON.stringify(progressData(useStudy.getState())),version=generation;
   update('saving');
   queue=queue.then(async()=>{if(version!==generation)return;try{const res=await fetch('/api/progress',{method:'PUT',headers:{'Content-Type':'application/json'},body:payload});if(!res.ok)throw Error();if(version===generation){localStorage.setItem('radia-progress-synced',payload);update(JSON.stringify(progressData(useStudy.getState()))===payload?'saved':'saving');}}catch{if(version===generation)update('offline');}});
  };
  const start=async()=>{
   const before=JSON.stringify(progressData(useStudy.getState()));
   const synced=localStorage.getItem('radia-progress-synced');
   const dirty=localStorage.getItem('radia-study-v1')!==null && before!==(synced||JSON.stringify(freshProgress()));
   try{const res=await fetch('/api/progress',{cache:'no-store'});if(!res.ok)throw Error();const data=await res.json();if(!alive)return;
    if(validProgress(data.state)&&before===JSON.stringify(progressData(useStudy.getState()))&&!dirty)useStudy.setState(data.state);
    initialized=true;save();
   }catch{if(alive){initialized=true;update('offline');}}
  };
  const unsubscribe=useStudy.subscribe(()=>{if(!initialized||paused)return;clearTimeout(timer);timer=setTimeout(save,350);});
  const reset=async()=>{
   if(!initialized)throw Error('Please wait for storage to finish loading.');
   paused=true;generation++;clearTimeout(timer);setResetting(true);
   try{await queue;const res=await fetch('/api/progress',{method:'DELETE'});if(!res.ok)throw Error('The database could not be cleared. Your progress has been kept; please try again.');useStudy.setState(freshProgress());localStorage.removeItem('radia-progress-updated-at');localStorage.removeItem('radia-progress-synced');localStorage.setItem('radia-reset',crypto.randomUUID());update('saved');}
   finally{paused=false;if(alive)setResetting(false);}
  };
  const otherTabReset=(event:StorageEvent)=>{if(event.key==='radia-reset'){localStorage.removeItem('radia-progress-synced');generation++;clearTimeout(timer);paused=true;useStudy.setState(freshProgress());paused=false;update('saved');}};
  const retry=()=>save();
  controller.current={reset,flush:save};window.addEventListener('online',retry);window.addEventListener('storage',otherTabReset);
  void start();
  return()=>{alive=false;clearTimeout(timer);unsubscribe();window.removeEventListener('online',retry);window.removeEventListener('storage',otherTabReset);controller.current=null;};
 },[]);
 return {status,resetting,reset:async()=>{if(!controller.current)throw Error('Study storage is not ready.');await controller.current.reset();},retry:()=>controller.current?.flush()};
}
