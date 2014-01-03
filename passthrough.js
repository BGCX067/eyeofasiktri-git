var net = require("net");
var databaseUrl = "mydb";
var dbCollections = ["players","authenticatingPlayers","bot","messageBuffer","entities"];
var db = require("mongojs").connect(databaseUrl, dbCollections);
var sys = require("sys");


var dccserver = null;
var clients = [];
var players = [];
var authenticatingPlayers = [];

var bootSequence = [
	readPlayersFromDB,
	startListening,
	requestAuthenticatingPlayers
];
var currentStep = -1;

var clientPort = 4444;
var serverPort = 8888;
var serverTimeoutInterval = 2000;

var authTokenCreationTimeLimit = Date.now() - 60000;
var dbAuthTokenQueryInterval = 2000;

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}
function getClientCreatingNewCharacter() {
	for (var i = 0; i < clients.length; i++) {
		if (clients[i].creatingNewCharacter) return clients[i];
	}
	return null;
}
function Client(clientstream) {
	var thisclient = this;

	this.name = null;
	this.clientstream = clientstream;
	this.serverstream = null;
	this.authToken = "";
	this.authenticated = false;
	this.player = null;
	this.currentMenu = [];
	this.inGame = false;
	this.numInvalidAttempts = 0;
	this.timeOfLastAuthenticationAttempt = 0;
	this._clientInputHandler = null;
	this._clientOutputHandler = null;

	this.creatingNewCharacter = false;
	this.creatingNewCharacterName = "";

	this.savePlayer = function() {
		db.players.save(this.player);
	}

	this.clientInputHandler = function(input) {
		if (this._clientInputHandler == null) this.clientstream.write("error, an input handler has not been assigned.\n");
		else this._clientInputHandler(input);
	}
	this.clientOutputHandler = function() {
		if (this._clientOutputHandler == null) this.clientstream.write("please wait.\n");
		else this._clientOutputHandler();
	}

	// Main Menu
	this.gotoMainMenu = function() {
		this._clientOutputHandler = this.showMenu;
		this._clientInputHandler = this.handleMainMenu;
		this.clientOutputHandler();
	}
	this.createMainMenu = function() {
		var menu = [];
		menu.push({opt: -1, txt: "Welcome to the Eye of Asiktri!"});
		menu.push({opt: -1, txt: ""});
		menu.push({opt: -1, txt: "Main Menu:"});
		menu.push({opt: 0,  txt: "Create a new character.", func: this.gotoCreateNewCharacter});	
		if (this.player.characters.length > 0) {
			for (var i = 0; i < this.player.characters.length; i++) {
				menu.push({opt: (i+1), txt: "Resume playing " + this.player.characters[i] + ".", func: resumePlayingCharacter, params: [thisclient,i]});
			}
		}
		menu.push({opt: (this.player.characters.length+1), txt: "Disconnect.", func: this.disconnectPlayer});
		for (var i=0;i<menu.length;i++) {menu[i].p = this;};
		this.currentMenu = menu;
	}
	this.showMenu = function() {
		this.createMainMenu();
		var result = "";
		for (var i = 0; i < this.currentMenu.length; i++) {
			var item = this.currentMenu[i];
			if (item.opt >= 0) result += "  " + item.opt + ". ";
			result += item.txt + "\n";
		}
		result += ">\n";
		this.clientstream.write(result);
	}
	this.handleMainMenu = function(input) {
		if (!isNumber(input)|| input < 0) {
			this.clientstream.write("Invalid entry.\n");
			this.clientOutputHandler();
		} else {
			for (var i = 0; i < this.currentMenu.length; i++) {
				if (input == this.currentMenu[i].opt) {
					if (this.currentMenu[i].hasOwnProperty("func")) {
						if (this.currentMenu[i].hasOwnProperty("params")) {
							this.currentMenu[i].func(this.currentMenu[i].params);
						} else {
							this.currentMenu[i].func();
						}
					} else {
						this.clientstream.write("You selected an option that didn't have a corresponding function.");
					}
					break;
				}
			}
		}
	}

	//create new character
	this.gotoCreateNewCharacter = function() {
		this.p._clientOutputHandler = this.p.showCreateNewCharacterPrompt;
		this.p._clientInputHandler = this.p.createNewCharacterInputHandler;
		for (var i in this) {
			//console.log(sys.inspect(i));
		}
		this.p.clientOutputHandler();
	}
	this.createNewCharacterInputHandler = function(input) {
		input = input.trim();
		var inputArray = input.split(" ");
		if (inputArray.length > 1) input = inputArray[0];

		if (input.length <= 1) {
			this.clientstream.write("Character names must contain at least two characters.\n");
			this.clientOutputHandler();
			return;
		} else {
			var test = getClientCreatingNewCharacter();
			if (test != null) {
				this.clientstream("Sorry, another player seems to be making a new character right now. Please wait a few seconds and try again.\n");
				this.gotoCreateNewCharacter();
				return;
			}
			this.clientstream.write("Checking to see if that character already exists.\n");
			this.dbQuery = "waiting for player";
			this.creatingNewCharacter = true;
			this.creatingNewCharacterName = input;

			db.entities.find({type: "character", name: {$regex: "^" + input + "$", $options: "i"}}).forEach(this.receivePlayer);
			this._clientInputHandler = null;
		}
	}
	this.showCreateNewCharacterPrompt = function() {
		this.clientstream.write("Enter new character's name: \n");
	}
	this.noPlayerFound = function(p) {
		console.log("no player found!");
	}
	this.receivePlayer = function(err, p) {
		var client = getClientCreatingNewCharacter();
		if (client == null) {
			console.log("received feedback from new character name search, but we can't tell who did the search.");
			return;
		}
		client.creatingNewCharacter = false;
		
		console.log("receiving msg from db.");
		
		if (err) {
			console.log(err);
			client.clientstream.write("Error searching in database.\n");
			client.dbQuery = "no player found";
			client.gotoMainMenu();
		} else if (!p) {
			client.noPlayerFound();
			
			client.clientstream.write("Creating character.\n");
			client.dbQuery = "no player found";
			client.createNewCharacter();
			//client.gotoMainMenu();
		} else {
			client.clientstream.write("A character already exists by that name.\n");
			client.gotoMainMenu();
		}
	}

	this.createNewCharacter = function() {
		if (this.player.hasOwnProperty("characters")) {
			if (this.player.characters.indexOf(this.creatingNewCharacterName) == -1) {
				this.player.characters.push(this.creatingNewCharacterName);
				this.savePlayer();
			} else {
				console.log("ERROR, client.createNewCharacter, client already has a character by that name");
			}
			this.connectToGame("newcharacter " + this.creatingNewCharacterName);
		} else {
			this.clientstream.write("An error has occurred. Please try again?\n");
			this.gotoMainMenu();
		}
	}


	this.gameInputHandler = function(input) {
		if (input === undefined) return;
		//console.log("gameInputHandler(" + input + ")");
		if (this.serverstream != null) {
			this.serverstream.write(input);
		} else {
			this.clientstream.write("server has dropped us.");
			this.gotoMainMenu();
		}
	}


	this.resumePlayingCharacter = function(characterindex) {
		this.connectToGame("resume " + this.player.characters[characterindex]);
	}

	this.connectToGame = function(parameter) {
		console.log("connecting to server: " + parameter);
		setTimeout(this.serverTimeout, serverTimeoutInterval);
		
		this.serverstream = net.connect(serverPort, "localhost", function() {
			thisclient.inGame = true;
			thisclient._clientInputHandler = thisclient.gameInputHandler;
			thisclient.serverstream.write(parameter);
			//serverstream.write(parameter);
		});
		this.serverstream.addListener("error", function(data) {
			thisclient.clientstream.write("Error, server not available.\n");
			thisclient.gotoMainMenu();
			thisclient.inGame = false;
		});

		this.serverstream.addListener("data", function(data) {
			thisclient.clientstream.write(data);
		});
		this.serverstream.addListener("end", function(data) {
			thisclient.clientstream.write("server has dropped us.\n");
			thisclient.inGame = false;
			thisclient.gotoMainMenu();
		});
	}
	
	this.serverTimeout = function() {
		if (thisclient.inGame) return;
		thisclient.clientstream.write("Server has timed out. Please try again in a moment.\n");
		thisclient.gotoMainMenu();
	}

	this.disconnectPlayer = function() {
		if (this.hasOwnProperty("clientstream")) {
			if (this.clientstream.hasOwnProperty("write")) 
				this.clientstream.write("Good bye.\n");
			if (this.clientstream.hasOwnProperty("emit"))
				this.clientstream.emit("close");
		}
		this.inGame = false;
	}
}

