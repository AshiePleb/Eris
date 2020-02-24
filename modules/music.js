var bot = require("../bot.js").bot;
var settings = require("../bot.js").settings;
var data = require("../bot.js").data;
const superagent = require('superagent');

function shuffle(array) {
  pushBack = array[0];
  array = array.slice(1);
  var currentIndex = array.length, temporaryValue, randomIndex;
  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  array.splice(0, 0, pushBack)
  return array;
}
async function resolveTracks(node, search) {
  try {
    var result = await superagent.get(`http://${node.host}:${node.port}/loadtracks?identifier=${search}`)
      .set('Authorization', node.password)
      .set('Accept', 'application/json');
  }
  catch (err) {
    throw err;
  }
  if (!result) {
    throw "Unable to play that video.";
  }
  return result.body;
}
function getPlayer(channel) {
	if (!channel || !channel.guild) {
		return Promise.reject('Not a guild channel.');
	}
	let player = bot.voiceConnections.get(channel.guild.id);
	if (player) {
		return Promise.resolve(player);
	}
	return bot.joinVoiceChannel(channel.id);
}
function play(guild, song) {
  getPlayer(data.get("music." + guild.id + ".voice")).then(player => {
    if (!song || bot.guilds.get(guild.id).channels.get(data.get("music." + guild.id + ".voice").id).voiceMembers.size <= 1) {
      data.get("music." + guild.id + ".channel").createMessage({
        embed: {
          title: "Queue concluded."
        }
      });
      voice = data.get("music." + guild.id + ".voice");
      data.del("music." + guild.id);
      player.stop();
      return bot.leaveVoiceChannel(voice.id);
    }
    player.play(data.get("music." + guild.id + ".queue")[0].track);
    player.once("end", d => {
      try {
     	if (d.reason && d.reason === 'REPLACED') {return;}
      	original = data.get("music." + guild.id + ".queue");
      	const shifted = original.shift();
      	if (data.get("music." + guild.id + ".loop")) {original.push(shifted);}
      	data.set("music." + guild.id + ".queue", original);
      	data.del("music." + guild.id + ".skip");
      	if (original.length == 0) {next = null;}
      	else {next = original[0].track;}
      	return play(guild, next);
      }
      catch (err) {console.log("third useless error");}
    });
    player.once("disconnect", () => {
      data.del("music." + guild.id);
    });
    player.once("error", (err) => {
      console.log(err);
      data.del("music." + guild.id);
      try {player.stop();}
      catch (err) {console.log("useless error");}
      try {return bot.leaveVoiceChannel(data.get("music." + guild.id + ".voice").id);}
      catch (err) {console.log("another useless error");}
    });
    remaining = data.get("music." + guild.id + ".queue").length - 1;
    t = data.get("music." + guild.id + ".queue")[0];
    data.get("music." + guild.id + ".channel").createMessage({
      embed: {
        title: "Now playing",
        description: "[" + t.info.title + "](" + t.info.uri + ")",
        fields: [
          {
            name: "Uploader",
            value: t.info.author,
            inline: true
          },
          {
            name: "Duration",
            value: msToTime(t.info.length),
            inline: true
          },
          {
            name: "Remaining",
            value: remaining,
            inline: true
          }
        ],
        thumbnail: {
          url: "http://i3.ytimg.com/vi/" + t.info.identifier + "/hqdefault.jpg"
        },
        footer: {
          text: require("../bot.js").tag(t.requester) + " | ID: " + t.requester.id,
          icon_url: t.requester.avatarURL
        }
      }
    })
  });
}
function msToTime(ms) {
  hours = 0;
  minutes = 0;
  seconds = 0;
  preseconds = ms/1000;
  while (preseconds > 59) {minutes = minutes+1; preseconds = preseconds-60;}
  if (preseconds < 60) {
    while (minutes > 59) {hours = hours+1; minutes = minutes-60;}
    if (minutes < 60) {
      seconds = require("../bot.js").roundTo(preseconds, 0);
      array = [];
      if (hours > 0) {array.push(hours);}
      if (minutes < 10 && hours > 0) {minutes = "0" + minutes;}
      if (seconds < 10) {seconds = "0" + seconds;}
      array.push(minutes);
      array.push(seconds);
      final = array.join(":");
      if (final == "") {return "0:00"}
      return final;
    }
  }
}
function getBar(progress) {
  if (progress < 10) {return "🔘▬▬▬▬▬▬▬▬▬▬";}
  else if (progress < 20) {return "▬🔘▬▬▬▬▬▬▬▬▬";}
  else if (progress < 30) {return "▬▬🔘▬▬▬▬▬▬▬▬";}
  else if (progress < 40) {return "▬▬▬🔘▬▬▬▬▬▬▬";}
  else if (progress < 50) {return "▬▬▬▬🔘▬▬▬▬▬▬";}
  else if (progress < 60) {return "▬▬▬▬▬🔘▬▬▬▬▬";}
  else if (progress < 70) {return "▬▬▬▬▬▬🔘▬▬▬▬";}
  else if (progress < 80) {return "▬▬▬▬▬▬▬🔘▬▬▬";}
  else if (progress < 90) {return "▬▬▬▬▬▬▬▬🔘▬▬";}
  else if (progress < 95) {return "▬▬▬▬▬▬▬▬▬🔘▬";}
  else {return "▬▬▬▬▬▬▬▬▬▬🔘";}
}
function checkHost(guildId, member) {
  if (data.get("music." + guildId + ".host").id == member.id || member.permission.has("manageGuild")) {return true;}
  else {return false;}
}
function playMusic(trackName, obj, retry, addToQueue, insert) {
  resolveTracks(require("../bot.js").nodes[0], trackName).then(tracks => {
    if (tracks.tracks.length == 0 && retry) {playMusic("ytsearch:" + trackName, obj, false, addToQueue, insert);}
    else if (tracks.tracks.length == 0 && !retry) {obj.channel.createMessage("Your search yielded no results.");}
    else {
      if (tracks.loadType != "PLAYLIST_LOADED") {
        v = tracks.tracks[0];
        if (!v.info.isStream) {
          v.requester = {};
          v.requester.username = obj.member.username;
          v.requester.discriminator = obj.member.discriminator;
          v.requester.id = obj.member.id;
          v.requester.avatarURL = obj.member.avatarURL;
          v.requester.mention = obj.member.mention;
          if (addToQueue) {
            queue = data.get("music." + obj.channel.guild.id + ".queue");
            if (typeof queue != "object") {return obj.channel.createMessage("There was an error while adding to queue. Please try again in a moment. If the issue persists, try in another voice channel.");}
            mapped = queue.map(q => q.info.identifier);
            if (mapped.includes(v.info.identifier)) {return obj.channel.createMessage("This track is already in the queue (or currently playing)!");}
            time = data.get("music." + obj.channel.guild.id + ".queue")[0].info.length - (new Date() - bot.voiceConnections.get(obj.channel.guild.id).timestamp);
            ms = 0;
            if (insert) {queue.splice(1, 0, v); queuePos = 1;}
            else {queue.forEach((a, i) => {if (i != 0) {ms = ms + a.info.length}}); queuePos = queue.length;}
            ttp = ms + time;
            obj.channel.createMessage({
              embed: {
                title: "Added to queue",
                description: "[" + v.info.title + "](" + v.info.uri + ")",
                fields: [
                  {
                    name: "Uploader",
                    value: v.info.author,
                    inline: true
                  },
                  {
                    name: "Duration",
                    value: msToTime(v.info.length),
                    inline: true
                  },
                  {
                    name: "Time to Playing",
                    value: msToTime(ttp),
                    inline: true
                  },
                  {
                    name: "Position in Queue",
                    value: queuePos,
                    inline: true
                  }
                ],
                thumbnail: {
                  url: "http://i3.ytimg.com/vi/" + v.info.identifier + "/hqdefault.jpg"
                },
                footer: {
                  text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
                  icon_url: obj.member.avatarURL
                }
              }
            })
          }
          else if (!addToQueue) {
            queue = [];
            data.set("music." + obj.channel.guild.id + ".voice", obj.channel.guild.channels.get(obj.member.voiceState.channelID));
            data.set("music." + obj.channel.guild.id + ".channel", obj.channel);
            data.set("music." + obj.channel.guild.id + ".guild", obj.channel.guild);
            data.set("music." + obj.channel.guild.id + ".loop", false);
            host = {};
            host.id = obj.member.id;
            host.mention = obj.member.mention;
            data.set("music." + obj.channel.guild.id + ".host", host);
            data.set("music." + obj.channel.guild.id + ".settings.requireVote", true);
            data.set("music." + obj.channel.guild.id + ".settings.allowPlaylists", true);
            play(obj.channel.guild, v.track);
            obj.channel.createMessage({
              embed: {
                title: "Session Host",
                description: "Eris Music uses a system known as **Session Hosts** to control permissions.\nThe host is automatically set to the first person who requested a track.\n\n" + obj.member.mention + ": You may use `" + require("../bot.js").getPrefix(obj.channel) + "host` to modify the settings for this session.\nOnce the queue concludes, I will disconnect and the session will end.\nYour host privileges will be removed."
              }
            });
          }
          if (!insert) {queue.push(v);}
          data.set("music." + obj.channel.guild.id + ".queue", queue);
        }
        else {obj.channel.createMessage("Streams are not supported (for now). Sorry!");}
      }
      else if (insert) {obj.channel.createMessage("Playlists are not allowed with the insert command.");}
      else {
        v = tracks.tracks;
        arr = [];
        w = 0;
        v.forEach(a => {
          a.requester = {};
          a.requester.username = obj.member.username;
          a.requester.discriminator = obj.member.discriminator;
          a.requester.id = obj.member.id;
          a.requester.avatarURL = obj.member.avatarURL;
          a.requester.mention = obj.member.mention;
          if (!a.info.isStream) {arr.push(a);}
          else {w++;}
        });
        c = v.length - w;
        data.set("music." + obj.channel.guild.id + ".queue", arr);
        data.set("music." + obj.channel.guild.id + ".voice", obj.channel.guild.channels.get(obj.member.voiceState.channelID));
        data.set("music." + obj.channel.guild.id + ".channel", obj.channel);
        data.set("music." + obj.channel.guild.id + ".guild", obj.channel.guild);
        data.set("music." + obj.channel.guild.id + ".loop", false);
        host = {};
        host.id = obj.member.id;
        host.mention = obj.member.mention;
        data.set("music." + obj.channel.guild.id + ".host", host);
        data.set("music." + obj.channel.guild.id + ".settings.requireVote", true);
        data.set("music." + obj.channel.guild.id + ".settings.allowPlaylists", true);
        obj.channel.createMessage({
          embed: {
            title: "Added to queue",
            description: tracks.playlistInfo.name,
            fields: [
              {
                name: "Count",
                value: c,
                inline: true
              },
              {
                name: "Excluded",
                value: w,
                inline: true
              }
            ],
            footer: {
              text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
              icon_url: obj.member.avatarURL
            }
          }
        });
        play(obj.channel.guild, v[0].track);
        obj.channel.createMessage({
          embed: {
            title: "Session Host",
            description: "Eris Music uses a system known as **Session Hosts** to control permissions.\nThe host is automatically set to the first person who requested a track.\n\n" + obj.member.mention + ": You may use `" + require("../bot.js").getPrefix(obj.channel) + "host` to modify the settings for this session.\nOnce the queue concludes, I will disconnect and the session will end.\nYour host privileges will be removed."
          }
        });
      }
    }
  })
}

