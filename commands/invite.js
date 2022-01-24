

export default {
  slashCommandInfo: {
    name: 'invite',
    type: 1,
    description: 'Inviets the bot',
  },
  callback: async (interaction, args, client, db) => {
    interaction.reply('https://discord.com/api/oauth2/authorize?client_id=934493217376833636&permissions=2147534912&scope=bot%20applications.commands');
  }

}