function createNewCharacter(client) {
	console.log("Creating new character.");
}

function resumePlayingCharacter(params) {
	var client = params[0];
	var index = params[1];
	//console.log("resuming: " + JSON.stringify(client));
	var name = client.player.characters[index];
	console.log("resuming play of " + name);
	client.resumePlayingCharacter(index);
}

function disconnectPlayer(client) {
	console.log("Disconnecting player.");
}

function getAuthenticatingPlayerByAuthToken(token) {
	for (var i = 0; i < authenticatingPlayers.length; i++) {
		var p = authenticatingPlayers[i];
		if (p.hasOwnProperty("authToken") && p.hasOwnProperty("authTokenCreationTime")) {
			console.log("comparing token received by server [" + token + "] to user credential [" + p.authToken + "]");
			if (token == p.authToken) {
				
				return p;
			}
		}
	}
	return null;
}
function server_loop(clientstream) {
	var client = new Client(clientstream);
	client.timeLastAction = Date.now();
  	clients.push(client);

  	clientstream.setTimeout(0);
  	clientstream.setEncoding("utf8");

  	//stream.addListener("connect", function () {
    	//	stream.write("\nWelcome, enter your username:\n");
	//	stream.pipe(stream);
  	//});

  	clientstream.addListener("data", function (data) {
		client.timeLastMsgReceived = Date.now();

		if (data.indexOf("\n") >= 0) data = data.slice(0,data.indexOf("\n"));
		if (data.indexOf("\r") >= 0) data = data.slice(0,data.indexOf("\r"));
		if (data.length == 1 && (data == "\n" || data == "\r")) return;	
		if (data.length == 0) return;

    		if (client.player == null) {
			
      			var authToken = data.match(/\S+/);
			console.log("DCC: received authtoken=[" + data + "]");
			client.player = getAuthenticatingPlayerByAuthToken(data);	
			if (client.player == null) {
				client.clientstream.write("That token appears to be invalid.");
				client.timeOfLastAuthenticationAttempt = Date.now();
			} else {
				client.inGame = false;
				client.gotoMainMenu();
				if (authenticatingPlayers.indexOf(client.player) != -1) {
					authenticatingPlayers.splice(authenticatingPlayers.indexOf(client.player),1);
				}
			}
			//use the auth token to authenticate in game
			return;

    		} else {
			client.clientInputHandler(data);
		} 
		

  	});
	
	clientstream.on('uncaughtException', function (err) {
		console.error(err.stack);
		console.log("Node NOT Exiting...");
	});

	clientstream.on('uncaughtException', function (err) {
		console.error(err.stack);
		console.log("Node NOT Exiting...");
	});

  	clientstream.addListener("end", function() {
		client.hasended = true;
    		if (clients.indexOf(client)!=-1) clients.splice(clients.indexOf(client),1);
		console.log(client.nick + " has left the game.");
    		clients.forEach(function(c) {
			if (c != client) c.clientstream.write(client.nick + " has left the game.\n");
    		});
		//tell the game that the player has disconnected
		//
    		clientstream.end();
		if (clients.indexOf(client) >= 0) clients.splice(clients.indexOf(client),1);
  	});

	clientstream.addListener("close", function() {
		if (client != null && client.hasOwnProperty("hasended")) return;

		console.log(client.name + "'s connection has closed unexpectedly.");
		clients.forEach(function(c) {
			if (c != client) c.clientstream.write(client.name + " has left the game.\n");
    		});

		if (client.hasOwnProperty("player") && client.player.hasOwnProperty("controlling") && client.player.controlling != null) {
			if (client.player.controlling.hasOwnProperty("disconnect")) client.player.controlling.disconnect();
		}
    		clientstream.end();
		if (clients.indexOf(client) >= 0) clients.splice(clients.indexOf(client),1);

	});
	
	clientstream.addListener("error", function(info) {
		console.log("DCCERROR! info=" + info);
	});

	client.timeConnected = Date.now();
	clientstream.write("Please enter your auth token:\n");
	//stream.pipe(stream);

}

