// Offline, read-only verification. Never connects to Quenvira or writes records.
import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {decryptBusinessBackup,BACKUP_LIMIT} from '../public/backup-crypto.js';
import {prepareBusinessRestore} from '../server/business-backup.mjs';
const fileLimit=Math.ceil(BACKUP_LIMIT*1.4+1024);
export async function verifyBusinessBackup(bytes,password){
 if(!Buffer.isBuffer(bytes)||bytes.length>fileLimit)throw Error('Choose an encrypted business backup smaller than 29 MB.');
 const snapshot=await decryptBusinessBackup(bytes.toString('utf8'),password);
 let photos=0;
 // Exercise the application's complete restore validation against a sink, never
 // a real bucket or database. Photo bytes are checked and then discarded.
 const state=await prepareBusinessRestore({staff:[],customers:[],jobs:[],invoices:[],audit:[]},{role:'manager'},snapshot,'offline-verification',{put:async()=>{photos++}},async value=>createHash('sha256').update(value).digest('hex'));
 return {verified:true,sha256:createHash('sha256').update(bytes).digest('hex'),encryptedBytes:bytes.length,createdAt:snapshot.createdAt,records:Object.fromEntries(['customers','staff','jobs','invoices','quotes','availability','leaveRequests','notifications'].map(k=>[k,state[k]?.length||0])),photos,productionRestorePerformed:false};
}
async function main(){
 if(process.argv.length!==3||process.stdin.isTTY)throw Error('Usage: pipe a password on stdin to node platform/scripts/verify-business-backup.mjs /path/business.qvb. Never put passwords in arguments.');
 const file=await open(process.argv[2],'r');let bytes;
 try{const info=await file.stat();if(!info.isFile()||info.size>fileLimit)throw Error('Choose a regular backup file smaller than 29 MB.');bytes=await file.readFile();}finally{await file.close()}
 const chunks=[];let size=0;
 for await(const chunk of process.stdin){size+=chunk.length;if(size>1024)throw Error('Invalid password input.');chunks.push(chunk)}
 const passwordBytes=Buffer.concat(chunks);
 try{const password=passwordBytes.toString('utf8');console.log(JSON.stringify(await verifyBusinessBackup(bytes,password),null,2))}finally{passwordBytes.fill(0);for(const chunk of chunks)chunk.fill(0)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Backup verification failed. Check the file, password and backup integrity. No records were restored.');process.exitCode=1});
