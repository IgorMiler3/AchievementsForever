# Attribution

Achievements Forever is a derivative work.

## Achievements by Deathwing

The runtime addon in `AchievementsForever/` and the data package in `AchievementsForeverData/` are derived from [Achievements](https://github.com/Deathwing/Achievements) (CurseForge project 1644657, Wago EGPenjN1, WoWInterface 27169), copyright Deathwing, released under the GNU General Public License v3.0. The import was made from release v1.1.0 (data version 1785024000, generated from 3.4.5.63697 CSV data). The exact transformations applied to the upstream files are in `tools/import-upstream.js`, so every difference from upstream is reproducible.

The generated data in `AchievementsForeverData/` was produced by upstream's private tooling. This repository has no generator yet; see `docs/PORT-NOTES.md`.

## Blizzard Entertainment

Achievement names, descriptions, criteria text and icons originate from World of Warcraft and are the property of Blizzard Entertainment. The bundled `Vanilla/Blizzard_AchievementUI` files are upstream's adaptation of Blizzard's Wrath-era achievement interface code. This project is not affiliated with or endorsed by Blizzard Entertainment.

## Data sources

- wago.tools, for the DB2 exports the upstream data was generated from, and for the Forever client's own `WorldMapOverlay`, `UiMapXMapArt`, `UiMap` and `AreaTable` exports that `AchievementsForeverData_ForeverMaps.lua` is generated from (`tools/gen-forever-maps.js`).
- WoWDBDefs, for the table layouts.
- TrinityCore's DBCEnums.h, for the criteria type and flag enumerations.
