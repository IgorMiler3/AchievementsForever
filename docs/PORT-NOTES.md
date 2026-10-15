# Port notes

What has to change to make the upstream Classic Era addon run on the Forever client. Written before the phase 0 probe results; the probe confirms or corrects each line.

## The platform

- Forever is the modern client's UI family. Interface 16001, the 12.1.5 API, Midnight addon restrictions with secret values, TOC suffix `_Forever.toc`, `WOW_PROJECT_CAMELOT` = 18.
- The achievement API exists natively and is populated with Blizzard's own records (65 Legacy Challenges, 43 hidden zone exploration achievements, about 110 statistics, using retail achievement IDs). `GetAchievementInfo`, `GetCategoryList`, `GetStatistic`, `ACHIEVEMENT_EARNED` and `CRITERIA_UPDATE` all work.
- `Blizzard_AchievementUI` is loaded for the mainline family. Its templates and the `Interface\AchievementFrame` art are available. Blizzard redirects the achievement button to the Legacy window.
- `COMBAT_LOG_EVENT_UNFILTERED` and `CombatLogGetCurrentEventInfo` are reported missing for addons. The probe settles it.
- Old Classic globals are gone: `GetSpellInfo`, `GetItemInfo`, `UnitAura`, `GetNumSkillLines`, `GetSkillLineInfo` (moved to `C_SkillInfo`), `GetQuestsCompleted`. Registering an unknown event raises an error instead of being ignored.

## Done by the import script

- Saved variables renamed to `AchievementsForeverDB` and `AchievementsForeverCharacterDB`.
- Data table renamed to `AchievementsForeverData`, data file renamed, TBC data dropped.
- Namespace global renamed to `AchievementsForever`. Inside each file the local alias is still `Achievements`.
- Addon message prefix `ACHV` renamed to `ACHVFOREVER`.
- Media paths and key binding names renamed. Bindings call `AchievementsForever.ToggleAchievementFrame`.
- Every global API definition in `AchievementsAPI.lua` is guarded: if the client already provides the function, it is left alone and its name is recorded in `AchievementsForeverNativeAPI`.

## Consequence of the guard, and the first real port task

Upstream's bundled achievement window calls the global API functions (`GetAchievementInfo`, `GetCategoryList`, `GetStatistic`, and about 36 others). On Classic Era those globals were upstream's own. On Forever they are Blizzard's, so the bundled window would now display Blizzard's Legacy records, not ours. The fix is to route the bundled UI and every runtime caller through the namespace: `GetAchievementInfo(` becomes `AchievementsForever.GetAchievementInfo(` and so on, with the upstream API file kept only for the few globals Blizzard does not define. This is a mechanical rewrite over `Vanilla/Blizzard_AchievementUI/*` and the runtime files and is the first task after the probe.

## Client API calls in the runtime that need checking

Counted from the runtime Lua files, excluding the bundled UI.

| Call | Uses | Forever status | Action |
| --- | --- | --- | --- |
| `CombatLogGetCurrentEventInfo` | 2 | Reported missing | Kill detection falls back to quests, loot, encounter events and native statistics |
| `GetSpellInfo` | 1 | Removed | `C_Spell.GetSpellInfo` returns a table |
| `GetItemInfo` | 4 | Removed | `C_Item.GetItemInfo` |
| `UnitAura` | 3 | Removed | `C_UnitAuras.GetAuraDataByIndex` or `C_UnitAuras.GetPlayerAuraBySpellID` |
| `GetSkillLineInfo`, `GetNumSkillLines` | 2 | Moved | `C_SkillInfo.GetSkillLineInfo`, `C_SkillInfo.GetNumSkillLines` |
| `GetFactionInfo`, `GetFactionInfoByID`, `GetNumFactions` | 7 | Probably removed | `C_Reputation.GetFactionDataByIndex`, `GetFactionDataByID`, `GetNumFactions` |
| `GetQuestsCompleted` | 1 | Removed | `C_QuestLog.GetAllCompletedQuestIDs` |
| `GetNumPartyMembers`, `GetNumRaidMembers` | 2 | Removed long ago | `GetNumGroupMembers`, `IsInRaid` (already used alongside) |
| `GetNumWorldStateUI`, `GetWorldStateUIInfo` | 3 | Removed in 8.x | `C_UIWidgetManager` or battleground score API |
| `UIDropDownMenu_*` | 5 | Present as deprecated compat in 12.x, verify | Keep if present, else `MenuUtil` |
| `EasyMenu` | 1 | Removed in 11.x | `MenuUtil.CreateContextMenu` |
| `GetBarberShopTotalCost` | 1 | Removed in 9.x | Barber criteria via `BARBER_SHOP_SUCCESS` only, or drop |
| `GetTalentResetCost` | 1 | Classic only, verify | Statistics only, drop if missing |
| `UnitPVPRank`, `GetPVPLifetimeStats` | 3 | Listed for Forever | Keep |
| `GetInboxHeaderInfo`, `GetSendMailPrice` | 2 | Present | Keep |
| `ItemTextGetItem`, `GetLootSourceInfo` | 2 | Present | Keep |
| `C_MapExplorationInfo.GetExploredMapTextures` | 1 | Present | Keep |
| `C_QuestLog.IsQuestFlaggedCompleted` | 1 | Present | Keep |
| `C_Container.*` | 3 | Present | Keep |
| `C_ChatInfo.SendAddonMessage` | 3 | Present, trial accounts cannot send | Keep |
| `ChatFrame_AddMessageEventFilter` | 7 | Present | Keep |
| `hooksecurefunc`, `C_Timer.After` | 16 | Present | Keep |
| `HybridScrollFrame_*` | 4 | Present | Keep |
| `UnitHealthMax` and other unit values | 1 | May return secret values in restricted contexts | Guard with `issecretvalue` where available |

The bundled UI (`Vanilla/Blizzard_AchievementUI`) is Wrath-era interface code. It uses `FauxScrollFrame`, `UIDropDownMenu`, `HybridScrollFrame`, the `AchievementFrame` textures and `PlaySound` with legacy sound names. The probe checks the textures and the dropdown helpers. Anything it finds missing is replaced in the same mechanical pass as the namespace routing.

## Things the probe answers

1. Combat log availability.
2. Whether `GetStatistic` returns values for Blizzard's statistic rows, which would make server-side counters readable.
3. Encounter events in 5-man dungeons.
4. Native rendering of `achievement:` links.
5. Presence of about 120 API functions and 10 textures.

## Open design items after the port

- Per-character storage: upstream keeps completions per character and reserves the account-wide store for account-flagged achievements and remote snapshots. For this project everything moves to the per-character store.
- Forever-only achievements: Hyjal Summit, Barrow Deeps, and one per new dungeon. They need encounter IDs, which only the live game reveals, so they are written after the first runs.
- Data generator: upstream's is private. A Node script reading wago.tools CSV exports for build 3.4.5.63697 must reproduce the data file format before any data change is possible. The format is a single Lua table with these keys: `categoryOrder`, `statisticsCategoryOrder`, `categories`, `titles`, `achievements`, `achievementsByCategory`, `achievementsByInstance`, `areas`, `uiMaps`, `worldMapOverlays`, `spellNames`, `skillLines`, `skillLineAbilities`, `factions`, `items`, `emotes`, `questSorts`, `quests`, `questAreaQuests`, `questSortQuests`, `criteria`, `criteriaTrees`, `criteriaTreeChildren`, `modifierTrees`, `modifierTreeChildren`, `criteriaByAchievement`, `achievementByCriteria`, `supercededBy`, plus `localizations`.
