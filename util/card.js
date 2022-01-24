import { MessageEmbed, MessageAttachment } from 'discord.js';
import { svg2png } from 'svg-png-converter';
import { fetchKA } from "./proxyAPIs.js"
import fs from "fs";
import fetch from 'node-fetch';


async function getQuery(db, query) {
  return new Promise((resolve, reject) => {
    db.get(query, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function allQuery(db, query) {
  return new Promise((resolve, reject) => {
    db.all(query, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function downloadFile(url, path) {
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(path);
  await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on("error", reject);
      fileStream.on("finish", resolve);
    });
};



async function postCard(db, query, interaction, isDMs) {

  // Fetch data
  let row = await getQuery(db, query); // Fetch row
  let json = await fetchKA(`profile`, row.authorKaid); // Fetch profile
  let profile = json.data.user
  json = await fetchKA(`avatarDataForProfile`, row.authorKaid); // Fetch avatar
  let avatar = json.data?.user?.avatar

  // Avatar handling
  let pngPath = ""
  if (avatar) {
    let avatarSrc = avatar.imageSrc
    let [ avatarName, extension ] = avatarSrc.split('/').at(-1).split(".")
    // check if avatarName exists in ./storage/avatar
    let srcPath = `./storage/avatar/${avatarName}.${extension}`
    pngPath = `./storage/avatar/${avatarName}.png`
    if (!fs.existsSync(pngPath)) {
      // download avatar
      await downloadFile(avatarSrc, srcPath)
      if (extension === "svg") {
        // convert svg to png
        let outputBuffer = await svg2png({ 
          input: fs.readFileSync(srcPath), 
          encoding: 'buffer', 
          format: 'png',
        })
        // delete svg
        fs.unlinkSync(srcPath)
        fs.writeFileSync(pngPath, outputBuffer)
      }
    }
  } else {
    pngPath = "./storage/avatar/deleted.png"
  }
  let avatarFile = new MessageAttachment(pngPath, "avatar.png");

  // Get scratchpad data
  let scratchpad = await getQuery(db, `SELECT * FROM scratchpads WHERE programId = '${row.programId}'`);

  // Get parent key if type is reply
  if (row.type === "reply") {
    let parentRow = await getQuery(db, `SELECT * FROM posts WHERE id = '${row.parentId}'`);
    row.key = parentRow.key;
  }

  // Create embed
  let embed = new MessageEmbed({
    title: capitalize(row.type) + " by " + profile.nickname,
    description: row.content.length > 4090 ? row.content.slice(0, 4090) + '...' : row.content,
    thumbnail: {
      url: "attachment://avatar.png",
    },
    timestamp: row.date,
    footer: {
      text: `From ${scratchpad.title}`,
      icon_url: `https://www.khanacademy.org/cs/i/${row.programId}/latest.png`,
    },
  })

  if (row.upvotes !== 1) {
    embed.addField("Votes", row.upvotes, true);
  }
  if (row.flags !== "") {
    embed.addField("Flags", row.flags, true);
  }

  embed.addField("Links", `[Thread](https://www.khanacademy.org/cs/d/${row.programId}?qa_expand_key=${row.key}) / [Profile](https://www.khanacademy.org/profile/${row.avatarKaid})`, true);



  let message = {
    embeds: [embed],
    files: [avatarFile],
  }
  if (isDMs) { 
    interaction.reply(message); 
  } else {
    interaction.editReply(message);
  }
}

export { allQuery, getQuery, postCard };