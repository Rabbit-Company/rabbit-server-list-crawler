#!/usr/bin/env node

import { Command } from 'commander';
import Logger from '@rabbit-company/logger';
import * as dotenv from 'dotenv';
import Minecraft from "./servers/minecraft.js";

dotenv.config();

const program = new Command();

program
	.name('rsl-crawler')
	.description('Simple crawler for Rabbit Server List')
	.version('1.0.0')
	.option('-t, --token <string>', 'cloudflare token')
	.option('-l, --logger <number>', 'logger level', 2);

program.parse();

const options = program.opts();
let token = (typeof(options.token) !== 'undefined') ? options.token : process.env.CRAWLER_SECRET_TOKEN;
const loggerLever = (options.logger <= 6 && options.logger >= 0) ? options.logger : 2;

Logger.level = loggerLever;

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