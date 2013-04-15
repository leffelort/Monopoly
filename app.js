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
  client.collection("users", function (e, u) { 
    if (e) throw e;
    //u.drop();
   });
   client.collection("games", function (e,g) {
    if (e) throw e;
    //g.drop();
   });
});

// get a username for a given socket id
function queryUser(sockid, callback) {
  console.log("query for user with socketid ", sockid);
  client.collection("users", function(error, users) {
    if (error) throw error; 
    users.find( { socketid : sockid } ).toArray(function(err, arr) {
      if (err) throw err;
      console.log("queryUsername", arr);
      if (arr === undefined || arr.length !== 1) throw ("queryUsername exception");
      
      callback(arr[0]); 
    });
  });
}


function queryBoard(sockid, callback) {
  console.log("query for user with socketid ", sockid);
  client.collection("boards", function(error, users) {
    if (error) throw error; 
    boards.find( { socketid : sockid } ).toArray(function(err, arr) {
      if (err) throw err;
      console.log("queryBoards", arr);
      if (arr === undefined || arr.length !== 1) throw ("queryBoards exception");
      callback(arr[0]); 
    });
  });
}


// get back the game the player at socket id is a part of
function queryGame(sockid, callback) {
  queryUser(sockid, function(user) {
    client.collection("games", function(error, games) {
      games.find({"id" : user.gameInProgress}).toArray(function(err, arr){
        if (err) throw err;
        console.log("queryGame", arr);
        if (arr === undefined || arr.length !== 1) throw ("queryGame exception");
        callback(arr[0]);
      });
    });
  });
}
//DON'T USE THIS. READ ONLY, ONLY USED IN THE SOCKET.ON("GETME") HANDLER. - pmarino
// this is a copy and paste of queryGame because... I didn't know how else
// to do it for some reason? Calling queryGame wasn't working for whatever
// reason but that might just be me being dumb. - thedrick
function queryPlayer(sockid, callback) {
  var p;
  queryUser(sockid, function(user) {
    client.collection("games", function(error, games) {
      games.find({"id" : user.gameInProgress}).toArray(function(err, arr){
        if (err) throw err;
        console.log("queryGame", arr);
        if (arr === undefined || arr.length !== 1) throw ("queryGame exception");
        for (var i = 0; i < arr.length; i++) { // no idea why i did a for loop cause it shouldn't actually have more than 1.
          var game = arr[i];
          for (var pid in game.players) {
            var player = game.players[pid];
            console.log("looking for player with pid " + user.fbid + " currently looking at ", player);
            if (player.fbid === user.fbid) {
              p = player;
              p.fbid = user.id;
            }
          }
        }
        callback(p);
      });
    });
  });
}

