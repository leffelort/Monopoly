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
  var hostName = req.body.hostName;
  var gameName = req.body.gameName;
  var password = req.body.password;
  var numPlayers = 4;
  var gameID = shortID.generate();
  var phoneCode = phoneCodeGen.generate();
  currentGames[gameID] = monopoly.newGame(gameID, phoneCode, gameName, 
    password, numPlayers, hostName);
  
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
  console.log(game);
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
			console.log(array);
			onOpen(array);
		});
	}
}

function closeDb() {
	client.close();
}

app.listen(11611);

// ========================
// === Socket.io server ===
// ========================

var io = require('socket.io').listen(8686);

io.sockets.on('connection', function (socket) {
  socket.on('code', function (data) {console.log(data)});
  socket.on('disconnect', function () { });
});
