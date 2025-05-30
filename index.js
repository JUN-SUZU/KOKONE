import { readFileSync, existsSync } from 'fs';
const config = JSON.parse(readFileSync('./config.json', 'utf8'));
process.title = 'KOKONE';

// database
import DB from './db.js';
const db = new DB();

// discord.js
import {
    ActionRowBuilder, ActivityType, ChannelType, Client, Collection,
    EmbedBuilder, Events, GatewayIntentBits, Partials, PermissionsBitField,
    StringSelectMenuBuilder, ThreadAutoArchiveDuration
} from 'discord.js';
import {
    entersState, AudioPlayerStatus, AudioReceiveStream, createAudioPlayer, createAudioResource, EndBehaviorType,
    joinVoiceChannel, getVoiceConnection, NoSubscriberBehavior, StreamType
} from '@discordjs/voice';

// search on youtube
import youtubeNode from 'youtube-node';
const youtube = new youtubeNode();
youtube.setKey(config.youtubeApiKey);
youtube.addParam('type', 'video');

// deploy from youtube playlist
import ytpl from 'ytpl';

// download from youtube
import ytdl from '@distube/ytdl-core';
import { Innertube, UniversalCache, Utils } from 'youtubei.js';

// dashboard
import http from 'http';
import WebSocket from 'ws';

// other modules
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { on } from 'events';
import { type } from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';

const baseColor = '#ff207d';

// __dirname の代替
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages
    ],
    partials: [
        Partials.Message,
        Partials.Channel
    ]
});

client.isSkip = new Collection();
let searchCache = JSON.parse(fs.readFileSync('./searchCache.json', 'utf8'));
let playingTime = {};
const wsConnections = {};

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('音楽', { type: ActivityType.Listening });
});

client.on('guildCreate', async (guild) => {
    console.log(`Joined guild: ${guild.name}`);
    registerSlashCommands(guild);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.guildId || message.author.id !== '704668240030466088') return;
    const args = message.content.split(' ');
    if (args[0] !== 'kokone') return;
    if (args[1] === 'recovery') {
        if (args[2] === 'command') {
            guildId = args[3];
            if (guildId === 'all') {
                client.guilds.cache.forEach(guild => {
                    registerSlashCommands(guild);
                });
                message.reply('Command registration completed in all servers.\n全てのサーバーでコマンドの登録が完了しました。');
            }
            else {
                registerSlashCommands(client.guilds.cache.get(guildId));
                message.reply('Command registration completed.\nコマンドの登録が完了しました。');
            }
        }
    }
    else if (args[1] === 'show') {
        // if (args[2] === 'guilds'){
        //     await client.guilds.fetch();
        //     let guilds = client.guilds.cache.map(guild => guild.name);
        //     message.reply(`\`\`\`${guilds.join('\n')}\`\`\``);
        // }
    }
    else if (args[1] === 'global') {
        if (args[2] === 'notice') {
            // 全てのサーバーで通知
            client.guilds.cache.forEach(async (guild) => {
                try {
                    if (guild.systemChannel && guild.systemChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.SendMessages)) {
                        await guild.systemChannel.send('This is a global notice.\nこれはグローバル通知です。' + message.content.slice(20));
                    }
                }
                catch (error) {
                    console.log(`Error has occurred while sending global notice: ${guild.name}(ID: ${guild.id})`);
                    console.log(error);
                }
            });
        }
    }
});

function registerSlashCommands(guild) {
    const commandFiles = fs.readdirSync(path.join(__dirname, './discordCommands')).filter(file => file.endsWith('.js'));
    async function registerCommands(file) {
        const command = (await import(`./discordCommands/${file}`)).default;
        if (!command.data) return;
        try {
            await guild.commands.create(command.data);
            console.log(`Registered command: ${command.data.name}`);
        } catch (error) {
            console.error(`Error registering command ${command.data.name}:`, error);
        }
    }
    const commandPromises = commandFiles.map(registerCommands);
    Promise.all(commandPromises)
        .then(() => {
            console.log(`All commands registered in ${guild.name}`);
        })
        .catch(error => {
            console.error(`Error registering commands in ${guild.name}:`, error);
        });
    console.log(`Command registration completed in ${guild.name}`);
}

