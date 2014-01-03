var databaseUrl = "mydb";
var dbCollections = ["bot", "messageBuffer", "Game", "entities", "portals"];
var db = require("mongojs").connect(databaseUrl, dbCollections);
var irc = require("./irc");
var extend = require("xtend");
var sys = require("sys");
var commands = require("./commands.js");
var sleep = require("sleep");
var util = require("util");

var players = [];

exports.getPlayerByCharacterName = getPlayerByCharacterName;
exports.getCharacterByName = getCharacterByName;
exports.getPlayerByAuthToken = getPlayerByAuthToken;
exports.getPlayerByNick = getPlayerByNick;
exports.loadGameTic = loadGameTic;
exports.createNewRoom = createNewRoom;
exports.createNewPortal = createNewPortal;
exports.addEntityToGame = addEntityToGame;
exports.addPortalToGame = addPortalToGame;
exports.saveEntity = saveEntity;
exports.saveGame = saveGame;
exports.gameState = gameState;
exports.getCharacterByOwnerName = getCharacterByOwnerName;
exports.getEntities = getEntities;
exports.getEntityWithID = getEntityWithID;
exports.createNewZone = createNewZone;
exports.getZoneByName = getZoneByName;
exports.deletePortal = deletePortal;
exports.createNewMobPrototype = createNewMobPrototype;
exports.createNewObjPrototype = createNewObjPrototype;
exports.Game = Game;
exports.getWearablePositions = getWearablePositions;

// a little utility
Object.spawnChild = function (parent, props) {
  var defs = {}, key;
  for (key in props) {
    if (props.hasOwnProperty(key)) {
      defs[key] = {value: props[key], enumerable: true};
    }
  }
  return Object.create(parent, defs);
}

Object.spawnBaby = function (parent, props) {
  console.log("Spawning baby of " + parent);
  var defs = {}, key;
  for (key in props) {
    if (props.hasOwnProperty(key)) {
      defs[key] = {value: props[key], enumerable: true};
    }
  }
  return Object.create(parent, defs);
}

function getPlayerByCharacterName(name) {
	for (var i = 0; i < players.length; i++) {
		if (players[i].controlling != null &&
			players[i].controlling.hasOwnProperty("name") &&
			players[i].controlling.name == name) return players[i];
	}
	var newPlayer = extend(Player);

	newPlayer.nick = name;
	players.push(newPlayer);

	return newPlayer;
}

function getPlayerByNick(nick) {
  for (var i = 0; i < players.length; i++) {	
    if (players[i].nick.toLowerCase() == nick.toLowerCase()) {
    	return players[i];
    }
  }
  var newPlayer = extend(Player);
  // = Object.spawnChild(Player, {});
  //util.inherits(newPlayer, Player);

  newPlayer.nick = nick;
 
  players.push(newPlayer);

  return newPlayer;
}
function getCharacterByName(name) {
	for (var i = 0; i < entities.length; i++) {
		var e = entities[i];
		if (e.type == "character" && e.name == name) return e;
	}
	return null;
}

function getPlayerByAuthToken(at) {
	for (var i = 0; i < players.length;i++) {
		var player = players[i];
		if (player.hasOwnProperty("authToken") && player.hasOwnProperty("authTokenCreationTime")) {
			if (player.authToken == at) {
				console.log("\tplayer.authToken[" + player.authToken + "] == at[" + at + "]");
				if (player.authTokenCreationTime >= Date.now() - 60000) {
					console.log("\t\tvalid and prompt!");
					return player;
				} else {
					console.log("\t\tvalid but not prompt.");
				}
			} else {
				console.log("\tplayer.authToken[" + player.authToken + "] != at[" + at + "]");
			}
		} 
	}
	return null;
}

var Game = {
	entities: [],	//The entities array is used for two things:
			//	1. It maintains a list of things saved and needing to be saved to the DB
			//	2. It maintains a list of things to be iterated through for tic purposes
			//	(both of these also apply to the portals array)
	portals: [],

	newPlayerSpawnPoint: -1,
	newPlayerSpawnPointID: db.ObjectId("52489444b8751e5825000001"),

	deadPlayerSpawnPoint: -1,
	deadPlayerSpawnPointID: db.ObjectId("52489444b8751e5825000001"),
	
	levelImmortal: 50,
	levelBuilder: 51,
    levelCoordinator: 52,
	levelMax: 55,

	fightIRT: 1490,

	balance_HPMultPerLevel: 1.2,
	balance_DMGMultPerLevel: 1.1,
	balance_BaseHitProbability: 0.2,
	lastTicTime: 0,
	ready: 0,
	state: 0,	// 	0 - undefined
			//	1 - requested entities from db
			//	2 - received all entities from db
			//	3 - requested portals from db
			//	4 - received all portals from db
			
	getEntityWithID: function(id) {
		for (var i=0; i<this.entities.length; i++) {
			if (id.toString() == this.entities[i]._id.toString()) {
				//console.log("getEntityWithID, comparing [" + id + "] to [" + this.entities[i]._id + "] <-- match!!!");
				//console.log("getEntityWithID: found!!");
				return this.entities[i];
			} else if ("ObjectId(\"" + id + "\")" == this.entities[i]._id) {
				//console.log("getEntityWithID: found!! (required putting in ObjectId()");
				return this.entities[i];
			} else {
				//console.log("getEntityWithID, comparing [" + id + "] to [" + this.entities[i]._id + "]           :( ");
			}
		}
		console.log("getEntityWithID: not found!! id=" + id);
		return null;
	},
	getPortalWithID: function(id) {
		for (var i=0; i<this.portals.length; i++) {
			if (id.toString() == this.entities[i]._id.toString()) {
				return this.entities[i];
			}
		}
		return null;
	},
	deletePortal: function(portal) {
		//remove from portals list
		var portalIndex = this.portals.indexOf(portal);
		if (portalIndex == -1) return -1;
		this.portals.splice(portalIndex,1);
		
		var A = portal.A;
		var B = portal.B;

		if (A.hasOwnProperty("portals")) {
			var Aindex = A.portals.indexOf(portal);
			if (Aindex != -1) A.portals.splice(Aindex,1);
		}
		if (B.hasOwnProperty("portals")) {
			var Bindex = B.portals.indexOf(portal);
			if (Bindex != -1) B.portals.splice(Bindex,1);
		}
		db.portals.remove({_id: portal._id});
		return 1;
	},
	tic: function() {
		var ticStartTime = Date.now();
		var numTics = 0;
		for (var i = this.entities.length-1; i >= 0; i--) {
			if (this.entities[i].hasOwnProperty("purge")) {
				console.log("removing " + this.entities[i].descAction + " id: " + this.entities[i]._id + " from entity list.");
				this.entities.splice(i,1);
				continue;
			}
			if (this.entities[i].hasOwnProperty("tic")) {
				this.entities[i].tic();
				numTics++;
			}
		}
		this.lastTicTime = Date.now();
		var duration = this.lastTicTime - ticStartTime;
		//console.log("tic duration: " + duration + " numTics: " + numTics);
	}

}

function Game() {
	return Game;
}

function getEntityWithID(id) {
	return Game.getEntityWithID(id);
}

function getCharacterByOwnerName(name) {
	for (var i = 0; i < Game.entities.length; i++) {
		if (Game.entities[i].type == "character" &&
		    Game.entities[i].playerOwnerNick == name) return Game.entities[i];
	}
	return null;
}

function gameState() {
	return Game.state;
}

function addEntityToGame(entity) {
	Game.entities.push(entity);
}
function addPortalToGame(portal) {
	Game.portals.push(portal);
}
function getEntities() {
	return Game.entities;
}
function deletePortal(portal) {
	return Game.deletePortal(portal);
}

//
//
//
//
//


function loadGameTic() {
	if (Game.state == 0) {
		console.log("Loading game from DB.");
		Game.state = 1;
		Game.entities = [];
		Game.portals = [];
	} else if (Game.state == 1) {
		console.log("\tClearing outgoing message buffer.");
		db.messageBuffer.remove();
		console.log("\tRequesting entities from DB.");
		db.entities.find().forEach(receivedEntityFromDB);
		//the above sets Game.state = 2 when finished
	} else if (Game.state == 2 && Game.entities.length > 0) {
		console.log("\tRead " + Game.entities.length + " entities from db.");
		Game.state = 3;
		console.log("\tRequesting portals from DB.");
		db.portals.find().forEach(receivedPortalFromDB);
	} else if (Game.state == 2 && Game.entities.length == 0) {
		//the database is empty create a new world
		console.log("\tThe game database appears empty.");
		
		Game.state = 5;
		createEmptyGame();
	} else if (Game.state == 4) {
		console.log("\tRead " + Game.portals.length + " portals from db.");
		console.log("\tSearching for newPlayerSpawnPointID=[" + Game.newPlayerSpawnPointID + "]");
		var spawnpoint = Game.getEntityWithID(Game.newPlayerSpawnPointID);
		if (spawnpoint == null) {
			console.log("\tgetEntityWithID failed to find spawnpoint @ " + Game.newPlayerSpawnPoint);
			Game.newPlayerSpawnPoint = Game.entities[0];
		}
		console.log("\tSearching for spawn point.");
		
		var spawnpoint = Game.getEntityWithID(Game.newPlayerSpawnPointID);
		if (spawnpoint == null) {
			console.log("\tCould not find spawn point :( setting to Game.entities[0]");
			Game.newPlayerSpawnPoint = Game.entities[0];
		} else {
			console.log("\tFound entity with spawnpoint");
			console.log("\tspawnpoint.hasOwnProperty(_id)=" + spawnpoint.hasOwnProperty("_id"));
			console.log("\tspawnpoint._id=[" + spawnpoint._id + "]");
			Game.newPlayerSpawnPoint = spawnpoint;
		}

		var deadplayerspawnpoint = Game.getEntityWithID(Game.deadPlayerSpawnPointID);
		if (deadplayerspawnpoint == null) {
			Game.deadPlayerSpawnPoint = game.entities[0];
			console.log("\tcould not find deadPlayerSpawnPoint.");
		} else {
			Game.deadPlayerSpawnPoint = deadplayerspawnpoint;
			console.log("\tfound deadPlayerSpawnPoint.");
		}

		console.log("\tAssigning rooms and mobs to zones.");
		for (var i = 0; i < Game.entities.length; i++) {
			if (Game.entities[i].type == "zone") {
				var zone = Game.entities[i];
				console.log("\t\t" + zone.name + " " + zone._id + " contents.length=" + zone.contentsIDs.length);
				console.log("\t\tcontents: " + zone.contentsIDs);

				zone.contents = [];
				for (var j = 0; j < zone.contentsIDs.length; j++) {
					var room = Game.getEntityWithID(zone.contentsIDs[j]);
					if (room == null) {
						console.log("\t\t\tno match");
					} else {
						console.log("\t\t\troom found, assigning");
						zone.contents.push(room);
						room.zone = zone;
						room.zoneID = zone._id;
						console.log("\t\t\t+" + room.descAction + " " + room._id);
					}
				}

				if (zone.hasOwnProperty("mobPrototypesIDs")) {
					for (var j = 0; j < zone.mobPrototypesIDs.length; j++) {
						var prototype = Game.getEntityWithID(zone.mobPrototypesIDs[j]);
						if (prototype == null) {
							console.log("\t\t\tcould not find mobprototype._id = " + zone.mobPrototypesIDs[j]);
						} else {
							zone.addMobPrototype(prototype);
							console.log("\t\t\tadded prototype. i="+i+" _id=" + zone._id + " j=" + j + "  of " + zone.mobPrototypesIDs.length);
						}
					}
				}
/*
				for (var j = 0; j < Game.entities.length; j++) {
					if (i == j) continue;
					if (Game.entities[j].type == "room") {
						var room = Game.entities[j];
						console.log("\t\t\tevaluating room " + room.descAction + " " + room._id + " index: " + zone.contentsIDs.indexOf(room._id));
						if (zone.contentsIDs.indexOf(room._id) != -1) {
							zone.contents.push(room);
							room.zone = zone;
							room.zoneID = zone._id;
							console.log("\t\t\t+" + room.descAction + " " + room._id);
						}
					}
				}
				*/
			}
		}
		
		console.log("\tIndexing rooms, assigning to zones if necessary.");
		for (var i = 0; i < Game.entities.length; i++) {
			if (Game.entities[i].type == "room") {
				var room = Game.entities[i];
				if (room.hasOwnProperty("zoneID")) {
					if (!room.hasOwnProperty("zone") || room.zone == null) {
						var zone = Game.getEntityWithID(room.zoneID);
						room.zone = zone;
						console.log("\t\troom._id=" + room._id);
					}
				}
			}
		}

		console.log("\tLooking for unassigned mob prototypes, assigning to zones.");
		for (var i = 0; i < Game.entities.length; i++) {
			
			if (Game.entities[i].type == "mobprototype") {
				var p = Game.entities[i];
				if (p.hasOwnProperty("zoneID")) {
					var zone = Game.getEntityWithID(p.zoneID);
					if (zone != null) {
						zone.addMobPrototype(p);
						console.log("\t\tassigning " + p.descAction + " to " + zone.name);
					}
				}
			}
		}
		
		console.log("\tAssigning object prototypes to zones.");
		var objectPrototypesWithoutZones = 0;
		for (var i = 0; i < Game.entities.length; i++) {
			var obj = Game.entities[i];
			if (obj.hasOwnProperty("type") && obj.type == "objectprototype") {
				if (obj.hasOwnProperty("zoneID")) {
					var zone = Game.getEntityWithID(obj.zoneID);
					if (zone != null) {
						obj.zone = zone;
						if (!zone.contents.indexOf(obj)) zone.contents.push(obj);	
						
					} else objectPrototypesWithoutZones++;
				}
			}
		}

		console.log("\tCleaning zones.");
		for (var i = 0; i < Game.entities.length; i++) {
			if (Game.entities[i].type == "zone") {
				var zone = Game.entities[i];
				if (zone.hasOwnProperty("clean")) zone.clean();
			}
		}

		console.log("\tAssigning spawn rooms.");
		for (var i = 0; i < Game.entities.length; i++) {
			if (Game.entities[i].type == "mobprototype") {
				var p = Game.entities[i];
				for (var j = 0; j < p.spawnRoomIDs.length; j++) {
					var room = Game.getEntityWithID(p.spawnRoomIDs[j]);
					if (room != null) p.addSpawnRoom(room);
				}
			}
		}
		console.log("\tdone.");

		Game.state = 5; //ready
	}
}

