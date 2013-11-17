var irc = require("irc");
var databaseUrl = "mydb";
var dbCollections = ["bot","messageBuffer"];
var db = require("mongojs").connect(databaseUrl, dbCollections);
var playermanager = require("./playermanager.js");
var sys = require("sys");
var commands = require("./commands.js");
var dccserver = require("./dccserver.js");

exports.addToSendBuffer = addToSendBuffer;
exports.disconnect = disconnect;

var setupComplete = 0;
var lastAuthTokenTime = -10000;

var config = {
    channels: [
        "#EyeOfAsiktri" 
        //, "#channel1"
        ],
//    server: "card.freenode.net",
    server: "pocketwatch.trancefurs.net",
    port: 6697,
    botName: "Asiktri",
    ticInterval: 100,
    messageBufferCheckInterval: 250,
    delayPerByte: 5,  /* approximating the delay of a human typer */
    nickservPassword: "elordini@gmail.com",
    chanservPassword: "339191003948322"  // /msg chanserv identify 
};



//Chanel options
// set #deadpool secure on - Enables or disables ChanServ's security features for a
//                           channel.  When SECURE is set, only users who have
//                           registered their nicknames with NickServ and IDENTIFY'd
//                           with their password will be given access to the channel
//                           as controlled by the access list.
// sop #deadpool add nick  - 


var messageBuffer = {
    lastSendTime: -1,
    lastCheckTime: -1,
    nextSendTime: -1
};

var status = {
    connected: false,
    nickRegistration: "none"
};
    
var bot; 
/*= new irc.Client(
    config.server, 
    config.botName, 
    {
        channels: config.channels,
        userName: "Asiktri",
        realName: "Asir Skt Ri",
	floodProtectionDelay: 100,
	floodProtection: false
        //,
        //secure: true,
        //port: config.port,
        //selfSigned: true,
        //certExpired: true
    }
);
*/


function tic() {
	if (playermanager.gameState() < 5) {
		playermanager.loadGameTic();
		//still not finished read game data
		return;
	} else if (setupComplete == 0) {
		commands.createCommands();
		setupComplete = 1;
		console.log("starting dcc server...");
		dccserver.init();
		console.log("waiting a moment before calling setup()");
		setTimeout(function callsetup() {setup();}, 1000);
		return;
	} else if (setupComplete == 2) {
		if (!status.connected) {
			console.log("connecting... [" + status.connected + "]");
			return;
		} else setupComplete = 3;
	}

	// now we're connected...
	playermanager.Game().tic();
    	//check out message buffer
    	if (Date.now() - messageBuffer.lastCheckTime >= config.messageBufferCheckInterval) {
        	checkOutgoingMessageBuffer();
    	}
}

function addToSendBuffer(row) {
    if (typeof row.target === "undefined" ||
        typeof row.message === "undefined") return;
        
    db.messageBuffer.save(row);
}

function checkOutgoingMessageBuffer() {
    //console.log('checking msgbuf');
    messageBuffer.lastCheckTime = Date.now();
    
    db.messageBuffer.findOne(
        {},
        {},
        receivedOutgoingMessageBuffer
    );
}


function receivedOutgoingMessageBuffer(err, buffer) {
    var initiatedTime = 0;
    
    if (err | !buffer) return; //console.log("error, or buffer is null");
    else {
        if (typeof buffer.initiatedTime === "undefined") {}
        else initiatedTime = buffer.initiatedTime;
        
        var minimumDelay = buffer.message.length * config.delayPerByte;
        var timeFromInitiation = Date.now() - initiatedTime;
        var timeFromLastSend = Date.now() - messageBuffer.lastSendTime;
        
        if (timeFromInitiation < minimumDelay ||
            timeFromLastSend < minimumDelay) 
                return;
        
        if (typeof buffer.target === "undefined" ||
                typeof buffer.message === "undefined") return;
                
        if (buffer.target == "raw") {
            
            //there is a raw message in the outgoing buffer
            db.messageBuffer.remove({ _id: buffer._id });
            messageBuffer.lastSendTime = Date.now();
            
            console.log("raw> " + buffer.message);
            var bits = [];
            bits = buffer.message.split(" ");
            if (bits.length == 2) {
                bot.send(bits[0], bits[1]);
            } else if (bits.length > 2) {
                var therest= "";
                for (var i = 2; i < bits.length; i++) {
                    therest += bits[i];
                    if (i < bits.length) therest += " ";
                }
                bot.send(bits[0], bits[1], therest);
            }
              
        } else {
        
            db.messageBuffer.remove({ _id: buffer._id });
	 
            bot.say(buffer.target, buffer.message);
            messageBuffer.lastSendTime = Date.now();
            
            console.log("> " + buffer.target + ", " + buffer.message);
	    console.log("\tremoved message with buffer.id = " + buffer._id);
        }
    }
}

