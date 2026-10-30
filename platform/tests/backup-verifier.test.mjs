import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyBusinessBackup} from '../scripts/verify-business-backup.mjs';
import {encryptBusinessBackup} from '../public/backup-crypto.js';
import {JPEG} from './support/photo-fixture.mjs';
const password='fictional-backup-password';
const photoId=createHash('sha256').update(JPEG).digest('hex');
const snapshot=()=>({format:'quenvira-business-backup-v1',createdAt:'2026-10-30T00:00:00.000Z',workspaceName:'Synthetic only',state:{version:1,customers:[],staff:[{id:'staff1',name:'Fictional',role:'Cleaner',capacity:480,colour:'green',photoId}],jobs:[],invoices:[],audit:[]},photos:[{staffId:'staff1',photoId,jpegBase64:JPEG}]});
test('offline verification authenticates file and validates photo references without restoring records',async()=>{
 const bytes=Buffer.from(await encryptBusinessBackup(snapshot(),password));
 const result=await verifyBusinessBackup(bytes,password);
 assert.equal(result.verified,true);assert.equal(result.records.staff,1);assert.equal(result.photos,1);assert.equal(result.productionRestorePerformed,false);assert.equal(result.sha256,createHash('sha256').update(bytes).digest('hex'));assert.ok(!JSON.stringify(result).includes('Fictional'));
 await assert.rejects(verifyBusinessBackup(bytes,'incorrect-password'));
 const missing=snapshot();missing.photos=[];await assert.rejects(verifyBusinessBackup(Buffer.from(await encryptBusinessBackup(missing,password)),password),/missing staff photos/);
 const corrupt=snapshot();corrupt.photos[0].photoId='wrong';await assert.rejects(verifyBusinessBackup(Buffer.from(await encryptBusinessBackup(corrupt,password)),password),/inconsistent photo/);
});
