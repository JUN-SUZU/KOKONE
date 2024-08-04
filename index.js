const config = require('./config.json');
// discord.js
const { ActionRowBuilder, ActivityType, Client, Collection,
    EmbedBuilder, Events, GatewayIntentBits, PermissionsBitField, StringSelectMenuBuilder } = require('discord.js');
const { entersState, AudioPlayerStatus, createAudioPlayer, createAudioResource, joinVoiceChannel, getVoiceConnection, StreamType } = require('@discordjs/voice');
// search on youtube
const youtubeNode = require('youtube-node');
const youtube = new youtubeNode();
youtube.setKey(config.youtubeApiKey);
youtube.addParam('type', 'video');
const ytpl = require('ytpl');
// download from youtube
const ytdl = require('@distube/ytdl-core');
// other modules
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const wait = require('node:timers/promises').setTimeout;
const baseColor = '#ff207d';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.MessageContent
    ]
});

client.queue = new Collection();
client.volume = new Collection();
client.history = new Collection();
let searchCache = JSON.parse(fs.readFileSync('./searchCache.json', 'utf8'));
let videoCache = JSON.parse(fs.readFileSync('./videoCache.json', 'utf8'));

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('guildCreate', async (guild) => {
    console.log(`Joined guild: ${guild.name}`);
    // register slash commands
    const commands = [];
    const commandFiles = fs.readdirSync(path.join(__dirname, './discordCommands')).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./discordCommands/${file}`);
        commands.push(command.data.toJSON());
        guild.commands.create(command.data);
    }
});

client.on('messageCreate', async (message) => {
    if (message.content === 'kokone recovery command') {
        let guild = message.guild;
        // register slash commands
        const commands = [];
        const commandFiles = fs.readdirSync(path.join(__dirname, './discordCommands')).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`./discordCommands/${file}`);
            commands.push(command.data.toJSON());
            guild.commands.create(command.data);
        }
        message.reply('Command registration completed.\nコマンドの登録が完了しました。');
    }
});

client.on('interactionCreate', async (interaction) => {
    let log = `Interaction: ${interaction.user.tag} in #${interaction.channel.name} (${interaction.channel.id}) triggered an interaction.\n`
        + `TimeStamp: ${new Date().toLocaleString()}\n`
        + `Guild: ${interaction.guild.name} (${interaction.guild.id})\n`;
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
            if (!voiceChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.Connect) ||
                !voiceChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.Speak) ||
                !voiceChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.ViewChannel)) {
                return await interaction.reply({
                    content: 'I don\'t have permission to join or speak in this channel.\nこのチャンネルに参加または発言する権限がありません。',
                    ephemeral: true
                });
            }
            await interaction.deferReply({ ephemeral: true });
            // search video id
            const keyword = interaction.options.getString('keyword');
            let query = keyword;
            let videoId = [];
            // 検索キーワードかurlかプレイリストか判定
            // https://youtu.be/CdZN8PI3MqM
            // https://www.youtube.com/watch?v=CdZN8PI3MqM
            // https://music.youtube.com/watch?v=CdZN8PI3MqM
            // https://youtube.com/watch?v=CdZN8PI3MqM
            // https://www.youtube.com/CdZN8PI3MqM
            // https://youtu.be/CdZN8PI3MqM

            //  https://youtube.com/shorts/X4KZpW4j870?si=HadUV0DqFH6ST6Kq


            // https://www.youtube.com/playlist?list=PL4o29bINVT4EG_y-k5jGoOu3-Am8Nvi10
            // https://music.youtube.com/playlist?list=PL4o29bINVT4EG_y-k5jGoOu3-Am8Nvi10
            // https://youtube.com/playlist?list=PL4o29bINVT4EG_y-k5jGoOu3-Am8Nvi10
            // https://music.youtube.com/playlist?list=PL4o29bINVT4EG_y-k5jGoOu3-Am8Nvi10

            // 開始時間指定
            // https://music.youtube.com/watch?v=Yo83M-KOc7k&feature=shared&t=44
            // https://youtu.be/a1KBb9mTgck?feature=shared&t=146
            if (query.match(/^(https?:\/\/)?((music|www)\.)?youtube\.com\/watch(\/\?|\?)v=([a-zA-Z0-9_-]{11})/) || query.match(/^(https?:\/\/)?((music|www)\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/) || query.match(/^(https?:\/\/)?((music|www)\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)) {
                videoId = [ytdl.getVideoID(query)];
                createSelectMenu(interaction, videoId);
            }
            else if (query.match(/^(https?:\/\/)?((music|www)\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]{34})/)) {
                let playListId = query.match(/list=([a-zA-Z0-9_-]{34})/)[1];
                let playList = await ytpl(playListId);
                // add to queue
                let queue = client.queue.get(interaction.guild.id);
                if (!queue) {
                    queue = [];
                }
                playList.items.forEach(item => {
                    queue.push({ videoId: item.id, messageChannel: interaction.channelId, user: interaction.member.user.username });
                    videoCache[item.id] = { title: item.title, channelTitle: item.author.name };
                });
                client.queue.set(interaction.guild.id, queue);
                if (getVoiceConnection(interaction.guild.id)) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(`${interaction.member.user.username} added to queue.\nキューに追加されました。`)
                                .setImage(`https://img.youtube.com/vi/${playList.items[0].id}/default.jpg`)
                                .setColor(baseColor)
                        ],
                        ephemeral: true
                    });
                }
                const voiceChannel = interaction.member.voice.channel;
                // join voice channel
                joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                    selfDeaf: true,
                    selfMute: false,
                    timeout: 10 * 1000
                });
                interaction.editReply({
                    content: '再生を開始します。\nNow playing.',
                    ephemeral: true
                });
                startMusic(interaction.guild.id);
            }
            else if (searchCache[query]) {
                videoId = searchCache[query];
                createSelectMenu(interaction, videoId);
            }
            else {
                // 検索
                youtube.search(query, 4, function (error, result) {
                    if (error) {
                        console.log(`error has occurred while searching: ${keyword}`);
                        interaction.editReply({
                            content: 'An error has occurred while searching.\n検索中にエラーが発生しました。',
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
                            let LabelString = result.items[i].snippet.title;
                            if (LabelString.length > 90) LabelString = LabelString.slice(0, 90) + '...';
                            options.push(
                                { label: LabelString, description: result.items[i].snippet.channelTitle, value: result.items[i].id.videoId }
                            );
                            videoCache[result.items[i].id.videoId] = { title: result.items[i].snippet.title, channelTitle: result.items[i].snippet.channelTitle };
                        }
                        // { label: result.items[0].snippet.title, description: result.items[0].snippet.channelTitle, value: result.items[0].id.videoId },
                        // { label: result.items[1].snippet.title, description: result.items[1].snippet.channelTitle, value: result.items[1].id.videoId },
                        // { label: result.items[2].snippet.title, description: result.items[2].snippet.channelTitle, value: result.items[2].id.videoId },
                        // { label: result.items[3].snippet.title, description: result.items[3].snippet.channelTitle, value: result.items[3].id.videoId }
                        videoId = options;
                        searchCache[query] = videoId;
                        createSelectMenu(interaction, videoId);
                    }
                });
            }
        }
        else if (commandName === 'stop') {
            const connection = getVoiceConnection(interaction.guild.id);
            if (connection) {
                client.queue.delete(interaction.guild.id);
                connection.destroy();
            }
            const queue = client.queue.get(interaction.guild.id);
            if (queue) {
                client.queue.delete(interaction.guild.id);
            }
            await interaction.reply('Stopped playing music.\n音楽の再生を停止しました。');
        }
        else if (commandName === 'skip') {
            const connection = getVoiceConnection(interaction.guild.id);
            const subscription = connection.state.subscription;
            if (!connection || !subscription || !subscription.player) {
                return await interaction.reply({
                    content: 'No music is playing.\n音楽が再生されていません。',
                    ephemeral: true
                });
            }
            subscription.player.unpause();
            subscription.player.stop();
            await interaction.reply('Skipped the current song.\n現在の曲をスキップしました。');
        }
        else if (commandName === 'repeat') {
            let repeatTimes = interaction.options.getNumber('times');
            if (repeatTimes < 1) {
                return await interaction.reply({
                    content: 'The number of times must be 1 or more.\n回数は1以上である必要があります。',
                    ephemeral: true
                });
            }
            if (repeatTimes > 1000) {
                repeatTimes = 1000;
            }
            const queue = client.queue.get(interaction.guild.id);
            if (!queue) {
                return await interaction.reply({
                    content: 'No music is playing.\n音楽が再生されていません。',
                    ephemeral: true
                });
            }
            const playingMusic = queue[0];
            playingMusic.user = interaction.member.user.username;
            for (let i = 0; i < repeatTimes; i++) {
                queue.unshift(playingMusic);
            }
            client.queue.set(interaction.guild.id, queue);
            await interaction.reply(`Set to repeat ${repeatTimes} times.\n${repeatTimes}回リピートするように設定しました。${repeatTimes == 1000 ? '（上限）' : ''}`);
        }
        else if (commandName === 'volume') {
            const volume = interaction.options.getNumber('volume');
            if (volume <= 0 || volume > 200) {
                return await interaction.reply({
                    content: '音量は0より大きく200以下である必要があります。\nVolume must be greater than 0 and less than or equal to 100.',
                    ephemeral: true
                });
            }
            if (getVoiceConnection(interaction.guild.id)) {
                const resource = getVoiceConnection(interaction.guild.id).state.subscription.player.state.resource;
                resource.volume.setVolume(volume / 100);
            }
            client.volume.set(interaction.guild.id, volume);
            await interaction.reply(`Volume set to ${volume}%.\n音量を${volume}%に設定しました。`);
        }
        else if (commandName === 'history') {
            const history = client.history.get(interaction.guild.id);
            if (!history) {
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
                embed.addFields({ name: `No.${i + 1}`, value: `[${videoCache[history[i]].title}](https://www.youtube.com/watch?v=${history[i]})\nby ${videoCache[history[i]].channelTitle}` });
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
            const queue = client.queue.get(interaction.guild.id);
            if (!queue) {
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
                embed.addFields({ name: `No.${i + 1}`, value: `[${videoCache[queue[i].videoId].title}](https://www.youtube.com/watch?v=${queue[i].videoId})\nby ${videoCache[queue[i].videoId].channelTitle}` });
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
            await interaction.reply('Resumed the music.\n音楽を再開しました。');
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
            const queue = client.queue.get(interaction.guild.id);
            const queueData = { videoId: videoId, messageChannel: interaction.channelId, user: interaction.member.user.username };
            if (queue) {
                queue.push(queueData);
                client.queue.set(interaction.guild.id, queue);
            }
            else {
                client.queue.set(interaction.guild.id, [queueData]);
            }
            if (getVoiceConnection(interaction.guild.id)) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`${interaction.member.user.username} added to queue.\nキューに追加されました。\n${videoCache[videoId].title}`)
                            .setDescription(videoCache[videoId].channelTitle)
                            .setImage(`https://img.youtube.com/vi/${videoId}/default.jpg`)
                            .setColor(baseColor)
                    ],
                    ephemeral: true
                });
            }
            // join voice channel
            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: false,
                timeout: 10 * 1000
            });
            await interaction.editReply({
                content: '再生を開始します。\nNow playing.',
                ephemeral: true
            });
            startMusic(interaction.guild.id);
        }
    }
});

