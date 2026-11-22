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
