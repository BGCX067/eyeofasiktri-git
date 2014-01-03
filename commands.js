var databaseUrl = "mydb";
var dbCollections = ["bot","messageBuffer","Game"];
var db = require("mongojs").connect(databaseUrl, dbCollections);
var playermanager = require("./playermanager.js");
var extend = require("xtend");
var sys = require("sys");
var irc = require("./irc.js");
var dccserver = require("./dccserver.js");
var util = require("util");

exports.parseCommand = parseCommand;
exports.createCommands = createCommands;
exports.cmd_look = cmd_look;

var commands = [];

// a little utility
Object.spawn = function (parent, props) {
  var defs = {}, key;
  for (key in props) {
    if (props.hasOwnProperty(key)) {
      defs[key] = {value: props[key], enumerable: true};
    }
  }
  return Object.create(parent, defs);
}

var Command = {
	txt: "undefined",
	type: "character",		//defines who can execute the command,
					// options are player, character, or both
	minimumSecurityClearance: 0,
	minimumLevel: 0,
	func: null,
	help: "No additional information is available for this command."
}

function createCommands() {
	commands = [];
	commands.push(extend(Command, {
		txt: "look",
		func: cmd_look,
		type: ["character"]
	}));

	commands.push(extend(Command, {
		txt: "@dig",
		func: cmd_dig,
		type: ["character"],
		help: "Use this command to create a new room connected to your current room. Type @dig for more infos.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "help",
		func: cmd_help,
		type: ["player", "character"]
	}));

	commands.push(extend(Command, {
		txt: "say",
		func: cmd_say,
		type: ["character","mob"],
		help: "Use this command to communicate with others in the same room.  For example, type, say I am an idiot."
	}));

	commands.push(extend(Command, {
		txt: "emote",
		func: cmd_emote,
		type: ["character","mob"],
		help: "Use this command to make your character perform certain actions.  For example, type \"emote claps his hands.\""
	}));

	commands.push(extend(Command, {
		txt: "@selfdescshort",
		func: cmd_selfdescshort,
		type: ["character"],
		help: "Use this command alone to see your short description, or change your short description by typing something like: \"@selfdescshort a wandering cow\".  These work best when they are just a few words long."
	}));

	commands.push(extend(Command, {
		txt: "@selfdesclook",
		func: cmd_selfdesclook,
		type: ["character"],
		help: "Use this command along to see what others see when they look at you.  Or, use it to change your self-description like: \"@selfdesclook An unusually large cow stands before you with large brown patches of fur and a long, thin trail of salivia hanging from its lips.\""
	}));

	commands.push(extend(Command, {
		txt: "@selfdescroom",
		func: cmd_selfdescroom,
		type: ["character"],
		help: "Use this to set your room descriptions.  Room descriptions are what others see when they look at or enter a room.  Room descriptions should be one complete sentence."
	}));

	commands.push(extend(Command, {
		txt: "@selfkeywords",
		func: cmd_selfkeywords,
		type: ["character"],
		help: "Use this command to view and/or change your keywords.  Keywords are the things other players have to type in order to interact with you. To be useful, they should contain words that appear in your short description.  For example, if you short description reads, \"a slow, wandering cow\" then you should type something like: \"@selfkeywords slow wandering cow\" to set your keywords."
	}));

	commands.push(extend(Command, {
		txt: "@setpassword",
		func: cmd_setpassword,
		type: ["character"],
		help: "Set your password.  Usage: @setpassword <password> <password again>   Yes, you do have to type it twice.  And, I wouldn't put any spaces in your password if I were you.  You need to set your password before you can save your character."
	}));

	commands.push(extend(Command, {
		txt: "@savegame",
		func: cmd_savegame,
		type: ["character"],
		help: "Save the game to the db.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@saveself",
		func: cmd_saveself,
		type: ["character"],
		help: "Save yourself to the db."
	}));

	commands.push(extend(Command, {
		txt: "who",
		func: cmd_who,
		type: ["character"],
		help: "Find out who else is online."
	}));

	commands.push(extend(Command, {
		txt: "@shutdown",
		func: cmd_shutdown,
		type: ["character"],
		help: "Shutdown the server. Will not reboot automatically.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@edit",
		func: cmd_edit,
		type: ["character"],
		help: "Edit an entity.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@editmode",
		func: cmd_editmode,
		type: ["character"],
		help: "Toggle edit mode on and off.  Useful for seeing room and other entity IDs.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@editroomname",
		func: cmd_editroomname,
		type: ["character"],
		help: "Used to set the name or title of a room. Usage: @editroomname Beside A Sparkling Brook",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@editroomdesc",
		func: cmd_editroomdesc,
		type: ["character"],
		help: "Used to set the description of a room. Usage: @editroomdesc You are standing in knee-deep water.  It smells quite terrible.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@createzone",
		func: cmd_createzone,
		type: ["character"],
		help: "Create a zone. Usage: @createzone <zonename>",
		minimumLevel: playermanager.Game().levelCoordinator
	}));

	commands.push(extend(Command, {
		txt: "@assigntozone",
		func: cmd_assigntozone,
		type: ["character"],
		help: "Assign rooms or prototypes to your current zone. Usage: @assigntozone <entityid>",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@listzones",
		func: cmd_listzones,
		type: ["character"],
		help: "List the zones!",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@goto",
		func: cmd_goto,
		type: ["character"],
		help: "Goto a specific entity. Usage: @goto <entityid>",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@undig",
		func: cmd_undig,
		type: ["character"],
		help: "Destroys a portal. Usage: @undig <portalname>",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "inventory",
		func: cmd_inventory,
		type: ["character"],
		help: "List objects in your inventory."
	}));

	commands.push(extend(Command, {
		txt: "i",
		func: cmd_inventory,
		type: ["character"],
		donotlist: true
	}));

	commands.push(extend(Command, {
		txt: "@createmob",
		func: cmd_createmobprototype,
		type: ["character"],
		help: "Create a new character.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@stat",
		func: cmd_stat,
		type: ["character"],
		help: "Retrieve the stats of a nearby entity.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "drop",
		func: cmd_drop,
		type: ["character","mob"],
		help: "Drop someone from your inventory on the ground."
	}));

	commands.push(extend(Command, {
		txt: "get",
		func: cmd_get,
		type: ["character","mob"],
		help: "Pick something up and put it in your inventory"
	}));

	commands.push(extend(Command, {
		txt: "@reify",
		func: cmd_reify,
		type: ["character"],
		help: "Summon a reified verion of a target prototype.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "kill",
		func: cmd_kill,
		type: ["character","mob"],
		help: "Attack someone!",
		minimumLevel: 1
	}));

	commands.push(extend(Command, {
		txt: "!listentities",
		func: cmd_listentities,
		type: ["character"],
		help: "List all the entities in the game to the console.",
		minimumLevel: playermanager.Game().levelMax
	}));

	commands.push(extend(Command, {
		txt: "@listclients",
		func: cmd_listclients,
		type: ["character"],
		help: "List clients currently connected.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@listinzone",
		func: cmd_listinzone,
		help: "Lists things in the current zone.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@now",
		func: cmd_now,
		help: "Gives the current server time in milliseconds.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "eat",
		func: cmd_eat,
		type: ["character","mob"],
		help: "It's for eating things.",
		minimumLevel: 0
	}));

	commands.push(extend(Command, {
		txt: "follow",
		func: cmd_follow,
		type: ["character", "mob"],
		help: "Following another character automatically as he moves about.",
		minimumLevel: 0
	}));

	commands.push(extend(Command, {
		txt: "score",
		func: cmd_score,
		help: "See your current score including experience and drives.",
		minimumLevel: 0
	}));

	commands.push(extend(Command, {
		txt: "@createobj",
		func: cmd_createobj,
		help: "Create an object prototype.",
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "wear",
		func: cmd_wear,
		type: ["character", "mob"],
		help: "Wear something, weirdo!",
		minimumLevel: 0
	}));

	commands.push(extend(Command, {
		txt: "remove",
		func: cmd_remove,
		type: ["character", "mob"],
		help: "Remove something you have equipped on your body.",
		minimumLevel: 0
	}));

	//commands needed:
	//login
	//deleteportal
	//createzone
	//assigntozone
	//listzones
	
	commands.push(extend(Command, {
		txt: "suggest",
		func: cmd_suggest,
		minimumLevel: 1,
		type: ["character", "mob"],
		help: "Make a suggestion to another person in the room."
	}));
	
	commands.push(extend(Command, {
		txt: "!testexp",
		func: cmd_testexp,
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "@editzone",
		func: cmd_editzone,
		minimumLevel: playermanager.Game().levelBuilder
	}));

	commands.push(extend(Command, {
		txt: "list",
		func: cmd_storelist,
		minimumLevel: 1
	}));

	commands.push(extend(Command, {
		txt: "sell",
		func: cmd_storesell,
		minimumLevel: 1
	}));

	commands.push(extend(Command, {
		txt: "buy",
		func: cmd_storebuy,
		minimumLevel: 1
	}));

	commands.push(extend(Command, {
		txt: "consider",
		func: cmd_consider,
		minimumLevel: 1
	}));
    
    commands.push(extend(Command, {
        txt: "xxx",
        func: cmd_sudo,
        minimumLevel: 0,
        donotlist: true
    }));

    	commands.push(extend(Command, {
		txt: "stand",
		func: cmd_stand,
		minimumLevel: 0
	}));
	commands.push(extend(Command, {
		txt: "sit",
		func: cmd_sit,
		minimumLevel: 0
	}));
	commands.push(extend(Command, {
		txt: "rest",
		func: cmd_sit,
		minimumLevel: 0
	}));

	commands.push(extend(Command, {
		txt: "kneel",
		func: cmd_kneel,
		minimumLevel: 0
	}));
	commands.push(extend(Command, {
		txt: "sleep",
		func: cmd_sleep,
		minimumLevel: 0
	}));
	commands.push(extend(Command, {
		txt: "wake",
		func: cmd_wake,
		minimumLevel: 0
	}));
	commands.push(extend(Command, {
		txt: "quit",
		func: cmd_quit,
		minimumLevel: 0
	}));

	
	/*
	commands.sort(function(a,b){
		a.txt = a.txt.toLowerCase();
		b.txt = b.txt.toLowerCase();
		if (a.txt > b.txt) return -1;
		else if (a.txt < b.txt) return 1;
		else return 0;
		//return b.txt-a.txt
	});
	*/
}



