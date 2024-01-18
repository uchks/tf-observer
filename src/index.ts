//
//  index.ts
//  tf-observer
//
//  Finished by uchks on 1/1/2024.
//  Copyright © 2024 uchks. All rights reserved.
//
//  Made for Enmity: 
//  https://discord.gg/Enmity / https://enmity.app

// logError logs errors to the console
// logEvent logs "events" to the console

// imports
import { config } from 'dotenv';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  TextChannel,
  Channel,
  SlashCommandBuilder,
  Interaction,
  CacheType,
  ColorResolvable,
  ChatInputCommandInteraction,
  PermissionsBitField,
  ChannelType,
  ActivityType,
  GuildMember,
  REST
} from 'discord.js';
import axios from 'axios';
import fs from 'fs/promises';
import { Routes } from 'discord-api-types/v9';

// initialize dotenv right away
config();

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
const SETTINGS_FILE = 'settings.json';

// interfaces
interface BotSettings {
  latestVersion: string;
  channelId: string;
}

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

// state encapsulation
class BotState {
  updatesRoleId: string = '';
  updateInterval: NodeJS.Timeout | null = null;
  latestVersion: string = '0.0';
  channelId: string = '';
  settings: BotSettings = { latestVersion: '0.0', channelId: '' };

  // load settings.json
  async loadSettings() {
    try {
      const settingsText = await fs.readFile(SETTINGS_FILE, 'utf-8');
      this.settings = JSON.parse(settingsText) as BotSettings;
      this.latestVersion = this.settings.latestVersion ?? '0.0';
      this.channelId = this.settings.channelId ?? process.env.CHANNEL_ID ?? "";
      logEvent('Settings', `Loaded settings: ${settingsText}`);
    } catch (error) {
      logError('Load Settings', error);
      this.latestVersion = '0.0'; 
      this.channelId = process.env.CHANNEL_ID ?? "";
    }
  }

  // save settings.json
  async saveSettings() {
    this.settings = {
      latestVersion: this.latestVersion, // saves latestVersion (so it doesn't send excess embeds)
      channelId: this.channelId // saves channelId (used for the command)
    };
    try {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf-8');
      logEvent('Settings', `Settings updated: ${JSON.stringify(this.settings)}`);
    } catch (error) {
      logError('Save Settings', error);
    }
  }

  async saveChannelId(channelId: string) {
    this.channelId = channelId;
    await this.saveSettings();
  }
}

const botState = new BotState();

// bot start
client.once('ready', async () => {
  logEvent('Bot', 'Bot is online!');
  try {
    // Set the bot's presence
    if (client.user) {
      client.user.setPresence({
        status: 'dnd',
        activities: [{
          name: 'for T.F. Updates',
          type: ActivityType.Watching
        }]
      });
    } else {
      logError('Client', 'The client is not initialized.');
    }

    const guild = await client.guilds.fetch(GUILD_ID);
    const updatesRole = guild.roles.cache.find(role => role.name === 'TestFlight Updates');
    botState.updatesRoleId = updatesRole ? updatesRole.id : '';
    await botState.loadSettings();
    botState.updateInterval = setInterval(() => fetchAndSendData().catch(err => logError('Interval fetchAndSendData', err)), 10 * 60 * 1000); // runs every 10 minutes
  } catch (error) {
    logError('Starting Bot', error);
  }
});
;

