# WoW Forever Achievements Addon Plan

Oct 15, 2026 · a plan for building an addon that brings retail's Classic-era achievements into World of Warcraft: Forever

## The short answer

It is feasible, it is weeks rather than months if we start from existing open-source work, and it cannot be literally one-to-one. About three quarters of retail's vanilla-era achievements can be detected and awarded faithfully inside Forever. The rest fall into three buckets: criteria that retail tracks on the server and no addon can see, criteria that reference content which does not exist in a vanilla world, and kill criteria that may be hidden from addons. The plan below says which is which, how the addon is built, in what order, and what you do on your side to test it.

Two findings from the research shorten the road a lot.

- **The right data source is not current retail, it is Wrath Classic 3.4.5.** Current retail's Classic achievements were rewritten for Cataclysm's revamped zones, quests and dungeons. The 3.4.5 build on wago.tools still holds the pre-Cataclysm definitions: Loremaster as "complete 700 quests", the old zone lists with Alterac Mountains, Zul'Gurub still a Classic raid, the original dungeon end bosses. Exporting from 3.4.5 removes most of the "adapt" work.
- **An open-source addon already did this for Classic Era.** "Achievements" by Deathwing (GPL-3.0, github.com/Deathwing/achievements, updated August 2026) generated 386 achievements and 177 statistics from the 3.4.5 data, with a Blizzard-style window, a generated criteria resolver file, toasts, tracking, guild broadcast and chat-link handling for clients that strip achievement links. It targets Classic Era and TBC Anniversary, not Forever. Porting it to Forever's modern API is a smaller job than building from zero, and the GPL lets us do it as long as our addon is GPL too.

So the recommended path is a Forever port of that addon with our own additions, not a new codebase. The work then splits into: porting the API calls to the modern client and its secret-value rules, re-running the data generation against 3.4.5 plus a vanilla filter, wiring Forever's native achievement records and statistics into the resolvers, and writing the pieces that addon lacks.

| Tag | Meaning |
| --- | --- |
| CONFIRMED | Blizzard statement or seen in the client code |
| REPORTED | Addon authors, guide sites, forum posts |
| ESTIMATE | My sizing, to be corrected once the data is extracted |

## What the platform gives us

These are the facts that shape every design decision. All are CONFIRMED unless tagged.

