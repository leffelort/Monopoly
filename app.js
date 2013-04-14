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

/* borrowed from Evan Shapiro's Case Study, from Class notes. */
/*
app.all('/', function mobileDesktopRouter(req, res, next){
    if (!strStartsWith(req.url, '/desktop') && !strStartsWith(req.url, '/mobile')){
        if (req.useragent.isMobile){
            wwwExists('/mobile' + req.url, function(exists){
                if (exists)
                    req.url = '/mobile' + req.url;
                next();
            });
        }
        else {
            wwwExists('static/desktop' + req.url, function(exists){
                if (exists)
                    req.url = '/desktop' + req.url;
                next();
            });
        }
    }
    else {
        next();
    }
});

function wwwExists(url, done){
    if (strEndsWith(url, '/'))
        url += 'index.html';
    fs.exists(url, done);
}

function strStartsWith(str, prefix) {
    return str.indexOf(prefix) === 0;
}

function strEndsWith(str, suffix) {
    return str.match(suffix + "$") == suffix;
}
*/
/* end of borrowed code */

app.get('/desktop/', function(req, res, next){
  mongoExpressAuth.checkLogin(req, res, function(err){
    if (err)
      res.sendfile('static/login.html');
    else
      next();
  });
});




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

// called from the client when someone clicks the "host game" button
// on the main screen.
app.post("/hostGame", function (req, resp) {
  var gameName = req.body.gameName;
  var password = req.body.password;
  var numPlayers = Number(req.body.numPlayers);
  var gameID = shortID.generate();
  var phoneCode = phoneCodeGen.generate();
  currentGames[gameID] = monopoly.newGame(gameID, phoneCode, gameName,
    password, numPlayers);

    getPropertiesFromDatabase(function (arr) {
      currentGames[gameID].availableProperties = arr;
    });

  resp.send({
    success: true,
    id: gameID
  });
});

// return the list of games to populate the list
// are we still using this?
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

// reuturn a list of all properties
app.get("/properties", function(req, resp) {
  var userid = req.body.userid;
  var gameid = req.body.gameid;
  getPropertiesFromDatabase(function(obj){
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

var mongoUri = process.env.CUSTOMCONNSTR_MONGOLAB_URI ||
  "mongodb://cmuopoly:dp32Kx102Y7ol3Q5_GleoWlDgmFb1m2Tm51jiVyeQi4-@ds041157.mongolab.com:41157/cmuopoly"
var dbIsOpen = false;
var client = undefined;

mongo.Db.connect(mongoUri, function(err, db) {
  if (err)
    throw err;
  console.log("successfully connected to the database.")
  client = db;
  dbIsOpen = true;
  //client.collection("users", function (e, u) { 
   // if (e) throw e;
   // u.drop();
   //});
});

// get a username for a given socket id
function queryUsername(sockid, callback) {
  console.log("query for username with socketid ", sockid);
  client.collection("users", function(error, users) {
    if (error) throw error; 
   // users.find({}).toArray(function(err,arr) {
   //  if (err) throw err;
    //  console.log(arr);
    //}); //oddly, commenting out this step causes the code to crash. woo.
    //console.log('intermed.');
    users.find( { socketid : sockid } ).toArray(function(err, arr) {
      if (err) throw err;
      console.log("queryUsername", arr);
      if (arr === undefined || arr.length !== 1) throw ("queryUsername exception");
      
      callback(arr[0].full_name); 
    });
  });
}

// get back the game the player at socket id is a part of
function queryGame(sockid, callback) {
  queryUsername(sockid, function(un) {
    client.collection("games", function(error, games) {
      console.log("UN: " + un);
      games.find({"players.username" : un}).toArray(function(err, arr){
      //games.find( { "players" : {"$elemMatch" : { "username" : {"$eq" : un } } } } ).toArray(function(err, arr){
      //games.find({ players : sockid}).toArray(function(err, arr){
      //games.find( { players : { $elemMatch : { sockid.username : un } } } ).toArray(function(err, arr){
      //findobj["players." + sockid] = {"username" : un};
      //games.find( findobj ).toArray(function(err, arr) {
        if (err) throw err;
        //console.log("queryGame", arr);
        if (arr === undefined || arr.length !== 1) throw ("queryGame exception");
        callback(arr[0]);
      
      });
    });
  });
}

function queryPlayer(sockid, callback) {
  queryGame(sockid, function(game) {
      callback(game.players[sockid]);
      //var finalPlayer = undefined;
      //for (playerid in game.players) {
       // if (username === game.players[playerid].fbusername) {
        //  finalPlayer = game.players[playerid];
        //}
      //return finalPlayer;
  });
}
 
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

// this is actually the save user function, but I figured
// we might use it for more than just users. It updates a socket id
// if one is provided, adds to the database if objs is not already
// there, and does nothing otherwise
function saveObjectToDB(collection, obj, cback) {
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
          //console.log(res);
        });
      } else if (obj.socketid !== undefined) {
        console.log("Updating socket id for user: " + obj.socketid);
        collec.update({id: obj.id}, { $set : {socketid : obj.socketid }}, function(err) {
          if (err)
            throw err;
            console.log("finished.");
        });
       // collec.find({}).toArray(function(x,y) { if (x) throw x; console.log("t" + y);});
      } else {
        console.log("object already exists in database");
      }
      cback();
    });
  });
}

