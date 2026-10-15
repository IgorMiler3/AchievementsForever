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
    for (const name of API_GLOBALS) {
      const re = new RegExp(`(^|[^\\w.:])${name}\\(`, 'gm');
      text = text.replace(re, (m, pre) => { apiHits++; return `${pre}AchievementsForever.${name}(`; });
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
local unitDiedLastCombatAt = 0;
local unitDiedCombatFrame = CreateFrame("Frame");
pcall(unitDiedCombatFrame.RegisterEvent, unitDiedCombatFrame, "PLAYER_REGEN_DISABLED");
pcall(unitDiedCombatFrame.RegisterEvent, unitDiedCombatFrame, "PLAYER_REGEN_ENABLED");
unitDiedCombatFrame:SetScript("OnEvent", function()
	unitDiedLastCombatAt = GetTime();
end);

local function HandleUnitDiedEvent(destGUID)
	if type(destGUID) ~= "string" or destGUID == "" then
		return false;
	end
	local unitType = string.match(destGUID, "^(%a+)%-");
	if unitType ~= "Creature" and unitType ~= "Vehicle" then
		return false;
	end
	local inCombat = (UnitAffectingCombat and UnitAffectingCombat("player")) or (GetTime() - unitDiedLastCombatAt) < 4;
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
Achievements.HandleUnitDiedEvent = HandleUnitDiedEvent;

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
    'pcall(eventFrame.RegisterEvent, eventFrame, "COMBAT_LOG_EVENT_UNFILTERED");\npcall(eventFrame.RegisterEvent, eventFrame, "UNIT_DIED"); ' + PORT_MARK
  );
  bootstrap = bootstrap.replace(
    '\tif event == "COMBAT_LOG_EVENT_UNFILTERED" then',
    '\tif event == "UNIT_DIED" then\n\t\tif Achievements.HandleUnitDiedEvent then\n\t\t\tAchievements.HandleUnitDiedEvent(arg1);\n\t\tend\n\t\treturn;\n\tend\n\n\tif event == "COMBAT_LOG_EVENT_UNFILTERED" then'
  );
  write(bootstrapPath, bootstrap);
  console.log('bootstrap events guarded, UNIT_DIED dispatched');
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

SLASH_ACHIEVEMENTSFOREVERTOGGLE1 = "/af";
SLASH_ACHIEVEMENTSFOREVERTOGGLE2 = "/achievementsforever";
SlashCmdList["ACHIEVEMENTSFOREVERTOGGLE"] = function(argument)
	argument = string.lower(string.trim(argument or ""));
	if argument == "stats" or argument == "statistics" then
		Achievements.ToggleAchievementFrame(true);
	elseif argument == "native" then
		local names = _G.AchievementsForeverNativeAPI or {};
		print("|cff33ccffAchievements Forever|r native API globals left untouched: " .. tostring(#names));
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
