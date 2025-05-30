import { SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('repeat')
		.setDescription('再生中の曲をリピート再生します。')
        .addNumberOption(option =>
            option
                .setName('times')
                .setDescription('リピート再生する回数を入力してください。')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option
                .setName('queue')
                .setDescription('キュー全体をリピート再生しますか？')
                .setRequired(false)
        ),
};
