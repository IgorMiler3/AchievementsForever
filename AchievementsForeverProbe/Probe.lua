-- Achievements Forever Probe
--
-- Phase 0 of the Achievements Forever port. This addon does nothing for
-- gameplay. It records what the Forever client exposes so the real addon can
-- be ported with facts instead of guesses. Everything it learns is written to
-- the saved variable AchievementsForeverProbeDB, which lives in
--   WTF\Account\<account>\SavedVariables\AchievementsForeverProbe.lua
-- Send that file back after a session that included one dungeon run.
--
-- Questions it answers:
--   1. Does COMBAT_LOG_EVENT_UNFILTERED fire for addons, and does
--      CombatLogGetCurrentEventInfo exist?
--   2. Does GetStatistic return live values for Blizzard's statistics rows?
--   3. Do ENCOUNTER_START, ENCOUNTER_END and BOSS_KILL fire in a 5-man?
--   4. Does the client render native achievement: chat links?
--   5. Which of the client API functions the upstream addon relies on exist.
--
-- Slash commands:
--   /afprobe            print the summary
--   /afprobe api        print the API presence table
--   /afprobe stats      scan Blizzard's achievement and statistic records
--   /afprobe link       post a native achievement link into your chat frame
--   /afprobe events     print the last 40 logged events
--   /afprobe reset      wipe the saved log

local ADDON = ...
local VERSION = "0.1.0"

AchievementsForeverProbeDB = AchievementsForeverProbeDB or {}
local db

local MAX_EVENT_LOG = 400

-- ------------------------------------------------------------ helpers

local function safeToString(value)
	-- Secret values raise on most operations in the Midnight client. Never let
	-- one take the probe down.
	local ok, text = pcall(tostring, value)
	if not ok then
		return "<secret>"
	end
	if type(value) == "string" then
		return text
	end
	return text
end

local function print_(message)
	if DEFAULT_CHAT_FRAME then
		DEFAULT_CHAT_FRAME:AddMessage("|cff33ccffAFProbe|r " .. tostring(message))
	end
end

local function now()
	return (type(GetServerTime) == "function" and GetServerTime()) or time()
end

local function stamp()
	return date("%Y-%m-%d %H:%M:%S", now())
end

local function logEvent(event, ...)
	local parts = {}
	local n = select("#", ...)
	for i = 1, n do
		parts[i] = safeToString((select(i, ...)))
	end
	db.events = db.events or {}
	local entry = stamp() .. " " .. event .. " " .. table.concat(parts, " | ")
	table.insert(db.events, entry)
	while #db.events > MAX_EVENT_LOG do
		table.remove(db.events, 1)
	end
	db.eventCounts = db.eventCounts or {}
	db.eventCounts[event] = (db.eventCounts[event] or 0) + 1
	return entry
end

local function resolveGlobalPath(pathText)
	local current = _G
	for segment in string.gmatch(pathText, "[^%.]+") do
		if type(current) ~= "table" then
			return nil
		end
		local ok, value = pcall(rawget, current, segment)
		if not ok then
			-- Some namespaces are plain tables, others are userdata-backed; fall back to indexing.
			ok, value = pcall(function() return current[segment] end)
			if not ok then
				return nil
			end
		end
		if value == nil then
			ok, value = pcall(function() return current[segment] end)
			if not ok then
				return nil
			end
		end
		current = value
	end
	return current
end

-- ------------------------------------------------------------ 5. API presence

