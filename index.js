const config = require('./config.json');
// discord.js
const { ActionRowBuilder, ActivityType, ChannelType, Client, Collection,
    EmbedBuilder, Events, GatewayIntentBits, PermissionsBitField,
    StringSelectMenuBuilder } = require('discord.js');
const { entersState, AudioPlayerStatus, AudioReceiveStream, createAudioPlayer, createAudioResource, EndBehaviorType,
    joinVoiceChannel, getVoiceConnection, NoSubscriberBehavior, StreamType } = require('@discordjs/voice');

// search on youtube
const youtubeNode = require('youtube-node');
const youtube = new youtubeNode();
youtube.setKey(config.youtubeApiKey);
youtube.addParam('type', 'video');

// deploy from youtube playlist
const ytpl = require('ytpl');

// download from youtube
const ytdl = require('@distube/ytdl-core');

// ffmpeg
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
const { PassThrough, Readable } = require('stream');

// other modules
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { on } = require('events');
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
client.isSkip = new Collection();
let searchCache = JSON.parse(fs.readFileSync('./searchCache.json', 'utf8'));
let videoCache = JSON.parse(fs.readFileSync('./videoCache.json', 'utf8'));

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('音楽', { type: ActivityType.Listening });
});

client.on('guildCreate', async (guild) => {
    console.log(`Joined guild: ${guild.name}`);
    registerSlashCommands(guild);
});

client.on('messageCreate', async (message) => {
    if (message.content === 'kokone recovery command') {
        let guild = message.guild;
        registerSlashCommands(guild);
        message.reply('Command registration completed.\nコマンドの登録が完了しました。');
    }
    else if (message.content === 'kokone show guilds') {
        await client.guilds.fetch();
        let guilds = client.guilds.cache.map(guild => guild.name);
        message.reply(`\`\`\`${guilds.join('\n')}\`\`\``);
    }
    else if (message.content === 'kokone global notice' && message.author.id === '704668240030466088') {
        const permissions = interaction.channel.permissionsFor(client.user);
        client.guilds.cache.forEach(guild => {
            let channel = guild.channels.cache.find(channel =>
                channel.type === ChannelType.GuildText && channel.permissionsFor(client.user).has(PermissionsBitField.Flags.SendMessages));
            if (channel) {
                try {
                    channel.send('This is a global notice.\nこれはグローバル通知です。\n' + message.content.slice(20));
                } catch (error) {
                    console.log(error);
                }
            }
        });
    }
});

function registerSlashCommands(guild) {
    const commands = [];
    const commandFiles = fs.readdirSync(path.join(__dirname, './discordCommands')).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./discordCommands/${file}`);
        commands.push(command.data.toJSON());
        guild.commands.create(command.data);
    }
    console.log(`Command registration completed in ${guild.name}`);
}

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
            // 開始時間指定 TODO: 未実装
            // https://music.youtube.com/watch?v=Yo83M-KOc7k&feature=shared&t=44
            // https://youtu.be/a1KBb9mTgck?feature=shared&t=146
            if (query.match(/^(https?:\/\/)?((music|www)\.)?youtube\.com\/watch(\/\?|\?)v=([a-zA-Z0-9_-]{11})/) ||
                query.match(/^(https?:\/\/)?((music|www)\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
                query.match(/^(https?:\/\/)?((music|www)\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)) {
                let videoId = ytdl.getVideoID(query);
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
                            options.push(
                                { label: result.items[i].snippet.title, description: result.items[i].snippet.channelTitle, value: result.items[i].id.videoId }
                            );
                            videoCache[result.items[i].id.videoId] = { title: result.items[i].snippet.title, channelTitle: result.items[i].snippet.channelTitle };
                        }
                        searchCache[query] = options;
                        createSelectMenu(interaction, options);
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
            if (repeatTimes < 1) {
                return await interaction.reply({
                    content: 'The number of times must be at least 1.\n回数は少なくとも1回である必要があります。',
                    ephemeral: true
                });
            }
            if (repeatTimes > 1000) repeatTimes = 1000;
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
            await interaction.reply(`Volume set to ${volume}%.\n音量を${volume}%に設定しました。`);
            if (onPlaying(interaction.guild.id)) {
                const resource = getVoiceConnection(interaction.guild.id).state.subscription.player.state.resource;
                let currentVolume = client.volume.get(interaction.guild.id) || 30;
                while (currentVolume != volume) {
                    let diff = volume - currentVolume > 5 ? 5 : volume - currentVolume < -5 ? -5 : volume - currentVolume;
                    currentVolume += diff;
                    if (currentVolume - volume > -0.5 && currentVolume - volume < 0.5) currentVolume = volume;
                    resource.volume.setVolume(currentVolume / 100);
                    await wait(200);
                }
            }
            client.volume.set(interaction.guild.id, volume);
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
                { name: 'speech', description: '音声認識を有効または無効にします。' },
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
            joinAndReply(interaction);
        }
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
        videoId.forEach(video => {
            let thumbnail = `https://img.youtube.com/vi/${video.value}/default.jpg`;
            embed.setThumbnail(thumbnail);
        });
        return interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    }
    else {
        interaction.editReply({
            content: 'An error has occurred while searching.\n検索中にエラーが発生しました。\n' +
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
        if (audioFormats.filter(format => format.container === 'mp4' && format.audioCodec === 'mp4a.40.5').length == 0) {//mp4 aac
            stream = fs.createReadStream('./restricted.mp3');
        }
    } catch (error) {
        // play restricted.mp3
        stream = fs.createReadStream('./restricted.mp3');
    }
    if (stream == null) {
        stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
            filter: format => format.container === 'mp4' && format.audioCodec === 'mp4a.40.5',
            quality: 'highestaudio',
            highWaterMark: 32 * 1024 * 1024
        });
    }

    // // If the stream can't be played, use the following code
    // const ffmpegStream = new PassThrough();
    // ffmpeg(stream)
    //     .audioCodec('libopus')
    //     .format('webm')
    //     .pipe(ffmpegStream, { end: true });

    const resource = createAudioResource(stream, {
        inputType: StreamType.WebmOpus,
        inlineVolume: true
    });
    resource.volume.setVolume(client.volume.get(guildId) / 100 || 0.3);
    let player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);
    // await entersState(player, AudioPlayerStatus.Playing, 5 * 1000);// Playingになるまで最大5秒待ち、再生が始まらない場合はAborted
    // await entersState(player, AudioPlayerStatus.Idle, 24 * 60 * 60 * 1000);// 再生開始から24時間待ち、再生が終わらない場合はAborted
    player.on(AudioPlayerStatus.Idle, async () => {
        try {
            let isSkip = client.isSkip.get(guildId);
            if (isSkip) return client.isSkip.delete(guildId);
            let queue = client.queue.get(guildId);
            queue.shift();
            if (queue.length > 0) {
                client.queue.set(guildId, queue);
                await wait(2000);// 余韻のために2秒待つ
                startMusic(guildId);
            }
            else {
                client.queue.delete(guildId);
                connection.destroy();
            }
        } catch (error) {
            console.log(error);
        }
    });
    player.on('error', error => {
        console.log(error);
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
    });
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

cron.schedule('*/10 * * * *', () => {
    client.queue = client.queue.clone();
    client.volume = client.volume.clone();
    client.history = client.history.clone();
    client.isSkip = client.isSkip.clone();
});

client.login(config.token);
