import test from 'node:test';
import assert from 'node:assert/strict';
import {database,setup,fixtures,command,job} from './support/database.mjs';

test('a visit can be booked unassigned when staffId is omitted or null',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 const omitted=await command(db,w,'job.save',{...job(f),staffId:undefined});
 assert.equal(omitted.status,200);
 assert.equal(omitted.body.result[0].staffId,'');
 const nulled=await command(db,w,'job.save',{...job(f),time:'11:00',staffId:null});
 assert.equal(nulled.status,200);
 assert.equal(nulled.body.result[0].staffId,'');
 db.sqlite.close();
});

test('customer and staff commands accept omitted optional fields with clear errors',async()=>{
 const db=database(),w=await setup(db);
 const minimal=await command(db,w,'customer.save',{name:'Fictional Minimal',type:'Domestic',address:'1 Fictional Street'});
 assert.equal(minimal.status,200);
 assert.equal(minimal.body.result.email,'');
 assert.equal(minimal.body.result.notes,'');
 const staff=await command(db,w,'staff.add',{name:'Fictional Worker',capacity:480});
 assert.equal(staff.status,200);
 assert.equal(staff.body.result.role,'Cleaning specialist');
 const noName=await command(db,w,'customer.save',{type:'Domestic',address:'1 Fictional Street'});
 assert.equal(noName.status,400);assert.match(noName.body.error,/Customer name is required/);
 const noStaffName=await command(db,w,'staff.add',{capacity:480});
 assert.equal(noStaffName.status,400);assert.match(noStaffName.body.error,/Staff name is required/);
 db.sqlite.close();
});

test('a visit without a round reports the required field instead of a generic error',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 const missing=await command(db,w,'job.save',{...job(f),round:''});
 assert.equal(missing.status,400);assert.match(missing.body.error,/Round name is required/);
 db.sqlite.close();
});
