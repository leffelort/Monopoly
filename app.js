// ========================
// ==== Express server ====
// ========================
var express = require("express");
var app = express();
var fs = require("fs");
var shortID = require("shortid");
var monopoly = require("./monopoly.js");
var phoneCodeGen = require("./phoneCodeGen.js");
var _ = require("underscore");
var retry = 5;
var boardretry = 5;

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
      for (var i = 0; i < 40; i++) {
        var card = arr[i];
        if (card) {
          var prop = monopoly.newProperty(card);
          console.log("at index " + i + " and card " + card.title + " with space " + card.space); 
          currentGames[gameID].availableProperties[card.space] = prop;
        } else {
          // currentGames[gameID].availableProperties[i] = null;
        }
      }
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
  "mongodb://cmuopoly:dp32Kx102Y7ol3Q5_GleoWlDgmFb1m2Tm51jiVyeQi4-@ds041157.mongolab.com:41157/cmuopoly?auto_reconnect=true"
var dbIsOpen = false;
var client = undefined;
var chanceCommChestDeck = undefined;

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
   client.collection("boards", function (e,b) {
    if (e) throw e;
    //b.drop();
   });
   
   chanceCommChestDeck = require('./chanceCommChestDeck.js')(client);
});


// get a username for a given socket id
function queryUser(sockid, callback) {
  if (retry <= 0) {
    callback(undefined);
  } else {
    console.log("queryUser: sockid=", sockid, " retry=", retry);
    client.collection("users", function(error, users) {
      if (error) throw error; 
      users.find( { socketid : sockid } ).toArray(function(err, arr) {
        if (err) throw err;
        if (arr === undefined || arr.length !== 1) {
          retry--;
          queryUser(sockid, callback);
        } else {
          retry = 5;
          callback(arr[0]); 
          return;
        }
      });
    });
  }
}


function queryBoard(sockid, callback) {
  if (boardretry <= 0) {
    callback(undefined);
  } else {
    console.log("queryBoard: sockid=", sockid, " retry=", boardretry);
    client.collection("boards", function(error, boards) {
      if (error) throw error; 
      boards.find( { socketid : sockid } ).toArray(function(err, arr) {
        if (err) throw err;
        if (arr === undefined || arr.length !== 1) {
          boardretry--;
          queryBoard(sockid, callback);
        } else {
          boardretry = 5;
          callback(arr[0]);
          return;
        }
      });
    });
  }
}


// get back the game the player at socket id is a part of
function queryGame(sockid, callback) {
  retry = 5;
  console.log("queryGame: sockid=", sockid);
  queryUser(sockid, function(user) {
    client.collection("games", function(error, games) {
      games.find({"id" : user.gameInProgress}).toArray(function(err, arr){
        if (err) throw err;
        if (arr === undefined || arr.length !== 1) throw ("queryGame exception");
        callback(arr[0]);
      });
    });
  });
}

function queryGameFromBoard(sockid, callback) {
  console.log("queryGameFromBoard: sockid=", sockid);
  queryBoard(sockid, function(board) {
    client.collection("games", function(error, games) {
      games.find({"id" : board.gameInProgress}).toArray(function(err, arr){
        if (err) throw err;
        if (arr === undefined || arr.length !== 1) 
          throw ("queryGameFromBoard exception");
        callback(arr[0]);
      });
    });
  });
}

// get the list of ALL property objects for a given game.
function getPropertiesForGame(sockid, callback) {
  queryGame(sockid, function(game) {
    var props = game.availableProperties;
    for (var fbid in game.players) {
      var player = game.players[fbid];
      props = _.union(props, player.properties);
    }
    if (props.length > 0) console.log("Successfully retrieved properties");
    else console.log("Wir haben keine Properties. Ich bin traurig :'(");
    callback(props);
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
        console.log("queryGame found ");
        if (arr === undefined || arr.length !== 1) throw ("queryGame exception");
        for (var i = 0; i < arr.length; i++) { // no idea why i did a for loop cause it shouldn't actually have more than 1.
          var game = arr[i];
          for (var pid in game.players) {
            var player = game.players[pid];
            console.log("looking for player with pid " + user.fbid + " currently looking at ", player);
            if (player.fbid === user.fbid) {
              p = player;
              p.fbid = user.id;
              p.myTurn = (p.playerNumber === game.currentTurn);
            }
          }
        }
        callback(p);
      });
    });
  });
}

