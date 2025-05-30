import { SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('skip')
		.setDescription('再生中の曲をスキップします。')
};