client.on('interactionCreate', async (interaction) => {
    let log = `Interaction: ${interaction.user.tag} in #${interaction.channel.name} (${interaction.channel.id}) triggered an interaction.\n`
        + `TimeStamp: ${new Date().toLocaleString()}\n`
        + `Guild: ${interaction.guild.name} (${interaction.guild.id})\n`;
    try {
        if (interaction.isChatInputCommand()) {
            const commandName = interaction.commandName;
            log += `Command: ${commandName}\n`
                + `Options: ${interaction.options.data.map(option => `${option.name}: ${option.value}`).join(', ')}\n`;
            fs.appendFileSync('./log.txt', log, 'utf8');
            // get permission of the text channel
            const permissions = interaction.channel.permissionsFor(client.user);
            if (!permissions ||
                !permissions.has(PermissionsBitField.Flags.SendMessages) ||
                !permissions.has(PermissionsBitField.Flags.ViewChannel) ||
                !permissions.has(PermissionsBitField.Flags.EmbedLinks) ||
                !permissions.has(PermissionsBitField.Flags.AttachFiles)) {
                return await interaction.reply({
                    content: 'I don\'t have permission to send messages in this channel.\nこのチャンネルでメッセージを送信する権限がありません。',
                    ephemeral: true
                });
            }
            if (commandName === 'play') {
                // get voice channel
                const voiceChannel = interaction.member.voice.channel;
                if (!voiceChannel) {
                    return await interaction.reply({
                        content: 'You need to be in a voice channel to play music!\nあなたは音声チャンネルに参加している必要があります。',
                        ephemeral: true
                    });
                }
                const voiceChannelPermissions = voiceChannel.permissionsFor(client.user);
                if (!voiceChannelPermissions.has(PermissionsBitField.Flags.Connect) ||
                    !voiceChannelPermissions.has(PermissionsBitField.Flags.Speak) ||
                    !voiceChannelPermissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    return await interaction.reply({
                        content: 'I don\'t have permission to join or speak in this channel.\nこのチャンネルに参加または発言する権限がありません。',
                        ephemeral: true
                    });
                }
                await interaction.deferReply({ ephemeral: true });
                // search video id
                const keyword = interaction.options.getString('keyword');
                let query = keyword.replace(/"/g, '');
                // if (config.streamMode === "LavaLink") {
                //     interaction.editReply({
                //         content: 'Now, this bot is under maintenance.\n現在、このボットはメンテナンス中です。\n start playing on restricted mode.\n制限モードで再生を開始します。',
                //         ephemeral: true
                //     });
                //     const tracks = await rest.loadTracks('ytsearch:' + keyword);
                //     if (!tracks) {
                //         return interaction.editReply({
                //             content: 'The music could not be found.\n曲が見つかりませんでした。\nNow, this bot supports ' + config.mediaSources.join(', ') + '.'
                //                 + 'Please try again with a different keyword.\n別のキーワードで再度お試しください。',
                //             ephemeral: true
                //         });
                //     }
                //     try {
                //         joinVoiceChannel({
                //             channelId: voiceChannel.id,
                //             guildId: interaction.guild.id,
                //             adapterCreator: interaction.guild.voiceAdapterCreator,
                //             selfDeaf: false,
                //             selfMute: false,
                //             timeout: 10 * 1000
                //         });
                //         const track = tracks.data[0];
                //         // const volume = await db.guilds.volume.get(interaction.guild.id);
                //         const volume = 20;
                //         setTimeout(() => {
                //             rest.updatePlayer(interaction.guild.id, {
                //                 track: track,
                //                 position: 0,
                //                 volume: Math.round(volume),
                //                 paused: false,
                //                 voice: VoiceState[interaction.guild.id]
                //             });
                //         }, 2000);
                //     } catch (error) {
                //         console.log(error);
                //     }
                //     return interaction.editReply({
                //         content: 'Now playing with restricted mode.\n制限モードで再生を開始します。\n試験的に新しいモジュールを使用しているため、playコマンド以外の機能は使用できません。',
                //         ephemeral: true
                //     });
                // }
                if (query.match(/^(https?:\/\/)?((music|www)\.)?youtube\.com\/watch(\/\?|\?)v=([a-zA-Z0-9_-]{11})/) ||
                    query.match(/^(https?:\/\/)?((music|www)\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
                    query.match(/^(https?:\/\/)?((music|www)\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)) {
                    let videoId = ytdl.getVideoID(query);
                    if (!videoId) {
                        return interaction.editReply({
                            content: 'Invalid URL.\nURLが無効です。',
                            ephemeral: true
                        });
                    }
                    else if (!await addVideoCache(videoId)) {
                        return interaction.editReply({
                            content: 'The music could not be found.\n曲が見つかりませんでした。',
                            ephemeral: true
                        });
                    }
                    // add to queue
                    const queue = await db.guilds.queue.get(interaction.guild.id);
                    const queueData = { videoId: videoId, messageChannel: interaction.channelId, user: interaction.member.user.username };
                    queue.push(queueData);
                    await db.guilds.queue.set(interaction.guild.id, queue);
                    if (getVoiceConnection(interaction.guild.id)) {
                        return interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(`${interaction.member.user.username} added to queue.\nキューに追加されました。`)
                                    .setImage(`https://img.youtube.com/vi/${videoId}/default.jpg`)
                                    .setColor(baseColor)
                            ],
                            ephemeral: true
                        });
                    }
                    joinAndReply(interaction);
                }
                // https://music.youtube.com/playlist?list=RDCLAK5uy_lQtAkCG1Gb8Dkx8lCMFTF-WhrX2rTzTAk
                // listidの長さはそれぞれ異なるので、list以降を全て取得し、&があれば&より前を取得
                else if (query.match(/^(https?:\/\/)?((music|www)\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/)) {
                    let playListId = query.match(/list=([a-zA-Z0-9_-]+)/)[1].split('&')[0];
                    let playList = await ytpl(playListId);
                    // add to queue
                    let queue = await db.guilds.queue.get(interaction.guild.id);
                    const videoCachePromises = playList.items.map(item => {
                        queue.push({
                            videoId: item.id,
                            messageChannel: interaction.channelId,
                            user: interaction.member.user.username
                        });
                        return db.videoCache.set(item.id, item.title, item.author.name);
                    });
                    await Promise.all(videoCachePromises);
                    await db.guilds.queue.set(interaction.guild.id, queue);
                    if (getVoiceConnection(interaction.guild.id)) {
                        return interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(`${interaction.member.user.username} added playlist to queue.\nキューにプレイリストが追加されました。`)
                                    .setImage(`https://img.youtube.com/vi/${playList.items[0].id}/default.jpg`)
                                    .setColor(baseColor)
                            ],
                            ephemeral: true
                        });
                    }
                    joinAndReply(interaction);
                }
                else if (searchCache[query]) createSelectMenu(interaction, searchCache[query]);
                else {
                    // 検索
                    youtube.search(query, 4, async function (error, result) {
                        if (error) {
                            console.log(`error has occurred while searching: ${keyword}`);
                            interaction.editReply({
                                content: 'An error has occurred while searching.\n検索中にエラーが発生しました。\nPlease try again with a different keyword.\n別のキーワードで再度お試しください。',
                                ephemeral: true
                            });
                        }
                        else if (result.items.length == 0) {
                            console.log(`no music found: ${keyword}`);
                            interaction.editReply({
                                content: 'No music found.\n曲が見つかりませんでした。',
                                ephemeral: true
                            });
                        }
                        else {
                            result.items = result.items.filter(item => item.id.kind == "youtube#video");
                            let options = [];
                            for (let i = 0; i < result.items.length && i < 6; i++) {
                                options.push(
                                    { label: result.items[i].snippet.title, description: result.items[i].snippet.channelTitle, value: result.items[i].id.videoId }
                                );
                                await db.videoCache.set(result.items[i].id.videoId, result.items[i].snippet.title, result.items[i].snippet.channelTitle);
                            }
                            searchCache[query] = options;
                            createSelectMenu(interaction, options);
                        }
                    });
                }
            }
            else if (commandName === 'stop') {
                const connection = getVoiceConnection(interaction.guild.id);
                if (connection) connection.destroy();
                await db.guilds.queue.set(interaction.guild.id, []);
                await interaction.reply('Stopped playing music.\n音楽の再生を停止しました。');
            }
            else if (commandName === 'skip') {
                if (!onPlaying(interaction.guild.id)) {
                    return await interaction.reply({
                        content: 'No music is playing.\n音楽が再生されていません。',
                        ephemeral: true
                    });
                }
                const player = getVoiceConnection(interaction.guild.id).state.subscription.player;
                if (player.state.status === AudioPlayerStatus.Paused) player.unpause();
                player.stop();
                await interaction.reply('Skipped the current song.\n現在の曲をスキップしました。');
            }
            else if (commandName === 'repeat') {
                let repeatTimes = interaction.options.getNumber('times');
                let queueAll = interaction.options.getBoolean('queue');
                if (repeatTimes < 1) {
                    return await interaction.reply({
                        content: 'The number of times must be at least 1.\n回数は少なくとも1回である必要があります。',
                        ephemeral: true
                    });
                }
                if (repeatTimes > 1000) repeatTimes = 1000;
                const queue = await db.guilds.queue.get(interaction.guild.id);
                let musictoRepeat;
                let musicstoRepeat;
                if (!queue.length) {
                    const history = await db.guilds.history.get(interaction.guild.id);
                    if (!history.length) {
                        return await interaction.reply({
                            content: 'No music has been played even once.\n一度も音楽が再生されていません。',
                            ephemeral: true
                        });
                    }
                    const lastMusic = history[history.length - 1];
                    musictoRepeat = { videoId: lastMusic, messageChannel: interaction.channelId };
                    queueAll = false;
                }
                else if (queueAll) {
                    musicstoRepeat = [...queue];
                    musicstoRepeat.forEach(music => {
                        music.user = interaction.member.user.username;
                    });
                }
                else {
                    musictoRepeat = queue[0];
                }
                if (!queueAll) musictoRepeat.user = interaction.member.user.username;
                for (let i = 0; i < repeatTimes; i++) {
                    if (queueAll) {
                        queue.push(...musicstoRepeat);
                    }
                    else {
                        queue.unshift(musictoRepeat);
                    }
                }
                await db.guilds.queue.set(interaction.guild.id, queue);
                if (onPlaying(interaction.guild.id)) {
                    await interaction.reply(`Set to repeat ${repeatTimes} times.\n${repeatTimes}回リピートするように設定しました。${repeatTimes == 1000 ? '（上限）' : ''}`);
                }
                else {
                    await interaction.reply(`Set to encore ${repeatTimes} times.\n${repeatTimes}回アンコールするように設定しました。${repeatTimes == 1000 ? '（上限）' : ''}`);
                    joinAndReply(interaction);
                }
            }
            else if (commandName === 'volume') {
                const volume = interaction.options.getNumber('volume');
                if (volume <= 0 || volume > 200) {
                    return await interaction.reply({
                        content: '音量は0より大きく200以下である必要があります。\nVolume must be greater than 0 and less than or equal to 100.',
                        ephemeral: true
                    });
                }
                await interaction.reply(`Volume set to ${volume}%.\n音量を${volume}%に設定しました。`);
                if (onPlaying(interaction.guild.id)) {
                    const resource = getVoiceConnection(interaction.guild.id).state.subscription.player.state.resource;
                    let currentVolume = await db.guilds.volume.get(interaction.guild.id);
                    while (currentVolume != volume) {
                        let diff = volume - currentVolume > 5 ? 5 : volume - currentVolume < -5 ? -5 : volume - currentVolume;
                        currentVolume += diff;
                        if (currentVolume - volume > -0.5 && currentVolume - volume < 0.5) currentVolume = volume;
                        resource.volume.setVolume(currentVolume / 100);
                        await wait(200);
                    }
                }
                db.guilds.volume.set(interaction.guild.id, volume);
            }
            else if (commandName === 'history') {
                const history = await db.guilds.history.get(interaction.guild.id);
                if (!history || history.length == 0) {
                    return await interaction.reply({
                        content: 'No music history.\n音楽の履歴がありません。',
                        ephemeral: true
                    });
                }
                let embed = new EmbedBuilder()
                    .setTitle('Music history\n音楽の履歴')
                    .setDescription('List of the last 10 songs played.\n最後10回に再生された曲のリストです。\n' +
                        'Please press the button to play the song.\n曲を再生するにはボタンを押してください。')
                    .setColor(baseColor);
                for (let i = 0; i < history.length; i++) {
                    const cacheData = await db.videoCache.get(history[i]);
                    embed.addFields({ name: `No.${i + 1}`, value: `[${cacheData.video_title}](https://www.youtube.com/watch?v=${history[i]})\nby ${cacheData.channel_title}` });
                }
                // add button
                const options = [];
                for (let i = 0; i < history.length; i++) {
                    options.push({ label: `No.${i + 1}`, value: history[i] });
                }
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('musicSelect')
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(...options);
                const row = new ActionRowBuilder().addComponents(selectMenu);
                await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }
            else if (commandName === 'queue') {
                const queue = await db.guilds.queue.get(interaction.guild.id);
                if (!queue.length) {
                    return await interaction.reply({
                        content: 'No music in the queue.\nキューに音楽がありません。',
                        ephemeral: true
                    });
                }
                let embed = new EmbedBuilder()
                    .setTitle('Music queue\n音楽のキュー')
                    .setDescription('List of songs in the queue.\nキューに入っている曲のリストです。')
                    .setColor(baseColor);
                let size = queue.length > 10 ? 10 : queue.length;
                for (let i = 0; i < size; i++) {
                    const cacheData = await db.videoCache.get(queue[i].videoId);
                    embed.addFields({ name: `No.${i + 1}`, value: `[${cacheData.video_title}](https://www.youtube.com/watch?v=${queue[i].videoId})\nby ${cacheData.channel_title}` });
                }
                if (queue.length > 10) {
                    // embed.setFooter(`There are ${queue.length - 10} more songs in the queue.\nキューにはあと${queue.length - 10}曲あります。`);
                    embed.setFooter({ text: `There are ${queue.length - 10} more songs in the queue.\nキューにはあと${queue.length - 10}曲あります。` });
                }
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
            else if (commandName === 'pause') {
                const connection = getVoiceConnection(interaction.guild.id);
                if (!onPlaying(interaction.guild.id)) {
                    return await interaction.reply({
                        content: 'No music is playing.\n音楽が再生されていません。',
                        ephemeral: true
                    });
                }
                const player = connection.state.subscription.player;
                player.pause();
                playingTime[interaction.guild.id].totalPlayedTime += Date.now() - playingTime[interaction.guild.id].playStartTime;
                playingTime[interaction.guild.id].playStartTime = null;
                await interaction.reply('Paused the music.\n音楽を一時停止しました。');
            }
            else if (commandName === 'resume') {
                const connection = getVoiceConnection(interaction.guild.id);
                if (!onPlaying(interaction.guild.id)) {
                    return await interaction.reply({
                        content: 'No music is playing.\n音楽が再生されていません。',
                        ephemeral: true
                    });
                }
                const player = connection.state.subscription.player;
                player.unpause();
                playingTime[interaction.guild.id].playStartTime = Date.now();
                await interaction.reply('Resumed the music.\n音楽を再開しました。');
            }
            else if (commandName === 'shuffle') {
                const queue = await db.guilds.queue.get(interaction.guild.id);
                if (queue.length < 2) {
                    return await interaction.reply({
                        content: 'There are no music in the queue or only one music.\nキューに音楽がないか、1曲しかありません。',
                        ephemeral: true
                    });
                }
                const playingMusic = queue.shift();
                let shuffledQueue = [playingMusic];
                const queueLength = queue.length;
                for (let i = 0; i < queueLength; i++) {
                    const randomIndex = Math.floor(Math.random() * queue.length);
                    shuffledQueue.push(queue[randomIndex]);
                    queue.splice(randomIndex, 1);
                }
                await db.guilds.queue.set(interaction.guild.id, shuffledQueue);
                await interaction.reply('Shuffled the queue.\nキューをシャッフルしました。');
            }
            else if (commandName === 'help') {
                const commandDescriptions = [
                    { name: 'play', description: '指定した曲を再生します。' },
                    { name: 'pause', description: '音楽の再生を一時停止します。\n再生を再開するには`/resume`を使用してください。' },
                    { name: 'resume', description: '音楽の再生を再開します。' },
                    { name: 'skip', description: '再生中の曲をスキップします。' },
                    { name: 'stop', description: '音楽の再生を停止します。' },
                    { name: 'queue', description: '再生予定の曲を表示します。' },
                    { name: 'repeat', description: '再生中の曲をリピートします。' },
                    { name: 'history', description: '再生履歴を表示します。' },
                    { name: 'volume', description: '音量を調整します。' },
                    { name: 'shuffle', description: 'キューに追加された曲をシャッフルします。' },
                    { name: 'help', description: 'コマンドの一覧を表示します。' }
                ];
                const embed = new EmbedBuilder()
                    .setTitle('Help\nヘルプ')
                    .setDescription('Commands that can be used with Kokone.\nKokoneで使用できるコマンドです。')
                    .addFields(commandDescriptions.map(command => {
                        return { name: `/${command.name}`, value: command.description };
                    }))
                    .setColor(baseColor);
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
        else if (interaction.isStringSelectMenu()) {
            const selectId = interaction.customId;
            log += `SelectMenu: ${selectId}\n`
                + `Values: ${interaction.values}\n`;
            fs.appendFileSync('./log.txt', log, 'utf8');
            if (selectId === 'musicSelect') {
                await interaction.deferReply({ ephemeral: true });
                // get voice channel
                const voiceChannel = interaction.member.voice.channel;
                if (!voiceChannel) {
                    await interaction.editReply({
                        content: 'You need to be in a voice channel to play music!\nあなたは音声チャンネルに参加している必要があります。',
                        ephemeral: true
                    });
                    return;
                }
                if (!voiceChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.Connect) ||
                    !voiceChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.Speak) ||
                    !voiceChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.ViewChannel)) {
                    await interaction.editReply({
                        content: 'I don\'t have permission to join or speak in this channel.\nこのチャンネルに参加または発言する権限がありません。',
                        ephemeral: true
                    });
                    return;
                }
                const videoId = interaction.values[0];
                // add to queue
                let queue = await db.guilds.queue.get(interaction.guild.id);
                const queueData = { videoId: videoId, messageChannel: interaction.channelId, user: interaction.member.user.username };
                queue.push(queueData);
                await db.guilds.queue.set(interaction.guild.id, queue);
                if (getVoiceConnection(interaction.guild.id)) {
                    const videoData = await db.videoCache.get(videoId);
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(`${interaction.member.user.username} added to queue.\nキューに追加されました。\n${videoData.video_title}`)
                                .setDescription(videoData.channel_title)
                                .setImage(`https://img.youtube.com/vi/${videoId}/default.jpg`)
                                .setColor(baseColor)
                        ],
                        ephemeral: true
                    });
                }
                joinAndReply(interaction);
            }
        }
    } catch (error) {
        console.log(error);
    }
});