- **Forever runs the modern client's UI and addon system, not Classic Era's.** Blizzard: "WoW Forever shares Mainline WoW's UI architecture, including the vast majority of APIs available in 12.1.5. The addon disarmament changes introduced in Midnight, including secrets, will also be active in Forever." Interface version is 16001, the TOC suffix is `_Forever.toc` or `_Camelot.toc`, the project constant is `WOW_PROJECT_CAMELOT` (18). Classic Era addon code does not load as-is.
- **The achievement API is live in Forever, and the database is bigger than it looks.** Blizzard's own Legacy window is built on it: `GetCategoryList`, `GetAchievementInfo`, `ACHIEVEMENT_EARNED` and `CRITERIA_UPDATE` all work. Forever's Achievement table has about 488 rows: the 65 Legacy Challenges, about 43 hidden per-zone exploration achievements, and about 110 Statistics rows such as Alterac Valley victories, total deaths and Onyxia kills, all keyed with retail's own achievement IDs (627 is Explore Dun Morogh in both games). If `GetStatistic` returns live values in Forever, which is UNVERIFIED and is the first thing phase 0 tests, then server-side counters that no Classic addon could ever read become readable here, and the "dropped" list shrinks a lot.
- **The retail achievement frame exists in the client.** `Blizzard_AchievementUI` loads for the mainline family, and the Forever build only redirects `AchievementFrame_ToggleAchievementFrame` to the Legacy window. Its templates and textures are available to an addon. Forever Feats uses them to draw "the wood and metal shell, the header arch, the parchment category column" (REPORTED). One rule: never name a global frame `AchievementFrame`, Blizzard's protected micro-button code reads that global and a tainted frame blocks logout (REPORTED by the Classic Era Achievements author).
- **The combat log may not be available to addons.** Two sources disagree. The forever-addon-kit and Questie maintainers report `COMBAT_LOG_EVENT_UNFILTERED` and `CombatLogGetCurrentEventInfo` missing in the beta client; the Warcraft Wiki still lists the event for Forever 1.60.1, and BigWigs has a Forever build that would need it. Phase 0 settles this with one trace. If it is gone, there is no `UNIT_DIED`, and generic "kill this creature" detection falls back to quests, loot and the native statistics. Unit health and similar values come back as secret values in restricted contexts either way.
- **Encounter events exist.** `ENCOUNTER_START`, `ENCOUNTER_END` and `BOSS_KILL` carry the Forever 1.60.1 badge on the Warcraft Wiki. Whether every vanilla raid boss is wired as an encounter in Forever needs testing on live, but Blizzard's own Legacy dungeon and raid challenges prove boss kills are tracked somewhere the client can see.
- **Old Classic globals are gone.** `GetSpellInfo`, `GetItemInfo`, `UnitAura`, `GetNumSkillLines` and friends are replaced by `C_Spell`, `C_Item`, `C_UnitAuras`, `C_SkillInfo`. Registering an unknown event throws an error instead of being ignored.
- **Distribution exists but is not needed for testing.** CurseForge has a Forever flavor, WowUp 2.24.0 supports Forever. For your own testing the addon is a folder under `Interface\AddOns` in the beta's `_classic_beta_` directory; the launch folder name is not announced yet.
- **Addons already occupy the neighbouring space.** On Forever: Forever Feats (111 invented feats, closed source), Forever Quick Achievements (WotLK-style categories mixing Blizzard's Legacy records with its own, GPLv3), Achievement Pathfinder (reads only Blizzard's records). None replicates retail's list. On Classic Era: Deathwing's Achievements (GPL-3.0, retail data from 3.4.5, the base we port), Anniversary Achievements (432 achievements, no licence, UI reference only), Krowi's Achievement Filter on retail (its data folder is a curated index of which retail achievement IDs belong to each Classic zone and event, a ready-made vanilla filter).

## Scope: which retail achievements this covers

Retail's achievement database is one table per achievement with a criteria tree hanging off it. The relevant tables are Achievement, Achievement_Category, CriteriaTree, Criteria and ModifierTree. Every achievement points at a CriteriaTree node, that node has child nodes with an operator (all of, any of, a count of), and leaves point at a Criteria row with a type and an asset: type 0 is kill creature with a creature ID, type 27 is complete quest with a quest ID, type 43 is reveal a world map overlay, type 46 is gain reputation with a faction ID, type 7 is skill raised, type 5 is reach level, type 29 is cast spell, type 36 is acquire item, type 165 is defeat a dungeon encounter, and so on. The full list is the CriteriaType enum in TrinityCore's DBCEnums.h. All of it exports as CSV from wago.tools with no login at `https://wago.tools/db2/<Table>/csv?build=3.4.5.63697`, and column layouts per build come from the WoWDBDefs repository.

Useful 3.4.5 category IDs: General 92, Quests 96, Exploration 97 (Eastern Kingdoms 14777, Kalimdor 14778), PvP 95 (Alterac Valley 14801, Arathi Basin 14802, Warsong Gulch 14804), Dungeons and Raids 168 (Classic 14808), Professions 169 (Cooking 170, Fishing 171, First Aid 172), Reputation 201 (Classic 14864), World Events 155 (Winter Veil 156, Hallow's End 158, Noblegarden 159, Lunar Festival 160, Midsummer 161, Children's Week 163, Love is in the Air 187), Feats of Strength 81, Statistics 1.

The categories that cover vanilla content, with counts from the Warcraft Wiki category pages and Deathwing's extraction (ESTIMATE where marked):

