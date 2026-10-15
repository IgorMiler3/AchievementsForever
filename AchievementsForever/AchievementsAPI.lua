local Achievements = _G.AchievementsForever;
-- Names of achievement API globals the client already provides natively. The
-- Forever client ships the retail achievement API for its Legacy system, so
-- these are never overwritten; the UI must call Achievements.* instead.
AchievementsForeverNativeAPI = AchievementsForeverNativeAPI or {};
if not Achievements then
	error("Achievements: Achievements.lua must load before AchievementsAPI.lua");
end

-- IMPORTANT: never overwrite a global that the client already provides natively.
-- On TBC 2.5.6 these globals are native and are read by Blizzard's PROTECTED code
-- (e.g. UpdateMicroButtons reads HasCompletedAnyAchievement/CanShowAchievementUI
-- during GameMenu OnShow). Assigning them from this insecure addon taints the
-- native global, which propagates into the Logout callback and triggers
-- ADDON_ACTION_FORBIDDEN. On Classic Era these globals do not exist, so we define
-- them there. Guard every assignment on native absence.
if not BINDING_HEADER_ACHIEVEMENTSFOREVER then
	BINDING_HEADER_ACHIEVEMENTSFOREVER = "Achievements";
end
if not BINDING_NAME_AF_TOGGLEACHIEVEMENT then
	BINDING_NAME_AF_TOGGLEACHIEVEMENT = "Toggle Achievement Frame";
end
if not BINDING_NAME_AF_TOGGLESTATISTICS then
	BINDING_NAME_AF_TOGGLESTATISTICS = "Toggle Statistics Frame";
end

if type(_G.CanShowAchievementUI) ~= "function" then
	function CanShowAchievementUI()
		return Achievements.CanShowAchievementUI();
	end
end

if type(_G.HasCompletedAnyAchievement) ~= "function" then
	function HasCompletedAnyAchievement()
		return Achievements.HasCompletedAnyAchievement();
	end
end

if type(_G.GetCategoryList) ~= "function" then
	function GetCategoryList()
		return Achievements.GetCategoryList();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetCategoryList";
end

if type(_G.GetStatisticsCategoryList) ~= "function" then
	function GetStatisticsCategoryList()
		return Achievements.GetStatisticsCategoryList();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetStatisticsCategoryList";
end

if type(_G.GetGuildCategoryList) ~= "function" then
	function GetGuildCategoryList()
		return Achievements.GetGuildCategoryList();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetGuildCategoryList";
end