local API_CANDIDATES = {
	-- achievement API
	"GetAchievementInfo", "GetAchievementCriteriaInfo", "GetAchievementNumCriteria", "GetCategoryList",
	"GetStatisticsCategoryList", "GetCategoryInfo", "GetCategoryNumAchievements", "GetStatistic",
	"GetAchievementLink", "GetTotalAchievementPoints", "GetNumCompletedAchievements",
	"AddTrackedAchievement", "RemoveTrackedAchievement", "GetTrackedAchievements",
	"CanShowAchievementUI", "HasCompletedAnyAchievement", "ToggleAchievementFrame", "AchievementFrame_LoadUI",
	"C_AchievementInfo.IsValidAchievement", "C_AchievementInfo.GetRewardItemID", "C_AchievementInfo.IsGuildAchievement",
	"C_Traits.GetTraitCurrencyForAchievement",
	-- combat log
	"CombatLogGetCurrentEventInfo",
	-- classic globals the upstream addon uses
	"GetSpellInfo", "GetItemInfo", "UnitAura", "UnitBuff", "UnitDebuff", "GetSkillLineInfo", "GetNumSkillLines",
	"GetFactionInfo", "GetFactionInfoByID", "GetNumFactions", "GetQuestsCompleted", "GetNumPartyMembers",
	"GetNumRaidMembers", "GetNumWorldStateUI", "GetWorldStateUIInfo", "GetBarberShopTotalCost",
	"GetTalentResetCost", "ItemTextGetItem", "GetLootSourceInfo", "GetInboxHeaderInfo", "GetInboxNumItems",
	"GetSendMailPrice", "UnitPVPRank", "UnitPVPName", "GetPVPLifetimeStats", "GetInebriateLevel",
	"GetNumCompanions", "GetArenaTeam", "IsSpellKnown", "IsPlayerSpell", "GetInventoryItemID",
	"GetInventoryItemLink", "GetNumBankSlots", "GetMoney", "GetAverageItemLevel", "UnitCreatureType",
	-- modern replacements
	"C_Spell.GetSpellInfo", "C_Item.GetItemInfo", "C_Item.GetItemCount", "C_UnitAuras.GetAuraDataByIndex",
	"C_UnitAuras.GetPlayerAuraBySpellID", "C_SkillInfo.GetSkillLineInfo", "C_SkillInfo.GetNumSkillLines",
	"C_Reputation.GetFactionDataByIndex", "C_Reputation.GetFactionDataByID", "C_Reputation.GetNumFactions",
	"C_QuestLog.IsQuestFlaggedCompleted", "C_QuestLog.GetAllCompletedQuestIDs",
	"C_MapExplorationInfo.GetExploredMapTextures", "C_Map.GetBestMapForUnit", "C_Map.GetMapArtID",
	"C_MountJournal.GetMountIDs", "C_PetJournal.GetNumPets", "C_Container.GetContainerItemInfo",
	"C_Container.GetContainerNumSlots", "C_Container.GetContainerItemID", "C_ChatInfo.SendAddonMessage",
	"C_ChatInfo.RegisterAddonMessagePrefix", "C_UIWidgetManager.GetAllWidgetsBySetID",
	"C_PvP.GetActiveMatchState", "GetBattlefieldWinner", "GetBattlefieldScore", "GetBattlefieldStatData",
	"GetNumBattlefieldScores", "RequestBattlefieldScoreData", "GetMaxBattlefieldID", "GetBattlefieldStatus",
	"C_AddOns.IsAddOnLoaded", "C_AddOns.LoadAddOn", "IsAddOnLoaded",
	-- UI helpers the bundled achievement frame expects
	"UIDropDownMenu_Initialize", "UIDropDownMenu_AddButton", "UIDropDownMenu_CreateInfo", "UIDropDownMenu_SetText",
	"UIDropDownMenu_SetWidth", "EasyMenu", "MenuUtil.CreateContextMenu", "HybridScrollFrame_Update",
	"HybridScrollFrame_GetOffset", "FauxScrollFrame_Update", "FauxScrollFrame_GetOffset", "ChatFrame_AddMessageEventFilter",
	"ChatEdit_InsertLink", "SetItemRef", "hooksecurefunc", "StaticPopup_Show", "ShowUIPanel", "SetPortraitTexture",
	"SetPortraitToTexture", "PlaySoundFile", "GetCoinTextureString", "UpdateMicroButtons", "MicroButtonTooltipText",
	"WatchFrame_Update", "QuestWatch_Update", "ObjectiveTrackerFrame", "AchievementFrame", "AchievementsFrame",
	"AlertFrame", "AchievementAlertSystem", "LegacySystemFrame", "ToggleLegacyChallenges",
	"EventRegistry", "RegisterAttributeDriver", "InCombatLockdown", "GetServerTime",
}

