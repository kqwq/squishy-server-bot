import { allQuery, postCard } from "../util/card.js";
import fs from "fs";

export default {
  slashCommandInfo: {
    name: 'random',
    type: 1,
    description: 'Send a random post',
  },
  callback: async (interaction, args, client, db) =>{
    await interaction.deferReply();
    let query = `SELECT * FROM posts ORDER BY RANDOM() LIMIT 1`;
    await postCard(db, query, interaction);
  }
}

    