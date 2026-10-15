#!/usr/bin/env node
// Syntax-checks every Lua file in the addon folders with luaparse (Lua 5.1
// grammar, which is what the WoW client uses). Run from the repository root:
//
//   npm install --no-save luaparse   (once)
//   node tools/check-lua.js
//
// Exit code 1 if any file fails to parse. Also reports chunk-level local
// counts, because the client refuses a chunk with more than 200 locals.

const fs = require('fs');
const path = require('path');

let luaparse;
try {
  luaparse = require('luaparse');
} catch (e) {
  console.error('luaparse is not installed. Run: npm install --no-save luaparse');
  process.exit(2);
}

const repoRoot = path.resolve(__dirname, '..');
const folders = ['AchievementsForever', 'AchievementsForeverProbe', 'AchievementsForeverData'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out); else if (/\.lua$/i.test(entry.name)) out.push(p);
  }
  return out;
}

let failures = 0;
for (const folder of folders) {
  const dir = path.join(repoRoot, folder);
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const rel = path.relative(repoRoot, file);
    const source = fs.readFileSync(file, 'utf8');
    if (source.length > 4 * 1024 * 1024) { console.log(`skip  ${rel} (${(source.length / 1048576).toFixed(1)} MB, generated data)`); continue; }
    try {
      // 5.2 grammar: luaparse's 5.1 mode rejects "break;" with a semicolon,
      // which Lua 5.1 and the WoW client accept. Nothing else differs for us.
      const ast = luaparse.parse(source, { luaVersion: '5.2', comments: false, scope: false, locations: false });
      let chunkLocals = 0;
      for (const node of ast.body) {
        if (node.type === 'LocalStatement') chunkLocals += node.variables.length;
        else if (node.type === 'FunctionDeclaration' && node.isLocal) chunkLocals += 1;
      }
      const flag = chunkLocals > 190 ? '  <-- near the 200-local limit' : '';
      console.log(`ok    ${rel}  (chunk locals: ${chunkLocals})${flag}`);
    } catch (e) {
      failures++;
      console.log(`FAIL  ${rel}: ${e.message}`);
    }
  }
}
console.log(failures === 0 ? 'all files parse' : `${failures} file(s) failed`);
process.exit(failures === 0 ? 0 : 1);