// save's a game's current state to the databse. Overwrites
// a games previous state if it existed.
function saveGame(game) {
  console.log("saving game");
  client.collection("games", function(error, games) {
    if (error) throw error;
    games.find({id: game.id}).toArray(function(error, arr) {
      if (error) throw error;
      if (arr.length === 0) {
        games.insert(game, function(error, result) {
          if (error) throw error;
          //console.log(result);
        });
      } else {
        games.update({id: game.id}, game, function(error) {
          if (error) throw error;
        });
      }
    });
  });
}

// deletes game from the database.
function deleteGame(game) {
  client.collection("games", function(error, games) {
    if (error) throw error;
    games.remove({id: game.id}, function(error) {
      if (error) throw error;
      delete game;
      console.log("successfully removed game from the database");
    });
  });
}

function closeDb() {
  dbIsOpen = false;
  client.close();
}


// ========================
// === Socket.io server ===
// ========================

var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);

server.listen(process.env.PORT || 11611);

var connections = {};
var socketToPlayerId = {};

io.sockets.on('connection', function (socket) {
  connections[socket.id] = socket;
  
  // reopen and login do the exact same thing in that they
  // update the server on player's logged in and which socket
  // that player corresponds to.
  socket.on('reopen', function (data) {
    userMaintain(socket, data, function() { socket.emit('reopen', {success: true}); });
   // socket.emit('reopen', {success: true});
  });

  socket.on('login', function (data) {
    userMaintain(socket, data, function() { socket.emit('login', {success: true}); });
  //  console.log("DOC BROWN.");  
  });

  socket.on('hostgame', function (data) {
    var game = currentGames[data.gameID];
    if (game !== undefined && game.host === undefined) {
      game.host = monopoly.newPlayer(data.username, data.fbusername);
      console.log(game.host);
      game.numPlayers++;
      game.host.playerNumber = game.numPlayers;
      game.players[socket.id] = game.host;
      socket.emit('hostgame', { 
        success: true,
        gameID: game.id
      });
      saveGame(game);
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
          player.playerNumber = game.numPlayers;
          game.players[socket.id] = player;
          socket.emit('joingame', {
            success: true,
            gameID: game.id
          });
          sendToOthers(gameID, 'newplayer', {
                player: player,
                gameID: game.id
              }, socket.id);
          sendToBoards(gameID, 'newplayer', {
                player: player,
                gameID: game.id
              });
        }
        saveGame(game);
      }
    }
    if (!gameFound) {
      socket.emit('joingame', {
        success: false,
        message: "Game does not exist."
      });
    }
  });

  
  socket.on('boardjoin', function (data) {
  connections[socket.id] = socket;
    var gameFound = false;
    for (var gameID in currentGames) {
      var game = currentGames[gameID];
      if (game.code === data.code) {
        gameFound = true;
        // Error checking
      /*  if (game.isStarted) {
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
        } */
        //else {
          var board = monopoly.newBoard();
          game.numBoards++;
          game.boards[socket.id] = board;
          socket.emit('boardjoin', {
            success: true,
            gameID: game.id
          });
          sendToPlayers(game.id, 'boardjoin', {
            gameID: game.id,
            number: game.numBoards
          });
       /*   
    for (var socketid in game.players) {
            console.log(game.players[socketid]);
            if (socketid !== socket.id) {
              connections[socketid].emit('boardjoin', {
                board: game.numBoards,
                gameID: game.id
              });
            }
          }
      */
        if ((game.playersWaiting === game.numPlayers) && (game.numPlayers > 1) && (!game.isStarted) && (game.numBoards > 0)){
          startGame(game.id);
        }
        saveGame(game);
      }
    }
    if (!gameFound) {
      socket.emit('boardjoin', {
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
        sendToOthers(data.gameID, 'hostleft', {}, socket.id);
        sendToBoards(data.gameID, 'hostleft', {});
        deleteGame(currentGames[data.gameID])
      }
      else {
        delete game.players[socket.id];
        game.numPlayers--;
        sendToPlayers(data.gameID, 'playerleft',  {
          gameID: game.id
        });
        sendToBoards(data.gameID, 'playerleft', {
          gameID: game.id
        });
        saveGame(game);
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
        if ((game.playersWaiting === game.numPlayers) && (game.numPlayers > 1) && (!game.isStarted) && (game.numBoards > 0)) {
          //set playersWaiting = 0 not necessary because of start
          startGame(gameID);
        }
        saveGame(game);
      }
    }
  });

  socket.on('chatmessage', function (data) {
    var game = currentGames[data.gameID];
    if (game !== undefined) {
      sendToPlayers(data.gameID, 'chatmessage', {
        type: data.type,
        sender: data.sender,
        message: data.message
      });
    }
  });
  
  socket.on('getme', function () {
  console.log("FUCK YOU.");
    queryPlayer(socket.id, function(err,res){
      if (err) throw err;
      socket.emit('getme', res);
    });
  });
  
  socket.on('diceroll', function(data) {
    console.log('diceroll??');
    handleRoll(data.result, socket.id);
    console.log("We got a roll of " + data.result + " from socket " + socket.id);
    socket.emit('diceroll', {success: (data.result !== undefined)});
  });

  socket.on('disconnect', function () {
  // If the player was in a game, remove them from it
    for (var gameID in currentGames) {
      var game = currentGames[gameID];
      console.log("Players", game.players);
      if (socket.id in game.players) {
        if (!game.isStarted && !(game.numPlayers === game.playersWaiting)) {
          console.log("HERRO");
          if (game.players[socket.id] === game.host) {
            console.log("going to delete because host left");
            // If the host disconnected, delete the entire game
            sendToOthers(gameID, 'hostleft', {}, socket.id);
            sendToBoards(gameID, 'hostleft', {});
            deleteGame(game);
          }
          else {
            // Otherwise, the user leaves
            delete game.players[socket.id];
            game.numPlayers--;
            sendToPlayers(gameID, 'playerleft', {gameID: game.id});
            sendToBoards(gameID, 'playerleft', {gameID: game.id});
            saveGame(game);
          }
        }
        else {
          // TODO: handle disconnections while in game elegantly.
        }
        break;
      }
    }
    delete connections[socket.id];
  });
});


