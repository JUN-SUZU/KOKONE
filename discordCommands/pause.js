const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pause')
		.setDescription('音楽の再生を一時停止します。\n再生を再開するには`/resume`を使用してください。')
};
