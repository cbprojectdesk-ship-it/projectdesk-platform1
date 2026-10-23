import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../server/api.mjs';
import {database,ORIGIN} from './support/database.mjs';
const request=method=>new Request(ORIGIN+'/api/quenvira/health',{method});
test('anonymous readiness checks migrated database, object storage and configuration without reading business rows',async()=>{
 const db=database();const r=await handle(request('GET'),db,{bucket:db.bucket});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'ok'});assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n,0);db.sqlite.close();
});
test('readiness fails closed on missing storage, unavailable database or incompatible billing configuration',async()=>{
 const db=database();
 for(const [store,options] of [[db,{}],[undefined,{bucket:db.bucket}],[{prepare(){throw Error('private database detail')}},{bucket:db.bucket}],[db,{bucket:db.bucket,billingEnv:{QUENVIRA_BILLING_MODE:'live'}}],[db,{bucket:{list(){throw Error('private object key')}}}]]){
  const r=await handle(request('GET'),store,options);assert.equal(r.status,503);assert.deepEqual(await r.json(),{status:'unavailable'});
 }
 db.sqlite.close();
});
test('readiness rejects writes without touching storage',async()=>{
 const r=await handle(request('POST'),{prepare(){throw Error('must not query')}});assert.equal(r.status,405);assert.deepEqual(await r.json(),{status:'method_not_allowed'});
});