// MORE FUNCTIONS

function handleRoll(z, socketid) {
  var found = false; 
  queryGame(socketid, function(game){
    queryUsername(socketid, function(username) {
      if (game.players[socketid].space + z > 39) passGo(game, username, socketid);
      //if (p.space === 20) //todo handle in-jail rolls. 
      game.players[socketid].space = ((p.space + z) % 40);
      sendToBoards(game.id, 'movePlayer', {username: game.players[socketid].username, 
                                           space : game.players[socketid].space });
      saveGame(game);
      handleSpace(game, username, socketid, game.players[socketid].space);
      });
  });
}

// thedrick - this is kind of ugly, but apparently map is relatively new?
// I was going to port this to a map reduce, but this is fine.
function isOwnable(space) {
  var properties = [1,3,6,8,9,11,13,14,16,18,19,21,23,24,26,27,29,31,32,34,37,39]
  var railroads = [5,15,25,35]
  var utilities = [12,28]
  for (var i in properties) {
    if (space === i) 
      return true;
  }
  for (var i in railroads) {
    if (space === i) 
      return true;
  }
  for (var i in utilities) {
    if (space === i)
      return true;
  }
  return false;
}

function isChance(space) {
  return (space === 22 || space === 36);
}
function isCommChest(space) {
  return (space === 2 || space === 17);
}
function isTax(space) {
  return (space === 4 || space === 38);
}
function isCorner(space) { 
  return (space%10 === 4);
}

