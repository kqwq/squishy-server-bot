import { allQuery } from "../util/card.js";
import { fetchProxy } from "../util/proxyAPIs.js";
import { MessageEmbed, MessageAttachment } from 'discord.js';
import fs from "fs";

export default {
  slashCommandInfo: {
    name: 'friends',
    type: 1,
    description: 'Get your KA friends',
    options: [{
      name: "username",
      description: "Khan Academy username or KAID",
      type: 3,
      required: true
    }],
  },
  
    
  callback: async (interaction, args, client, db) => {
    await interaction.deferReply();

    /*
    blurb = optional string that appears for some users
    
    */

    // Get your profile stats
    let usernameInupt = args.getString('username')
    let res = await fetchProxy(`profile`, usernameInupt);
    let json = await res.json();
    let myProfile = json.data?.user 
    if (!myProfile) {
      interaction.editReply("Couldn't find the user " + usernameInupt);
      return
    }
    let myKaid = myProfile.id
    let myNick = myProfile.nickname
    

    /* Get friends */
    // Get list of your parent IDs from answers and replies
    let query = `SELECT * FROM posts WHERE (authorKaid = '${myKaid}' AND (type = 'answer' OR type = 'reply'))`;
    let rows = await allQuery(db, query);
    let parentIds = rows.map(row => row.parentId);
    parentIds = [...new Set(parentIds)];

    // Get list of kaids 
    query = `SELECT authorKaid FROM posts WHERE (type = 'question' OR type = 'comment') AND id IN (${parentIds.join(',')})`;
    rows = await allQuery(db, query);
    let kaids = rows.map(row => row.authorKaid);
    let kaidCounts = []
    kaids.forEach(kaid => {
      let match = kaidCounts.find(item => item.kaid === kaid);
      if (match) {
        match.count++;
      } else {
        kaidCounts.push({
          kaid: kaid,
          count: 1
        });
      }
    });
    kaidCounts.sort((a, b) => b.count - a.count);

    // Remove self
    kaidCounts.splice(kaidCounts.findIndex(item => item.kaid === myKaid), 1);

    // Gather stats

    let top5 = kaidCounts.slice(0, 5);
    let usernames = await Promise.all(top5.map(item => fetchProxy(`profile`, item.kaid).then(res => res.json())
    .then(json => `[${json.data?.user?.nickname || "unknown"}](https://www.khanacademy.org/profile/${json.data?.user?.id})`)));
    let desc = `${myNick}'s best friends are ${usernames.join(', ')}.`;

    // Create embed
    let embed = new MessageEmbed({
      title: `Friends`,
      description: desc,
    })

    // Send message
    interaction.editReply({
      embeds: [embed],
    });



    
  }
}