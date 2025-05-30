import { SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('resume')
		.setDescription('音楽の再生を再開します。')
};