| Category | What is in it | Rough count | Replicable |
| --- | --- | --- | --- |
| Character, General | Level 10 to 60 (IDs 6 to 11), pets and mounts counts, Stable Keeper, Well Read, Shave and a Haircut, Safe Deposit, Twenty-Five Tabards, Tastes Like Chicken, It's Happy Hour Somewhere | 10 to 15 | Mostly. Levels, mounts, pets, bank slots, haircuts yes. Item level ones are modern |
| Quests | 50 to 1000 quests completed, Loremaster of Eastern Kingdoms and Kalimdor in the Wrath form (700 quests per continent) | 7 to 9 | Yes with the 3.4.5 data. The retail per-zone quest achievements are Cataclysm and are left out |
| Exploration | 22 Eastern Kingdoms zones including Alterac, 18 Kalimdor zones, Explore Eastern Kingdoms, Explore Kalimdor, Acrobatics, Critter Love | about 44 | Yes. Forever's own 43 hidden exploration achievements use the same IDs, so these read straight from the client |
| Dungeons and Raids, Classic | Classic Dungeonmaster with 19 dungeon criteria, Classic Raider with Molten Core, Blackwing Lair, Ruins and Temple of Ahn'Qiraj, plus the two retail moved to Legacy: Onyxia's Lair (Level 60) and Zul'Gurub (688). Naxxramas 40 has no retail achievement because Naxxramas became the Wrath raid | 27 | Yes via encounter events. Only Naxxramas needs a written-by-us achievement, flagged as such |
| Player versus Player | 16 general (honorable kill ladder, Duel-icious, That Takes Class, Know Thy Enemy, The Grim Reaper, Wrecking Ball), Warsong Gulch 16, Arathi Basin 16, Alterac Valley 18 | about 63 | Mostly. Wins, flags, bases, honorable kills are readable. That Takes Class and Know Thy Enemy list classes and races vanilla lacks, so they are adapted. Battlemaster needs Eye of the Storm, dropped |
| Professions | Journeyman, Expert, Classic Master at 150, 225, 300, Working from the Start, cooking recipe counts, fishing catch counts, Old Ironjaw, Old Crafty, The Fishing Diplomat, Master Angler, the First Aid trio, Ultimate Triage, Stocking Up | 25 to 30 | Yes. Classic Master of All needs 11 professions and is dropped |
| Reputation | 5 to 20 Exalted Reputations, Somebody Likes Me, Ambassador (adapted to five home factions), The Argent Dawn, They Love Me In That Tunnel, Hydraxian Waterlords, Brood of Nozdormu, Avast Ye Admiral, Insane in the Membrane as a Feat | about 12 | Yes. Retail has no individual achievements for Cenarion Circle, Thorium Brotherhood, Zandalar or Wintersaber |
| World Events | Lunar Festival about 11, Midsummer about 10, Hallow's End about 7, Winter Veil about 8, Noblegarden about 5, Children's Week about 3, Love is in the Air 0 to 3 | 45 to 55 | Partly. The holidays existed in vanilla but several achievements use mechanics added in 2.x and 3.x. Brewfest, Pilgrim's Bounty and the Darkmoon Island achievements are out. Harvest Festival has no achievements at all |
| Feats of Strength and Legacy | Scarab Lord, Old School Ride, Swift Zulian Tiger, Swift Razzashi Raptor, Winterspring Frostsaber, Deathcharger's Reins, Sulfuras, Thunderfury, Atiesh, the 28 old PvP rank achievements, Leeroy, Craftsman of the Argent Dawn and Zandalar, the collector's edition pets | about 45 | Mostly, as "earned if you hold the item or title". Realm-first level 60 does not exist on retail, so there is none to replicate |
| Statistics | About 170 counters: kills per boss, deaths, battleground wins, gold looted, quests completed | about 170 | Only if Forever's `GetStatistic` is live, otherwise dropped |

