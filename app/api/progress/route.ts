import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { progressData, validProgress } from '../../progress-data';

let database:DatabaseSync|undefined;
function db(){
 if(!database){const file=process.env.RADIA_DB_PATH||join(process.cwd(),'.data','radia.sqlite');mkdirSync(dirname(file),{recursive:true});database=new DatabaseSync(file);database.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS progress (profile_id TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at TEXT NOT NULL)');}
 return database;
}
async function profile(){const jar=await cookies();const existing=jar.get('radia-profile')?.value;return existing&&/^[a-f0-9-]{36}$/.test(existing)?existing:crypto.randomUUID();}
function reply(data:unknown,id:string,status=200,issueCookie=false){const res=NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});if(issueCookie)res.cookies.set('radia-profile',id,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production'&&process.env.RADIA_SECURE_COOKIE==='true',path:'/',maxAge:60*60*24*365});return res;}
function sameOrigin(request:Request){
 if(request.headers.get('sec-fetch-site')==='cross-site')return false;
 const origin=request.headers.get('origin');
 if(!origin)return true;
 try{return new URL(origin).host===(request.headers.get('host')||new URL(request.url).host);}catch{return false;}
}
export async function GET(){const id=await profile();try{const row=db().prepare('SELECT state, updated_at FROM progress WHERE profile_id=?').get(id);return reply({state:row?JSON.parse(String(row.state)):null,updatedAt:row?.updated_at||null},id,200,true);}catch{return reply({error:'Study storage is temporarily unavailable.'},id,503,true);}}
export async function PUT(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin.'},{status:403});
 const id=await profile();
 try{const text=await request.text();if(text.length>2_000_000)return reply({error:'Progress exceeds the storage limit.'},id,413);const state:unknown=JSON.parse(text);if(!validProgress(state))return reply({error:'Invalid study progress.'},id,400);const updatedAt=new Date().toISOString();db().prepare('INSERT INTO progress(profile_id,state,updated_at) VALUES(?,?,?) ON CONFLICT(profile_id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at').run(id,JSON.stringify(progressData(state)),updatedAt);return reply({updatedAt},id);}catch{return reply({error:'Could not save study progress.'},id,503);}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin.'},{status:403});const id=await profile();try{db().prepare('DELETE FROM progress WHERE profile_id=?').run(id);return reply({cleared:true},crypto.randomUUID(),200,true);}catch{return reply({error:'Could not clear saved progress. Please try again.'},id,503);}}
