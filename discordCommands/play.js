const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription('音楽の再生を開始します。')
        .addStringOption(option =>
            option
                .setName('keyword')
                .setDescription('再生する曲のキーワードもしくはURLを入力してください。')
                .setRequired(true)
        ),
};