client.login(BOT_TOKEN).catch(error => {
  logError('Login Failed', error);
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
    .setFooter({ text: 'com.hammerandchisel.discord' }); // static bundleId for the footer cba
}

async function fetchAndSendData(forceSend = false, ping = true) {
    try {
    const channel = client.channels.cache.get(botState.channelId) as Channel;
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

    const roleMention = ping && botState.updatesRoleId ? `<@&${botState.updatesRoleId}>` : "";
    const currentVersion = platform.build.cfBundleVersion;

    // this sends an embed if latestVersion /=/ currentVersion (see constant above) or if someone triggers the manual update command
    if (botState.latestVersion !== currentVersion || forceSend) {
      botState.latestVersion = currentVersion;
      await botState.saveSettings();
      const embed = createUpdateEmbed({
        title: `New build released - ${platform.build.cfBundleShortVersion} (${currentVersion})`,
        description: `${platform.build.whatsNew}`,
        fields: [
          { name: 'Release Date', value: `<t:${Math.floor(new Date(platform.build.releaseDate).getTime() / 1000)}:D>`, inline: true }, // follow testflight app detail listing
          { name: 'Expires', value: `<t:${Math.floor(new Date(platform.build.expiration).getTime() / 1000)}:f>`, inline: true },
          { name: 'Size', value: `${(platform.build.fileSizeUncompressed / 1000000).toFixed(1)} MB`, inline: true }
        ]
      });
      logEvent('Update', 'Sending an embed...');
      const sentMessage = await channel.send({ content: roleMention, embeds: [embed] });
      if (channel.type === ChannelType.GuildAnnouncement) {
        await sentMessage.crosspost()
          .then(() => logEvent('Publish Message', 'Message published to announcement channel.'))
          .catch(error => logError('Publish Message', error));
      }
    }
  } catch (error) {
    logError('Fetching and Sending Data', error);
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('sets the channel to send update embeds to')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send updates')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('giverole')
    .setDescription('gives you the TestFlight update notification role'),
  new SlashCommandBuilder()
    .setName('removerole')
    .setDescription('removes the TestFlight update notification role'),
  new SlashCommandBuilder()
    .setName('manualupdate')
    .setDescription('manually trigger an update message')
    .addBooleanOption(option => 
      option.setName('ping') // god forbid i ping anyone when i test.
      .setDescription('Choose whether to ping the update role')
      .setRequired(false))
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(BOT_TOKEN);

// "dev mode", required for reloading slash commands
(async () => {
  if (DEV_MODE) {
    try {
      console.log(`[${rgb(88, 101, 242, 'tf-observer')}]: Started refreshing application (/) commands.`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`[${rgb(88, 101, 242, 'tf-observer')}]: Successfully reloaded application (/) commands.`);
    } catch (error) {
      logError('Reloading Commands', error);
    }
  }
})();

// slash (application) commands
client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
  if (!interaction.isCommand() || !interaction.inGuild()) return;

  const commandInteraction = interaction as ChatInputCommandInteraction;

  try {
    if (!commandInteraction.guild) {
      await commandInteraction.reply('This command can only be used in a server.');
      return;
    }

    const { commandName } = commandInteraction;
    const member = commandInteraction.member as GuildMember;

    // set channel command, allows a staff member to set the channel for embeds to send to (primarily used for debugging tbh)
    if (commandName === 'setchannel') {
      try {
        if (!commandInteraction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels)) {
          return void await commandInteraction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const channel = commandInteraction.options.getChannel('channel', true) as TextChannel;
        if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
          return void await commandInteraction.reply({ content: 'Please specify a valid text or announcement channel.', ephemeral: true });
        }

        const newChannelId = channel.id;
        await botState.saveChannelId(newChannelId);
        await interaction.reply({ content: `Channel successfully set to ${channel.name}`, ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: `Failed to set the channel. Error: ${error}`, ephemeral: true });
      }
    }

    // give role command, allows user to receive the pinging role
    if (commandName === 'giverole') {
      const role = commandInteraction.guild.roles.cache.find(role => role.name === 'TestFlight Updates');
      if (role) {
        await member.roles.add(role);
        await commandInteraction.reply({ content: 'You will now be notified with TestFlight updates.', ephemeral: true });
      } else {
        await commandInteraction.reply({ content: 'Update role not found. Please ping <@326237293612367873>.', ephemeral: true });
      }
    }

    // remove role command, allows user to remove the pinging role
    if (commandName === 'removerole') {
      const role = commandInteraction.guild.roles.cache.find(role => role.name === 'TestFlight Updates');
      if (role) {
        await member.roles.remove(role);
        await commandInteraction.reply({ content: 'You will no longer be notified of TestFlight Updates.', ephemeral: true });
      } else {
        await commandInteraction.reply({ content: 'Update role not found. Please ping <@326237293612367873>.', ephemeral: true });
      }
    }

    // manual update command, forces an embed to send
    if (commandName === 'manualupdate') {
      if (!commandInteraction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return void await commandInteraction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      }

      const shouldPingRole = commandInteraction.options.getBoolean('ping') ?? true;
      await commandInteraction.deferReply({ ephemeral: true });

      try {
        await fetchAndSendData(true, shouldPingRole);
        await commandInteraction.editReply('Update notification forced and sent.');
      } catch (error) {
        await commandInteraction.editReply('Failed to force send an update notification.');
        logError('Force Send Update Command', error);
      }
    }
  } catch (error) {
    console.error('Interaction Create', error);
    if (commandInteraction.isRepliable()) {
      await commandInteraction.reply('An error occurred while processing your command.').catch(console.error);
    }
  }
});

// handle bot shutdown gracefully
process.on('SIGINT', async () => {
  logEvent('Bot', 'Bot is shutting down...');
  if (botState.updateInterval) clearInterval(botState.updateInterval);
  await client.destroy();
  process.exit();
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection', `Reason: ${reason}\nPromise: ${promise}`);
});

// error logging
function logError(context: string, error: any) {
  const message = typeof error === 'string' ? error : `${error.message}\nStack: ${error.stack}`;
  console.error(`[${new Date().toISOString()}] [Error] [${context}] ${message}`);
}

// event logging
function logEvent(context: string, message: string) {
  console.log(`[${new Date().toISOString()}] [${context}] ${message}`);
}

// rgb :3
function rgb(r: number, g: number, b: number, msg: string): string {
  return `\x1b[38;2;${r};${g};${b}m${msg}\x1b[0m`;
}
