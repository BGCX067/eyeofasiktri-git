var net = require("net");
var databaseUrl = "mydb";
var dbCollections = ["bot","messageBuffer"];
var db = require("mongojs").connect(databaseUrl, dbCollections);
var playermanager = require("./playermanager.js");
var sys = require("sys");
var commands = require("./commands.js");
var ircbot = require("./irc.js");

exports.init = init;
exports.listClients = listClients;

Array.prototype.remove = function(e) {
  for (var i = 0; i < this.length; i++) {
    if (e == this[i]) { return this.splice(i, 1); }
  }
};

function Client(stream) {
  this.name = null;
  this.stream = stream;
}

var clients = [];

function listClients() {
	var result = "";
	for (var i = 0; i < clients.length; i++) {
		var client = clients[i];
		if (client != null) result += i + ". " + client.nick + " connected: " + client.timeConnected + " hasEnded: " + client.hasOwnProperty("hasended") + "\n";
		else result += i + ". null";
	}
	return result;

}
function checkClients() {
	for (var i = 0; i < clients.length; i++) {
	}
}

function server_loop(stream) {
	var client = new Client(stream);
	client.timeLastAction = Date.now();
  	clients.push(client);

  	stream.setTimeout(0);
  	stream.setEncoding("utf8");

  	//stream.addListener("connect", function () {
    	//	stream.write("\nWelcome, enter your username:\n");
	//	stream.pipe(stream);
  	//});

  	stream.addListener("data", function (data) {
		client.timeLastMsgReceived = Date.now();

		if (data.indexOf("\n") >= 0) data = data.slice(0,data.indexOf("\n"));
		if (data.indexOf("\r") >= 0) data = data.slice(0,data.indexOf("\r"));
		if (data.length == 1 && (data == "\n" || data == "\r")) return;	
		if (data.length == 0) return;

    		if (!client.hasOwnProperty("player")) {
			data = data.trim();
			var cmds = data.split(" ");
			if (cmds[0] == "resume" || cmds[0] == "newcharacter") {
				console.log("retrieving player using character name: " + cmds[1]);
				client.player = playermanager.getPlayerByCharacterName(cmds[1]);
				if (client.player != null) {
					console.log("\nfound.");
					client.player.dccClient = client;
					client.nick = client.player.nick;
					var character = playermanager.getCharacterByOwnerName(cmds[1]);
					if (character == null) character = client.player.createNewCharacter();
					else client.player.setController(character);
					
					character._sendMsg("Welcome to the Eye of Asiktri!\n");
					client.player.spawn();
					
					//Broadcast to irc and clients the new player
					clients.forEach(function(c) {
	        				if (c != client) {
        	  					c.stream.write(client.player.nick + " has joined the game.\n");
        					}
      					});

					ircbot.sendToMainChannel(client.nick + " has entered the game.");

				} else {
					stream.write("The server cannot create a player, werd..\n");
					client.delete = true;
				}

			}
			return;
			/*
      			var authToken = data.match(/\S+/);
			console.log("DCC: received authtoken=[" + data + "]");

			var player = playermanager.getPlayerByAuthToken(data);
			if (player == null) {
				client.delete = true;
				console.log("\tcould not find player by that token");
			} else if (player.controlling == null) {
				console.log("\tfound player using that token!");
				player.dccClient = client;
				var character = playermanager.getCharacterByOwnerName(player.nick);
				if (character == null) {
					console.log("STATUS: irc.js, parseMsg, player has no character, creating...");

					character = player.createNewCharacter();
					stream.write("Welcome to the Eye of Asiktri!\n");
					player.spawn();
				} else {
					//connect the player to the found character
					player.setController(character);
					character._sendMsg("Welcome back to the realm.");
					player.spawn();
					
				}

				console.log("DCC: received authToken=" + data);
			
				client.player = player;
				client.nick = player.nick;

      				//stream.write("Welcome to the Eye of Asiktri!\n");
     		 		clients.forEach(function(c) {
        				if (c != client) {
          					c.stream.write(player.nick + " has joined the game.\n");
        				}
      				});

				ircbot.sendToMainChannel(client.nick + " has entered the game.");

			} else {
				//player is returning after a disconnect
				console.log("\tfound previously connected player using that token.");
				player.dccClient = client;
				var character = playermanager.getCharacterByOwnerName(player.nick);
				client.player = player;
				client.nick = player.nick;

				player.setController(character);
				character._sendMsg("Welcome back to the realm.");
				player.spawn();

				clients.forEach(function(c) {
        				if (c != client) {
          					c.stream.write(player.nick + " has joined the game.\n");
        				}
      				});

				ircbot.sendToMainChannel(client.nick + " has entered the game.");

			}
			//*/
			return;
    		} else {
			//client has been assigned a player, a character, and has spawned into the
			//new we need to parse commands
			console.log("["+data.length+"]DCC "+client.nick+"> [" + data + "]");
			var msg = data.split(" ");
			commands.parseCommand(client.player.controlling, msg);
		}

  	});
	
	stream.on('uncaughtException', function (err) {
		console.error(err.stack);
		console.log("Node NOT Exiting...");
	});

	process.on('uncaughtException', function (err) {
		console.error(err.stack);
		console.log("Node NOT Exiting...");
	});

  	stream.addListener("end", function() {
		client.hasended = true;
    		clients.remove(client);
		console.log(client.nick + " has left the game.");
    		clients.forEach(function(c) {
			if (c != client) c.stream.write(client.nick + " has left the game.\n");
    		});
		if (client.hasOwnProperty("player") && client.player != null && client.player.hasOwnProperty("controlling") && client.player.controlling != null) {
			if (client.player.controlling != null && client.player.controlling.hasOwnProperty("disconnect")) {
				console.log("DCCERROR: disconnecting character.");
				client.player.controlling.disconnect();
			} else if (client.player.controlling == null) {
				console.log("DCCERROR: client.player.controlling == null. Disconnecting player.");
				client.player.disconnect();
			}
		} else if (client.player == null) {
			console.log("DCCERROR: client has disconnected and no longer appears to have a player!");
		}
    		stream.end();
		if (clients.indexOf(client) >= 0) clients.splice(clients.indexOf(client),1);
  	});

	stream.addListener("close", function() {
		if (client != null && client.hasOwnProperty("hasended")) return;

		console.log(client.name + "'s connection has closed unexpectedly.");
		clients.forEach(function(c) {
			if (c != client) c.stream.write(client.name + " has left the game.\n");
    		});

		if (client.hasOwnProperty("player") && client.player.hasOwnProperty("controlling") && client.player.controlling != null) {
			if (client.player.controlling.hasOwnProperty("disconnect")) client.player.controlling.disconnect();
		}
    		stream.end();
		if (clients.indexOf(client) >= 0) clients.splice(clients.indexOf(client),1);

	});
	
	stream.addListener("error", function(info) {
		console.log("DCCERROR! info=" + info);
	});

	client.timeConnected = Date.now();
	stream.write("Please enter your auth token:\n");
	//stream.pipe(stream);

}

var dccserver = net.createServer(server_loop);

function init() {
	console.log("Starting DCC server on port 8888");
	dccserver.listen(8888);
}
