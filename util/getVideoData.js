import { google } from "googleapis";
import { readFileSync } from 'fs';
const config = JSON.parse(readFileSync('./config.json', 'utf8'));

// Youtubeを検索し、タイトル・URL・説明を取得する
const getVideoData = async (videoId) => {
    const youtube = google.youtube({
        version: "v3",
        auth: config.youtubeApiKey ?? "",
    });
    const result = await youtube.videos.list({
        part: ["snippet"], // タイトルやチャンネル名が必要なためsnippetを指定
        id: [videoId]
    });
    return result.data?.items ?? [];
};
export default getVideoData;
