#!/usr/bin/env node

import { Command } from 'commander';
import Logger from '@rabbit-company/logger';
import * as dotenv from 'dotenv';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import Utils from './utils.js';

import Minecraft from './servers/minecraft.js';
import Discord from './servers/discord.js';

const app = new Hono();
app.use('*', cors({
	origin: '*',
	allowHeaders: ['*'],
	allowMethods: ['POST', 'OPTIONS'],
	maxAge: 86400,
	credentials: true,
}));

dotenv.config();

const program = new Command();

program
	.name('rsl-crawler')
	.description('Simple crawler for Rabbit Server List')
	.version('2.0.0')
	.option('-t, --token <string>', 'cloudflare token')
	.option('-p, --port <number>', '', 9090)
	.option('-l, --logger <number>', 'logger level', 2)
	.option('-f, --fetcher <number>', 'fetch new servers (minutes)', 10)
	.option('-u, --upload <number>', 'upload server data (minutes)', 1)
	.option('-d, --delay <number>', 'delay for crawler (milliseconds)', 1000);

program.parse();

const options = program.opts();
let token = (typeof(options.token) !== 'undefined') ? options.token : process.env.CRAWLER_SECRET_TOKEN;
const port = (options.port <= 65535 && options.logger >= 1) ? options.port : 9090;
const loggerLever = (options.logger <= 6 && options.logger >= 0) ? options.logger : 2;
const fetcher = (options.fetcher <= 60 && options.fetcher >= 1) ? options.fetcher : 10;
const upload = (options.upload <= 60 && options.upload >= 1) ? options.upload : 1;
const delay = (options.delay <= 60_000 && options.delay >= 0) ? options.delay : 1000;

Logger.level = loggerLever;

Logger.info("-----------------------------------");
Logger.info("Listening on port: " + port);
Logger.info("Logger level: " + loggerLever);
Logger.info("Fetch servers every " + fetcher + " minute(s).");
Logger.info("Upload server data every " + upload + " minute(s).");
Logger.info("Crawl next server after " + delay + " millisecond(s).");
Logger.info("-----------------------------------");

setInterval(async function(){
	Logger.info('Fetching data');
	await Minecraft.getServers();
	await Discord.getServers();
}, 1000 * 60 * fetcher);

setInterval(async function(){
	Logger.info('Uploading data');
	await Minecraft.uploadData(token);
	await Discord.uploadData(token);
}, 1000 * 60 * upload);

setTimeout(async function(){
	Logger.info('Starting fetchers');
	await Minecraft.getServers();
	await Discord.getServers();
	Logger.info('Starting crawlers');
	Minecraft.runCrawler(delay);
	Discord.runCrawler(delay);
}, 100);

app.post('/v1/servers/minecraft/vote', async request => {

	let data = {};
	try{
		data = await request.req.json();
	}catch{
		return Utils.jsonResponse({ 'error': 1000, 'info': 'Not all required data provided in json format.' });
	}

	if(
		typeof(data['authToken']) !== 'string' ||
		typeof(data['ip']) !== 'string' ||
		typeof(data['port']) !== 'number' ||
		typeof(data['token']) !== 'string' ||
		typeof(data['username']) !== 'string'
	) return Utils.jsonResponse({ 'error': 1000, 'info': 'Not all required data provided in json format.' });

	if(token !== data['authToken']) return Utils.jsonResponse({ 'error': 9999, 'info': 'Your do not have permission to perform this action.' })

	return await Minecraft.sendServerVote(data['ip'], data['port'], data['token'], data['username']).then(() => {
		return Utils.jsonResponse({ 'error': 0, 'info': 'success' });
	}).catch(() => {
		return Utils.jsonResponse({ 'error': 5000, 'info': 'Something went wrong while trying to send vote' });
	});
});

app.post('/v2/servers/minecraft/vote', async request => {

	let data = {};
	try{
		data = await request.req.json();
	}catch{
		return Utils.jsonResponse({ 'error': 1000, 'info': 'Not all required data provided in json format.' });
	}

	if(
		typeof(data['authToken']) !== 'string' ||
		typeof(data['votes']) !== 'object'
	) return Utils.jsonResponse({ 'error': 1000, 'info': 'Not all required data provided in json format.' });

	if(token !== data['authToken']) return Utils.jsonResponse({ 'error': 9999, 'info': 'Your do not have permission to perform this action.' })

	let success = [];
	let error = [];
	for(let i = 0; i < data['votes'].length; i++){
		await Minecraft.sendServerVote(data['votes'][i].ip, data['votes'][i].port, data['votes'][i].token, data['votes'][i].username).then(() => {
			success.push(data['votes'][i].id);
		}).catch(() => {
			error.push(data['votes'][i].id);
		});
	}

	return Utils.jsonResponse({ 'error': 0, 'info': 'success', 'delivered': success, 'failed': error });
});

serve({ fetch: app.fetch, port: port });