local TEXTURE_CANDIDATES = {
	"Interface\\AchievementFrame\\UI-Achievement-Parchment-Horizontal",
	"Interface\\AchievementFrame\\UI-Achievement-Borders",
	"Interface\\AchievementFrame\\UI-Achievement-AchievementBackground",
	"Interface\\AchievementFrame\\UI-Achievement-Shields",
	"Interface\\AchievementFrame\\UI-Achievement-Category-Background",
	"Interface\\AchievementFrame\\UI-Achievement-Alert-Background",
	"Interface\\AchievementFrame\\UI-Achievement-StatsBackground",
	"Interface\\AchievementFrame\\UI-Achievement-MetalBorder-Left",
	"Interface\\AchievementFrame\\UI-Achievement-WoodBorder-Corner",
	"Interface\\AchievementFrame\\UI-GuildAchievement-Parchment-Horizontal",
}

local probeTexture

local function textureExists(pathText)
	probeTexture = probeTexture or UIParent:CreateTexture(nil, "BACKGROUND")
	probeTexture:SetTexture(nil)
	local ok = pcall(probeTexture.SetTexture, probeTexture, pathText)
	if not ok then
		return false, "error"
	end
	local ok2, fileID = pcall(probeTexture.GetTextureFileID, probeTexture)
	if ok2 and fileID then
		return true, tostring(fileID)
	end
	local ok3, tex = pcall(probeTexture.GetTexture, probeTexture)
	if ok3 and tex then
		return true, tostring(tex)
	end
	return false, "nil"
end

