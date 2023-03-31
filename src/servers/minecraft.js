import Logger from '@rabbit-company/logger';
import { status, sendVote } from 'minecraft-server-util';
import { setTimeout } from 'timers/promises';

export default class Minecraft{
	static servers = {};
	static updatedServers = new Set([]);

	static async getServers(){
		for(let i = 1; i <= 50; i++){
			Logger.info(`Fetching Minecraft Server (page ${i})`);
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
			}catch{
				Logger.warn(`Failed to fetch Minecraft Server page ${i}`);
			}

			await setTimeout(1000);
		}
	}

	static async crawl(id){
		Logger.silly(`Crawling Minecraft Server #${id}`);
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
			this.servers[id].players = 0;
			this.servers[id].updated = new Date().toISOString();
		}).finally(() => {
			this.updatedServers.add(Number(id));
		});
	}

	static async runCrawler(){
		while(true){
			try{
				let keys = Object.keys(this.servers);
				let id;
				let lastUpdated = new Date().getTime();
				for(let i = 0; i < keys.length; i++){
					let updated = new Date(this.servers[keys[i]].updated).getTime();

					if(lastUpdated > updated){
						lastUpdated = updated;
						id = keys[i];
					}
				}

				await this.crawl(id);
				await setTimeout(2000);
			}catch{}
		}
	}

	static async sendServerVote(ip, port, token, username){
		return await sendVote(ip, port, {
			token: token,
			username: username,
			serviceName: 'rabbitserverlist',
			timestamp: Date.now(),
			timeout: 5000
		});
	}

	static async uploadData(SECRET_TOKEN){
		let copyUpdatedServer = new Set(JSON.parse(JSON.stringify([...this.updatedServers])));
		let copyServers = JSON.parse(JSON.stringify(this.servers));

		if(copyUpdatedServer.size === 0) return;

		let data = [];
		copyUpdatedServer.forEach(id => {
			let temp = copyServers[id];
			temp['id'] = id;
			data.push(temp);
		});

		let headers = new Headers();
		headers.set('Authorization', 'Basic ' + Buffer.from('crawler:' + SECRET_TOKEN).toString('base64'));
		headers.set('Content-Type', 'application/json');

		let limit = 20;
		let pages = Math.ceil(data.length / limit);

		for(let i = 0; i < pages; i++){
			Logger.debug(`Batching page ${pages} of Minecraft Servers`);
			let offset = limit * i;

			let limitedData = [];
			for(let j = offset; j < (offset+limit); j++){
				if(j >= data.length) break;
				limitedData.push(data[j]);
			}

			let response = await fetch('https://api.rabbitserverlist.com/v1/servers/minecraft/crawler', {
				method: 'POST',
				headers: headers,
				body: JSON.stringify({ 'servers': limitedData })
			});

			if(!response.ok || response.status !== 200){
				Logger.warn('Something went wrong while trying to upload data.');
				return;
			}

			let json = await response.json();
			if(json.error !== 0){
				Logger.warn('Failed to submit data to the API. Error: ' + json.info);
				return;
			}

			Logger.info(`${json.data.updated} Minecraft servers successfully updated.`);
			if(json.data.total !== json.data.updated){
				Logger.warn(`Only ${json.data.updated} Minecraft servers has been updated successfully out of ${json.data.total}.`);
			}

		}

		this.updatedServers.clear();
	}

}