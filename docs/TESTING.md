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

## Phase 1 and later: the addon

Install all three folders. `AchievementsForeverData` must be enabled, the runtime refuses to load without it.

Report Lua errors with the full text and stack. Enable "Display Lua Errors" in Interface options, or install an error-catching addon that has a Forever build. The modern client also has `/eventtrace` for watching events live and `/dump <expression>` for inspecting values.

Useful commands once the runtime loads: `/ach` opens the window, `/ach-debug` toggles verbose output, `/ach-clear` wipes the character's progress. These are inherited from upstream and will be renamed to `/af` during the port.

## What a good report looks like

- Build number from the probe's first line.
- What you did, in order.
- The exact error text, or "no errors".
- The saved variables file, attached or pasted.