function createSelectMenu(interaction, videoId) {
    if (videoId.length > 1) {
        // ask for video selection
        const options = videoId;
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
        options.forEach(option => {
            let thumbnail = `https://img.youtube.com/vi/${option.value}/default.jpg`;
            embed.setThumbnail(thumbnail);
        });
        return interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    }
    else if (videoId.length == 1) {
        // add to queue
        const queue = client.queue.get(interaction.guild.id);
        const queueData = { videoId: videoId[0], messageChannel: interaction.channelId, user: interaction.member.user.username };
        if (queue) {
            queue.push(queueData);
            client.queue.set(interaction.guild.id, queue);
        }
        else {
            client.queue.set(interaction.guild.id, [queueData]);
        }
        if (getVoiceConnection(interaction.guild.id)) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`${interaction.member.user.username} added to queue.\nキューに追加されました。`)
                        .setImage(`https://img.youtube.com/vi/${videoId[0]}/default.jpg`)
                        .setColor(baseColor)
                ],
                ephemeral: true
            });
        }
        const voiceChannel = interaction.member.voice.channel;
        // join voice channel
        joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false,
            timeout: 10 * 1000
        });
        interaction.editReply({
            content: '再生を開始します。\nNow playing.',
            ephemeral: true
        });
        startMusic(interaction.guild.id);
    }
    else {
        interaction.editReply({
            content: 'An error has occurred while searching.\n検索中にエラーが発生しました。',
            ephemeral: true
        });
    }
}