Total: roughly 330 to 400 player achievements plus about 170 statistics plausibly achievable in a vanilla world, which matches Deathwing's 386 plus 177 from the same data. Forever's new dungeons and zones (Hall of Thanes, Excavation Site, Riverglades, Hyjal) have no retail counterpart and are an optional extension once the core exists.

**Three classification rules applied to every achievement during data work.**

1. **Keep as-is.** Every criterion maps to something the addon can observe. Name, description, icon, points, category and criteria text stay exactly as in the 3.4.5 data.
2. **Adapt.** The achievement references something vanilla lacks but the intent survives. That Takes Class (13 classes, vanilla has 9), Know Thy Enemy (modern races), Ambassador (6 home factions, vanilla has 5), Did Somebody Order a Knuckle Sandwich? (unarmed 400, the vanilla cap is 300). The name and points stay, the criteria are rebuilt, and the achievement is flagged "adapted" in its tooltip.
3. **Drop, with a visible reason.** Criteria that need Eye of the Storm, Outland, guild levels or Cataclysm holiday mechanics, and any server counter that `GetStatistic` does not expose. These are listed in a "Not replicable" appendix inside the addon's options so nobody wonders where they went.

## Architecture

The addon is five layers. Each is a folder, and each can be built and tested without the ones after it.

```
ForeverAchievements/
  ForeverAchievements_Forever.toc      ## Interface: 16001
  Libs/                                 LibStub, CallbackHandler, AceDB for the saved data, LibDataBroker for a minimap button
  Data/
    Categories.lua                      generated: retail category tree, vanilla subset
    Achievements.lua                    generated: id, name, description, icon, points, category, flags, reward text
    Criteria.lua                        generated: per achievement, the criteria tree with type, asset, quantity, text
    Adapted.lua                         hand-written overrides for the "adapt" set
    Dropped.lua                         hand-written list with reasons
    ForeverExtras.lua                   optional: Zul'Gurub, Naxxramas, Forever dungeons, written in retail style
  Core/
    Store.lua                           SavedVariables: account-wide completions, per-character progress, timestamps, points
    Engine.lua                          criteria evaluation: walks the tree, awards on completion, fires our own callbacks
    Retro.lua                           first-login scan: everything derivable from current state
    Detectors/                          one file per criteria family (see the matrix below)
  UI/
    Frame.lua                           the achievements window on Blizzard's templates
    Toast.lua                           the "Achievement Earned" banner
    Links.lua                           chat links and tooltips
    Options.lua                         settings, the not-replicable list, diagnostics
  Comm/
    Guild.lua                           addon messages: broadcast completions, request a guildmate's list
```

**Data layer.** Deathwing's repository already contains a generator that turns the 3.4.5 CSV exports into Lua tables and a resolver file. We reuse it, or rewrite it in Node (which we have here) if its toolchain is awkward on Windows. It filters achievements by category and by the content their criteria reference, resolves creature, quest, overlay and faction IDs, and emits one Lua file per table. Krowi's data folder supplies a second opinion on which IDs belong to each Classic zone and event. The script is part of the repository so the data can be regenerated. Icons are referenced by file data ID, which the modern client renders directly.

**Store.** AceDB with an account-wide profile for completions and a per-character section for progress counters. Each completion records the character name, realm, timestamp and the addon version that awarded it. Points are computed from completions, never stored, so a data correction recounts everyone's score. A version field on the data lets us migrate when criteria change.

**Engine.** On every event a detector produces one or more criteria updates: criteria ID, new value. The engine finds every achievement whose tree contains that criterion, re-evaluates the tree, and if the root becomes satisfied it marks the achievement complete, fires the toast, updates the frame and broadcasts to the guild. Trees use three operators, which covers everything retail does: all children complete, any child complete, and N of the children complete.