function createSelectMenu(interaction, videoId) {
    if (videoId.length > 0) {
        // ask for video selection
        const options = videoId.map(video => {
            let LabelString = video.label;
            if (LabelString.length > 90) LabelString = LabelString.slice(0, 90) + '...';
            return { label: LabelString, description: video.description, value: video.value };
        });
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('musicSelect')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(...options);
        const row = new ActionRowBuilder().addComponents(selectMenu);
        let embed = new EmbedBuilder()
            .setTitle('Select a video to play.\n再生する曲を選択してください。')
            .setDescription('Please select a music from the list.\nリストから曲を選択してください。')
            .setColor(baseColor);
        // サムネイルを追加
        // https://img.youtube.com/vi/{videoId}/default.jpg
        embed.setThumbnail(`https://img.youtube.com/vi/${videoId[0].value}/default.jpg`);
        return interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    }
    else {
        interaction.editReply({
            content: 'Sorry, no music found for the keyword.\nキーワードに一致する曲が見つかりませんでした。' +
                'Please try again with a different keyword.\n別のキーワードで再度お試しください。',
            ephemeral: true
        });
    }
}

function joinAndReply(interaction) {
    const connection = joinVoiceChannel({
        channelId: interaction.member.voice.channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
        timeout: 10 * 1000
    });
    interaction.editReply({
        content: '再生を開始します。\nNow playing.',
        ephemeral: true
    });
    startMusic(interaction.guild.id);
}