function parseCommand(entity, cmd) {
	var executed = false;
	if (cmd == null || cmd.length <= 0) return;
	var portals = entity.getVisiblePortals();
	
	//check to see if the entity is trying to use a portal
	if (entity.container != null && portals.length > 0) {
		var room = entity.container;

		//console.log("checking room for portals, len=" + room.portals.length);

		for (var i = 0; i < portals.length; i++) {
			//console.log("\tchecking portal #" + i);
			var portal = portals[i];
			var foundportal = false;
			
			if (cmd[0].length == 1 && portal.getPortalKeywordFromEntity(room).slice(0,1) == cmd[0].toLowerCase()) foundportal = true;
			else if (portal.getPortalKeywordFromEntity(room) == cmd[0].toLowerCase()) foundportal = true;

			if (foundportal == true) {
				if (entity.getPosition() != "standing" ) {
					entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
					return;
				}
				var keyword = portal.getPortalKeywordFromEntity(room);
				//console.log("\t\t[" + cmd[0].toLowerCase() + "] vs " + portal.getPortalKeywordFromEntity(room));
				var newRoom = portal.getTargetEntityFromEntity(room);
			  	var newKeyword = portal.getPortalKeywordFromEntity(newRoom);

				//entity.sendMsg("You travel " + keyword + ".");
				room.sendMsgToContents(entity, null , null , "leaves " + keyword, "");
				newRoom.sendMsgToContents(entity, null, null, "enters from the " + newKeyword, "");
				//"enter entity.getUpperCaseAction() + " enters from the " + portal.getPortalKeywordFromEntity(newRoom) + ".");
				
				entity.container = newRoom;
				newRoom.contents.push(entity);
				room.contents.splice(room.contents.indexOf(entity),1);
				cmd_look(entity, ["look"]);

				for (var j = room.contents.length - 1; j >= 0; j--) {
					if (room.contents[j].hasOwnProperty("following") && room.contents[j].following == entity) 
						parseCommand(room.contents[j], keyword);
				}

				//if (entity.hasOwnProperty("following") && entity.following != null) parseCommand(entity.following, keyword);

				executed = true;
				break;
			}
		}
	}

	if (!executed) {
		for (var i = 0; i < commands.length; i++) {
			if (commands[i].type.indexOf(entity.type) >= 0 &&
			    commands[i].txt.substr(0,cmd[0].length) == cmd[0]) { 
			    if (entity.level >= commands[i].minimumLevel) {
			    	//console.log("command ["+cmd[0]+"] is authorized");i
				commands[i].func(entity, cmd);
				executed = true;
			    } else {
			    	//console.log("command ["+cmd[0]+"] is unauthorized, minimumLevel=" + commands[i].minimumLevel + " level=" + entity.level);
				break;
			    }
			    //commands[i].func(entity, cmd);
			    break;
			} else if (commands[i].txt.substr(0,cmd[0].length) == cmd[0]) {
				console.log("command failed: " + cmd[0] + " not valid for type: " + entity.type);
			} else {
				//console.log("command failed: " + cmd);
			}
		}
	}

	if (!executed) entity._sendMsg("I did not understand that command.");
	else {
		if (entity.suggestionsMadeToMe.length > 0) {
			console.log("\tcomparing command to suggestions...");
			var cmdstr = "";
			for (var i = 0; i < cmd.length; i++) {
				cmdstr += cmd[i];
				if (i < cmd.length - 1) cmdstr += " ";
			}
			cmdstr = cmdstr.trim();

			for (var i = 0; i < entity.suggestionsMadeToMe.length; i++) {
				if (cmdstr.toLowerCase() == entity.suggestionsMadeToMe[i].instruction.toLowerCase()) {
					//they obeyed!
					entity.followSuggestion(entity.suggestionsMadeToMe[i]);
					//entity._sendMsg("You feel tingles down you spine after following " + entity.suggestionsMadeToMe[i].suggester.name + "'s suggestion.");
					break;
				}
			}
		}
		
	}

//	console.log("\tfinished executing command.");
	//if (cmd == null) {}
}

function cmd_stat(entity, args) {
	if (args.length < 2) {
		entity._sendMsg("Usage: @stat <entity>");
		entity._sendMsg("       @stat <entity> <property>");
		entity._sendMsg("       @stat ^         (to stat the current room/container)");
		return;
	}
	
	var target = entity.findEntityWithinReach(args[1]);
	if (target == null) {
		target = playermanager.Game().getEntityWithID(args[1]);
		if (target == null) {
			target = entity.getPortalWithinReach(args[1]);
			if (target == null) {
				entity._sendMsg("Could not find that entity nearby.");
				return;
			} else {
				//Target is a portal

			}
		}
	}
	var flatCopy = target.makeFlatCopy();
	
	var stat = "Stating [" + target.descAction + "]\n";
	if (flatCopy == null) {
		stat += "  unable to make flatCopy()";
	} else {
	//	sys.print(sys.inspect(flatCopy));
		if (args.length == 2) {
			stat += JSON.stringify(flatCopy,null,2);
		} else if (args.length == 3) {
			if (flatCopy.hasOwnProperty(args[2])) {
				stat += flatCopy.getUpperCaseAction() + "'s [" + args[2] + "]  id: " + target._id;
				stat += "  " + JSON.stringify(flatCopy[args[2]], null, 2);
			} else {
				stat += flatCopy.getUpperCaseAction() + " does not have that property.";
			}
		}
	}
	entity._sendMsg(stat);
}

function cmd_follow(entity, args) {
	if (args.length == 1) {
		if (entity.hasOwnProperty("following") && entity.following != null) {
			if (entity.following.hasOwnProperty("descAction") && entity.following.descAction != null) {
				entity._sendMsg("You stop following " + entity.following.descAction);
			}
			entity.following = null;
		} else {
			entity._sendMsg("Usage: follow <target>");
		}
		return;
	}

	var target = entity.findEntityInRoom(args[1]);
	if (target == null) {
		entity._sendMsg("You don't see that here.");
		return;
	}
	if (target.hasOwnProperty("type") && (target.type == "mob" || target.type == "character")) {
		if (entity == target) {
			entity._sendMsg("You can't follow yourself, silly.");
			this.entity.following = null;
			return;
		} else {
			entity._sendMsg("You begin following " + target.descAction);
			target._sendMsg(entity.getUpperCaseAction() + " begins following you.");
			entity.following = target;
			return;
		}
	} else {
		entity._sendMsg("You can't follow that.");
	}
}

function cmd_look(entity, args) {
	if (entity.getPosition() == "sleeping") {
		entity._sendMsg("You can't! You're asleep!");
		return;
	}
	if (args.length == 1) {
		var result = "";
		//console.log("executing cmd_look at room");
		if (entity.container == null) {
			//console.log("but, we're not in any containers :(");
		} else {
			//console.log("and in fact, we're in a room!!!");
			var room = entity.container;
			if (entity.type == "character" && entity.editmode == 1) {
				//entity.sendMsg(room.descAction + " [" + room._id + "]");
				result += room.descAction + " [" + room._id + "]";
				if (room.hasOwnProperty("zone") && room.zone != null && room.zone.hasOwnProperty("_id")) {
					result += " zone[" + room.zone._id + "]";
				} else if (room.hasOwnProperty("zone") && room.zone != null) {
					result += " zone[defined, but does not have _id]";
				} else if (room.hasOwnProperty("zoneID")) {
					result += " zone[" + room.zoneID + ", unlinked]";
				} else {
					result += " zone[undefined]";
				}
			} else {
				//entity.sendMsg(room.descAction);
				result += room.descAction;
			}

			//entity.sendMsg("  " + room.descLook);
			result += "\n";
			result += "  " + room.descLook + "\n";
			
			var portals = entity.getVisiblePortals();
			//list exits
			var exitString = "Exits: ";
			if (portals.length >= 1) {
				for (var i = 0; i < portals.length; i++) {
					var keyword = portals[i].getPortalKeywordFromEntity(room);
					var attributes = "";
					if (!portals[i].visibleFromEntity(entity.container)) attributes += "i";
					if (!portals[i].traversableFromEntity(entity.container)) attributes += "t";

					if (attributes.length > 0) attributes = "." + attributes;
					exitString += keyword + attributes;

					if (i < portals.length-1) exitString += ", ";
				}
				//entity.sendMsg(exitString);
				result += exitString + "\n";
			}

			//list room contents
			if (room.contents.length >= 1) {
				for (var i = 0; i < room.contents.length; i++) {
					if (entity != room.contents[i]) {
						//entity.sendMsg(room.contents[i].getUpperCaseAction());
						if (!room.contents[i].hasOwnProperty("prototype")) {
							if (room.contents[i].hasOwnProperty("descRoom")) {
								result += room.contents[i].descRoom;
							} else {
								result += room.contents[i].getUpperCaseAction();
							}
						} else if (entity.level >= playermanager.Game().levelImmortal) {
							result += room.contents[i].getUpperCaseAction()
							result += " [proto]";
							if (entity.editmode == 1) result += " id[" + room.contents[i]._id + "]";
						}
						result += "\n";
					}
				}
			}

			entity._sendMsg(result);
		}
	} else {
		var target = entity.findEntityWithinReach(args[1]);
		if (target == null) {
			entity._sendMsg("You don't see anything like that here.");
			return;
		} else {
			
			if (target.hasOwnProperty("type") && target.type == "character") {
				target._sendMsg(entity.getUpperCaseAction() + " looks at you.");
			}

			var result = "";
			
			if (entity.isBuilder()) {
				if (target.hasOwnProperty("_id")) {
					if (target.hasOwnProperty("prototype") && target.prototype == true) result += "[prototype ";
					else result += "[";
					result += "id: " + target._id + " ]\n";
					if (target.hasOwnProperty("prototypePointerID")) result += "[prototype id: " + target.prototypePointerID + " ]\n";
				}
				if (target.hasOwnProperty("type")) result += "[type: " + target.type + " ]\n";
			}

			result += target.descLook + "\n";
			result += target.getUpperCaseAction() + " looks " + target.getHealthText() + "\n";
			var wearPositions = playermanager.getWearablePositions();

			if (target.hasOwnProperty("contents") && target.contents.length > 0) {
				for (var j = 0; j < wearPositions.length; j++) {
					for (var i = 0; i < target.contents.length; i++) {
						var obj = target.contents[i];
						if (obj.wornPosition == wearPositions[j]) {
							result += "  <" + wearPositions[j] + ">  " + obj.descAction + "\n"; 
						} 
					}
				}
				/*
				result+="Carrying:\n";
				for (var i = 0; i < target.contents.length; i++) {
					var obj = target.contents[i];
					result += "  " + obj.descAction + " wp: "+obj.wornPosition+"\n"; 
				}
				*/
			}
			entity._sendMsg(result);
		}
		/*
		//check inventory
		if (entity.hasOwnProperty("contents")) {
			var inventory = entity.contents;
			for (var i = 0; i < inventory.length; i++) {
				var target == inventory[i];
				if (target.keywords.indexOf(args[1]) > -1) {
					entity.sendMsg(target.descLook);
					return;
				}
			}
		}
		
		//check other stuff in the room
		var room = entity.container;
		if (room != null && room.contents.length > 0) {
			for (var i = 0; i < room.contents.length; i++) {
				var target = room.contents[i];
				if (target.keywords.indexOf(args[1]) > -1) {
					entity.sendMsg(target.descLook);
					return;
				}
			}
		}
		*/
		
		//entity.sendMsg("You don't see anything like that here.");
	}
}

