const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('speech')
		.setDescription('OK Google の後に続けて曲名を言うと、その曲を再生します。※この機能は実験的なものです。')
};
