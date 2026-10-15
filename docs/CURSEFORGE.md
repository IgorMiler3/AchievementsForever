# CurseForge submission

Everything needed to create the CurseForge project. The description text is written for players browsing CurseForge; the checklist is for whoever fills in the form.

## Checklist

1. Log in at https://authors.curseforge.com, choose World of Warcraft, Create a project, Addons.
2. Fill in the fields below. Upload `AchievementsForever/Media/logo.png` as the project avatar.
3. Build the file with `powershell -ExecutionPolicy Bypass -File tools\package.ps1` and upload `dist\AchievementsForever-<version>.zip`. Release type: Beta until kill and dungeon criteria have been confirmed in game. Paste the matching section of `CHANGELOG.md` as the file changelog.
4. Game version: pick the WoW Forever entry (Interface 16001, build 1.60.x). If CurseForge has not added a Forever entry yet, choose the closest Classic entry and say so in the description.
5. Once CurseForge assigns a project ID, add `## X-Curse-Project-ID: <id>` to both TOC files so the CurseForge app recognises the folders.
6. After approval, add the CurseForge link to `README.md`.

## Form fields

| Field | Value |
| --- | --- |
| Project name | Achievements Forever |
| Slug | achievements-forever |
| Summary (short) | Retail-style achievements for WoW Forever: the full Classic-era achievement window, points, criteria, toasts and chat links, tracked per character. Fork of Deathwing's Achievements, ported to the Forever client. |
| Primary category | Achievements |
| Secondary categories | Guild, Quests & Leveling |
| Licence | GNU General Public License version 3.0 (GPLv3) |
| Source | https://github.com/IgorMiler3/AchievementsForever |
| Issues | https://github.com/IgorMiler3/AchievementsForever (issues are closed; use the Discord or the author) |
| Dependencies | None. The data package ships inside the download. |
| Embedded libraries | None |

## Description

Written for players browsing CurseForge. Paste it into the description editor; the headings and bullets paste cleanly.

---

Achievements Forever brings the Classic-era achievements from retail World of Warcraft into WoW Forever. You get the achievement window you know, with categories, points, criteria progress, completion dates, toasts, tracking, chat links and a statistics tab, covering the content that exists in a vanilla world: levels, quests, exploration, dungeons and raids, reputations, professions, PvP, world events and feats of strength.

Everything is tracked per character. Your rogue's achievements are your rogue's.

**Staying true to the original.** The achievements, their criteria, points and icons come from Blizzard's own database, not from a hand-written list. If an achievement exists for Classic content on retail, it is here with the same name, the same criteria and the same points. Nothing is invented. The only additions planned are achievements for Forever's own raids and dungeons, which have no retail counterpart; those live in their own sub-category and are clearly marked as Forever additions.

**No dependencies.** The addon and its data package come in one download. No libraries, no other addons, nothing to configure.

## Features

- The full Classic-era achievement window: summary page with recent achievements and progress per category, category tree, achievement list with expandable criteria, filter for complete or incomplete, and a statistics tab.
- Search box that finds achievements by name and jumps to them.
- Per-character progress, saved between sessions.
- Retroactive credit on first login for what the character has already done: level, completed quests, explored zones, reputations, skills and gold.
- Toasts and a chat line when an achievement completes, with the familiar sound.
- Chat links: shift-click an achievement to link it. Other players with the addon can click the link and see it in their window.
- Guild announcements: achievements earned by guild members running the addon show in guild chat colour.
- Achievement tracking, titles earned from achievements, and comparison with another player who runs the addon.
- Key binding to open the window, plus `/af` and `/af stats`.
- Works alongside Blizzard's own Legacy window; both can be open in the same session.

## Current state

This is an early test build. What has been confirmed in game: the window, levels, quests, exploration, emotes. Kill, loot, dungeon and raid criteria are implemented but have had no real test yet, so reports from dungeon runs are the most useful thing you can send. Known gaps are listed on the project's GitHub page.

## Credits

Fork of Achievements by Deathwing (GPL-3.0), ported to the Forever client. Achievement names, descriptions and icons are the property of Blizzard Entertainment. This is an unofficial fan project and is not affiliated with Blizzard.

---

## Changelog text for the first file

```
0.2.0 - first test build

Tested in game on the Forever beta (1.60.1.70374).
- Achievement window with categories, list, summary, statistics tab, filter and search.
- Per-character progress with retroactive credit on first login.
- Exploration works on Forever's re-cut maps, including zones explored before installing.
- Emotes, levels and quests confirmed; kills, loot and dungeons implemented but untested.
- Coexists with Blizzard's Legacy window.
```