function cmd_undig(entity, args) {
	if (args.length != 2) {
		entity._sendMsg("Usage: @undig <portalkeyword>");
		return;
	}
	var room = entity.container;
	if (!room.hasOwnProperty("type") || room.type != "room") {
		entity._sendMsg("You are not in a room...");
		return;
	}

	for (var i = 0; i < room.portals.length; i++) {
		var portal = room.portals[i];
		var foundportal = false;
			
		if (portal.getPortalKeywordFromEntity(room) == args[1].toLowerCase()) foundportal = true;

		if (foundportal == true) {
			var keyword = portal.getPortalKeywordFromEntity(room);
			//entity.sendMsg("found portal");
			var res = playermanager.deletePortal(portal);
			if (res == 1) entity._sendMsg("Some doors can never be closed... Except this one.");
			else entity._sendMsg("Error deleting portal.");

			return;
		}
	}

	entity._sendMsg("No portal found by that name.");
}

function cmd_dig(entity, args) {
	entity.editmode = 1;
	if (args.length < 3) {
		var result = "";
		result += "Use this command to create a new room accessible from the current room using the";
		result += "name [exitname] you provide.  The [reverseexitname] will be the name of the exit";
		result += "used in the new room to reach the current room. e.g., you might use the";
		result += "following: @dig east west   <- This would create a room to the east.";
		result += "Syntax: @dig [exitname] [reverseexitname]\n";
		result += "               - Creates a new room\n";
		result += "        @dig [exitname] [reverseexitname] [targetentity#]\n";
		result += "               - Connects the current room with an existing one";
		entity._sendMsg(result);
	} else if (args.length  == 3) {
		//create a room in a given direction
		var newRoom = playermanager.createNewRoom();
        
        if (!entity.hasOwnProperty("editingZone") || entity.editingZone == null) {
            //not assigning the new room to a zone
        } else {
            var zone = entity.editingZone;
            newRoom.zone = zone;
            newRoom.zoneID = zone._id;
        }
        
		var newPortal = playermanager.createNewPortal();
		
		newPortal.A = entity.container;
		newPortal.B = newRoom;
		newPortal.Aid = entity.container._id;
		newPortal.Bid = newRoom._id;
		newPortal.ABKeyword = args[1];
		newPortal.BAKeyword = args[2];

		entity.container.portals.push(newPortal);
		newRoom.portals.push(newPortal);
		
		playermanager.addPortalToGame(newPortal);
		playermanager.addEntityToGame(newRoom);
		var msg = "Portal created to the " + args[1] + ".";
		entity._sendMsg(msg);
	} else if (args.length == 4) {
		var targetRoom = playermanager.getEntityWithID(args[3]);
		if (targetRoom == null) {
			entity._sendMsg("Could not find target room with id=" + args[3]);
			return;
		}
		var newPortal = playermanager.createNewPortal();
		var newRoom = targetRoom;

		newPortal.A = entity.container;
		newPortal.B = newRoom;
		newPortal.Aid = entity.container._id;
		newPortal.Bid = newRoom._id;
		newPortal.ABKeyword = args[1];
		newPortal.BAKeyword = args[2];

		entity.container.portals.push(newPortal);
		newRoom.portals.push(newPortal);
		
		playermanager.addPortalToGame(newPortal);

		entity._sendMsg("Portal created successfully.");
	}
}

function cmd_help(entity, args) {
	if (args.length == 2) {
		for (var i = 0; i < commands.length; i++) {
			if (commands[i].txt == args[1]) entity._sendMsg(commands[i].txt + " -  " + commands[i].help);
		}

	} else {
		var result = "";
		result += "Type \"help <command>\" for more information.  List of available commands:\n";
		for (var i = 0; i < commands.length; i++) {
			if (entity.level < commands[i].minimumLevel) continue;
			if (commands[i].hasOwnProperty("donotlist")) continue;
			if (commands[i].type.indexOf(entity.type) >= 0) result += "  " + commands[i].txt + "\n";
		}
		entity._sendMsg(result);
	}
}

function cmd_say(entity, args) {
	if (entity.container == null) {
		entity._sendMsg("You do not appear to be anywhere, so I'm not sure what speaking would accomplish.");
		return;
	}
	if (args.length <= 1) {
		entity._sendMsg("Exactly what do you want to say?");
		return;
	}
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	var msg = "";
	for (var i = 1; i < args.length; i++) {
		msg += args[i];
		if (i < args.length-1) msg += " ";
	}
	var adverb = ", \"" + msg + "\"";
	entity.container.sendMsgToContents(entity, null, "say", "says", adverb);
}


function cmd_emote(entity, args) {
	if (entity.container == null) return;
	if (args.length <= 1) {
		entity._sendMsg("Usage: emote <action>");
		entity._sendMsg("e.g., \"emote sits down.\" would appear to others as <yourname> sits down.");
		return;
	}

	var msg = "";
	for (var i = 1; i < args.length; i++) {
		msg += args[i];
		if (i < args.length-1) msg += " ";
	}

	entity.container.sendMsgToContents(entity, null, "emote, \"" + msg + "\"", msg, "");
}

function cmd_selfdescshort(entity, args) {
	if (args.length > 1 && args.length <= 8) {
		var msg = "";
		for (var i = 1; i < args.length; i++) {
			msg += args[i];
			if (i < args.length-1) msg += " ";
		}
		entity.descAction = msg.toLowerCase();
		entity._sendMsg("Your description now reads: " + msg);
		entity.donotsave = true;
	} else if (args.length == 1) {
		entity._sendMsg("Your current, short self-description currently reads: " + entity.descAction);
	} else {
		entity._sendMsg("That description does not seem reasonable.");
	}
}

function cmd_selfdescroom(entity, args) {
	if (args.length > 1 && args.length <= 8) {
		var msg = "";
		for (var i = 1; i < args.length; i++) {
			msg += args[i];
			if (i < args.length-1) msg += " ";
		}
		entity.descRoom = msg.toLowerCase();
		entity._sendMsg("Your room description now reads: " + msg);
	} else if (args.length == 1) {
		entity._sendMsg("Your current, room self-description currently reads: " + entity.descRoom);
	} else {
		entity._sendMsg("That description does not seem reasonable.");
	}
}


function cmd_selfdesclook(entity, args) {
	if (args.length > 3 && args.length <= 150) {
		var msg = "";
		for (var i = 1; i < args.length; i++) {
			msg += args[i];
			if (i < args.length-1) msg += " ";
		}
		entity.descLook = msg;
		entity._sendMsg("Your description now reads: " + msg);
	} else if (args.length == 1) {
		entity._sendMsg("Your current, short self-description currently reads: " + entity.descLook);
	} else {
		entity._sendMsg("That description does not seem reasonable.");
	}
}

function cmd_selfkeywords(entity, args) {
	if (args.length > 1 && args.length <= 6) {
		var msg = "";
		entity.keywords = [];
		for (var i = 1; i < args.length; i++) {
			entity.keywords.push(args[i].toLowerCase());
			msg += args[i].toLowerCase();
			if (i < args.length-1) msg += " ";
		}
		entity._sendMsg("Your keywords are now: " + msg);
		entity.donotsave = true;
	} else if (args.length == 1) {
		entity._sendMsg("Your keywords are currently: " + JSON.stringify(entity.keywords));
	} else {
		entity._sendMsg("Those keywords do not seem reasonable.");
	}
}

function cmd_setpassword(entity, args) {
	if (args.length == 3) {
		if (args[1] == args[2]) {
			entity.password = args[1];
			entity._sendMsg("Your password has been set.");
		} else {
			entity._sendMsg("Error, your passwords did not match exactly.  Aborting.");
		}
	} else {
		entity._sendMsg("Usage: @setpassword <password> <password again>");
	}
}

function cmd_saveself(entity, args) {
	//make sure the keywords are present in the short description
	if (!entity.hasOwnProperty("donotsave")) {
		entity._sendMsg("Saving...");
		playermanager.saveEntity(entity);
		return;
	}
	var words_in_desc = entity.descAction.split(" ");
	if (words_in_desc.length < 2) {
		entity._sendMsg("Your short description must be at least two words before you can save your character.");
		return;
	}
	var num_words_over_one_letter = 0;
	var words_over_one_letter = [];
	var words_that_dont_count = ["an","a","the","this","are","is","one","on","that","way","like","as","it","in","within","with","below","above",
					"inside","out","outside","by"];
	console.log("@saveself:");
	console.log("\twords over one letter:");
	for (var i = 0; i < words_in_desc.length; i++) {
		if (words_in_desc[i].length > 1 && words_that_dont_count.indexOf(words_in_desc[i]) < 0) {
			num_words_over_one_letter++;
			words_over_one_letter.push(words_in_desc[i]);
			console.log("\t\t" + words_in_desc[i]);
		}
	}
	if (num_words_over_one_letter < 1) {
		entity._sendMsg("Your short description is too short.");
		return;
	}
	if (!entity.hasOwnProperty("keywords") || entity.keywords.length == 0) {
		entity._sendMsg("You cannot save your character until you set your keywords. See @selfkeywords.");
		return;
	}
	var num_keywords_in_shortdesc = 0;
	for (var i = 0; i < words_over_one_letter.length; i++) {
		if (entity.keywords.indexOf(words_over_one_letter[i]) >= 0) {
			num_keywords_in_shortdesc++;
		}
	}
	if (entity.hasOwnProperty("donotsave") && entity.donotsave == true) {
		if (num_keywords_in_shortdesc < 1 || num_keywords_in_shortdesc < num_words_over_one_letter - 1) {
			console.log("@saveself:");
			console.log("\tnum_keywords_in_shortdesc: " + num_keywords_in_shortdesc);
			console.log("\tnum_words_over_one_letter: " + num_words_over_one_letter);
			entity._sendMsg("Your short description: [" + entity.descAction + "]");
			entity._sendMsg("Your room description:  [" + entity.descRoom   + "]");
			entity._sendMsg("Your keywords: " + entity.keywords);
			entity._sendMsg("Number of keywords in short description:   " + num_keywords_in_shortdesc);
			entity._sendMsg("Number of words in description that count: " + num_words_over_one_letter);
			entity._sendMsg("There does not appear to be enough in common between your short description and your keywords to save your character. Please try again.");
			return;
		}
	}
	console.log("@saveself:");
	console.log("\tnum_keywords_in_shortdesc: " + num_keywords_in_shortdesc);
	console.log("\tnum_words_over_one_letter: " + num_words_over_one_letter);
	entity._sendMsg("Your short description: [" + entity.descAction + "]");
	entity._sendMsg("Your room description:  [" + entity.descRoom   + "]");
	entity._sendMsg("Your keywords: " + entity.keywords);
	entity._sendMsg("Number of keywords in short description:   " + num_keywords_in_shortdesc);
	entity._sendMsg("Number of words in description that count: " + num_words_over_one_letter);
	entity._sendMsg("Saving character...");
	entity.level = 1;

	if (entity.hasOwnProperty("donotsave")) delete entity.donotsave;
	playermanager.saveEntity(entity);
	//var flat = entity.makeFlatCopy();
	//console.log("flatCopy:");
	//sys.print(sys.inspect(flat));
	entity._sendMsg("Done.");
}