function receivedEntityFromDB(err, e) {
//	console.log("\t\treading entity.");
	if (!e) {
		console.log("\t\tdone...");
		Game.state = 2;
		return;
	} else {
		if (e.type == "entity") {
			console.log("\t\treading generic entity.");

			var newE = extend(Entity);
			newE.contents = [];
			newE.portals = [];
			
			//Copy the stuff read from the DB into the new obj
			var key, value; 
			for (key in e) { 
				value = e[key]; 
				newE[key] = value; 
			}

			Game.entities.push(newE);

		} else if (e.type == "zone") {
			console.log("\t\treading zone.");

			var newZone = extend(Zone);
			newZone.contents = [];
			newZone.mobPrototypes = [];
			newZone.mobPrototypesIDs = [];

			var key, value; 
			for (key in e) { 
				value = e[key]; 
				newZone[key] = value; 
			}

			Game.entities.push(newZone);

		} else if (e.type == "room") {
			console.log("\t\treading room.");

			var newRoom = extend(Room);
			newRoom.contents = [];
			newRoom.portals = [];
			newRoom.zone = null;

			//Copy the stuff read from the DB into the new obj
			var key, value; 
			for (key in e) { 
				value = e[key]; 
				newRoom[key] = value; 
			}

			Game.entities.push(newRoom);
		} else if (e.type == "character") {
			var name = "";
			if (e.hasOwnProperty("name")) name = e.name; 
			console.log("\t\treading entity. " + e.name);

			var newChar = extend(Character);
			newChar.contents = [];
			newChar.portals = [];
			newChar.fighting = [];
			newChar.suggestionsMadeToMe = [];
            newChar.editableZones = [];
            
			var key, value;
			for (key in e) {
				value = e[key];
				newChar[key] = value;
			}
			console.log("\t\t\tinventory contains " + newChar.contents.length + " items.");

			//assign functions to objects in character's inventory
			for (var i = 0; i < newChar.contents.length; i++) {
				var obj = newChar.contents[i];
				if (obj.hasOwnProperty("type") && obj.type == "object") {
					console.log("\t\t\t\tassigning functions to " + obj.descAction);
					assignFunctionsToEntity(obj);
					obj.container = newChar;
					Game.entities.push(obj);
				} else {
					console.log("\t\t\t\tignoring " + obj.descAction);
				}
			}

			Game.entities.push(newChar);
		} else if (e.type == "mobprototype") {
			var mob = extend(MobPrototype);
			mob.contents = [];
			mob.portals = [];
			mob.mobsInGame = [];
			mob.spawnRooms = [];
			mob.spawnRoomIDs = [];
			mob.spawnObjects = [];
			mob.chatMessages = [];
			mob.cash = returnCommodityForCopper(0);

			var key, value;
			for (key in e) {
				value = e[key];
				mob[key] = value;
			}

			Game.entities.push(mob);
		} else if (e.type == "objectprototype") {
			var obj = extend(ObjPrototype);
			obj.contents = [];
			obj.objsInGame = [];
			obj.wearablePositions = [];
			for (key in e) {
				value = e[key];
				obj[key] = value;
			}

			Game.entities.push(obj);

		}
	}
}
function receivedPortalFromDB(err, p) {
	if (!p) {
		Game.state = 4;
		return;
	} else {
		console.log("\t\treading portal.");
		if (p.type != "portal") {
			console.log("ERROR, playermanager.js, receivedPortalfromDB, we expected a portal, but instead we received a [" + p.type + "]");
			return;
		}
		var newPortal = extend(Portal);
		var key, value;
		for (key in p) {
			value = p[key];
			newPortal[key] = value;
		}
		if (newPortal.Aid != -1) {
			newPortal.A = Game.getEntityWithID(newPortal.Aid);
			if (newPortal.A == null) console.log("\t\t\terror! newPortal.A is null.  getEntityWithID failed.");
			else {
				console.log("\t\t\tsuccessfully assigned A-side of portal to room w/ id=" + newPortal.Aid);
				console.log("\t\t\troomname=" + newPortal.A.descAction);
			}
		} else {
			newPortal.A = null;
			console.log("\t\t\tunable to assign A-side of portal, Aid=" + newPortalAid);

		}

		if (newPortal.Bid != -1) {
			newPortal.B = Game.getEntityWithID(newPortal.Bid);
			console.log("\t\t\tsuccessfully assigned B-side of portal to room w/ id=" + newPortal.Bid);
		} else {
			newPortal.B = null;
			console.log("\t\t\tunable to assign B-side of portal, Bid=" + newPortalBid);
		}

		
		if (newPortal.A != null) newPortal.A.portals.push(newPortal);
		if (newPortal.B != null) newPortal.B.portals.push(newPortal);
		if (!newPortal.hasOwnProperty("VisibleFromA")) newPortal.VisibleFromA = true;
		if (!newPortal.hasOwnProperty("VisibleFromB")) newPortal.VisibleFromB = true;
		if (!newPortal.hasOwnProperty("ABTraversable")) newPortal.ABTraversable = true;
		if (!newPortal.hasOwnProperty("BATraversable")) newPortal.BATraversable = true;

		Game.portals.push(newPortal);
	}
}
function connectEntities() {
	//after you read the flat entities from the DB
	//you need to actually connect them to each other
	for (var i = 0; i < Game.entities.length; i++) {
		var entity = Game.entities[i];

		entity.contents = [];
		for (var j = 0; j < entity.contentsIDs.length; j++) {
			var content = Game.getEntityWithID(entity.contentsIDs[j]);
			if (content == null) {
				console.log("ERROR, playermanager.js, connectEntities: could not find entity with id=" + entity.contentsIDs[j]);
				continue;
			}
			entity.contents.push(content);
		}

		//Do not put player characters in the game
		if (entity.type == "Character" && entity.playerOwnerNick != "") continue;

		entity.container = null;
		var container = Game.getEntityWithID(entity.containerID);
		if (container == null) {
			console.log("ERROR, playermanager.js, connectEntities: could not find container with id=" + entity.containerID);
		}

	}
}


function createEmptyGame() {
	//create new worldi
	console.log("Creating new world...");
	var room = createNewRoom();
	room.descAction = "The Void";
	room.descLook = "You find yourself enveloped in a black, empty, weightlessness."
	Game.entities = [];
	Game.entities.push(room);
	Game.newPlayerSpawnPoint = room;
}

function assignFunctionsToEntity(entity) {
	if (!entity.hasOwnProperty("type")) { console.log("Error, assignFunctionsToEntity called on something without a type!"); return; }
	if (entity.type == "entity") copyFunctionsToObject(Entity, entity);
	else if (entity.type == "room") copyFunctionsToObject(Room, entity);
	else if (entity.type == "character") copyFunctionsToObject(Character, entity);
	else if (entity.type == "mobprototype") copyFunctionsToObject(MobPrototype, entity);
	else if (entity.type == "mob") copyFunctionsToObject(Mob, entity);
	else if (entity.type == "objectprototype") copyFunctionsToObject(ObjPrototype, entity);
	else if (entity.type == "object") copyFunctionsToObject(extend(Obj), entity);
	else {
		console.log("Error, assignFunctionsToEntity, entity.type == [" + entity.type + "] is an unknown type."); 
		return;
	}
}