**Retro scan.** On first login, and again after any data update, the addon derives every completion it can from current state: level, completed quest flags through `C_QuestLog.GetAllCompletedQuestIDs`, explored map overlays through `C_MapExplorationInfo.GetExploredMapTextures`, reputations, skill levels, known recipes, known mounts through `C_MountJournal.GetMountIDs`, honorable kills and rank through `GetPVPLifetimeStats`, inventory and bank for Feat-of-Strength items, Blizzard's own achievement records through `GetAchievementInfo`, and, if they are live, Blizzard's statistics through `GetStatistic`. This is why a player who installs the addon at 60 sees a full ledger instead of an empty one. Dungeon and raid kills before the install cannot be recovered except where Blizzard's records or statistics prove them.

**UI.** Built on the client's achievement frame templates with a different global name. Left column of categories with point totals, right side the achievement rows with the blue title band, icon, shield and completion date, a summary tab with recent completions and category progress bars, a search box, tracked achievements in the objective tracker, and a toast that uses the client's alert frame art. The micro button or a minimap button opens it, and a slash command.

**Links.** Retail's `achievement:` hyperlinks route to Blizzard's handler and only resolve for IDs the client knows, which in Forever means the Legacy records. The modern client also has an `addon:name:data` link type since 10.1, but it is local-only and cannot be sent in chat. So the addon does what Deathwing's does: send a plain bracketed token in chat and rewrite it into a coloured link with a tooltip on every client running the addon, through a chat message filter. Whether Forever renders native `achievement:` links for the IDs it knows is UNVERIFIED and worth a phase 0 test, because if it does, the Legacy-backed achievements get real links for free.

**Guild comm.** A registered addon message prefix. On completion the addon broadcasts the achievement ID and timestamp to guild chat's addon channel. Members cache each other's completions, which powers a guild roster view and the tooltip on links. Trial accounts cannot send addon messages in Forever, which only matters for trial players. There is no anti-cheat: anyone can edit their SavedVariables, so the guild view is a ledger among friends, not proof.

## Detection matrix

This is the part that decides what is replicable. Each row is one criteria family from the retail Criteria table, mapped to what Forever's API exposes.

| Criteria family | Retail type | How the addon detects it | Confidence |
| --- | --- | --- | --- |
| Reach level | 5 | `PLAYER_LEVEL_UP`, `UnitLevel("player")` | Certain |
| Complete quest | 27 | `QUEST_TURNED_IN` with the quest ID, `C_QuestLog.IsQuestFlaggedCompleted` for the retro scan | Certain |
| Quests completed count | 28 | Count of completed quest flags per zone from Forever's quest database | Certain, adapted counts |
| Explore area | 43 | `ZONE_CHANGED`, `UI_INFO_MESSAGE` discovery text, `C_MapExplorationInfo.GetExploredMapTextures` for the retro scan, plus Blizzard's own exploration achievement records | Certain |
| Gain reputation | 46 | `UPDATE_FACTION`, `C_Reputation` or `GetFactionInfo` | Certain |
| Reach skill level | 7 | `SKILL_LINES_CHANGED`, `C_SkillInfo.GetSkillLineInfo` | Certain |
| Learn recipe or spell | 29 and 34 | `NEW_RECIPE_LEARNED`, `LEARNED_SPELL_IN_TAB`, trade skill API for counts | High |
| Own item, equip item | 36 and 57 | `BAG_UPDATE_DELAYED`, `PLAYER_EQUIPMENT_CHANGED`, `C_Item` | High |
| Gold earned, gold held | 62 and 67 | `PLAYER_MONEY` | High |
| Mounts and pets known | 72 and similar | Mount journal and pet APIs in the modern client, if Forever exposes them, else spellbook scan | Medium, needs testing |
| Kill a raid or dungeon boss | 165 or 0 with a boss creature ID | `ENCOUNTER_END` with success, `BOSS_KILL`, cross-checked with instance ID. Encounter IDs exist for every vanilla raid boss (Molten Core 663 to 672, Blackwing Lair 610 to 617, Temple of Ahn'Qiraj 709 to 717, Zul'Gurub 784 to 793, Naxxramas 1107 to 1121, Onyxia 1084) and BigWigs keys its Classic modules on them | High for raids, needs per-dungeon testing |
| Kill a named non-boss creature | 0 | If the combat log survives in Forever: `UNIT_DIED` with the creature ID from the GUID. If not: the quest that requires the kill, loot of a unique drop, or Blizzard's statistics | Medium pending the phase 0 trace |
| Kill creature type counts, kills in battlegrounds | 0 with counts, 113 | Only through `GetStatistic` if Forever exposes it | Low |
| Honorable kills | 62 family | `PLAYER_PVP_KILLS_CHANGED`, `GetPVPLifetimeStats` | High |
| Battleground win, flags, bases | 1, 15, 8 | `UPDATE_BATTLEFIELD_SCORE`, `PVP_MATCH_COMPLETE`, battlefield score API | High for wins, medium for objectives |
| Emote at a target | 54 | `CHAT_MSG_TEXT_EMOTE` and `DoEmote` hook. Forever requires a hardware event for emotes outside instances, which only affects automation, not detection | Medium |
| Use item, cast spell on target | 29, 110 | `UNIT_SPELLCAST_SUCCEEDED` for the player with spell ID | High |
| Loot item | 36 | `CHAT_MSG_LOOT`, `LOOT_READY` | High |
| Holiday event participation | mixed | Quest completion and item use, scheduled by calendar date | High for quest-based, medium for the rest |
| Damage, healing, deaths, statistics | 102 to 130 | Server-side only | Dropped |
| Realm first | flags | Not verifiable | Shown as Feat of Strength, marked unverified |