function player() {
	this.serversAndNicks = [];
	this.characters = [];
	this.characterState = null;
	this.authToken = "";
	this.type = "player";
}

function readPlayersFromDB() {
	console.log("requesting players from database.");
	db.players.find().forEach(receivedPlayerFromDB);
}
function receivedPlayerFromDB(err, p) {
	if (!p) {
		executeNextStepInBootSequence();
	} else if (p.type == "player") {
		if (p.hasOwnProperty("serversAndNicks") && p.serversAndNicks.length > 0) {
			console.log("\treading " + p.serversAndNicks[0].nick + " @ " + p.serversAndNicks[0].server);
		}
		players.push(p);
	} else {
		console.log("\tskipping unknown data: " + JSON.stringify(p));
	}
}

function requestAuthenticatingPlayers() {
	//console.log("Checking for authenticating players.");
	db.authenticatingPlayers.find().forEach(receivedAuthenticatingPlayer);
}
function receivedAuthenticatingPlayer(err, p) {
	if (!p) {
		//cone
		setTimeout(requestAuthenticatingPlayers, dbAuthTokenQueryInterval);
	} else {
		if (p.hasOwnProperty("authToken")) {
			var delay = Date.now() - p.authTokenCreationTime;
			authenticatingPlayers.push(p);
			db.authenticatingPlayers.remove(p);
			console.log("found player in " + delay + " ms");
			console.log("\t" + JSON.stringify(p));
		} else {
			console.log("found something but it's not a player: " + JSON.stringify(p));
		}
	}
}

function refreshAuthTokenTimeLimit() {
	authTokenCreationTimeLimit = Date.now() - 60000;	
}

function startListening() {
	console.log("Listening for clients on port " + clientPort);
	dccserver = net.createServer(server_loop);
	dccserver.listen(clientPort);
	executeNextStepInBootSequence(); //requestAuthenticatingPlayers
}

function executeNextStepInBootSequence() {
	if (currentStep >= bootSequence.length) return;
	else {
		currentStep++;
		bootSequence[currentStep]();
	}
}

function init() {
	console.log("Booting passthrough...");
	executeNextStepInBootSequence();	
}

init();
