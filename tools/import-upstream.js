#!/usr/bin/env node
// Imports the upstream "Achievements" addon by Deathwing (GPL-3.0) into this
// repository as "Achievements Forever" and applies the mechanical renames the
// WoW Forever client needs. Re-run it whenever upstream publishes a release.
//
//   node tools/import-upstream.js <upstream-git-checkout> <release-unzipped-dir>
//
// <upstream-git-checkout>   clone of https://github.com/Deathwing/achievements
// <release-unzipped-dir>    the extracted Achievements_Bundled.zip (contains
//                           Achievements/ and AchievementsData/)
//
// What it does, in order:
//   1. Copies the runtime Lua, the Vanilla UI copy, media, bindings and licence
//      into AchievementsForever/.
//   2. Copies the Classic data file, icon assets and licence into
//      AchievementsForeverData/.
//   3. Renames globals so the addon cannot collide with upstream or with the
//      Forever client: saved variables, the data table, the addon namespace,
//      the addon-message prefix, media paths and key bindings.
//   4. Guards every global achievement API definition so natives that exist in
//      Forever (GetAchievementInfo, GetCategoryList, ...) are never overwritten.
//      Overwriting a native that Blizzard's protected code reads taints it.
//   5. Strips upstream's debug-build marker lines.
//   6. Writes the Forever TOC files.

const fs = require('fs');
const path = require('path');

const [,, upstreamDir, releaseDir] = process.argv;
if (!upstreamDir || !releaseDir) {
  console.error('usage: node tools/import-upstream.js <upstream-checkout> <release-unzipped-dir>');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const runtimeOut = path.join(repoRoot, 'AchievementsForever');
const dataOut = path.join(repoRoot, 'AchievementsForeverData');
const runtimeIn = path.join(releaseDir, 'Achievements');
const dataIn = path.join(releaseDir, 'AchievementsData');

const VERSION = '0.1.0';

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function copyDir(src, dst, filter) {
  mkdirp(dst);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (filter && !filter(s, entry)) continue;
    if (entry.isDirectory()) copyDir(s, d, filter); else fs.copyFileSync(s, d);
  }
}
function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { mkdirp(path.dirname(p)); fs.writeFileSync(p, s, 'utf8'); }

// ---------------------------------------------------------------- 1. runtime
// Files of our own that live inside the upstream tree and must survive a re-import.
const KEEP = ['Vanilla/Blizzard_AchievementUI/AchievementsForeverSearch.lua'];
const kept = {};
for (const rel of KEEP) {
  const p = path.join(runtimeOut, ...rel.split('/'));
  if (fs.existsSync(p)) kept[rel] = read(p);
}
rmrf(runtimeOut);
copyDir(runtimeIn, runtimeOut, (s, e) => {
  const rel = path.relative(runtimeIn, s).replace(/\\/g, '/');
  if (rel === 'TBC' || rel.startsWith('TBC/')) return false;      // Forever is vanilla content
  if (rel === 'Achievements.toc') return false;                     // we write our own TOC
  if (rel === 'README.md' || rel === 'CHANGELOG.md') return false;  // repo-level docs instead
  return true;
});

for (const [rel, text] of Object.entries(kept)) write(path.join(runtimeOut, ...rel.split('/')), text);

// ---------------------------------------------------------------- 2. data
rmrf(dataOut);
copyDir(dataIn, dataOut, (s, e) => {
  const rel = path.relative(dataIn, s).replace(/\\/g, '/');
  if (rel === 'AchievementsData_TBC.lua') return false;
  if (rel === 'AchievementsData.toc') return false;
  if (rel === 'README.md' || rel === 'CHANGELOG.md') return false;
  return true;
});
fs.renameSync(path.join(dataOut, 'AchievementsData_Classic.lua'), path.join(dataOut, 'AchievementsForeverData_Classic.lua'));

