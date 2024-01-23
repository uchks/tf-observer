//
//  index.ts
//  tf-observer
//
//  Finished by uchks on 1/1/2024.
//  Copyright © 2024 uchks. All rights reserved.
//
//  Made for Enmity: 
//  https://discord.gg/Enmity / https://enmity.app

// imports
import { config } from 'dotenv';
config(); // initialize dotenv right away

import {
 Client,
 GatewayIntentBits,
 EmbedBuilder,
 Channel,
 ColorResolvable,
 ChannelType,
 ActivityType,
 REST
} from 'discord.js';
import axios from 'axios';
import { Routes } from 'discord-api-types/v9';
import { commands, setupCommandListeners } from './commands.js';
import { loadSettings, saveSettings, initDB } from './libs/database.js';

// validate essential environment variables
const essentialVariables = ['BOT_TOKEN', 'GUILD_ID', 'CLIENT_ID'];
for (const variable of essentialVariables) {
 if (!process.env[variable]) {
  console.error(`Missing required environment variable: ${variable}`);
  process.exit(1);
 }
}

// constants / variables
const BOT_TOKEN = process.env.BOT_TOKEN as string;
const GUILD_ID = process.env.GUILD_ID as string;
const CLIENT_ID = process.env.CLIENT_ID as string;
const FETCH_URL = process.env.FETCH_URL ?? "";
const APP_NAME = process.env.APP_NAME ?? "";
const EMBED_COLOR: ColorResolvable = process.env.EMBED_COLOR as ColorResolvable || '#5865F2';
const EMBED_THUMBNAIL_URL = process.env.EMBED_THUMBNAIL_URL ?? null;
const DEV_MODE = process.env.DEV_MODE === 'true';
export const UPDATES_ROLE_ID = '1191802397731868722'; // change this to your role id to ping
const colors = {
 reset: '\x1b[0m',

 fg: {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
 },
};

export enum LogLevel {
 INFO = 'Info',
 WARN = 'Warning',
 ERROR = 'Error',
}

// interfaces
interface EmbedData {
 title: string;
 description: string;
 fields: { name: string; value: string; inline: boolean }[];
}

// client intents
const client = new Client({
 intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMembers,
 ],
});

// bot start
let updateInterval: string | number | NodeJS.Timeout | null | undefined = null;

client.once('ready', async () => {
 logMessage(LogLevel.INFO, 'Bot', 'Bot is online!');
 try {
  await initDB();
  if (client.user) {
   client.user.setPresence({
    status: 'dnd',
    activities: [{
     name: 'for T.F. Updates',
     type: ActivityType.Watching
    }]
   });
  } else {
   logMessage(LogLevel.ERROR, 'Client', 'The client is not initialized.');
  }

  updateInterval = setInterval(async () => {
   try {
    await fetchAndSendData(UPDATES_ROLE_ID, false, true);
   } catch (err) {
    logMessage(LogLevel.ERROR, 'Interval fetchAndSendData', err);
   }
  }, 10 * 60 * 1000); // runs every 10 minutes
 } catch (error) {
  logMessage(LogLevel.ERROR, 'Starting Bot', error);
 }
});

client.login(BOT_TOKEN).catch(error => {
 logMessage(LogLevel.ERROR, 'Login Failed', error);
});

// embed. yessssssss
function createUpdateEmbed(data: EmbedData): EmbedBuilder {
 return new EmbedBuilder()
  .setColor(EMBED_COLOR)
  .setThumbnail(EMBED_THUMBNAIL_URL)
  .setAuthor({ name: APP_NAME })
  .setTitle(data.title)
  .setDescription(data.description)
  .addFields(data.fields)
  .setTimestamp()
  .setFooter({ text: 'com.hammerandchisel.discord' }); // static bundleId for the footer, cba
}

