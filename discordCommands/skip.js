const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('skip')
		.setDescription('再生中の曲をスキップします。秒数を指定することでその秒数分スキップします。')
		.addNumberOption(option =>
			option
				.setName('seconds')
				.setDescription('スキップする秒数を入力してください。')
				.setRequired(false)
		),
};
