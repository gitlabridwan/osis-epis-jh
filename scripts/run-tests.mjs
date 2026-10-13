import ts from "typescript";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const dir = new URL("../.sites-runtime/test-build/", import.meta.url);
await mkdir(dir, { recursive: true });
const localImports = source => source.replace(/"(?:\.\.\/)+lib\/([\w-]+)"/g, '"./$1.mjs"')
  .replace(/"\.\/([\w-]+)"/g, '"./$1.mjs"');
async function compile(file, out, transform = localImports) {
  const source = transform(await readFile(new URL("../" + file, import.meta.url), "utf8"));
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }, fileName: file });
  await writeFile(new URL(out, dir), result.outputText);
}
await compile("lib/ledger.ts", "ledger.mjs");
await compile("lib/http.ts", "http.mjs");
await compile("lib/password.ts", "password.mjs");
await compile("lib/auth.ts", "auth.mjs", source => localImports(source.replace('import { env } from "cloudflare:workers";', 'const env = globalThis.__kasTestEnv;')));
await compile("app/api/ledger/route.ts", "api.mjs");
for (const action of ["login", "register", "logout", "session"]) await compile(`app/api/auth/${action}/route.ts`, `auth-${action}.mjs`);
await compile("components/kas-app.tsx", "kas-app.mjs");
await compile("components/auth-form.tsx", "auth-form.mjs");
const result = spawnSync(process.execPath, ["--test", "tests/ledger.test.mjs", "tests/api.test.mjs", "tests/render.test.mjs"], { cwd: new URL("../", import.meta.url), stdio: "inherit" });
process.exit(result.status ?? 1);