function generateAuthToken() {
	var nato = ["alfa", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliett",
		"kilo", "lima", "mike", "november", "oscar", "papa", "quebec", "romeo", "sierra", "tango",
		"uniform", "victor", "whiskey", "xray", "yankee", "zulu", "one", "two", "three", "four",
		"five", "six", "seven", "eight", "nine", "zero"];

	var len = 4;
	var str = "";

	for (var i = 0; i < len; i++) {
		str += nato[Math.floor(Math.random() * nato.length)];
		if (i < len - 1) str += " ";
	}
	return str;
}

function parseNotice(from, to, text, message) {
	//console.log("notice:" + JSON.stringify(message));
    	status.connected = true;
        //bot.say(config.channels[0], "chan what?");
        var pm = {
            type: "notice",
            time: Date.now(),
            nick: from,
            msg: text,
            user: message["user"],
            host: message["host"]
        };
        
        //console.log("notice: " + from + " [" + to + "]: " + text); 
        
        if (from == "NickServ") {
            if (message["args"][1].replace(/[^\x20-\x7E]/g, '')
                == "This nickname is registered and protected.  If it is your") {

                console.log("]Carded by NickServ");
                
                addToSendBuffer({target: "nickserv", message: "identify " + config.nickservPassword});
                status.nickRegistration = "password sent";
            } else if (message["args"][1].replace(/[^\x20-\x7E]/g, '')
                == "Password accepted - you are now recognized.") {
                
                console.log("]Password accepted by nickserv");
                status.nickRegistration = "finished";
            } else {
	    	if (message.hasOwnProperty("args") && message.args.length == 2) {
			//This could be the result of an identify check
			var msg = message.args[1].split(" ");
			if (msg.length == 3) {
				if (msg[0] == "STATUS") {
					var player = playermanager.getPlayerByNick(msg[1]);

					if (player == null) {
						console.log("Fuck, just received NickServ status for an unknown nick (" + msg[1] + ") wtf?!");
						return;
					} else {
						if (msg[2] == "3") {
							player.setNickServStatus("authenticated");
							console.log("Client requested DCC info, sending...");			// 173.65.94.69
							bot.send("PRIVMSG", msg[1], String.fromCharCode(1) + "DCC", "CHAT", "chat", "2906742341", "4444"+String.fromCharCode(1));
							var authToken = generateAuthToken();
							bot.send("PRIVMSG", msg[1], "You have 30 s to begin DCC and authenticate yourself using this code: " + authToken);
							player.authToken = authToken;
							player.authTokenCreationTime = Date.now();
							lastAuthTokenTime = Date.now();

							//addToSendBuffer({
							//	target: msg[1],
							//	message: "You have been authenticated. Type \"sleep\" to enter the Eye of Asiktri.",
							//	initiatedTime: Date.now()
							//});
							console.log("received authentication for " + msg[1] + " from nickserv.");
						} else {

							player.setNickServStatus("undefined");

							addToSendBuffer({
								target: msg[1],
								message: "You have not yet identified yourself with NickServ.  You may not play until you obey.",
								initiatedTime: Date.now()
							});

							console.log("nickserv does not know " + msg[1] + ". Not authenticating.");
							return;
						}
						console.log("received nickserv status: " + msg[2]);

						/*
						if (msg[2] == "3") {
							character.setNickServStatus("identified");
							console.log("player identified.");
							var character = playermanager.getCharacterByOwnerName(pm.nick);
							if (character == null) {
								console.log("STATUS: irc.js, parseMsg, player has no character, creating...");

								character = player.createNewCharacter();	
								player.spawn();
							} else {
								//connect the player to the found character
								player.setController(character);
								character.sendMsg("Welcome back to the realm.");
								player.spawn();
							}

						}
						*/
					}

				}
			}
		}
	    	console.log("]NickServ: " + JSON.stringify(message));
	    }
        } else {
            console.log("Notice:\t" + from + ": [" + message["args"][1] + "]");
            
        }
        db.bot.save(pm);
        
        
}

