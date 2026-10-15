# Testing

Every build is tested in the game by a person, because this project has no game client in its development environment. The loop is short: edit, copy, `/reload`, report.

## Phase 0: the probe

Install only `AchievementsForeverProbe/`. Do not install the other two folders yet.

1. Copy `AchievementsForeverProbe` into `Interface\AddOns` (beta: `World of Warcraft\_classic_beta_\Interface\AddOns`).
2. Log in. The probe prints one line with the client build when it loads. If it prints nothing, check it is enabled on the character screen.
3. Type `/afprobe`. It prints a five-line summary. Nothing in it should say "error".
4. Type `/afprobe api` and `/afprobe stats`. They print what exists. Screenshots are fine, the saved file is better.
5. Type `/afprobe link`, hover the yellow link it posts, click it. Note whether a tooltip appeared and whether anything happened on click.
6. Run one dungeon, any dungeon, to the last boss. Deadmines is ideal. The probe prints a line for every encounter event it sees.
7. Kill a few mobs in the open world and die once if convenient, so the combat log and death events get a chance to fire.
8. Log out, or `/reload`. The game writes the saved file only then.
9. Send `WTF\Account\<your account>\SavedVariables\AchievementsForeverProbe.lua`.

The saved file contains: the client build and project id, which of about 120 API functions exist, which achievement frame textures exist, Blizzard's achievement categories and statistics rows with their values, every tracked event with its arguments, which events the client refused to register, and whether the combat log fired. That file decides the port.

## Phase 1: the addon

Install `AchievementsForever` and `AchievementsForeverData` side by side in `Interface\AddOns`. Both must be enabled; the runtime refuses to load without the data package. The probe can stay installed, it does not interfere.

First login checklist:

1. Watch the chat for red Lua errors during loading. Copy every one in full, including the stack. Enable "Display Lua Errors" under Options, Advanced, if nothing shows but the game says there are errors.
2. Type `/af`. The achievements window should open. Screenshot it, including the category list on the left and the summary on the right.
3. Type `/af stats` for the statistics window.
4. On a character with history the first login runs a backfill: level, quests, exploration, reputations, skills, gold. Expect the first toasts within a minute. Note which achievements completed and whether any that should not have did.
5. Shift-click an achievement with the chat box open to insert a link, hover it, click it.
6. Kill a few mobs. The kill path runs on `UNIT_DIED`, so creature-kill criteria should move.
7. Turn in a quest, discover a sub-zone, gain a level if one is close.
8. `/reload`, then check the window again. Completions must survive the reload.
9. Send `WTF\Account\<account>\SavedVariables\AchievementsForeverCharacterDB.lua` from the character's folder under `WTF\Account\<account>\<realm>\<character>\SavedVariables\` and the account-wide `AchievementsForeverDB.lua`.

Commands: `/af` opens the window, `/af stats` the statistics, `/af native` lists which achievement API functions Blizzard provides natively, `/af emote` shows whether the emote hook or the chat fallback fired (`/af emote test` records a `/love` against the current target directly), `/af explore` prints what the client reports as explored for the current map and whether the data has matching rows, `/af-debug` toggles verbose output, `/af-clear` wipes the character's progress, `/af-compare <name>`, `/af-title`, `/af-fetch`. The modern client also has `/eventtrace` for watching events live and `/dump <expression>` for inspecting values.

Known at this stage: the micro-button integration is disabled on purpose, the window opens from `/af` or the key binding only. Statistics come from the addon's own counters for now; wiring Blizzard's native statistics in is the next step.

## What a good report looks like

- Build number from the probe's first line.
- What you did, in order.
- The exact error text, or "no errors".
- The saved variables file, attached or pasted.
