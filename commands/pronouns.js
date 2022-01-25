import { allQuery } from "../util/card.js";
import { fetchKA, fetchProxy } from "../util/proxyAPIs.js";
import { MessageEmbed, MessageAttachment } from 'discord.js';
import fs from "fs";

export default {
  slashCommandInfo: {
    name: 'pronouns',
    type: 1,
    description: 'Get the most common pronouns for a given user.',
    options: [{
      name: "username",
      description: "Khan Academy username or KAID",
      type: 3,
      required: true
    }],
  },
  callback: async(interaction, args, client, db) => {
    await interaction.deferReply();

    // Username handling
    let usernameInupt = args.getString('username')
    let res = await fetchProxy(`profile`, usernameInupt);
    let json = await res.json();
    let myProfile = json.data?.user
    if (!myProfile) {
      interaction.editReply("Couldn't find the user " + usernameInupt);
      return
    }
    let myKaid = myProfile.id
    let myUsername = myProfile.username
    let myNick = myProfile.nickname
    console.log(`${interaction.member.nickname} requested pronouns for ${myNick}/${myUsername}`);

    // Get all mentions
    let allMentions = await allQuery(db, `SELECT * FROM posts WHERE (content LIKE '%${myNick}%' OR content LIKE '%${myUsername}%') LIMIT 50000`);

    // Pronoun classifier
    let pronouns = {
      "he": 0,
      "she": 0,
      "they": 0,
    }
    let pronounGrammar = {
      "he": "he/him",
      "she": "she/her",
      "they": "they/them",
    }
    let possessiveGrammar = {
      "he": "his",
      "she": "her",
      "they": "their",
    }
    let numOfPronouns = 0;
    for (let i = 0; i < allMentions.length; i++) {
      let post = allMentions[i];
      // he/him/his
      if (post.content.match(/\b(he|him|his)\b/)) {
        pronouns.he++;
        numOfPronouns++;
      } else if (post.content.match(/\b(she|her|hers)\b/)) {
        pronouns.she++;
        numOfPronouns++;
      } else if (post.content.match(/\b(they|them|their|theirs)\b/)) {
        pronouns.they++;
        numOfPronouns++;
      }
    }
    let mostPopularPronoun = pronouns.they >= pronouns.he ? "they" : (pronouns.he > pronouns.she ? "he" : "she")


    let desc = numOfPronouns > 0 ? `
    ${myNick} is most commonly referred to as **${pronounGrammar[mostPopularPronoun]}**.

he/him - ${Math.round(pronouns.he / numOfPronouns * 100)}%
she/her - ${Math.round(pronouns.she / numOfPronouns * 100)}%
they/them - ${Math.round(pronouns.they / numOfPronouns * 100)}%`
:
`Unknown`
    // Create embed
    let embed = new MessageEmbed({
      title: `Pronouns for ${myNick}`,
      description: desc,
    })

    interaction.editReply({
      embeds: [embed]
    });
  }
}