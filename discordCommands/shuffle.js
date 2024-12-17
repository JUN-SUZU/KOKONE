const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shuffle')
		.setDescription('キューに追加された曲をシャッフルします。')
};
