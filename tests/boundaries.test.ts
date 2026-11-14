import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {inspect} from '../scripts/check-boundaries';
test('boundary guard catches aliases, relative paths, reexports, dynamic imports and shared bridges',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'earth-boundaries-'));
 try {
  for(const dir of ['frontend','shared','backend']) mkdirSync(path.join(root,dir));
  for(const code of ["import x from '@/backend/x'", "export * from '../backend/x'", "const x=import('../backend/x')", "const x=require('../backend/x')"]) {writeFileSync(path.join(root,'frontend/test.ts'),code); assert(inspect(root).length>0);}
  writeFileSync(path.join(root,'frontend/test.ts'),"import x from '@/shared/x'");
  writeFileSync(path.join(root,'shared/x.ts'),"export * from '../backend/x'"); assert(inspect(root).length>0);
 } finally {rmSync(root,{recursive:true,force:true});}
});