async function startMusic(guildId) {
    const queue = await db.guilds.queue.get(guildId);
    const connection = getVoiceConnection(guildId);
    if (!queue.length) {
        db.guilds.queue.set(guildId, []);
        connection.destroy();
        return;
    }
    const { videoId, messageChannel } = queue[0];

    const channel = client.channels.cache.get(messageChannel);
    let embed = new EmbedBuilder()
        .setURL("https://www.youtube.com/watch?v=" + videoId)
        .setImage(`https://img.youtube.com/vi/${videoId}/default.jpg`)
        .setColor([233, 30, 99]);

    // https://www.google.com/search?q=+site:www.uta-net.com URLエンコード
    const videoData = await db.videoCache.get(videoId);
    let kashiURL = encodeURI(`https://www.google.com/search?q=${videoData.video_title}+Lyrics`);
    embed.setTitle(videoData.video_title);
    embed.setDescription(`再生を開始します。Now playing.\n${videoData.channel_title}\nadded by ${queue[0].user}`);
    embed.setAuthor({ name: '歌詞 Lyrics', url: kashiURL });
    channel.send({ embeds: [embed] });
    playMusic(connection, videoId, guildId);
}

async function addVideoCache(videoId) {
    const videoData = await db.videoCache.get(videoId);
    if (videoData) return true;
    try {
        // YouTube API から動画情報を取得
        const result = await new Promise((resolve, reject) => {
            youtube.getById(videoId, (error, result) => {
                if (error || result.items.length === 0) {
                    reject(error || new Error("Video not found"));
                } else {
                    resolve(result);
                }
            });
        });
        // 取得したデータをキャッシュに保存
        await db.videoCache.set(videoId, result.items[0].snippet.title, result.items[0].snippet.channelTitle);
        return true;
    } catch (error) {
        console.error(`Failed to fetch video: ${videoId}`, error);
        return false;
    }
}


