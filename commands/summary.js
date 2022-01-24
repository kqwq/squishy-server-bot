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
      interaction.editReply("Couldn't find the user " + usernameInupt);
      return
    }
    let myKaid = myProfile.id
    let myUsername = myProfile.username
    let myNick = myProfile.nickname

    /* About */
    let myPosts = await allQuery(db, `SELECT * FROM posts WHERE authorKaid = '${myKaid}' LIMIT 50000`);
    let nickMentions = await allQuery(db, `SELECT * FROM posts WHERE content LIKE '%${myNick}%' LIMIT 25000`);
    let usernameMentions = await allQuery(db, `SELECT * FROM posts WHERE content LIKE '%${myUsername}%' LIMIT 25000`);
    let allMentions = nickMentions.concat(usernameMentions).sort((a, b) => b.upvotes - a.upvotes);
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
    let mostPopularPronoun = pronouns.they > pronouns.he ? "they" : (pronouns.he > pronouns.she ? "he" : "she")
    let pronounCount = pronouns[mostPopularPronoun];
    let pronounPercent = Math.round(pronounCount / numOfPronouns * 100);

    fs.writeFileSync(`./pronouns.json`, JSON.stringify({
      "pronouns": pronouns,
      "mostPopularPronoun": mostPopularPronoun,
      "pronounCount": pronounCount,
      "pronounPercent": pronounPercent,

    }));
    
    
    /* Gossip */
    let hasGossip = allMentions.length > 0
    if (hasGossip) {
      /*
      Ok, this is a little hard to explain. 
      Basically, we want the *root* of the post.
      So if a reply contains a mention, add the root (comment) to the list. 
      If a comment contains a mention, add the comment to the list because the parentId is 0.
      */
      let notificationRoots = []
      for (let post of allMentions) {
        notificationRoots.push(post.parentId ? post.parentId : post.id)
      }
      notificationRoots = [...new Set(notificationRoots)]
      console.log(notificationRoots)
      // Select every post that mentions myKaid, but exclude the ones where I'm the author
      let gossip = await allQuery(db, 
        `SELECT * FROM posts 
        WHERE (content LIKE '%${myNick}%' OR content LIKE '%${myUsername}%')  
        AND parentId NOT IN (${notificationRoots.join(',')})
        AND id NOT IN (${notificationRoots.join(',')})`)
        

        console.log(gossip.length)
      fs.writeFileSync(`./gossip.json`, JSON.stringify(gossip));
    } 



    /* Get friends */
    // Get list of your parent IDs from answers and replies
    
    let parentIds = myPosts.filter(r => r.type === "reply" || r.type === "answer").map(row => row.parentId);
    parentIds = [...new Set(parentIds)];

    // Get list of kaids 
    let query = `SELECT authorKaid FROM posts WHERE (type = 'question' OR type = 'comment') AND id IN (${parentIds.join(',')})`;
    let rows = await allQuery(db, query);
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
    let top3 = friendships.slice(0, 3);
    let usernames = await Promise.all(top3.map(item => fetchProxy(`profile`, item.kaid).then(res => res.json()).then(json => json.data.user.username)));
   // let reply = `${userInupt} has a crush on ${usernames.join(', ')}.`;

    // Compile sections
    let sectionAbout = `${myNick} is a ${praises} person.${roleplayBlurb} It appears that ${myNick}'s pronouns are ${pronounGrammar[mostPopularPronoun]} (${pronounPercent}%) based on what his friends say. But let's see what your friends really have to say about you, ${myNick}:`

    let sectionGossip = hasGossip ? `${invisibleGossip}
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