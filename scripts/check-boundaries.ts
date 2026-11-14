import ts from 'typescript';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
export function inspect(root=path.resolve('src')) {
 const errors:string[]=[];
 function walk(dir:string):string[] {return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):/\.tsx?$/.test(e.name)?[path.join(dir,e.name)]:[]);}
 for(const file of walk(root)) {
  const rel=path.relative(root,file).replaceAll('\\','/'); const content=readFileSync(file,'utf8');
  const ast=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true);
  if(rel.startsWith('backend/')&&!content.includes("import 'server-only'")) errors.push(rel+': missing server-only');
  function visit(node:ts.Node) {
   let spec:string|undefined;
   if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)) spec=node.moduleSpecifier.text;
   if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||node.expression.getText(ast)==='require')) {
    if(!node.arguments[0]||!ts.isStringLiteral(node.arguments[0])) {errors.push(rel+': nonliteral import forbidden');}
    else spec=node.arguments[0].text;
   }
   if(spec) {
    const dest=spec.startsWith('@/')?path.join(root,spec.slice(2)):spec.startsWith('.')?path.resolve(path.dirname(file),spec):undefined;
    if(dest) {
     const target=path.relative(root,dest).replaceAll('\\','/');
     if(rel.startsWith('frontend/')&&!/^(frontend|shared)\//.test(target)) errors.push(rel+': forbidden frontend import '+spec);
     if(rel.startsWith('shared/')&&!target.startsWith('shared/')) errors.push(rel+': forbidden shared import '+spec);
     if(rel.startsWith('backend/')&&!/^(backend|shared)\//.test(target)) errors.push(rel+': forbidden backend import '+spec);
    }
    if(rel.startsWith('frontend/')&&/^(node:|server-only$|fs$|path$|h5wasm|jstat)/.test(spec)) errors.push(rel+': server dependency '+spec);
   }
   ts.forEachChild(node,visit);
  }
  visit(ast);
 }
 return errors;
}
const errors=inspect();
if(errors.length) {console.error(errors.join('\n'));process.exitCode=1;} else console.log('Layer boundaries passed');