export async function fetchAndSendData(updatesRoleId: string, forceSend: boolean, ping: boolean) {
 try {
  const settings = await loadSettings();
  const channelId = settings.channelId;
  const latestVersion = settings.latestVersion;

  const channel = client.channels.cache.get(channelId) as Channel;
  if (!channel || !(channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) {
   throw new Error('Invalid or not a text/announcement channel.');
  }

  const response = await axios.get(FETCH_URL);
  const data = response.data;

  if (!data.platforms || data.platforms.length === 0) {
   throw new Error('Invalid or missing platforms array in the received data.');
  }

  const platform = data.platforms[0];
  if (!platform || !platform.build) {
   throw new Error('Invalid or missing build information in the received data.');
  }
  
  const roleMention = ping && updatesRoleId ? `<@&${updatesRoleId}>` : "";
  const currentVersion = platform.build.cfBundleVersion;

  // Send an embed if latestVersion is different from currentVersion or if forceSend is true
  if (latestVersion !== currentVersion || forceSend) {
   // Prepare the embed
   const embed = createUpdateEmbed({
    title: `New build released - ${platform.build.cfBundleShortVersion} (${currentVersion})`,
    description: `${platform.build.whatsNew}`,
    fields: [
     { name: 'Release Date', value: `<t:${Math.floor(new Date(platform.build.releaseDate).getTime() / 1000)}:D>`, inline: true },
     { name: 'Expires', value: `<t:${Math.floor(new Date(platform.build.expiration).getTime() / 1000)}:f>`, inline: true },
     { name: 'Size', value: `${(platform.build.fileSizeUncompressed / 1000000).toFixed(1)} MB`, inline: true }
    ]
   });

   // Send the embed
   logMessage(LogLevel.INFO, 'Update', 'Sending an embed...');
   const sentMessage = await channel.send({ content: roleMention, embeds: [embed] });

   // Publish the message if it's an announcement channel
   if (channel.type === ChannelType.GuildAnnouncement) {
    await sentMessage.crosspost()
     .then(() => logMessage(LogLevel.INFO, 'Publish Message', 'Message published to announcement channel.'))
     .catch(error => logMessage(LogLevel.ERROR, 'Publish Message', error));
   }

   // Update the settings with the new version
   await saveSettings(channelId, currentVersion);
  }
 } catch (error) {
  logMessage(LogLevel.ERROR, 'Fetching and Sending Data', error);
 }
}

const rest = new REST({ version: '9' }).setToken(BOT_TOKEN);

// "dev mode", required for reloading slash commands
(async () => {
 if (DEV_MODE) {
  try {
   console.log(`[${colors.fg.blue}tf-observer${colors.reset}]: Started refreshing application (/) commands.`);
   await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
   console.log(`[${colors.fg.blue}tf-observer${colors.reset}]: Successfully reloaded application (/) commands.`);
  } catch (error) {
   let errorMessage: string;
   if (error instanceof Error) {
    errorMessage = error.message;
   } else {
    errorMessage = String(error);
   }
   logMessage(LogLevel.ERROR, 'Reloading Commands', errorMessage);
  }
 }
})();

setupCommandListeners(client, UPDATES_ROLE_ID);

// handle bot shutdown gracefully
process.on('SIGINT', async () => {
 logMessage(LogLevel.WARN, 'Bot', 'Bot is shutting down...');
 if (updateInterval) clearInterval(updateInterval);
 await client.destroy();
 process.exit();
});

process.on('unhandledRejection', (reason, promise) => {
 logMessage(LogLevel.ERROR, 'Unhandled Rejection', `Reason: ${reason}\nPromise: ${promise}`);
});

// consolidated logging for information, warnings, and errors
export function logMessage(level: LogLevel, context: string, message: string | unknown) {
 const timestamp = new Date().toISOString();
 let color;

 switch (level) {
  case LogLevel.INFO:
   color = colors.fg.green;
   break;
  case LogLevel.WARN:
   color = colors.fg.yellow;
   break;
  case LogLevel.ERROR:
   color = colors.fg.red;
   break;
  default:
   color = colors.reset;
 }

 console.log(`[${timestamp}] ${color}[${level}: ${context}] ${message}${colors.reset}`);
}