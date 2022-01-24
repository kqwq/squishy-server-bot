import { allQuery, postCard } from "../util/card.js";
import { fetchProxy } from "../util/proxyAPIs.js";
import { MessageEmbed, MessageAttachment } from 'discord.js';
import fs from "fs";

export default {
  slashCommandInfo: {
    name: 'search',
    type: 1,
    description: 'Search from the database',
    options: [{
      name: "term",
      description: "Word or phrase to search for",
      type: 3,
      required: true
    }],
  },
  callback: async (interaction, args, client, db) =>{
    await interaction.deferReply();

    let term = args.getString('term');
    term = term.replace(/\%/g, '\\%');
    let query = `SELECT * FROM posts WHERE content LIKE '%${term}%' ORDER BY date ASC`;
    await postCard(db, query, interaction);
  }
}

    