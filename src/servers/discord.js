import Logger from '@rabbit-company/logger';
import { setTimeout } from 'timers/promises';

export default class Discord{
	static servers = {};
	static updatedServers = new Set([]);

	static async getServers(){
		for(let i = 1; i <= 50; i++){
			Logger.info(`Fetching Discord Server (page ${i})`);
			try{
				let res = await fetch("https://api.rabbitserverlist.com/v1/servers/discord/page/" + i);

				if(!res.ok) continue;
				if(res.status !== 200) continue;

				let data = await res.json();
				if(data.error !== 0) continue;
				if(data.data.length === 0) break;

				data.data.forEach(server => {
					this.servers[server.id] = {
						invite_code: server.invite_code,
						guild_id: server.guild_id,
						name: server.name,
						icon: server.icon,
						banner: server.banner,
						splash: server.splash,
						members: server.members,
						members_total: server.members_total,
						votes: server.votes,
						votes_total: server.votes_total,
						updated: server.updated
					};
				});
			}catch{
				Logger.warn(`Failed to fetch Discord Server page ${i}`);
			}

			await setTimeout(1000);
		}
	}

	static async crawl(id){
		Logger.silly(`Crawling Discord Server #${id}`);
		await setTimeout(500);
		let result = await fetch('https://discord.com/api/v10/invites/' + this.servers[id].invite_code + '?with_counts=true&with_expiration=true');
		if(!result.ok || result.status !== 200) return;
		let output = await result.json();

		if(typeof(output.guild?.name) !== 'string' || typeof(output.approximate_member_count) !== 'number') return;

		this.servers[id].name = output.guild?.name;
		this.servers[id].icon = output.guild?.icon;
		this.servers[id].banner = output.guild?.banner;
		this.servers[id].splash = output.guild?.splash;

		this.servers[id].members = output.approximate_presence_count;
		this.servers[id].members_total = output.approximate_member_count;

		this.servers[id].updated = new Date().toISOString();
		this.updatedServers.add(Number(id));
	}

	static async runCrawler(delay){
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
				if(delay !== 0) await setTimeout(delay);
			}catch{}
		}
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
			Logger.debug(`Batching page ${pages} of Discord Servers`);
			let offset = limit * i;

			let limitedData = [];
			for(let j = offset; j < (offset+limit); j++){
				if(j >= data.length) break;
				limitedData.push(data[j]);
			}

			let response = await fetch('https://api.rabbitserverlist.com/v1/servers/discord/crawler', {
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

			Logger.info(`${json.data.updated} Discord servers successfully updated.`);
			if(json.data.total !== json.data.updated){
				Logger.warn(`Only ${json.data.updated} Discord servers has been updated successfully out of ${json.data.total}.`);
			}

		}

		this.updatedServers.clear();
	}

}