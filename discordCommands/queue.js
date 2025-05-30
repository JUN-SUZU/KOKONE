import { SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('queue')
		.setDescription('キューに追加された曲を表示します。')
};
