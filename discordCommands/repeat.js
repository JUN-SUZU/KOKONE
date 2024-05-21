const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('repeat')
		.setDescription('再生中の曲をリピート再生します。')
        .addNumberOption(option =>
            option
                .setName('times')
                .setDescription('リピート再生する回数を入力してください。')
                .setRequired(true)
        ),
};
