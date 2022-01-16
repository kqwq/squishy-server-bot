import { Client, Intents } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { takeScreenshot } from './util/ss.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const config = JSON.parse(fs.readFileSync('./config.json'));
const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

let spellcheckWords = config.spellcheckWords;




function similarity(s1, s2) {
  var longer = s1;
  var shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  var longerLength = longer.length;
  if (longerLength == 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}
function editDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  var costs = new Array();
  for (var i = 0; i <= s1.length; i++) {
    var lastValue = i;
    for (var j = 0; j <= s2.length; j++) {
      if (i == 0)
        costs[j] = j;
      else {
        if (j > 0) {
          var newValue = costs[j - 1];
          if (s1.charAt(i - 1) != s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue),
              costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0)
      costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}



const commands = [{
  name: 'ping',
  description: 'Replies with Pong!'
},
{
  name: 'add-spellcheck',
  type: 1,
  description: 'Add a word to the aggressive spellcheck list',
  options: [{
    name: "word",
    description: "Word to add to the spellcheck list",
    type: 3,
    required: true
  }]
},
{
  name: 'remove-spellcheck',
  type: 1,
  description: 'Remove a word from the aggressive spellcheck list',
  options: [{
    name: "word",
    description: "Word to remove from the spellcheck list",
    type: 3,
    required: true
  }]
},
{
  name: 'list-spellcheck',
  type: 1,
  description: 'List all words in the aggressive spellcheck list'
},
{
  name: 'invite-me',
  type: 1,
  description: 'Invite me to your server!'
},
{
  name: 'ss',
  type: 1,
  description: 'Takes a screenshot of a webpage and sends it to the channel',
  options: [{
    name: "url",
    description: "URL of the webpage to take a screenshot of",
    type: 3,
    required: true
  }]
}


];


client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);



  // Register global slash commands
  // await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  // // Delete all commands


  // //Register local slash commands
  // await rest.put(
  //   Routes.applicationGuildCommands(process.env.CLIENT_ID, "372895163279998976"),
  //   { body: commands },
  // );

  console.log('Started refreshing application (/) commands.');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  if (interaction.channel.id === config.infoChannel) {
    // Fail if the interaction is not in the info channel
    await interaction.reply({ content: 'This command can\'t be used in the info channel', ephemeral: true });
  } else if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  } else if (interaction.commandName === 'add-spellcheck') {
    let word = interaction.options.getString("word")
    spellcheckWords.push(word)
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    await interaction.reply('Added ' + word + ' to the spellcheck list');

  } else if (interaction.commandName === 'remove-spellcheck') {
    let word = interaction.options.getString("word")
    let index = spellcheckWords.indexOf(word)
    if (index > -1) {
      spellcheckWords.splice(index, 1)
      fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
      await interaction.reply('Removed ' + word + ' from the spellcheck list');
    } else {
      await interaction.reply('That word is not in the spellcheck list');
    }
  } else if (interaction.commandName === 'list-spellcheck') {
    let list = spellcheckWords.join(', ')
    await interaction.reply('The spellcheck list contains: ' + list)
  } else if (interaction.commandName === 'invite-me') {
    await interaction.reply('https://discord.com/api/oauth2/authorize?client_id=910975177872011334&permissions=2147534912&scope=bot%20applications.commands')
  } else if (interaction.commandName === 'ss') {
    await interaction.deferReply()
    let { success, isBlocked, url } = await takeScreenshot(interaction.options.getString("url"))
    if (isBlocked) {
      await interaction.editReply({ content: 'This website is blocked.' })
    } else if (success) {
      await interaction.editReply({
        content: 'Here\'s your screenshot of `' + url + '`',
        files: ['./storage/example.png'] 
      })
    } else {
      await interaction.editReply(`Could not take screenshot of \`${url}\``);
    }
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.channelId === config.infoChannel) {
    // Delete the message if it's in the info channel
    await message.delete();
    return
  }


  // Agressive spellchecker
  let words = message.content.split(' ');
  for (let needle of spellcheckWords) {
    for (let word of words) {
      similarity = editDistance(needle, word)
      if (similarity <= 2 && similarity > 0) {
        console.log(similarity, needle, word);
        await message.channel.send(`You misspelled **${needle}** as **${word}**!`);
      }
    }
  }


});



client.login(process.env.DISCORD_TOKEN);