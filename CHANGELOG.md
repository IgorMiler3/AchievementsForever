# Changelog

## 0.2.0, 15 October 2026

First build tested in game on the Forever beta (1.60.1.70374).

- Window: category list, achievement list, summary, statistics tab, filter and tabs work on the Forever client. Fixed the native category list leaking into the window, the tab texture keys the modern tab code expects, and the 200-local limit in the criteria resolvers.
- Search box at the bottom of the category column with a results list; Enter jumps to the first result.
- Header reads "Achievement Points" (progress is per character).
- Every global the bundled window defines carries the `AF_` prefix, so Blizzard's Legacy window can load without breaking ours. The warning about it loading is gone.
- Emotes: the player's own text emotes are read from chat because Forever's chat code does not reach the global emote hook.
- Exploration: Forever re-cut all zone maps; the addon now ships Forever's overlay and map rows (generated from wago.tools) and bridges the Wrath criteria to them by area. Already-explored zones count on first login.
- Kills come from the new `UNIT_DIED` event; the protected combat-log registration is gone.
- Diagnostics: `/af emote`, `/af emote test`, `/af explore`, `/af explore all`, `/af explore rescan`, `/af native`.
- The developer probe moved to `tools/probe/`.

## 0.1.0, 15 October 2026

- Imported Achievements v1.1.0 by Deathwing (GPL-3.0) as the base, Classic Era variant only.
- Renamed saved variables, data table, namespace, addon-message prefix, media paths and key bindings so the addon cannot collide with upstream or the Forever client.
- Guarded every global achievement API definition so the Forever client's native functions are never overwritten.
- Wrote Forever TOC files (Interface 16001).
- Added the phase 0 probe addon.
- Ported the runtime and the bundled window: achievement API calls routed through the addon namespace, removed Classic globals shimmed in AchievementsForeverCompat.lua, micro-button integration disabled, slash commands moved to /af.
