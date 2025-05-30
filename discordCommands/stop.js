import { SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('stop')
		.setDescription('音楽の再生を停止します。')
};
