// Local, non-production migration validation. It uses an in-memory SQLite database
// and never connects to D1 or any hosted resource.
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const required=['workspaces','memberships','history','operations','events','invitations','subscription_accounts','subscription_events','invoice_outbox','invoice_email_events','command_attempts'];
const sqlite=new DatabaseSync(':memory:');
try{
 sqlite.exec('PRAGMA foreign_keys = ON');
 const files=fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 for(const name of files)sqlite.exec(fs.readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 const tables=new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
 for(const table of required)if(!tables.has(table))throw Error('Missing migrated table: '+table);
 if(sqlite.prepare('PRAGMA foreign_key_check').all().length)throw Error('Foreign-key check failed');
 if(sqlite.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('SQLite quick_check failed');
 console.log(JSON.stringify({ok:true,migrations:files.length,tables:required.length,foreignKeyCheck:'ok',quickCheck:'ok'}));
}finally{sqlite.close()}