// ---------------------------------------------------------------- 3. renames
const RENAMES = [
  // saved variables
  [/\bAchievementsCharacterDB\b/g, 'AchievementsForeverCharacterDB'],
  [/\bAchievementsDB\b/g, 'AchievementsForeverDB'],
  // generated data table (defined in the data file, read by the runtime)
  [/\bAchievementsData\b/g, 'AchievementsForeverData'],
  // addon namespace global; the local alias "Achievements" inside each file stays
  [/_G\.Achievements\b/g, '_G.AchievementsForever'],
  [/rawget\(_G,\s*"Achievements"\)/g, 'rawget(_G, "AchievementsForever")'],
  // addon-message prefix so upstream clients never talk to us
  [/"ACHV"/g, '"ACHVFOREVER"'],
  // ADDON_LOADED comparisons against the folder name, both forms
  [/==\s*"Achievements"/g, '== "AchievementsForever"'],
  [/~=\s*"Achievements"/g, '~= "AchievementsForever"'],
  // the bundled UI files have no local alias and reference the namespace global
  // directly: `Achievements and Achievements.addonName or "Achievements"`
  [/\bAchievements(?=\s+and\s|\.addonName|\.GetSuggestedAchievements)/g, 'AchievementsForever'],
  [/or\s+"Achievements";/g, 'or "AchievementsForever";'],
  // media and asset paths
  [/AddOns(\\+)AchievementsData(\\+)/g, 'AddOns$1AchievementsForeverData$2'],
  [/AddOns(\\+)Achievements(\\+)/g, 'AddOns$1AchievementsForever$2'],
  // key bindings: Forever already has TOGGLEACHIEVEMENT natively
  [/\bBINDING_HEADER_ACHIEVEMENTS\b/g, 'BINDING_HEADER_ACHIEVEMENTSFOREVER'],
  [/\bBINDING_NAME_TOGGLEACHIEVEMENT\b/g, 'BINDING_NAME_AF_TOGGLEACHIEVEMENT'],
  [/\bBINDING_NAME_TOGGLESTATISTICS\b/g, 'BINDING_NAME_AF_TOGGLESTATISTICS'],
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const textFiles = [...walk(runtimeOut), ...walk(dataOut)].filter(p => /\.(lua|xml|toc|md)$/i.test(p));
let renameHits = 0;
for (const file of textFiles) {
  let text = read(file);
  const before = text;
  for (const [re, to] of RENAMES) {
    text = text.replace(re, (m, ...rest) => { renameHits++; return typeof to === 'function' ? to(m, ...rest) : m.replace(re, to); });
  }
  // 5. upstream build markers
  text = text.split('\n').filter(l => !/--\s*REMOVE_LINE\s*$/.test(l)).join('\n');
  if (text !== before) write(file, text);
}
console.log('rename hits:', renameHits);

// ---------------------------------------------------------------- 4. guard native API globals
const apiFile = path.join(runtimeOut, 'AchievementsAPI.lua');
let api = read(apiFile);
const guardRe = /^function (\w+)\(([^)]*)\)\r?\n\treturn ([^\r\n]+);\r?\nend/gm;
const guarded = [];
api = api.replace(guardRe, (m, name, args, body) => {
  guarded.push(name);
  return `if type(_G.${name}) ~= "function" then\n\tfunction ${name}(${args})\n\t\treturn ${body};\n\tend\nelse\n\tAchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "${name}";\nend`;
});
api = api.replace(/^(local Achievements = _G\.AchievementsForever;)/m,
  `$1\n-- Names of achievement API globals the client already provides natively. The\n-- Forever client ships the retail achievement API for its Legacy system, so\n-- these are never overwritten; the UI must call Achievements.* instead.\nAchievementsForeverNativeAPI = AchievementsForeverNativeAPI or {};`);
write(apiFile, api);
console.log('guarded API globals:', guarded.length);

// ---------------------------------------------------------------- 6. bindings and TOCs
write(path.join(runtimeOut, 'Bindings.xml'), `<Bindings>
\t<Binding name="AF_TOGGLEACHIEVEMENT" header="ACHIEVEMENTSFOREVER" category="ADDONS">
\t\tAchievementsForever.ToggleAchievementFrame(false)
\t</Binding>
\t<Binding name="AF_TOGGLESTATISTICS" category="ADDONS">
\t\tAchievementsForever.ToggleAchievementFrame(true)
\t</Binding>
</Bindings>
`);

write(path.join(runtimeOut, 'AchievementsForever_Forever.toc'), `## Interface: 16001
## Title: Achievements Forever
## Notes: Retail-style achievements for World of Warcraft: Forever. Fork of Achievements by Deathwing (GPL-3.0).
## IconTexture: Interface\\AddOns\\AchievementsForever\\Media\\logo.png
## Author: Achievements Forever contributors
## Version: ${VERSION}
## X-License: GNU GPL3
## X-Upstream: https://github.com/Deathwing/Achievements
## X-Category: Achievements
## Category-enUS: Collections
## Dependencies: AchievementsForeverData
## SavedVariables: AchievementsForeverDB
## SavedVariablesPerCharacter: AchievementsForeverCharacterDB

Achievements.lua
AchievementsCriteriaResolvers.lua
AchievementsCriteria.lua
AchievementsMicroButton.lua
AchievementsChatLinks.lua
AchievementsGuildBroadcast.lua
AchievementsTitles.lua
AchievementsUpdate.lua
AchievementsNetwork.lua
AchievementsCompare.lua
AchievementsFetcher.lua
AchievementsWatchFrame.lua
AchievementsBootstrap.lua
AchievementsAPI.lua

Vanilla\\Blizzard_AchievementUI\\Blizzard_AchievementUI.lua
Vanilla\\Blizzard_AchievementUI\\Blizzard_AchievementUI_Shared.lua
Vanilla\\Blizzard_AchievementUI\\Blizzard_AchievementUI.xml
Vanilla\\Blizzard_AchievementUI\\Localization.lua
Vanilla\\Blizzard_AchievementUI\\AchievementsForeverSearch.lua
`);

write(path.join(dataOut, 'AchievementsForeverData_Forever.toc'), `## Interface: 16001
## Title: Achievements Forever Data
## Notes: Generated achievement data for Achievements Forever. Source: 3.4.5.63697 CSV via the upstream Achievements project (GPL-3.0).
## IconTexture: Interface\\AddOns\\AchievementsForeverData\\Media\\logo.png
## Author: Achievements Forever contributors
## Version: ${VERSION}
## X-License: GNU GPL3
## X-Upstream: https://github.com/Deathwing/Achievements
## X-Category: Library
## Category-enUS: Libraries

AchievementsForeverData_Classic.lua
AchievementsForeverData_ForeverMaps.lua
AchievementsIconAssets.lua
`);

console.log('import complete');
console.log('  runtime:', runtimeOut);
console.log('  data:   ', dataOut);
