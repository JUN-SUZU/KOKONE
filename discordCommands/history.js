import { SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('history')
		.setDescription('過去の再生履歴を表示します。選択した曲を再生することもできます。')
};