function parsePM(pm) {
    status.connected = true;

    if (typeof pm.msg === "undefined") return;
    
    //sanitize the message
    pm.msg = pm.msg.replace(/[^\x20-\x7E]/g, '');
    if (pm.from == "NickServ") {
    	console.log("nickserv>" + pm.msg);
	return;
    }

    if (pm.msg.length > 0) {
        var words = pm.msg.split(" ");
        var sentence = "";
        
        console.log("parsing, words[0] == [" + words[0] + "]");
        
        if (words[0].toLowerCase() == "echo") {
	    return;
            console.log("\techo command received");
            
            for (var i = 1; i < words.length; i++) {
                sentence += words[i];
                if (i < words.length) sentence += " ";
            }
            addToSendBuffer({
                target: pm.nick,
                message: sentence,
                initiatedTime: Date.now()
                });
        } else if (pm.msg == "This nickname is registered and protected.  If it is your") {
            console.log("\tbeing carded by nickserv [" + pm.nick + "]");
            status.nickRegistration = "none";
        } else if (pm.msg == "Password accepted - you are now recognized.") {
            console.log("\tpassword accepted by nickserv");
            status.nickRegistration = "finished";
        } else {
		var player = playermanager.getPlayerByNick(pm.nick);

		player.see();

		var nsStatus = player.getNickServStatus();
		if (nsStatus == "undefined") {
			console.log("received msg from new player (" + pm.nick + "). Authorizing with nickserv");

			addToSendBuffer({
				target: pm.nick,
				message: "Requesting your authorization from NickServ, please wait.",
				initiatedTime: Date.now()
			});

			addToSendBuffer({
				target: "NickServ",
				message: "status " + pm.nick,
				initiatedTime: Date.now()
			});
			player.setNickServStatus("waiting");
			return;

		} else if (nsStatus == "waiting") {
			console.log("player (" + pm.nick + ") attempted 2nd communication");

			addToSendBuffer({
				target: pm.nick,
				message: "We requested your identity from NickServ. Please be patient.",
				initiatedTime: Date.now()
			});
			return;
		} 
		
		
		if (player.controlling == null) {
			var character = playermanager.getCharacterByOwnerName(pm.nick);
			addToSendBuffer({
				target: pm.nick,
				message: "Creating new user...",
				initiatedTime: Date.now()
			});
			return;

			if (character == null) {
				console.log("STATUS: irc.js, parseMsg, player has no character, creating...");

				character = player.createNewCharacter();	
				player.spawn();
			} else {
				//connect the player to the found character
				player.setController(character);
				character._sendMsg("Welcome back to the realm.");
				player.spawn();
				
			}

		} else {
			if (!player.hasOwnProperty("authTokenCreationTime") || 
				(player.hasOwnProperty("authTokenCreationTime") && Date.now() >= player.authTokenCreationTime + 60000)) {
				console.log("Client requested DCC info, sending...");			// 173.65.94.69
				bot.send("PRIVMSG", pm.nick, String.fromCharCode(1) + "DCC", "CHAT", "chat", "2906742341", "4444"+String.fromCharCode(1));
				var authToken = generateAuthToken();i
				bot.send("PRIVMSG", pm.nick, "You have 1 min to begin DCC and authenticate yourself using this code: " + authToken);
				player.authToken = authToken;
				player.authTokenCreationTime = Date.now();
				lastAuthTokenTime = Date.now();
			} else {
				//commands.parseCommand(player.controlling, words);
				console.log("IRC.js, this player has already received an auth token.");
				console.log("\tplayer.hasOwnProperty(authTokenCreationTime): " + player.hasOwnProperty("authTokenCreationTime"));
				console.log("\tplayer.authTokenCreationTime: " + player.authTokenCreationTime);
				console.log("\tDate.now()                  : " + Date.now());
				console.log("\t autoToken>Date.now() +30k  : " + (Date.now() + 30000));
				addToSendBuffer({
					target: pm.nick,
					message: "Your previous auth token is still valid.  You need to wait a little while longer to request another one.",
					initiatedTime: Date.now()
					});
			}
		}
	}
    }
}