function cmd_savegame(entity, args) {
	playermanager.saveGame();
	entity._sendMsg("Saving...");
}

function cmd_who(entity, args) {
	entity._sendMsg("Players Online:");
	var entities = playermanager.getEntities();
	for (var i = 0; i < entities.length; i++ ) {
		var ent = entities[i];
		if (ent.type == "character" && ent.controller != null) {
			entity._sendMsg("  " + ent.name + ", " + ent.descAction);
		}
	}
}

function cmd_shutdown(entity, args) {
	irc.sendToMainChannel("Shutting down the server in 10 seconds!");

	console.log("shutdown command received.");
	
	setTimeout(function disconnect() {
		console.log("disconnecting...");
		irc.disconnect();
	}, 5000);
	entity._sendMsg("Shutting down the server in 5 seconds...");
	setTimeout(function shutdown() {
		console.log("shutting down...");
		process.exit(1);
	}, 7000);
}

function cmd_editmode(entity, args) {
    if (entity.getCurrentZone() == null) {
        entity._sendMsg("This room does not belong to a zone yet, please use @assignzone to assign it to a zone.");
        return;
    } else if (entity.getCurrentZone().hasOwnProperty("_id") && !entity.canEditZone(entity.getCurrentZone()._id)) {
        entity._sendMsg("Sorry, you do not have permission to edit objects in this zone.");
        return;
    }
	if (!entity.hasOwnProperty("editmode")) {
		entity.editmode = 1;
	} else if (entity.editmode == 0) entity.editmode = 1;
	else entity.editmode = 0;

	entity._sendMsg("Edit mode: " + entity.editmode);
}

function cmd_editroomname(entity, args) {
    if (entity.getCurrentZone() == null) {
        entity._sendMsg("This room does not belong to a zone yet, please use @assignzone to assign it to a zone.");
        return;
    } else if (entity.getCurrentZone().hasOwnProperty("_id") && !entity.canEditZone(entity.getCurrentZone()._id)) {
        entity._sendMsg("Sorry, you do not have permission to edit objects in this zone.");
        return;
    }
	var msg = "";
	for (var i = 1; i < args.length; i++) {
		msg += args[i];
		if (i < args.length-1) msg += " ";
	}
	entity.container.descAction = msg;
	entity._sendMsg("The name of this room is now: " + msg);
}

function cmd_editroomdesc(entity, args) {
    if (entity.getCurrentZone() == null) {
        entity._sendMsg("This room does not belong to a zone yet, please use @assignzone to assign it to a zone.");
        return;
    } else if (entity.getCurrentZone().hasOwnProperty("_id") && !entity.canEditZone(entity.getCurrentZone()._id)) {
        entity._sendMsg("Sorry, you do not have permission to edit objects in this zone.");
        return;
    }
	var msg = "";
	for (var i = 1; i < args.length; i++) {
		msg += args[i];
		if (i < args.length-1) msg += " ";
	}
	entity.container.descLook = msg;
	entity._sendMsg("The description of this room is now: " + msg);
}

function cmd_createzone(entity, args) {
	if (args.length == 2) {
		var test = playermanager.getZoneByName(args[1]);
		if (test != null) {
			entity._sendMsg("Error, a zone by the name already exists.");
			return;
		}
		var zone = playermanager.createNewZone();
	
		zone.name = args[1];
		zone.descAction = args[1];
		entity.editingZone = zone;

		console.log("createzone:");
		console.log("\tpre entities.length =" + playermanager.getEntities().length);
		playermanager.addEntityToGame(zone);
		console.log("\tpost entities.length=" + playermanager.getEntities().length);
		entity._sendMsg("Zone \"" + zone.name + "\" created with _id=" + zone._id);
	} else {
		entity._sendMsg("Usage: @createzone <zonename>");
	}
}

function cmd_assigntozone(entity, args) {
	var zone = null;
	if (!entity.hasOwnProperty("editingZone") || entity.editingZone == null) {
		entity._sendMsg("You are currently not editing any zones. Type @listzones and @editzone <zoneid> to select a zone for editing.");
		return;
	} else zone = entity.editingZone;

	if (zone == null && args.length != 2) {
		entity._sendMsg("Usage: @assigntozone <entityid>  OR use @editzone first to select a zone.");
		return;
	}
	
	var target;
    
    if (args.length == 2) target = playermanager.getEntityWithID(args[1]);
    else target = entity.container;
    
	if (target == null) {
		entity._sendMsg("Cannot find an entity with that id.");
		return;
	}
	
    if (!entity.canEditZone(zone._id)) {
        entity._sendMsg("Sorry, you do not have permission to edit objects in this zone.");
        return;
    }
    
    if (!entity.canEditZone(target.zone._id)) {
        entity._sendMsg("Sorry, you do not have permission to edit objects in this zone.");
        return;
    }
    
	target.zone = zone;
	target.zoneID = zone._id;
	if (!zone.contents.indexOf(target)) zone.contents.push(target);

	entity._sendMsg(target.getUpperCaseAction() + " assigned to zone " + target.zone.name + "/" + target.zone._id);
}

function cmd_listzones(entity, args) {
	var entities = playermanager.getEntities();
	var result = "Zone List:\n";

	for (var i = 0; i < entities.length; i++) {
		if (entities[i].type == "zone") {
			result += "  " + entities[i].name + " id[" + entities[i]._id + "]\n";
		}
	}
	entity._sendMsg(result);
}

function cmd_editzone(entity, args) {
	var zone = null;
	if (args.length != 2) {
		if (entity.hasOwnProperty("container") && entity.container != null && entity.container.hasOwnProperty("zone") && entity.container.zone != null) {
			zone = entity.container.zone;
		} else {
			entity._sendMsg("Usage: @editzone <zoneid>  - use @listzones to get a list of zones (the current room does not appear to have been assigned to a zone).");
			return;
		}
	}
	var zoneid = args[1];
	if (args.length == 2 && zone == null) zone = playermanager.getEntityWithID(zoneid);

	if (zone == null || zone.type != "zone") {
		entity._sendMsg("There does not appear to be a zone with that id.");
		return;
	}
    if (!entity.canEditZone(zone._id)) {
        entity._sendMsg("Sorry, you do not have permission to edit this zone.");
        return;
    }
    
	entity.editingZone = zone;
	entity._sendMsg("You are now editing " + zone.name + ", id: " + zone._id);
}
function cmd_listinzone(entity, args) {
	var zone = null;
	if (!entity.hasOwnProperty("editingZone") || entity.editingZone == null) {
		entity._sendMsg("You are currently not editing any zones. Type @listzones and @editzone <zoneid> to select a zone for editing.");
		return;
	} else zone = entity.editingZone;
	
	var searchType = "";

	if (args.length != 2) searchType = "any";
	else searchType = args[1].toLowerCase();

	var entities = playermanager.getEntities();
	var result = "";
	
	result = "Entities of type " + searchType + " in current zone (" + zone.name + "/" + zone._id + ")\n";
	if (searchType == "mobprototype") result += "  (b/d/s)lvl    - max# - id                   - descAction\n";
	for (var i = 0; i < entities.length; i++) {
		if (entities[i].hasOwnProperty("zone") && entities[i].zone == zone && searchType == "any") {
			if (entities[i].type == "mob" || entities[i].type == "object") continue;
			result += "  " + entities[i].type + " - " + entities[i].descAction + " - " + entities[i]._id + "\n";
		} else if (entities[i].hasOwnProperty("zone") && entities[i].zone == zone && entities[i].type == searchType) {
			result += "  ";
			if (entities[i].type == "mobprototype") {
				result += entities[i].battle.level + "/" + entities[i].dominance.level + "/" + entities[i].submission.level + "           ";
				result += entities[i].maxMobs + "      ";
			}
			result += entities[i]._id + " ";
			result += entities[i].descAction;
			result += "\n";
		}
	}
	entity._sendMsg(result);
	

}

function cmd_goto(entity, args) {
	if (args.length != 2) {i
		entity._sendMsg("Usage: @goto <id>");
		return;
	}

	var target = playermanager.getEntityWithID(args[1]);
	if (target == null) {
		entity._sendMsg("Could not find entity with that id.");
		return;
	}

	if (!target.hasOwnProperty("type")) {
		entity._sendMsg("Error, there is something very wrong with that entity.");
		return;
	}

	if (target.type == "room") {
		var oldroom = entity.container;
		if (oldroom != null && oldroom.hasOwnProperty("type")) {
			if (oldroom.type == "room") {
				entity.container.sendMsgToContents(entity, null, "transport yourself", "disapperates in a violent poof", ".");
			}
		}

		
		entity.container = target;
		target.contents.push(entity)
		oldroom.contents.splice(oldroom.contents.indexOf(entity),1);
		
		cmd_look(entity, ["look"]);
		entity.container.sendMsgToContents(entity, null, null, "suddenly appears in a violent poof", "");
		return;
	} else if (target.type == "zone") {
		if (target.hasOwnProperty("contents") && target.contents.length < 0) {
			entity._sendMsg("That zone has no contents.");
			return;
		} else {
			for (var i = 0; i < target.contents.length; i++) {
				if (target.contents[i].type == "room") {
					var oldroom = entity.container;
					if (oldroom != null && oldroom.hasOwnProperty("type")) {
						if (oldroom.type == "room") {
							entity.container.sendMsgToContents(entity, null, "transport yourself", "disapperates in a violent poof", ".");
						}
					}

		
					entity.container = target;
					target.contents.push(entity)
					oldroom.contents.splice(oldroom.contents.indexOf(entity),1);
		
					cmd_look(entity, ["look"]);
					entity.container.sendMsgToContents(entity, null, null, "suddenly appears in a violent poof", "");
					return;

				}
			}
			entity._sendMsg("Could not find a room in that zone.");
		}
	}

	entity._sendMsg("I'm not sure what kind of entity that is.");
	return;
}

