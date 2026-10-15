#!/usr/bin/env node
// Prefixes every global the bundled Wrath-era achievement UI defines with
// "AF_", so the window survives Blizzard's own load-on-demand
// Blizzard_AchievementUI (the Legacy window, opened with the achievements key).
//
//   node tools/prefix-ui-globals.js [--dry-run]
//
// Why: upstream renamed the frames to AchievementsFrame* but kept Blizzard's
// function, constant and template names (AchievementFrame_SelectAchievement,
// AchievementButton_OnClick, ACHIEVEMENTUI_CATEGORIES, AchievementTemplate,
// ...). When Blizzard's addon loads it overwrites those globals with code that
// drives Blizzard's frames, and our window breaks from then on. Prefixed names
// cannot collide.
//
// What it does:
//   1. Collects the names defined at top level by the three bundled UI Lua
//      files (global functions and assignments) and by the bundled XML
//      (virtual templates and top-level named frames).
//   2. Keeps every name that does not already start with AchievementsFrame or
//      AchievementsForever.
//   3. Rewrites every whole-word reference to those names in all Lua and XML
//      files of the runtime addon, including references inside strings (needed
//      for _G["..."] lookups), and prints the in-string hits for review.
// Idempotent: names that already carry the prefix are not matched again.

const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry-run');
const PREFIX = 'AF_';
const repoRoot = path.resolve(__dirname, '..');
const runtime = path.join(repoRoot, 'AchievementsForever');
const uiDir = path.join(runtime, 'Vanilla', 'Blizzard_AchievementUI');
const UI_LUA = ['Blizzard_AchievementUI.lua', 'Blizzard_AchievementUI_Shared.lua', 'Localization.lua'].map(f => path.join(uiDir, f));
const UI_XML = path.join(uiDir, 'Blizzard_AchievementUI.xml');

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out); else if (/\.(lua|xml)$/i.test(entry.name)) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 1. defined names
const defined = new Map();
for (const file of UI_LUA) {
  const text = read(file);
  for (const m of text.matchAll(/^function\s+([A-Za-z_]\w*)\s*\(/gm)) defined.set(m[1], 'function');
  for (const m of text.matchAll(/^([A-Za-z_]\w*)\s*=[^=]/gm)) if (!defined.has(m[1])) defined.set(m[1], 'variable');
}
{
  const xml = read(UI_XML);
  for (const m of xml.matchAll(/name="([A-Za-z_]\w*)"[^>]*virtual="true"/g)) defined.set(m[1], 'template');
  for (const m of xml.matchAll(/<(?:Frame|Button|ScrollFrame|CheckButton|EditBox|DropdownButton|StatusBar|Slider|Texture|FontString)\s+name="([A-Za-z_]\w*)"(?![^>]*virtual)/g)) {
    if (!defined.has(m[1])) defined.set(m[1], 'frame');
  }
}

// Globals assigned inside functions (not at top level) that Blizzard's UI also defines.
for (const extra of ['ACHIEVEMENTUI_FONTHEIGHT', 'AchievementButton_Localize']) defined.set(extra, 'variable (inside a function)');

const names = [...defined.keys()]
  .filter(n => !/^AchievementsFrame/.test(n) && !/^AchievementsForever/.test(n) && !n.startsWith(PREFIX))
  .sort((a, b) => b.length - a.length); // longest first so prefixes of other names never match early

console.log(`defined globals: ${defined.size}, to prefix: ${names.length}`);

// ---------------------------------------------------------------- 2. rewrite
const files = walk(runtime);
let total = 0;
const inStrings = [];
for (const file of files) {
  const before = read(file);
  let text = before;
  for (const name of names) {
    const re = new RegExp(`(?<![\\w.:])${name}(?!\\w)`, 'g');
    text = text.replace(re, (m, offset) => {
      total++;
      // report hits inside Lua string literals for review
      const lineStart = text.lastIndexOf('\n', offset) + 1;
      const linePrefix = text.slice(lineStart, offset);
      const quotes = (linePrefix.match(/"/g) || []).length;
      if (file.endsWith('.lua') && quotes % 2 === 1) inStrings.push(`${path.relative(repoRoot, file)}: ${text.slice(lineStart, text.indexOf('\n', offset)).trim()}`);
      return PREFIX + name;
    });
  }
  if (text !== before) {
    console.log(`${path.relative(repoRoot, file)}: ${(before.match(/\n/g) || []).length} lines, changed`);
    if (!DRY) write(file, text);
  }
}
console.log(`replacements: ${total}${DRY ? ' (dry run, nothing written)' : ''}`);
if (inStrings.length) {
  console.log('\nreferences inside string literals (check each still points at our code):');
  for (const line of inStrings) console.log('  ' + line);
}

// ---------------------------------------------------------------- 3. the prefixed list, for the docs
if (!DRY) {
  const listPath = path.join(repoRoot, 'docs', 'UI-GLOBALS.md');
  const lines = ['# Prefixed UI globals', '', 'Generated by `tools/prefix-ui-globals.js`. Every global the bundled achievement window defines carries the `AF_` prefix so it cannot collide with Blizzard\'s load-on-demand `Blizzard_AchievementUI`.', '', '| Original | Kind |', '| --- | --- |'];
  for (const name of [...names].sort()) lines.push(`| \`${name}\` -> \`${PREFIX}${name}\` | ${defined.get(name)} |`);
  write(listPath, lines.join('\n') + '\n');
  console.log('wrote docs/UI-GLOBALS.md');
}
