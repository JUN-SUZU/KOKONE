import { SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('shuffle')
		.setDescription('キューに追加された曲をシャッフルします。')
};