function cmd_inventory(entity, args) {
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	if (!entity.hasOwnProperty("contents")) {
		entity._sendMsg("Weird, you do not appear to be capable of carrying anything.");
		return;
	}
	if (entity.contents.length == 0) {
		entity._sendMsg("You are not carrying anything.");
		return;
	}
	
	var wearablePositions = playermanager.getWearablePositions();

	var result = "Equipped:\n";
	for (var j = 0; j < wearablePositions.length; j++) {
		for (var i = 0; i < entity.contents.length; i++) {
			if (entity.contents[i].wornPosition == wearablePositions[j]) {
				result +=  "  <" + wearablePositions[j] + ">  " + entity.contents[i].descAction + "\n";
			} 
		}
	}
	
	result += "Carrying:\n";
	for (var i = 0; i < entity.contents.length; i++) {
		if (entity.contents[i].wornPosition == "none" || !entity.contents[i].hasOwnProperty("wornPosition") ) {
			result += "  " + entity.contents[i].descAction;
			if (entity.contents[i].hasOwnProperty("prototype")) 
				result += " [prototype: "+
					entity.contents[i]._id +"]";
			result += "\n";
		}
	}
	

	entity._sendMsg(result);
}

function cmd_createmobprototype(entity, args) {
	var zone = null;
	if (!entity.hasOwnProperty("editingZone") || entity.editingZone == null) {
		entity._sendMsg("You are currently not editing any zones. Type @listzones and @editzone <zoneid> to select a zone for editing.");
		return;
	} else zone = entity.editingZone;

    if (!entity.canEditZone(zone._id)) {
        entity._sendMsg("Sorry, you do not have permission to edit mobs in this zone.");
        return;
    }
    
	if (args.length  == 1) {
		var newMob = playermanager.createNewMobPrototype(entity);
		if (newMob != null) {
			newMob.zone = zone;
			newMob.zoneID = zone._id;
			entity.container.sendMsgToContents(entity, newMob, "utter an incantation as", "utters an incantation as", "suddenly appears");
			return;
		} else {
			entity._sendMsg("Error, mob could not be created for some reason.");
		}
	} else if (args.length == 2) {
		var id = args[1];
		var entities = playermanager.Game().entities;
		var prototype = null;
		for (var i = 0; i < entities.length; i++) {
			var p = entities[i];
			if (p.hasOwnProperty("type") && p.type == "mobprototype" && p.hasOwnProperty("_id") && p._id == id) {
				prototype = p;
				if (zone != p.zone) {
					entity._sendMsg("That mob does not belong to your current zone. You are currently editing " + zone.name + "/" + zone._id + " but that mob belongs to " + prototype.zone.name + "/" + prototype.zone._id + ". Use @editzone to change your current zone.");
					return;
				}
			}
		}
		if (prototype == null) {
			entity._sendMsg("Cannot find a mobprototype with that id.");
			return;
		}
		prototype.moveToContainer(entity);
		//if (entity.hasOwnProperty("contents") && entity.contents.indexOf(prototype) < 0) {
		//	entity.contents.push(prototype);
		//}
		//if (prototype.hasOwnProperty("container") && prototype.container != entity) {
		//	prototype.container = entity;
		//} else if (!prototype.hasOwnProperty("container")) {
		//	prototype.container = entity;
		//}
		entity.container.sendMsgToContents(entity, prototype, "utter an incantation as", "utters an incantation as", "suddenly appears");
	} else {
		entity._sendMsg("Usage: @createmob  or @createmob <id>");
	}
}

function cmd_drop(entity, args) {
	if (args.length < 2) {
		entity._sendMsg("Usage: drop <item>");
		return;
	}
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	if (entity.container == null) {
		entity._sendMsg("Umm.. You do not appear to be anywhere, so you can't very well drop something there can you?");
		return;
	}
	var keyword = args[1];
	console.log("keyword=" + keyword + "  args[1]=" + args[1]);
	var target = entity.findEntityFromInventory(keyword);
	if (target == null) {
		entity._sendMsg("That doesn't appear to be in your inventory.");
		return;
	}
	
	target.moveToContainer(entity.container);
	if (target.container == entity.container) {
		//entity._sendMsg("You drop " + target.descAction + ".");
		entity.container.sendMsgToContents(entity, target, "drop", "drops", "on the ground");
		//entity.getUpperCaseAction() + " drops " + target.descAction + ".", entity);
		//target._sendMsg(entity.getUpperCaseAction() + " drops you on the ground!");

		return;
	} else {
		entity._sendMsg("Err.. That didn't work for some reason.");
	}
}

function cmd_get(entity, args) {
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	if (args.length == 1) {
		console.log("\tno keywords provided");
		entity._sendMsg("Usage: get <item>");
		return;
	} else if (args.length == 2) {
		console.log("\tlooking for " + args[1]);
		var item = entity.findEntityInRoom(args[1]);
		if (item == null) {
			entity._sendMsg("I don't see anything here like that.");
			console.log("cmd_get: fail, could not find " + args[1]);
			return;
		}
		if (!entity.canCarry(item)) {
			entity._sendMsg("No silly, you can't have that.");
			console.log("cmd_get: fail, could not carry");
			return;
		}
		console.log("\ttrying to pick up obj");
		var isCash = (item.hasOwnProperty("cash") && item.type == "object");

		item.moveToContainer(entity);
		if (!isCash && item.container == entity) {
			console.log("\tsuccessfully picked up item.");
			//entity._sendMsg("You get " + item.descAction + ".");
			if (entity.container.hasOwnProperty("sendMsgToContents"))
				entity.container.sendMsgToContents(entity, item, "pick up", "picks up", "");
			console.log("\tentity.contents:");
			for (var i = 0; i < entity.contents.length; i++) {
				console.log("\t\t" + entity.contents[i].descAction + " is inside " + entity.contents[i].container.descAction + " _id: " +
					entity.contents[i].container._id);
			}
			//entity.getUpperCaseAction() + " picks up " + item.descAction + ".",entity);
			//item._sendMsg(entity.getUpperCaseAction() + " picks you up!");
			return;
		} else if (!isCash) {
			entity._sendMsg("Oops. That's didn't work for some reason.");
			console.log("cmd_get: fail, could not move item to entity's contents for some reason.");
		} else {
			//means we picked up some cash
			if (entity.container.hasOwnProperty("sendMsgToContents"))
				entity.container.sendMsgToContents(entity, item, "pick up", "picks up", "");
		}
	} else if (args.length == 3) {
	}
}

