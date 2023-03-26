import * as dotenv from 'dotenv';
import Minecraft from "./servers/minecraft.js";

dotenv.config();

setInterval(async function(){
	await Minecraft.getServers();
}, 1_800_000);

setInterval(async function(){
	await Minecraft.uploadData(process.env.CRAWLER_SECRET_TOKEN);
}, 60_000);

await Minecraft.getServers();
await Minecraft.runCrawler();