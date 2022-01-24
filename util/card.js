import { MessageEmbed, MessageAttachment } from 'discord.js';
import { svgToPng } from 'svg-png-converter';
import { fetchKA } from "./KAProxy.js"
import fs from "fs";


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
    db.get(query, (err, rows) => {
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
  let avatar = json.data.user

  // Avatar handling
  let avatarSrc = avatar.imageSrc
  let [ avatarName, extension ] = avatarSrc.split('/').at(-1).split(".")
  // check if avatarName exists in ./storage/avatar
  let srcPath = `./storage/avatar/${avatarName}.${extension}`
  let pngPath = `./storage/avatar/${avatarName}.png`
  if (!fs.existsSync(pngPath)) {
    // download avatar
    await downloadFile(avatarSrc, avatarPath)
    if (extension === "svg") {
      // convert svg to png
      let outputBuffer = await svg2png({ 
        input: fs.readFileSync(srcPath), 
        encoding: 'buffer', 
        format: 'png',
      })
      fs.writeFileSync(pngPath, outputBuffer)
    }
  }

  // Get scratchpad data
  let scratchpad = await getQuery(db, `SELECT * FROM scratchpads WHERE programId = '${row.id}'`);



  // Create embed
  let embed = new MessageEmbed({
    title: capitalize(row.type) + " by " + profile.nickname,
    description: row.content.length > 4090 ? row.content.slice(0, 4090) + '...' : row.content,
  })

  let message = {
    embeds: [embed],
    files: [],
  }
  if (isDMs) { 
    interaction.reply(message); 
  } else {
    interaction.editReply(message);
  }
}

export { allQuery, getQuery, postCard };