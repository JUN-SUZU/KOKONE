import { SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('コマンドの一覧を表示します。')
};
