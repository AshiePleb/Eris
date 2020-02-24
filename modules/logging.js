var bot = require("../bot.js").bot;
roundTo = require("../bot.js").roundTo;
tag = require("../bot.js").tag;

module.exports.commands = [];
module.exports.events = ["guildCreate", "guildDelete"];
module.exports.actions = function (type, cmd, body, obj) {
  if (type == "guildCreate") {
    bots = obj.members.filter(m => m.bot).length;
    humans = obj.memberCount - bots;
    humanPct = roundTo(humans / obj.memberCount * 100, 2);
    user = bot.users.get(obj.ownerID);
    if (!user) {user = "Uncached#0000";}
    else {user = tag(user);}
    bot.createMessage("650104686246101012", {
      embed: {
        title: "Guild Join",
        fields: [
          {
            name: "Guild",
            value: obj.name + " `" + obj.id + "`"
          },
          {
            name: "Guild Owner",
            value: user + " `" + obj.ownerID + "`"
          },
          {
            name: "Member Count",
            value: `${obj.memberCount}\nH: ${humans} | B: ${bots} | ${humanPct}% humans`
          }
        ],
        color: 0x00FF00,
        footer: {
          text: "Created at"
        },
        timestamp: new Date(obj.createdAt).toISOString()
      }
    })
  }
  else if (type == "guildDelete") {
    bots = obj.members.filter(m => m.bot).length;
    humans = obj.memberCount - bots;
    humanPct = roundTo(humans / obj.memberCount * 100, 2);
    user = bot.users.get(obj.ownerID);
    if (!user) {user = "Uncached#0000";}
    else {user = tag(user);}
    bot.createMessage("650104686246101012", {
      embed: {
        title: "Guild Leave",
        fields: [
          {
            name: "Guild",
            value: obj.name + " `" + obj.id + "`"
          },
          {
            name: "Guild Owner",
            value: user + " `" + obj.ownerID + "`"
          },
          {
            name: "Member Count",
            value: `${obj.memberCount}\nH: ${humans} | B: ${bots} | ${humanPct}% humans`
          }
        ],
        color: 0xFF0000,
        footer: {
          text: "Created at"
        },
        timestamp: new Date(obj.createdAt).toISOString()
      }
    })
  }
}
module.exports.managersOnly = false;
module.exports.name = "logging";
