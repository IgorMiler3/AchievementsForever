# Achievements Forever

Retail-style achievements for World of Warcraft: Forever. The addon brings the Classic-era achievements from retail's database into Forever: the achievement window, categories, points, criteria, completion dates, toasts, tracking, chat links and statistics, for the content that exists in a vanilla world. Progress is stored per character.

It is a fork of [Achievements](https://github.com/Deathwing/Achievements) by Deathwing, released under the GNU GPL v3, reworked for the Forever client. Forever runs the modern game's UI and addon system (Interface 16001, the 12.1.5 API with the Midnight addon restrictions), so the Classic Era original does not load there. This repository is that port plus the achievements Forever's own content needs.

This is an unofficial fan project and is not affiliated with Blizzard Entertainment.

## Status

Early test build, playable. Tested in game on the Forever beta (build 1.60.1.70374) on 15 October 2026.

Working: the achievement window (categories, achievement list, summary, statistics tab, filter, search), levels, quests, exploration (including zones explored before the addon was installed), emotes, Blizzard's own Legacy window alongside ours.

Not done yet, in rough order:

- Kill, loot and dungeon criteria have had no real test. Reports welcome.
- Four exploration sub-zones have no map piece in Forever (Undercity, Dragonmaw Gates, Blackmaw Hold, Cenarion Hold), so Tirisfal Glades, Wetlands, Ashenvale and Silithus cannot complete yet.
- Statistics come from the addon's own counters. Forever's server-side statistics (kills, gold, deaths) are not wired in yet.
- Forever-only content: one achievement each for Hyjal Summit and Barrow Deeps, one per new dungeon.
- Account-wide pieces of the upstream design are still present but unused.

## Installing

1. Download the repository (Code, Download ZIP) or clone it.
2. Copy the two folders `AchievementsForever` and `AchievementsForeverData` into the game's `Interface\AddOns` directory. During the beta that is `World of Warcraft\_classic_beta_\Interface\AddOns`. Both folders are required.
3. Enable both on the character screen, log in, type `/af`.

After updating the files, type `/reload` in game.

## Using it

- `/af` opens the achievement window, `/af stats` the statistics tab. A key binding is available under Options, Key Bindings, AddOns.
- The search box at the bottom of the category column finds achievements by name. Click a result, or press Enter for the first one, to jump to it.
- Shift-click an achievement with the chat box open to link it. Links from other players who run the addon open the window at that achievement.
- `/af-title` lists and sets earned titles, `/af-compare <name>` compares with another player running the addon.
- Achievements earned by guild members running the addon are announced in guild chat colour.

## Reporting problems

Install [BugSack](https://www.curseforge.com/wow/addons/bugsack) and [BugGrabber](https://www.curseforge.com/wow/addons/bug-grabber), reproduce the problem, and paste the full error including the stack. Say what you did right before. `/af emote` and `/af explore` print diagnostics for the two detectors that needed special handling on Forever; paste their output when an emote or exploration achievement does not move. See [docs/TESTING.md](docs/TESTING.md).

## What is in the repository

| Folder | What it is |
| --- | --- |
| `AchievementsForever/` | The runtime addon: UI, criteria engine, saved progress, chat links, networking, comparison, titles. Imported from upstream and ported to Forever. |
| `AchievementsForeverData/` | The data addon: 386 achievements and 177 statistics from the Wrath Classic 3.4.5 database, filtered for vanilla content, icon assets, and Forever's own map data for exploration. Required by the runtime. |
| `tools/` | The scripts that produce and maintain the port: `import-upstream.js` (import with renames), `port-forever.js` (Forever API routing and fixes), `prefix-ui-globals.js` (UI global prefixing), `gen-forever-maps.js` (Forever map data from wago.tools), `check-lua.js` (syntax check). `tools/probe/` holds the developer probe addon; it is not needed to play. |
| `docs/` | [PLAN.md](docs/PLAN.md), [PORT-NOTES.md](docs/PORT-NOTES.md) (what the Forever client changes and how each change was handled), [PROBE-RESULTS.md](docs/PROBE-RESULTS.md), [TESTING.md](docs/TESTING.md), [UI-GLOBALS.md](docs/UI-GLOBALS.md). |

## Decisions

- Achievements are stored per character, not account-wide.
- Naxxramas has no retail achievement and gets none in the first release.
- Forever's own raids, Hyjal Summit and Barrow Deeps, get one achievement each in the style of Onyxia's Lair (Level 60). Forever's own dungeons each get a dungeon achievement in the style of Classic Dungeonmaster's criteria. These live in their own sub-category and are flagged as Forever additions.
- Achievements that depend on content a vanilla world lacks are listed with a reason inside the addon, not silently dropped.

## Rebuilding from upstream

```
node tools/import-upstream.js <upstream-checkout> <release-unzipped-dir>
node tools/port-forever.js
node tools/prefix-ui-globals.js
node tools/gen-forever-maps.js --build 1.60.1.70374
node tools/check-lua.js
```

Node 18 or newer is required; `check-lua.js` needs `npm install --no-save luaparse` once.

To hand the addon to someone, build the zip and send that file. It contains only the two addon folders, ready to extract into `Interface\AddOns`:

```
powershell -ExecutionPolicy Bypass -File tools\package.ps1
```

## Licence

GNU General Public License v3.0. See [LICENSE](LICENSE) and [ATTRIBUTION.md](ATTRIBUTION.md). Achievement names, descriptions and icons are Blizzard Entertainment's.
