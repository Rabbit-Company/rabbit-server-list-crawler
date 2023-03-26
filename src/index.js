import Minecraft from "./servers/minecraft.js";

await Minecraft.getServers();
await Minecraft.runCrawler();

setInterval(async function(){
	await Minecraft.getServers();
}, 1_800_000);