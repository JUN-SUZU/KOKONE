const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('queue')
		.setDescription('キューに追加された曲を表示します。')
};
