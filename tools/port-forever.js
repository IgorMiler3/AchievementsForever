#!/usr/bin/env node
// Applies the Forever port on top of an upstream import. Run after
// tools/import-upstream.js, from the repository root:
//
//   node tools/port-forever.js
//
// Everything here is mechanical and idempotent so the port can be replayed on
// a fresh import when upstream publishes a new release. What it does:
//
//   1. Routes every call to a retail achievement API global through the addon
//      namespace (AchievementsForever.X). On Forever those globals are
//      Blizzard's own, backed by the Legacy system, so the bundled window would
//      otherwise display Blizzard's records instead of ours.
//   2. Routes every call to a Classic global the Forever client removed through
//      AchievementsForeverCompat, a shim file this script writes, which maps each
//      one to its modern C_ namespace equivalent.
//   3. Adds a UNIT_DIED kill path. Forever does not deliver the combat log to
//      addons, but it fires UNIT_DIED(guid) for creatures that die nearby.
//   4. Disables the micro-button integration (Forever has a native
//      AchievementMicroButton that belongs to Blizzard's Legacy UI) and adds /af.
//   5. Guards every RegisterEvent in the bootstrap with pcall, because the
//      modern client raises on unknown event names.
//   6. Rewrites the TOC load order.

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const runtime = path.join(repoRoot, 'AchievementsForever');
const uiDir = path.join(runtime, 'Vanilla', 'Blizzard_AchievementUI');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s, 'utf8'); }
function listLua(dir) { return fs.readdirSync(dir).filter(f => /\.(lua|xml)$/i.test(f)).map(f => path.join(dir, f)); }

const PORT_MARK = '-- AchievementsForever port applied';

// ------------------------------------------------------------------ 1. API routing
const API_GLOBALS = [
  'GetCategoryList', 'GetStatisticsCategoryList', 'GetGuildCategoryList', 'GetCategoryInfo', 'GetCategoryNumAchievements',
  'GetNumCompletedAchievements', 'GetTotalAchievementPoints', 'GetAchievementInfo', 'GetAchievementCategory',
  'GetAchievementInstance', 'GetAchievementsByInstance', 'GetPreviousAchievement', 'GetNextAchievement',
  'GetAchievementNumCriteria', 'GetAchievementCriteriaInfo', 'GetAchievementInfoFromCriteria',
  'GetLatestCompletedAchievements', 'GetLatestUpdatedStats', 'GetLatestCompletedComparisonAchievements', 'GetStatistic',
  'GetAchievementLink', 'GetTrackedAchievements', 'GetNumTrackedAchievements', 'AddTrackedAchievement',
  'RemoveTrackedAchievement', 'IsTrackedAchievement', 'SetAchievementComparisonUnit', 'ClearAchievementComparisonUnit',
  'GetComparisonAchievementPoints', 'GetAchievementComparisonInfo', 'GetComparisonCategoryNumAchievements',
  'GetComparisonStatistic', 'GetAchievementGuildRep', 'GetGuildAchievementNumMembers', 'GetGuildAchievementMembers',
  'GetGuildAchievementMemberInfo', 'AchievementFrame_LoadUI', 'ToggleAchievementFrame', 'AchievementMicroButton_Update',
  'CanShowAchievementUI', 'HasCompletedAnyAchievement',
];

// ------------------------------------------------------------------ 2. removed Classic globals
const COMPAT_GLOBALS = [
  'GetSpellInfo', 'GetItemInfo', 'UnitAura', 'UnitBuff', 'UnitDebuff', 'GetSkillLineInfo', 'GetNumSkillLines',
  'GetFactionInfo', 'GetFactionInfoByID', 'GetNumFactions', 'GetQuestsCompleted', 'GetNumPartyMembers',
  'GetNumRaidMembers', 'IsAddOnLoaded', 'GetArenaTeam', 'GetNumBankSlots', 'SetPortraitToTexture',
  'GetCoinTextureString', 'UnitPVPRank', 'GetNumWorldStateUI', 'GetWorldStateUIInfo', 'EasyMenu',
];

const files = [...listLua(runtime), ...listLua(uiDir)];
let apiHits = 0;
let compatHits = 0;

