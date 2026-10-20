// Node-only operator utility. Never expose these functions as a public endpoint.
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {validateState} from '../server/domain.mjs';

export const tables={
 workspaces:['id','name','revision','document','last_operation','created_at','updated_at'],
 memberships:['workspace_id','user_id','role','staff_id'],
 history:['workspace_id','revision','document','created_at'],
 operations:['workspace_id','id','user_id','response','created_at'],
 events:['workspace_id','id','user_id','action','created_at'],
 invitations:['hash','workspace_id','email','staff_id','expires_at','accepted_by','created_at']
};
const maximum=20*1024*1024;
function validate(snapshot){
 if(!snapshot||snapshot.format!=='quenvira-logical-backup-v1'||typeof snapshot.createdAt!=='string'||!Number.isFinite(Date.parse(snapshot.createdAt))||!snapshot.tables||Object.keys(snapshot.tables).sort().join()!==Object.keys(tables).sort().join())throw Error('Unsupported or incomplete backup.');
 for(const [table,columns]of Object.entries(tables)){
  const rows=snapshot.tables[table];if(!Array.isArray(rows)||rows.length>50000)throw Error('Invalid backup rows.');
  for(const row of rows){
   if(!row||Object.keys(row).sort().join()!==[...columns].sort().join()||!Object.values(row).every(v=>v===null||typeof v==='string'||Number.isSafeInteger(v)))throw Error('Invalid backup columns or values.');
   if((table==='workspaces'||table==='history')&&!validateState(JSON.parse(row.document)))throw Error('Backup contains an unsupported workspace state.');
  }
 }
 return snapshot;
}
export function snapshotDatabase(sqlite){
 return validate({format:'quenvira-logical-backup-v1',createdAt:new Date().toISOString(),tables:Object.fromEntries(Object.entries(tables).map(([table,columns])=>[table,sqlite.prepare(`SELECT ${columns.join(',')} FROM ${table}`).all().map(row=>({...row}))]))});
}
function requireKey(key){if(!Buffer.isBuffer(key)||key.length!==32)throw Error('A separately protected 32-byte key is required.')}
export function encryptBackup(snapshot,key){
 requireKey(key);validate(snapshot);const plaintext=Buffer.from(JSON.stringify(snapshot));if(plaintext.length>maximum)throw Error('Backup exceeds the operator utility size limit.');
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(Buffer.from('quenvira-backup-v1'));
 const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]);return Buffer.from(JSON.stringify({format:'quenvira-encrypted-backup-v1',nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),encrypted:encrypted.toString('base64')}));
}
export function decryptBackup(bytes,key){
 requireKey(key);if(!Buffer.isBuffer(bytes)||bytes.length>maximum*2)throw Error('Invalid encrypted backup size.');
 try{
  const value=JSON.parse(bytes.toString('utf8'));if(value.format!=='quenvira-encrypted-backup-v1')throw Error();
  const nonce=Buffer.from(value.nonce,'base64'),tag=Buffer.from(value.tag,'base64');if(nonce.length!==12||tag.length!==16)throw Error();
  const decipher=createDecipheriv('aes-256-gcm',key,nonce);decipher.setAAD(Buffer.from('quenvira-backup-v1'));decipher.setAuthTag(tag);
  const plaintext=Buffer.concat([decipher.update(Buffer.from(value.encrypted,'base64')),decipher.final()]);if(plaintext.length>maximum)throw Error();return validate(JSON.parse(plaintext.toString('utf8')));
 }catch{throw Error('Backup authentication or validation failed. No records restored.')}
}
export function restoreIntoEmptyDatabase(sqlite,snapshot){
 validate(snapshot);for(const table of Object.keys(tables))if(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n!==0)throw Error('Restore requires an empty isolated database.');
 sqlite.exec('PRAGMA foreign_keys = ON');sqlite.exec('BEGIN');
 try{
  for(const [table,columns]of Object.entries(tables)){
   const insert=sqlite.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`);
   for(const row of snapshot.tables[table])insert.run(...columns.map(c=>row[c]));
  }
  if(sqlite.prepare('PRAGMA foreign_key_check').all().length||sqlite.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Restored database failed integrity checks.');
  sqlite.exec('COMMIT');return Object.fromEntries(Object.keys(tables).map(t=>[t,snapshot.tables[t].length]));
 }catch(error){sqlite.exec('ROLLBACK');throw error}
}
