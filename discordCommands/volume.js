const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('volume')
		.setDescription('音量を変更します。')
        .addNumberOption(option =>
            option
                .setName('volume')
                .setDescription('音量を入力してください。0<=200の範囲で指定してください。')
                .setRequired(true)
        ),
};