function socketsInGame(gameid, cxn, callback) {
  console.log("socketsInGame: gameid=" + gameid + " cxn=" + cxn);
  client.collection(cxn, function(error, collect) {
    if (error) throw error;
    collect.find({gameInProgress: gameid}).toArray(function(err, arr) {
      if (err) throw err;
      if (arr === undefined || arr.length === 0) {
        callback([]);
      } else {
        callback(arr);
      }
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
        collec.update({id: obj.id}, { $set : {socketid : obj.socketid }}, 
          function(err) {
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

function updateCurrentGame(playerid, gameid, callback) {
  console.log("updating player + " + playerid + " with game id " + gameid);
  client.collection("users", function(error, users) {
    if (error) throw error;
    users.update({fbid: playerid}, {$set : {gameInProgress: gameid} } , function(error) {
      if (error) throw error;
      if (callback) callback();
      console.log("successfully updated gameinprogress");
    });
  });
}

// save's a game's current state to the databse. Overwrites
// a games previous state if it existed.
function saveGame(game, callback) {
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
      if (callback) callback();
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
    retry = 5;
    var game = currentGames[data.gameID];
    if (game !== undefined && game.host === undefined) {
      game.host = monopoly.newPlayer(data.username, data.fbid);
      console.log(game.host);
      game.numPlayers++;
      game.host.playerNumber = (game.numPlayers - 1); //ie 0 indexed.
      game.host.gameInProgress = game.id;
      game.players[data.fbid] = game.host;
      updateCurrentGame(data.fbid, game.id, function() {
        socket.emit('hostgame', { 
          success: true,
          gameID: game.id
        });
        saveGame(game);
      });
    }
  });

  socket.on('joingame', function (data) {
    retry = 5;
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
          saveGame(game, function() {
            updateCurrentGame(data.fbid, game.id, function() {
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
            });
          });
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

  
  socket.on('boardjoin', function (data) {
    connections[socket.id] = socket;
    var gameFound = false;
    for (var gameID in currentGames) {
      var game = currentGames[gameID];
      if (game.code === data.code) {
        gameFound = true;
        game.numBoards++;
        var boardID = shortID.generate();
        var board = monopoly.newBoard(boardID);
        board.socketid = socket.id;
        board.gameInProgress = game.id;
        game.boards[boardID] = board;
        saveGame(game, function(){
          saveObjectToDB("boards", board, function() {
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
          });
        });
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
        saveGame(game, function(){
          sendToPlayers(data.gameID, 'playerleft',  {
            gameID: game.id
          });
          sendToBoards(data.gameID, 'playerleft', {
            gameID: game.id
          });
        })
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
  
  socket.on('gameChat', function(data) {
    queryGame(socket.id, function (game) {
      sendToBoards(data.gameID, 'chatmessage', {
        fbid: data.fbid,
        message: data.message
      });
    });
  }

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

  socket.on('getProperties', function() {
    getPropertiesForGame(socket.id, function(props) {
      socket.emit('getProperties', props);
    });
  });

  socket.on('getMyProperties', function() {
    getPropertiesForGame(socket.id, function(props) {
      queryPlayer(socket.id, function(player) {
        socket.emit('getMyProperties', player.properties);
      });
    });
  });
  
  socket.on('boardReconnect', function (data) {
    var boar = monopoly.newBoard(data.id);
    boar.socketid = socket.id;
    saveObjectToDB('boards', boar, function() {
      queryBoard(socket.id, function (board) {
        boar.gameInProgress = board.gameInProgress;
        socket.emit('boardReconnect', {
          success: true,
          gameID: board.gameInProgress
        });   
      });
    });
  });
  
  socket.on('houseBuy', function(data) {
    console.log('trying to buy a house, yo');
    handleConstruction(data.space, socket.id, data.fbid);
    //todo emit?
  });
  
  socket.on('houseSell', function(data) {
    console.log('trying to sell a house, yo');
    handleDemolition(data.space, socket.id, data.fbid);
  });
  
  socket.on('diceroll', function(data) {
    console.log('diceroll??');
    handleRoll(data.result, data.doubles, socket.id, data.fbid);
    console.log("We got a roll of " + data.result + " from socket " + socket.id);
    socket.emit('diceroll', {success: (data.result !== undefined)});
  });
  
  socket.on('propertyBuy', function (data) {
    if (data.result) {
      handleSale(data.space, socket.id, data.fbid);
    }
    else {
      queryGame(socket.id, function (game) {
        endTurn(game);
      });
    }
  });

  socket.on('propertyMortgage', function (data) {
    queryGame(socket.id, function (game) {
      console.log("Got the game, now going to try and mortgage");
      var owner = game.propertyOwners[data.space];
      if (owner !== data.fbid) {
        console.log("Well shit, you're trying to mortgage something you don't own!");
        propertyMortgage(game, prop, socket.id, data.fbid, false);
      } else {
        var prop = game.players[data.fbid].properties[data.space];
        if (prop.mortgaged === true) {
          propertyMortgage(game, prop, socket.id, data.fbid, false);
          return;
        }
        console.log("Mortgaging the property");
        prop.mortgaged = true;
        credit(game, socket.id, prop.card.price / 2, data.fbid);
        propertyMortgage(game, prop, socket.id, data.fbid, true);
      }
    });
  });
  
  socket.on('propertyUnmortgage', function(data) {
    queryGame(socket.id, function (game) {
      var owner = game.propertyOwners[data.space];
      if (owner !== data.fbid) {
        console.log("Oh I KNOW you didn't just try to unmortgage someone else's property.");
        propertyUnmortgage(game, prop, socket.id, data.fbid, false);
      } else {
        var prop = game.players[data.fbid].properties[data.space];
        if (prop.mortgaged === false ||  // isn't mortgaged
            game.players[data.fbid].money < (prop.card.price / 2) * 1.10) { 
              // not enough money
          console.log("It's either ummortgaged or we don't have enough money");
          propertyUnmortgage(game, prop, socket.id, data.fbid, false);
          return;
        }
        console.log("Unmortgaging the property");
        prop.mortgaged = false;
        debit(game, socket.id, (prop.card.price / 2) * 1.10, data.fbid);
        propertyUnmortgage(game, prop, socket.id, data.fbid, true);
      }
    });
  });

  socket.on('boardstate', function (data) {
    queryGameFromBoard(socket.id, function (game) {
      socket.emit('boardstate', {
        success: true,
        game: game
      });
    })
  });
  
  socket.on('inspectProperty', function (data) {
    // route request to the boards
    queryGame(socket.id, function (game) {
      sendToBoards(game.id, 'inspectProperty', data);
    });
  });
  
  socket.on('getOutOfJail', function (data) {
    queryGame(socket.id, function (game) {
      if (data.paid) {
        debit(game, socket.id, 50, data.fbid);
        game.players[data.fbid].jailed = false;
      } else {
        var card = game.players[data.fbid].jailCards.shift();
        game.players[data.fbid].jailed = false;
        if (card === "chance") {
          chanceCommChestDeck.returnChanceJailCard(game);
        } else {
          chanceCommChestDeck.returnCommChestJailCard(game);
        }
      }
      sendToBoards(game.id, 'getOutOfJail', { fbid: data.fbid });
      socket.emit('getOutOfJail', {});
      saveGame(game);
    });
  });
  
  socket.on('serveJailTime', function (data) {
    queryGame(socket.id, function (game) {
      game.players[data.fbid].jailTime++;
      saveGame(game);
    });
  });
  
  socket.on('disconnect', function() {
    delete connections[socket.id];
  });

  /*
  socket.on('disconnect', function () {
    // If the player was in a game, remove them from it
    console.log("trying to disconnect user");
    queryUser(socket.id, function(user) {
      try {
        if (user === undefined) {
          throw "user not found";
        }
        queryGame(socket.id, function(game) {
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
            console.log("player disconnected: " + socket.id)
          }
        });
      } catch (err) {
        // If no user found, query for boards
        console.log("catching error", err);
        queryBoard(socket.id, function (board) {
          if (board === undefined) {
            console.log("no board found, whatevs.");
          } else {
            console.log("board disconnected: " + socket.id);
          }
        });
      } finally {
        delete connections[socket.id];
      }
    });
  });
  */
});


// MORE FUNCTIONS
function endTurn(game) {
  var previd;
  for (var index in game.players) {
    if (game.players[index].playerNumber === game.currentTurn) {
      previd = game.players[index].fbid;
    }
  }
  
  if (!game.doubles) {
    game.currentTurn = ((game.currentTurn + 1) % game.numPlayers);
  }
  
  var fbid;
  for (var index in game.players) {
    if (game.players[index].playerNumber === game.currentTurn) {
      fbid = game.players[index].fbid;
    }
  }
  
  if (fbid === undefined) throw ("endTurn exn", game.currentTurn);
  saveGame(game, function(){
    sendToBoards(game.id, 'nextTurn', {
      previd: previd,
      fbid: fbid
    });
    sendToPlayers(game.id, 'nextTurn', {fbid: fbid});
  });
}

function passGo(game, socketid,fbid) {
  credit(game, socketid, 200, fbid);
  connections[socketid].emit('passGo!', {
    fbid: fbid,
    money: game.players[fbid].money,
    amount: 200,
    reason: "passing Go!"
  });
  sendToBoards(game.id, 'credit', {
    fbid: fbid,
    amount: 200,
    money: game.players[fbid].money,
    reason: "passing Go!"
  });
}

function handleSale(space, socketid, fbid) {
  queryGame(socketid, function(game) {
    var prop;
    for (var index in game.availableProperties) {
      if (game.availableProperties[index] &&
        game.availableProperties[index].id === space) {
        prop = game.availableProperties[index];
        delete game.availableProperties[index];
      }
    }
    console.log("I a gonna changa die monezzzz? " + game.players[fbid].money);
    debit(game, socketid, prop.card.price, fbid);
    console.log("Did da moniez change? " + game.players[fbid].money);
    prop.owner = game.players[fbid].username.split(" ")[0]; // get the first name
    game.players[fbid].properties[space] = prop;
    game.propertyOwners[space] = fbid;
    
    checkMonopoly(game, fbid, space);
    sendToBoards(game.id, 'propertySold', {
      property : space,
      propName: prop.card.title,
      fbid: fbid,
      money: game.players[fbid].money
    });
    endTurn(game);
  });
}

function handleRoll(delta, dbls, socketid, fbid) {
  queryGame(socketid, function(game){
    console.log("Handling roll for player ", game.players[fbid]);
    console.log("Found a game??", game.id);
    game.doubles = dbls;
    if (game.players[fbid].jailed) {
      if (dbls) {
        sendToBoards(game.id, 'getOutOfJail', { fbid: fbid });
        game.players[fbid].jailed = false;
      } else {
        sendToBoards(game.id, 'stayInJail', { fbid: fbid });
        endTurn(game);
        return;
      }
    }
    var initial = game.players[fbid].space;
    game.players[fbid].space = ((game.players[fbid].space + delta) % 40);
    sendToBoards(game.id, 'movePlayer', {
      fbid: fbid, 
      player: game.players[fbid].playerNumber,
      initial: initial,  
      delta : delta, 
      end: game.players[fbid].space 
    });
    // saveGame(game);
    if (game.players[fbid].space < delta) passGo(game, socketid,fbid);
    handleSpace(game, socketid, game.players[fbid].space, fbid, delta);
  });
}

function ensureBuildingParity(game, space, fbid, buildFlag) { //buildFlag is true when adding a house, false when selling a house
  var delta = 1;
  if (!buildFlag) delta = -1;  
  var prop = game.players[fbid].properties[space]; 
  if ((prop === null) || (prop === undefined)) return false; //wat.
  
  var target = (game.players[fbid].properties[space].numHouses + delta)
  if (prop.hotel) {
    target = target+5;
  } 
  
  var colors = [[1,3],[6,8,9],[11,13,14],[16,18,19],[21,23,24],[26,27,29],[31,32,34],[37,39]];
  var group = _.reduce(colors, function(l, r) { 
    if (_.contains (l, space)) return l; 
    if (_.contains (r, space)) return r;
    return [];
  }, []);
  if (group.length === 0) {return false;} //catch the case where we're checking for monopoly of railroads or somesuch.
  for (var spaceid in group) {
    var temp = game.players[fbid].properties[group[spaceid]].numHouses;
    if (game.players[fbid].properties[group[spaceid]].hotel) temp = (temp+5);
    if ((Math.abs(target - temp)) > 1) {
      return false;
    }
  }
  return true;
}

function handleConstruction(space, socketid, fbid){
  queryGame(socketid, function(game) {
    console.log('handling construction case');
    var prop = game.players[fbid].properties[space];
    if ((prop === undefined) || (prop === null)) { 
      connections[socketid].emit('houseBuy', {
        space: space, 
        fbid: fbid, 
        success: false, 
        reason: 'no ownership'
      });
      return;
    }
    if ((prop.monopoly) && (!prop.hotel)) { //able 
      if (!ensureBuildingParity(game, space, fbid, true)) {
        connections[socketid].emit('houseBuy', {
          space: space, 
          fbid: fbid, 
          success: false, 
          reason: 'not building evenly'
        });
        return;
      }
      if (prop.numHouses === 4) { //buying a hotel
        if (game.availableHotels > 0) {   
          var cost = prop.card.hotelcost;
          var suc = debit(game, socketid, cost, fbid);
          if (suc) {
            game.availableHotels = (game.availableHotels - 1);
            game.availableHouses = (game.availableHouses + 4);
            prop.numHouses = 0;
            prop.hotel = true;
            saveGame(game, function () { 
              connections[socketid].emit('houseBuy', {
                space: space, 
                fbid: fbid, 
                success: true
              });
              sendToBoards(game.id, 'hotelBuy', {
                space: space,
                propName: prop.card.title,
                money: game.players[fbid].money,
                fbid: fbid, 
                success: true
              });
            });
          } else {
            connections[socketid].emit('houseBuy', {
              space: space, 
              fbid: fbid, 
              success: false, 
              reason: 'no money'
            });
          }
        } else {
          connections[socketid].emit('houseBuy', {
            space:space, 
            fbid: fbid, 
            success: false, 
            reason: 'no hotels left'
          });
        }
      } else {
        if (game.availableHouses > 0) {
          var cost = prop.card.housecost;
          var suc = debit(game, socketid, cost, fbid);  
          if (suc) {
            game.availableHouses = (game.availableHouses - 4);
            prop.numHouses = (prop.numHouses + 1);
            saveGame(game, function () { 
              connections[socketid].emit('houseBuy', {
                space: space, 
                fbid: fbid, 
                success: true
              });
              sendToBoards(game.id, 'houseBuy', {
                space: space,
                propName: prop.card.title,
                money: game.players[fbid].money,
                fbid: fbid, 
                success: true
              });
            });
          } else {
            connections[socketid].emit('houseBuy', {
              space:space, 
              fbid: fbid, 
              success: false, 
              reason: 'no money'
            });
          }
        } else { 
          connections[socketid].emit('houseBuy', {
            space: space, 
            fbid: fbid, 
            success: false, 
            reason: 'no houses left'
          });
        }   
      } 
    } else {
      connections[socketid].emit('houseBuy', {
        space: space, 
        fbid: fbid, 
        success: false, 
        reason: 'already hotel or no monopoly'
      });
    }
  });
}

function handleDemolition(space, socketid, fbid) {
  queryGame(socketid, function(game) {
    console.log('handling demolition case');
    var prop = game.players[fbid].properties[space];
    if ((prop === undefined) || (prop === null)) { 
      connections[socketid].emit('houseSell', {
        space: space, 
        fbid: fbid, 
        success: false, 
        reason: 'no ownership'
      });
      return;
    }
    if ((prop.monopoly) && ((prop.numHouses > 0)||(prop.hotel))) { //able     
      if (!ensureBuildingParity(game, space, fbid, false)) {
        connections[socketid].emit('houseSell', {
          space: space, 
          fbid: fbid, 
          success: false, 
          reason: 'not demolishing evenly'
        });
        return;
      }
      if (prop.hotel) { //selling a hotel
        var amt = (prop.card.hotelcost / 2);
          if (game.availableHouses > 3) {
            credit(game, socketid, amt, fbid);
            game.availableHotels = (game.availableHotels + 1);
            game.availableHouses = (game.availableHouses - 4);
            prop.numHouses = 4;
            prop.hotel = false;
            saveGame(game, function () { 
              connections[socketid].emit('houseSell', {
                space: space, 
                fbid: fbid, 
                success: true
              });
              sendToBoards(game.id, 'hotelSell', {
                space: space,
                propName: prop.card.title,
                money: game.players[fbid].money,
                fbid: fbid, 
                success: true
              });
            });            
          } else {
            connections[socketid].emit('houseSell', {
              space: space, 
              fbid: fbid, 
              success: false, 
              reason: 'not enough houses to sell a hotel'
            });
          }
      } else {
        var amt = (prop.card.housecost/2);
        credit(game, socketid, amt, fbid);  
        game.availableHouses = (game.availableHouses + 1);
        prop.numHouses = (prop.numHouses - 1);
        saveGame(game, function () { 
          connections[socketid].emit('houseSell', {
            space: space, 
            fbid: fbid, 
            success: true
          });
          sendToBoards(game.id, 'houseSell', {
            space: space,
            propName: prop.card.title,
            money: game.players[fbid].money,
            fbid: fbid, 
            success: true
          });
        });    
      }   
    } else {
      connections[socketid].emit('houseSell', {
        space: space, 
        fbid: fbid, 
        success: false, 
        reason: 'no monopoly or no building'
      });
    }
  });
}


//tyler's not going to like this function... 
function checkMonopoly(game, fbid, space) {
  var propertyOwners = game.propertyOwners;
  var colors = [[1,3],[6,8,9],[11,13,14],[16,18,19],[21,23,24],[26,27,29],[31,32,34],[37,39]];
  var group = _.reduce(colors, function(l, r) { 
    if (_.contains (l, space)) return l; 
    if (_.contains (r, space)) return r;
    return [];
  }, []);
  if (group.length === 0) {return false;} //catch the case where we're checking for monopoly of railroads or somesuch.
  var first = propertyOwners[group[0]];       
  var result = _.every(group, function(z) { 
    return (propertyOwners[z] === first);
  });
  if (result) {
    for (var index in group) {
      game.players[fbid].properties[group[index]].monopoly = true;
    }
  }
}

// thedrick - this is kind of ugly, but apparently map is relatively new?
// I was going to port this to a map reduce, but this is fine.
function isOwnable(space) {
  console.log("inside is ownable with space " + space);
//todo actually port this to map/reduce -pmarino
  var properties = [1,3,6,8,9,11,13,14,16,18,19,21,23,24,26,27,29,31,32,34,37,39]
  var railroads = [5,15,25,35]
  var utilities = [12,28]
  var total = properties.indexOf(space) + railroads.indexOf(space) + utilities.indexOf(space);
  return (total > -3);
}

function isChance(space) {
  return (space === 7 || space === 22 || space === 36);
}
function isCommChest(space) {
  return (space === 2 || space === 17 || space === 33);
}
function isTax(space) {
  return (space === 4 || space === 38);
}
function isCorner(space) { 
  return (space % 10 === 0);
}

function isRailroad(space) {
  return ((space % 5 === 0) && (space % 10 !== 0) && (space !== 0));
}

function numRailroadsOwned(game, owner) {
  var railroads = [5,15,25,35];
  var result = 0;
  railroads.forEach(function (space) {
    if (game.propertyOwners[space] === owner) {
      result++;
    }
  });
  return result;
}

function isUtility(space) {
  return (space === 12 || space === 28);
}

function isUtilityMonopoly(game, owner, space) {
  if (space === 12) {
    return (game.propertyOwners[28] === owner);
  }
  else if (space === 28) {
    return (game.propertyOwners[12] === owner);
  }
  return false;
}

function isOwned(game, space) {
  console.log("inside is owned with space " + space);
  var avails = game.availableProperties;
  for (var idx in avails) {
    if (avails[idx] && avails[idx].id === space) { 
      return false;
    }
  }
  return true;
}

function isOwnedByOther(game, space, fbid) {
  return (isOwned(game, space)) && 
    (game.propertyOwners[space] !== game.players[fbid]);
}

function collectRent(game, space, socketid, tenant, roll) { 
  var owner = game.propertyOwners[space];
  var property;
  var amt, atom;
  
  // Get property at the space landed on
  for (var ind in game.players[owner].properties) {
    if (game.players[owner].properties[ind]) {
      if (game.players[owner].properties[ind].id === space) 
        property = game.players[owner].properties[ind];
    }
  } 
  
  // Error checking
  if (property === undefined) throw "property undefined";
  
  // Figure out amount to pay based on the space.
  if (isUtility(space)) {
    if (isUtilityMonopoly(game, owner, space)) {
      // rent is 10x the roll.
      amt = 10 * roll;
    } else {
      // rent is 4x the roll.
      amt = 4 * roll;
    }
  } else if (isRailroad(space)) {
    var numRailroads = numRailroadsOwned(game, owner);
    switch (numRailroads) {
      case 1:
        amt = 25;
        break;
      case 2:
        amt = 50;
        break;
      case 3:
        amt = 100;
        break;
      case 4:
        amt = 200;
        break;
      default:
        throw "more than 4 railroads? Wait, maybe you have 0 railroads. trololol.";
    }
  } else {
    switch(property.numHouses) {
      case 0:
        amt = property.card.rent;
        if (property.mortgaged) {
          amt = 0;
        }
        if (property.monopoly) {
          amt = (property.card.rent * 2);
        }
        if (property.hotel) {
          amt = property.card.hotel;
        }
        break;   
      case 1: 
        amt = property.card.onehouse;
        break; 
      case 2: 
        amt = property.card.twohouse;
        break;
      case 3: 
        amt = property.card.threehouse;
        break;
      case 4: 
        amt = property.card.fourhouse;
        break;
      default:
        throw "err...more than 4 houses? wut";
    }
  }
  
  // Proceed with transaction
  // TODO: handle extraordinary conditions
  var exn = "atomicity exn, collectRent(" + game + ", " + space + ", " + socketid + ");";
  atom = debit(game, socketid, amt, tenant);
  if (atom) credit(game, socketid, amt, owner);
  else throw exn;
  
  connections[socketid].emit('payingRent', {
    owner: owner,
    tenant: tenant,
    space: space, 
    amount: amt,
    tenantMoney: game.players[tenant].money,
    ownerMoney: game.players[owner].money
  });
  sendToBoards(game.id, 'payingRent', {
    owner: owner,
    tenant: tenant,
    space: space, 
    amount: amt,
    tenantMoney: game.players[tenant].money,
    ownerMoney: game.players[owner].money
  });
  
  endTurn(game);
}

function propertyMortgage(game, property, socketid, fbid, success) {
  console.log("Mortgaging property " + property.id);
  var sock = connections[socketid];
  saveGame(game, function() {
    sock.emit('propertyMortgage', {
      property: property,
      fbid: fbid,
      success: success
    });
  });
}

function propertyUnmortgage(game, property, socketid, fbid, success) {
  var sock = connections[socketid];
  saveGame(game, function() {
    sock.emit('propertyUnmortgage', {
      property: property,
      fbid: fbid,
      success: success
    });
  });
}

function propertyBuy(game, property, socketid, fbid) {
  console.log("Trying to buy property " + property.id);
  var sock = connections[socketid];
  saveGame(game, function() {
    sock.emit('propertyBuy', {
    'property' : property, 
    fbid: fbid
    }); //naming convention?
  });
}

function sendToJail(game, socketid, fbid) {
  var jail = 10;
  var initial = game.players[fbid].space;
  game.players[fbid].space = jail;
  game.players[fbid].jailed = true;
  sendToBoards(game.id, 'goToJail', {
    fbid: fbid,
    initial: initial
  });
  connections[socketid].emit('goToJail', {
    reason: "Go to Jail"
  });
}

function handleTax(game, space, socketid, fbid){
  var amt;
  if (space === 38) {
    amt = 75;
    debit(game, socketid, amt, fbid); 
    sendToBoards(game.id, 'debit', {
      fbid: fbid,
      amount: amt,
      money: game.players[fbid].money,
      reason: "Luxury Tax"
    });
  } else if (space === 4) {
    // always take away 200
    // TODO: don't always take away 200
    amt = 200;
    debit(game, socketid, amt, fbid); 
    sendToBoards(game.id, 'debit', {
      fbid: fbid,
      amount: amt,
      money: game.players[fbid].money,
      reason: "Income Tax"
    });
  } else {
    throw "should not have called this";
  }
}

function handleSpace(game, socketid, space, fbid, roll) {
  console.log("inside handle space with space " + space);
  if (isOwnable(space)) {
    if (isOwnedByOther(game, space, fbid)) {
      collectRent(game, space, socketid, fbid, roll);
    } else if (!isOwned(game, space)) {
      propertyBuy(game, game.availableProperties[space], socketid, fbid);
    }
  }
  if (isCorner(space)) {
    if (space === 0) {
      credit(game,socketid,200, fbid);
      sendToBoards(game.id, 'credit', {
        fbid: fbid,
        amount: 200,
        money: game.players[fbid].money,
        reason: "landing on Go"
      });
      // do we want double money for landing on go???
    }
    if (space === 20) {
      credit(game,socketid,500, fbid);
      sendToBoards(game.id, 'credit', {
        fbid: fbid,
        amount: 500,
        money: game.players[fbid].money,
        reason: "landing on Free Parking"
      });
      // do we want free parking to be a straight $500??
    }
    if (space === 30) {
      sendToJail(game, socketid, fbid);
    }
    endTurn(game);
  }
  if (isChance(space)) {
    handleChance(game, socketid, fbid);
    endTurn(game);
  }
  if (isCommChest(space)) {
    handleCommChest(game, socketid, fbid);
    endTurn(game);
  }
  if (isTax(space)) {
    handleTax(game, space, socketid, fbid);
    endTurn(game);
  }
}

function handleChance(game, socketid, fbid) {
  chanceCommChestDeck.drawChance(game, function(card) {
    var id = card.id;
    console.log(card.text);
    sendToBoards(game.id, 'chance', {
        fbid: fbid,
        text: card.text
    });
    if (id < 5) { //advance type cards
      var initial = game.players[fbid].space;
      var end = card.space;
      game.players[fbid].space = card.space; 
      var delta = ((end-initial) % 40)
      if (end < initial) {
        passGo(game, socketid, fbid);
      }
      sendToBoards(game.id, 'movePlayer', {
        fbid: fbid, 
        player: game.players[fbid].playerNumber,
        initial: initial,  
        delta : delta, 
        end: end 
      });
    } else if (id === 5) { //send to jail card
      sendToJail(game, socketid, fbid);
    } else if (id < 9) { // credit type cards
      credit(game, socketid, card.amt, fbid);
      sendToBoards(game.id, 'credit', {
        fbid: fbid, 
        amount: card.amt,
        money: game.players[fbid].money,
        reason: "Chance."
      });
    } else if (id === 9) { //has since been removed.
      console.log("this isn't a thing.");
    } else if (id < 11) { //debit type cards
     var amt = Math.abs(card.amt);
     var success = debit(game, socketid, amt, fbid);
      if (success){
        sendToBoards(game.id, 'debit', {
          fbid: fbid,
          amount: amt,
          money: game.players[fbid].money,
          reason: "Chance."
        });
      }
    } else if (id === 11) { //go back 3 spaces
      var initial = game.players[fbid].space;
      var newspace = ((game.players[fbid].space - 3) % 40);
      game.players[fbid].space = newspace;
      sendToBoards(game.id, 'movePlayer', {
        fbid: fbid, 
        player: game.players[fbid].playerNumber,
        initial: initial,  
        delta : -3, 
        end: newspace 
      });    
    } else if (id === 12) { //GOoJF card
      game.players[fbid].jailCards.push('chance');
      connections[socketid].emit('jailCard', {
        fbid: fbid,
        type: 'Chance'      
      });
    } else console.log('chance card out of bounds'); 
  });
}

function handleCommChest(game, socketid, fbid) {
  chanceCommChestDeck.drawCommChest(game, function(card) {
    var id = card.id;
    console.log(card.text);

    sendToBoards(game.id, 'commChest', {
        fbid: fbid,
        text: card.text
    });
    if (id === 0) { //advance type cards  
      var initial = game.players[fbid].space;
      game.players[fbid].space = ((game.players[fbid].space + delta) % 40);
      var end = card.space;
      game.players[fbid].space = card.space;
      var delta = ((end-initial) % 40)
      if (end < initial) {
        passGo(game, socketid, fbid);
      }
      sendToBoards(game.id, 'movePlayer', {
        fbid: fbid, 
        player: game.players[fbid].playerNumber,
        initial: initial,  
        delta : delta, 
        end: end 
      });
    } else if (id < 10) { // credit type cards
      credit(game, socketid, card.amt, fbid);
      sendToBoards(game.id, 'credit', {
        fbid: fbid, 
        amount: card.amt,
        money: game.players[fbid].money,
        reason: "Community chest."
      });
    } else if (id < 12) { //debit type cards
      var amt = Math.abs(card.amt);
      var success = debit(game, socketid, amt, fbid);
      if (success){
        sendToBoards(game.id, 'debit', {
          fbid: fbid,
          amount: amt,
          money: game.players[fbid].money,
          reason: "Community chest."
        });
      }
    } else if (id === 12) { //GOoJF card
      game.players[fbid].jailCards.push('commChest');
      connections[socketid].emit('jailCard', {
        fbid: fbid,
        type: 'Community Chest'      
      });
    } else console.log('commChest card out of bounds');
  });
}

function credit(game,socketid, amt, fbid) {
  game.players[fbid].money = game.players[fbid].money + amt;
  //need to ensure atomicity later on probably...  
  connections[socketid].emit('credit', {fbid : fbid, amt: amt});
}

function debit(game, socketid, amt, fbid) {
  if (game.players[fbid].money - amt < 0) {
    //handle mortgage conditions, loss conditions, etc;
    return false; // not enough money;
  } else {
    game.players[fbid].money = Number(Number(game.players[fbid].money) - Number(amt));
    connections[socketid].emit('debit', {fbid : fbid, amt: amt});
    return true;
  }
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
  saveGame(game, function() {
    sendToPlayers(gameID, 'gameReady', {});
    sendToBoards(gameID, 'gameReady', {});
    delete currentGames[gameID];
  });
}

function sendToPlayers(gameID, emitString, emitArgs) {
  socketsInGame(gameID, 'users', function(sockets) {
    for (var i = 0; i < sockets.length; i++) {
      if (connections[sockets[i].socketid] !== undefined)
        connections[sockets[i].socketid].emit(emitString, emitArgs);
    }
  });
} 

// TODO This needs to actually send stuff to the baord and like we should
// have the right sockets for boards and stuff. - thedrick
function sendToBoards(gameID, emitString, emitArgs) {
  socketsInGame(gameID, 'boards', function(sockets) {
    for (var i = 0; i < sockets.length; i++) {
      if (connections[sockets[i].socketid] !== undefined)
        connections[sockets[i].socketid].emit(emitString, emitArgs);
    }
  });
}

function sendToOthers(gameID, emitString, emitArgs, senderID) {
  socketsInGame(gameID, 'users', function(sockets) {
    for (var i = 0; i < sockets.length; i++) {
      if (sockets[i].socketid !== senderID) {
        if (connections[sockets[i].socketid] !== undefined)
          connections[sockets[i].socketid].emit(emitString, emitArgs);
      }
    }
  });
}