function cmd_edit(entity, args) {
	if (args.length <= 2) {
		entity._sendMsg("Usage: @edit <entity> <property> <new value> -- Use @stat to get a list of an entity's properties.");
		return;
	}
	
	var target = entity.findEntityWithinReach(args[1]);
	
	if (target == null) {
		target = entity.getPortalWithinReach(args[1]);
		if (target == null) {
			entity._sendMsg("Could not find anything here by the name.");
			return;
		} else {
			cmd_editportal(entity, args);
			return;
		}
	}
    
    if (target.hasOwnProperty("zone") && target.zone != null && target.zone.hasOwnProperty("_id")) {
        if (!entity.canEditZone(target.zone._id)) {
            entity._sendMsg("Sorry, you do not have permission to edit things with zoneid=" + target.zone._id + "/" + target.zone.name);
            return;
        }
    }
	
    if (target.hasOwnProperty("level") && target.level >= entity.level && target != entity) {
		entity._sendMsg("You can't edit anything that is your same level or greater.");
		return;
	}
	var property = args[2];
	var specialCases = [
		"keywords","type","_id","addkeyword","setkeyword","prototype","spawnRoomIDs","spawn","wearablePositions","wornPosition", "spawnObjects",
		"battle", "dominance", "submission","level","spawnRooms","spawnRoom","spawnroom","chatMessages","cash","copper","gold","silver","platinum",
		"latinum", "editableZones"];
	var newValue = "";

	
	for (var i = 3; i < args.length; i++) {
		newValue += args[i];
		if (i < args.length - 1) newValue += " ";
	}
	
	if (!isNaN(newValue)) newValue = Number(newValue);
	else if (newValue.toLowerCase() == "true") {
		newValue = true;
	} else if (newValue.toLowerCase() == "false") {
		newValue = false;
	}
	if (property.toLowerCase() == "level") {
		if (newValue > entity.level) {
			entity._sendMsg("You can't set something to a level that is greater than your own.");
			return;
		}
		
	}

	if (specialCases.indexOf(property) == -1) {
		if (target.hasOwnProperty(property)) {
			var oldValue = target[property];
			target[property] = newValue;
			entity._sendMsg("Setting " + target.descAction + "'s " + property + " from [" + oldValue + "] to [" + newValue + "].");
			return;
		} else {
			entity._sendMsg(target.getUpperCaseAction() + " does not have that property.");
			return;
		}
	} else {
		if (property == "keywords") {
			entity._sendMsg("Use 'addkeyword <keyword>' or 'setkeyword <keyword>' to edit an entity's keywords.");
			return;
		} else if (property == "addkeyword") {
			target.keywords.push(args[3]);
			entity._sendMsg(target.getUpperCaseAction() + "'s keywords: " + target.keywords + ".");
			return;
		} else if (property == "setkeyword") {
			target.keywords = [];
			//if (target.hasOwnProperty("prototype")) target.keywords.push("prototype");
			target.keywords.push(args[3]);
			entity._sendMsg(target.getUpperCaseAction() + "'s keywords: " + target.keywords + ".");
			return;
		} else if (property == "chatMessages") {
			if (!target.hasOwnProperty("chatMessages")) {
				entity._sendMsg("That does not appear to have any chat messages.");
				return;
			}
			if (args[3] == "clear") {
				target.chatMessages = [];
				entity._sendMsg(target.getUpperCaseAction() + "'s chat messages have been cleared.");
				return;
			} else if (args[3] == "add") {
				if (args.length > 4) {
					var chatMsg = "";
					for (var i = 4; i < args.length; i++) chatMsg += args[i] + " ";
					chatMsg = chatMsg.trim();
					target.chatMessages.push(chatMsg);
					entity._sendMsg("\""+chatMsg+"\" has now been added to " + target.descAction + "'s chat messages.");
					return;
				}
			}
		} else if (property == "editableZones") {
            if (entity.level < playermanager.Game().levelCoordinator) {
                entity._sendMsg("You do not have access to edit that property.");
                return;
            }
            //edit <id> editableZones add <zoneid>
            //edit <id> editableZones clear
            if (args.length == 4) {
                if (args[3] == "clear") {
                    entity._sendMsg(target.getUpperCaseAction() + " editable zones have been cleared.");
                    return;
                }
            } else if (args.length == 5) {
                if (args[3] == "add") {
                    var zoneid = args[4];
                    var zone = playermanager.Game().getEntityWithID(zoneid);
                    if (zone == null){
                        entity._sendMsg("There doesn't appear to be a zone with that id. Double check it with @listzones?");
                        return;
                    }
                    if (!target.hasOwnProperty("editableZones")) target.editableZones = [];
                    target.editableZones.push(zoneid);
                    var result = target.getUpperCaseAction() + " can now edit the following zones:\n";
                    for (var i = 0; i < target.editableZones.length; i++) {
                        var z = playermanager.Game().getEntityWithID(target.editableZones[i]);
                        var zname = "undefined";
                        if (z != null) zname = z.name;
                        result += (i+1) + ". " + target.editableZones[i] + "/" + zname + "\n";
                    }
                    if (target.editableZones.length == 0) result += "  none\n";
                    entity._sendMsg(result);
                    return;
                } else if (args[3] == "del") {
                    var zoneid = args[4];
                    if (target.editableZones.indexOf(zoneid) != -1) {
                        target.editableZones.splice(target.editableZones.indexOf(zoneid),1);
                        var result = target.getUpperCaseAction() + " can now edit the following zones:\n";
                        for (var i = 0; i < target.editableZones.length; i++) {
                            var z = playermanager.Game().getEntityWithID(target.editableZones[i]);
                            var zname = "undefined";
                            if (z != null) zname = z.name;
                            result += (i+1) + ". " + target.editableZones[i] + "/" + zname + "\n";
                        }
                        if (target.editableZones.length == 0) result += "  none\n";
                        entity._sendMsg(result);
                        return;
                    } else {
                        entity._sendMsg(target.getUpperCaseAction() + " does not appear to be able to edit that zone.");
                        return;
                    }
                }
            }
            entity._sendMsg("Usage: @edit <target> editableZones <add/del/clear> [zoneid]");
            return;
        } else if (property == "cash" || property == "copper" || property == "silver" || property == "gold" || property == "platinum" || property == "latinum") {
			if (!target.hasOwnProperty("cash")) {
				entity._sendMsg(target.getUpperCaseAction() + " does not have property 'cash'.");
				return;
			}
			if (property == "cash") {
				entity._sendMsg("Usage: @edit <id> [copper/silver/gold/etc.] [amount]");
				return;
			} else if (args.length == 4) {
				target.cash[property] = Number(args[3]);
				entity._sendMsg(target.getUpperCaseAction() + "'s " + property + " has been set to " + Number(args[3]));
				return;
			}
		} else if (property.toLowerCase() == "spawnroomids" || property.toLowerCase() == "spawnrooms" || property.toLowerCase() == "spawnroom") {
			entity._sendMsg("Use 'spawn addhere' or 'spawn clear'");
			return;
		} else if (property == "spawn" && args[3] == "addhere") {
			var room = entity.container;
			if (room == null) {
				entity._sendMsg("You do not appear to be in a room, or anywhere for that matter.");
				return;
			}
			if (!room.hasOwnProperty("type") || room.type != "room") {
				entity._sendMsg("You do not appear to be in a room, or anywhere for that matter.");
				return;
			}
			target.addSpawnRoom(room);
			entity._sendMsg("Current room added.");
			return;
		} else if (property == "spawn" && args[3] == "clear") {
			target.clearSpawnRooms();
			entity._sendMsg("Spawn rooms cleared.");
			return;
		} else if (property == "wearablePositions") {
			if (args[3] == "clear") {
				if (!target.hasOwnProperty(property)) {
					entity._sendMsg("You can't wear that.");
					return;
				}
				target.wearablePositions = ["none"];
				entity._sendMsg("Cleared.");
			} else {
				target.wearablePositions.push(args[3].toLowerCase());
				entity._sendMsg("Added "+args[3]+" to wearablePositions.");
				if (target.wearablePositions.indexOf("none") != -1) target.wearablePositions.splice(target.wearablePositions.indexOf("none"),1);
			}
			return;
		} else if (property.toLowerCase() == "spawnobjects") {
			if (args[3] == "add" && (args.length == 6 || args.length == 7)) {
				var objid = args[4];
				var wearposition = args[5];
				var probability = (args.length == 7 ? args[6] : 1.0);
				target.addSpawnObject(objid, wearposition, probability);
				entity._sendMsg("Added object at spawn.");
			} else if (args[3] == "remove" && args.length == 5) {
				var objid = args[4];
				target.removeSpawnObject(objid);
				entity._sendMsg("Removed object from spawnObjects.");
			} else if (args[3] == "clear") {
				target.clearSpawnObjects();
				entity._sendMsg("Spawn objects cleared.");
			} else {
				entity._sendMsg("Usage: @edit <mobprototype> spawnObjects add <objid> <wearposition> [probability]");
				entity._sendMsg("       @edit <mobprototype> spawnObjects remove <objid>");
				entity._sendMsg("	@edit <mobprototype> spawnObjects clear");
			}
			return;
		} else if (property.toLowerCase() == "battle") {
			if (args.length == 5 && args[3] == "level") {
				target.battle.level = Number(args[4]);
				entity._sendMsg("Battle level set to " + Number(args[4]));
			} else {
				entity._sendMsg("Usage: @edit <entity> battle level <newlevel>");
			}
			return;
		} else if (property.toLowerCase() == "dominance") {
			if (args.length == 5 && args[3] == "level") {
				target.dominance.level = Number(args[4]);
				entity._sendMsg("Dominance level set to " + Number(args[4]));
			} else {
				entity._sendMsg("Usage: @edit <entity> dominance level <newlevel>");
			}
			return;
		} else if (property.toLowerCase() == "submission") {
			if (args.length == 5 && args[3] == "level") {
				target.submission.level = Number(args[4]);
				entity._sendMsg("Submission level set to " + Number(args[4]));
			} else {
				entity._sendMsg("Usage: @edit <entity> submission level <newlevel>");
			}
			return;
		} else if (property.toLowerCase() == "level") {
			entity._sendMsg("Levels are specified per skill area, currently the three skill areas are battle, dominance, and submission. E.g., Use @edit <mob> dominance level 3");
		}
		entity._sendMsg("You are not allowed to change " + target.descAction + "'s " + property + ".");
	}

}

function cmd_editportal(entity, args) {
	if (args.length < 4) {
		entity._sendMsg("Usage: @edit <entity> <property> <new value> -- Use @stat to get a list of an entity's properties.");
		return;
	}
	
	var target = entity.getPortalWithinReach(args[1]);
	
	if (target == null) {
		entity._sendMsg("Could not find anything here by the name.");
		return;
	}
	if (target.hasOwnProperty("level") && target.level >= entity.level) {
		entity._sendMsg("You can't edit anything that is your same level or greater.");
		return;
	}
	var property = args[2];
	var specialCases = ["_id","Aid","Bid","A","B"];
	var newValue = "";

	
	for (var i = 3; i < args.length; i++) {
		newValue += args[i];
		if (i < args.length - 1) newValue += " ";
	}
	
	if (!isNaN(newValue)) newValue = Number(newValue);
	else if (newValue.toLowerCase() == "true") {
		newValue = true;
	} else if (newValue.toLowerCase() == "false") {
		newValue = false;
	}
	if (property.toLowerCase() == "level") {
		if (newValue > entity.level) {
			entity._sendMsg("You can't set something to a level that is greater than your own.");
			return;
		}
		
	}
	if (specialCases.indexOf(property) == -1) {
		if (target.hasOwnProperty(property)) {
			var oldValue = target[property];
			target[property] = newValue;
			entity._sendMsg("Setting portal's " + args[1] + " property, " + property + " from [" + oldValue + "] to [" + newValue + "].");
			return;
		} else {
			entity._sendMsg(target.getUpperCaseAction() + " does not have that property.");
			return;
		}
	} else {
		entity._sendMsg("You are not allowed to change that property.");
	}

}

function cmd_reify(entity, args) {
	if (args.length != 2) {
		entity._sendMsg("Usage: @reify <prototype>  - the prototype needs to be either in your inventory or in the room.");
		return;
	}

	var prototype = entity.findEntityWithinReach(args[1]);

	if (prototype == null) {
		entity._sendMsg("Could not find that entity.");
		return;
	}
	if (prototype.type != "mobprototype" && prototype.type != "objectprototype") {
		entity._sendMsg("That is not a prototype");
		return;
	}
	if (!prototype.hasOwnProperty("container")) {
		entity._sendMsg("The prototype does not have a container, so we can't reify it.");
		return;
	}
	container = prototype.container;
	var mob = prototype.reify();
	if (mob != null) {
		mob.moveToContainer(container);
		if (mob.type == "mob") entity.container.sendMsgToContents(entity, mob, "touch", "touches", "who suddenly shudders to life");
		else  entity.container.sendMsgToContents(entity, mob, "touch", "touches", "and it glows intensely for a moment");

		//make the prototype disappear
		if (container != null && 
		    prototype != null &&
		    container.hasOwnProperty("contents") &&
		    util.isArray(container.contents) &&
		    container.contents.indexOf(prototype) > -1) container.contents.splice(container.contents.indexOf(prototype),1);
		
		//prototype.container.contents.splice(target.container.contents.indexOf(target,1));
		//prototype.container == null;

		return;
	} else {
		entity._sendMsg("Err, that didn't work");
	}
}

function cmd_kill(entity, args) {
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	if (entity.fighting.length > 0) {
		entity._sendMsg("You are already fighting for your life!");
		return;
	}
	if (args.length != 2) {
		entity._sendMsg("Usage: kill <target>");
		return;
	}
	var target = entity.findEntityWithinReach(args[1]);
	if (target == null) {
		entity._sendMsg("You don't see anything like that here.");
		return;
	}

	if (target.type != "character" && 
		target.type != "mob") {
		entity._sendMsg("You can't kill that silly!");
		return;
	}
	if (entity == target) {
		entity._sendMsg("You cannot attack yourself.");
		return;
	}

	entity._sendMsg("Attack!");
	entity.tryToHit(target);

}

