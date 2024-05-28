const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('history')
		.setDescription('過去の再生履歴を表示します。')
};
