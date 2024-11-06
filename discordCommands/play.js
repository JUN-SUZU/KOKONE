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
        )
        .addNumberOption(option =>
            option
                .setName('starttime')
                .setDescription('再生開始時間を指定できます。必ず6秒以上の値を入力してください。')
                .setRequired(false)
        ),
};
