import { status } from 'minecraft-server-util';
import { setTimeout } from 'timers/promises';

export default class Minecraft{
	static servers = {};
	static updatedServer = [];

	static async getServers(){
		for(let i = 1; i <= 50; i++){
			console.log(`Fetching Minecraft Server (page ${i})`);
			try{
				let res = await fetch("https://api.rabbitserverlist.com/v1/servers/minecraft/page/" + i);

				if(!res.ok) continue;
				if(res.status !== 200) continue;

				let data = await res.json();
				if(data.error !== 0) continue;
				if(data.data.length === 0) break;

				data.data.forEach(server => {
					this.servers[server.id] = {
						ip: server.ip,
						port: server.port,
						players: server.players,
						players_max: server.players_max,
						online: server.online,
						votes: server.votes,
						votes_total: server.votes_total,
						updated: server.updated
					};
				});
			}catch{}

			await setTimeout(1000);
		}
	}

	static async crawl(id){
		status(this.servers[id].ip, this.servers[id].port, {
			timeout: 5000,
			enableSRV: true
		}).then((result) => {
			this.servers[id].online = true;
			this.servers[id].players = result.players.online;
			this.servers[id].players_max = result.players.max;
			this.servers[id].updated = new Date().toISOString();
		}).catch(() => {
			this.servers[id].online = false;
			this.servers[id].updated = new Date().toISOString();
		}).finally(() => {
			this.updatedServer.push(id);
		});
	}

	static async runCrawler(){
		while(true){
			try{
				let keys = Object.keys(this.servers);
				let id;
				for(let i = 0; i < keys.length; i++){
					let lastUpdated = new Date().getTime();
					let updated = new Date(this.servers[keys[i]].updated).getTime();

					if(lastUpdated > updated) id = keys[i];
				}

				await this.crawl(id);
				await setTimeout(5000);
			}catch{}
		}
	}

	static async uploadData(){
		if(this.updatedServer.length === 0) return;
	}

}