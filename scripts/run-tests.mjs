import ts from "typescript";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const dir=new URL("../.sites-runtime/test-build/",import.meta.url);await mkdir(dir,{recursive:true});
async function compile(file,out,transform=x=>x){let source=await readFile(new URL("../"+file,import.meta.url),"utf8");source=transform(source);const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:file});await writeFile(new URL(out,dir),result.outputText);}
await compile("lib/ledger.ts","ledger.mjs");
await compile("app/api/ledger/route.ts","api.mjs",source=>source.replace('import { env } from "cloudflare:workers";','const env=globalThis.__kasTestEnv;').replace('import { getChatGPTUser } from "../../chatgpt-auth";','const getChatGPTUser=async()=>globalThis.__kasTestUser;').replaceAll('"../../../lib/ledger"','"./ledger.mjs"'));
await compile("components/kas-app.tsx","kas-app.mjs",source=>source.replaceAll('"../lib/ledger"','"./ledger.mjs"'));
const result=spawnSync(process.execPath,["--test","tests/ledger.test.mjs","tests/api.test.mjs","tests/render.test.mjs"],{cwd:new URL("../",import.meta.url),stdio:"inherit"});process.exit(result.status??1);
