# Achievements Forever

Retail-style achievements for World of Warcraft: Forever. The addon brings the Classic-era achievements from retail's database into Forever: the achievement window, categories, points, criteria, completion dates, toasts, tracking, chat links and statistics, for the content that exists in a vanilla world.

It is a fork of [Achievements](https://github.com/Deathwing/Achievements) by Deathwing, released under the GNU GPL v3, reworked for the Forever client. Forever runs the modern game's UI and addon system (Interface 16001, the 12.1.5 API with the Midnight addon restrictions), so the Classic Era original does not load there. This repository is that port plus the achievements Forever's own content needs.

## Status

Phase 1, first playable build. The runtime and the bundled window are ported to the Forever client and untested in game as of 15 October 2026. See [docs/TESTING.md](docs/TESTING.md) for what to install and what to report, and [docs/PROBE-RESULTS.md](docs/PROBE-RESULTS.md) for what the client exposes.

## What is in the repository

| Folder | What it is |
| --- | --- |
| `AchievementsForever/` | The runtime addon: UI integration, criteria engine, saved progress, chat links, networking, comparison, titles. Imported from upstream and renamed for Forever. |
| `AchievementsForeverData/` | The generated data addon: 386 achievements and 177 statistics from the Wrath Classic 3.4.5 database, filtered for vanilla content, plus icon assets. Imported from upstream's release package. Required by the runtime. |
| `AchievementsForeverProbe/` | Phase 0 probe. A tiny standalone addon that records what the Forever client exposes. Install it alone for the first test. |
| `tools/import-upstream.js` | Reproducible import of the upstream addon with the Forever renames applied. Run it when upstream publishes a release. |
| `docs/` | The plan, the port notes and the testing instructions. |

## Decisions

- Achievements are stored per character, not account-wide.
- Naxxramas has no retail achievement and gets none in the first release.
- Forever's own raids, Hyjal Summit and Barrow Deeps, get one achievement each in the style of Onyxia's Lair (Level 60). Forever's own dungeons each get a dungeon achievement in the style of Classic Dungeonmaster's criteria. These live in their own sub-category and are flagged as Forever additions.
- Achievements that depend on content a vanilla world lacks are listed with a reason inside the addon, not silently dropped.

## Installing for testing

Copy the addon folders into the game's `Interface\AddOns` directory. During the beta that is `World of Warcraft\_classic_beta_\Interface\AddOns`. Enable them on the character screen. After any change to the files, type `/reload` in game. Nothing needs to be published anywhere to test.

## Licence

GNU General Public License v3.0. See [LICENSE](LICENSE) and [ATTRIBUTION.md](ATTRIBUTION.md). Achievement names, descriptions and icons are Blizzard Entertainment's; this is an unofficial fan project and not affiliated with Blizzard.
