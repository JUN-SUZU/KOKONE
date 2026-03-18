import { google } from "googleapis";
import { readFileSync } from 'fs';
const config = JSON.parse(readFileSync('./config.json', 'utf8'));

// Youtubeを検索し、タイトル・URL・説明を取得する
const searchYoutube = async (keyword) => {
    const youtube = google.youtube({
        version: "v3",
        auth: config.youtubeApiKey ?? "",
    });
    const searchRes = await youtube.search.list({
        q: keyword,
        part: ["snippet"],
        relevanceLanguage: "ja", // 日本語の動画を検索
        type: ["video"],
        maxResults: 4,
    });
    return searchRes.data.items ?? [];
};
export default searchYoutube;
