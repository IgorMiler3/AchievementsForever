# Probe results

Recorded from chat screenshots on 15 October 2026, probe 0.1.0, character level 16, Redridge. Saved-variables file still to come.

## Client

- Build 1.60.1.70374, TOC 16001, dated 12 October 2026. `WOW_PROJECT_ID` = 18 = `WOW_PROJECT_CAMELOT`.

## 1. Combat log

- `COMBAT_LOG_EVENT_UNFILTERED` registers without error.
- `CombatLogGetCurrentEventInfo` does not exist. Probe 0.1.1 records whether the event carries its payload as arguments instead. Until then, treat the combat log as unavailable for kill detection.

## 2. Native statistics: live

`GetStatistic` returns real values. 26 statistic categories, 196 rows. Seen with values on this character:

| Statistic | ID | Value |
| --- | --- | --- |
| Creatures killed | 107 | 581 |
| Different creature types killed | 1337 | 3 |
| Creature type killed the most | 1336 | 46 (Humanoid) |
| Critters killed | 108 | 13 |
| Total gold acquired | 328 | 3g 22s 33c |
| Average gold earned per day | 753 | 23s 2c |
| Gold looted | 333 | 32s 19c |
| Gold from quest rewards | 326 | 1g 62s 2c |
| Times camped | 64222 | 1 |
| Talent tree respecs | 1149 | 0 |
| Deaths in Alterac Valley, Arathi Basin, Warsong Gulch, from Drek'Thar, in Darkspear Islands | 57, 59, 56, 58, 64182 | -- (none yet) |

Consequence: kill counts, gold, deaths and battleground counters are readable from the server. The retail statistics category can be shown as-is from native data, and kill-based achievements can resolve against native statistics instead of the combat log.

## 3. Native achievement records

- 29 achievement categories. Total points 0 on this character.
- Known retail IDs present: 627 Explore Dun Morogh (completed 10/1/26, 0 points, icon 236755), 684 Conqueror of the Lair (1 point, incomplete, icon 134349824), 728 Explore Durotar, 736 Explore Mulgore.
- Known retail IDs absent: 6 to 11 (Level 10 to 60), 42, 43, 46 (explorer metas), 688 (Zul'Gurub), 1283 (Classic Dungeonmaster), 1285 (Classic Raider), 1676, 1678 (Loremaster).

Consequence: exploration achievements can be read from the client. Everything else comes from our data.

## 4. Links

- A native `achievement:684:...` link renders in chat as a coloured link. Hover and click behaviour still to be reported. Probe 0.1.1 hooks `GameTooltip` and `ItemRefTooltip` to capture both.

## 5. API presence

95 of 129 candidates present. All 10 `Interface\AchievementFrame` textures present with file IDs, so the bundled window art works.

Missing, with the replacement to use in the port:

| Missing | Replacement |
| --- | --- |
| `AddTrackedAchievement`, `RemoveTrackedAchievement`, `GetTrackedAchievements` | `C_ContentTracking` (probe 0.1.1 checks) or the addon's own tracking |
| `CombatLogGetCurrentEventInfo` | none, see section 1 |
| `GetSpellInfo` | `C_Spell.GetSpellInfo` |
| `GetItemInfo` | `C_Item.GetItemInfo` |
| `UnitAura`, `UnitBuff`, `UnitDebuff` | `C_UnitAuras.GetAuraDataByIndex`, `GetPlayerAuraBySpellID` |
| `GetSkillLineInfo`, `GetNumSkillLines` | `C_SkillInfo.GetSkillLineInfo`, `C_SkillInfo.GetNumSkillLines` |
| `GetFactionInfo`, `GetFactionInfoByID`, `GetNumFactions` | `C_Reputation.GetFactionDataByIndex`, `GetFactionDataByID`, `GetNumFactions` |
| `GetQuestsCompleted` | `C_QuestLog.GetAllCompletedQuestIDs` |
| `GetNumPartyMembers`, `GetNumRaidMembers` | `GetNumGroupMembers`, `IsInRaid` |
| `GetNumWorldStateUI`, `GetWorldStateUIInfo` | `C_UIWidgetManager`, battleground score API |
| `GetBarberShopTotalCost` | drop the barber cost statistic |
| `GetTalentResetCost` | drop the respec cost statistic, native statistic 1149 covers respec count |
| `UnitPVPRank` | `GetPVPLifetimeStats` (present) or `C_PvP` rank info (probe 0.1.1 checks) |
| `GetInebriateLevel` | drop |
| `GetArenaTeam` | drop, no arenas |
| `GetNumBankSlots` | `C_Bank` (probe 0.1.1 checks) |
| `IsAddOnLoaded` | `C_AddOns.IsAddOnLoaded` |
| `EasyMenu` | `MenuUtil.CreateContextMenu` |
| `SetPortraitToTexture` | `texture:SetTexture` plus a circular mask, or `SetPortraitTextureFromCreatureDisplayID` where applicable |
| `GetCoinTextureString` | `C_CurrencyInfo.GetCoinTextureString` (probe 0.1.1 checks) |
| `WatchFrame_Update`, `QuestWatch_Update` | hook the modern objective tracker module instead |
| `AchievementFrame`, `AchievementsFrame`, `LegacySystemFrame` | load-on-demand frames, absent until opened; expected |

Present and usable: `UIDropDownMenu_*`, `HybridScrollFrame_*`, `FauxScrollFrame_*`, `ChatFrame_AddMessageEventFilter`, `hooksecurefunc`, `C_Container.*`, `C_MapExplorationInfo.GetExploredMapTextures`, `C_QuestLog.IsQuestFlaggedCompleted`, `C_MountJournal.GetMountIDs`, `GetPVPLifetimeStats`, the battlefield score functions, `C_ChatInfo.*`.

## Events the client refused to register

- `CHAT_MSG_COMBAT_HOSTILE_DEATH`
- `LEARNED_SPELL_IN_TAB`

Upstream registers `LEARNED_SPELL_IN_TAB` inside a `pcall`, so that one is already safe. The port must not register `CHAT_MSG_COMBAT_HOSTILE_DEATH`.

## Second run (probe 0.1.1, same day)

- `COMBAT_LOG_EVENT_UNFILTERED` fired 0 times in open-world combat; registering it is also reported as a protected call. The client fires `UNIT_DIED(guid)` instead (6 seen), with GUIDs in the usual `Creature-0-...-<creatureID>-...` form.
- The `GameTooltip.SetHyperlink` hook fired on hover of a native achievement link, so native links show a tooltip.
- `C_ContentTracking`, `C_Bank` and `C_CurrencyInfo.GetCoinTextureString` are present.

## Still open

- Encounter events in a dungeon (first guild run).
