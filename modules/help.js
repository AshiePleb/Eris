var mArr = require("../bot.js").mArr;
function permList(perm) {
  if (perm.length == 0 || perm[0] == "guildOnly" || perm[0] == "dmOnly") {return "";}
  else {return "\n> Requires " + perm.map(p => "`" + p + "`").join(", ");}
}

module.exports.commands = [{cmd: "help", desc: "What should I say?", perm: []}, {cmd: "cmdhelp", desc: "Help for commands.", perm: []}];
module.exports.events = [];
module.exports.actions = function (type, cmd, body, obj) {
  if (cmd == "help") {
    if (!body) {
      if (mArr.length < 1) {obj.channel.createMessage("There were no modules found!");}
      else {
        mapped = mArr.map(a => "**" + a.name + "**");
        obj.channel.createMessage({
          embed: {
            title: "Help",
            description: "[Invite Me](https://discordapp.com/api/oauth2/authorize?client_id=648364631995318273&permissions=8&scope=bot)\n[Support Server](https://discord.gg/JfCqSQS)\n\nUse `" + require("../bot.js").getPrefix(obj.channel) + "help module` to see the commands of each module.\nModules: " + mapped.join(", ")
          }
        });
      }
    }
    else {
      check = mArr.find(m => m.name == body);
      if (!check) {obj.channel.createMessage("Module `" + body + "` not found. It's case-sensitive.");}
      else {
        arr = check.commands;
        mgrOnly = check.managersOnly;
        cmdList = arr.map(a => "**" + a.cmd + "** | " + a.desc + permList(a.perm)).join("\n");
        obj.channel.createMessage({
          embed: {
            title: "Help - " + body.charAt(0).toUpperCase() + body.slice(1),
            description: `${mgrOnly ? "[Managers Only]\n\n" : ""}${cmdList}`
          }
        });
      }
    }
  }
  else if (cmd == "cmdhelp") {
    if (mArr.length < 1) {obj.channel.createMessage("There were no modules found!");}
    else if (!body) {obj.channel.createMessage("Please specify a command to get help for.");}
    else {
      check = mArr.find(m => m.commands.find(c => c.cmd == body.toLowerCase()));
      if (!check) {obj.channel.createMessage("Command `" + body.toLowerCase() + "` not found.");}
      else {
        specCmd = check.commands.find(a => a.cmd == body.toLowerCase());
        perms = specCmd.perm.map(v => "`" + v + "`").join(", ");
        if (!perms) {perms = "No permissions required";}
        obj.channel.createMessage({
          embed: {
            title: "Command - " + specCmd.cmd,
            description: "Found in module: `" + check.name + "`",
            fields: [
              {
                name: "Managers Only",
                value: check.managersOnly,
                inline: true
              },
              {
                name: "Permissions",
                value: perms,
                inline: true
              },
              {
                name: "Description",
                value: specCmd.desc
              }
            ]
          }
        })
      }
    }
  }
}
module.exports.managersOnly = false;
module.exports.name = "help";
