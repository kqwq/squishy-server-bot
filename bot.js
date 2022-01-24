import { Client, Intents } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import fs from 'fs';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { postCard } from './util/card.js';


dotenv.config();
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES],
partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });

const config = JSON.parse(fs.readFileSync('./config.json'));
const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

// Load commands with import
let commands = [];
let commandFiles = await fs.readdirSync('./commands');
commandFiles = commandFiles.filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  commands.push(command.default);
}

// Load sqlite3 database
const db = new sqlite3.Database('./storage/tt.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the posts database.');
});


client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);


  let slashCommands = commands.map(c => c.slashCommandInfo)

  // Register global slash commands
  // await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });

  //Register local slash commands
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, "910970288580206622"),
    { body: slashCommands },
  );

  console.log('Started refreshing application (/) commands.');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const interactionCommand = interaction.commandName;
  const args = interaction.options
  const command = commands.find(c => c.slashCommandInfo.name === interactionCommand);
  if (!command) return;
  try {
    command.callback(interaction, args, client, db);
  } catch (e) {
    console.error(e);
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Check if message is a command

    if (message.channel.type === 'DM') {
      let messageStr = message.content 
      console.log(messageStr, " sent by ", message.author.username)
      // search for messageStr
      let query = `SELECT * FROM posts WHERE content LIKE '%${messageStr}%' ORDER BY date ASC`
          postCard(db, query, message, true)


    }
  


});




client.login(process.env.DISCORD_TOKEN);