async function playMusic(connection, videoId, guildId) {
    fs.writeFileSync('./searchCache.json', JSON.stringify(searchCache, null, 4), 'utf8');
    let history = await db.guilds.history.get(guildId);
    if (history.length > 10) history.shift();
    if (history.includes(videoId)) {
        history = history.filter(id => id !== videoId);
    }
    history.push(videoId);
    await db.guilds.history.set(guildId, history);
    const yt = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });

    // Fired when waiting for the user to authorize the sign in attempt.
    yt.session.on('auth-pending', (data) => {
        console.log(`Go to ${data.verification_url} in your browser and enter code ${data.user_code} to authenticate.`);
    });
    // Fired when authentication is successful.
    yt.session.on('auth', ({ credentials }) => {
        console.log('Sign in successful:', credentials);
    });

    // Sign in with OAuth2 credentials
    await yt.session.signIn();

    // You may cache the session for later use
    // If you use this, the next call to signIn won't fire 'auth-pending' instead just 'auth'.
    await yt.session.oauth.cacheCredentials();
    
    // Get the audio stream for the video
    let stream;
    try {
        stream = await yt.download(videoId, {
            type: 'audio',
            quality: 'best',
            format: 'mp4',
            client: 'TV'
        });
    } catch (error) {
        console.error(`Failed to download video: ${videoId}`, error);
        stream = fs.createReadStream('./restricted.mp3'); // play restricted.mp3 if failed to download
        return;
    }
    const musicLength = await ytdl.getBasicInfo(videoId).then(info => info.videoDetails.lengthSeconds);
    playingTime[guildId] = { totalPlayedTime: 0, playStartTime: Date.now(), musicLength: musicLength };
    const resource = createAudioResource(stream, {
        inputType: StreamType.WebmOpus,
        inlineVolume: true
    });
    const volume = await db.guilds.volume.get(guildId);
    resource.volume.setVolume(volume / 100);
    let player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);
    // await entersState(player, AudioPlayerStatus.Playing, 5 * 1000);// Playingになるまで最大5秒待ち、再生が始まらない場合はAborted
    // await entersState(player, AudioPlayerStatus.Idle, 24 * 60 * 60 * 1000);// 再生開始から24時間待ち、再生が終わらない場合はAborted
    player.on(AudioPlayerStatus.Idle, async () => {
        try {
            if (client.isSkip.get(guildId)) return client.isSkip.delete(guildId);
            let queue = await db.guilds.queue.get(guildId);
            queue.shift();
            delete playingTime[guildId];
            if (queue.length) {
                await db.guilds.queue.set(guildId, queue);
                await wait(2000);// 余韻のために2秒待つ
                startMusic(guildId);
            }
            else {
                await db.guilds.queue.set(guildId, []);
                connection.destroy();
            }
        } catch (error) {
            console.log(error);
        }
    });
    player.on('error', error => {
        console.log(error);
        db.guilds.queue.set(guildId, []);
        connection.destroy();
        return;
    });
}

