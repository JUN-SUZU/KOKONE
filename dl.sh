#!/bin/bash

ROOT_DIR=$(dirname "$0")

LATEST_VERSION=$(curl -s https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
if [ -z "$LATEST_VERSION" ]; then
    echo "Failed to fetch the latest version of yt-dlp."
    exit 1
fi

if [ -f "$ROOT_DIR/ytdlp/.yt-dlp_version" ]; then
    INSTALLED_VERSION=$(cat "$ROOT_DIR/ytdlp/.yt-dlp_version")
else
    INSTALLED_VERSION=""
fi

if [ "$LATEST_VERSION" != "$INSTALLED_VERSION" ]; then
    echo "新しいバージョンが見つかりました: $LATEST_VERSION (現在のバージョン: ${INSTALLED_VERSION:-なし})"
    
    # ダウンロード実行
    DOWNLOAD_URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux"
    curl -L -o "$ROOT_DIR/ytdlp/yt-dlp" "$DOWNLOAD_URL"
    
    # 実行権限を付与
    chmod +x "$ROOT_DIR/ytdlp/yt-dlp"
    
    # バージョン記録を更新
    echo "$LATEST_VERSION" > "$ROOT_DIR/ytdlp/.yt-dlp_version"
    echo "アップデートが完了しました。"
else
    echo "すでに最新バージョン ($INSTALLED_VERSION) です。更新は不要です。"
fi

"$ROOT_DIR/ytdlp/yt-dlp" -x --audio-format mp3 -o "%(id)s" -P "$ROOT_DIR/ytdlp/" "$1"

for file in "$ROOT_DIR/ytdlp/"*.mp3; do
    if [ -f "$file" ]; then
        # 拡張子を.mp3から.mp4に変更
        new_file="${file%.mp3}.mp4"
        # music_cacheディレクトリに移動
        mv "$file" "$ROOT_DIR/music_cache/$(basename "$new_file")"
    fi
done