module.exports.play = play;
module.exports.resolveTracks = resolveTracks;
module.exports.getPlayer = getPlayer;
module.exports.checkHost = checkHost;
module.exports.playMusic = playMusic;
module.exports.commands = [{cmd: "play", desc: "Play something from YouTube.", perm: ["guildOnly"]}, {cmd: "p", desc: "Alias to `play`", perm: ["guildOnly"]}, {cmd: "insert", desc: "Insert a track into the first position.", perm: ["guildOnly"]}, {cmd: "np", desc: "Show the currently playing song.", perm: ["guildOnly"]}, {cmd: "queue", desc: "Show the queue.", perm: ["guildOnly"]}, {cmd: "q", desc: "Alias to `queue`", perm: ["guildOnly"]}, {cmd: "remove", desc: "Remove something from the queue.", perm: ["guildOnly"]}, {cmd: "r", desc: "Alias to `remove`", perm: ["guildOnly"]}, {cmd: "stop", desc: "Stop and clear the queue.", perm: ["guildOnly"]}, {cmd: "disconnect", desc: "Alias to `stop`", perm: ["guildOnly"]}, {cmd: "dc", desc: "Alias to `stop`", perm: ["guildOnly"]}, {cmd: "leave", desc: "Alias to `stop`", perm: ["guildOnly"]}, {cmd: "skip", desc: "Skip the current song.", perm: ["guildOnly"]}, {cmd: "s", desc: "Alias to `skip`", perm: ["guildOnly"]}, {cmd: "restart", desc: "Restart the current song.", perm: ["guildOnly"]}, {cmd: "loop", desc: "Loop the queue.", perm: ["guildOnly"]}, {cmd: "shuffle", desc: "Shuffle the queue.", perm: ["guildOnly"]}, {cmd: "clear", desc: "Clear the queue. Irreversible action.", perm: ["guildOnly"]}, {cmd: "host", desc: "Check host settings.", perm: ["guildOnly"]}];
module.exports.events = ["voiceChannelLeave", "voiceChannelSwitch"];
module.exports.actions = function (type, cmd, body, obj) {
  if (type == "command") {
    if (cmd == "play" || cmd == "p") {
      if (!obj.member.voiceState.channelID) {obj.channel.createMessage("You're not in a voice channel!");}
      else if (!body) {obj.channel.createMessage("You can search with `ytsearch`, or provide a URL or ID.\nExample: `" + require("../bot.js").getPrefix(obj.channel) + "play ytsearch:faded` or `" + require("../bot.js").getPrefix(obj.channel) + "play 60ItHLz5WEA`");}
      else if (!obj.channel.guild.channels.get(obj.member.voiceState.channelID).permissionsOf(bot.user.id).has("voiceConnect") || !obj.channel.guild.channels.get(obj.member.voiceState.channelID).permissionsOf(bot.user.id).has("voiceSpeak")) {obj.channel.createMessage("I do not have permissions to connect to or speak in that voice channel.");}
      else if (data.get("music." + obj.channel.guild.id) && obj.member.voiceState.channelID != data.get("music." + obj.channel.guild.id + ".voice").id) {obj.channel.createMessage("You're not in the same voice channel as the bot!");}
      else if (typeof obj.channel.guild.channels.get(obj.member.voiceState.channelID).voiceMembers.get(bot.user.id) != "object" && typeof data.get("music." + obj.channel.guild.id) != "object") {
        playMusic(encodeURI(body), obj, true, false, false);
      }
      else {
        playMusic(encodeURI(body), obj, true, true, false);
      }
    }
    if (cmd == "insert") {
      if (!obj.member.voiceState.channelID) {obj.channel.createMessage("You're not in a voice channel!");}
      else if (!body) {obj.channel.createMessage("You can search with `ytsearch`, or provide a URL or ID.\nExample: `" + require("../bot.js").getPrefix(obj.channel) + "insert ytsearch:faded` or `" + require("../bot.js").getPrefix(obj.channel) + "insert 60ItHLz5WEA`");}
      else if (typeof obj.channel.guild.channels.get(obj.member.voiceState.channelID).voiceMembers.get(bot.user.id) != "object" && typeof data.get("music." + obj.channel.guild.id) != "object") {obj.channel.createMessage("Cannot use insertion without items in queue!");}
      else if (data.get("music." + obj.channel.guild.id + ".queue").length <= 1) {obj.channel.createMessage("Cannot use insertion without items in queue!");}
      else if (!checkHost(obj.channel.guild.id, obj.member)) {obj.channel.createMessage("You're not the session host and you do not have the `manageGuild` permission!");}
      else {
        playMusic(encodeURI(body), obj, true, true, true);
      }
    }
    else if (cmd == "np") {
      if (!data.get("music." + obj.channel.guild.id)) {obj.channel.createMessage("I'm not playing anything right now.");}
      else {
        song = data.get("music." + obj.channel.guild.id + ".queue")[0];
        currentTime = new Date() - bot.voiceConnections.get(obj.channel.guild.id).timestamp;
        obj.channel.createMessage({
          embed: {
            title: "Now playing",
            description: "[" + song.info.title + "](" + song.info.uri + ")",
            fields: [
              {
                name: "Uploader",
                value: song.info.author,
                inline: true
              },
              {
                name: "Progress",
                value: getBar((currentTime/(song.info.length))*100) + " | " + msToTime(currentTime) + " / " + msToTime(song.info.length)
              }
            ],
            thumbnail: {
              url: "http://i3.ytimg.com/vi/" + song.info.identifier + "/hqdefault.jpg"
            },
            footer: {
              text: require("../bot.js").tag(song.requester) + " | ID: " + song.requester.id,
              icon_url: song.requester.avatarURL
            }
          }
        })
      }
    }
    else if (cmd == "queue" || cmd == "q") {
      if (!data.get("music." + obj.channel.guild.id)) {obj.channel.createMessage("I'm not playing anything right now.");}
      else {
        queue = data.get("music." + obj.channel.guild.id + ".queue");
        if (!isNaN(parseInt(body.split(" ")[0], 10)) && parseInt(body.split(" ")[0], 10) > 0 && parseInt(body.split(" ")[0], 10) <= Math.ceil((queue.length - 1) / 10)) {page = parseInt(body.split(" ")[0], 10);}
        else {page = 1;}
        n = 1 + (10 * (page - 1));
        arr = [];
        while (n < queue.length) {
          arr.push("`" + n + "` [" + queue[n].info.title + "](" + queue[n].info.uri + ") `[" + msToTime(queue[n].info.length) + "]`");
          n++;
        }
        final = arr.slice(0, 10);
        if (final.length > 0) {done = final.join("\n");}
        else {done = "Nothing left in queue!";}
        count = queue.length - 1;
        secondsTotal = 0;
        queue.forEach(function (a, i) {
          if (i != 0) {
            secondsTotal = secondsTotal + a.info.length;
          }
        });
        duration = msToTime(secondsTotal);
        if (Math.ceil((queue.length - 1) / 10) == 0) {highest = 1;}
        else {highest = Math.ceil((queue.length - 1) / 10);}
        song = data.get("music." + obj.channel.guild.id + ".queue")[0];
        obj.channel.createMessage({
          embed: {
            title: "Queue [" + page + "/" + highest + "]",
            description: done,
            footer: {
              text: "Count: " + count + " | Total Duration: " + duration
            }
          }
        });
      }
    }
    else if (cmd == "remove" || cmd == "r") {
      if (!body || isNaN(parseInt(body.split(" ")[0], 10))) {obj.channel.createMessage("Please specify the number of the item you are trying to remove!");}
      else if (!data.get("music." + obj.channel.guild.id)) {obj.channel.createMessage("I'm not playing anything right now.");}
      else if (obj.member.voiceState.channelID != data.get("music." + obj.channel.guild.id + ".voice").id) {obj.channel.createMessage("You're not in my voice channel!");}
      else if (parseInt(body.split(" ")[0], 10) >= data.get("music." + obj.channel.guild.id + ".queue").length || parseInt(body.split(" ")[0], 10) < 1) {obj.channel.createMessage("Please specify a number within range of `" + require("../bot.js").getPrefix(obj.channel) + "queue`.");}
      else if (data.get("music." + obj.channel.guild.id + ".queue")[parseInt(body.split(" ")[0], 10)].requester.id != obj.member.id && !checkHost(obj.channel.guild.id, obj.member)) {obj.channel.createMessage("That's not requested by you!");}
      else {
        queue = data.get("music." + obj.channel.guild.id + ".queue");
        obj.channel.createMessage({
          embed: {
            title: "Removed",
            description: "[" + queue[parseInt(body.split(" ")[0], 10)].info.title + "](" + queue[parseInt(body.split(" ")[0], 10)].info.uri + ")",
            footer: {
              text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
              icon_url: obj.member.avatarURL
            }
          }
        });
        queue.splice(parseInt(body.split(" ")[0], 10), 1);
        data.set("music." + obj.channel.guild.id + ".queue", queue);
      }
    }
    else if (cmd == "stop" || cmd == "disconnect" || cmd == "dc" || cmd == "leave") {
      if (!data.get("music." + obj.channel.guild.id)) {obj.channel.createMessage("I'm not playing anything right now. Am I stuck in your voice channel? Leave me alone for up to a minute and I should leave on my own.");}
      else if (obj.member.voiceState.channelID != data.get("music." + obj.channel.guild.id + ".voice").id) {obj.channel.createMessage("You're not in my voice channel!");}
      else if (!checkHost(obj.channel.guild.id, obj.member)) {obj.channel.createMessage("You're not the session host and you do not have the `manageGuild` permission!");}
      else {
        voice = data.get("music." + obj.channel.guild.id + ".voice");
        data.del("music." + obj.channel.guild.id);
        bot.leaveVoiceChannel(voice.id);
        obj.channel.createMessage({
          embed: {
            title: "Stopped, cleared queue and left the voice channel.",
            footer: {
              text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
              icon_url: obj.member.avatarURL
            }
          }
        });
      }
    }
    else if (cmd == "skip" || cmd == "s") {
      if (!data.get("music." + obj.channel.guild.id)) {obj.channel.createMessage("I'm not playing anything right now.");}
      else if (obj.member.voiceState.channelID != data.get("music." + obj.channel.guild.id + ".voice").id) {obj.channel.createMessage("You're not in my voice channel!");}
      else {
        if (data.get("music." + obj.channel.guild.id + ".queue")[0].requester.id == obj.member.id || checkHost(obj.channel.guild.id, obj.member) || !data.get("music." + obj.channel.guild.id + ".settings.requireVote")) {
          obj.channel.createMessage({
            embed: {
              title: "Skipped",
              description: "[" + data.get("music." + obj.channel.guild.id + ".queue")[0].info.title + "](" + data.get("music." + obj.channel.guild.id + ".queue")[0].info.uri + ")\nRequested by " + data.get("music." + obj.channel.guild.id + ".queue")[0].requester.mention,
              footer: {
                text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
                icon_url: obj.member.avatarURL
              }
            }
          });
          getPlayer(data.get("music." + obj.channel.guild.id + ".voice")).then(player => player.stop());
        }
        else {
          if (!data.get("music." + obj.channel.guild.id + ".skip")) {
            skipUsers = [];
            skipUsers.push(obj.member.id);
            data.set("music." + obj.channel.guild.id + ".skip.users", skipUsers);
            data.set("music." + obj.channel.guild.id + ".skip.required", Math.ceil((obj.channel.guild.channels.get(data.get("music." + obj.channel.guild.id + ".voice").id).voiceMembers.size - 1) / 2));
            obj.channel.createMessage({
              embed: {
                title: "Voted to skip (" + skipUsers.length + "/" + data.get("music." + obj.channel.guild.id + ".skip.required") + ")",
                footer: {
                  text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
                  icon_url: obj.member.avatarURL
                }
              }
            });
          }
          else if (!data.get("music." + obj.channel.guild.id + ".skip.users").includes(obj.member.id)) {
            skipUsers = data.get("music." + obj.channel.guild.id + ".skip.users");
            skipUsers.push(obj.member.id);
            data.set("music." + obj.channel.guild.id + ".skip.users", skipUsers);
            obj.channel.createMessage({
              embed: {
                title: "Voted to skip (" + skipUsers.length + "/" + data.get("music." + obj.channel.guild.id + ".skip.required") + ")",
                footer: {
                  text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
                  icon_url: obj.member.avatarURL
                }
              }
            });
          }
          else {
            obj.channel.createMessage({
              embed: {
                title: "You've already voted to skip (" + skipUsers.length + "/" + data.get("music." + obj.channel.guild.id + ".skip.required") + ")"
              }
            });
          }
          if (data.get("music." + obj.channel.guild.id + ".skip.users").length == data.get("music." + obj.channel.guild.id + ".skip.required")) {
            obj.channel.createMessage({
              embed: {
                title: "Skipped",
                description: "[" + data.get("music." + obj.channel.guild.id + ".queue")[0].info.title + "](" + data.get("music." + obj.channel.guild.id + ".queue")[0].info.uri + ")\nRequested by " + data.get("music." + obj.channel.guild.id + ".queue")[0].requester.mention,
                footer: {
                  text: "Voted"
                }
              }
            });
            getPlayer(data.get("music." + obj.channel.guild.id + ".voice")).then(player => {player.stop();});
          }
        }
      }
    }
    else if (cmd == "restart") {
      if (!data.get("music." + obj.channel.guild.id)) {obj.channel.createMessage("I'm not playing anything right now.");}
      else if (obj.member.voiceState.channelID != data.get("music." + obj.channel.guild.id + ".voice").id) {obj.channel.createMessage("You're not in my voice channel!");}
      else {
        if (checkHost(obj.channel.guild.id, obj.member) || !data.get("music." + obj.channel.guild.id + ".settings.requireVote")) {
          obj.channel.createMessage({
            embed: {
              title: "Restarted",
              description: "[" + data.get("music." + obj.channel.guild.id + ".queue")[0].info.title + "](" + data.get("music." + obj.channel.guild.id + ".queue")[0].info.uri + ")\nRequested by " + data.get("music." + obj.channel.guild.id + ".queue")[0].requester.mention,
              footer: {
                text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
                icon_url: obj.member.avatarURL
              }
            }
          });
          getPlayer(data.get("music." + obj.channel.guild.id + ".voice")).then(player => {player.seek(0); player.timestamp = new Date().getTime();});
          data.del("music." + obj.channel.guild.id + ".restart");
          data.del("music." + obj.channel.guild.id + ".skip");
        }
        else {
          if (!data.get("music." + obj.channel.guild.id + ".restart")) {
            resUsers = [];
            resUsers.push(obj.member.id);
            data.set("music." + obj.channel.guild.id + ".restart.users", resUsers);
            data.set("music." + obj.channel.guild.id + ".restart.required", Math.ceil((obj.channel.guild.channels.get(data.get("music." + obj.channel.guild.id + ".voice").id).voiceMembers.size - 1) / 2));
            obj.channel.createMessage({
              embed: {
                title: "Voted to restart (" + resUsers.length + "/" + data.get("music." + obj.channel.guild.id + ".restart.required") + ")",
                footer: {
                  text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
                  icon_url: obj.member.avatarURL
                }
              }
            });
          }
          else if (!data.get("music." + obj.channel.guild.id + ".restart.users").includes(obj.member.id)) {
            resUsers = data.get("music." + obj.channel.guild.id + ".restart.users");
            resUsers.push(obj.member.id);
            data.set("music." + obj.channel.guild.id + ".restart.users", resUsers);
            obj.channel.createMessage({
              embed: {
                title: "Voted to restart (" + resUsers.length + "/" + data.get("music." + obj.channel.guild.id + ".restart.required") + ")",
                footer: {
                  text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
                  icon_url: obj.member.avatarURL
                }
              }
            });
          }
          else {
            obj.channel.createMessage({
              embed: {
                title: "You've already voted to restart (" + resUsers.length + "/" + data.get("music." + obj.channel.guild.id + ".restart.required") + ")"
              }
            });
          }
          if (data.get("music." + obj.channel.guild.id + ".restart.users").length == data.get("music." + obj.channel.guild.id + ".restart.required")) {
            obj.channel.createMessage({
              embed: {
                title: "Restarted",
                description: "[" + data.get("music." + obj.channel.guild.id + ".queue")[0].info.title + "](" + data.get("music." + obj.channel.guild.id + ".queue")[0].info.uri + ")\nRequested by " + data.get("music." + obj.channel.guild.id + ".queue")[0].requester.mention,
                footer: {
                  text: "Voted"
                }
              }
            });
            getPlayer(data.get("music." + obj.channel.guild.id + ".voice")).then(player => {player.seek(0);});
            data.del("music." + obj.channel.guild.id + ".restart");
            data.del("music." + obj.channel.guild.id + ".skip");
          }
        }
      }
    }
    else if (cmd == "loop") {
      if (!data.get("music." + obj.channel.guild.id)) {obj.channel.createMessage("I'm not playing anything right now.");}
      else if (obj.member.voiceState.channelID != data.get("music." + obj.channel.guild.id + ".voice").id) {obj.channel.createMessage("You're not in my voice channel!");}
      else if (!checkHost(obj.channel.guild.id, obj.member)) {obj.channel.createMessage("You're not the session host and you do not have the `manageGuild` permission!");}
      else {
        current = data.get("music." + obj.channel.guild.id + ".loop");
        current = !current;
        data.set("music." + obj.channel.guild.id + ".loop", current);
        obj.channel.createMessage({
          embed: {
            title: `Loop ${current ? "enabled" : "disabled"}`,
            footer: {
              text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
              icon_url: obj.member.avatarURL
            }
          }
        });
      }
    }
    else if (cmd == "shuffle") {
      if (!data.get("music." + obj.channel.guild.id)) {obj.channel.createMessage("I'm not playing anything right now.");}
      else if (obj.member.voiceState.channelID != data.get("music." + obj.channel.guild.id + ".voice").id) {obj.channel.createMessage("You're not in my voice channel!");}
      else if (!checkHost(obj.channel.guild.id, obj.member)) {obj.channel.createMessage("You're not the session host and you do not have the `manageGuild` permission!");}
      else {
        queue = data.get("music." + obj.channel.guild.id + ".queue");
        if (queue.length > 2) {
          queue = shuffle(queue);
          data.set("music." + obj.channel.guild.id + ".queue", queue);
          obj.channel.createMessage({
            embed: {
              title: "Queue shuffled",
              footer: {
                text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
                icon_url: obj.member.avatarURL
              }
            }
          });
        }
        else {
          obj.channel.createMessage("There aren't enough tracks in queue to shuffle!");
        }
      }
    }
    else if (cmd == "clear") {
      if (!data.get("music." + obj.channel.guild.id)) {obj.channel.createMessage("I'm not playing anything right now.");}
      else if (obj.member.voiceState.channelID != data.get("music." + obj.channel.guild.id + ".voice").id) {obj.channel.createMessage("You're not in my voice channel!");}
      else if (!checkHost(obj.channel.guild.id, obj.member)) {obj.channel.createMessage("You're not the session host and you do not have the `manageGuild` permission!");}
      else {
        arr = [];
        queue = data.get("music." + obj.channel.guild.id + ".queue");
        arr.push(queue[0]);
        data.set("music." + obj.channel.guild.id + ".queue", arr);
        obj.channel.createMessage({
          embed: {
            title: "Queue cleared.",
            footer: {
              text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
              icon_url: obj.member.avatarURL
            }
          }
        })
      }
    }
    else if (cmd == "host") {
      if (!data.get("music." + obj.channel.guild.id)) {obj.channel.createMessage("I'm not playing anything right now.");}
      else if (!checkHost(obj.channel.guild.id, obj.member)) {obj.channel.createMessage("You're not the session host and you do not have the `manageGuild` permission!");}
      else if (body.split(" ")[0] == "host") {
        if (obj.mentions.length > 0 && obj.mentions[0].id != data.get("music." + obj.channel.guild.id + ".host").id && !obj.mentions[0].bot && obj.channel.guild.channels.get(data.get("music." + obj.channel.guild.id + ".voice").id).voiceMembers.get(obj.mentions[0].id)) {data.set("music." + obj.channel.guild.id + ".host", obj.mentions[0]); obj.channel.createMessage("Value `host` updated.");}
        else {
          obj.channel.createMessage("The host you have specified is probably not valid. Please mention a **human** other than yourself in the same voice channel as you.");
        }
      }
      else if (body.split(" ")[0] == "allowplaylists") {
        if (body.split(" ")[1] == "yes" || body.split(" ")[1] == "true") {data.set("music." + obj.channel.guild.id + ".settings.allowPlaylists", true); obj.channel.createMessage("Value `allowPlaylists` updated.");}
        else if (body.split(" ")[1] == "no" || body.split(" ")[1] == "false") {data.set("music." + obj.channel.guild.id + ".settings.allowPlaylists", false); obj.channel.createMessage("Value `allowPlaylists` updated.");}
        else {
          obj.channel.createMessage({
            embed: {
              title: "Session Settings",
              description: "These settings will be reset as soon as the queue is concluded.\nTo modify a setting, use `" + require("../bot.js").getPrefix(obj.channel) + "host setting value`, replacing `setting` with the setting, and `value` with the new value.",
              fields: [
                {
                  name: "Host `host`",
                  value: data.get("music." + obj.channel.guild.id + ".host").mention,
                  inline: true
                },
                {
                  name: "Allow playlists `allowplaylists`",
                  value: `${data.get("music." + obj.channel.guild.id + ".settings.allowPlaylists") ? "Yes" : "No"}`,
                  inline: true
                },
                {
                  name: "Require voting `requirevote`",
                  value: `${data.get("music." + obj.channel.guild.id + ".settings.requireVote") ? "Yes" : "No"}`,
                  inline: true
                }
              ],
              footer: {
                text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
                icon_url: obj.member.avatarURL
              }
            }
          });
        }
      }
      else if (body.split(" ")[0] == "requirevote") {
        if (body.split(" ")[1] == "yes" || body.split(" ")[1] == "true") {data.set("music." + obj.channel.guild.id + ".settings.requireVote", true); obj.channel.createMessage("Value `requireVote` updated.");}
        else if (body.split(" ")[1] == "no" || body.split(" ")[1] == "false") {data.set("music." + obj.channel.guild.id + ".settings.requireVote", false); obj.channel.createMessage("Value `requireVote` updated.");}
        else {
          obj.channel.createMessage({
            embed: {
              title: "Session Settings",
              description: "These settings will be reset as soon as the queue is concluded.\nTo modify a setting, use `" + require("../bot.js").getPrefix(obj.channel) + "host setting value`, replacing `setting` with the setting, and `value` with the new value.",
              fields: [
                {
                  name: "Host `host`",
                  value: data.get("music." + obj.channel.guild.id + ".host").mention,
                  inline: true
                },
                {
                  name: "Allow playlists `allowplaylists`",
                  value: `${data.get("music." + obj.channel.guild.id + ".settings.allowPlaylists") ? "Yes" : "No"}`,
                  inline: true
                },
                {
                  name: "Require voting `requirevote`",
                  value: `${data.get("music." + obj.channel.guild.id + ".settings.requireVote") ? "Yes" : "No"}`,
                  inline: true
                }
              ],
              footer: {
                text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
                icon_url: obj.member.avatarURL
              }
            }
          });
        }
      }
      else {
        obj.channel.createMessage({
          embed: {
            title: "Session Settings",
            description: "These settings will be reset as soon as the queue is concluded.\nTo modify a setting, use `" + require("../bot.js").getPrefix(obj.channel) + "host setting value`, replacing `setting` with the setting, and `value` with the new value.",
            fields: [
              {
                name: "Host `host`",
                value: data.get("music." + obj.channel.guild.id + ".host").mention,
                inline: true
              },
              {
                name: "Allow playlists `allowplaylists`",
                value: `${data.get("music." + obj.channel.guild.id + ".settings.allowPlaylists") ? "Yes" : "No"}`,
                inline: true
              },
              {
                name: "Require voting `requirevote`",
                value: `${data.get("music." + obj.channel.guild.id + ".settings.requireVote") ? "Yes" : "No"}`,
                inline: true
              }
            ],
            footer: {
              text: require("../bot.js").tag(obj.member) + " | ID: " + obj.member.id,
              icon_url: obj.member.avatarURL
            }
          }
        });
      }
    }
  }
  else if (type == "voiceChannelLeave" || type == "voiceChannelSwitch") {
    oldv = data.get("music." + obj[0].guild.id + ".voice");
    botChanged = false;
    if (type == "voiceChannelLeave") {channel = obj[1];}
    else if (type == "voiceChannelSwitch") {
      channel = obj[2];
      if (obj[0].id == bot.user.id && data.get("music." + obj[1].guild.id)) {
        data.set("music." + obj[1].guild.id + ".voice", obj[1]);
        data.get("music." + obj[1].guild.id + ".channel").createMessage({
          embed: {
            title: "Updated voice channel: " + obj[1].name
          }
        });
        oldv = obj[1];
        channel = obj[1];
        botChanged = true;
      }
    }
    if (data.get("music." + channel.guild.id) && oldv.id == channel.id) {
      if (channel.guild.channels.get(channel.id).voiceMembers.size <= 1) {getPlayer(data.get("music." + channel.guild.id + ".voice")).then(player => {
        data.get("music." + channel.guild.id + ".channel").createMessage({
          embed: {
            title: "Everyone left, so I did too. (Queue concluded)"
          }
        });
        voice = data.get("music." + channel.guild.id + ".voice");
        data.del("music." + channel.guild.id);
        player.stop();
        bot.leaveVoiceChannel(voice.id);
      });}
      else if (obj[0].id == data.get("music." + channel.guild.id + ".host").id || botChanged) {
        newHost = channel.guild.channels.get(channel.id).voiceMembers.filter(member => member.id != bot.user.id && !member.bot)[0];
        host = {};
        host.id = newHost.id;
        host.mention = newHost.mention;
        data.set("music." + channel.guild.id + ".host", host);
        data.get("music." + channel.guild.id + ".channel").createMessage({
          embed: {
            title: "Session Host",
            description: "The previous session host has left the voice channel.\n\n" + newHost.mention + ": You may use `" + require("../bot.js").getPrefix(data.get("music." + channel.guild.id + ".channel")) + "host` to modify the settings for this session.\nOnce the queue concludes, I will disconnect and the session will end.\nYour host privileges will be removed."
          }
        });
      }
    }
  }
}
module.exports.managersOnly = false;
module.exports.name = "music";
