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

app.listen(11611);

// ========================
// === Socket.io server ===
// ========================

var io = require('socket.io').listen(8686);

io.sockets.on('connection', function (socket) {
  socket.on('code', function (data) {console.log(data)});
  socket.on('disconnect', function () { });
});
