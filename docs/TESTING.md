# Testing

Every build is tested in the game by a person, because this project has no game client in its development environment. The loop is short: edit, copy, `/reload`, report.

## Installing a test build

Install `AchievementsForever` and `AchievementsForeverData` side by side in `Interface\AddOns` (beta: `World of Warcraft\_classic_beta_\Interface\AddOns`). Both must be enabled; the runtime refuses to load without the data package. After copying new files, `/reload`.

Install [BugSack](https://www.curseforge.com/wow/addons/bugsack) and [BugGrabber](https://www.curseforge.com/wow/addons/bug-grabber). The Forever client hides Lua errors by default, and BugSack keeps the full stack.

## Checklist for a new build

1. Log in and watch for errors in BugSack. Copy every one in full, including the stack and the locals block.
2. `/af`. The window opens on the summary. The left column lists Summary, General, Quests, Exploration and the rest. Click a category, expand an achievement, switch to the Statistics tab and back.
3. Type two letters into the search box top-right, click a result.
4. On a character with history the first login runs a backfill: level, quests, exploration, reputations, skills, gold. Note which achievements completed and whether any that should not have did.
5. Target a critter and `/love` it. "To All The Squirrels I've Loved Before" should tick the critter.
6. Kill a few mobs, loot, turn in a quest. Note which criteria move.
7. Press the achievements key (Y by default) to open Blizzard's Legacy window, close it, then `/af` again. Both must still work.
8. `/reload`, then check the window again. Completions must survive the reload.
9. If something is wrong, send `WTF\Account\<account>\<realm>\<character>\SavedVariables\AchievementsForeverCharacterDB.lua`.

## Commands

- `/af` opens the window, `/af stats` the statistics tab.
- `/af emote` shows whether the emote hook or the chat fallback fired. `/af emote test` records a `/love` against the current target directly.
- `/af explore` prints what the client reports as explored for the current map and whether the data has matching rows. `/af explore all` does it for every map. `/af explore rescan` drops the exploration cache and re-evaluates.
- `/af native` lists which achievement API functions Blizzard provides natively.
- `/af-debug` toggles verbose logging (`/af-debug copy` to copy the log), `/af-clear` wipes the character's progress, `/af-compare <name>`, `/af-title`, `/af-fetch`.
- The client's own `/eventtrace` and `/dump <expression>` help when watching events.

Known at this stage: the micro-button integration is disabled on purpose, the window opens from `/af` or the key binding only. Statistics come from the addon's own counters; wiring Blizzard's native statistics in is a later step. Four exploration sub-zones cannot complete (see README).

## What a good report looks like

- Build number (`/dump GetBuildInfo()`).
- What you did, in order.
- The exact error text, or "no errors".
- The saved variables file, attached or pasted.

## The developer probe

`tools/probe/AchievementsForeverProbe/` is a standalone addon that records what the Forever client exposes: API presence, textures, native achievement and statistic rows, which events fire and which the client refuses. It was used before the port and is kept for the next client build. Copy the folder into `Interface\AddOns`, log in, `/afprobe`, play for a while, log out, and read `WTF\Account\<account>\SavedVariables\AchievementsForeverProbe.lua`. Results so far are in [PROBE-RESULTS.md](PROBE-RESULTS.md).
