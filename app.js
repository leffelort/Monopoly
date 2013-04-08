// ========================
// ==== Express server ====
// ========================
var express = require("express");
var app = express();
var fs = require("fs");
var shortID = require("shortid");
var monopoly = require("./monopoly.js");
var phoneCodeGen = require("./phoneCodeGen.js");

app.use(express.bodyParser());

app.configure(function(){
  app.use(express.static(__dirname));
});
/*
app.get("/:staticFilename", function (request, response) {
  response.sendfile(request.params.staticFilename);
});
*/

// Map of game id's to Game objects
var currentGames = {};

app.post("/hostGame", function (req, resp) {
  var gameName = req.body.gameName;
  var password = req.body.password;
  var numPlayers = Number(req.body.numPlayers);
  var gameID = shortID.generate();
  var phoneCode = phoneCodeGen.generate();
  currentGames[gameID] = monopoly.newGame(gameID, phoneCode, gameName,
    password, numPlayers);

  getPropertiesFromDatabase(function (arr) {
	currentGames[gameID].availableProperties = arr;  /* TODO: fill this in with all properties */
  });

  resp.send({
    success: true,
    id: gameID
  });
});

app.get("/gameList", function (req, resp) {
  var gameList = [];
  for (var gameID in currentGames) {
    var game = currentGames[gameID];
    if (game.isStarted) {
      var gameStatus = "In Progress";
    }
    else {
      var gameStatus = game.numPlayers + "/" + game.maxPlayers + " players";
    }
    if (game.password === "") {
      var gamePassword = "No";
    }
    else {
      var gamePassword = "Yes";
    }

    gameList.push({
      name: game.name,
      password: gamePassword,
      status: gameStatus
    });
  }

  resp.send({
    success: true,
    gameList: gameList
  });
});

app.get("/game/:id", function (req, resp) {
  var gameID = req.params.id;
  var game = currentGames[gameID];
  console.log(currentGames);
  if (game !== undefined) {
    resp.send({
      success: true,
      game: game
    });
  }
  else {
    resp.send({ success: false });
  }
});

app.get("/properties", function(req, resp) {
	var userid = req.body.userid;
	var gameid = req.body.gameid;
	getPropertiesFromDatabase(function(obj){
		console.log(obj);
		resp.send({
			props : obj,
			success:true
		});
	});
});

// ========================
// ======= Database =======
// ========================

var mongo = require('mongodb');
var host = 'ds037067.mongolab.com';
var port = 37067;

var options = {w : 1};
var dbName = 'monopoly';
var dbIsOpen = false;

var client = new mongo.Db(
		dbName,
		new mongo.Server(host, port),
		options
	);

client.open(function(error, result) {
	if (error)
		throw error;
	client.authenticate("thedrick", "thedrick", function(err, res) {
		if (err)
			throw err;
		dbIsOpen = true;
	});
});

function getPropertiesFromDatabase(onOpen) {

	client.collection('properties', onPropertyCollectionReady);

	function logger(error, result) {
		if (error)
			throw error;
		console.log(result);
	}

	function onPropertyCollectionReady(error, propertyCollection) {
		if (error)
			throw error;
		var props = propertyCollection.find({}).toArray(function(err, array) {
			onOpen(array);
		});
	}
}

function saveObjectToDB(collection, obj) {
	console.log("saving object ", obj);
	client.collection(collection, function(error, collec) {
		if (error)
			throw error;
		collec.find({id : obj.id}).toArray(function(e, r) {
			if (e)
				throw e;
			if (r.length === 0) {
				collec.insert(obj, function(err, res) {
					if (err)
						throw err;
					console.log(res);
				});
			} else if (obj.socketid !== undefined) {
				console.log("Updating socket id for user");
				collec.update({id: obj.id}, { $set : {socketid : obj.socketid }}, function(err) {
					if (err)
						throw err;
				});
			} else {
				console.log("object already exists in database");
			}
		});
	});
}

function closeDb() {
	client.close();
}

app.listen(11611);

// ========================
// === Socket.io server ===
// ========================

var io = require('socket.io').listen(8686);
var connections = {};
var socketToPlayerId = {};

io.sockets.on('connection', function (socket) {
  connections[socket.id] = socket;

  socket.on('login', function (data) {
  	var user = {};
  	user.first_name = data.first_name;
  	user.last_name = data.last_name;
  	user.id = data.id;
  	user.gender = data.gender;
  	user.socketid = socket.id;
  	user.invites = [];
  	user.gameInProgress = undefined;
  	saveObjectToDB('users', user);
  	socketToPlayerId[socket.id] = user.id;
  });

  socket.on('hostgame', function (data) {
    var game = currentGames[data.gameID];
    if (game !== undefined && game.host === undefined) {
      game.host = monopoly.newPlayer(data.username, data.fbusername);
      console.log(game.host);
      game.numPlayers++;
      game.players[socket.id] = game.host;
      socket.emit('hostgame', { success: true });
    }
  });

  socket.on('joingame', function (data) {
    var gameFound = false;
    for (var gameID in currentGames) {
      var game = currentGames[gameID];
      if (game.code === data.code) {
        gameFound = true;
        // Error checking
        if (game.isStarted) {
          socket.emit('joingame', {
            success: false,
            message: "This game is already in progress."
          });
        }
        else if (game.numPlayers === game.maxPlayers) {
          socket.emit('joingame', {
            success: false,
            message: "This game is full."
          });
        }
        else {
          var player = monopoly.newPlayer(data.username, data.fbusername);
          game.numPlayers++;
          game.players[socket.id] = player;
          socket.emit('joingame', {
            success: true,
            gameID: game.id
          });
          for (var socketid in game.players) {
            console.log(game.players[socketid]);
            if (socketid !== socket.id) {
              connections[socketid].emit('newplayer', {
                player: player,
              });
            }
          }
        }
      }
    }
    if (!gameFound) {
      socket.emit('joingame', {
        success: false,
        message: "Game does not exist."
      });
    }
  });

  socket.on('leavegame', function (data) {
    var game = currentGames[data.gameID];
    if (game !== undefined) {
      if (game.players[socket.id] === game.host) {
        // If host leaves, the entire game is deleted
        for (var socketid in game.players) {
          if (socketid !== socket.id) {
            connections[socketid].emit('hostleft', {})
          }
        }
        delete currentGames[data.gameID];
      }
      else {
        delete game.players[socket.id];
        game.numPlayers--;
        for (var socketid in game.players) {
          connections[socketid].emit('playerleft', {});
        }
      }
    }
  });

  socket.on('playerWaiting', function (data) {
	var username = data.username;
	var code = data.code;
	for (var gameID in currentGames) {
      var game = currentGames[gameID];
      if (game.code === data.code) {
		game.playersWaiting++;
		//console.log("Playerswaiting: " + game.playersWaiting);
		//console.log("numPlayres: " + game.numPlayers);
		if ((game.playersWaiting === game.numPlayers) && (game.numPlayers > 1) && (!game.isStarted)) {
			//set playersWaiting = 0??
			startGame(gameID);
		}
	  }
	}
  });

  socket.on('disconnect', function () {
    delete connections[socket.id];
  });
});


// MORE FUNCTIONS
function startGame(gameID) {
	var game = currentGames[gameID];
	//console.log("STARTING: " + gameID);
	for (var socketid in game.players) {
		connections[socketid].emit('gameReady', {});
	}
	game.isStarted = true;
}