## Phases

Effort is for one developer working evenings and weekends, with you as the only tester at first. Calendar time doubles if nobody is testing in-game within a day of each build.

| Phase | Deliverable | Effort | What you test |
| --- | --- | --- | --- |
| 0, probe | TOC, folder, a frame that opens on a slash command, saved variables that survive a reload, and a probe that answers the four open questions: does `COMBAT_LOG_EVENT_UNFILTERED` fire, does `GetStatistic` return values for Blizzard's statistics rows, do `ENCOUNTER_END` and `BOSS_KILL` fire in a 5-man, do native `achievement:` links render | 2 to 3 days | Install, log in, run the probe through Deadmines once and send me its output |
| 1, port | Fork Deathwing's Achievements under GPL-3.0, replace every Classic Era API call with the modern one (`C_Spell`, `C_Item`, `C_UnitAuras`, `C_SkillInfo`, quest log, secret-value guards), rename the global frame, get it loading on 16001 with its existing 386 achievements | 1 to 2 weeks | Log in, open the window, check the retro scan on a character with history |
| 2, data | Re-run the generator against 3.4.5 with a vanilla filter, write the adapted and dropped lists with reasons, add Forever's native records and statistics as resolver inputs | 1 to 2 weeks | You review the dropped list and decide on Naxxramas |
| 3, window | Verify the ported window on Blizzard's templates, add what it lacks: summary tab, search, tracking in the objective tracker, toast on the client's alert frame | 1 to 2 weeks | Open it at every resolution you use, in both UI scales, with the Legacy window open beside it |
| 4, encounters and PvP | Boss detectors with per-dungeon verification, battleground detectors, honor | 2 to 3 weeks, spread over the dungeons the guild runs | Every guild dungeon run becomes a test; the diag command dumps what the encounter events reported |
| 5, links and guild | Chat links, tooltips, guild broadcast and roster view | 1 to 2 weeks | Two guildmates install it and link each other's achievements |
| 6, holidays | World Event detectors, one holiday at a time as the calendar reaches it | 1 week per holiday | Only possible when each holiday is live, so this runs across the first year |
| 7, release | Options panel, the not-replicable appendix, CurseForge and Wago listings, changelog | 1 week | Fresh install from CurseForge on a clean client |

