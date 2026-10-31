import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingPackage} from '../scripts/prepare-staging-package.mjs';

const compiled = {main:'index.js',no_bundle:true,assets:{directory:'../client'},
 rules:[{type:'ESModule',globs:['**/*.js']}],
 vars:{QUENVIRA_BILLING_MODE:'live',UNEXPECTED_SECRET:'fixture'},
 workers_dev:true,routes:['example.test/*'],triggers:{crons:['* * * * *']},
 d1_databases:[{binding:'DB',database_id:'placeholder'}]};
const staging = {name:'quenvira-staging',workers_dev:false,compatibility_date:'2026-10-22',
 compatibility_flags:['nodejs_compat'],vars:{QUENVIRA_HOSTING_MODE:'standalone',
 QUENVIRA_BILLING_MODE:'test',QUENVIRA_PAID_LAUNCH_APPROVED:'false'},
 d1_databases:[{binding:'DB',database_name:'quenvira-staging',
 database_id:'a91be5bb-6565-473e-98c2-40e83bc0e2d5'}]};

test('uses compiled entry and staging DB without inheriting live vars, routes or cron',()=>{
 const config=stagingPackage(compiled,staging);
 assert.equal(config.main,'index.js');
 assert.deepEqual(config.d1_databases,staging.d1_databases);
 assert.equal(config.vars.QUENVIRA_BILLING_MODE,'test');
 assert.equal(config.vars.QUENVIRA_SELF_SERVE,'no');
 assert.equal(config.vars.QUENVIRA_EMAIL_MODE,'test');
 assert.equal(config.vars.QUENVIRA_PAID_LAUNCH_APPROVED,'false');
 assert.equal(config.vars.UNEXPECTED_SECRET,undefined);
 assert.deepEqual(config.routes,[]);
 assert.equal(config.triggers,undefined);
 assert.equal(config.workers_dev,false);
 assert.equal(config.preview_urls,false);
 assert.equal(config.assets.run_worker_first,true);
});
test('rejects a different database or relaxed billing gate',()=>{
 for(const override of [
 {d1_databases:[{...staging.d1_databases[0],database_id:'production'}]},
 {workers_dev:true},
 {vars:{...staging.vars,QUENVIRA_BILLING_MODE:'live'}},
 {vars:{...staging.vars,QUENVIRA_PAID_LAUNCH_APPROVED:'yes'}}])
 assert.throws(()=>stagingPackage(compiled,{...staging,...override}));
});
test('rejects source entry and unexpected application bindings',()=>{
 for(const override of [{main:'./build/sites-worker.ts'}, {no_bundle:false},
 {r2_buckets:[{binding:'BUCKET'}]}, {services:[{binding:'CONNECTORS'}]},
 {queues:{consumers:[{queue:'unexpected'}]}}])
 assert.throws(()=>stagingPackage({...compiled,...override},staging));
});