function cmd_listentities(entity, args) {
	var entities = playermanager.Game().entities;
	var types = [];
	var result = "";

	for (var i = 0; i < entities.length; i ++) {
		
		var e = entities[i];
		if (e.hasOwnProperty("type")) {
			if (types.indexOf(e.type) < 0) types.push(e.type);
		}
	}

	types.forEach( function(t) {
		result += t + "s:\n";
		for (var i = 0; i < entities.length; i++) {
			var e = entities[i];
			if (e.hasOwnProperty("type") && e.type == t) {
				var loc = "";
				var id = "";
				if (e.hasOwnProperty("_id")) id = e._id;
				if (e.hasOwnProperty("container") && e.container != null) loc = "\tlocation: " + e.container.descAction;
				result += "   " + id + ", " + e.descAction + " " + loc + "\n";
			}
		}
	});
	if (result.length > 0) entity._sendMsg(result);
	else entity._sendMsg("... no entities??");
}


function cmd_listclients(entity, args) {
	var result = dccserver.listClients();
	entity._sendMsg(result);
}


function cmd_now(entity, args) {
	entity._sendMsg("Server time (ms): " + Date.now());
}

function cmd_eat(entity, args) {
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	if (args.length < 2) {
		entity._sendMsg("So what is it that you would like to eat?");
		return;
	}
	var target = entity.findEntityFromInventory(args[1]);
	if (target == null) {
		entity._sendMsg("I don't see anything around here like that.");
		return;
	}
	if (entity.level >= playermanager.Game().levelBuilder) {
		target.container.contents.splice(target.container.contents.indexOf(target,1));
		target.container = null;
		entity.container.sendMsgToContents(entity, target, "eat", "eats", "whole");		
		return;	
	}
	entity._sendMsg("You can't eat that!");
}

function cmd_score(entity, args) {
	if (!entity.hasOwnProperty("type") || entity.type != "character") {
		entity._sendMsg("I don't know what you are.. So, how about no?");
		return;
	}
	var result = "";
	if (entity.hasOwnProperty("drone")) result += "You are currently a mindless drone.\n";
	if (entity.hasOwnProperty("blindRage")) result += "You are currently in a bind rage!\n";
	result += "You are level " + entity.level + " and " + entity.age + " tics old.\n"
	result += "Health: " + entity.getHealthText() + " " + entity.getHP() + "/" + entity.getMaxHP() + "  Ego: " + entity.ego + "/" + entity.maxEgo + "\n";
	result += "You are currently " + entity.getPosition() + ".\n";
	result += "Drives:\n";
	var key;
	for (key in entity) {
		var p = entity[key];
		if (util.isArray(p)) continue;
		if (p == null) continue;
		if (p.hasOwnProperty("type") && p.type == "drive") {
			var xpProgress = (entity.expToNextLevel(p) * 100 / entity.expTotalThisLevel(p));
			xpProgress = 100 - Math.round(xpProgress * 100) / 100;

			result += " - " + p.name + ", level " + p.level + ", experience: " + xpProgress + "%\n";
		}
	}
	
	result += "Current role: ";
	if (entity.isSwitch()) result += "switch";
	else if (entity.isDominant()) result += "dominant";
	else if (entity.isSubmissive()) result += "submissive";
	result += "\n";

	if (entity.hasOwnProperty("suggestionsMadeToMe")) {
		if (entity.suggestionsMadeToMe.length > 0) result += "Current Urges:\n";
		for (var i = 0; i < entity.suggestionsMadeToMe.length; i++) {
			var age = Math.floor((Date.now() - entity.suggestionsMadeToMe[i].time) / 1000);
			result += "  You have been feeling an urge to '" + entity.suggestionsMadeToMe[i].instruction + "' for the last " + age + " s\n";
		}
	}
	if (entity.hasOwnProperty("cash")) {
		var CashTypes = [];
		for (var commodityType in entity.cash) { if (entity.cash[commodityType] > 0) CashTypes.push(commodityType); }
		for (var i = 0; i < CashTypes.length; i++) {
			if (i == 0) result += "You are carrying ";
			result += entity.cash[CashTypes[i]] + " " + CashTypes[i];
			if (i == CashTypes.length - 1) result += " coins.\n";
			else if (i == CashTypes.length - 2) result += ", and ";
			else result += ", ";
		}
	}
    if (entity.level >= playermanager.Game().levelBuilder && entity.hasOwnProperty("editableZones")) {
        result += "Zones you have permission to edit:";
        for (var i = 0; i < entity.editableZones.length; i++) {
            if (i == 0) result += "\n";
            result += "  " + entity.editableZones[i] + "\n";
        }
        if (entity.level < playermanager.Game().levelCoordinator && entity.editableZones.length == 0) result += "  none.\n";
        else result += "  all.\n";
    }
	entity._sendMsg(result);
}

function cmd_createobj(entity, args) {
	var zone = null;
	if (!entity.hasOwnProperty("editingZone") || entity.editingZone == null) {
		entity._sendMsg("You are currently not editing any zones. Type @listzones and @editzone <zoneid> to select a zone for editing.");
		return;
	} else zone = entity.editingZone;

    if (!entity.canEditZone(zone._id)) {
        entity._sendMsg("Sorry, you do not have permission to edit objects in this zone.");
        return;
    }
    
	if (args.length  == 1) {
		var newObj = playermanager.createNewObjPrototype(entity);
		if (newObj != null) {
			if (newObj.zone != zone) {
				entity._sendMsg(newObj.getUpperCaseAction() + " belongs to " + newObj.zone.name + "/" + newObj.zone._id + " but you are editing " + zone.name + "/" + zone._id + ". Use @editzone to change your current zone.");
				return;
			}
			entity.container.sendMsgToContents(entity, newObj, "utter an incantation as", "utters an incantation as", "suddenly appears");
			return;
		} else {
			entity._sendMsg("Error, obj prototype could not be created for some reason.");
		}
	} else if (args.length == 2) {
		var id = args[1];
		var entities = playermanager.Game().entities;
		var prototype = null;
		for (var i = 0; i < entities.length; i++) {
			var p = entities[i];
			if (p.hasOwnProperty("type") && p.type == "objectprototype" && p.hasOwnProperty("_id") && p._id == id) {
				prototype = p;
			}
		}
		if (prototype == null) {
			entity._sendMsg("Cannot find a objprototype with that id.");
			return;
		}
		
		prototype.moveToContainer(entity);
		//if (entity.hasOwnProperty("contents") && entity.contents.indexOf(prototype) < 0) {
		//	entity.contents.push(prototype);
		//}
		//if (prototype.hasOwnProperty("container") && prototype.container != entity) {
		//	prototype.container = entity;
		//} else if (!prototype.hasOwnProperty("container")) {
		//	prototype.container = entity;
		//}
		entity.container.sendMsgToContents(entity, prototype, "utter an incantation as", "utters an incantation as", "suddenly appears");
	} else {
		entity._sendMsg("Usage: @createobjproto  or @createobjproto <id>");
	}
}

function cmd_wear(entity, args) {
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	if (args.length == 1) {
		entity._sendMsg("Well, what do you want to wear?");
		return;
	}
	var target = entity.findEntityFromInventory(args[1]);
	if (target == null) {
		entity._sendMsg("You don't see anything like that around here.");
		return;
	}
	if (target.type != "object") {
		entity._sendMsg("You can't wear that.");
		return;
	}
	if (!target.hasOwnProperty("wearablePositions") || !util.isArray(target.wearablePositions)) {
		entity._sendMsg("You can't wear that.");
		return;
	}
	if (target.wearablePositions.length == 0 || target.wearablePositions[0] == "none") {
		entity._sendMsg("You can't wear that.");
		return;
	}
	var success = entity.tryToWear(target, target.wearablePositions);

	if (success == "none") {
		entity._sendMsg("That goes on your "+target.wearablePositions[0]+" and you're already wearing something there.");
		return;
	}
	entity.container.sendMsgToContents(entity, target, "put on", "puts on", "");

}

function cmd_remove(entity, args) {
	if (args.length == 1) {
		entity._sendMsg("Well, what do you want to wear?");
		return;
	}
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	var target = entity.findEntityFromInventory(args[1]);
	if (target == null) {
		entity._sendMsg("You don't see anything like that around here.");
		return;
	}
	if (!target.hasOwnProperty("wornPosition")) {
		entity._sendMsg("You are already carrying that.");
		return;
	}
	if (target.wornPosition == "none") {
		entity._sendMsg("You are already carrying that.");
		return;
	}
	target.wornPosition = "none";
	entity.container.sendMsgToContents(entity, target, "stop using", "stops using", "");
}

function cmd_suggest(entity, args) {
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	if (args.length < 3) {
		entity._sendMsg("Usage: suggest <character> <command>");
		return;
	}
	var target = entity.findEntityWithinReach(args[1]);
	if (target == null) {
		entity._sendMsg("You do not see anyone like that here.");
		return;
	}
	var command = "";
	if (args.length >= 3) {
		for (var i = 2; i < args.length; i++) {
			command += args[i];
			if (i < args.length-1) command += " ";
		}
	}
	command = command.trim();
	
	var outcome = entity.compareEgos(target);
	if (outcome != null && outcome.hasOwnProperty("winner")) {
		if (outcome.winner == entity) {
			if (entity.sendSuggestion(target, command) == true) {	
				entity._sendMsg("You suggest " + target.descAction + " to '" + command + "'");
				entity.container.sendToEveryoneExcept([entity,target],entity.getUpperCaseAction() + " suggests " + target.descAction + ", \"" + command + "\"");
				//entity.container.sendMsgToContents(entity, target, "suggest something to", "suggests something to","");
			} else {
				entity._sendMsg("Your suggestion somehow failed.");
			}
		} else if (outcome.winner = target) {
			entity.container.sendMsgToContents(entity, target, "try in vain to influence", "tries in vain to influence", "");
		} else {
			//no draw
			entity.container.sendMsgToContents(entity, target, "try in vain to influence", "tries in vain to influence", "");

		}
	} else {
		entity._sendMsg("I'm not sure why, but that didn't work.");
	}
	
}

function cmd_testexp(entity, args) {
	entity._sendMsg("level, required exp:");
	for (var i = 0; i < 55; i++) {
		var drive = {level: i, experience: 0};
		entity._sendMsg("  " + i + " " + entity.expToNextLevel(drive));
	}
}

