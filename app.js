// ========================
// ==== Express server ====
// ========================
var express = require("express");
var app = express();
var fs = require("fs");
var shortID = require("shortid");
var monopoly = require("./monopoly.js");

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
var currentGames = [];

app.post("/hostGame", function (req, resp) {
  var hostName = req.body.hostName;
  var gameName = req.body.gameName;
  var password = req.body.password;
  var numPlayers = 4;
  var gameID = shortID.generate();
  currentGames[gameID] = 
    monopoly.newGame(gameID, gameName, password, numPlayers, hostName);
  
  resp.send({ success: true });
});

app.get("/gameList", function (req, resp) {
  var gameList = [];
  for (var gameID in currentGames) {
    var game = currentGames[gameID];
    var gameStatus;
    if (game.isStarted) {
      gameStatus = "In Progress";
    }
    else {
      gameStatus = game.numPlayers + "/" + game.maxPlayers + " players";
    }
    var gamePassword;
    if (game.password === "") {
      gamePassword = "No";
    }
    else {
      gamePassword = "Yes";
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

var client = new mongo.Db(
		dbName,
		new mongo.Server(host, port),
		options
	);

function getPropertiesFromDatabase(onOpen) {

	client.open(onDbReady);

	function onDbReady(error) {
		if (error) 
			throw error;
		client.authenticate("thedrick", "thedrick", function(err, res) {
			if (err)
				throw err;
			client.collection('properties', onPropertyCollectionReady);
		});
	}

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
			closeDb();
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
