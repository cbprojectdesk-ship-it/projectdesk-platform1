import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
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
test('offline CLI preserves exact UTF-8 password bytes and handles spaced paths without exposing secrets',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'quenvira offline verification '));
 const secret='Fictional Unicode 🔐 trailing space ';
 try{
  const file=join(directory,'business snapshot.qvb');
  await writeFile(file,await encryptBusinessBackup(snapshot(),secret),{mode:0o600});
  const script=fileURLToPath(new URL('../scripts/verify-business-backup.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[script,file],{input:Buffer.from(secret,'utf8'),encoding:'utf8',timeout:15000});
  assert.ifError(result.error);assert.equal(result.status,0);assert.equal(result.stderr,'');
  const receipt=JSON.parse(result.stdout);assert.equal(receipt.verified,true);assert.equal(receipt.photos,1);assert.equal(receipt.productionRestorePerformed,false);
  assert.ok(!result.stdout.includes(secret));assert.equal(receipt.sha256,createHash('sha256').update(await readFile(file)).digest('hex'));
  const newline=spawnSync(process.execPath,[script,file],{input:Buffer.from(secret+'\r\n','utf8'),encoding:'utf8',timeout:15000});
  assert.ifError(newline.error);assert.equal(newline.status,1);assert.equal(newline.stdout,'');assert.match(newline.stderr,/Backup verification failed/);assert.ok(!newline.stderr.includes(secret));
 }finally{await rm(directory,{recursive:true,force:true})}
});
