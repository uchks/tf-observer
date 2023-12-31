// imports
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import { Client, GatewayIntentBits, EmbedBuilder, TextChannel } from 'discord.js';
import axios from 'axios';
import fs from 'fs/promises';

// .env configuration
const envPath = resolve(process.cwd(), '.env');
config({ path: envPath });

// constants / variables
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const rgb: (r: number, g: number, b: number, msg: string) => string = (r, g, b, msg) =>
  `\x1b[38;2;${r};${g};${b}m${msg}\x1b[0m`;
let latestVersion = '0.0';
const channelId: string = process.env.CHANNEL_ID || '';
const botToken = process.env.BOT_TOKEN
const fetchUrl: string = process.env.FETCH_URL || '';

// debugging .env (uncomment if you need to debug)
// console.log('Current working directory:', process.cwd());
// console.log('__filename:', __filename);
// console.log('__dirname:', __dirname);
// console.log('envPath:', envPath);
// console.log('Bot Token:', botToken);
// console.log('channel id:', channelId);

// on launch
client.once('ready', () => {
  console.log(`[${rgb(88, 101, 242, 'tf-observer')}]: Wait 10 minutes...`); // message sent to the console
  setInterval(fetchAndSendData, 10 * 60 * 1000); // fetchAndSendData runs at every 10 minutes.
});

async function loadLatestVersion() { // function to read the contents of "latestVersion.txt"
  try {
    const versionFileContents = await fs.readFile('latestVersion.txt', 'utf-8');
    latestVersion = versionFileContents.trim();
    console.log(`[${rgb(88, 101, 242, 'tf-observer')}]: Loaded latestVersion from file: ${latestVersion}`);
  } catch (error) { // error handling
    console.error(`[${rgb(88, 101, 242, 'tf-observer')}]: Error reading latestVersion from file:`, error);
  }
}

async function saveLatestVersion() { // function to save the contents of "latestVersion.txt"
  try {
    await fs.writeFile('latestVersion.txt', latestVersion, 'utf-8');
  } catch (error) { // error handling
    console.error(`[${rgb(88, 101, 242, 'tf-observer')}]: Error saving latestVersion to file:`, error);
  }
}

client.login(botToken); // logging into the bot

async function fetchAndSendData() { // function to fetch data from Cloudflare Worker and send it in a readable format as an embed
  try {
    const channel = client.channels.cache.get(channelId) as TextChannel;

    if (!channel) { // error handling
      console.error(`[${rgb(88, 101, 242, 'tf-observer')}]: Invalid channel or channel is not a text channel.`);
      return;
    }

    // constants / variables
    const response = await axios.get(fetchUrl);
    const data = response.data;

    if (!data.platforms || data.platforms.length === 0) { // error handling
      console.error(`[${rgb(88, 101, 242, 'tf-observer')}]: Invalid or missing platforms array in the received data.`);
      return;
    }

    const platform = data.platforms[0]; // error handling
    if (!platform || !platform.build) {
      console.error('Invalid or missing build information in the received data.');
      return;
    }

    // constant / variable
    const currentVersion = platform.build.cfBundleVersion;

    if (latestVersion !== currentVersion) { // basically says if contents of latestVersion.txt doesn't equal the constant above, do the below 
      latestVersion = currentVersion;
      await saveLatestVersion(); // runs the saveLatestVersion function to save and store latestVersion into the .txt file

      // debugging only. just logs the variables to the console. (uncomment if you need to debug)
      //console.log(`Latest Version: ${latestVersion}`);
      //console.log(`Stored Version: ${currentVersion}`);

      const fileSizeMB = (platform.build.fileSizeUncompressed / (1024 * 1024)).toFixed(2);  // math to make the filesize output and a more digestible format

      const embed = new EmbedBuilder() // creates the embed, self-explanatory
        .setColor('#0099ff')
        .setThumbnail('https://is3-ssl.mzstatic.com/image/thumb/Purple116/v4/fa/bf/43/fabf4352-a22e-4f88-796a-5e4bae0c4688/AppIcon-0-0-1x_U007epad-0-0-0-85-220.png/1920x1080bb-80.png')
        .setAuthor({ name: 'Discord - Chat, Talk & Hangout' })
        .setTitle(`New build released - ${platform.build.cfBundleShortVersion} (${currentVersion})`)
        .setDescription('We\'ve got a new beta!')
        .addFields(
          { name: 'Uploaded', value: `<t:${Math.floor(new Date(platform.build.releaseDate).getTime() / 1000)}:f>`, inline: true }, // math for unix timestamp
          { name: 'Expires', value: `<t:${Math.floor(new Date(platform.build.expiration).getTime() / 1000)}:f>`, inline: true }, // math for unix timestamp
          { name: 'Filesize', value: `${fileSizeMB} MB`, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: data.bundleId });

      // logs to the console an update was found, and the bot will be sending an embed.
      console.log(`[${rgb(88, 101, 242, 'tf-observer')}]: Update found! Sending an embed...`);
      channel.send({ embeds: [embed] });
    }
  } catch (error) { // error handling
    console.error('Error fetching data:', error);
  }
}

// loads latestVersion when the bot starts
loadLatestVersion();