async function startMusic(guildId) {
    const queue = client.queue.get(guildId);
    const connection = getVoiceConnection(guildId);
    if (!queue.length) {
        client.queue.delete(guildId);
        connection.destroy();
        return;
    }
    const { videoId, messageChannel } = queue[0];
    client.queue.set(guildId, queue);

    const channel = client.channels.cache.get(messageChannel);
    let embed = new EmbedBuilder()
        .setURL("https://www.youtube.com/watch?v=" + videoId)
        .setImage(`https://img.youtube.com/vi/${videoId}/default.jpg`)
        .setColor([233, 30, 99]);

    if (videoCache[videoId]) {
        // https://www.google.com/search?q=+site:www.uta-net.com URLエンコード
        let kashiURL = encodeURI(`https://www.google.com/search?q=${videoCache[videoId].title}+Lyrics`);
        embed.setTitle(videoCache[videoId].title);
        embed.setDescription(`再生を開始します。Now playing.\n${videoCache[videoId].channelTitle}\nadded by ${queue[0].user}`);
        embed.setAuthor({ name: '歌詞 Lyrics', url: kashiURL });
        channel.send({ embeds: [embed] });
        playMusic(connection, videoId, guildId);
    }
    else {
        //動画の情報を取得
        youtube.getById(videoId, function (error, result) {
            if (result.items.length == 0 || error) {
                // console.log(error);
                return channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("失敗")
                            .setDescription("曲が見つかりませんでした。")
                            .setColor(baseColor)
                    ]
                });
            }
            else {
                // https://www.google.com/search?q=+site:www.uta-net.com URLエンコード
                let kashiURL = encodeURI(`https://www.google.com/search?q=${result.items[0].snippet.title}+Lyrics`);
                embed.setTitle(result.items[0].snippet.title);
                embed.setDescription(`再生を開始します。Now playing.\n${result.items[0].snippet.channelTitle}\nadded by ${queue[0].user}`);
                embed.setAuthor({ name: '歌詞 Lyrics', url: kashiURL });
                channel.send({ embeds: [embed] });
                videoCache[videoId] = { title: result.items[0].snippet.title, channelTitle: result.items[0].snippet.channelTitle };
                //再生
                playMusic(connection, videoId, guildId);
            }
        });
    }
}