function isFunction(functionToCheck) {
 var getType = {};
 return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

function copyFunctionsToObject(c, o) {
	for (var key in c) {
		var value = c[key];
		if (isFunction(value)) o[key] = value;
	}
}
//
//
//
//
//
function saveEntity(entity) {
	if (entity==null) return;
	if (entity.hasOwnProperty("donotsave")) return;
	var flat = entity.makeFlatCopy();
	db.entities.save(flat);
}

function saveGame() {
	console.log("Saving game.");
	for (var i = 0; i < Game.entities.length; i++) {
		if (Game.entities[i].type == "mobprototype") {
			if (!Game.entities[i].hasOwnProperty("save") || !Game.entities[i].save) continue;
		} else if (Game.entities[i].type == "mob") continue;
		else if (Game.entities[i].type == "character" && Game.entities[i].hasOwnProperty("donotsave")) continue;
		else if (Game.entities[i].type == "object") continue; 
		console.log("\tsaving [" + Game.entities[i].type + "] " + Game.entities[i].descAction);
		db.entities.save(Game.entities[i].makeFlatCopy());
	}
	for (var i = 0; i < Game.portals.length; i++) {
		db.portals.save(Game.portals[i].makeFlatCopy());
	}
}

function createNewRoom() {
	console.log("creating new room");
	var newRoom = extend(Room, {
		descAction: "An Undefined Room",
		descLook: "This is an undefined room.  No one has yet to write a description for it.  Perhaps you would be so kind.",
		portals: [],
		contents: []

	});
	newRoom._id = db.ObjectId();
	return newRoom;
}
function createNewPortal() {
	console.log("creating new portal");
	var newPortal = extend(Portal);
	newPortal._id = db.ObjectId();		//generate a new object ID
	return newPortal;
}

function createNewZone() {
	console.log("creating new zone");
	var newZone = extend(Zone);
	newZone.init();
	
	return newZone;
}
function getZoneByName(name) {
	for (var i = 0; i < Game.entities[i]; i++) {
		if (Game.entities[i].name == name) return Game.entities[i];
	}
	return null;
}

//This is a player connected from the outside
var Player = {
  nick: "undefined",
  type: "player",
  lastSeenTime: -1, 
  numTimesSeen: 0,
  lastSaveTime: -1,
  saveToDB: 0,
  securityClearance: 0,
  nickservStatus: "undefined",
  controlling: null,

  setNickServStatus: function(status) {
  	this.nickservStatus = status;
  },
  getNickServStatus: function() {
  	return this.nickservStatus;
  },
  getControlling: function() {
  	if (this.hasOwnProperty('controlling')) return this.controlling;
	else return null;
  },
  setController: function(ch) {
  	this.controlling = ch;
	ch.controller = this;
  },
  getType: function() {
	if (this.hasOwnProperty('type')) return this.type;
	else return "undefined";
  },
  see: function() {
  	this.lastSeenTime = Date.now();
	this.numTimesSeen++;
  },
  remember: function() {
  	this.saveToDB = 1;
  },
  sendMsg: function(msg) {
  	console.log("ERROR, Player.sendMsg is being called.. Should be calling _sendMsg");
	var x = 100/0;
  },
  _sendMsg: function(msg) {
  	if (this.hasOwnProperty("dccClient")) {
		this.dccClient.stream.write(msg+"\n");
	} else {
  		//console.log("calling sendMsg: " + msg);
	  	if (this.nick == "undefined") {
			console.log("ERROR, playermanager.js, Player.sendMsg, player has no nick! Attempted to send: " + msg);
			return;
		}
	  	irc.addToSendBuffer({
			target: this.nick,
			message: msg,
			initiatedTime: Date.now()
		});
	}
  },
  createNewCharacter: function() {
  	if (this.controlling != null) {
		console.log("ERROR, playermanager, Player.createNewCharacter, this player already has a character!");
		return;
	}
  	if (Game.newPlayerSpawnPoint == null) {
		console.log("ERROR, playermanager, Player.createNewCharacter, Game.newPlayerSpawnPoint undefined! Maybe the world hasn't been created?");
		return;
	}
	//if (this == null) console.log("ERROR, playermanager, Player.createNewCharacter, this is nul!?");
	//else console.log("SUCCESS, playermanager, Player.createNewCharacter, this player is not null! (good)");
  	var character = extend(Character);
	this.controlling = character;
	character.playerOwner = this;
	character.setController(this);
	character.keywords = ["undefined", "character"];
	character.fighting = [];
	character.keywords.push(this.nick);
	character.name = this.nick;
	character.playerOwnerNick = this.nick;
	character._id = db.ObjectId();
	character.donotsave = true;
	character.rollNewCharacter();
	return character;
  },
  spawn: function() {
  	if (this.controlling == null) {
		console.log("ERROR, playermanager, Player.spawn, attempted to spawn player without character");
		return;
	}
	// we should check to make sure the character isn't already in the game
	// 
	//
	this.container = Game.newPlayerSpawnPoint;	
	this.controlling.spawn();
  }
  /*
  disconnect: function() {
  	for (var i = 0; i < Game.entities.length; i++) {
		if (Game.entities[i].type == "character" && Game.entities[i].name == this.nick) {
			Game.entities[i].disconnect();
			break;
		}
	}
  }
  */
}

// Portals connect two entities
// In the case of rooms, it's best this think of them as exits (or doorways) that connect the rooms
var Portal = {
	_id: -1,
	type: "portal",
	A: -1,					// Entity A
	Aid: -1,
	B: -1,					// Entity B
	Bid: -1,
	ABKeyword: "",				// The keyword needed to transition from (within) A to B
	BAKeyword: "",				// The keyword needed to transition from (within) B to A
	ABTraversable: true,
	BATraversable: true,
	VisibleFromA: true,
	VisibleFromB: true,
	getPortalKeywordFromEntity: function(entity) {
		if (entity == this.A) return this.ABKeyword;
		else if (entity == this.B) return this.BAKeyword;
		else return "";
	},
	getTargetEntityFromEntity: function(entity) {
		if (entity == this.A) return this.B;
		else if (entity == this.B) return this.A;
		else return -1;
	},
	traversableFromEntity: function(entity) {
		if (!this.hasOwnProperty("ABTraversable")) this.ABTraversable = true;
		if (!this.hasOwnProperty("BATraversable")) this.BATraversable = true;
		if (entity == this.A) return this.ABTraversable;
		else if (entity == this.B) return this.BATraversable;
		else return false;
	},
	visibleFromEntity: function(entity) {
		if (!this.hasOwnProperty("VisibleFromA")) this.ABTraversable = true;
		if (!this.hasOwnProperty("VisibleFromB")) this.BATraversable = true;
		if (entity == this.A) return this.VisibleFromA;
		else if (entity == this.B) return this.VisibleFromB;
		else return false;
	},
	makeFlatCopy: function() {
		var copy = extend(this);
		if (copy.A == null) copy.Aid = -1;
		else copy.Aid = copy.A._id;

		if (copy.B == null) copy.Bid = -1;
		else copy.Bid = copy.B._id;
		
		delete copy.A;
		delete copy.B;

		return copy;
	}
}

// This is a thing that is present in the game
// All in-game things inherit from this class
var Entity = {
	_id: -1,				// A unique ID applied to all entities
	type: "entity",
	//location: "undefined",  		// All entities have locations, locations are pointers to a room, another entity (e.g., a character, or a container, etc)
	descAction: "an undefined thing",	// this is the action description -- it is displayed when entites are used, or behave (e.g., "a short troll", "a sliver of moonlight")
	keywords: ["undefined", "thing"],	// keywords used by players to refer to entities
	descLook: "You look upon the undefined thing and find it unusually hard to describe.",
	mass: 0,				// grams
	internalVolume: 0,			// the carrying capacity of a container, in cubic centimeters
	externalVolume: 0,			// the external size of an entity
	
	// these are used during the game
	container: null,			// points to the container that holds the entity
	contents: [],				// array holding all the entities a given entity contains
	portals: [],
	
	// these are the things actually saved to the DB
	// if we try to save the things above, we get all kinds of nasty circular structures
	containerID: -1,
	contentsIDs: [],
	portalsIDs: [],

	getUpperCaseAction: function() {
		return this.descAction.substring(0,1).toUpperCase() +
			this.descAction.substring(1,this.descAction.length).toLowerCase();
	},
	moveToContainer: function(newcontainer) {
		var oldcontainer = this.container;

		if (newcontainer == null) {
			if (oldcontainer && 
		    		oldcontainer.hasOwnProperty("contents") &&
				oldcontainer.contents.indexOf(this) >  -1) 
					oldcontainer.contents.splice(oldcontainer.contents.indexOf(this),1);
			this.container = null;

			return;
		}
		
		//moving cash to a player or mob
		if (this.type == "object" && this.hasOwnProperty("cash") && (newcontainer.type == "character" || newcontainer.type == "mob")) {
			if (!newcontainer.hasOwnProperty("cash")) newcontainer.cash = extend(Cash);
			for (var commodityType in this.cash) {
				newcontainer.cash[commodityType] += this.cash[commodityType];
				this.cash[commodityType] = 0;
			}
			if (oldcontainer && 
		    		oldcontainer.hasOwnProperty("contents") &&
				oldcontainer.contents.indexOf(this) >  -1) 
					oldcontainer.contents.splice(oldcontainer.contents.indexOf(this),1);
			this.purge = true;
			return;
		}

		if (!newcontainer.hasOwnProperty("contents")) newcontainer.contents =[];
		
		if (oldcontainer && 
		    oldcontainer.hasOwnProperty("contents") &&
		    oldcontainer.contents.indexOf(this) >  -1) 
				oldcontainer.contents.splice(oldcontainer.contents.indexOf(this),1);
		else {
			//if (oldcontainer == null) console.log("Error, moveToContainer, oldcontainer is null!");
			//else if (oldcontainer.hasOwnProperty("contents")) console.log("Error, moveToContainer, oldcontainer has no property contents!");
			//else console.log("Error, moveToContainer, unknown error removing item from previous container.");
		}

		if (newcontainer.contents.indexOf(this) == -1) newcontainer.contents.push(this);
		this.container = newcontainer;

		if (this.hasOwnProperty("wornPosition")) this.wornPosition = "none";
	},
	purgeFromGame: function() {
		var oldcontainer = this.container;
		if (oldcontainer && 
		    oldcontainer.hasOwnProperty("contents") &&
		    oldcontainer.contents.indexOf(this) >  -1) 
			oldcontainer.contents.splice(oldcontainer.contents.indexOf(this),1);
		
		//if (Game.entities.indexOf(this) > -1)
		//	Game.entities.splice(Game.entities.indexOf(this),1);
		
		if (this.hasOwnProperty("prototypePointer") && this.prototypePointer != null) {
			var prototype = this.prototypePointer;
			if (prototype.hasOwnProperty("mobsInGame") && prototype.mobsInGame.indexOf(this) >= 0) {
				prototype.mobsInGame.splice(prototype.mobsInGame.indexOf(this),1);
			}
		}
		this.purge = true; //remove it from entities list on the next tic
	},
	makeFlatCopy: function() {
		var copy = extend(this, {contents: []});

		if (copy.container != null) copy.containerID = copy.container._id;
		else copy.containerID = -1;

		copy.contentsIDs = [];
		for (var i = 0; i < copy.contents.length; i++) {
			copy.contentsIDs.push(copy.contents[i]._id);
		}

		if (copy.hasOwnProperty("portals")) {
			copy.portalsIDs = [];
			for (var i = 0; i < copy.portals.length; i++) {
				copy.portalsIDs.push(copy.portals[i]._id);
			}
		}

		delete copy.container;
		
		if (copy.type == "character" && copy.hasOwnProperty("controller") && copy.hasOwnProperty("playerOwner")) {
			/* save people's inventories */
			//copy objects from this.contents to copy.contents
			for (var i = 0; i < this.contents.length; i++) {
				var content = this.contents[i];
				if (content.type == "object") {
					copy.contents.push(content.makeFlatCopy());
				}
			}
			/*
			for (var i = copy.contents.length-1; i >= 0; i--) {
				var content = copy.contents[i];
				if (content.type == "object") {
					copy.contents[i] = content.makeFlatCopy();
				} else {
					// If it's not an object, remove it from the array
					copy.contents.splice(i,1);
				}
			}
			*/
		} else delete copy.contents;

		delete copy.portals;
		delete copy.following;
		
		if (copy.hasOwnProperty("suggestionsMadeByMe")) delete copy.suggestionsMadeByMe;
		if (copy.hasOwnProperty("suggestionsMadeToMe")) delete copy.suggestionsMadeToMe;
		/*
		{
			copy.suggestionsMadeToMe = [];
			for (var i = 0; i < this.suggestionsMadeToMe.length; i++) {
				copy.suggestionsMadeToMe.push(extend(this.suggestionsMadeToMe[i]
				if (this.suggestionsMadeToMe[i].hasOwnProperty("suggester")) delete copy.suggestionsMadeToMe[i].suggester;
			}
		}
		*/

		if (copy.hasOwnProperty("prototypePointer")) delete copy.prototypePointer;
		if (copy.hasOwnProperty("mobsInGame")) delete copy.mobsInGame;	
		if (copy.hasOwnProperty("mobPrototypes")) delete copy.mobPrototypes;
		if (copy.hasOwnProperty("controller")) delete copy.controller;
		if (copy.hasOwnProperty("playerOwner")) delete copy.playerOwner;
		if (copy.hasOwnProperty("editingZone")) delete copy.editingZone;
		if (copy.hasOwnProperty("zone")) {
			if (copy.zone != null && copy.zone.hasOwnProperty("_id")) {
				copy.zoneID = copy.zone._id;
			}
			delete copy.zone;
		}
		if (copy.hasOwnProperty("fighting")) delete copy.fighting;

		return copy;
	}
}

// zones are mostly used for organizing rooms
var Zone = extend(Entity, {
	type: "zone",
	name: "undefined",
	contents: [],
	mobPrototypes: [],
	mobPrototypesIDs: [],
	initialized: false,
	refreshInterval: 60000,
	nextRefreshTime: 0,
	tic: function() {
		if (Date.now() >= this.nextRefreshTime) {
			//console.log("zone tic: " + this.name);
			if (this.mobPrototypes != null && this.mobPrototypes.length > 0) {
				//console.log("\tthis zone has prototypes.");
				for (var i = 0; i < this.mobPrototypes.length; i++) {
					var prototype = this.mobPrototypes[i];
					if (!prototype.hasOwnProperty("mobsInGame") || prototype.mobsInGame.length < prototype.maxMobs) {
						//console.log("\t\tnot all of the ["+i+"]" + prototype.descAction + " have loaded.");
						if (prototype.spawnRooms.length > 0) {
							//console.log("\t\t\tfound spawnrooms, autoloading...");
							prototype.autospawn();
						}
					} else {
						//console.log("\t\tall of the " + prototype.descAction + " have loaded. mobsInGame.length=" + prototype.mobsInGame.length);
					}
				}
			}
			this.nextRefreshTime = Date.now() + this.refreshInterval + (Math.floor(Math.random() * 5000) - 2500);
		}
	},
	init: function() {
		this.contents = [];
		this.mobPrototypes = [];
		this.mobPrototypesIDs = [];
		this.initialized = true;
		this._id = db.ObjectId();
		this.descAction = "This is a Zone";
		this.descLook = "For now, a zone stores each of its associated rooms as an item in it's contents.";
		delete this.portals;
	},
	addRoom: function(room) {
		if (!this.initialized) this.init();
		if (room.type != "room") {
			console.log("ERROR, playermanager, Zone, addRoom, room.type != \"room\"");
			return;
		}
		this.contents.push(room);
	},
	addMobPrototype: function(p) {
		console.log("\t\t\tadding _id=" + p._id);
		console.log("\t\t\t\tpre-add length: " + this.mobPrototypesIDs.length + " / " + this.mobPrototypes.length);
		console.log("\t\t\t\t" + this.mobPrototypesIDs);
		var found = false;
		for (var i = 0; i < this.mobPrototypesIDs.length; i++) {
			console.log("\t\t\t\t\t==         " + (this.mobPrototypesIDs[i] == p._id));
			console.log("\t\t\t\t\t==.toString" + (this.mobPrototypesIDs[i].toString() == p._id.toString()));
			if (this.mobPrototypesIDs[i].toString() == p._id.toString()) found = true;
		}
		if (found == false) {
			if (this.mobPrototypes.indexOf(p) < 0) {
				this.mobPrototypes.push(p);
				console.log("\t\t\t\t\tadding pointer to zone.mobPrototypes");
			} else {
				console.log("\t\t\t\t\tnot adding pointer to zone.mobPrototypes");
			}
			//this.mobPrototypes.push(p);
			this.mobPrototypesIDs.push(p._id);
			console.log("\t\t\t\tZone.addMobPrototype adding");
		} else {
			console.log("\t\t\t\tZone.addMobPrototype NOT adding");
			if (this.mobPrototypes.indexOf(p) < 0) {
				this.mobPrototypes.push(p);
				console.log("\t\t\t\t\tadding pointer to zone.mobPrototypes");
			} else {
				console.log("\t\t\t\t\tnot adding pointer to zone.mobPrototypes");
			}

		}
		console.log("\t\t\t\tthis.mobPrototypesIDs.length=" + this.mobPrototypesIDs.length);

		if (p.zone != this) p.zone = this;
		if (p.zoneID != this._id) p.zoneID = this._id;
	},
	clean: function() {
		return;
		//this clears mobPrototypes after reading
		if (!this.mobPrototypesIDs) this.mobProrotypesIDs = [];
		if (!this.mobPrototypes) this.mobPrototypes = [];
		var originalList = [];
		for (var i = 0; i < this.mobPrototypesIDs.length; i++) {
			var A = this.mobPrototypesIDs[i];
			originalList.push(A);
		}
		for (var i = 0; i < originalList.length; i++) {
			var A = originalList[i];
			for (var j = this.mobPrototypesIDs.length - 1; j >= 0; j--) {
				if (i == j) continue;
				var B = this.mobPrototypesIDs[j];
				if (A.toString() == B.toString()) this.mobPrototypesIDs.splice(j,1);
			}
		}
	}
});


var Room = extend(Entity, {
	type: "room",
	internalVolume: 10000000,		// in centimeters, 10 cubic meters
	mass: 10000000,				// 10 thousand kilograms
	portals: [],
	contents: [],
	zone: null,
	zoneID: 0,
	sendMsgToContents: function(actor, target, first_person, third_person, adverb) {
		for (var i = 0; i < this.contents.length; i++) {
			if (this.contents[i].hasOwnProperty("sendMsg"))
				this.contents[i].sendMsg(actor, target, first_person, third_person, adverb);
		}
	},
	sendToEveryoneExcept: function(exceptions, msg) {
		for (var i = 0; i < this.contents.length; i++) {
			if (this.contents[i].hasOwnProperty("_sendMsg") && exceptions.indexOf(this.contents[i]) < 0) 
				this.contents[i]._sendMsg(msg);
		}
	},
	sendMsgToContentsOLD: function(msg, origin) {
		if (this.contents == null || this.contents.length == 0) return;
		for (var i = 0; i < this.contents.length; i++) {
			if (this.contents[i] == origin) continue;
			if (this.contents[i].type == "character") this.contents[i].sendMsg(msg);
		}
	}
});

function returnCashValue(cash) {
	var amount = 0;
	if (cash.hasOwnProperty("copper"))   amount += cash.copper;
	if (cash.hasOwnProperty("silver"))   amount += cash.silver   * 100;
	if (cash.hasOwnProperty("gold"))     amount += cash.gold     * 100 * 10;
	if (cash.hasOwnProperty("platinum")) amount += cash.platinum * 100 * 10 * 10;
	if (cash.hasOwnProperty("latinum"))  amount += cash.latinum  * 100 * 10 * 10 * 10;
	return Math.floor(amount);
}

function returnCommodityForCopper(copper) {
	var commodity = {
		type: "Cash",
		copper: 0,
		silver: 0,
		gold: 0,
		platinum: 0,
		latinum: 0
	}

	copper = Math.floor(copper);
	
	if (copper == 0) return commodity;


	if (copper >= 100000) { commodity.latinum = Math.floor(copper / 100000); copper = copper - commodity.latinum  * 100000; }
	if (copper >= 10000)  { commodity.platinum = Math.floor(copper / 10000); copper = copper - commodity.platinum * 10000; }
	if (copper >= 1000)   { commodity.gold     = Math.floor(copper / 1000);  copper = copper - commodity.gold     * 1000; }
	if (copper >= 100)    { commodity.silver   = Math.floor(copper / 100);   copper = copper - commodity.silver   * 100; }
	commodity.copper   = Math.floor(copper);
	return commodity;
}

var Cash = {
	type: "Cash",
	copper: 0,
	silver: 0,
	gold: 0,
	platinum: 0,
	latinum: 0
}

var Drive = {
	type: "drive",
	name: "undefined",
	level: 0,
	experience: 0,
	timeLastAchieved: 0
}

function _randomGaussian() {
	return (Math.random()*2-1 +
		Math.random()*2-1 +
		Math.random()*2-1);
}

function gaussian(mean, stdev) {
	return Math.round((_randomGaussian() * stdev + mean) * 100)/100;
}

function sigmoid(x, yscale, constant, xscale) {
	return yscale / (1 + Math.pow(constant * xscale,-x));
}

function getPositions() {
	var positions = [
		{name: "standing", healProbability: 0.005},
		{name: "kneeling", healProbability: 0.007},
		{name: "sitting" , healProbability: 0.009},
		{name: "sleeping", healProbability: 0.011}
	];
	return positions;
}
function getPositionIndex(position) {
	var positions = getPositions();
	for (var i = 0; i < positions.length; i++) {
		if (position == positions[i].name) return i;
	}
	return -1;
}
function getPositionInfo(index, info) {
	var positions = getPositions();
	
	if (index >= 0 && index <= positions.length - 1) {
		if (positions[index].hasOwnProperty(info)) {
			var result = positions[index][info];
			//console.log("getPositionInfo(" + index + "," +info + ")=" + result);
			return result;
		}
		else return null;
	} else return null;
}

var Character = extend(Entity, {
	type: "character",
	internalVolume: 100,			// in centimeters, 1 cubic meter
	mass: 80000,				// 80 kg
	carryMassMaximum: 320000,		// maximum carrying mass
	controller: null,			// pointer to the controlling character or player
	descAction: "an undefined character",
	descLook: "An unremarkable character is here.",
	descRoom: "A unremarkable character stands here.",
	keywords: ["undefined", "character"],
	editmode: 0,
    editableZones: [],
	level: 0,
	
	willpower: 1,			//Will power is your ability to ignore your drives
	maxWillpower: 100,

	baseStrength: 15,
	baseIntelligence: 15,
	baseCharisma: 15,
	baseDexterity: 15,
	baseWisdom: 15,
	baseConstitution: 15, 
	baseWillpower: 15,
	basePerception: 15,

	cash: extend(Cash),

	//Drives
	//Each drive is associated with a resource, that reduces when it is used, but whose maximum increases with level
	//e.g., the drive for battle is associated with hp and higher levels results in greater maxHp

	//The drive for battle is exactly that, for victory, for blood
	//the resouce for this drive is hp
	//hp determines whether you will survive battle
	battle: 		extend(Drive, {name: "battle", fulfilledMsg: "The glory of victory surges through your body."}),
		hp: 1,
		maxHp: 15,
		avgDamage: 1,			//phasing out
		baseDamage: 1,
		rawHitProbability: .1,
		rawDodgeProbability: .1,
		healProbability: .005,		//phasing out
		baseHPRestorationProbability: .005,

	//Submission and dominance are recipricol drives, increasing experience in one results in a decrease in the other
	//The resource for drive is ego
	//ego affects the probability of emitting a successful act of submission or dominance (think of it as arm wrestling)
	//The effect of using these drives is one similar to a positive feedback loop:
	//successful acts of submission decrease your ego, someone who has a submissive nature will see their ego increase with time
	//successful acts of dominance increase it, someone who has a dominant nature will see their ego decrease with time
	//An ego of zero will result in drone-ification, at which point a respawn timer will begin. At the end of the respawn, ego will return to a low but non-zero value
	//An ego at maximum will result in blind-rage, where a respawn timer will begin and the player will automatically attack others 
	submission: 		extend(Drive, {name: "submission", fulfilledMsg: "The rush of your own submission overwhelms you."}),	
	dominance:		extend(Drive, {name: "dominance", fulfilledMsg: "The knowledge of your power over others sends shivers down your spine."}),
		ego: 1,
		maxEgo: 15,
		baseEgoRestorationProbability: .005,	//the direction of restoration depends on which trait is greater (submission or dominance)

	//This would be the drive related to the use of magic, and the resource mana
	//selfDetermination: 	extend(Drive, {name: "self determination", fulfilledMsg: "You get an exciting thrill witnessing your own mastery over your mind and body."}),
	
	//Each drive is associated with a resource, that reduces when it is used, but whose maximum increases with level
	//e.g., the drive for battle is associated with hp and higher levels results in greater maxHp

	suggestionsMadeToMe: [],
	suggestionsMadeByMe: [],

	name: "unnamed",
	playerOwnerNick: "",
	password: "",
	fighting: [],
	playerOwner: null,			// This is how we indicate the longterm attachment between a player and his character
	lastFightTime: -1,
	age: 0,
	positionIndex: 0,

	tic: function() {
		if (this.container == null) return;
		
		if (this.suggestionsMadeToMe.length > 0) {
			for (var i = this.suggestionsMadeToMe.length - 1; i >= 0; i--) {
				var s = this.suggestionsMadeToMe[i];
				if (Date.now() >= s.expirationTime) {
					this.suggestionsMadeToMe.splice(i,1);
					this._sendMsg("You feel the urge to '" + s.instruction + "' fade away.");
				} else {
					//if (Math.random() > .95) console.log("timeremaining: " + (s.expirationTime - Date.now()));
				}
			}
		}

		if (Math.random() > 0.001) this.age++;

		///Blind rage and drone Tics
		if (this.hasOwnProperty("blindRage")) {
			if (Math.random() <= this.blindRageCounterProbability) {
				this.blindRageCounter = this.blindRageCounter - 1;
				this.attackRandomCharacter();
				this._sendMsg("blindRageCounter=" + this.blindRageCounter);
				if (this.blindRageCounter <= 0) {
					delete this.blindRage;
					delete this.blindRageCounter;
					delete this.blindRageCounterProbability;
					this.ego = 0;
					this._sendMsg("You feel yourself slowly recovering from your blind rage.");
					this.container.sendToEveryoneExcept([this],"The rage visibly dissolves out of " + this.descAction + "'s eyes.");
				}
			}
		} else if (this.hasOwnProperty("drone")) {
			if (Math.random() <= this.droneCounterProbability) {
				this.droneCounter = this.droneCounter - 1;
				this._sendMsg("droneCounter=" + this.droneCounter);
				if (this.droneCounter <= 0) {
					delete this.drone;
					delete this.droneCounter;
					delete this.droneCounterProbability;
					this.ego = this.maxEgo;
					this._sendMsg("You feel your willpower slip back into your body.");
					this.container.sendToEveryoneExcept([this],this.getUpperCaseAction() + "'s eyes gradually regain focus and a sense of restored willpower.");
				}
			}
		}

		//Battle tics
		if (this.getFirstOpponent() != null && 
			    (Date.now() >= this.lastFightTime + Game.fightIRT ||
			    this.lastFightTime == -1)
			    
		   ) {
			//console.log(this.descAction + " fight tic.");
			console.log(this._id + " is fighting! descAction: " + this.descAction);

			var opponent = this.getFirstOpponent();
			if (opponent.hasOwnProperty("container") && this.hasOwnProperty("container")) {
				if (!opponent.container || opponent.container == null || !opponent.container.hasOwnProperty("_id")) {
					console.log("trying to fighTic but the opponent does not have a container!");
					opponent.container = this.container;
				} else if (this.container == null) {
					console.log("this.container = null! stopping fight!");
					if (opponent.container == null) console.log(" opp.container = null too!");
					console.log("this.type = " + this.type);
					console.log(" opp.type = " + opponent.type);
					console.log("this.fighting.length = " + this.fighting.length);
					for (var i = 0; i < this.fighting.length; i ++) {
						console.log("\tfighting[" + i + "] " + this.fighting[i]._id + " " + this.fighting[i].descAction);
					}
					if (this.descAction != null && this.hasOwnProperty("descAction")) {
						console.log("\tthis.descAction = " + this.descAction);
					} else {
						console.log("\tthis.descAction is also not defined.");
					}
					var found = false;
					for (var i = 0; i < Game.entities.length; i++) {
						var e = Game.entities[i];
						if (e.hasOwnProperty("contents")) {
							if (e.contents.indexOf(this) >= 0) {
								console.log("\tBS! I found the container. Wtf!?");
								console.log("\t_id=" + e._id);
								found = true;
							}
						}
					}
					if (found == false) console.log("\tit's true, what the FUCK?1");
					this.removeOpponent(opponent);
					opponent.removeOpponent(opponent);

				} else if (opponent.container != this.container) {
					console.log("fighters are in separate containers, stopping fight.");
					console.log("\tthis.container._id: " + this.container._id);
					console.log("\t opp.container._id: " + opponent.container._id);
					this.removeOpponent(opponent);
					opponent.removeOpponent(opponent);
				} else {
					console.log("fight!");
					this.tryToHit(opponent);
					this.lastFightTime = Date.now();
					this._sendMsg("\nyou: " + this.getHealthText() + ", opp: " + opponent.getHealthText() + ">");
					
				}
			} else {
				console.log("ERROR, Character.tic, two fighting players have suddenly found themselves without a container. Ending fight.");
				this.removeOpponent(opponent);
				opponent.removeOpponent(this);
			}
		} else {
			//This is defined in the Mob class, it handles non-combat mob behavior
			if (this.hasOwnProperty("_mobTic")) {
				this._mobTic();
				//console.log(this.descAction + " _mobTic.");
			} else {
				//console.log(this.descAction + " no mob tic");
			}
			
			//HP
			if (this.hp < this.maxHp) {
				if (this.level >= Game.levelImmortal) {
					this.hp = this.maxHp;
				}
				if (Math.random() < this.getHealProbability()) {
					this.hp = Math.min( this.maxHp , this.hp + Math.max(1, Math.floor(this.maxHp * 0.1)));
					this._sendMsg("hp: " + this.getHealthText());
				}
			}

			//Ego
			if (Math.random() < this.baseEgoRestorationProbability) {
				if (this.maxEgo == 0) this.maxEgo = 1;
				if (this.isSwitch()) {
					//Switches egos trend toward unity (maxEgo/2) over time
					if (this.ego > (this.maxEgo / 2)) {
						//Ego is going down to half
						if (Math.abs(this.ego - (this.maxEgo / 2)) < 1) this.ego = this.maxEgo / 2;
						else this.ego = Math.max(this.maxEgo / 2, this.ego - this.maxEgo * .1);
						this._sendMsg("ego: " + this.ego + "/" + this.maxEgo + " = " + Math.floor((this.ego * 100/ this.maxEgo)) + "%");
					} else if (this.ego < (this.maxEgo / 2)) {
						//Ego  is going up
						if (Math.abs(this.ego - (this.maxEgo / 2)) < 1) this.ego = this.maxEgo / 2;
						else this.ego = Math.min(this.maxEgo / 2, this.ego + this.maxEgo * .1);
						this._sendMsg("ego: " + this.ego + "/" + this.maxEgo + " = " + Math.floor((this.ego * 100/ this.maxEgo)) + "%");
					}
				} else if (this.isDominant()) {
					if (this.ego > this.maxEgo) {
						this.ego = this.maxEgo;
						this.initiateBlindRage();
					} else if (this.ego > 0) {
						this.ego = Math.max(0, this.ego - this.maxEgo * .1);
						this._sendMsg("ego: " + this.ego + "/" + this.maxEgo + " = " + Math.floor((this.ego * 100/ this.maxEgo)) + "%");
					} else if (this.ego < 0) {
						this.ego = 0;
						this._sendMsg("You feel strangely uncomfortable.");
					}
				} else if (this.isSubmissive()) {
					if (this.ego > this.maxEgo) {
						this.ego = this.maxEgo;
						this._sendMsg("You feel strangely uncomfortable.");
					} else if (this.ego > 0) {
						this.ego = Math.min(this.maxEgo, this.ego + this.maxEgo * .1);
						this._sendMsg("ego: " + this.ego + "/" + this.maxEgo + " = " + Math.floor((this.ego * 100/ this.maxEgo)) + "%");
					} else if (this.ego < 0) {
						this.ego = 0;
						this.initiateDrone();
					}
				}
				if (this.ego == null) this.ego = this.maxEgo / 2;
				if (this.ego.hasOwnProperty("toFixed")) this.ego = this.ego.toFixed(2);
			}

			
		}
	},
	
	quit: function() {
		if (this.playerOwner != null) this.playerOwner = null;
		this.controller.dccClient.stream.end();
		irc.sendToMainChannel(this.name + " has left the game.");
		this.moveToContainer(null);	
	},

	canEditZone: function(zoneId) {
        	if (this.level >= Game.levelCoordinator) return true;
	        if (this.editableZones.indexOf(zoneIf) < 0) return false;
        	return true;
	},
	returnCashValueInCoppers: function() {
		return returnCashValue(this.cash);
	},
	convertCoppersToCommodities: function(copperamount) {
		return returnCommodityForCopper(copperamount);
	},
    getWeapon: function() {
        //console.log("getWeapon, " + (this.hasOwnProperty("contents") ? "has .contents" : "does not have .contents"));
        for (var i = 0; i < this.contents.length; i++) {
            var item = this.contents[i];
            if (item.type == "object" && item.wornPosition == "wielded") {
                //console.log("\tfound a wielded object, " + item.descAction);
                return item;
            } 
        }
        return null;
    },
	initiateBlindRage: function() {
		if (this.isImmortal()) return;
		if (this.hasOwnProperty("numTimesBlindRage")) this.numTimesBlindRage++;
		else this.numTimesBlindRage = 1; 

		this.blindRage = true;
		this.blindRageCounter = this.level * this.numTimesBlindRage;
		this.blindRageCounterProbability = .005;
		this._sendMsg("You suddenly feel an uncontrollable surge of anger and power!");

		if (this.hasOwnProperty("drone")) {
			delete this.drone;
			delete this.droneCounter;
			delete this.droneCounterProbability;
		}
		this.container.sendToEveryoneExcept([this], this.getUpperCaseAction() + "'s become narrow and filled with rage!");
	},
	initiateDrone: function() {
		if (this.isImmortal()) return;
		if (this.hasOwnProperty("numTimesDronified")) this.numTimesDronified++;
		else this.numTimesDronified = 1;

		console.log("initiateDrone: " + this.descAction + " ego: " + this.ego);
		this.drone = true;
		this.droneCounter = this.level * this.numTimesDronified;
		this.droneCounterProbability = .005;
		this._sendMsg("You feel your sense of willpower and self-determination slip away completely.");
		if (this.hasOwnProperty("blindRage")) {
			delete this.blindRage;
			delete this.blindRageCounter;
			delete this.blindRageCounterProbability;
		}

		this.container.sendToEveryoneExcept([this], this.getUpperCaseAction() + "'s eyes become vacant and empty, open to suggestion.");
	},
	attackRandomCharacter: function() {
		this._sendMsg("You need to hit someone RIGHT NOW!");
		var room = this.container;
		var target = null;

		if (room != null && room.contents.length > 1) {
			for (var i = 0; i < room.contents.length; i++) {
				target = room.contents[i];
				if (target != this) {
					if (target.hasOwnProperty("type") && (target.type == "character" || target.type == "mob")) {
						break;	
					} else target = null;
				} else target = null;
			}
		}
		if (target == null) return;
		else this.tryToHit(target);
		//randomly attack somoene in the room
	},
	isDominant: function() {
		if (this.dominance.level >= this.submission.level) return true;
	},
	isSubmissive: function() {
		if (this.submission.level >= this.dominance.level) return true;
	},
	isSwitch: function() {
		if (this.dominance.level == this.submission.level) return true;
	},
	compareEgos: function(defender) {
		var attacker = this;

		var defenderAvg = defender.dominance.level + attacker.submission.level + 2;
		var attackerAvg = attacker.dominance.level + defender.submission.level + 2;

		var difference = gaussian(defenderAvg, 3) - gaussian(attackerAvg, 3);
		var outcome = {};

		console.log("comparing egos");
		console.log("\tattackerAvg=" + attackerAvg);
		console.log("\tdefenderAvg=" + defenderAvg);
		console.log("\t roll difference (defender - attacker) = " + difference + " (negative means attacker won)");
		if (difference > 0) {
			outcome = {
				winner: defender,
				diff: difference
			};
		} else if (difference < 0) {
			outcome = {
				winner: attacker,
				diff: difference
			};
		} else if (difference == 0) {
			outcome = {
				winner: null,
				diff: 0
			};
		}
		return outcome;
	},
	changeEgo: function(amount) {
		var oldEgo = this.ego;
		var newEgo = oldEgo + amount;
		this.ego = Math.round(newEgo*100)/100;
		this._sendMsg("ego: " + Math.round(this.ego) + " change: " + amount);
		if (newEgo > oldEgo) {
			if (newEgo > this.maxEgo) this.initiateBlindRage();
		} else if (newEgo < oldEgo) {
			if (newEgo < 0) this.initiateDrone();
		}
	},
	sendSuggestion: function(target, command) {
		if (target.type != "character" && target.type != "mob") return false;

		var suggestion = {
			type: "suggestion",
			suggester: this,
			suggesterName: this.name,
			instruction: command,
			time: Date.now(),
			expirationTime: (Date.now() + (10000 + this.level * 1000)),
			numInterveningCommands: 0,
			maxInterveningCommands: 0,
			egoChange: Math.max(1,gaussian(2,1))
		};	
		console.log("creating suggestion with " + suggestion.egoChange + " points.");	
		if (target == null) return false;
		if (!target.hasOwnProperty("receiveSuggestion")) return false;
		
		//this.changeEgo(suggestion.egoChange); <-- happens in followSuggestion now
		target.receiveSuggestion(this, suggestion);

		return true;
	},
	receiveSuggestion: function(sender, suggestion) {
		var numSuggestions = this.suggestionsMadeToMe.length;
		suggestion.maxInterveningCommands += numSuggestions;
		
		this.suggestionsMadeToMe.push(suggestion);
		this._sendMsg(suggestion.suggester.getUpperCaseAction() + " suggests you, '" + suggestion.instruction + "'");
		//this.changeEgo(-suggestion.egoChange); <-- happens in followSuggestion now
	},
	calcSuggestionExpForDom: function(att, def) {
		var totalExpThisLevel = att.expTotalThisLevel(att.dominance);
		var defaultProportionOfTotalExp = .1;	// this says 10 good instances of getting someone to submit should be enough to level
		var levelDiff = (att.dominance.level + def.submission.level) - (att.submission.level + def.dominance.level);
		var sig = 	sigmoid( levelDiff, 	// x
					 2,		// yscale
					 2.3,		// constant
					 0.34);		// xscale

		console.log("calcSuggestionExpforDom, attacker(" + att.descAction + ") def(" + def.descAction + ")");
		console.log("\tlevelDiff (att-def)     : " + levelDiff);
		console.log("\tatt.dom.level           : " + att.dominance.level);
		console.log("\tatt.expTotalThisLevel   : " + totalExpThisLevel);
		console.log("\tsig (proportion of ^)   : " + sig);
		console.log("\texp Gained              : " + (totalExpThisLevel*sig* defaultProportionOfTotalExp));

		return totalExpThisLevel * defaultProportionOfTotalExp * sig;
	},
	calcSuggestionExpForSub: function(att, def) {
		var totalExpThisLevel = att.expTotalThisLevel(def.submission);
		var defaultProportionOfTotalExp = .1;	// this says 10 good instances of getting someone to submit should be enough to level
		var levelDiff = (att.dominance.level + def.submission.level) - (att.submission.level + def.dominance.level);
		var sig = 	sigmoid( levelDiff, 	// x
					 1,		// yscale
					 2.3,		// constant
					 0.7);		// xscale

		console.log("calcSuggestionExpforSub, attacker(" + att.descAction + ") def(" + def.descAction + ")");
		console.log("\tlevelDiff (att-def)     : " + levelDiff);
		console.log("\tdef.sub.level           : " + def.submission.level);
		console.log("\tdef.expTotalThisLevel   : " + totalExpThisLevel);
		console.log("\tsig (proportion of ^)   : " + sig);
		console.log("\texp Gained              : " + (totalExpThisLevel*sig* defaultProportionOfTotalExp));

		return totalExpThisLevel * defaultProportionOfTotalExp * sig;
	},
	calcBattleExpForWinner: function(winner, loser) {
		var totalExpThisLevel = winner.expTotalThisLevel(winner.battle);
		var levelDiff = winner.battle.level - loser.battle.level;
		var levelDiffConstant = 0.65;
		var sig = 	sigmoid( levelDiff + levelDiffConstant, 	// x
					 0.18,					// yscale
					 1.5,					// constant
					 0.34);					// xscale
		console.log("calcBattleExpforWinner, winner(" + winner.descAction + ") loser(" + loser.descAction + ")");
		console.log("\tlevelDiff (winner-loser): " + levelDiff);
		console.log("\twinner.battle.level     : " + winner.battle.level);
		console.log("\twinner.expTotalThisLevel: " + totalExpThisLevel);
		console.log("\tsig (proportion of ^)   : " + sig);
		console.log("\texp Gained              : " + (totalExpThisLevel*sig));
		// rather than multiplying by a constant to scale down to 1/10 of a user's needed exp,
		// that scale has been applied to the y-scale constant in the sigmoid function
		return totalExpThisLevel * sig;

	},

	followSuggestion: function(suggestion) {
		console.log("followSuggestion " + ( suggestion ? "not null" : "null"));
		var suggester = suggestion.suggester;
		if (this.suggestionsMadeToMe.indexOf(suggestion) >= 0) {
			console.log("\tsuggestion found in player's suggestionsMadeToMe");

			this.suggestionsMadeToMe.splice(this.suggestionsMadeToMe.indexOf(suggestion), 1);
			console.log("\tremoved suggestion from player's queue");

			if (suggestion.hasOwnProperty("suggester") && suggestion.suggester != null) {
				suggestion.suggester._sendMsg("Tingles of electricity run up and down your spine as " + this.name + " follows your suggestion.");
				if (suggestion.suggester.hasOwnProperty("gainExp")) 
					suggestion.suggester.gainExp(
						suggestion.suggester.dominance, 
						this.calcSuggestionExpForDom(suggester,this)
					);
			} 
		
			
			if (this.hasOwnProperty("gainExp")) {
				this._sendMsg("You feel tingles of submission running over and over your body as you submit to " + suggestion.suggester.name + ".");
				if (this.hasOwnProperty("gainExp")) 
					this.gainExp(
						this.submission, 
						this.calcSuggestionExpForSub(suggester, this)
					);
			}

			if (suggestion.hasOwnProperty("suggester") && suggestion.suggester != null) suggestion.suggester.changeEgo(suggestion.egoChange);
			else {
				console.log("\tfailed to change the ego of the suggester because suggestion.suggester is not defined");
			}
			this.changeEgo(-suggestion.egoChange);

		} else {
			console.log(this.descAction + " seems to have followed a suggestion that wasn't in its suggestionsMadeToMe array.");
		}
	},
	rollNewCharacter: function() {
		this.baseStrength = gaussian(15,4);
		this.baseIntelligence = gaussian(15,4);
		this.baseCharisma = gaussian(15,4);
		this.baseDexterity = gaussian(15,4);
		this.baseWisdom = gaussian(15,4);
		this.baseConstitution = gaussian(15,4);
		this.baseWillpower = gaussian(15,4);
		this.basePerception = gaussian(15,4);

		this.maxHp = this.baseConstitution + gaussian(3,1);
		this.hp = this.maxHp;
		this.baseDamage = this.baseStrength/5;
		this.rawHitProbability = gaussian(this.basePerception + this.baseDexterity + this.baseCharisma,3)/300; //ave = .15,
		this.rawDodgeProbability = gaussian(this.basePerception + this.baseDexterity + this.baseCharisma,3)/200;

		this.maxEgo = gaussian(this.baseCharisma + this.baseIntelligence, 3) / 2; // age = 15
		this.ego = this.maxEgo;

	},
	setPosition: function(position) {
		//console.log("setPosition to " + position);
		//console.log("\tinitial positionIndex=" + this.positionIndex);
		var positions = getPositions();
		if (getPositionIndex(position) == -1) {
			//console.log("\tcould not find " + position + " in positions array=" + positions);
			this.positionIndex = 0;
		} else this.positionIndex = getPositionIndex(position);
		//console.log("\tfinal positionIndex  =" + this.positionIndex);
		return positions[this.positionIndex].name;
	},
	getPosition: function() {
		var result = null;
		result = getPositionInfo(this.positionIndex, "name");
		//console.log("getPosition");
		//console.log("\treceived " + result + " from getPositionInfo");
		if (result == null) {
			this.positionIndex = 0;
			result = getPositionInfo(this.positionIndex, "name");
		}
		return result; 
	},
	getHealProbability: function() {
		var result = .005;
		result = getPositionInfo(this.positionIndex, "healProbability");
		if (result == null) {
			this.positionIndex = 0;
			result = getPositionInfo(this.positionIndex, "name");
		}
		return result;
	},
	getHP: function() { return Math.round(this.hp*100)/100; },
	getMaxHP: function() { return Math.round(this.maxHp*100)/100; },
	getStrength: function() { return this.baseStrength; },
	getIntelligence: function() { return this.baseIntelligence; },
	getCharisma: function() { return this.baseCharisma; },
	getDexterity: function() { return this.baseDexterity; },
	getWisdom: function() { return this.baseWisdom; },
	getConstitution: function() { return this.baseConstitution; },
	getWillpower: function() { return this.baseWillpower; },
	getPerception: function() { return this.basePerception; },
	getDamage: function() { return this.baseDamage; },
	getHitProbability: function() { return this.rawHitProbability; },
	getDodgeProbability: function() { return this.rawDodgeProbability; },
	getHealthText: function() {
		var text = ["dying","near death","critical","bloody","badly injured","injured","badly bruised","bruised","scratched","healthy","very healthy","excellent"];
		var index = Math.floor(this.hp * (text.length-1) / this.maxHp);
		//if (index >= text.length) index = text.length - 1;
		return text[index];
	},
	gainExp: function(drive, amount) {
		amount = Math.round(amount * 100) / 100;
		drive.experience += amount;
		drive.experience = drive.experience;
		var amountPercent = 0;
		if (drive.level == 0) amountPercent = amount / this.expToNextLevel(drive);
		else {
			//var tmpDrive = {level: (drive.level - 1)};
			amountPercent = amount * 100 / this.expTotalThisLevel(drive);
			amountPercent = Math.round(amountPercent * 100) / 100;
		}
		this._sendMsg("You receive "+amount+" xp ("+amountPercent+"% of what you need) in " + drive.name + "!");
		if (this.expToNextLevel(drive) < 0) this.levelUpDrive(drive);
	},
	levelUpDrive: function(drive) {
		drive.level++;
        	
		if (this.type == "character") {
            		this._sendMsg("Congratulations!! You have leveled up! You drive for " + drive.name + " is now level " + drive.level + "!");
            		irc.sendToMainChannel("Congratulations " + this.name + ", you have leveled!");
        	}
        
		var maxlevel = -1;
		for (key in this) {
			var p = this[key];
			if (util.isArray(p)) continue;
			if (p == null) continue;
			if (p.hasOwnProperty("type") && p.type == "drive") {
				if (p.hasOwnProperty("level") && p.level > maxlevel) maxlevel = p.level;
			}
		}
		if (maxlevel > this.level) this.level = maxlevel;
		
		if (drive == this.battle) {
			this.maxHp += gaussian(this.getConstitution(), 3) / 3; //avg = 5
			this.baseDamage += gaussian(this.getStrength(), 3) / 7; //age = 2.1

			//Increase by ~2% of the remaing. Will equal on aveage p=.68 @ level 50
			this.rawHitProbability += (1 - this.getHitProbability()) * gaussian(this.getDexterity()+this.getPerception(), 3) / 750;
			this.rawDodgeProbability += (1 - this.getHitProbability()) * gaussian(this.getDexterity()+this.getPerception(), 3) / 750;
		} else if (drive == this.dominance) {
			this.maxEgo += gaussian(this.getCharisma() + this.getIntelligence() + this.getWillpower(), 3) / 3 / 3; // ~5
		} else if (drive == this.submission) {
			this.maxEgo += gaussian((30 - this.getWillpower()) + this.getPerception() + this.getIntelligence(), 3) / 3 / 3; //~5
		}
	},
    	
	bringStatsUpToLevel: function(drive) {
        	//players get this automatically, but mobs need this when they're spawned
        
	        var oldLevel = drive.level;
        	drive.level = 0;
	        for (var i = 0; i <= oldLevel; i++) {
            		this.levelUpDrive(drive);
        	}
        	drive.level = oldLevel;
    	},
	/*
	expToNextLevel: function(drive) {
		var needed = (10 * drive.level^2 ) / 1.6 - drive.experience;
		needed = Math.round(needed * 100) / 100;
		return needed;
	},*/
	expToNextLevel: function(drive) {
		var needed = (10 * (drive.level+1) * (drive.level+1) ) / 1.6 - drive.experience + 3.75;
		needed = Math.round(needed);
		return needed;
	},

	expTotalThisLevel: function(drive) {
		return this.expToNextLevel({level: drive.level, experience: 0}) - this.expToNextLevel({level: drive.level-1, experience: 0});
	},
	/*
	expToNextLevelC: function(drive) {
		var needed = (10 * drive.level * drive.level ) - drive.experience;
		needed = Math.round(needed * 100) / 100;
		return needed;
	},*/

	fulfillDrive: function(drive, modifier) {

		if (drive.hasOwnProperty("fulfilledMsg")) {
			this._sendMsg(drive.fulfilledMsg);
		} else {
			entity._sendMsg("You feel tingles down you spine after fulfilling your drive for " + drive.name + ".");
		}

		//this equation describes the relationship between experience earned
		//and the last time the drive was fulfilled
		//	b = .000008 (determines how quickly the curve rises, 50% in 2 min, 80% in 7 min, 90% in 16 min
		//	t = time sinze last fulfillment (ms)
		// 	
		// 	y = atan(t * b) * level ^ 2 / 1.6

		var t = Date.now() - drive.timeLastAchieved;
		var b = 0.000008;
		var xp = Math.atan(t * b) * drive.level ^ 2 / 1.6;
		xp *= modifier;

		this.gainExp(drive, xp);
		drive.timeLastAchieved = Date.now();
	},
	depriveDrive: function(drive) {
	},

	tryToWear: function(o,wearPositions) {
		if (this.contents.indexOf(o) == -1) {
			console.log("tryToWear: object not in character's contents.");
			return "none";
		}
		if (!util.isArray(wearPositions)) {
			console.log("tryToWear: did not receive a wearPositions array.");
			return "none";
		}
		if (wearPositions[0] == "none") return "none";
		
		var workingPositions = [];
	
		for (var j = 0; j < wearPositions.length; j++) {
			var testingPosition = wearPositions[j];
			var occupied = false;
			for (var i = 0; i < this.contents.length; i++) {
				var entity = this.contents[i];
				if (entity.type == "object" && entity.hasOwnProperty("wornPosition") && entity.wornPosition == testingPosition) occupied = true;
			}
			if (occupied == false) {
				workingPositions.push(testingPosition);
				break;
			}
		}
		if (workingPositions.length == 0) return "none";
		o.wornPosition = workingPositions[0];

		return o.wornPosition;
	},
	getTraversablePortals: function() {
		if (this.container == null) return;
		var portals = [];
		for (var i = 0; i < this.container.portals.length; i++) {
			var p = this.container.portals[i];
			if (this.level >= Game.levelBuilder) portals.push(p);
			if (p.traversableFromEntity(this.container)) portals.push(p);
		}
		return portals;
	},
	getVisiblePortals: function() {
		if (this.container == null) return;
		var portals = [];
		for (var i = 0; i < this.container.portals.length; i++) {
			var p = this.container.portals[i];
			if (this.level >= Game.levelBuilder) portals.push(p);
			else if (!p.traversableFromEntity(this.container)) continue;
			else if (p.visibleFromEntity(this.container)) portals.push(p);
		}
		return portals;

	},
	getPortalWithinReach: function(keyword) {
		var portals = [];
		if (!this.hasOwnProperty("container") || this.container == null) return null;

		if (this.level <= Game.levelImmortal) portals = this.getTraversablePortals();
		else portals = this.container.portals;

		for (var i = 0; i < portals.length; i++) {
			if (portals[i].getPortalKeywordFromEntity(this.container).toLowerCase() == keyword.toLowerCase())
				return portals[i];
		}
		return null;
	},
	getFirstOpponent: function() {
		if (this.fighting.length >= 1) return this.fighting[0];
		else return null;
	},
	addOpponent: function(opponent) {
		if (opponent == null) return;
		if (opponent == this) return;
		if (this.isFighting(opponent)) return;
		if (opponent.type == "character" || opponent.type == "mob") {
			console.log("addOpponent");
			console.log("\tadding a new opponent for " + this.descAction + ": " + opponent.descAction + "\t fighting.length=" + this.fighting.length);
			this.fighting.push(opponent);
			console.log("\tnew fighting.length=" + this.fighting.length);
		}
		return;
	},
	removeOpponent: function(opponent) {
		if (opponent == null) return;
		if (this.isFighting(opponent)) this.fighting.splice(this.fighting.indexOf(opponent),1);
	},
	isFighting: function(opponent) {
		if (this.fighting.indexOf(opponent) >= 0) return true;
		return false;
	},
	hitProbability: function(opponent) {
		if (this.level >= Game.levelImmortal && opponent.level <= this.level) return 1.0
		else return this.rawHitProbability;
	},
	dodgeProbability: function(opponent) {
		if (this.level >= Game.levelImmortal && opponent.level <= this.level) return 1.0
		else return this.rawDodgeProbability;
	},
	tryToHit: function(opponent) {
		if (opponent == null || (opponent.type != "mob" && opponent.type != "character")) {
			return false;
		}
		if (this.getFirstOpponent() == null) {
			console.log("starting fight!");
			this.addOpponent(opponent);
			opponent.addOpponent(this);

			this.lastFightTime = Date.now();
			if (!opponent.hasOwnProperty("lastFightTime") || opponent.lastFightTime < 0) opponent.lastFightTime = Date.now();
			
			if (!this.hasOwnProperty("tic")) console.log("\tshit, fighter doesn't have tic()");
			if (!opponent.hasOwnProperty("tic")) console.log("\tshit, opponent does't have tic()");
		}
		
		if (!this.hasOwnProperty("container")) {
			console.log("this character does not appear to have a container!");
		} else {
			console.log("this character does have a container!");
			if (this.container == null) {
				console.log("\tbut it's null!!!");
			} else {
				console.log("\thas id            = " + this.container._id);
				console.log("\topp.container._id = " + opponent.container._id);
			}
			console.log("attacker = " + this.descAction);
			console.log("attacker._id = " + this._id);
			console.log("attacker.fighting=" );
			for (var i = 0; i < this.fighting.length; i ++) {
				console.log("\tfighting[" + i + "] " + this.fighting[i]._id + " " + this.fighting[i].descAction);
			}

		}

		var hitRoll = Math.random();
		var dodgeRoll = Math.random();

		if (hitRoll < this.hitProbability(opponent)) {
			if (dodgeRoll < opponent.dodgeProbability(this)) {

				this.container.sendMsgToContents(this, opponent, "swing toward", "swings toward", "who easily ducks.");
				return false;
			} else {
				var dmg = this.calcHitDamage(opponent);
				if (dmg > 0) {
					this.container.sendMsgToContents(this, opponent, "hit", "hits", this.getDamageText(dmg, opponent.getMaxHP()) + " ("+dmg+")");
					opponent.deliverMeleeDamageFrom(this, dmg);
				} else {
					this.container.sendMsgToContents(this, opponent, "place a well-aimed blow directly into", "places a well-aimed blow directly into", "who only chuckles in response");
				}
				return true;
			}
		} else {
			this.container.sendMsgToContents(this, opponent, "feebly attempt to swing at", "feebly attempts to swing at", "but misses wildly");
			return false;
		}
	},
	
	getDamageText: function(dmg, max) {
		var text =     ["but only barely", 
				"making a very light scratch", // -10
				"making a light scratch",
				"making a scratch",
				"fairly",
				"hard",			// -6
				"very hard",
				"extremely hard",
				"incredibly hard",	// -3
				"IMPOSSIBLY hard",
				"EXCRUCIATINGLY hard"]; // -1
		var ratio = Math.max(0, Math.min(dmg / (max/10), 5));

		var index = 0;
		if (ratio >= 4) index = text.length - 1;
		else if (ratio >= 3) index = text.length - 2;
		else if (ratio >= 2.5) index = text.length - 3;
		else if (ratio >= 2) index = text.length - 4;
		else if (ratio >= 1.5) index = text.length - 5;
		else if (ratio >= .9) index = text.length - 6;
		else if (ratio >= .8) index = text.length - 7;
		else if (ratio >= .6) index = text.length - 8;
		else if (ratio >= .5) index = text.length - 9;
		else if (ratio >= .3) index = text.length - 10;
		else index = 0;

		return text[index];
	},

	calcHitDamage: function(opponent) {
        //console.log("calcHitDamage");
		//called by tryToHit only!
        var weapon = this.getWeapon();
		var damage = 0;
        if (weapon == null || !weapon.hasOwnProperty("getDamage")) {
            damage = gaussian(this.getDamage(),2.5);//Math.max(a,Math.floor(this.getStrength() / 5 + this.level / 5));
            //console.log("using hand-to-hand damage " + (weapon ? "weaponfound" : "weaponnotfound"));
            if (weapon!= null) console.log("\t" + (weapon.hasOwnProperty("getDamage") ? "weaponhasGetDamage" : "weaponDoesNotHaveGetDamage"));
        } else {
            damage = weapon.getDamage(this);
            //console.log("using weapon damage: " + damage);
        }
        
		return damage;
	},
	isImmortal: function() {
		if (this.level >= Game.levelImmortal) return true;
		else return false;
	},
	isBuilder: function() {
		if (this.level >= Game.levelBuilder) return true;
		else return false;
	},
	/* Deprecated
	 * setStatsForLevel: function() {
		this.hp = 15 * Game.balance_HPMultPerLevel ^ (this.level - 1);
		this.avgDamage = 4 * Game.balance_DMGMultPerLevel ^ (this.level -1) - (Game.balance_DMGMultPerLevel - 0.005) ^ (this.level -1);
		this.hitProbability = Game.balance_BaseHitProbability + ((1 - Game.balance_BaseHitProbability) * this.level / Game.levelMax);
	},
	*/
	setController: function(ent) {
		this.controller = ent;
		if (this.ent == null) {
			console.log("ERROR, playermanager, Character.setController, attempted to set controller to null.");
			
		} else {
			console.log("SUCCESS, playermanager, Character.setController, set controller successfully.");
		}
		if (this.controller == null) {
			console.log("ERROR, playermanager, Character.setController, controller is null.");
			return;
		} else {
			console.log("SUCCESS, playermanager, Character.setController, set controller successfully.");
		}

	},
	getDescActionForObserver: function(observer) {
		if (this == observer) return "you";

		return this.descAction;
	},
	getDescActionForObserverPossessive: function (observer) {
		if (this == observer) return "yourself";

		return this.descAction;
	},
	sendMsgToRoom: function(toentity, msg) {
	},
	sendMsg: function(actor, target, first_person, third_person, adverb) {
		if (adverb == null) adverb = "";
		if (actor == this && target == null && first_person != null) {
			this._sendMsg("You " + first_person + adverb + ".");
		} else if (target == this && actor == null && first_person != null) {
			this._sendMsg(third_person + " you " + adverb + ".");
		} else if (actor == null && actor == null) {
			this._sendMsg(third_person + " " + adverb + ".");
		} else {
			if (this == actor && first_person == null) {  }
			else if (this == actor && this != target) 
				this._sendMsg(("You " + first_person + " " + target.descAction + " " + adverb).trim() + ".");
			else if (this == target && this != actor) 
				this._sendMsg((actor.getUpperCaseAction() + " " + third_person + " you " + adverb).trim() + ".");
			else if (this != target && this != actor && target != null) 
				this._sendMsg((actor.getUpperCaseAction() + " " + third_person + " " + target.descAction + " " + adverb).trim() + ".");
			else if (this != target && this != actor && target == null) 
				this._sendMsg((actor.getUpperCaseAction() + " " + third_person + " " + adverb).trim() + ".");
			else if (target == null) {
				console.log("Error, sendMsg, target = null");
				var x = 100 / 0;
			} else this._sendMsg("You " + first_person + " yourself " + adverb + ".");
		}
	},
	_sendMsg: function(msg) {

		if (this.controller == null) {
			//console.log("ERROR, playermanager, Character.sendMsg, attempted to send msg to uncontrolled character.");
			return;
		}
		//iterate through the controllers until we find a player
		var maxDepth = 10;
		
		var currentReceiver = this;
		for (i = 0 ; i < maxDepth ; i++) {
			if (currentReceiver.type == "character") {
				if (currentReceiver.controller == null) {
					console.log("Character.sendMsg, could not find a player controller, stopping at depth=" + i);
					return;
				} else {
					currentReceiver = currentReceiver.controller;
				}
			} else if (currentReceiver.type == "player") {
				currentReceiver._sendMsg(msg);
				return
			}
		}
		console.log("ERROR, playermanager, Character.sendMsg, exceeded max depth @ " + maxDepth);
  	},
	spawn: function() {
		console.log("spawn:");
		if (Game.newPlayerSpawnPoint == null) {
			console.log("ERROR, playermanager, Character.spawn, Game.newPlayerSpawnPoint is null! Maybe the world hasn't been created?");
			return;
		}
		if (Game.newPlayerSpawnPoint == null) {
			console.log("\tGame.newPlayerSpawnPoint == null     :(");
			console.log("\tGame.newPlayerSpawnPointID ==   [" + Game.newPlayerSpawnPointID + "]");
		} else {
			console.log("\tGame.newPlayerSpawnPoint is not null :) " );
			console.log("\tGame.newPlayerSpawnPoint.hasOwnProperty(_id)=" + Game.newPlayerSpawnPoint.hasOwnProperty("_id"));
			console.log("\tGame.newPlayerSpawnPoint._id == [" + Game.newPlayerSpawnPoint._id + "]");
		}
		this.container = Game.newPlayerSpawnPoint;
		
		Game.newPlayerSpawnPoint.contents.push(this);
		if (Game.entities.indexOf(this) == -1) Game.entities.push(this);

		//this._sendMsg("You have spawned!");
		commands.cmd_look(this, ["look"]);
		Game.newPlayerSpawnPoint.sendMsgToContents(this, null, "have entered the Eye of Asiktri", "has entered the Eye of Asiktri", "");
		
		console.log("Character has spawned!");
		console.log("Game Entities: " );
		for (var i = 0; i < Game.entities.length ; i++) {
			console.log(i + ":" + Game.entities[i].type);
			if (Game.entities[i].type == "player") console.log("\tnick: " + Game.entities[i].nick);
		}
	},

	disconnect: function() {
		console.log("disconnecting player " + this.name);
		//remove the player from any containers
		var container = this.container;
		if (container == null) { }
		else if (container.hasOwnProperty("contents")) {
			if (container.contents.indexOf(this) >= 0) {
				container.contents.splice(container.contents.indexOf(this),1);
			}
		}
		this.container = null;
		if (this.hasOwnProperty("controller") && this.controller != null) this.controller = null;
	},
	
	findEntityFromInventory: function(keyword) {
		var entity = this;
		var possibilities = [];
		//keyword = keyword.toLocaleLowerCase();
		console.log("searching inventory for '" + keyword + "'");
		if (entity.hasOwnProperty("contents")) {
			var inventory = entity.contents;
			for (var i = 0; i < inventory.length; i++) {
				var target = inventory[i];
				if (target.keywords.indexOf(keyword) > -1) {
					//favor things not being worn
					if (target.hasOwnProperty("wornPosition") && (target.wornPosition == "" || target.wornPosition == "none")) return target;
					else if (target.hasOwnProperty("wornPosition") && !(target.wornPosition == "" || target.wornPosition == "none")) possibilities.push(target);
				}
			}
			if (possibilities.length > 0) return possibilities[0];
		} else {
			console.log("findEntityFromInventory: entity does not appear to have .contents");
		}
		return null;
	},

	findEntityInRoom: function(keyword) {
		var room = this.container;
		keyword = keyword.toLowerCase();

		if (room != null && room.contents.length > 0) {
			for (var i = 0; i < room.contents.length; i++) {
				var target = room.contents[i];
				if (target.keywords.indexOf(keyword) > -1) {
					return target;
				}
			}
		}
		return null;

	},

	findEntityWithinReach: function(keyword) {
		//check inventory
		var entity = this;
		keyword = keyword.toLowerCase();
		
		if (this.level >= Game.levelBuilder && keyword == "^") {
			if (this.container != null) {
				return this.container;
			} 
			return null;
		} else if (this.level >= Game.levelBuilder) {
			var target = Game.getEntityWithID(keyword);
			if (target != null) return target;
		}

		if (entity.hasOwnProperty("contents")) {
			var inventory = entity.contents;
			for (var i = 0; i < inventory.length; i++) {
				var target = inventory[i];
				if (target.keywords.indexOf(keyword) > -1) {
					return target;
				}
			}
		}
		
		//check other stuff in the room
		var room = entity.container;
		if (room != null && room.contents.length > 0) {
			for (var i = 0; i < room.contents.length; i++) {
				var target = room.contents[i];
				if (target.keywords.indexOf(keyword) > -1) {
					return target;
				}
			}
		}
		return null;

	},

	canCarry: function(entity) {
		if (this.isImmortal()) return true;
		if (!entity.hasOwnProperty("mass")) return true;

		var carryingMass = 0;
		for (var i = 0; i < this.contents.length; i++) {
			if (this.contents[i].hasOwnProperty("mass")) carryingMass += this.contents[i].mass;
		}
		if (this.hasOwnProperty("carryMassMaximum"))
			if (carryingMass + entity.mass > this.carryMassMaximum) return false;

		
		//we will need to make this more sophisticated soon
		return true;
	},

	deliverMeleeDamageFrom: function(entity, dmg) {
		this.addOpponent(entity);
		entity.addOpponent(this);
		
		if (this.level >= Game.levelImmortal) return;

		if (this.hp - dmg <= 0) {
			this.hp = 0;
			entity.receiveKillNotice(this);
			entity.gainExp(
						entity.battle, 
						this.calcBattleExpForWinner(entity, this)
					);

			this.die();
		} else {
			this.hp = this.hp - dmg;
		}
	},
	
	receiveKillNotice: function(entity) {
		if (entity != null) {
			this.removeOpponent(entity);
			this._sendMsg("You killed " + entity.descAction + "!");
		} else {
			this._sendMsg("You killed something.");
		}
	},

	die: function() {
		this._sendMsg("You died!");

		this.makeCorpse();
		
		if (this.controller == null) {
			this.purgeFromGame();
			return;
		} else {
			var spawnRoom = Game.getEntityWithID(Game.deadPlayerSpawnPointID);
			if (spawnRoom != null) {
				this.moveToContainer(spawnRoom);
				spawnRoom.sendMsgToContents(this, {descAction: ""}, "suddenly appear", "suddenly appears", "");
				commands.parseCommand(this, "look");
			}
		}

	},

	makeCorpse: function() {

		if (this.container == null) return;
		var corpse = extend(Entity);
		
		corpse.contents = [];
		delete corpse.portals;


		corpse.descAction = "the corpse of " + this.descAction;
		corpse.descLook = "A bloody and mangled corpse lies here.  Poor fellow -- by the looks of it, he wasn't able to put up much of a fight at all";
		corpse.descRoom = "The corpse of " + this.descAction + " lies here.";
		corpse.keywords = [];
		corpse.keywords.push("corpse");
		corpse.timeStartRot = Date.now() + 30000;
		corpse.timeFinishRot = Date.now()+ 60000;
		corpse.save = false;
		corpse.type = "obj";


		corpse.tic = function() {
			if (this.hasOwnProperty("timeStartRot") && Date.now() >= this.timeStartRot) {
				delete this.timeStartRot;
				if (this.container != null && this.container.hasOwnProperty("sendToEveryoneExcept"))
					this.container.sendToEveryoneExcept([],"You notice a swarm of maggots crawling about " + this.descAction + ".");
			}
			else if (Date.now() >= this.timeFinishRot) {
				
				if (this.container != null && this.container.hasOwnProperty("sendToEveryoneExcept"))
					this.container.sendToEveryoneExcept([],this.getUpperCaseAction() + " is consummed by a swarm of maggots.");
				this.purgeFromGame();
			}
		}

		for (var commodityType in this.cash) {
			if (this.cash[commodityType] > 0) {
				var amount = this.cash[commodityType];
				var commodity = extend(ObjPrototype);
				commodity.createNew(this);
				if (amount == 1) {
					commodity.descAction = "a " + commodityType + " coin";
					commodity.descRoom = "A " + commodityType + " coin lies here";
					commodity.descLook = "A old " + commodityType + " coin has been stamped with the shadow of the 'Eye.";
					commodity.keywords = [commodityType, "coin", "coins"];
				} else if (amount <= 10) {
					commodity.descAction = "a handful of " + commodityType + " coins";
					commodity.descRoom = "A handful of " + commodityType + " coins lies here";
					commodity.descLook = "A handful of old " + commodityType + " coins, each one stamped with the shadow of the 'Eye.";
					commodity.keywords = [commodityType, "coin", "coins", "handful"];
				} else if (amount <= 25) {
					commodity.descAction = "a small pile of " + commodityType + " coins";
					commodity.descRoom = "A small pile of " + commodityType + " coins lies here";
					commodity.descLook = "A small pile of old " + commodityType + " coins, each one stamped with the shadow of the 'Eye.";
					commodity.keywords = [commodityType, "coin", "coins", "pile", "small"];
				} else if (amount <= 50) {
					commodity.descAction = "a pile of " + commodityType + " coins";
					commodity.descRoom = "A pile of " + commodityType + " coins lies here";
					commodity.descLook = "A pile of old " + commodityType + " coins, each one stamped with the shadow of the 'Eye.";
					commodity.keywords = [commodityType, "coin", "coins", "pile"];
				} else {
					commodity.descAction = "a large pile of " + commodityType + " coins";
					commodity.descRoom = "A large pile of " + commodityType + " coins lies here";
					commodity.descLook = "A large pile of old " + commodityType + " coins, each one stamped with the shadow of the 'Eye.";
					commodity.keywords = [commodityType, "coin", "coins", "pile", "large"];
				}
				commodity.cash = extend(Cash);
				commodity.cash[commodityType] = amount;
				commodity = commodity.reify();
				commodity.moveToContainer(this.container);

				this.cash[commodityType] = 0;
			}
		}


		for (var i = this.contents.length-1; i >= 0; i--) {
			//console.log("moving " + this.contents[i].descAction + " to room");
			this.contents[i].moveToContainer(this.container);
		}
		this.contents = [];
		corpse.moveToContainer(this.container);
		//corpse.reify();
		Game.entities.push(corpse);
		
	},

	getCurrentZone: function() {
		//returns the zone this is occupying
		if (this.container != null) {
			if (this.container.hasOwnProperty("zone") && this.container.zone != null) return this.container.zone;
			else if (this.container.hasOwnProperty("zoneID") && this.container.zoneID != null) {
				var zone = Game.getEntityWithID(this.container.zoneID);
				if (zone != null) return zone;
			} else return null;
		}
		return null;
	}
});



function createNewMobPrototype(entity) {
	return MobPrototype.createNew(entity);
}

//Every mob in the game is a copy of a prototype
var MobPrototype = extend(Character, {
	type: "mobprototype",
	spawnRoomIDs: [],
	spawnRooms: [],
	descAction: "a mob prototype",
	descLook: "It is a not-too-cleverly designed mob prototype.",
	descRoom: "A mob prototype stands here.",
	builderNote: "none",
	keywords: ["mob", "prototype"],
	maxMobs: 1,
	zone: null,
	zoneID: -1,
	creatorID: -1,
	creator: null,
	prototype: true,
	save: false,
	moveProbability: 0,
	mobsInGame: [],	
	spawnObjects: [],
	chatMessages: [],
	trashCollector: false,
	store: false,
	sellPriceAdjustment: 1.1,
	purchasePriceAdjustment: .8,

	autospawn: function() {
		if (this.spawnRooms.length <= 0) return;
		var roomIndex = Math.floor(Math.random()*this.spawnRooms.length);
		if (roomIndex >= this.spawnRooms.length) return;
		var room = this.spawnRooms[roomIndex];
		if (room == null) {
			console.log("tried to autospawn, but could not find room!");
			return;
		}
		
		var mob = this.reify();
		if (mob == null) {
			console.log("tried to autospawn but failed at reify");
			return;
		}
		mob.moveToContainer(room);
		
		
		this.addToMobsInGame(mob);
		
		console.log("autospawning " + this.descAction);

		this.contents = [];
		//add objects to mob's inventory and equipment
		if (mob.hasOwnProperty("spawnObjects") && mob.spawnObjects.length > 0) {
			for (var i = 0; i < mob.spawnObjects.length; i++) {
				var so = mob.spawnObjects[i];
				if (Math.random() > so.spawnprobability) continue;
				var objectprototype = Game.getEntityWithID(so.objid);
				if (objectprototype == null) continue;
				var object = objectprototype.reify();
				object.moveToContainer(mob);
				console.log("\tassigning " + object.descAction + " to its " + so.wearposition);
				if (!object.hasOwnProperty("wearablePositions")) break;
				mob.tryToWear(object, [so.wearposition]);
			}
		}
		

	},
	clearSpawnObjects: function() {
		this.spawnObjects = [];
	},
	removeSpawnObject: function(objid) {
		for (var i = 0; i < this.spawnObjects.length; i++) {
			if (this.spawnObjects[i].objid == objid) {
				this.spawnObjects.splice(i,1);
				return;
			}
		}
	},
	addSpawnObject: function(objid, wearposition, spawnprobability) {
		if (!this.hasOwnProperty("spawnObjects")) {
			this.spawnObjects = [];
		}
		for (var i = 0; i < this.spawnObjects.length; i++) {
			if (this.spawnObjects[i].objid == objid) {
				this.spawnObjects[i].wearposition = wearposition;
				this.spawnObjects[i].spawnprobability = Math.min(1, Math.max(0, spawnprobability));
				return true;
			}
		}
		var spawnObject = {
			objid: objid,
			wearposition: wearposition,
			spawnprobability: spawnprobability
		};
		this.spawnObjects.push(spawnObject);
		return true;
	},

	addToMobsInGame: function(mob) {
		if (this.mobsInGame.indexOf(mob) < 0) this.mobsInGame.push(mob);
	},
	addSpawnRoom: function(room) {
		if (room.type == "room" && room.hasOwnProperty("_id")) {
			
			if (this.spawnRooms.indexOf(room) < 0) this.spawnRooms.push(room);
			var found = false;
			for (var i = 0; i < this.spawnRoomIDs.length; i++) {
				if (room._id.toString() == this.spawnRoomIDs[i].toString()) found = true;
			}
			if (!found) this.spawnRoomIDs.push(room._id);
			
		}
	},
	clearSpawnRooms: function() {
		this.spawnRooms = [];
		this.spawnRoomIDs = [];
	},
	makeFlatCopy: function() {
		var copy = extend(this);

		copy.spawnRoomIDs = [];
		for (var i = 0; i < copy.spawnRooms.length; i++) {
			copy.spawnRoomIDs.push(copy.spawnRooms[i]._id);
		}

		if (copy.zone != null && copy.zone.hasOwnProperty("_id")) copy.zoneID = copy.zone._id;
		if (copy.hasOwnProperty("container") && copy.container != null) {
			copy.containerID = copy.container._id;
			delete copy.container;
		}
		if (copy.hasOwnProperty("creator") && copy.creator != null) {
			copy.creatorID = copy.creator._id;
			delete copy.creator;
		}
		delete copy.mobsInGame;
		delete copy.zone;
		delete copy.spawnRooms;
		delete copy.contents;
		delete copy.portals;
		delete copy.prototypePointer;

		return copy;

	},
	createNew: function(creator) {
		if (creator.type != "character") return null;
		if (!creator.hasOwnProperty("contents")) return null;
		var newMob = extend(this);

		newMob.spawnRoomIDs = [];
		newMob.spawnRooms = [];
		newMob.contents = [];
		newMob.fighting = [];
        newMob.rollNewCharacter();
        
		if (creator.container.hasOwnProperty("zone") && creator.container.zone != null) {
			newMob.zone = creator.container.zone;
			if (newMob.zone.hasOwnProperty("_id"))	newMob.zoneID = creator.container.zone._id;
			else console.log("ERROR, playermanager.js, Mob.createNew, creating mob in an existing zone, but this zone has no _id!?");
		} else {
			newMob.zone = null;
		}

		
		newMob.creator = creator;
		newMob.creatorID = creator._id;
		newMob.container = creator;
		newMob._id = db.ObjectId();
		creator.contents.push(newMob);
		Game.entities.push(newMob);
		return newMob;
		//do not add to Game.contents until it's saved by the creator
	},
	reify: function() {
		var mob = extend(this);
		mob.type = Mob.type;
		
        
        
        //level up mob's drives
        for (key in mob) {
			var p = mob[key];
			if (util.isArray(p)) continue;
			if (p == null) continue;
			if (p.hasOwnProperty("type") && p.type == "drive") {
                mob.bringStatsUpToLevel(p);
			}
		}
        
        mob.hp = mob.maxHp;
        
		//Copy functions from mob
		mob._mobTic = Mob._mobTic;
		mob.moveRandomly = Mob.moveRandomly;
		mob.collectTrash = Mob.collectTrash;
		mob.chat = Mob.chat;

		mob._id = db.ObjectId();
		mob.fighting = [];
		delete mob.prototype;

		mob.prototypePointer = this;
		mob.prototypePointerID = this._id;
		this.mobsInGame.push(mob);
		
		Game.entities.push(mob);
		
		return mob;
	}
});

var Mob = extend(MobPrototype, {
	type: "mob",
	prototypePointer: null,

	_mobTic: function() {
		//console.log("mobtic");
		if (this.getFirstOpponent() == null) {
			if (this.hasOwnProperty("moveProbability") && 
				this.moveProbability > 0) {
				if (Math.random() <= this.moveProbability) {
					this.moveRandomly();
				} else {
				
				}
			}
		}
		if (this.hasOwnProperty("trashCollector") && this.trashCollector == true && Math.random() <= .005) this.collectTrash();
		if (this.hasOwnProperty("chatMessages") && this.chatMessages.length > 0 && Math.random() <= .002) this.chat();
	},
	chat: function() {
		if (this.container != null &&
			this.container.hasOwnProperty("contents") &&
			this.container.contents.length > 1) {
			var messageNum = Math.floor(Math.random() * this.chatMessages.length);
			commands.parseCommand(this, ["say", this.chatMessages[messageNum]]);
		}
	},
	collectTrash: function() {
		//console.log(this.descAction + " - collectTrash tic.");
		if (this.container != null && 
			this.container.hasOwnProperty("contents") &&
			this.container.contents.length > 1) {
			//console.log("\tthis room is not empty");
			for (var i = 0; i < this.container.contents.length; i++) {
				var c = this.container.contents[i];
//			for (var c in this.container.contents) {
				if (c == this) continue;
				if (c.type == "object" || c.type == "corpse") {
					//console.log("\ttrying to pickup a " + c.descAction + " using keyword " + c.keywords[0]);
					commands.parseCommand(this, ["get",c.keywords[0]]);
					break;
				} else {
					//console.log("\tskipping a " + c.descAction + " type " + c.type);
				}
			}
		}
	},
	moveRandomly: function() {
		if (this.hasOwnProperty("container") && 
			this.container != null &&
			this.container.hasOwnProperty("portals") &&
			this.container.portals.length > 0) {
				var portalIndex = Math.floor(Math.random() * this.container.portals.length);
				var portal = this.container.portals[portalIndex];
				var portalKeyword = portal.getPortalKeywordFromEntity(this.container);
				var targetRoom = portal.getTargetEntityFromEntity(this.container);
				
				//console.log("mob move:\n")

				if (this.hasOwnProperty("zone") && this.zone != null) {
					//console.log("\tmob has zone")
					if (targetRoom.hasOwnProperty("zone") && targetRoom.zone != null) {
						//console.log("\troom has zone")
						if (this.zone != targetRoom.zone) {
							//console.log("\tzones are NOT the same")
							return;	
						}
					} else {
						//console.log("\troom does NOT have zone")
						return;
					}
				} else if (targetRoom.hasOwnProperty("zone") && targetRoom.zone != null) {
					//console.log("\tmob does NOT have zone")
					return;
				}
				//console.log("\tmoving!")
				commands.parseCommand(this, portalKeyword);
				//console.log("mob is moving");
			}
	},
});

function getWearablePositions() { return wearablePositions; }

var wearablePositions = [
	"head",
	"face",
	"mouth",
	"nose",
	"neck",
	"back",
	"ears",
	"shoulders",
	"chest",
	"wrists",
	"hands",
	"waist",
	"ankles",
	"legs",
	"feet",
	"wielded"
];

function createNewObjPrototype(entity) {
	return ObjPrototype.createNew(entity);
}


var ObjPrototype = extend(Entity,{
	type: "objectprototype",
	descAction: "an object prototype",
	descLook: "An object prototype.",
	descRoom: "An object prototype lies on the ground here.",
	keywords: ["prototype"],
	builderNote: "none",
	maxObjects: 1,
	zone: null,
	zoneID: -1,
	creatorID: -1,
	creator: null,
	prototype: true,
	save: false,
    
    // Damage is calculated as gaussian(weaponAmgAvg + weaponStrCoefficient*character.strength, weaponDmgSD)
    weaponDmgAvg: 1,
    weaponDmgSD: 1,
    weaponStrCoefficient: 0,
    
	objsInGame: [],
	wearablePositions: ["none"],
	wornPosition: "none",
	cost: 0,

	createNew: function(creator) {
		if (creator.type != "character") return null;
		if (!creator.hasOwnProperty("contents")) return null;
		var newObj = extend(this);

		newObj.contents = [];
		
		if (creator.container.hasOwnProperty("zone") && creator.container.zone != null) {
			newObj.zone = creator.container.zone;
			if (newObj.zone.hasOwnProperty("_id"))	newObj.zoneID = creator.container.zone._id;
			else console.log("ERROR, playermanager.js, ObjPrototype.createNew, creating obj in an existing zone, but this zone has no _id!?");
		} else {
			newObj.zone = null;
		}

		
		newObj.creator = creator;
		newObj.creatorID = creator._id;
		newObj.container = creator;
		newObj._id = db.ObjectId();
		creator.contents.push(newObj);
		Game.entities.push(newObj);
		return newObj;
		//do not add to Game.contents until it's saved by the creator
	},
    
    getDamage: function(wielder) {
        return Math.max(0,gaussian(this.weaponDmgAvg + this.weaponStrCoefficient*wielder.getStrength(), this.weaponDmgSD));
    },
    
	reify: function() {
		var obj = extend(this);
		obj.type = Obj.type;
		//Assign any functions
		//mob._mobTic = Mob._mobTic;
		//mob.moveRandomly = Mob.moveRandomly;
		obj._id = db.ObjectId();
		//obj.makeFlatCopy = this.makeFlatCopy;

		delete obj.prototype;

		obj.prototypePointer = this;
		this.objsInGame.push(obj);
		
		Game.entities.push(obj);
		
		return obj;
	},

	makeFlatCopy: function() {
		var copy = extend(this);
		var key;
		var manualCopy = {};

		//console.log("making flat copy of \"" + copy.descAction + ".");
		for (key in copy) {
			var p = copy[key];
			
			if (util.isArray(p)) {
				if (p == null) continue;
				if (p.length == 0) continue;
				if (p[0] == null) {
					manualCopy[key] = [];

					for (var i = 0; i < p.length; i++) {
						//console.log("\t\t" + key+ "[" + i + "] = " + p[i]);
						manualCopy[key].push(p[i]);
					}

				} else if (p[0].hasOwnProperty("_id")) {	
					//console.log("\t" + key + ": array of objects, creating __IDs");

					var newKey = key + "IDs";
				
					copy[newKey] = [];
					manualCopy[newKey] = [];

					for (item in p) {
						copy[newKey].push(item._id);
						manualCopy[newKey].push(item._id);
					}
				} else {
					//console.log("\t" + key + ": regular array, copying");
				
					manualCopy[key] = [];

					for (var i = 0; i < p.length; i++) {
						//console.log("\t\t" + key+ "[" + i + "] = " + p[i]);
						manualCopy[key].push(p[i]);
					}
					
				}
			} else {
				if (p == null) {
					manualCopy[key] = p;
				} else if (p.hasOwnProperty("_id")) {
					//console.log("\t" + key + ": object, creating __ID");
					var newKey = key + "ID";
					
					copy[newKey] = p._id;
					manualCopy[newKey] = p._id;

				} else {
					manualCopy[key] = p;
					//console.log("\t" + key + ": regular type, ignoring");
				}
			}
		}
		
		return manualCopy;

	}

});

var Obj = extend(ObjPrototype, {
	type: "object",
	prototypePointer: null,
	wornPosition: ""
});
