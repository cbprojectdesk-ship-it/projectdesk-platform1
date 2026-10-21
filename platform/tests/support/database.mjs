import {memoryBucket} from './bucket.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handle} from '../../server/api.mjs';
export const ORIGIN='https://quenvira.test';
export const fixed=()=>new Date('2026-10-20T10:00:00Z');
export function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys = ON');
 for(const name of fs.readdirSync(new URL('../../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../../drizzle/'+name,import.meta.url),'utf8'));
 const db={sqlite,bucket:memoryBucket(),beforeBatch:null,failAt:null,prepare(sql){let values=[];const statement={sql,bind(...v){values=v;return statement},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){return {meta:sqlite.prepare(sql).run(...values)}},execute(){const q=sqlite.prepare(sql);if(q.columns().length)return {results:q.all(...values)};return {results:[],meta:q.run(...values)}}};return statement},async batch(statements){if(db.beforeBatch){const f=db.beforeBatch;db.beforeBatch=null;f()}sqlite.exec('BEGIN');try{const result=statements.map((s,i)=>{if(db.failAt===i)throw Error('Injected database failure');return s.execute()});sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};return db;
}
export async function request(db,path,body,user='alice',extra={}){
 const headers={'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.com',...extra};if(body!==undefined){headers.origin=ORIGIN;headers['content-type']='application/json'}
 if(user===null){delete headers['oai-authenticated-user-id'];delete headers['oai-authenticated-user-email']}
 const r=await handle(new Request(ORIGIN+'/api/quenvira/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),db,{now:fixed,bucket:db?.bucket});return {status:r.status,body:await r.json(),headers:r.headers};
}
export async function setup(db,user='alice'){const r=await request(db,'workspaces',{name:user+' cleaning'},user);assert.equal(r.status,201);return r.body.workspaceId}
export async function command(db,w,action,data,user='alice',requestId=crypto.randomUUID(),revision){if(revision===undefined){const current=await request(db,'workspaces/'+w,undefined,user);revision=current.body.revision}return request(db,`workspaces/${w}/commands${action==='staff.photo'?'/photo':''}`,{action,data,revision,requestId},user)}
export const customer={name:'Fictional Home',type:'Domestic',address:'Fictional Street',email:'home@example.com',notes:'Use unscented products'};
export async function fixtures(db,w){const c=await command(db,w,'customer.save',customer),s=await command(db,w,'staff.add',{name:'Fictional Worker',role:'Cleaner',capacity:480});assert.equal(c.status,200);assert.equal(s.status,200);return {customerId:c.body.result.id,staffId:s.body.result.id}}
export const job=f=>({...f,date:'2026-10-20',time:'09:00',duration:120,price:10003,repeat:'One-off',count:1,round:'Local'});
