import { readFileSync, existsSync } from 'fs';
const config = JSON.parse(readFileSync('./config.json', 'utf8'));
import { ShardingManager } from "discord.js";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manager = new ShardingManager(
  path.join(__dirname, "index.js"),
  {
    token: config.token,
    totalShards: 7,
    respawn: true,
  }
);

manager.on("shardCreate", shard => {
  console.log(`[Shard ${shard.id}] launched`);
});

await manager.spawn();