function isOwned(game, space) {
 /* var avails = game.availableProperties;
  for (var prop in avails) {
    if (prop.id === space) { 
      return false;
    }
  return true; */
  return false; //TODO, get spaceIDs into the db
}

function collectRent(game, space, socketid, username) {
  //todo: rentcollection.
}

function shortSell(space, socketid) {
  var sock = connections[socketid];
  sock.emit('shortSell', {'property' : space}); //naming convention?
}

function sendToJail(game, socketid, username) {
  //todo: sendToJail.
}

function handleTax(game, space, socketid, username){
  if (space === 38) {
    debit(game, socketid, 100);
  }
  if (space === 4) {
    //todo: incometax()
  }
}

function handleSpace(game, username, socketid, space) {
  if (isOwnable(space)) {
    if (isOwned(game, space)) {
      collectRent(game, space, socketid, username);
    } else {
      shortSell(space, socketid);
    }
  }
  if (isCorner(space)) {
    if (space === 0) {
      //todo: do we want double money for landing on go???
    }
    if (space === 20) {
      //todo: do we want free parking to be a straight $500??
    }
    if (space === 30) {
      sendToJail(game, socketid, username);
    }
  }
  if (isCommChest(space) || isChance(space)) {
    //todo: comm chest & chance
  }
  if (isTax(space)) {
    handleTax(game, space, socketid, username);
  }
}

function debit(game, username, amt) {
  var found = false;
  
 /* for (var p in game.players) {
    if (game.players[p].username === username) {
      found = true;
      if (game.players[p].money - amt < 0) {
        //handle mortgage conditions, loss conditions, etc;
      } else {
        game.players[p].money = game.players[p].money - amt;
      }
    }
  }*/ 
  saveGame(game);
  if (found === false) throw "debit exception";
}


function userMaintain(socket, data, cback) {
    var user = {};
    user.first_name = data.first_name;
    user.last_name = data.last_name;
    user.full_name = data.name;
    user.fbusername = data.username; 
    user.id = data.id;
    user.gender = data.gender;
    user.socketid = socket.id;
    user.invites = [];
    user.gameInProgress = undefined;
    saveObjectToDB('users', user, cback);
    socketToPlayerId[socket.id] = user.id;
}

function startGame(gameID) {
  if (game !== undefined) {
    game.isStarted = true;
  }
  sendToPlayers(gameID, 'gameReady', {});
  sendToBoards(gameID, 'gameReady', {});
  var game = currentGames[gameID];
}


function sendToPlayers(gameID, emitString, emitArgs) {
  var game = currentGames[gameID];
  if (game != undefined) {
    for (var socketid in game.players) {
      connections[socketid].emit(emitString, emitArgs);
    }
  }
} 

function sendToBoards(gameID, emitString, emitArgs) {
   var game = currentGames[gameID];
    if (game != undefined) {
      for (var socketid in game.boards) {
        connections[socketid].emit(emitString, emitArgs);
    }
  }
}

function sendToOthers(gameID, emitString, emitArgs, senderID) {
  var game = currentGames[gameID];
    if (game != undefined) {
    for (var socketid in game.players) {
      if (socketid !== senderID) {
        connections[socketid].emit(emitString, emitArgs);
      }
    }
  }
}