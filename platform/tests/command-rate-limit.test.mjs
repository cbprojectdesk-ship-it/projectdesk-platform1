import test from 'node:test';
import assert from 'node:assert/strict';
import {database,setup,fixtures,request,command,customer} from './support/database.mjs';

test('failed authenticated commands are persistently throttled while recovery remains available',async()=>{
 const db=database(),w=await setup(db);
 await fixtures(db,w);
 await command(db,w,'customer.save',customer);
 for(let n=0;n<120;n++)assert.ok([400,429].includes((await command(db,w,'not.a.real.command',{},'alice')).status));
 assert.equal((await command(db,w,'customer.save',customer)).status,429);
 assert.equal((await command(db,w,'backup.restore',{revision:0})).status,200);
 assert.equal((await command(db,w,'customer.save',customer)).status,429);
 const row=db.sqlite.prepare('SELECT attempts FROM command_rate_limits WHERE workspace_id=? AND user_id=?').get(w,'alice');
 assert.ok(row.attempts>=122);
 const bob=await setup(db,'bob');assert.equal((await command(db,bob,'customer.save',customer,'bob')).status,200);
 db.sqlite.close();
});

test('staff deactivation remains available after the failed-command limit',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 for(let n=0;n<120;n++)assert.ok([400,429].includes((await command(db,w,'not.a.real.command',{},'alice')).status));
 assert.equal((await command(db,w,'staff.active',{id:f.staffId,active:false})).status,200);
 assert.equal((await request(db,'workspaces/'+w)).body.state.staff[0].active,false);
 db.sqlite.close();
});

test('counter is scoped to workspace and user and survives a fresh handle',async()=>{
 const db=database(),a=await setup(db,'alice'),b=await setup(db,'bob');
 for(let n=0;n<120;n++)await command(db,a,'not.a.real.command',{},'alice',crypto.randomUUID(),0);
 assert.equal((await command(db,a,'customer.save',customer)).status,429);
 assert.equal((await command(db,b,'customer.save',customer,'bob')).status,200);
 const row=db.sqlite.prepare('SELECT attempts FROM command_rate_limits WHERE workspace_id=? AND user_id=?').get(a,'alice');
 assert.ok(row.attempts>=120);
 db.sqlite.close();
});