async function playMusic(connection, videoId, guildId) {
    fs.writeFileSync('./searchCache.json', JSON.stringify(searchCache, null, 4), 'utf8');
    fs.writeFileSync('./videoCache.json', JSON.stringify(videoCache, null, 4), 'utf8');
    let history = client.history.get(guildId);
    if (!history) {
        history = [];
    }
    if (history.length > 10) {
        history.shift();
    }
    if (!history.includes(videoId)) {
        history.push(videoId);
    }
    client.history.set(guildId, history);
    let stream;
    try {
        let info = await ytdl.getInfo(videoId);
        let audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        if (audioFormats.filter(format => format.container === 'webm' && format.audioCodec === 'opus').length == 0) {
            stream = fs.createReadStream('./restricted.mp3');
        }
    } catch (error) {
        // play restricted.mp3
        stream = fs.createReadStream('./restricted.mp3');
    }
    if (stream == null)
        stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
            filter: format => format.audioCodec === 'opus' && format.container === 'webm', //webm opus
            quality: 'highestaudio',
            highWaterMark: 32 * 1024 * 1024, // https://github.com/fent/node-ytdl-core/issues/902
        });
    const resource = createAudioResource(stream, {
        inputType: StreamType.WebmOpus,
        inlineVolume: true
    });
    resource.volume.setVolume(client.volume.get(guildId) / 100 || 1);
    let player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);
    try {
        await entersState(player, AudioPlayerStatus.Playing, 5 * 1000);// Playingになるまで最大5秒待ち、再生が始まらない場合はAborted
        await entersState(player, AudioPlayerStatus.Idle, 24 * 60 * 60 * 1000);// 再生開始から24時間待ち、再生が終わらない場合はAborted
    }
    catch (error) {
        console.log(error.message);
        if (error.message.includes('The operation was aborted')) {
            client.queue.delete(guildId);
            connection.destroy();
            return;
        }
        else {
            console.log(error);
            client.queue.delete(guildId);
            connection.destroy();
            return;
        }
    }
    // wait for 5 seconds
    await wait(5000);
    player.stop();
    let queue = client.queue.get(guildId);
    queue.shift();
    if (queue.length > 0) {
        client.queue.set(guildId, queue);
        startMusic(guildId);
    }
    else {
        client.queue.delete(guildId);
        connection.destroy();
    }
}

function onPlaying(guildId) {
    try {
        const connection = getVoiceConnection(guildId);
        if (connection && connection.state.subscription && connection.state.subscription.player) {
            return true;
        }
        else {
            return false;
        }
    }
    catch (error) {
        return false;
    }
}

// ボイスチャンネルからキックされた時
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channelId !== null) {
        return;
    }
    else if (oldState.member.user.id === client.user.id) {
        const queue = client.queue.get(oldState.guild.id);
        if (queue) {
            client.queue.delete(oldState.guild.id);
            if (onPlaying(oldState.guild.id)) {
                getVoiceConnection(oldState.guild.id).state.subscription.player.stop();
            }
            getVoiceConnection(oldState.guild.id).destroy();
        }
    }
});

client.login(config.token);
