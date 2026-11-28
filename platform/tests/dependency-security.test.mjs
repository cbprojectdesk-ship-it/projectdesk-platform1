import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const version=name=>pkg.dependencies?.[name]??pkg.devDependencies?.[name];

test('React Server Components runtime is not below the patched 19.2.9 release',()=>{
 // GHSA-xqc2-xf4c-x3h3: unauthenticated RCE in React Server Components.
 // The RSC runtime is a devDependency but is bundled into the production Worker.
 for(const name of ['react','react-dom','react-server-dom-webpack']){
  const parts=String(version(name)||'').split('.').map(Number);
  assert.ok(parts.length===3&&parts.every(Number.isSafeInteger),name+' must be an exact version');
  const [major,minor,patch]=parts;
  assert.ok(major>19||major===19&&(minor>2||minor===2&&patch>=9),name+' '+version(name)+' is below 19.2.9');
 }
});