function socketsInGame(gameid, callback) {
  console.log("Looking for sockets for game id " + gameid);
  client.collection('users', function(error, users) {
    if (error) throw error;
    users.find({gameInProgress: gameid}).toArray(function(err, arr) {
      if (err) throw err;
      console.log("dese are the sockets i found", arr);
      if (arr === undefined || arr.length === 0) throw ("socketInGame exception");
      callback(arr);
    });
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
        console.log("Updating socket id for obj: " + obj.socketid);
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

function updateCurrentGame(playerid, gameid) {
  console.log("updating player + " + playerid + " with game id " + gameid);
  client.collection("users", function(error, users) {
    if (error) throw error;
    users.update({fbid: playerid}, {$set : {gameInProgress: gameid} } , function(error) {
      if (error) throw error;
      console.log("successfully updated gameinprogress");
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
      game.host = monopoly.newPlayer(data.username, data.fbid);
      console.log(game.host);
      game.numPlayers++;
      game.host.playerNumber = (game.numPlayers - 1); //ie 0 indexed.
      game.host.gameInProgress = game.id;
      game.players[data.fbid] = game.host;
      updateCurrentGame(data.fbid, game.id);
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
          var player = monopoly.newPlayer(data.username, data.fbid);
          game.numPlayers++;
          player.playerNumber = (game.numPlayers - 1);
          player.gameInProgress = game.id;
          game.players[data.fbid] = player;
          updateCurrentGame(data.fbid, game.id);
          socket.emit('joingame', {
            success: true,
            gameID: game.id
          });
          sendToOthers(gameID, 'newplayer', {
                player: player,
                gameID: game.id,
                number: player.playerNumber
              }, socket.id);
          sendToBoards(gameID, 'newplayer', {
                player: player,
                gameID: game.id,
                number: player.playerNumber
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
        game.numBoards++;
        var boardID = shortid.generate();
        var board = monopoly.newBoard(boardID, game.numBoards);
        game.boards[socket.id] = board;
        socket.emit('boardjoin', {
          success: true,
          gameID: game.id,
          boardID: board.id
        });
        sendToPlayers(game.id, 'boardjoin', {
          gameID: game.id,
          number: game.numBoards
        });
        if ((game.playersWaiting === game.numPlayers) && 
            (game.numPlayers > 1) && (!game.isStarted) && 
            (game.numBoards > 0)) {
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
      if (game.players[data.fbid] === game.host) {
        // If host leaves, the entire game is deleted
        sendToOthers(data.gameID, 'hostleft', {}, socket.id);
        sendToBoards(data.gameID, 'hostleft', {});
        deleteGame(currentGames[data.gameID])
      }
      else {
        delete game.players[data.fbid];
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
    queryPlayer(socket.id, function(res){
      socket.emit('getme', res);
    });
  });
  
  socket.on('getBoardMe', function () {
  });
  
  socket.on('diceroll', function(data) {
    console.log('diceroll??');
    handleRoll(data.result, data.doubles, socket.id, data.fbid);
    console.log("We got a roll of " + data.result + " from socket " + socket.id);
    socket.emit('diceroll', {success: (data.result !== undefined)});
  });
  
  socket.on('shortSell', function(data) {
    if (data.result) {
      handleSale(data.property, socket.id, data.fbid);
    }
    else {
      //endTurn();
    }
  });

  socket.on('disconnect', function () {
    // If the player was in a game, remove them from it
    console.log("socket disconnect: " + socket.id);
    queryUser(socket.id, function(user) {
      var game = currentGames[user.gameInProgress];
      if (!game.isStarted && !(game.numPlayers === game.playersWaiting)) {
        console.log("HERRO");
        if (game.players[user.fbid] === game.host) {
          console.log("going to delete because host left");
          // If the host disconnected, delete the entire game
          sendToOthers(gameID, 'hostleft', {}, socket.id);
          sendToBoards(gameID, 'hostleft', {});
          deleteGame(game);
        } else {
          // Otherwise, the user leaves
          delete game.players[user.fbid];
          game.numPlayers--;
          sendToPlayers(gameID, 'playerleft', {gameID: game.id});
          sendToBoards(gameID, 'playerleft', {gameID: game.id});
          saveGame(game);
        }
      } else {
        // TODO: handle disconnections while in game elegantly.
      }
      delete connections[socket.id];
    });
  });
});


// MORE FUNCTIONS

function endTurn(game) {
  if (!game.doubles) {
    game.currentTurn = ((game.currentTurn + 1) % game.numPlayers);
  }
  saveGame(game);
  sendToBoards('nextTurn', {player: game.currentTurn});
  sendToPlayers('nextTurn', {player: game.currentTurn});
}


function handleSale(space, socketid, fbid) {
  queryGame(socketid, function(game) {
    var prop;
    for (var index in game.availableProperties) {
      if (game.availableProperties[index].id === space) {
        prop = game.availableProperties[index];
        delete game.availableProperties[index];
      }
    }
   // var user = game.players[socketid].fbid;
    game.players[fbid].properties[space] = prop;
    game.propertyOwners[space] = fbid;
    debit(game, socketid, property.price, fbid);
    sendToBoards('propertySold', {property : space, fbid: fbid});
    endTurn(game);
    });
}

function handleRoll(z, dbls, socketid, fbid) {
  queryGame(socketid, function(game){
    if ((game.players[fbid].jailed) && (!dbls)) {
      endTurn(game);//todo handle in-jail rolls. 
    }
    game.players[fbid].space = ((game.players[fbid].space + z) % 40);
    sendToBoards(game.id, 'movePlayer', {fbid: fbid, 
                                           space : game.players[fbid].space });
     // saveGame(game);
    if (game.players[fbid].space < z) passGo(game, socketid,fbid);
    handleSpace(game, socketid, game.players[fbid].space);
  });
}

//tyler's not going to like this function... 
function createsMonopoly(owned, space) {
  return false;
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
  return (space%10 === 0);
}

function isOwned(game, space) {
  var avails = game.availableProperties;
  for (var prop in avails) {
    if (avails[prop].id === space) { 
      return false;
    }
  return true;
  }
  //return false; //TODO, get spaceIDs into the db
}

function collectRent(game, space, socketid,fbid) {
  var property = game[fbid].propertyOwners[space];
  //todo Railroads && utilities!!!!!!!!!!!!
  var amt, atom;
  var exn = "atomicity exn, collectRent(" + game + ", " + space + ", " + socketid + ");";
  switch(property.numHouses) {
    case 0 :
      if (property.mortgaged) {
        amt = 0;
      }
      if (property.monopoly) {
        amt = (property.rent * 2)
      }
      if (property.hotel) {
        amt = property.hotel
      }
      break;   
    case 1: 
      amt = property.onehouse;
      break; 
    case 2: 
      amt = property.twohouse;
      break;
    case 3: 
      amt = property.threehouse;
      break;
    case 4: 
      amt = property.fourhouse;
      break;
  }
  atom = debit(game, socketid, amt);
  if (atom) credit(game, socketid, amt);
  else throw exn;
  connections[socketid].emit('payingRent', {space: space, amount: amt});
  endTurn(game);
}

function shortSell(space, socketid, fbid) {
  var sock = connections[socketid];
  sock.emit('shortSell', {'property' : space, fbid: fbid}); //naming convention?
}

function sendToJail(game, socketid, fbid) {
  var jail = 30;
  game.players[fbid].space = jail;
  sendToBoards(game.id, 'goToJail', {fbid: game.players[fbid].fbid, 
                                       space : jail });
  game.players[fbid].jailed = true;
}

function handleTax(game, space, socketid, fbid){
  if (space === 38) {
    debit(game, socketid, 100, fbid);
  }
  if (space === 4) {
    //todo: incometax()
  }
  endTurn(game);
}

function handleSpace(game, socketid, space, fbid) {
  if (isOwnable(space)) {
    if (isOwned(game, space)) {
      collectRent(game, space, socketid, fbid);
    } else {
      shortSell(space, socketid, fbid);
    }
  }
  if (isCorner(space)) {
    if (space === 0) {
      credit(game,socketid,200, fbid);
      // do we want double money for landing on go???
    }
    if (space === 20) {
      credit(game,socketid,500, fbid);
      // do we want free parking to be a straight $500??
    }
    if (space === 30) {
      sendToJail(game, socketid, fbid);
    }
    endTurn();
  }
  if (isCommChest(space) || isChance(space)) {
    //todo: comm chest & chance
  }
  if (isTax(space)) {
    handleTax(game, space, socketid, fbid);
  }
}

function credit(game,socketid, amt, fbid) {
  game.players[fbid].money = game.players[fbid].money + amt;
  //need to ensure atomicity later on probably...
}

function debit(game, socketid, amt, fbid) {
  if (game.players[fbid].money - amt < 0) {
    //handle mortgage conditions, loss conditions, etc;
  } else {
    game.players[fbid].money = game.players[fbid].money - amt;
    return true;
  }
  //saveGame(game);
}



function userMaintain(socket, data, cback) {
  console.log("userMaintain " + socket.id);
  var user = {};
  user.first_name = data.first_name;
  user.last_name = data.last_name;
  user.full_name = data.name;
  user.fbid = data.id; 
  user.id = data.id;
  user.gender = data.gender;
  user.socketid = socket.id;
  user.invites = [];
  user.gameInProgress = undefined;
  saveObjectToDB('users', user, cback);
  socketToPlayerId[socket.id] = user.id;
}


function startGame(gameID) {
  var game = currentGames[gameID];
  game.currentTurn = 0;
  if (game !== undefined) {
    game.isStarted = true;
  }
  sendToPlayers(gameID, 'gameReady', {});
  sendToBoards(gameID, 'gameReady', {});
}


function sendToPlayers(gameID, emitString, emitArgs) {
  socketsInGame(gameID, function(sockets) {
    for (var i = 0; i < sockets.length; i++) {
      connections[sockets[i].socketid].emit(emitString, emitArgs);
    }
  });
} 

// TODO This needs to actually send stuff to the baord and like we should
// have the right sockets for boards and stuff. - thedrick
function sendToBoards(gameID, emitString, emitArgs) {
   var game = currentGames[gameID];
    if (game != undefined) {
      for (var socketid in game.boards) {
        connections[socketid].emit(emitString, emitArgs);
    }
  }
}

function sendToOthers(gameID, emitString, emitArgs, senderID) {
  socketsInGame(gameID, function(sockets) {
    for (var i = 0; i < sockets.length; i++) {
      if (sockets[i].socketid !== senderID) {
        connections[sockets[i].socketid].emit(emitString, emitArgs);
      }
    }
  });
}
