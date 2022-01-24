import { allQuery } from "../util/card.js";
import { fetchProxy } from "../util/proxyAPIs.js";
import { MessageEmbed, MessageAttachment } from 'discord.js';
import fs from "fs";

export default {
  slashCommandInfo: {
    name: 'summary',
    type: 1,
    description: 'Get DMed a summary of your Khan Academy activity',
    options: [{
      name: "username",
      description: "Your Khan Academy username or KAID",
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
      interaction.editReply("Couldn't find the user " + userInupt);
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

    // Gather stats
    let friendships = kaidCounts.filter(item => item.count > 1);

    let usernames = await Promise.all(top5.map(item => fetchProxy(`profile`, item.kaid).then(res => res.json()).then(json => json.data.user.username)));
    let reply = `${userInupt} has a crush on ${usernames.join(', ')}.`;

    // Compile sections
    let sectionAbout = `${myNick} is a ${praises} person.${roleplayBlurb} It appears that ${myNick}'s pronouns are ${pronouns} (${Math.floor(pronounsConfidence * 100)}) based on what his friends say. But let's see what your friends really have to say about you, ${myNick}:`

    let sectionGossip = hasGossip ? `${visibleGossip}
    Your friends mentioned you ${visibleMentions + invisibleMentions} times and talked behind your back ${invisibleMentions} times! It looks like you go by your ${isGoByNickname ? "nickname" : "username"} more than your ${isGoByNickname ? "username" : "nickname"}, but I've included both cases in the file \`gossip.json\` attached below.`
    :
    `It doesn't look like you're very popular, ${myNick}. You've never been mentioned by your friends - oh wait, you don't have any!`

    let sectionPatterns = `You created your account an impressive ${accountAge} years ago! Since then, you've commented ${numOfComments} times on the top programs.${notMuchCommentsBlurb} Most notably, you ${askVsAnswer}. That's ${askVsAnswerHigher}% higher than average. You should be proud of youself for ${reasonToBeProud}!`

    let sectionFriends = hasFriends ? `Now for the fun part... I estimate that you have ${numOfFriends} friends on Khan Academy. The full list is in the file \`friends.json\`. However, your friends talk more often than you, so maybe they aren't real friends. Some of your best friends are ${bestFriends}.`
    :
    `You don't have any friends on Khan Academy. What a loser.`

    let sectionCrush = hasCrush ? `Finally, ${myNick}'s Khan Academy crush. My calculations say there's a ${Math.floor(crushConfidence * 100)}% chance you have a crush on ${crushOn}! How cute! You've known each other since ${crushKnownSince} and have exchanged conversations well over 50 times!` 
    : 
    `My calculations say there's a ${Math.floor(crushConfidence * 100)}% chance you have a Khan Academy crush. That's right, you probably don't have a crush on anyone. What a shame!`
  
    let desc = `
**About**
${sectionAbout}

**Gossip**
${sectionGossip}

** Patterns**
${sectionPatterns}

**Friends**
${sectionFriends}

**Crush**
${sectionCrush}
${leakBlurb}`;

    // Create embed
    let embed = new MessageEmbed({
      title: 'Summary for ' + userInupt,
      description: desc,
    })
    let files = []


    // Send message
    interaction.editReply({
      embeds: [embed],
      files: [files]
    });



    
  }
}