function onPlaying(guildId) {
    try {
        const connection = getVoiceConnection(guildId);
        if (connection && connection.state.subscription && connection.state.subscription.player) return true;
        else return false;
    }
    catch (error) {
        return false;
    }
}

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channelId === null && oldState.member.user.id === client.user.id) {
        const queue = await db.guilds.queue.get(oldState.guild.id);
        if (queue) {
            db.guilds.queue.set(oldState.guild.id, []);
            if (onPlaying(oldState.guild.id)) getVoiceConnection(oldState.guild.id).state.subscription.player.stop();
            getVoiceConnection(oldState.guild.id)?.destroy();
        }
    }
});
//     if (newState.id === client.user.id) {
//         const sessionId = newState.sessionId;
//         if (sessionId) {
//             VoiceState[newState.guild.id] = VoiceState[newState.guild.id] || {};
//             VoiceState[newState.guild.id].sessionId = sessionId;
//         }
//     }
// });

// client.on('raw', async (packet) => {
//     if (packet.t === 'VOICE_SERVER_UPDATE') {
//         const { token, guild_id, endpoint } = packet.d;
//         console.log('token: ', token);
//         if (token && guild_id && endpoint) {
//             VoiceState[guild_id] = VoiceState[guild_id] || {};
//             VoiceState[guild_id].token = token;
//             VoiceState[guild_id].endpoint = endpoint;
//     }
// }

