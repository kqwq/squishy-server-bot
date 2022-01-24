

export default {
  slashCommandInfo: {
    name: 'ping',
    type: 1,
    description: 'Pings the bot',
  },
  callback: async (interaction, args, client, db) => {
    interaction.reply('pong');
  }

}