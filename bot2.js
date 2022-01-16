const discord = require("discord.js");
const dotenv = require("dotenv");
dotenv.config();

const client = new discord.Client({
  intents: [
    "GUILDS",
    "GUILD_MESSAGES"
  ]
});

client.once("ready", () => console.log("Logged in as " + client.user.tag));

client.login(process.env.DISCORD_TOKEN);