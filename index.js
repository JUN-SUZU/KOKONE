const config = require('./config.json');
// discord.js
const { ActionRowBuilder, ActivityType, Client, Collection,
    EmbedBuilder, Events, GatewayIntentBits, StringSelectMenuBuilder } = require('discord.js');
const { entersState, AudioPlayerStatus, createAudioPlayer, createAudioResource, joinVoiceChannel, StreamType } = require('@discordjs/voice');
// search on youtube
const youtubeNode = require('youtube-node');
const youtube = new youtubeNode();
youtube.setKey(config.youtubeApiKey);
youtube.addParam('type', 'video');
const ytpl = require('ytpl');
// download from youtube
const ytdl = require('ytdl-core');
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
client.connections = new Collection();
client.volume = new Collection();
client.histry = new Collection();
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
    if (interaction.isChatInputCommand()) {
        const commandName = interaction.commandName;
        if (commandName === 'play') {
            // get voice channel
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return await interaction.reply({
                    content: 'You need to be in a voice channel to play music!\nあなたは音声チャンネルに参加している必要があります。',
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

            // https://www.youtube.com/playlist?list=PL4o29bINVT4EG_y-k5jGoOu3-Am8Nvi10
            // https://music.youtube.com/playlist?list=PL4o29bINVT4EG_y-k5jGoOu3-Am8Nvi10
            // https://youtube.com/playlist?list=PL4o29bINVT4EG_y-k5jGoOu3-Am8Nvi10
            // https://music.youtube.com/playlist?list=PL4o29bINVT4EG_y-k5jGoOu3-Am8Nvi10
            if (query.match(/^(https?:\/\/)?((music|www)\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/) || query.match(/^(https?:\/\/)?((music|www)\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/)) {
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
                    queue.push({ videoId: item.id, messageChannel: interaction.channelId });
                    videoCache[item.id] = { title: item.title, channelTitle: item.author.name };
                });
                client.queue.set(interaction.guild.id, queue);
                if (client.connections.get(interaction.guild.id)) {
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
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                    selfDeaf: true,
                    selfMute: false
                });
                client.connections.set(interaction.guild.id, connection);
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
            const connection = client.connections.get(interaction.guild.id);
            if (connection) {
                connection.destroy();
                client.connections.delete(interaction.guild.id);
            }
            const queue = client.queue.get(interaction.guild.id);
            if (queue) {
                client.queue.delete(interaction.guild.id);
            }
            await interaction.reply('Stopped playing music.\n音楽の再生を停止しました。');
        }
        else if (commandName === 'skip') {
            const connection = client.connections.get(interaction.guild.id);
            if (!connection) {
                return await interaction.reply({
                    content: 'No music is playing.\n音楽が再生されていません。',
                    ephemeral: true
                });
            }
            const player = connection.state.subscription.player;
            player.stop();
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
            client.volume.set(interaction.guild.id, volume);
            await interaction.reply(`Volume set to ${volume}%.\n音量を${volume}%に設定しました。\n次の曲から適用されます。`);
        }
        else if (commandName === 'history') {
            const histry = client.histry.get(interaction.guild.id);
            if (!histry) {
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
            for (let i = 0; i < histry.length; i++) {
                embed.addFields({ name: `No.${i + 1}`, value: `[${videoCache[histry[i]].title}](https://www.youtube.com/watch?v=${histry[i]})\nby ${videoCache[histry[i]].channelTitle}` });
            }
            // add button
            const options = [];
            for (let i = 0; i < histry.length; i++) {
                options.push({ label: `No.${i + 1}`, value: histry[i] });
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
            const connection = client.connections.get(interaction.guild.id);
            if (!connection) {
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
            const connection = client.connections.get(interaction.guild.id);
            if (!connection) {
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
        if (selectId === 'musicSelect') {
            // get voice channel
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return await interaction.reply({
                    content: 'You need to be in a voice channel to play music!\nあなたは音声チャンネルに参加している必要があります。',
                    ephemeral: true
                });
            }
            const videoId = interaction.values[0];
            await interaction.deferReply({ ephemeral: true });
            // add to queue
            const queue = client.queue.get(interaction.guild.id);
            const queueData = { videoId: videoId, messageChannel: interaction.channelId };
            if (queue) {
                queue.push(queueData);
                client.queue.set(interaction.guild.id, queue);
            }
            else {
                client.queue.set(interaction.guild.id, [queueData]);
            }
            if (client.connections.get(interaction.guild.id)) {
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
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: false
            });
            client.connections.set(interaction.guild.id, connection);
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
        const queueData = { videoId: videoId[0], messageChannel: interaction.channelId };
        if (queue) {
            queue.push(queueData);
            client.queue.set(interaction.guild.id, queue);
        }
        else {
            client.queue.set(interaction.guild.id, [queueData]);
        }
        if (client.connections.get(interaction.guild.id)) {
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
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false
        });
        client.connections.set(interaction.guild.id, connection);
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
    const connection = client.connections.get(guildId);
    if (!queue.length) {
        connection.destroy();
        client.connections.delete(guildId);
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
        let kashiURL = encodeURI(`https://www.google.com/search?q=${videoCache[videoId].title}+site:www.uta-net.com`);
        embed.setTitle(videoCache[videoId].title);
        embed.setDescription('再生を開始します。\nNow playing.' + '\n' + videoCache[videoId].channelTitle);
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
                let kashiURL = encodeURI(`https://www.google.com/search?q=${result.items[0].snippet.title}+site:www.uta-net.com`);
                embed.setTitle(result.items[0].snippet.title);
                embed.setDescription('再生を開始します。\nNow playing.' + '\n' + result.items[0].snippet.channelTitle);
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
    let histry = client.histry.get(guildId);
    if (!histry) {
        histry = [];
    }
    if (histry.length > 10) {
        histry.shift();
    }
    if (!histry.includes(videoId)) {
        histry.push(videoId);
    }
    client.histry.set(guildId, histry);
    const stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
        filter: format => format.audioCodec === 'opus' && format.container === 'webm', //webm opus
        quality: 'highest',
        highWaterMark: 32 * 1024 * 1024, // https://github.com/fent/node-ytdl-core/issues/902
    });
    const resource = createAudioResource(stream, {
        inputType: StreamType.WebmOpus,
        inlineVolume: true
    });
    resource.volume.setVolume(client.volume.get(guildId) / 100 || 1);
    const player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);
    await entersState(player, AudioPlayerStatus.Playing, 10 * 1000);
    await entersState(player, AudioPlayerStatus.Idle, 24 * 60 * 60 * 1000); 
    // wait for 5 seconds
    await wait(5000);
    player.stop();
    let queue = client.queue.get(connection.joinConfig.guildId);
    queue.shift();
    client.queue.set(connection.joinConfig.guildId, queue);
    if (queue.length > 0) {
        startMusic(guildId);
    }
    else {
        connection.destroy();
        client.connections.delete(guildId);
    }
}

// ボイスチャンネルからキックされた時
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (oldState.member.user.id === client.user.id && !newState.channelId) {
        const connection = client.connections.get(oldState.guild.id);
        if (connection) {
            connection.destroy();
            client.connections.delete(oldState.guild.id);
        }
        const queue = client.queue.get(oldState.guild.id);
        if (queue) {
            client.queue.delete(oldState.guild.id);
        }
    }
});

client.login(config.token);