function findStore(entity) {
	if (entity.hasOwnProperty("container") &&
		entity.container != null &&
		entity.container.hasOwnProperty("contents") &&
		entity.container.contents.length > 1) {
			var room = entity.container;
			for (var i = 0; i < room.contents.length; i++) {
				var possibleStore = room.contents[i];
				if (possibleStore.hasOwnProperty("store") && possibleStore.store) return possibleStore;
			}
			return null;
		} else return null;
}

function cmd_storelist(entity, args) {
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	var store = findStore(entity);
	if (store == null) {
		entity._sendMsg("You don't see any trading going on around here.");
		return;
	}
	if (!store.hasOwnProperty("contents") || store.contents.length <= 0) {
		entity._sendMsg(store.getUpperCaseAction() + " says, \"Sorry mate, I'm all sold out today. Meet me here on the morrow, and might be I have something for you to spend ya coppers on.\"");
		return;
	}
	var result = store.getUpperCaseAction() + " presents some wares:\n";
	for (var i = 0; i < store.contents.length; i++) {
		var item = store.contents[i];
		var cost = 15;
		if (item.hasOwnProperty("cost")) cost = item.cost;
		if (store.hasOwnProperty("sellPriceAdjustment")) cost = Math.floor(cost * store.sellPriceAdjustment);
		result += i + ". " + item.getUpperCaseAction() + ", " + cost + " coppers\n";
	}
	entity._sendMsg(result);
}
function cmd_storesell(entity, args) {
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	var store = findStore(entity);
	if (store == null) {
		entity._sendMsg("You don't see any trading going on around here.");
		return;
	}
	if (!store.hasOwnProperty("cash") || store.returnCashValueInCoppers() <= 0) {
		entity._sendMsg(store.getUpperCaseAction() + " says, \"Sorry mate, I'm all out of copper for today.\"");
		return;
	}
	if (args.length < 2) {
		entity._sendMsg("Usage: sell <item>");
		return;
	}
	var item = entity.findEntityFromInventory(args[1]);
	if (item == null) {
		entity._sendMsg("It doesn't look like you actually have one of those to sell.");
		return;
	}
	var storeCoppers = 0;
	var cost = 0;
	if (item.hasOwnProperty("cost")) cost = Math.floor(item.cost * store.purchasePriceAdjustment);
	if (cost <= 0) {
		entity._sendMsg(store.getUpperCaseAction() + " scoffs, \"What do you expect me to do with that? Give it away?\"");
		return;
	}
	if (store.hasOwnProperty("cash")) storeCoppers = store.returnCashValueInCoppers();

	if (storeCoppers >= cost) {
		var newBalanceStore = store.convertCoppersToCommodities(store.returnCashValueInCoppers() - cost);
		var newBalancePlayer = entity.convertCoppersToCommodities(entity.returnCashValueInCoppers() + cost);
		store.cash = newBalanceStore;
		entity.cash = newBalancePlayer;
		entity.container.sendToEveryoneExcept([entity,store], entity.getUpperCaseAction() + " sells " + item.descAction + " to " + store.descAction + ".");
		entity._sendMsg("You sell " + item.descAction + " to " + store.descAction + ".");
		store._sendMsg(entity.getUpperCaseAction() + " sells " + item.descAction + " to you.");
		item.moveToContainer(store);
	} else {
		entity._sendMsg(store.getUpperCaseAction() + " shakes a head, \"Woo, sorry, I can't afford one of those.\"");
		return;
	}


}
function cmd_storebuy(entity, args) {
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	var store = findStore(entity);
	if (store == null) {
		entity._sendMsg("You don't see any trading going on around here.");
		return;
	}
	if (args.length < 2) {
		entity._sendMsg("Usage: buy <item_number>");
		return;
	}
	var itemNumber = Number(args[1]);
	if (itemNumber < 0 || itemNumber >= store.contents.length) {
		entity._sendMsg(store.getUpperCaseAction() + " says, \"Look here, mate! You wanna mess with somebody, go find that mustardy pig in the forest everyone's been yapping about, but don't waste my time.\"");
		return;
	}
	var item = store.contents[itemNumber];
	if (item == undefined) {
		entity._sendMsg("That's not a valid option.");
		return;
	}
	var playerCoppers = 0;
	var cost = 0;
	if (item.hasOwnProperty("cost")) cost = Math.floor(item.cost * store.sellPriceAdjustment);
	if (cost == 0) {
		entity._sendMsg(store.getUpperCaseAction() + " scoffs, \"What do I look like? A fool? I wouldn't trade this morning's turd for one of those.\"");
		return;
	}
	if (entity.hasOwnProperty("cash")) playerCoppers = entity.returnCashValueInCoppers();

	if (playerCoppers >= cost) {
		console.log("buy");
		console.log("\titem.cost=" + item.cost);
		console.log("\titem.cost (w sellpriceadj)   =" + cost);
		console.log("\told store balance (commodity)=" + JSON.stringify(store.cash));
		console.log("\told store balance (copper)   =" + store.returnCashValueInCoppers());
		console.log("\tnewStoreBalance (copper)     =" + (store.returnCashValueInCoppers() + cost));
		
		var newBalanceStore = store.convertCoppersToCommodities(store.returnCashValueInCoppers() + cost);
		var newBalancePlayer = entity.convertCoppersToCommodities(entity.returnCashValueInCoppers() - cost);
		store.cash = newBalanceStore;
		console.log("\tnewStoreBalance (commodity)  =" + JSON.stringify(store.cash));
		entity.cash = newBalancePlayer;
		entity.container.sendToEveryoneExcept([entity,store], entity.getUpperCaseAction() + " buys " + item.descAction + " from " + store.descAction + ".");
		entity._sendMsg("You buy " + item.descAction + " from " + store.descAction + ".");
		store._sendMsg(entity.getUpperCaseAction() + " buys " + item.descAction + " from you.");
		item.moveToContainer(entity);
	} else {
		entity._sendMsg(store.getUpperCaseAction() + " looks at your wallet and chuckles, \"You ain't got enuf for that one.\"");
		return;
	}
}

function cmd_consider(entity, args) {
	if (entity.getPosition() == "sleeping" ) {
		entity._sendMsg("You can't! You're " + entity.getPosition() + "!");
		return;
	}

	if (args.length <= 1) {
		entity._sendMsg("Usage: consider <target>");
		return;
	}
	var target = entity.findEntityWithinReach(args[1]);
	if (target == null) {
		entity._sendMsg("You do not see anyone like that here.");
		return;
	}
	
	var result = "You consider " + target.descAction + ":\n";
	var drive;
	for (drive in entity) {
		var p = entity[drive];
		if (util.isArray(p)) continue;
		if (p == null) continue;
		if (p.hasOwnProperty("type") && p.type == "drive") {
			var levelDiff = p.level;
			if (target.hasOwnProperty(drive) && target[drive].hasOwnProperty("level")) levelDiff -= target[drive].level
			result += " - " + p.name + ": " + levelDiff + "\n";
		}
	}
	entity._sendMsg(result);
}

function cmd_sudo(entity, args) {
    if (args.length <= 1) {
        entity._sendMsg("Usage: sudo <command>, args.length=" + args.length + " args=[" + args + "]");
        return;
    }
    args.splice(0,1);
    var oldLevel = entity.level;
    entity.level = playermanager.Game().levelMax;
    
    parseCommand(entity, args);
    
    entity.level = oldLevel;
}

function cmd_quit(entity, args) {
	playermanager.saveEntity(entity);
	entity.quit();	
}
function gotoPosition(entity, position) {
	var oldPosition = entity.getPosition();
	console.log("gotoPosition(" + position + ") from " + oldPosition);

	if (position == oldPosition) {
		entity._sendMsg("You are already " + position + ".");
		return;
	} else {
		var newPosition = entity.setPosition(position);
		if (newPosition != position) {
			console.log("error taking position " + position + " from " + oldPosition + ". We ended up " + newPosition );
			return;
		}

		if (oldPosition == "standing") {
			if (position == "kneeling") {
				entity._sendMsg("You fall to your knees.");
				entity.container.sendToEveryoneExcept([entity], entity.getUpperCaseAction() + " sinks down onto both knees.");
			} else if (position == "sitting") {
				entity._sendMsg("You sit down.");
				entity.container.sendToEveryoneExcept([entity], entity.getUpperCaseAction() + " sits down.");
			} else if (position == "sleeping") {
				entity._sendMsg("You lay down and fall asleep.");
				entity.container.sendToEveryoneExcept([entity], entity.getUpperCaseAction() + " lays down and falls asleep.");
			}
		} else if (oldPosition == "kneeling" || oldPosition == "sitting") {
			if (position == "standing") {
				entity._sendMsg("You climb up onto your feet.");
				entity.container.sendToEveryoneExcept([entity], entity.getUpperCaseAction() + " stands up.");
			} else if (position == "sleeping") {
				entity._sendMsg("You lay down and fall asleep.");
				entity.container.sendToEveryoneExcept([entity], entity.getUpperCaseAction() + " lays down and falls asleep.");
			} else if (position == "kneeling") {
				entity._sendMsg("You rise up to your knees.");
				entity.container.sendToEveryoneExcept([entity], entity.getUpperCaseAction() + " rises onto both knees.");
			}
		} else if (oldPosition == "sleeping") {
			if (position == "standing") {
				entity._sendMsg("You wake up and climb to your feet.");
				entity.container.sendToEveryoneExcept([entity], entity.getUpperCaseAction() + " wakes and stands up.");
			} else if (position == "sitting" || position == "kneeling") {
				entity._sendMsg("You climb to a " + position + " position.");
				entity.container.sendToEveryoneExcept([entity], entity.getUpperCaseAction() + " wakes and assumes a " + position + " position.");
			}
		} else {
			entity._sendMsg("You take a " + newPosition + " position.");
			entity.container.sendToEveryoneExcept([entity], entity.getUpperCaseAction() + " takes a " + newPosition + " position.");
		}
	}
}
function cmd_stand(entity, args) { gotoPosition(entity, "standing"); }
function cmd_kneel(entity, args) { gotoPosition(entity, "kneeling"); }
function cmd_sit(entity, args) { gotoPosition(entity, "sitting"); }
function cmd_sleep(entity, args) { gotoPosition(entity, "sleeping"); }
function cmd_wake(entity, args) {
	if (entity.getPosition() == "sleeping") gotoPosition(entity, "sitting");
	else entity._sendMsg("You are already awake.");
}
