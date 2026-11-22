import test from 'node:test';
import assert from 'node:assert/strict';
import {database,setup,command} from './support/database.mjs';

test('failed authenticated commands are throttled even when nothing commits',async()=>{
  const db=database(),w=await setup(db);
  for(let n=0;n<120;n++){
    const result=await command(db,w,'no.such.command',{},'alice','bad-'+n,0);
    assert.equal(result.status,400,'attempt '+n);
  }
  const blocked=await command(db,w,'no.such.command',{},'alice','bad-121',0);
  assert.equal(blocked.status,429);
  assert.match(blocked.body.error,/Too many requests/);
  const table=db.sqlite.prepare('SELECT count FROM command_attempts').get();
  assert.ok(table.count>=121);
});

test('malformed command bodies are throttled before parsing can be abused',async()=>{
  const db=database(),w=await setup(db);
  const raw=()=>new Request('https://quenvira.test/api/quenvira/workspaces/'+w+'/commands',{method:'POST',headers:{'oai-authenticated-user-id':'alice','oai-authenticated-user-email':'alice@example.com',origin:'https://quenvira.test','content-type':'application/json'},body:'{'});
  const {handle}=await import('../server/api.mjs');
  for(let n=0;n<120;n++)assert.equal((await handle(raw(),db,{now:()=>new Date('2026-10-20T10:00:00Z')})).status,400,'attempt '+n);
  assert.equal((await handle(raw(),db,{now:()=>new Date('2026-10-20T10:00:00Z')})).status,429);
});