for (const file of files) {
  const base = path.basename(file);
  let text = read(file);
  const before = text;

  if (base !== 'AchievementsAPI.lua') {
    // A file that declares a local with an API global's name (upstream has
    // `local function GetTrackedAchievements()` in Achievements.lua) must keep
    // calling its own local, so skip those names in that file.
    const localNames = new Set();
    for (const m of text.matchAll(/^\s*local\s+function\s+(\w+)\s*\(/gm)) localNames.add(m[1]);
    for (const m of text.matchAll(/^\s*local\s+(\w+)\s*=/gm)) localNames.add(m[1]);
    for (const name of API_GLOBALS) {
      if (localNames.has(name)) continue;
      const re = new RegExp(`(^|[^\\w.:])${name}\\(`, 'gm');
      text = text.replace(re, (m, pre) => { apiHits++; return `${pre}AchievementsForever.${name}(`; });
      // bare references stored as values (`categoryAccessor = GetCategoryList,`)
      // would otherwise keep pointing at the client's native function
      const bareRe = new RegExp(`(^|[^\\w.:"])${name}(?=\\s*[,;\\)\\]}]|\\s*$)`, 'gm');
      text = text.replace(bareRe, (m, pre) => { apiHits++; return `${pre}AchievementsForever.${name}`; });
    }
  }

  for (const name of COMPAT_GLOBALS) {
    // rawget(_G, "Name") checks become direct compat references
    text = text.replace(new RegExp(`rawget\\(_G,\\s*"${name}"\\)`, 'g'), () => { compatHits++; return `AchievementsForeverCompat.${name}`; });
    // every other bare reference, calls and truthiness checks alike
    text = text.replace(new RegExp(`(^|[^\\w.:"])${name}(?![\\w"])`, 'gm'), (m, pre) => { compatHits++; return `${pre}AchievementsForeverCompat.${name}`; });
  }

  if (text !== before) write(file, text);
}
console.log('api calls routed:', apiHits, ' compat references routed:', compatHits);

// ------------------------------------------------------------------ 3. UNIT_DIED kill path
const resolversPath = path.join(runtime, 'AchievementsCriteriaResolvers.lua');
let resolvers = read(resolversPath);
if (!resolvers.includes('HandleUnitDiedEvent')) {
  const anchor = 'Achievements.HandleCombatLogCriteria = HandleCombatLogCriteria;';
  if (!resolvers.includes(anchor)) throw new Error('resolvers anchor not found');
  const killPath = `
-- AchievementsForever: the Forever client does not deliver the combat log to
-- addons, but it fires UNIT_DIED(guid) for units that die near the player.
-- A creature dying while the player is in combat, or within a few seconds of
-- leaving it, is treated as a kill by the player's group. Kill criteria that
-- need more than that (killing blows, player kills) stay on the native
-- statistics instead.
-- No new chunk-level locals here: this chunk already has 199 and Lua stops
-- compiling at 200, so everything hangs off the Resolvers table instead.
Resolvers.unitDiedLastCombatAt = 0;
Resolvers.unitDiedCombatFrame = CreateFrame("Frame");
pcall(Resolvers.unitDiedCombatFrame.RegisterEvent, Resolvers.unitDiedCombatFrame, "PLAYER_REGEN_DISABLED");
pcall(Resolvers.unitDiedCombatFrame.RegisterEvent, Resolvers.unitDiedCombatFrame, "PLAYER_REGEN_ENABLED");
Resolvers.unitDiedCombatFrame:SetScript("OnEvent", function()
	Resolvers.unitDiedLastCombatAt = GetTime();
end);

function Resolvers.HandleUnitDiedEvent(destGUID)
	if type(destGUID) ~= "string" or destGUID == "" then
		return false;
	end
	local unitType = string.match(destGUID, "^(%a+)%-");
	if unitType ~= "Creature" and unitType ~= "Vehicle" then
		return false;
	end
	local inCombat = (UnitAffectingCombat and UnitAffectingCombat("player")) or (GetTime() - Resolvers.unitDiedLastCombatAt) < 4;
	if not inCombat then
		return false;
	end
	local creatureID = GetCreatureIDFromGUID(destGUID);
	if not creatureID then
		return false;
	end

	local playerGUID = UnitGUID("player");
	local sourceFlags = bit.bor(COMBATLOG_OBJECT_AFFILIATION_MINE or 0x00000001, COMBATLOG_OBJECT_TYPE_PLAYER or 0x00000400);
	local destFlags = bit.bor(COMBATLOG_OBJECT_AFFILIATION_OUTSIDER or 0x00000008, COMBATLOG_OBJECT_REACTION_HOSTILE or 0x00000040, COMBATLOG_OBJECT_TYPE_NPC or 0x00000800);
	local ctx = BuildKillCombatContext(playerGUID, sourceFlags, destGUID, destFlags, creatureID);

	local recorded = false;
	local refreshTypes;
	if Resolvers.RecordSoulOfIronBossKill(creatureID) then
		recorded = true;
	end
	Resolvers.RecordCriteriaStart(CRITERIA_START_EVENT.KILL_NPC, creatureID);
	if RecordCombatCriteriaAsset(CRITERIA_TYPE.KILL_NPC, creatureID, 1) then
		recorded = true;
		refreshTypes = Resolvers.MarkCriteriaRefreshType(refreshTypes, CRITERIA_TYPE.KILL_NPC);
	end
	if RecordCriteriaEvent(CRITERIA_TYPE.KILL_NPC, creatureID, ctx) then
		recorded = true;
		refreshTypes = Resolvers.MarkCriteriaRefreshType(refreshTypes, CRITERIA_TYPE.KILL_NPC);
	end
	if RecordCriteriaEvent(CRITERIA_TYPE.KILL_ANY_NPC, 0, ctx) then
		recorded = true;
		refreshTypes = Resolvers.MarkCriteriaRefreshType(refreshTypes, CRITERIA_TYPE.KILL_ANY_NPC);
	end
	if recorded then
		if not (Resolvers.ScheduleCriteriaTypesRefresh and Resolvers.ScheduleCriteriaTypesRefresh(refreshTypes, true, 0.15, "unit-died")) then
			if Achievements.ScheduleCriteriaRefresh then
				Achievements.ScheduleCriteriaRefresh(true, 0.15, "unit-died");
			end
		end
	end
	return recorded;
end
Achievements.HandleUnitDiedEvent = Resolvers.HandleUnitDiedEvent;

`;
  resolvers = resolvers.replace(anchor, killPath + anchor);
  write(resolversPath, resolvers);
  console.log('UNIT_DIED kill path added');
}

// ------------------------------------------------------------------ 5. bootstrap events + UNIT_DIED dispatch
const bootstrapPath = path.join(runtime, 'AchievementsBootstrap.lua');
let bootstrap = read(bootstrapPath);
if (!bootstrap.includes(PORT_MARK)) {
  bootstrap = bootstrap.replace(/^eventFrame:RegisterEvent\("(\w+)"\);/gm, 'pcall(eventFrame.RegisterEvent, eventFrame, "$1");');
  bootstrap = bootstrap.replace(/^\teventFrame:RegisterEvent\("(\w+)"\);/gm, '\tpcall(eventFrame.RegisterEvent, eventFrame, "$1");');
  bootstrap = bootstrap.replace(
    'pcall(eventFrame.RegisterEvent, eventFrame, "COMBAT_LOG_EVENT_UNFILTERED");',
    '-- COMBAT_LOG_EVENT_UNFILTERED is a protected registration in Forever (ADDON_ACTION_FORBIDDEN) and never fires; UNIT_DIED replaces it.\npcall(eventFrame.RegisterEvent, eventFrame, "UNIT_DIED"); ' + PORT_MARK
  );
  bootstrap = bootstrap.replace(
    '\tif event == "COMBAT_LOG_EVENT_UNFILTERED" then',
    '\tif event == "UNIT_DIED" then\n\t\tif Achievements.HandleUnitDiedEvent then\n\t\t\tAchievements.HandleUnitDiedEvent(arg1);\n\t\tend\n\t\treturn;\n\tend\n\n\tif event == "COMBAT_LOG_EVENT_UNFILTERED" then'
  );
  // self text emotes: Forever's chat path does not reliably reach the global DoEmote hook
  const emoteBlock = /\tif event == "CHAT_MSG_TEXT_EMOTE" then\n(?:\t\t--[^\n]*\n)*\t\treturn;\n\tend/;
  if (!emoteBlock.test(bootstrap)) throw new Error('CHAT_MSG_TEXT_EMOTE block not found');
  bootstrap = bootstrap.replace(emoteBlock,
    '\tif event == "CHAT_MSG_TEXT_EMOTE" then\n\t\t-- AchievementsForever: Forever\'s chat code does not reliably reach the\n\t\t-- global DoEmote that upstream hooks, so the player\'s own emote text is\n\t\t-- parsed as a fallback (see AchievementsForeverOverrides.lua).\n\t\tif Achievements.RecordTextEmoteFallback then\n\t\t\tAchievements.RecordTextEmoteFallback(arg1, arg2);\n\t\tend\n\t\treturn;\n\tend');
  write(bootstrapPath, bootstrap);
  console.log('bootstrap events guarded, UNIT_DIED dispatched, text emote fallback dispatched');
}

// ------------------------------------------------------------------ 5a. exploration: geometry-only fallback when the art ID is unknown
resolvers = read(resolversPath);
if (!resolvers.includes('Resolvers.GetAllWorldMapOverlayList')) {
  const mergeOld = 'function Resolvers.MergeExploredOverlaysForMap(exploredOverlays, uiMapID, overlaysByArtID)\n\tlocal uiMapArtID = C_Map.GetMapArtID(uiMapID);\n\tlocal overlays = uiMapArtID and overlaysByArtID[uiMapArtID] or nil;\n\tif not overlays then\n\t\treturn false;\n\tend';
  if (!resolvers.includes(mergeOld)) throw new Error('MergeExploredOverlaysForMap block not found');
  resolvers = resolvers.replace(mergeOld, `-- AchievementsForever: the Forever client may assign different map-art IDs
-- than the 3.4.5 data this addon ships, so when no overlay rows exist for the
-- reported art ID, fall back to matching the explored texture geometry against
-- every overlay row. All eight geometry values have to agree, so false
-- positives are unlikely.
function Resolvers.GetAllWorldMapOverlayList()
	if not Resolvers.allWorldMapOverlayList then
		Resolvers.allWorldMapOverlayList = {};
		for _, overlay in pairs(worldMapOverlays) do
			tinsert(Resolvers.allWorldMapOverlayList, overlay);
		end
	end
	return Resolvers.allWorldMapOverlayList;
end

function Resolvers.MergeExploredOverlaysForMap(exploredOverlays, uiMapID, overlaysByArtID)
	local uiMapArtID = C_Map.GetMapArtID(uiMapID);
	local overlays = uiMapArtID and overlaysByArtID[uiMapArtID] or nil;
	if not overlays then
		overlays = Resolvers.GetAllWorldMapOverlayList();
		Resolvers.exploredOverlayGeometryFallbackUsed = true;
	end`);
  write(resolversPath, resolvers);
  console.log('exploration geometry fallback added');
}

// ------------------------------------------------------------------ 5a1. export the Forever map keys through Private.data
const mainPath = path.join(runtime, 'Achievements.lua');
let main = read(mainPath);
if (!main.includes('worldMapOverlayEquivalents = ACHIEVEMENTS_DATA.worldMapOverlayEquivalents')) {
  const dataEnd = '\tachievementByCriteria = ACHIEVEMENT_BY_CRITERIA,\n\tsupercededBy = SUPERCEDED_BY,\n};';
  if (!main.includes(dataEnd)) throw new Error('Private.data block not found');
  main = main.replace(dataEnd, `\tachievementByCriteria = ACHIEVEMENT_BY_CRITERIA,
	supercededBy = SUPERCEDED_BY,
	-- AchievementsForever: Forever map data generated by tools/gen-forever-maps.js
	-- (AchievementsForeverData_ForeverMaps.lua). Exported by reference like the rest.
	worldMapOverlayEquivalents = ACHIEVEMENTS_DATA.worldMapOverlayEquivalents,
	foreverUiMapByArtID = ACHIEVEMENTS_DATA.foreverUiMapByArtID,
	foreverMapsBuild = ACHIEVEMENTS_DATA.foreverMapsBuild,
};`);
  write(mainPath, main);
  console.log('Private.data exports Forever map keys');
}

// ------------------------------------------------------------------ 5a2. exploration: accept the Forever overlay that reveals the same area
resolvers = read(resolversPath);
if (!resolvers.includes('data.worldMapOverlayEquivalents')) {
  const exploredOld = '\tif not exploredWorldMapOverlayCache then\n\t\treturn nil;\n\tend\n\n\treturn exploredWorldMapOverlayCache[overlayID] == true;\nend';
  if (!resolvers.includes(exploredOld)) throw new Error('IsWorldMapOverlayExplored block not found');
  resolvers = resolvers.replace(exploredOld, `\tif not exploredWorldMapOverlayCache then
		return nil;
	end

	if exploredWorldMapOverlayCache[overlayID] == true then
		return true;
	end

	-- AchievementsForever: Forever re-cut its zone maps, so the Wrath overlay
	-- a criterion points at never appears in the client's explored list. The
	-- generated maps data lists the Forever overlays that reveal the same area.
	local equivalents = data.worldMapOverlayEquivalents and data.worldMapOverlayEquivalents[overlayID];
	if equivalents then
		for _, otherID in ipairs(equivalents) do
			if exploredWorldMapOverlayCache[otherID] == true then
				return true;
			end
		end
	end

	return false;
end`);
  write(resolversPath, resolvers);
  console.log('exploration overlay equivalents added');
}

// ------------------------------------------------------------------ 5b. instrument the DoEmote hook so the fallback can defer to it
resolvers = read(resolversPath);
if (!resolvers.includes('Resolvers.emoteHookInstalled')) {
  const hookOld = '\temoteHooksInstalled = true;\n\tResolvers.HookGlobalFunction("DoEmote", function(emoteToken, emoteTarget)\n\t\tRecordEmoteCriteria(emoteToken, emoteTarget);\n\tend);';
  if (!resolvers.includes(hookOld)) throw new Error('DoEmote hook block not found');
  resolvers = resolvers.replace(hookOld,
    '\temoteHooksInstalled = true;\n\t-- AchievementsForever: record whether and when the hook fires so the\n\t-- CHAT_MSG_TEXT_EMOTE fallback in the overrides file can stay out of its way.\n\tResolvers.emoteHookInstalled = Resolvers.HookGlobalFunction("DoEmote", function(emoteToken, emoteTarget)\n\t\tResolvers.lastEmoteHookAt = GetTime();\n\t\tResolvers.emoteHookCount = (Resolvers.emoteHookCount or 0) + 1;\n\t\tResolvers.lastEmoteHookToken = emoteToken;\n\t\tRecordEmoteCriteria(emoteToken, emoteTarget);\n\tend);');
  write(resolversPath, resolvers);
  console.log('DoEmote hook instrumented');
}

// ------------------------------------------------------------------ 4. micro-button code paths called directly (not via the namespace)
const microPath = path.join(runtime, 'AchievementsMicroButton.lua');
let micro = read(microPath);
if (!micro.includes('Never touch it.')) {
  micro = micro.replace('local function EnsureAchievementMicroButton()\n\tif AchievementMicroButton then',
    'local function EnsureAchievementMicroButton()\n\t-- AchievementsForever: Forever\'s native AchievementMicroButton belongs to\n\t-- Blizzard\'s Legacy window and sits in a protected menu. Never touch it.\n\tdo return nil; end\n\tif AchievementMicroButton then');
  micro = micro.replace('local function HookUpdateMicroButtons()\n\tif updateMicroButtonsHooked or not UpdateMicroButtons then',
    'local function HookUpdateMicroButtons()\n\tdo return; end -- AchievementsForever: see EnsureAchievementMicroButton\n\tif updateMicroButtonsHooked or not UpdateMicroButtons then');
  micro = micro.replace(/\r\n/g, '\n');
  if (!micro.includes('Never touch it.')) throw new Error('micro-button patch failed');
  write(microPath, micro);
  console.log('micro-button paths neutralised');
}

// ------------------------------------------------------------------ tab template keys for the modern PanelTemplates code
const uiXmlPath = path.join(uiDir, 'Blizzard_AchievementUI.xml');
let uiXml = read(uiXmlPath);
if (!uiXml.includes('self.LeftActive = self.LeftDisabled;')) {
  const anchor = 'self.text = _G[name.."Text"];';
  if (!uiXml.includes(anchor)) throw new Error('tab template anchor not found');
  uiXml = uiXml.replace(anchor, anchor + `
				-- AchievementsForever: the modern PanelTemplates tab code indexes
				-- these keys instead of looking the textures up by name.
				self.Left = _G[name.."Left"];
				self.Middle = _G[name.."Middle"];
				self.Right = _G[name.."Right"];
				self.LeftDisabled = _G[name.."LeftDisabled"];
				self.MiddleDisabled = _G[name.."MiddleDisabled"];
				self.RightDisabled = _G[name.."RightDisabled"];
				self.LeftActive = self.LeftDisabled;
				self.MiddleActive = self.MiddleDisabled;
				self.RightActive = self.RightDisabled;
				self.LeftHighlight = self.leftHighlight;
				self.MiddleHighlight = self.middleHighlight;
				self.RightHighlight = self.rightHighlight;
				self.Text = self.text;`);
  write(uiXmlPath, uiXml);
  console.log('tab template keys added');
}

// ------------------------------------------------------------------ slash commands
let slashHits = 0;
for (const file of listLua(runtime)) {
  let text = read(file);
  const before = text;
  text = text.replace(/"\/achievements-update"/g, '"/af-update"');
  text = text.replace(/"\/achievements"/g, '"/achievementsforever"');
  text = text.replace(/"\/ach-/g, '"/af-');
  text = text.replace(/"\/ach"/g, '"/af"');
  text = text.replace(/\/ach-(compare|fetch|title|clear|debug|update)\b/g, '/af-$1');
  text = text.replace(/\/ach locale/g, '/af locale');
  if (text !== before) { slashHits++; write(file, text); }
}
console.log('slash commands renamed in files:', slashHits);

// ------------------------------------------------------------------ 2. compat shim file
write(path.join(runtime, 'AchievementsForeverCompat.lua'), `-- AchievementsForeverCompat
-- Modern-client replacements for Classic globals the Forever client removed.
-- Generated by tools/port-forever.js; edit the generator, not this file.
-- Every function keeps the Classic return order so upstream call sites work
-- unchanged. Values that may be secret in restricted contexts are read inside
-- pcall and dropped when the client refuses them.

local Compat = {};
_G.AchievementsForeverCompat = Compat;

local function safe(fn, ...)
	local ok, a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q = pcall(fn, ...);
	if not ok then
		return nil;
	end
	return a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q;
end

local function firstField(record, ...)
	if type(record) ~= "table" then
		return nil;
	end
	for index = 1, select("#", ...) do
		local key = select(index, ...);
		local value = record[key];
		if value ~= nil then
			return value;
		end
	end
	return nil;
end

function Compat.GetSpellInfo(spell)
	if type(_G.GetSpellInfo) == "function" then
		return _G.GetSpellInfo(spell);
	end
	if C_Spell and C_Spell.GetSpellInfo then
		local info = safe(C_Spell.GetSpellInfo, spell);
		if type(info) == "table" then
			return info.name, "", info.iconID, info.castTime, info.minRange, info.maxRange, info.spellID, info.originalIconID;
		end
	end
	return nil;
end

function Compat.GetItemInfo(item)
	if type(_G.GetItemInfo) == "function" then
		return _G.GetItemInfo(item);
	end
	if C_Item and C_Item.GetItemInfo then
		return safe(C_Item.GetItemInfo, item);
	end
	return nil;
end

local function auraData(unit, index, filter)
	if C_UnitAuras and C_UnitAuras.GetAuraDataByIndex then
		local data = safe(C_UnitAuras.GetAuraDataByIndex, unit, index, filter);
		if type(data) == "table" then
			return data.name, data.icon, data.applications, data.dispelName, data.duration, data.expirationTime,
				data.sourceUnit, data.isStealable, data.nameplateShowPersonal, data.spellId, data.canApplyAura,
				data.isBossAura, data.isFromPlayerOrPlayerPet, data.nameplateShowAll, data.timeMod;
		end
	end
	return nil;
end

function Compat.UnitAura(unit, index, filter)
	if type(_G.UnitAura) == "function" then
		return _G.UnitAura(unit, index, filter);
	end
	return auraData(unit, index, filter or "HELPFUL");
end

function Compat.UnitBuff(unit, index, filter)
	return Compat.UnitAura(unit, index, filter or "HELPFUL");
end

function Compat.UnitDebuff(unit, index, filter)
	return Compat.UnitAura(unit, index, filter or "HARMFUL");
end

function Compat.GetNumSkillLines()
	if type(_G.GetNumSkillLines) == "function" then
		return _G.GetNumSkillLines();
	end
	if C_SkillInfo and C_SkillInfo.GetNumSkillLines then
		return safe(C_SkillInfo.GetNumSkillLines) or 0;
	end
	return 0;
end

function Compat.GetSkillLineInfo(index)
	if type(_G.GetSkillLineInfo) == "function" then
		return _G.GetSkillLineInfo(index);
	end
	if C_SkillInfo and C_SkillInfo.GetSkillLineInfo then
		local info = safe(C_SkillInfo.GetSkillLineInfo, index);
		if type(info) == "table" then
			return firstField(info, "skillName", "name"),
				firstField(info, "isHeader", "header"),
				firstField(info, "isExpanded", "expanded"),
				firstField(info, "skillRank", "rank"),
				firstField(info, "numTempPoints", "tempPoints"),
				firstField(info, "skillModifier", "modifier"),
				firstField(info, "skillMaxRank", "maxRank"),
				firstField(info, "isAbandonable", "abandonable"),
				firstField(info, "stepCost"),
				firstField(info, "rankCost"),
				firstField(info, "minLevel"),
				firstField(info, "skillCostType", "costType"),
				firstField(info, "skillDescription", "description");
		elseif info ~= nil then
			-- some builds return the Classic multi-value form
			return safe(C_SkillInfo.GetSkillLineInfo, index);
		end
	end
	return nil;
end

local function factionRecordToClassic(data)
	if type(data) ~= "table" then
		return nil;
	end
	return data.name, data.description, data.reaction, data.currentReactionThreshold, data.nextReactionThreshold,
		data.currentStanding, data.atWarWith, data.canToggleAtWar, data.isHeader, data.isCollapsed,
		data.isHeaderWithRep, data.isWatched, data.isChild, data.factionID, data.hasBonusRepGain, data.canSetInactive;
end

function Compat.GetNumFactions()
	if type(_G.GetNumFactions) == "function" then
		return _G.GetNumFactions();
	end
	if C_Reputation and C_Reputation.GetNumFactions then
		return safe(C_Reputation.GetNumFactions) or 0;
	end
	return 0;
end

function Compat.GetFactionInfo(index)
	if type(_G.GetFactionInfo) == "function" then
		return _G.GetFactionInfo(index);
	end
	if C_Reputation and C_Reputation.GetFactionDataByIndex then
		return factionRecordToClassic(safe(C_Reputation.GetFactionDataByIndex, index));
	end
	return nil;
end

function Compat.GetFactionInfoByID(factionID)
	if type(_G.GetFactionInfoByID) == "function" then
		return _G.GetFactionInfoByID(factionID);
	end
	if C_Reputation and C_Reputation.GetFactionDataByID then
		return factionRecordToClassic(safe(C_Reputation.GetFactionDataByID, factionID));
	end
	return nil;
end

function Compat.GetQuestsCompleted(target)
	target = type(target) == "table" and target or {};
	if type(_G.GetQuestsCompleted) == "function" then
		return _G.GetQuestsCompleted(target);
	end
	if C_QuestLog and C_QuestLog.GetAllCompletedQuestIDs then
		local ids = safe(C_QuestLog.GetAllCompletedQuestIDs);
		if type(ids) == "table" then
			for _, questID in ipairs(ids) do
				target[questID] = true;
			end
		end
	end
	return target;
end

function Compat.GetNumRaidMembers()
	if type(_G.GetNumRaidMembers) == "function" then
		return _G.GetNumRaidMembers();
	end
	if IsInRaid and IsInRaid() then
		return GetNumGroupMembers();
	end
	return 0;
end

function Compat.GetNumPartyMembers()
	if type(_G.GetNumPartyMembers) == "function" then
		return _G.GetNumPartyMembers();
	end
	if IsInGroup and IsInGroup() and not (IsInRaid and IsInRaid()) then
		return math.max(0, GetNumGroupMembers() - 1);
	end
	return 0;
end

function Compat.IsAddOnLoaded(name)
	if type(_G.IsAddOnLoaded) == "function" then
		return _G.IsAddOnLoaded(name);
	end
	if C_AddOns and C_AddOns.IsAddOnLoaded then
		return safe(C_AddOns.IsAddOnLoaded, name);
	end
	return false;
end

function Compat.GetArenaTeam()
	if type(_G.GetArenaTeam) == "function" then
		return _G.GetArenaTeam();
	end
	return nil;
end

function Compat.GetNumBankSlots()
	if type(_G.GetNumBankSlots) == "function" then
		return _G.GetNumBankSlots();
	end
	if C_Bank and C_Bank.FetchNumPurchasedBankTabs then
		local count = safe(C_Bank.FetchNumPurchasedBankTabs, Enum and Enum.BankType and Enum.BankType.Character or 0);
		return tonumber(count) or 0, true;
	end
	return 0, false;
end

function Compat.SetPortraitToTexture(texture, texturePath)
	if type(_G.SetPortraitToTexture) == "function" then
		return _G.SetPortraitToTexture(texture, texturePath);
	end
	if texture and texture.SetTexture then
		texture:SetTexture(texturePath);
		if texture.SetTexCoord then
			texture:SetTexCoord(0.08, 0.92, 0.08, 0.92);
		end
	end
end

function Compat.GetCoinTextureString(amount, fontHeight)
	if type(_G.GetCoinTextureString) == "function" then
		return _G.GetCoinTextureString(amount, fontHeight);
	end
	if C_CurrencyInfo and C_CurrencyInfo.GetCoinTextureString then
		return safe(C_CurrencyInfo.GetCoinTextureString, amount, fontHeight) or tostring(amount or 0);
	end
	return tostring(amount or 0);
end

function Compat.UnitPVPRank(unit)
	if type(_G.UnitPVPRank) == "function" then
		return _G.UnitPVPRank(unit);
	end
	if unit == "player" and type(GetPVPLifetimeStats) == "function" then
		local _, highestRank = safe(GetPVPLifetimeStats);
		return tonumber(highestRank) or 0;
	end
	return 0;
end

function Compat.GetNumWorldStateUI()
	if type(_G.GetNumWorldStateUI) == "function" then
		return _G.GetNumWorldStateUI();
	end
	return 0;
end

function Compat.GetWorldStateUIInfo()
	if type(_G.GetWorldStateUIInfo) == "function" then
		return _G.GetWorldStateUIInfo();
	end
	return nil;
end

function Compat.EasyMenu(menuList, menuFrame, anchor, x, y, displayMode, autoHideDelay)
	if type(_G.EasyMenu) == "function" then
		return _G.EasyMenu(menuList, menuFrame, anchor, x, y, displayMode, autoHideDelay);
	end
	if MenuUtil and MenuUtil.CreateContextMenu and type(menuList) == "table" then
		return MenuUtil.CreateContextMenu(anchor ~= "cursor" and anchor or UIParent, function(owner, rootDescription)
			for _, entry in ipairs(menuList) do
				if entry.isTitle then
					rootDescription:CreateTitle(entry.text or "");
				elseif entry.text then
					local button = rootDescription:CreateButton(entry.text, function()
						if type(entry.func) == "function" then
							entry.func(entry, entry.arg1, entry.arg2);
						end
					end);
					if entry.disabled and button.SetEnabled then
						button:SetEnabled(false);
					end
				end
			end
		end);
	end
end
`);

// ------------------------------------------------------------------ 4. overrides file
write(path.join(runtime, 'AchievementsForeverOverrides.lua'), `-- AchievementsForeverOverrides
-- Forever-specific behaviour that replaces upstream pieces after they load.
-- Generated by tools/port-forever.js; edit the generator, not this file.

local Achievements = _G.AchievementsForever;
if not Achievements then
	error("AchievementsForever: Achievements.lua must load before AchievementsForeverOverrides.lua");
end

-- The Forever client has a native AchievementMicroButton that belongs to
-- Blizzard's Legacy window and sits in a protected micro menu. Upstream's
-- integration would try to insert into or re-anchor that menu, which taints
-- it. The window opens from /af and the key binding instead.
Achievements.ensureAchievementMicroButton = function() return nil; end
Achievements.hookUpdateMicroButtons = function() end
Achievements.AchievementMicroButton_Update = function() end

-- Forever's chat code does not always reach the global DoEmote that upstream
-- hooks, so the player's own text emotes are also picked up from
-- CHAT_MSG_TEXT_EMOTE. English verbs only for now; the DoEmote hook stays the
-- primary path and wins whenever it fired for the same emote.
local TEXT_EMOTE_VERBS = {
	{ "roll on the floor", "ROFL" },
	{ "guffaw", "GUFFAW" },
	{ "violin", "VIOLIN" },
	{ "facepalm", "FACEPALM" },
	{ "chuckle", "CHUCKLE" },
	{ "giggle", "GIGGLE" },
	{ "laugh", "LAUGH" },
	{ "cheer", "CHEER" },
	{ "wave", "WAVE" },
	{ "kiss", "KISS" },
	{ "hug", "HUG" },
	{ "love", "LOVE" },
};

Achievements.textEmoteFallbackCount = 0;

function Achievements.RecordTextEmoteFallback(message, sender)
	if type(message) ~= "string" or not Achievements.RecordEmoteCriteria then
		return false;
	end
	local resolvers = Achievements.criteriaResolvers;
	if resolvers and resolvers.lastEmoteHookAt and GetTime() - resolvers.lastEmoteHookAt < 1 then
		return false; -- the DoEmote hook already handled this emote
	end
	if type(sender) == "string" and sender ~= "" and Ambiguate and Ambiguate(sender, "none") ~= UnitName("player") then
		return false;
	end
	if string.sub(message, 1, 4) ~= "You " then
		return false;
	end
	local lowered = string.lower(message);
	for _, entry in ipairs(TEXT_EMOTE_VERBS) do
		if string.find(lowered, entry[1], 1, true) then
			Achievements.textEmoteFallbackCount = Achievements.textEmoteFallbackCount + 1;
			Achievements.lastTextEmoteFallback = entry[2];
			return Achievements.RecordEmoteCriteria(entry[2]);
		end
	end
	return false;
end

SLASH_ACHIEVEMENTSFOREVERTOGGLE1 = "/af";
SLASH_ACHIEVEMENTSFOREVERTOGGLE2 = "/achievementsforever";
SlashCmdList["ACHIEVEMENTSFOREVERTOGGLE"] = function(argument)
	argument = string.lower(string.trim(argument or ""));
	local prefix = "|cff33ccffAchievements Forever|r ";
	if argument == "stats" or argument == "statistics" then
		Achievements.ToggleAchievementFrame(true);
	elseif argument == "native" then
		local names = _G.AchievementsForeverNativeAPI or {};
		print(prefix .. "native API globals left untouched: " .. tostring(#names));
	elseif argument == "emote" or argument == "emote test" then
		local resolvers = Achievements.criteriaResolvers or {};
		print(prefix .. "DoEmote global: " .. type(_G.DoEmote)
			.. ", hook installed: " .. tostring(resolvers.emoteHookInstalled)
			.. ", hook fired: " .. tostring(resolvers.emoteHookCount or 0) .. " (last " .. tostring(resolvers.lastEmoteHookToken) .. ")"
			.. ", chat fallback fired: " .. tostring(Achievements.textEmoteFallbackCount or 0) .. " (last " .. tostring(Achievements.lastTextEmoteFallback) .. ")");
		if argument == "emote test" then
			local recorded = Achievements.RecordEmoteCriteria("LOVE");
			print(prefix .. "direct LOVE test against target " .. tostring(UnitName("target")) .. ": recorded = " .. tostring(recorded));
		end
	elseif argument == "explore all" then
		-- Does the client report explored pieces for maps other than the current one?
		local byArt = (_G.AchievementsForeverData and _G.AchievementsForeverData.foreverUiMapByArtID) or {};
		local overlays = (_G.AchievementsForeverData and _G.AchievementsForeverData.worldMapOverlays) or {};
		local reported, empty, unmatchedLines = {}, 0, {};
		for _, uiMapID in pairs(byArt) do
			local ok, textures = pcall(function() return C_MapExplorationInfo.GetExploredMapTextures(uiMapID); end);
			local count = (ok and textures and #textures) or 0;
			if count > 0 then
				local info = C_Map.GetMapInfo and C_Map.GetMapInfo(uiMapID);
				local name = tostring(info and info.name or uiMapID);
				local artID = C_Map.GetMapArtID and C_Map.GetMapArtID(uiMapID);
				local rowsForArt, matched = 0, 0;
				for _, overlay in pairs(overlays) do
					if overlay.uiMapArtID == artID then
						rowsForArt = rowsForArt + 1;
					end
				end
				for _, t in ipairs(textures) do
					local r = t.hitRect or {};
					local hit = false;
					for _, overlay in pairs(overlays) do
						if t.textureWidth == overlay.textureWidth and t.textureHeight == overlay.textureHeight and t.offsetX == overlay.offsetX and t.offsetY == overlay.offsetY
							and r.top == overlay.hitRectTop and r.bottom == overlay.hitRectBottom and r.left == overlay.hitRectLeft and r.right == overlay.hitRectRight then
							hit = true;
							break;
						end
					end
					if hit then
						matched = matched + 1;
					elseif not unmatchedLines[name] then
						unmatchedLines[name] = name .. " art " .. tostring(artID) .. " piece " .. tostring(t.textureWidth) .. "x" .. tostring(t.textureHeight) .. " at " .. tostring(t.offsetX) .. "," .. tostring(t.offsetY)
							.. " hit " .. tostring(r.top) .. "/" .. tostring(r.bottom) .. "/" .. tostring(r.left) .. "/" .. tostring(r.right);
					end
				end
				tinsert(reported, name .. "=" .. count .. " reported/" .. matched .. " matched (art " .. tostring(artID) .. ", " .. rowsForArt .. " rows)");
			else
				empty = empty + 1;
			end
		end
		table.sort(reported);
		print(prefix .. "maps with explored pieces: " .. #reported .. ", maps reporting none: " .. empty);
		for _, line in ipairs(reported) do
			print(prefix .. "  " .. line);
		end
		for _, line in pairs(unmatchedLines) do
			print(prefix .. "  unmatched: " .. line);
		end
	elseif argument == "explore rescan" then
		if Achievements.ClearExplorationCache then
			Achievements.ClearExplorationCache();
		end
		if Achievements.RefreshCriteriaAchievements then
			Achievements.RefreshCriteriaAchievements(true);
		end
		print(prefix .. "exploration cache cleared and criteria refreshed; check the Exploration category again");
	elseif argument == "explore" then
		local uiMapID = C_Map and C_Map.GetBestMapForUnit and C_Map.GetBestMapForUnit("player");
		local artID = uiMapID and C_Map.GetMapArtID and C_Map.GetMapArtID(uiMapID);
		local info = uiMapID and C_Map.GetMapInfo and C_Map.GetMapInfo(uiMapID);
		local overlays = (_G.AchievementsForeverData and _G.AchievementsForeverData.worldMapOverlays) or {};
		local rowsForArt = 0;
		for _, overlay in pairs(overlays) do
			if overlay.uiMapArtID == artID then
				rowsForArt = rowsForArt + 1;
			end
		end
		local ok, explored = pcall(function() return C_MapExplorationInfo.GetExploredMapTextures(uiMapID); end);
		explored = (ok and explored) or {};
		local resolvers = Achievements.criteriaResolvers or {};
		print(prefix .. "map " .. tostring(uiMapID) .. " (" .. tostring(info and info.name) .. "), art " .. tostring(artID)
			.. ", overlay rows in our data for this art: " .. rowsForArt
			.. ", explored textures from client: " .. tostring(#explored)
			.. ", geometry fallback used: " .. tostring(resolvers.exploredOverlayGeometryFallbackUsed == true));
		for i = 1, math.min(#explored, 4) do
			local t = explored[i];
			local r = t.hitRect or {};
			local matched = "no row matches";
			for _, overlay in pairs(overlays) do
				if t.textureWidth == overlay.textureWidth and t.textureHeight == overlay.textureHeight and t.offsetX == overlay.offsetX and t.offsetY == overlay.offsetY
					and r.top == overlay.hitRectTop and r.bottom == overlay.hitRectBottom and r.left == overlay.hitRectLeft and r.right == overlay.hitRectRight then
					matched = "matches overlay " .. tostring(overlay.id) .. " (art " .. tostring(overlay.uiMapArtID) .. ")";
					break;
				end
			end
			print(prefix .. "  texture " .. i .. ": " .. tostring(t.textureWidth) .. "x" .. tostring(t.textureHeight) .. " at " .. tostring(t.offsetX) .. "," .. tostring(t.offsetY)
				.. " hit " .. tostring(r.top) .. "/" .. tostring(r.bottom) .. "/" .. tostring(r.left) .. "/" .. tostring(r.right) .. " -> " .. matched);
		end
	else
		Achievements.ToggleAchievementFrame(false);
	end
end
`);

// ------------------------------------------------------------------ 6. TOC
const tocPath = path.join(runtime, 'AchievementsForever_Forever.toc');
let toc = read(tocPath).replace(/\r\n/g, '\n');
if (!toc.includes('AchievementsForeverCompat.lua')) {
  toc = toc.replace('\nAchievements.lua\n', '\nAchievementsForeverCompat.lua\nAchievements.lua\n');
  toc = toc.replace('AchievementsMicroButton.lua\n', 'AchievementsMicroButton.lua\nAchievementsForeverOverrides.lua\n');
  if (!toc.includes('AchievementsForeverCompat.lua') || !toc.includes('AchievementsForeverOverrides.lua')) throw new Error('TOC patch failed');
  write(tocPath, toc);
  console.log('TOC updated');
}

// ------------------------------------------------------------------ chat slash in AchievementsUpdate.lua collides with /af from overrides: keep overrides authoritative
const updatePath = path.join(runtime, 'AchievementsUpdate.lua');
let update = read(updatePath);
if (update.includes('SLASH_ACHIEVEMENTS1 = "/af";')) {
  update = update.replace('SLASH_ACHIEVEMENTS1 = "/af";', 'SLASH_ACHIEVEMENTS1 = "/af-cmd";');
  update = update.replace('SLASH_ACHIEVEMENTS2 = "/achievementsforever";', 'SLASH_ACHIEVEMENTS2 = "/achievementsforever-cmd";');
  write(updatePath, update);
}

console.log('port complete');