function disconnect() {
	bot.disconnect();
}

function setup() {
	
    //playermanager.loadGameFromDB();
    //commands.createCommands();
	bot = new irc.Client(
		config.server, 
		config.botName, 
    		{
		        channels: config.channels,
		        userName: "Asiktri",
		        realName: "Asir Skt Ri",
			floodProtectionDelay: 100,
			floodProtection: false,
			autoConnect: false
		        /*,
		        secure: true,
		        port: config.port,
		        selfSigned: true,
		        certExpired: true */
		    }
		);

    bot.addListener("registered", function(message) {
        console.log("connected:");
        for (var propertyName in message) {
            console.log("\t" + propertyName + ": " + message[propertyName]);
        }
        status.connected = true;
    });

    bot.addListener("pm", function(from, text, message) {
    	status.connected = true;
    //    bot.say(from, "pm");
        var pm = {
            type: "pm",
            time: Date.now(),
            nick: from,
            msg: text,
            user: message["user"],
            host: message["host"]
        };
        
        parsePM(pm);
        
        db.bot.save(pm);
        
        console.log("pm: " + from + ": " + text); 
    });

    bot.addListener("message#", function(from, to, text, message) {
    	status.connected = true;
        //bot.say(config.channels[0], "chan what?");
        var pm = {
            type: "channel",
            time: Date.now(),
            nick: from,
            msg: text,
            user: message["user"],
            host: message["host"],
            channel: to
        };
        
        db.bot.save(pm);
        
        console.log("msg: " + from + " [" + to + "]: " + text); 
    });
    
    
    bot.addListener("notice", parseNotice);
    
    /*function(from, to, text, message) {
    	status.connected = true;
        //bot.say(config.channels[0], "chan what?");
        var pm = {
            type: "notice",
            time: Date.now(),
            nick: from,
            msg: text,
            user: message["user"],
            host: message["host"]
        };
        
        //console.log("notice: " + from + " [" + to + "]: " + text); 
        
        if (from == "NickServ") {
            if (message["args"][1].replace(/[^\x20-\x7E]/g, '')
                == "This nickname is registered and protected.  If it is your") {

                console.log("]Carded by NickServ");
                
                addToSendBuffer({target: "nickserv", message: "identify " + config.nickservPassword});
                status.nickRegistration = "password sent";
            } else if (message["args"][1].replace(/[^\x20-\x7E]/g, '')
                == "Password accepted - you are now recognized.") {
                
                console.log("]Password accepted by nickserv");
                status.nickRegistration = "finished";
            } else {
	    	if (message.hasOwnProperty("args") && message.args.length == 2) {
			//This could be the result of an identify check
			var msg = message.args[1].split(" ");
			if (msg.length == 3) {
				if (msg[0] == "STATUS") {
					var player = playermanager.getPlayerByNick(msg[1]);

					if (null == null) {
						console.log("Fuck, just received NickServ status for an unknown nick (" + msg[1] + ") wtf?!");
						return;
					} else {

						console.log("received nickserv status: " + msg[2]);
						if (msg[2] == "3") {
							character.setNickServStatus("identified");
							console.log("player identified.");
							var character = playermanager.getCharacterByOwnerName(pm.nick);
							if (character == null) {
								console.log("STATUS: irc.js, parseMsg, player has no character, creating...");

								character = player.createNewCharacter();	
								player.spawn();
							} else {
								//connect the player to the found character
								player.setController(character);
								character.sendMsg("Welcome back to the realm.");
								player.spawn();
							}

						}
					}

				}
			}
		}
	    	console.log("]NickServ: " + JSON.stringify(message));
	    }
        } else {
            console.log("Notice:\t" + from + ": [" + message["args"][1] + "]");
            
        }
        db.bot.save(pm);
        
        
    });
    */
    
    bot.addListener('error', function(message) {
        console.log('error: ', message);
    });
    
    bot.addListener('nick', function(oldnick, newnick, channels, message) {
    	status.connected = true;
        var row = {
            type: "nick",
            time: Date.now(),
            oldnick: oldnick,
            newnick: newnick,
            user: message["user"],
            host: message["host"],
            channel: channels
        };
        db.bot.save(row);
    });
    
    bot.addListener('part', function(channel, nick, reason, message) {
        var row = {
            type: "part",
            time: Date.now(),
            nick: nick,
            reason: reason,
            user: message["user"],
            host: message["host"],
            channel: channel
        };
        db.bot.save(row);
    });
    
    bot.addListener('quit', function(nick, reason, channels, message) {
        var row = {
            type: "quit",
            time: Date.now(),
            nick: nick,
            reason: reason,
            user: message["user"],
            host: message["host"],
            channel: channels
        };
        db.bot.save(row);
    });

    
    bot.addListener('join', function(channel, nick, message) {
        status.connected = true;
        var row = {
            type: "join",
            time: Date.now(),
            nick: nick,
            user: message["user"],
            host: message["host"],
            channel: channel
        };
        db.bot.save(row);
    });
    
    bot.addListener('raw', function(message) {
    	//console.log("raw: " + JSON.stringify(message));
        status.connected = true;
        var pm = {
            type: "action",
            time: Date.now(),
            nick: "",
            msg: "",
            user: "",
            host: "",
            channel: ""
        };
        
        //console.log("raw:\n");
        
        for (var propertyName in message) {
            //console.log("\t" + propertyName + ": " + message[propertyName]);
            
            if (propertyName == "nick") pm.nick = message[propertyName];
            else if (propertyName == "user") pm.user = message[propertyName];
            else if (propertyName == "host") pm.host = message[propertyName];
            
            if (propertyName == "args") {
                var channelName = message[propertyName][0];
                var possibleAction = message[propertyName][1];
                
                if (possibleAction != null) {
                    //Get rid of the non-ascii characters
                    channelName = channelName.replace(/[^\x20-\x7E]/g, '');
                    possibleAction = possibleAction.replace(/[^\x20-\x7E]/g, '');
                    
                    var items = possibleAction.split(" ");
                    if (items.length >= 2 &&
                        items[0] == "ACTION") {
                                            
                        console.log("action: "+pm.nick + " ["+channelName+"]: " + possibleAction);
                        
                        //We received an action
                        pm.channel = channelName;
                        pm.msg = possibleAction;
                        
                        db.bot.save(pm);
                    
                    } else {
                        /*
                        console.log("length="+items.length+", items[0]={" + items[0]+"}");
                        if (items.length == 2 && items[0].length == 7) {
                            console.log("\titems.length=" + items.length);
                            console.log("\titems[0].length=" + items[0].length);
                            console.log("\titems[0]=[" + items[0] + "]");
                            console.log("\titems[0].charAt(1)=" + items[0].charAt(1));
                            console.log("\titems[0].charAt(6)=" + items[0].charAt(6));
                        }
                        if (items[0] == "ACTION") console.log("\tACTION!!");
                        if (items[0].length == 6 &&
                            items[0].charAt(1) == "A" &&
                            items[0].charAt(6) == "C" &&
                            items[0].charAt(5) == "N") console.log("\tACTION!!!!!!!");
                        */
                    }
                }
            }
        }
    });
    
    setupComplete = 2;
    console.log("setup complete.");
    console.log("connecting...");
    bot.connect();
    //setInterval(tic, config.messageBufferCheckInterval);

}

setInterval(tic, config.messageBufferCheckInterval);
//setup();



