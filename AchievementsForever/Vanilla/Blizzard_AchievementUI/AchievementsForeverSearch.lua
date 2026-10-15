-- AchievementsForeverSearch.lua
-- Forever additions to the bundled achievement window:
--   * a search box in the top-right corner that lists matching achievements
--     and jumps to the one you click,
--   * a per-character header title ("Achievement Points" instead of the
--     client's "Account Achievement Points").
-- Created in Lua on first show so the upstream XML stays untouched.

local Achievements = _G.AchievementsForever;
if not Achievements then
	error("AchievementsForever: Achievements.lua must load before AchievementsForeverSearch.lua");
end

local MAX_RESULTS = 10;
local RESULT_HEIGHT = 36;
local RESULTS_WIDTH = 320;

local HEADER_TITLE = {
	enUS = "Achievement Points",
	enGB = "Achievement Points",
	deDE = "Erfolgspunkte",
	frFR = "Points de hauts faits",
	esES = "Puntos de logro",
	esMX = "Puntos de logro",
	itIT = "Punti impresa",
	ptBR = "Pontos de conquista",
	ruRU = "Очки достижений",
	koKR = "업적 점수",
	zhCN = "成就点数",
	zhTW = "成就點數",
};

local SEARCH_INSTRUCTIONS = {
	enUS = "Search achievements",
	enGB = "Search achievements",
	deDE = "Erfolge durchsuchen",
	frFR = "Rechercher des hauts faits",
	esES = "Buscar logros",
	esMX = "Buscar logros",
	itIT = "Cerca imprese",
	ptBR = "Buscar conquistas",
	ruRU = "Поиск достижений",
	koKR = "업적 검색",
	zhCN = "搜索成就",
	zhTW = "搜尋成就",
};

local function Localized(table)
	return table[GetLocale()] or table.enUS;
end

local searchBox, resultsFrame;
local resultButtons = {};
local searchIndex;

-- Every achievement the window itself would list, so hidden ones stay hidden.
local function BuildSearchIndex()
	local index = {};
	local seen = {};
	for _, categoryID in ipairs(Achievements.GetCategoryList() or {}) do
		local count = Achievements.GetCategoryNumAchievements(categoryID) or 0;
		for i = 1, count do
			local id, name = Achievements.GetAchievementInfo(categoryID, i);
			if id and name and not seen[id] then
				seen[id] = true;
				index[#index + 1] = { id = id, name = name, key = string.lower(name) };
			end
		end
	end
	table.sort(index, function(a, b) return a.key < b.key; end);
	return index;
end

local function FindMatches(query)
	searchIndex = searchIndex or BuildSearchIndex();
	local prefix, inner = {}, {};
	for _, entry in ipairs(searchIndex) do
		local at = string.find(entry.key, query, 1, true);
		if at == 1 then
			prefix[#prefix + 1] = entry;
		elseif at then
			inner[#inner + 1] = entry;
		end
	end
	for _, entry in ipairs(inner) do
		prefix[#prefix + 1] = entry;
	end
	return prefix;
end

local function HideResults()
	if resultsFrame then
		resultsFrame:Hide();
	end
end

local function SelectResult(button)
	if not button.achievementID then
		return;
	end
	HideResults();
	searchBox:ClearFocus();
	AF_AchievementFrame_SelectAchievement(button.achievementID, true);
end

local function CreateResultButton(i)
	local button = CreateFrame("Button", "AchievementsFrameSearchResult" .. i, resultsFrame);
	button:SetSize(RESULTS_WIDTH - 16, RESULT_HEIGHT);
	button:SetPoint("TOPLEFT", resultsFrame, "TOPLEFT", 8, -8 - (i - 1) * RESULT_HEIGHT);

	local highlight = button:CreateTexture(nil, "HIGHLIGHT");
	highlight:SetAllPoints();
	highlight:SetColorTexture(1, 1, 1, 0.12);

	button.icon = button:CreateTexture(nil, "ARTWORK");
	button.icon:SetSize(28, 28);
	button.icon:SetPoint("LEFT", 2, 0);

	button.name = button:CreateFontString(nil, "ARTWORK", "GameFontNormal");
	button.name:SetPoint("TOPLEFT", button.icon, "TOPRIGHT", 8, -1);
	button.name:SetPoint("RIGHT", button, "RIGHT", -44, 0);
	button.name:SetJustifyH("LEFT");
	button.name:SetWordWrap(false);

	button.status = button:CreateFontString(nil, "ARTWORK", "GameFontHighlightSmall");
	button.status:SetPoint("BOTTOMLEFT", button.icon, "BOTTOMRIGHT", 8, 1);
	button.status:SetPoint("RIGHT", button, "RIGHT", -44, 0);
	button.status:SetJustifyH("LEFT");

	button.points = button:CreateFontString(nil, "ARTWORK", "GameFontNormal");
	button.points:SetPoint("RIGHT", -6, 0);

	button:SetScript("OnClick", SelectResult);
	return button;
end

local function ShowResults(matches)
	if #matches == 0 then
		HideResults();
		return;
	end

	local shown = math.min(#matches, MAX_RESULTS);
	for i = 1, MAX_RESULTS do
		local button = resultButtons[i];
		if not button then
			button = CreateResultButton(i);
			resultButtons[i] = button;
		end
		local entry = matches[i];
		if i <= shown and entry then
			local _, name, points, completed, month, day, year, _, _, icon = Achievements.GetAchievementInfo(entry.id);
			button.achievementID = entry.id;
			button.name:SetText(name or entry.name);
			button.icon:SetTexture(icon or "Interface\\Icons\\INV_Misc_QuestionMark");
			button.points:SetText(points and points > 0 and tostring(points) or "");
			if completed then
				button.status:SetText((month and day and year) and string.format("%d/%d/%d", month, day, year) or "");
				button.name:SetFontObject("GameFontNormal");
			else
				button.status:SetText("");
				button.name:SetFontObject("GameFontDisable");
			end
			button:Show();
		else
			button.achievementID = nil;
			button:Hide();
		end
	end

	resultsFrame.more:SetText(#matches > shown and string.format("+%d", #matches - shown) or "");
	resultsFrame:SetHeight(16 + shown * RESULT_HEIGHT + (#matches > shown and 14 or 0));
	resultsFrame:Show();
end

local function OnSearchTextChanged(self)
	local text = string.lower(string.trim(self:GetText() or ""));
	if string.len(text) < 2 then
		HideResults();
		return;
	end
	ShowResults(FindMatches(text));
end

local function CreateSearchUI()
	-- The header row has no free space (the points plaque is centred and the
	-- filter dropdown takes the right end), so the box lives at the bottom of
	-- the category column, in the empty parchment area, on every tab.
	local column = AchievementsFrameCategories or AchievementsFrame;
	searchBox = CreateFrame("EditBox", "AchievementsFrameSearchBox", column, "SearchBoxTemplate");
	searchBox:SetSize(math.max(120, (column:GetWidth() or 175) - 22), 20);
	searchBox:SetPoint("BOTTOMLEFT", column, "BOTTOMLEFT", 14, 10);
	searchBox:SetFrameLevel(column:GetFrameLevel() + 5);
	searchBox:SetAutoFocus(false);
	-- opaque background behind the template's translucent border art
	local bg = searchBox:CreateTexture(nil, "BACKGROUND", nil, -1);
	bg:SetPoint("TOPLEFT", -4, 2);
	bg:SetPoint("BOTTOMRIGHT", 2, -2);
	bg:SetColorTexture(0.05, 0.04, 0.03, 0.95);
	if searchBox.Instructions then
		searchBox.Instructions:SetText(Localized(SEARCH_INSTRUCTIONS));
	end
	searchBox:HookScript("OnTextChanged", OnSearchTextChanged);
	searchBox:HookScript("OnEscapePressed", function(self)
		self:SetText("");
		self:ClearFocus();
		HideResults();
	end);
	searchBox:HookScript("OnEnterPressed", function(self)
		local first = resultButtons[1];
		if resultsFrame:IsShown() and first and first.achievementID then
			SelectResult(first);
		end
	end);

	resultsFrame = CreateFrame("Frame", "AchievementsFrameSearchResults", AchievementsFrame, "TooltipBackdropTemplate");
	resultsFrame:SetSize(RESULTS_WIDTH, 100);
	-- pops out to the right of the box, over the achievement list, growing upward
	resultsFrame:SetPoint("BOTTOMLEFT", searchBox, "BOTTOMRIGHT", 12, -6);
	resultsFrame:SetFrameStrata("DIALOG");
	resultsFrame:EnableMouse(true);
	resultsFrame:Hide();
	resultsFrame.more = resultsFrame:CreateFontString(nil, "ARTWORK", "GameFontDisableSmall");
	resultsFrame.more:SetPoint("BOTTOMRIGHT", -10, 6);

	AchievementsFrame:HookScript("OnHide", function()
		HideResults();
		searchBox:ClearFocus();
	end);
	AchievementsFrame:HookScript("OnShow", function()
		searchIndex = nil;
	end);

	-- The box stays on every tab; only the open results list is dropped when
	-- the page changes.
	for _, frame in ipairs({ AchievementsFrameSummary, AchievementsFrameAchievements, AchievementsFrameStats, AchievementsFrameComparison }) do
		if frame then
			frame:HookScript("OnShow", HideResults);
		end
	end
end

local function ApplyHeaderTitle()
	if AchievementsFrameHeaderTitle then
		AchievementsFrameHeaderTitle:SetText(Localized(HEADER_TITLE));
	end
end

local initFrame = CreateFrame("Frame");
initFrame:RegisterEvent("PLAYER_LOGIN");
initFrame:SetScript("OnEvent", function(self)
	self:UnregisterAllEvents();
	if not AchievementsFrame then
		return;
	end
	ApplyHeaderTitle();
	local ok, err = pcall(CreateSearchUI);
	if not ok then
		print("|cff33ccffAchievements Forever|r search box failed to initialise: " .. tostring(err));
	end
end);