cron.schedule('*/10 * * * *', () => {
    client.isSkip = client.isSkip.clone();
});


const server = http.createServer((req, res) => {
    function getIPAddress(req) {
        if (req.headers['x-forwarded-for']) {
            return req.headers['x-forwarded-for'].split(/\s*,\s*/)[0];
        } else if (req.connection.remoteAddress) {
            return req.connection.remoteAddress;
        } else {
            return req.socket.remoteAddress;
        }
    }
    const url = req.url.replace(/\?.*$/, ''), method = req.method, ipadr = getIPAddress(req), now = new Date().toLocaleString();
    fs.appendFileSync('./log.txt', `${now} ${method} ${url} ${ipadr}\n`, 'utf8');
    if (method != 'POST') return;
    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });
    req.on('end', async () => {
        if (url === '/auth/api/') {
            const { userID, kokoneToken } = parseCookies(req);
            if (!userID || !kokoneToken) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ result: 'fail' }));
                return;
            }
            const user = await db.clients.get(userID);
            if (user && user.token === kokoneToken) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ result: 'success', username: user.username, globalName: user.globalName, avatar: user.avatar }));
            }
            else {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ result: 'fail' }));
            }
        }
        else {
            try {
                const data = JSON.parse(body);
                if (url === '/login/api/') {
                    const oauth2TokenOptions = {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            client_id: config.clientID,
                            client_secret: config.clientSecret,
                            grant_type: 'authorization_code',
                            code: data.code,
                            redirect_uri: config.url + '/login/',
                            scope: 'identify guilds'
                        })
                    };
                    const oauth2TokenResponse = await fetch('https://discord.com/api/oauth2/token', oauth2TokenOptions).then(res => res.json());
                    /*
                    {
                        token_type: 'Bearer',
                        access_token: '...',
                        expires_in: 604800,
                        refresh_token: '...',
                        scope: 'identify guilds'
                    }
                    */
                    if (!oauth2TokenResponse.access_token) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ result: 'fail' }));
                        return;
                    }
                    const userDataResponse = await fetch('https://discord.com/api/users/@me', {
                        headers: {
                            Authorization: `Bearer ${oauth2TokenResponse.access_token}`
                        }
                    }).then(res => res.json());
                    /*
                    https://discord.com/developers/docs/resources/user#user-object
                    {
                        id: '...',
                        username: '...',
                        avatar: '...',
                        discriminator: '...', \\ 新しいアカウントはユーザー名のみで、0
                        public_flags: DDDDDDD,
                        flags: DDDDDDDD, \\ public_flags と同じ
                        banner: '...',
                        accent_color: DDDDDDD,
                        global_name: '...',
                        avatar_decoration_data: {
                            asset: '...',
                            sku_id: '...',
                            expires_at: null
                        },
                        banner_color: '#XXXXXX',
                        mfa_enabled: true,
                        locale: 'ja',
                        premium_type: 2
                    }
                    */
                    if (!userDataResponse.id) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ result: 'fail' }));
                        return;
                    }
                    const guildsOfUserResponse = await fetch('https://discord.com/api/users/@me/guilds', {
                        headers: {
                            Authorization: `Bearer ${oauth2TokenResponse.access_token}`
                        }
                    }).then(res => res.json());
                    /*
                    https://discord.com/developers/docs/resources/user#get-current-user-guilds
                    */
                    const guildsOfUser = guildsOfUserResponse.map(guild => {
                        return {
                            id: guild.id,
                            name: guild.name,
                            icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
                            owner: guild.owner
                        };
                    });
                    // ランダムな16文字の文字列を生成
                    let kokoneToken = await db.clients.token.get(userDataResponse.id);
                    if (!kokoneToken) kokoneToken = [...Array(16)].map(() => Math.random().toString(36)[2]).join('');
                    // datetime型の
                    db.clients.set(userDataResponse.id, {
                        username: userDataResponse.username,
                        globalName: userDataResponse.global_name,
                        avatar: `https://cdn.discordapp.com/avatars/${userDataResponse.id}/${userDataResponse.avatar}.png`,
                        kokoneToken: kokoneToken,
                        refreshToken: oauth2TokenResponse.refresh_token,
                        expiresOn: Date.now() + oauth2TokenResponse.expires_in * 1000,
                        locale: userDataResponse.locale,
                        guilds: guildsOfUser
                    });
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Set-Cookie': [
                            `userID=${userDataResponse.id}; Max-Age=604800; Secure; HttpOnly; SameSite=None; Domain=.jun-suzu.net; Path=/`,
                            `kokoneToken=${kokoneToken}; Max-Age=604800; Secure; HttpOnly; SameSite=None; Domain=.jun-suzu.net; Path=/`
                        ]
                    });
                    res.end(JSON.stringify({ result: 'success' }));
                }
            } catch (error) {
                // return no error or message
                console.log('Bad request received.', ipadr);
                return;
            }
        }
    });
});