Phases 2 and 3 can run in parallel if two people work on it. Phase 1 is the critical path: until the port loads on Forever nothing else can be tested. Phase 2 is where "one-to-one" is decided achievement by achievement. Starting from the port instead of from zero cuts the total from roughly four to six months of evenings to roughly two to three.

## Your test loop

- **Install.** Copy the `ForeverAchievements` folder into the beta's `Interface\AddOns`, enable it on the character screen. After launch, the folder moves to whatever Forever's live directory is called.
- **Iterate.** Edit files, type `/reload`. No restart, no publishing. CurseForge is only for giving it to others.
- **Catch errors.** Install an error-catching addon with a Forever build, or at minimum enable Lua errors in the interface options so they are not swallowed. Paste me the full error text with the stack.
- **Trace events.** The modern client has `/eventtrace`, which shows every event with its arguments. It is how we find out what a Forever boss kill actually fires before writing the detector for it.
- **Dump state.** `/dump` any value, and the addon gets a `/fa diag` command that prints the last 50 criteria updates and what the engine did with them.
- **Second account not needed.** Guild sync is tested with one guildmate. Links and toasts are tested alone.

## Risks and open questions

- **Blizzard adds a real achievement system.** They have said new Legacy Challenges come with every content release and nothing about achievements. If they ever ship retail's achievements in Forever, this addon becomes a bridge for the ones they did not include. The data layer is still useful.
- **API churn.** Forever is on the modern client, so every modern patch that changes addon rules lands here too. The Midnight secrets system is already active. Expect to re-test after every Forever patch.
- **Encounter coverage.** If some vanilla dungeon bosses are not wired as encounters, those dungeon achievements need the quest fallback or get dropped. Only live testing answers this, which is why phase 0 includes a Deadmines trace.
- **The retail data is not vanilla data.** Cataclysm changed zone layouts, quest IDs and dungeon bosses. Every adapted achievement is a judgement call and the adapted list will be long. This is the honest limit of one-to-one.
- **Legal.** Retail achievement names, descriptions and icons are Blizzard's. Every achievement addon on CurseForge uses them and none has been pulled, but the addon should not pretend to be official and should credit the source.
- **Competition and licensing.** Forever Quick Achievements is GPLv3 and moving fast, and Deathwing's addon could get a Forever build from its own author any week. Forking under GPL-3.0 keeps us legal and lets either side merge the other's work. Contacting Deathwing before forking is polite and might turn the fork into a collaboration.

## Decisions, taken 15 October 2026

1. **Fork Deathwing's Achievements** under GPL-3.0 and rework it for Forever.
2. **Naxxramas: not yet.** No custom achievement for it in the first release.
3. **Forever's own raids get one general achievement each:** Hyjal Summit and Barrow Deeps, in the style of retail's Onyxia's Lair (Level 60) which already exists. **Every new Forever dungeon gets a dungeon achievement** in the style of Classic Dungeonmaster's criteria: Hall of Thanes, Excavation Site: Wetlands, City of Dalaran, The Drowned City, Krol'dok Stronghold, Alcaz Prison, Blackmaw Hold, Shaper's Terrace, and any other dungeon Forever ships. These are flagged as Forever additions in their tooltips and live in their own sub-category so the retail set stays clean.
4. **Per-character achievements.** Progress and completions are stored per character, not account-wide. This differs from retail and Forever's Legacy system on purpose.
5. **Name: Achievements Forever.** Folder `AchievementsForever`, TOC `AchievementsForever_Forever.toc`, slash command `/af`.

## Immediate next steps

1. Clone Deathwing's repository, read its generator and resolvers, and produce the list of API calls that need porting.
2. Write phase 0, the probe addon, into a folder in this workspace. You run it through one dungeon and send me its output.
3. Start the port.