local function scanAPI()
	local present, missing = {}, {}
	for _, name in ipairs(API_CANDIDATES) do
		local value = resolveGlobalPath(name)
		local kind = type(value)
		if value ~= nil then
			present[name] = kind
		else
			missing[#missing + 1] = name
		end
	end
	local textures = {}
	for _, pathText in ipairs(TEXTURE_CANDIDATES) do
		local exists, detail = textureExists(pathText)
		textures[pathText] = (exists and "yes " or "no ") .. tostring(detail)
	end
	db.api = { present = present, missing = missing, textures = textures, scannedAt = stamp() }
	return present, missing, textures
end

-- ------------------------------------------------------------ 2. native achievement records

local KNOWN_IDS = { 6, 7, 8, 9, 10, 11, 42, 43, 46, 627, 684, 728, 736, 1283, 1285, 688, 1676, 1678 }

local function scanAchievements()
	local result = { scannedAt = stamp(), categories = {}, known = {}, statistics = {}, statisticCategories = {} }
	if type(GetCategoryList) == "function" then
		local ok, list = pcall(GetCategoryList)
		if ok and type(list) == "table" then
			for _, categoryID in ipairs(list) do
				local okInfo, name, parent = pcall(GetCategoryInfo, categoryID)
				local okNum, total, completed = pcall(GetCategoryNumAchievements, categoryID, true)
				result.categories[#result.categories + 1] = string.format("%s id=%s parent=%s total=%s completed=%s",
					okInfo and safeToString(name) or "?", tostring(categoryID), okInfo and safeToString(parent) or "?",
					okNum and safeToString(total) or "?", okNum and safeToString(completed) or "?")
			end
		end
	end
	if type(GetStatisticsCategoryList) == "function" then
		local ok, list = pcall(GetStatisticsCategoryList)
		if ok and type(list) == "table" then
			for _, categoryID in ipairs(list) do
				local okInfo, name, parent = pcall(GetCategoryInfo, categoryID)
				local okNum, total = pcall(GetCategoryNumAchievements, categoryID, true)
				result.statisticCategories[#result.statisticCategories + 1] = string.format("%s id=%s parent=%s total=%s",
					okInfo and safeToString(name) or "?", tostring(categoryID), okInfo and safeToString(parent) or "?", okNum and safeToString(total) or "?")
				if okNum and type(total) == "number" then
					for index = 1, math.min(total, 60) do
						local okA, id, name2 = pcall(GetAchievementInfo, categoryID, index)
						if okA and id then
							local okS, quantity = pcall(GetStatistic, id)
							result.statistics[#result.statistics + 1] = string.format("%s id=%s value=%s", safeToString(name2), tostring(id), okS and safeToString(quantity) or "error")
						end
					end
				end
			end
		end
	end
	if type(GetAchievementInfo) == "function" then
		for _, id in ipairs(KNOWN_IDS) do
			local ok, aid, name, points, completed, month, day, year, description, flags, icon = pcall(GetAchievementInfo, id)
			if ok and aid then
				result.known[#result.known + 1] = string.format("id=%s name=%s points=%s completed=%s date=%s/%s/%s flags=%s icon=%s",
					tostring(aid), safeToString(name), safeToString(points), safeToString(completed), safeToString(month), safeToString(day), safeToString(year), safeToString(flags), safeToString(icon))
			else
				result.known[#result.known + 1] = string.format("id=%s -> %s", tostring(id), ok and "nil" or ("error " .. safeToString(aid)))
			end
		end
	end
	local okPts, points = pcall(GetTotalAchievementPoints)
	result.totalPoints = okPts and safeToString(points) or "error"
	db.achievements = result
	return result
end

-- ------------------------------------------------------------ 4. links

local function postTestLink()
	local guid = UnitGUID("player") or "Player-0-0"
	local link = string.format("|cffffff00|Hachievement:684:%s:1:1:1:26:0:0:0:0|h[Conqueror of the Lair test link]|h|r", guid)
	db.linkTest = { postedAt = stamp(), link = link }
	print_("Posted a native achievement link below. Hover it and click it. Then type /afprobe link again and say whether a tooltip appeared.")
	if DEFAULT_CHAT_FRAME then
		DEFAULT_CHAT_FRAME:AddMessage(link)
	end
end

local function hookLinks()
	if type(hooksecurefunc) ~= "function" or type(SetItemRef) ~= "function" then
		db.linkHook = "SetItemRef or hooksecurefunc missing"
		return
	end
	hooksecurefunc("SetItemRef", function(link, text, button)
		if type(link) == "string" and link:find("^achievement:") then
			db.linkClicks = db.linkClicks or {}
			table.insert(db.linkClicks, stamp() .. " " .. safeToString(link))
			print_("SetItemRef received an achievement link click: " .. safeToString(link))
		end
	end)
	db.linkHook = "installed"
end

-- ------------------------------------------------------------ events

local TRACKED_EVENTS = {
	"PLAYER_ENTERING_WORLD", "PLAYER_LEVEL_UP", "QUEST_TURNED_IN", "QUEST_ACCEPTED", "MAP_EXPLORATION_UPDATED",
	"UI_INFO_MESSAGE", "ZONE_CHANGED_NEW_AREA", "ENCOUNTER_START", "ENCOUNTER_END", "BOSS_KILL",
	"ACHIEVEMENT_EARNED", "CRITERIA_UPDATE", "RECEIVED_ACHIEVEMENT_LIST", "UPDATE_FACTION", "SKILL_LINES_CHANGED",
	"CHAT_MSG_LOOT", "LOOT_READY", "PLAYER_MONEY", "PLAYER_PVP_KILLS_CHANGED", "PLAYER_PVP_RANK_CHANGED",
	"UPDATE_BATTLEFIELD_STATUS", "UPDATE_BATTLEFIELD_SCORE", "PVP_MATCH_COMPLETE", "PLAYER_DEAD",
	"CHAT_MSG_TEXT_EMOTE", "UNIT_SPELLCAST_SUCCEEDED", "NEW_RECIPE_LEARNED", "LEARNED_SPELL_IN_TAB",
	"COMBAT_LOG_EVENT_UNFILTERED", "PLAYER_TARGET_CHANGED", "UNIT_DIED", "INSTANCE_ENCOUNTER_ENGAGE_UNIT",
	"CHAT_MSG_COMBAT_HOSTILE_DEATH", "CHAT_MSG_COMBAT_XP_GAIN", "COMBAT_TEXT_UPDATE",
}

local NOISY = { UNIT_SPELLCAST_SUCCEEDED = true, COMBAT_LOG_EVENT_UNFILTERED = true, PLAYER_TARGET_CHANGED = true, CHAT_MSG_COMBAT_XP_GAIN = true, COMBAT_TEXT_UPDATE = true, PLAYER_MONEY = true }

local frame = CreateFrame("Frame")
local registered, failed = {}, {}

local function registerAll()
	for _, event in ipairs(TRACKED_EVENTS) do
		local ok, err = pcall(frame.RegisterEvent, frame, event)
		if ok then
			registered[#registered + 1] = event
		else
			failed[event] = safeToString(err)
		end
	end
	db.registeredEvents = registered
	db.failedEvents = failed
end

local cleuSamples = 0

frame:SetScript("OnEvent", function(_, event, ...)
	if event == "ADDON_LOADED" then
		local name = ...
		if name ~= ADDON then
			return
		end
		db = AchievementsForeverProbeDB
		db.version = VERSION
		db.sessions = (db.sessions or 0) + 1
		db.lastLogin = stamp()
		local okBuild, version, build, dateText, toc = pcall(GetBuildInfo)
		db.build = okBuild and (safeToString(version) .. " build " .. safeToString(build) .. " toc " .. safeToString(toc) .. " " .. safeToString(dateText)) or "error"
		db.project = { id = safeToString(rawget(_G, "WOW_PROJECT_ID")), camelot = safeToString(rawget(_G, "WOW_PROJECT_CAMELOT")), mainline = safeToString(rawget(_G, "WOW_PROJECT_MAINLINE")), classic = safeToString(rawget(_G, "WOW_PROJECT_CLASSIC")) }
		registerAll()
		scanAPI()
		hookLinks()
		print_("loaded. Build " .. db.build .. ". Type /afprobe for the summary.")
		return
	end

	if event == "COMBAT_LOG_EVENT_UNFILTERED" then
		db.cleuFired = (db.cleuFired or 0) + 1
		if cleuSamples < 5 and type(CombatLogGetCurrentEventInfo) == "function" then
			cleuSamples = cleuSamples + 1
			local ok, ts, subevent, _, sourceGUID, sourceName, _, _, destGUID, destName = pcall(CombatLogGetCurrentEventInfo)
			logEvent("CLEU_SAMPLE", ok and subevent or ("error " .. safeToString(ts)), ok and sourceName or "", ok and destName or "", ok and destGUID or "")
		end
		return
	end

	if event == "PLAYER_ENTERING_WORLD" then
		logEvent(event, ...)
		C_Timer.After(5, function()
			pcall(scanAchievements)
			db.cleuRegistered = failed["COMBAT_LOG_EVENT_UNFILTERED"] == nil
		end)
		return
	end

	if NOISY[event] then
		db.eventCounts = db.eventCounts or {}
		db.eventCounts[event] = (db.eventCounts[event] or 0) + 1
		return
	end

	local entry = logEvent(event, ...)
	if event == "ENCOUNTER_START" or event == "ENCOUNTER_END" or event == "BOSS_KILL" or event == "ACHIEVEMENT_EARNED" or event == "UNIT_DIED" then
		print_(entry)
	end
end)

frame:RegisterEvent("ADDON_LOADED")

-- ------------------------------------------------------------ slash command

local function summary()
	print_("Achievements Forever Probe " .. VERSION)
	print_("Build: " .. tostring(db.build) .. "  project id " .. tostring(db.project and db.project.id) .. " (camelot=" .. tostring(db.project and db.project.camelot) .. ")")
	print_("1. COMBAT_LOG_EVENT_UNFILTERED registered: " .. tostring(db.cleuRegistered) .. ", fired " .. tostring(db.cleuFired or 0) .. " times, CombatLogGetCurrentEventInfo " .. (type(CombatLogGetCurrentEventInfo) == "function" and "present" or "missing"))
	local stats = db.achievements and db.achievements.statistics or {}
	local nonZero = 0
	for _, line in ipairs(stats) do
		if not line:find("value=0$") and not line:find("value=nil") and not line:find("value=error") then
			nonZero = nonZero + 1
		end
	end
	print_("2. Native statistic rows read: " .. tostring(#stats) .. ", with a non-zero value: " .. tostring(nonZero) .. ". Total points: " .. tostring(db.achievements and db.achievements.totalPoints))
	local counts = db.eventCounts or {}
	print_("3. Encounter events seen: ENCOUNTER_START " .. tostring(counts.ENCOUNTER_START or 0) .. ", ENCOUNTER_END " .. tostring(counts.ENCOUNTER_END or 0) .. ", BOSS_KILL " .. tostring(counts.BOSS_KILL or 0) .. ", UNIT_DIED " .. tostring(counts.UNIT_DIED or 0))
	print_("4. Link hook: " .. tostring(db.linkHook) .. ", clicks recorded: " .. tostring(db.linkClicks and #db.linkClicks or 0) .. ". Use /afprobe link to post one.")
	local missing = db.api and db.api.missing or {}
	print_("5. API candidates missing: " .. tostring(#missing) .. " of " .. tostring(#API_CANDIDATES) .. ". /afprobe api for the list.")
	local failedList = {}
	for name in pairs(failed) do
		failedList[#failedList + 1] = name
	end
	table.sort(failedList)
	print_("Events the client refused to register: " .. (#failedList > 0 and table.concat(failedList, ", ") or "none"))
	print_("Everything is saved to AchievementsForeverProbe.lua in your SavedVariables folder after logout or /reload.")
end

SLASH_AFPROBE1 = "/afprobe"
SlashCmdList["AFPROBE"] = function(argument)
	argument = string.lower(string.trim(argument or ""))
	if not db then
		print_("not loaded yet")
		return
	end
	if argument == "" then
		summary()
	elseif argument == "api" then
		local present, missing, textures = scanAPI()
		for _, name in ipairs(missing) do
			print_("missing: " .. name)
		end
		for pathText, state in pairs(textures) do
			print_("texture " .. state .. "  " .. pathText)
		end
		print_("present: " .. tostring(#API_CANDIDATES - #missing) .. ", missing: " .. tostring(#missing))
	elseif argument == "stats" then
		local result = scanAchievements()
		print_("categories: " .. tostring(#result.categories) .. ", statistic categories: " .. tostring(#result.statisticCategories) .. ", statistic rows: " .. tostring(#result.statistics))
		for i = 1, math.min(15, #result.statistics) do
			print_(result.statistics[i])
		end
		for _, line in ipairs(result.known) do
			print_(line)
		end
	elseif argument == "link" then
		postTestLink()
	elseif argument == "events" then
		local events = db.events or {}
		for i = math.max(1, #events - 40), #events do
			print_(events[i])
		end
	elseif argument == "reset" then
		local keep = { version = VERSION }
		AchievementsForeverProbeDB = keep
		db = keep
		print_("log wiped, /reload to start clean")
	else
		print_("commands: /afprobe, /afprobe api, /afprobe stats, /afprobe link, /afprobe events, /afprobe reset")
	end
end
