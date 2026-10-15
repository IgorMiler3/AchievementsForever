-- This file is executed at the end of addon load

function AchievementsFrameSummary_LocalizeButton (button)

end

function AF_AchievementButton_LocalizeMiniAchievement (frame)

end

function AF_AchievementButton_LocalizeProgressBar (frame)

end

function AF_AchievementButton_LocalizeMetaAchievement (frame)

end

function AF_AchievementFrame_LocalizeCriteria (frame)

end

function AF_AchievementCategoryButton_Localize(button)

end

local l10nTable = {
	deDE = {},
	enGB = {},
	enUS = {},
	esES = {},
	esMX = {},
	frFR = {},
	itIT = {},
	koKR = {},
	ptBR = {},
	ptPT = {},
	ruRU = {},
	zhCN = {},
	zhTW = {
		localize = function()
			AchievementsFrameSummary_LocalizeButton = function(button)
				button.label:SetPoint("TOP", 0, -4);
				button.description:SetPoint("TOP", 0, -27);
				button.description:SetFontObject("AchievementFont_Small");
				button.shield.points:SetPoint("CENTER", -1, 4);
			end

			AF_AchievementButton_LocalizeMiniAchievement = function(frame)
				frame.points:SetFontObject("GameFontWhite");
			end

			AF_AchievementButton_LocalizeProgressBar = function(frame)
				frame.text:SetPoint("TOP", 0, 1);
			end

			AF_AchievementButton_LocalizeMetaAchievement = function(frame)
				frame.label:SetFontObject("AchievementFont_Small");
			end

			AF_AchievementFrame_LocalizeCriteria = function(frame)
				frame.name:SetFontObject("AchievementFont_Small");
			end

			AF_AchievementButton_Localize = function(button)
				button.description:SetFontObject("AchievementFont_Small");
				button.hiddenDescription:SetFontObject("AchievementFont_Small");
				button.shield:SetPoint("TOPRIGHT", -10, 0);
			end

			AF_ACHIEVEMENTCOMPARISON_FRIENDSHIELDFONT1 = GameFontBlack;
			AF_ACHIEVEMENTCOMPARISON_FRIENDSHIELDFONT2 = GameFontBlack;

			AchievementComparisonButton_Localize = function(button)
				button.player.label:SetPoint("TOP", 0, -4);
				button.player.description:SetPoint("TOP", 0, -27);
				button.player.description:SetFontObject("AchievementFont_Small");
				button.friend.status:SetFontObject("GameFontBlack");
				button.friend.status:SetPoint("BOTTOM", 20, 4);
				button.friend.shield.points:SetFontObject("GameFontBlack");
			end

			for _, button in next, AchievementsFrameAchievementsContainer.buttons do
				AF_AchievementButton_Localize(button);
			end

			for _, button in next, AchievementsFrameComparisonContainer.buttons do
				AchievementComparisonButton_Localize(button);
			end
		end,
	},
};

SetupLocalization(l10nTable);
