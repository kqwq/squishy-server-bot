import { allQuery } from "../util/card.js";
import { fetchKA, fetchProxy } from "../util/proxyAPIs.js";
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
    let praises = []
    let myPosts = await allQuery(db, `SELECT * FROM posts WHERE authorKaid = '${myKaid}' LIMIT 50000`);
    let nickMentions = await allQuery(db, `SELECT * FROM posts WHERE content LIKE '%${myNick}%' LIMIT 25000`);
    let usernameMentions = await allQuery(db, `SELECT * FROM posts WHERE content LIKE '%${myUsername}%' LIMIT 25000`);
    let allMentions = nickMentions.concat(usernameMentions).sort((a, b) => b.upvotes - a.upvotes);
    if (allMentions.length > 50) {
      praises.push("famous")
    } else if (allMentions.length > 25) {
      praises.push("popular")
    } else if (allMentions.length > 10) {
      praises.push("respected")
    } else if (allMentions.length > 5) {
      praises.push("normal")
    } else if (allMentions.length > 1) {
      praises.push("helpful")
    } else {
      praises.push("lonely")
    }
    let isGoByNickname = nickMentions > usernameMentions;
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

    // Cringe classifier
    let criteria = (p) => {
      return p.content.split("*").length >= 4 && // Contains expressions
      p.content.length / p.content.split("\n").length < 40 && // Many line breaks
      !p.content.includes("function()") && // Not code
      !p.content.includes("var ") &&
      !p.content.includes("https://www.")  // No links
    }
    let cringePosts = myPosts.filter(criteria)
    let cringeSum = cringePosts.length;
    let roleplayBlurb = ""
    let isCringe = false;
    if (cringeSum > myPosts.length / 4) {
      isCringe = true;
      praises.push("cringe-worthy")
      roleplayBlurb = `I say cringe-worthy because ${cringeSum}/${myPosts.length}, or ${Math.round(cringeSum / myPosts.length * 100)}% of your discussion is classified as roleplay! :pensive:`
      fs.writeFileSync(`./temp/cringe.json`, cringePosts.map(p => p.content).join("\n\n\n"));
    } 

    
    /* Gossip */
    let visibleMentions = []
    let invisibleMentions = []
    let hasGossip = allMentions.length > 0
    let invisibleGossip = ""
    if (hasGossip) {
      /*
      Ok, this is a little hard to explain. 
      Basically, we want the *root* of the post.
      So if a reply contains a mention, add the root (comment) to the list. 
      If a comment contains a mention, add the comment to the list because the parentId is 0.
      */
      let myRoots = []
      for (let myPost of myPosts) {
        myRoots.push(myPost.parentId ? myPost.parentId : myPost.id)
      }
      myRoots = [...new Set(myRoots)]
      
      for (let post of allMentions) {
        let mentionRoot = post.parentId ? post.parentId : post.id
        if (myRoots.includes(mentionRoot)) {
          visibleMentions.push(post)
        } else {
          invisibleMentions.push(post)
        }
      }

      // Find invisible gossip
      let allGossip = []
      let gossipWords = [
        "copied", "plagiarized", "banned",
        "always", "never", "acts", "likes", "loves", "hates", "is", "was", "isn't", "wasn't",
       "must", "mustn't", "might", "should", "shouldn't", "could", "couldn't", "would", "wouldn't",
       "has", "had", "hasn't", "hadn't", "got", "get",
      "said", "says", "tell", "told"]
      for (let post of invisibleMentions) {
        let content = post.content
        let sentences = content.split(".")
        for (let sentence of sentences) {
          // Capture the second word of the sentence
          let matchThis = new RegExp(`\\b(${myNick}|${mostPopularPronoun}) (\\w+)\\b`, "i")
          let match = sentence.match(matchThis)
          if (match) {
            let secondWord = match[0].split(" ")[1]
            let index = gossipWords.indexOf(secondWord)
            if (index > -1) {
              allGossip.push({
                content: sentence,
                author: post.authorKaid,
                score: 1000 / (index + 1) + post.upvotes,
              })
            }
          }
        }
      }
      // Sort by score
      allGossip.sort((a, b) => b.score - a.score)
      let gossip = allGossip.slice(0, 3)
      for (let i = 0; i < allGossip.length; i ++) {
        if (i < 3) {
          let json = await fetchKA("profile", allGossip[i].author)
          allGossip[i].nickname = json.data?.user?.nickname || "Unknown"
        } else {
          allGossip[i].nickname = allGossip[i].author
        }
        allGossip[i].formatted = `- *${allGossip[i].content}* by [${allGossip[i].nickname}](https://www.khanacademy.org/profile/${allGossip[i].author})`
      }
      invisibleGossip = allGossip.slice(3).join("\n")



      /// DEBUGGING
      ////////////////////////////
      fs.writeFileSync(`./temp/gossip.txt`, invisibleGossip);
      fs.writeFileSync(`./temp/known.json`, JSON.stringify(visibleMentions));
      fs.writeFileSync(`./temp/a.json`, JSON.stringify({
        invisibleMentions: invisibleMentions.length,
        visibleMentions: visibleMentions.length,
      }));
    } 

    /* Patterns */

    // Account age
    let accountDays = Math.round((new Date() - new Date(myProfile.joined)) / (1000 * 60 * 60 * 24));
    let accountYears = Math.round(accountDays / 365);

    // Posts
    let notMuchCommentsBlurb = ""
    if (myPosts.length < 10) {
      notMuchCommentsBlurb = " Honestly that's not a lot, maybe you should comment more often :smirk:."
    }

    // askVsAnswer
    let questionCount = 86897
    let answerCount = 29228
    let overallRatio = questionCount / answerCount
    let askVsAnswer = ""
    let askVsAnswerHigher = false
    let reasonToBeProud = ""
    let myQuestionsLength = myPosts.filter(p => p.type === "question").length
    let myAnswersLength = myPosts.filter(p => p.type === "answer").length
    let myRatio = myQuestionsLength / myAnswersLength
    if (myRatio >= overallRatio && myQuestionsLength > 2) {
      praises.push("curious")
      reasonToBeProud = "You have such an open mind"
      askVsAnswer = `asked questions ${(myAnswersLength/myQuestionsLength).toFixed(1)} as often as you answered them`
      askVsAnswerHigher = ((myRatio - overallRatio) * 100).toFixed(0)
    } else if (myRatio < overallRatio && myAnswersLength > 2) {
      praises.push("altruistic")
      reasonToBeProud = "You should be proud of yourself for providing so many helpful answers to the community"
      askVsAnswer = `answered questions ${(myAnswersLength/myQuestionsLength).toFixed(1)} as often as you asked them`
      askVsAnswerHigher = (1/(1/myRatio - 1/overallRatio) * 100).toFixed(0)
    } else {
      praises.push("observant")
      reasonToBeProud = "You should help people out more often"
      askVsAnswer = "didn't use the question/answer tab very often."
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
    let hasFriends = friendships.length > 0;
    let bestFriendsTxt = ""
    if (hasFriends) {
      let top3 = friendships.slice(1, 4);
      let usernames = await Promise.all(top3.map(item => fetchProxy(`profile`, item.kaid).then(res => res.json())
      .then(json => `[${json.data?.user?.nickname || "unknown"}](https://www.khanacademy.org/profile/${json.data?.user?.id})`)));
      bestFriendsTxt = `Some of your best friends are ${usernames.join(', ')}`;
      fs.writeFileSync(`./temp/bestFriends.txt`, friendships.map(item => `${item.kaid} ${item.count}`).join('\n'));
    }

    /* Crush */
    let crush = friendships?.[0]
    let hasCrush= crush.count > 10
    let crushEarlyContact = new Date()
    let crushNickname
    let crushRatio
    if (hasCrush) {
      for (let row of rows) {
        let date = new Date(row.date)
        if (date < crushEarlyContact) {
          crushEarlyContact = date
        }
      }
      crushEarlyContact = `${crushEarlyContact.getMonth} ${crushEarlyContact.getDate}, ${crushEarlyContact.getFullYear}`
      let crushJson = await fetchKA(`profile`, crush.kaid)
      crushNickname = crushJson.data?.user?.nickname || crush.kaid
      let friendInteractions = friendships.reduce((acc, item) => acc + item.count, 0)
      let crushInteractions = crush.count
      crushRatio = crushInteractions / friendInteractions
    }

    /* Leaks */
    let emails = []
    for (let post of myPosts) {
      // Check for email string
      let matches = post.content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
      matches?.forEach(email => {
        emails.push(email)
      })
    }
    let leakBlurb = ""
    if (emails.length > 0) {
      leakBlurb = `P.S. You've leaked ${emails.length} emails. You should probably hide them.`
    }

    
    

    // Compile sections
    let sectionAbout = `${myNick} is a ${praises} person.${roleplayBlurb} It appears that ${myNick}'s pronouns are ${pronounGrammar[mostPopularPronoun]} (${pronounPercent}%) based on what his friends say. But let's see what your friends really have to say about you, ${myNick}:`

    let sectionGossip = hasGossip ? `${invisibleGossip}
    Your friends mentioned you ${allMentions.length} times and talked behind your back ${invisibleMentions.length} times! It looks like you go by your ${isGoByNickname ? "nickname" : "username"} more than your ${isGoByNickname ? "username" : "nickname"}, but I've included both cases in the file \`gossip.txt\` attached below.`
    :
    `It doesn't look like you're very popular, ${myNick}. You've never been mentioned by your friends - oh wait, you don't have any!`

    let sectionPatterns = `You created your account an impressive ${accountYears} years ago! Since then, you've commented ${myPosts.length.toLocaleString()} times on the top programs.${notMuchCommentsBlurb} Most notably, you ${askVsAnswer}. ${askVsAnswerHigher ? `That's ${askVsAnswerHigher}% higher than average.` : ""} ${reasonToBeProud}!`

    let sectionFriends = hasFriends ? `Now for the fun part... I estimate that you have ${friendships.length} friends on Khan Academy. The full list is in the file \`friends.txt\`. However, your friends talk more often than you, so maybe they aren't real friends. ${bestFriendsTxt}.`
    :
    `You don't have any friends on Khan Academy. What a loser.`

    let sectionCrush = hasCrush ? `Finally, ${myNick}'s Khan Academy crush. My calculations say there's a ${Math.floor(crushRatio * 100)}% chance you have a crush on ${crushNickname}! How cute! You've known each other since ${crushEarlyContact} and have exchanged conversations well over 50 times!` 
    : 
    `My calculations say there's a ${Math.floor(crushRatio * 100)}% chance you have a Khan Academy crush. That's right, you probably don't have a crush on anyone. What a shame!`
  
    let desc = `
**About**
${sectionAbout}

**Gossip**
${sectionGossip}

**Patterns**
${sectionPatterns}

**Friends**
${sectionFriends}

**Crush**
${sectionCrush}
${leakBlurb}`;

    // Create embed
    let embed = new MessageEmbed({
      title: 'Summary for ' + myNick,
      description: desc,
    })
    //let files = []


    // Send message
    interaction.editReply("Send via DMs");


    
    // Send to DMs
    await interaction.member.send({
      embeds: [embed],
     // files: [files]
    })


    
  }
}