if type(_G.GetCategoryInfo) ~= "function" then
	function GetCategoryInfo(categoryID)
		return Achievements.GetCategoryInfo(categoryID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetCategoryInfo";
end

if type(_G.GetCategoryNumAchievements) ~= "function" then
	function GetCategoryNumAchievements(categoryID, showAll)
		return Achievements.GetCategoryNumAchievements(categoryID, showAll);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetCategoryNumAchievements";
end

if type(_G.GetNumCompletedAchievements) ~= "function" then
	function GetNumCompletedAchievements()
		return Achievements.GetNumCompletedAchievements();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetNumCompletedAchievements";
end

if type(_G.GetTotalAchievementPoints) ~= "function" then
	function GetTotalAchievementPoints()
		return Achievements.GetTotalAchievementPoints();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetTotalAchievementPoints";
end

if type(_G.GetAchievementInfo) ~= "function" then
	function GetAchievementInfo(categoryOrAchievementID, index)
		return Achievements.GetAchievementInfo(categoryOrAchievementID, index);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetAchievementInfo";
end

if type(_G.GetAchievementCategory) ~= "function" then
	function GetAchievementCategory(achievementID)
		return Achievements.GetAchievementCategory(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetAchievementCategory";
end

if type(_G.GetAchievementInstance) ~= "function" then
	function GetAchievementInstance(achievementID)
		return Achievements.GetAchievementInstance(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetAchievementInstance";
end

if type(_G.GetAchievementsByInstance) ~= "function" then
	function GetAchievementsByInstance(instanceID)
		return Achievements.GetAchievementsByInstance(instanceID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetAchievementsByInstance";
end

if type(_G.GetPreviousAchievement) ~= "function" then
	function GetPreviousAchievement(achievementID)
		return Achievements.GetPreviousAchievement(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetPreviousAchievement";
end

if type(_G.GetNextAchievement) ~= "function" then
	function GetNextAchievement(achievementID)
		return Achievements.GetNextAchievement(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetNextAchievement";
end

if type(_G.GetAchievementNumCriteria) ~= "function" then
	function GetAchievementNumCriteria(achievementID)
		return Achievements.GetAchievementNumCriteria(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetAchievementNumCriteria";
end

if type(_G.GetAchievementCriteriaInfo) ~= "function" then
	function GetAchievementCriteriaInfo(achievementID, criteriaIndex)
		return Achievements.GetAchievementCriteriaInfo(achievementID, criteriaIndex);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetAchievementCriteriaInfo";
end

if type(_G.GetAchievementInfoFromCriteria) ~= "function" then
	function GetAchievementInfoFromCriteria(criteriaID)
		return Achievements.GetAchievementInfoFromCriteria(criteriaID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetAchievementInfoFromCriteria";
end

if type(_G.GetLatestCompletedAchievements) ~= "function" then
	function GetLatestCompletedAchievements()
		return Achievements.GetLatestCompletedAchievements();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetLatestCompletedAchievements";
end

if type(_G.GetLatestUpdatedStats) ~= "function" then
	function GetLatestUpdatedStats()
		return Achievements.GetLatestUpdatedStats();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetLatestUpdatedStats";
end

if type(_G.GetLatestCompletedComparisonAchievements) ~= "function" then
	function GetLatestCompletedComparisonAchievements()
		return Achievements.GetLatestCompletedComparisonAchievements();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetLatestCompletedComparisonAchievements";
end

if type(_G.GetStatistic) ~= "function" then
	function GetStatistic(categoryOrStatisticID, index)
		return Achievements.GetStatistic(categoryOrStatisticID, index);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetStatistic";
end

if type(_G.GetAchievementLink) ~= "function" then
	function GetAchievementLink(achievementID)
		return Achievements.GetAchievementLink(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetAchievementLink";
end

if type(_G.GetTrackedAchievements) ~= "function" then
	function GetTrackedAchievements()
		return Achievements.GetTrackedAchievements();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetTrackedAchievements";
end

if type(_G.GetNumTrackedAchievements) ~= "function" then
	function GetNumTrackedAchievements()
		return Achievements.GetNumTrackedAchievements();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetNumTrackedAchievements";
end

if type(_G.AddTrackedAchievement) ~= "function" then
	function AddTrackedAchievement(achievementID)
		return Achievements.AddTrackedAchievement(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "AddTrackedAchievement";
end

if type(_G.RemoveTrackedAchievement) ~= "function" then
	function RemoveTrackedAchievement(achievementID)
		return Achievements.RemoveTrackedAchievement(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "RemoveTrackedAchievement";
end

if type(_G.IsTrackedAchievement) ~= "function" then
	function IsTrackedAchievement(achievementID)
		return Achievements.IsTrackedAchievement(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "IsTrackedAchievement";
end

if type(_G.SetAchievementComparisonUnit) ~= "function" then
	function SetAchievementComparisonUnit(unit)
		return Achievements.SetAchievementComparisonUnit(unit);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "SetAchievementComparisonUnit";
end

if type(_G.ClearAchievementComparisonUnit) ~= "function" then
	function ClearAchievementComparisonUnit()
		return Achievements.ClearAchievementComparisonUnit();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "ClearAchievementComparisonUnit";
end

if type(_G.GetComparisonAchievementPoints) ~= "function" then
	function GetComparisonAchievementPoints()
		return Achievements.GetComparisonAchievementPoints();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetComparisonAchievementPoints";
end

if type(_G.GetAchievementComparisonInfo) ~= "function" then
	function GetAchievementComparisonInfo(achievementID)
		return Achievements.GetAchievementComparisonInfo(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetAchievementComparisonInfo";
end

if type(_G.GetComparisonCategoryNumAchievements) ~= "function" then
	function GetComparisonCategoryNumAchievements(categoryID)
		return Achievements.GetComparisonCategoryNumAchievements(categoryID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetComparisonCategoryNumAchievements";
end

if type(_G.GetComparisonStatistic) ~= "function" then
	function GetComparisonStatistic(categoryOrStatisticID, index)
		return Achievements.GetComparisonStatistic(categoryOrStatisticID, index);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetComparisonStatistic";
end

if type(_G.GetAchievementGuildRep) ~= "function" then
	function GetAchievementGuildRep(achievementID)
		return Achievements.GetAchievementGuildRep(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetAchievementGuildRep";
end

if type(_G.GetGuildAchievementNumMembers) ~= "function" then
	function GetGuildAchievementNumMembers(achievementID)
		return Achievements.GetGuildAchievementNumMembers(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetGuildAchievementNumMembers";
end

if type(_G.GetGuildAchievementMembers) ~= "function" then
	function GetGuildAchievementMembers(achievementID)
		return Achievements.GetGuildAchievementMembers(achievementID);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetGuildAchievementMembers";
end

if type(_G.GetGuildAchievementMemberInfo) ~= "function" then
	function GetGuildAchievementMemberInfo(achievementID, index)
		return Achievements.GetGuildAchievementMemberInfo(achievementID, index);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "GetGuildAchievementMemberInfo";
end

if type(_G.AchievementFrame_LoadUI) ~= "function" then
	function AchievementFrame_LoadUI()
		return Achievements.AchievementFrame_LoadUI();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "AchievementFrame_LoadUI";
end

if type(_G.ToggleAchievementFrame) ~= "function" then
	function ToggleAchievementFrame(showStats)
		return Achievements.ToggleAchievementFrame(showStats);
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "ToggleAchievementFrame";
end

if type(_G.AchievementMicroButton_Update) ~= "function" then
	function AchievementMicroButton_Update()
		return Achievements.AchievementMicroButton_Update();
	end
else
	AchievementsForeverNativeAPI[#AchievementsForeverNativeAPI + 1] = "AchievementMicroButton_Update";
end

-- WatchFrame_Update / QuestWatch_Update are native on TBC and read by Blizzard's
-- protected code. Replacing the global would taint the native and break logout, so
-- append via hooksecurefunc when the native exists (taint-free). On Era, where the
-- native may be absent, fall back to defining/replacing the global.
local secureHook = rawget(_G, "hooksecurefunc");
if type(_G.WatchFrame_Update) == "function" and secureHook then
	secureHook("WatchFrame_Update", function()
		Achievements.WatchFrame_Update();
	end);
else
	local originalWatchFrame_Update = WatchFrame_Update;
	function WatchFrame_Update(...)
		if originalWatchFrame_Update then
			originalWatchFrame_Update(...);
		end

		return Achievements.WatchFrame_Update();
	end
end

if type(_G.QuestWatch_Update) == "function" and secureHook then
	secureHook("QuestWatch_Update", function()
		Achievements.WatchFrame_Update();
	end);
end