const wsServer = new WebSocket.Server({ server });

wsServer.on('connection', (ws, request) => {
    const ipadr = request.headers['x-forwarded-for'].split(/\s*,\s*/)[0];
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            const { userID, kokoneToken } = parseCookies(request);
            if (!userID || !kokoneToken) return;
            const user = await db.clients.get(userID);
            if (!user || user.token !== kokoneToken) return;
            if (data.action === 'greeting') {
                // 挨拶があった場合、挨拶を返し、必要な情報を送信
                ws.send(JSON.stringify({ type: 'response', action: 'greeting', details: 'Hello, This is KOKONE Server.' }));
                // ユーザーの設定を送信
                const userSettings = await db.clients.options.get(userID);
                ws.send(JSON.stringify({ type: 'response', action: 'getUserSettings', details: userSettings }));
                // 所属しているサーバーのidと名前とアイコンを送信
                const guilds = await db.clients.guilds.get(userID);
                if (!guilds) {
                    ws.send(JSON.stringify({ type: 'response', action: 'getGuilds', details: [] }));
                    return;
                }
                guilds.forEach(guild => {
                    guild.playing = onPlaying(guild.id);
                });
                if (!guilds.length) ws.send(JSON.stringify({ type: 'response', action: 'getGuilds', details: [] }));
                ws.send(JSON.stringify({ type: 'response', action: 'getGuilds', details: guilds }));
            }
            else if (data.action === 'getGuildData') {
                const guild = client.guilds.cache.get(data.guildID);
                if (!guild) {
                    ws.send(JSON.stringify({ result: 'getGuildData', error: 'Guild not found.' }));
                    return;
                }
                // dbから取得したすべてのデータと、playingTimeを送信
                const guildData = await db.guilds.get(guild.id);
                guildData.playingTime = playingTime[guild.id] || {};
                ws.send(JSON.stringify({ type: 'response', action: 'getGuildData', details: guildData }));
            }
            else if (data.action === 'getVideoData') {
                const videoData = await db.videoCache.get(data.videoID);
                videoData.flag = data.flag;
                ws.send(JSON.stringify({ type: 'response', action: 'getVideoData', details: videoData }));
            }
            else if (data.action === 'controlPlayer') {
                const guild = client.guilds.cache.get(data.guildID);
                if (!guild) {
                    ws.send(JSON.stringify({ type: 'response', action: 'controlPlayer', error: 'Guild not found.' }));
                    return;
                }
                const connection = getVoiceConnection(data.guildID);
                if (!connection) {
                    ws.send(JSON.stringify({ type: 'response', action: 'controlPlayer', error: 'Not connected to voice channel.' }));
                    return;
                }
                const player = connection.state.subscription.player;
                if (data.control === 'play') player.unpause();
                else if (data.control === 'pause') player.pause();
                else if (data.control === 'stop') {
                    player.stop();
                    db.guilds.queue.set(guild.id, []);
                }
                else if (data.control === 'skip') player.stop();
                else if (data.control === 'shuffle') {
                    const queue = await db.guilds.queue.get(guild.id);
                    if (queue.length < 2) {
                        ws.send(JSON.stringify({ type: 'response', action: 'controlPlayer', error: 'There are no music in the queue or only one music.' }));
                        return;
                    }
                    const playingMusic = queue.shift();
                    let shuffledQueue = [playingMusic];
                    const queueLength = queue.length;
                    for (let i = 0; i < queueLength; i++) {
                        const randomIndex = Math.floor(Math.random() * queue.length);
                        shuffledQueue.push(queue[randomIndex]);
                        queue.splice(randomIndex, 1);
                    }
                    await db.guilds.queue.set(guild.id, shuffledQueue);
                }
                else if (data.control === 'volume') {
                    player.state.resource.volume.setVolume(data.value / 100);
                    db.guilds.volume.set(guild.id, data.value);
                }
                ws.send(JSON.stringify({ type: 'response', action: 'controlPlayer', details: 'Success' }));
            }
            else if (data.action === 'subscribeGuild') {
                const guild = data.guildID;
                if (!client.guilds.cache.has(guild)) {
                    ws.send(JSON.stringify({ type: 'response', action: 'subscribeGuild', error: 'Guild not found.' }));
                    return;
                }
                if (wsConnections[guild]) {
                    wsConnections[guild] = []
                }
                wsConnections[guild].push(ws);
                ws.on('close', () => {
                    wsConnections[guild] = wsConnections[guild].filter(client => client !== ws);
                    if (wsConnections[guild].length === 0) delete wsConnections[guild];
                });
                ws.send(JSON.stringify({ type: 'response', action: 'subscribeGuild', details: 'Success' }));
            }
            // お気に入りリストの取得
        } catch (error) {
            console.log('Bad request received.', ipadr);
            console.log(error);
            return;
        }
    });
});

function parseCookies(req) {
    const cookieHeader = req.headers.cookie || '';
    return Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
}

client.login(config.token);
server.listen(config.httpPort, () => {
    console.log(`Server running at https://dashboard.kokone.jun-suzu.net/ with port ${config.httpPort} (HTTP transfered by NGINX).`);
});
