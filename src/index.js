#!/usr/bin/env node

import { Command } from 'commander';
import Logger from '@rabbit-company/logger';
import * as dotenv from 'dotenv';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import Utils from './utils.js';
import Minecraft from "./servers/minecraft.js";

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
	.version('1.0.0')
	.option('-t, --token <string>', 'cloudflare token')
	.option('-p, --port <number>', '', 9090)
	.option('-l, --logger <number>', 'logger level', 2);

program.parse();

const options = program.opts();
let token = (typeof(options.token) !== 'undefined') ? options.token : process.env.CRAWLER_SECRET_TOKEN;
const port = (options.port <= 65535 && options.logger >= 1) ? options.port : 9090;
const loggerLever = (options.logger <= 6 && options.logger >= 0) ? options.logger : 2;

Logger.level = loggerLever;

Logger.info("-----------------------------------");
Logger.info("Listening on port: " + port);
Logger.info("Logger level: " + loggerLever);
Logger.info("-----------------------------------");

setInterval(async function(){
	Logger.info('Fetching data');
	await Minecraft.getServers();
}, 1_800_000);

setInterval(async function(){
	Logger.info('Uploading data');
	await Minecraft.uploadData(token);
}, 60_000);

setTimeout(async function(){
	Logger.info('Starting fetcher');
	await Minecraft.getServers();
	Logger.info('Starting crawler');
	await Minecraft.runCrawler();
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

serve({ fetch: app.fetch, port: port });