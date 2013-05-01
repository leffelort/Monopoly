// 15-237 Final Project: Monopoly
// by Andrew Mittereder, Peter Marino, Tyler Hedrick
// 30 April 2013

/*
 * Notes: Please note that a 'user' represents specifically
 * someone who is connected to the game, and is primarily used 
 * when handline game genesis and when referring to socket info. 
 * A 'player' represents the person's in game information, such 
 * as their money and properties.  
 */

// ========================
// == Globals & Includes ==
// ========================
var shortID = require("shortid");
var monopoly = require("./monopoly.js");
var phoneCodeGen = require("./phoneCodeGen.js"); //written by amittere
var _ = require("underscore");
//sometimes mongo needs a few chances to get it right. 
var retry = 5; 
var boardretry = 5;
// Map of game id's to pending games
var currentGames = {};

// ========================
// ==== Express server ====
// ========================
var express = require("express");
var useragent = require("express-useragent");
var app = express();
var fs = require("fs");

app.use(express.bodyParser());
app.use(useragent.express());

//Allows the server to route top level domain
//requests to the correct platform page.
app.get('/', function (req, res) {
  if (req.useragent.isMobile) {
    res.sendfile("mobile.html");
  }
  else {
    res.sendfile("desktop.html");
  }
});

/* AJAX Calls are used when sockets can't be --
 * eg when pages are redirecting and such 
 */ 
app.configure(function(){
  app.use(express.static(__dirname));
});

/* hostgame allows for the creation of a newgame
 * on the clientside.
 */
app.post("/hostGame", function (req, resp) {
  var gameName = req.body.gameName;
  var numPlayers = Number(req.body.numPlayers);
  var gameID = shortID.generate();
  var phoneCode = phoneCodeGen.generate();
  currentGames[gameID] = monopoly.newGame(gameID, phoneCode, gameName,
    numPlayers);
  getPropertiesFromDatabase(function (arr) {
    for (var i = 0; i < 40; i++) {
      var card = arr[i];
      if (card) {
        var prop = monopoly.newProperty(card);
        currentGames[gameID].availableProperties[card.space] = prop;
      }
    }
  });
  resp.send({
    success: true,
    id: gameID
  });
});

/* returns a specfic game's information for use 
 * when users are joining & hosting games.
 */
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

// Return a list of all properties.
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

/*
 * The below is all functions that allow for the 
 * database to be connected to and the functions 
 * that we use to manipulate it throughout. 
 */ 

var MongoClient = require('mongodb').MongoClient;

var mongoUri = process.env.MONGOURI || "mongodb://cmuopoly:dp32Kx102Y7ol3Q5_GleoWlDgmFb1m2Tm51jiVyeQi4-@ds041157.mongolab.com:41157/cmuopoly";
var dbIsOpen = false;
var client = undefined;
var chanceCommChestDeck = undefined;
console.log("Your MONGOURI is ", mongoUri);
MongoClient.connect(mongoUri, {
    db: {},
    server: {
      auto_reconnect: true,
      socketOptions: {
        keepAlive: 60,
        socketTimeoutMS: 200000
      }
    },
    replSet: {},
    mongos: {}
  }, function (err, db) {
  if (err)
    throw err;
  console.log("successfully connected to the database");
  client = db;

  dbIsOpen = true;
  
  /* The below was for cleaning the database out 
   * during dev and testing. Remains to ensure these 
   * collections can be opened.    
   */
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

/*
 * queryUser() takes a socketid in order to find
 * the User object in the database that corresponds 
 * to this socket. Often we get socket events that we 
 * need to associate with a User in order to complete a task.
 * A callback assures no race conditions.
 */
function queryUser(sockid, callback) {
  if (retry <= 0) { //can't find anything
    callback(undefined);  
    //pass back undefined and error check on the other end.
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

/*
 * queryBoard() acts as above in queryUser, but with
 * the boards collection instead. 
 */
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

/*
 *  queryGame() is similar to the above.
 *  Almost always, when we get a socket event
 *  we need to change the game state, so we begin
 *  by querying for that game in the games collection.
 */
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

/*
 * queryGameFromBoard() is a partner function to
 * the one above -- sometimes it's a mobile client sending
 * us a socketevent, sometimes it's a board  client.
 */
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

/*
 * Aptly, getPropertiesForGame() gets the list 
 * of ALL property objects for a given game.
 * (this includes their house info, etc). Used in inspect.
 */
function getPropertiesForGame(sockid, callback) {
  queryGame(sockid, function(game) {
    //union the properties that are still available (unowned)
    //with the ones owned by each player.
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
/*
 * queryPlayer() is needed for getting player information, but 
 * in order to avoid difficulties with saving, race conditions, &etc,
 * we only edit player information within its specific game object
 * and so this function is never used when updating player info.
 */ 
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

/*
 * socketsInGame() allows us to return all objects
 * in a collection that have their gameid the same as given.
 * This allows us to access other sockets besides the 
 * player who is currently moving. 
 */
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

/*
 * getPropertiesFromDatabase() merely returns
 * the property info contained on each card
 * and as such, is used to build the availableProprties[] 
 * at the beginning of each game.  
 */
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

/*
 * saveObjectToDB() saves an object to a general collection. 
 * If the object already exists (in the case of users,boards)
 * it updates the existing object with the new socketid.
 */
function saveObjectToDB(collection, obj, cback) {
  console.log("saving object");
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
          cback();
        });
      } else if (obj.socketid !== undefined) {
        console.log("Updating socket id for obj: " + obj.socketid);
        collec.update({id: obj.id}, { $set : {socketid : obj.socketid }},
          function(err) {
          if (err)
            throw err;
          console.log("finished.");
          cback();
        });
      } else {
        console.log("object already exists in database");
        cback();
      }
    });
  });
}

/*
 * updateCurrentGame() allows us to update a user's object
 * that exist in the database with the game it is associated with. 
 */
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

/*
 * updateCurrentGameBoard() does the same as the above function,
 * but for board objects instead of user objects.  
 */
function updateCurrentGameBoard(boardid, gameid, callback) {
  console.log("updating board + " + boardid + " with game id " + gameid);
  client.collection("boards", function(error, boards) {
    if (error) throw error;
    boards.update({id: boardid}, {$set : {gameInProgress: gameid} } , function(error) {
      if (error) throw error;
      if (callback) callback();
      console.log("successfully updated gameinprogress");
    });
  });
}

/*
 * saveGame() takes a game, which it then saves to the database
 * and overwrites any existing save information for that game.
 * It takes a callback to eliminate the chance of race conditions. 
 */
function saveGame(game, callback) {
  console.log("saving game");
  client.collection("games", function(error, games) {
    if (error) throw error;
    games.find({id: game.id}).toArray(function(error, arr) {
      if (error) throw error;
      if (arr.length === 0) {
        games.insert(game, function(error, result) {
          if (error) throw error;
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

/*
 *  deleteGame() understandably deletes a game from the DB
 *  and is used when games end.
 */
function deleteGame(game) {
  client.collection("games", function(error, games) {
    if (error) throw error;
    games.remove({id: game.id}, function(error) {
      if (error) throw error;
      phoneCodeGen.return(game.code);
      delete game;
      console.log("successfully removed game from the database");
    });
  });
}

/*
 * closeDb() closes the database connection. 
 */
function closeDb() {
  dbIsOpen = false;
  client.close();
}


// ========================
// === Socket.io server ===
// ========================

/*
 * All of our socket server information, from getting
 * the server started to all of our socket event handlers. 
 */

var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);

// reduce unnecessary logging
if (process.env.NODE_ENV === "production") {
  io.set('log level', 1);
}
server.listen(process.env.PORT || 11611);

var connections = {}; //an array of socketid -> socket for all sockets
var socketToPlayerId = {};
var socketToBoardId = {};

io.sockets.on('connection', function (socket) {
  connections[socket.id] = socket; //save the socket
  
  /*
   * login handles the case where a user logs in
   * for the first time.   
   */
  socket.on('login', function (data) {
    userMaintain(socket, data, function() {
      socket.emit('login', { success: true });
    });
  });

  /*
   * handles the case when a user begins hosting a game. 
   */
  socket.on('hostgame', function (data) {
    retry = 5;
    var game = currentGames[data.gameID];
    if (game !== undefined && game.host === undefined) {
      game.host = monopoly.newPlayer(data.username, data.fbid);
      game.numPlayers++; 
      game.host.playerNumber = (game.numPlayers - 1); //because 0 indexed.
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

  /*
   * handles when a user joins an existing game. 
   */
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
          //success case, add them to the game.
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
              //Tell the other members of the game.
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

  /*
   * handles the case when a board joins an existing game. 
   */
  socket.on('boardjoin', function (data) {
    connections[socket.id] = socket;
    var gameFound = false;
    for (var gameID in currentGames) {
      var game = currentGames[gameID];
      if (game.code === data.code) {
        gameFound = true;
        game.numBoards++;
        var boardID = shortID.generate();
        //create unique identifier
        var board = monopoly.newBoard(boardID);
        board.socketid = socket.id;
        board.gameInProgress = game.id;
        game.boards[boardID] = board;
        socketToBoardId[socket.id] = boardID;
        saveGame(game, function(){
          saveObjectToDB("boards", board, function() {
            socket.emit('boardjoin', {
              success: true,
              gameID: game.id,
              boardID: board.id
            });
            //tell the other members of the lobby
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
  
  /*
   *  handles the (frequent) case where a user is redirected
   * and opens a new socket. this updates their user object.
   */
  socket.on('reopen', function (data) {
    userMaintain(socket, data, function() {
      queryGame(socket.id, function (game) {
        socket.emit('reopen', {
          success: true,
          inDefault: game.players[data.id].inDefault
        });
      })
    });
  });

  /*
   * handles the case where boards leave a game lobby
   */
  socket.on('boardleave', function (data) {
    var game = currentGames[data.gameID];
    if (game !== undefined) {
      delete game.boards[data.boardID];
      game.numBoards--;
      // If leaving board causes game to be un-startable, reset
      if (game.numBoards < 1) {
        game.playersWaiting = 0;
      }
      saveGame(game, function() {
        updateCurrentGameBoard(data.boardID, undefined, function () {
          sendToPlayers(data.gameID, 'boardleft', { gameID: game.id });
          sendToBoards(data.gameID, 'boardleft', { gameID: game.id });
        })
      });
    }
  });

  /*
   * handles the case where a user leaves a game lobby 
   */
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
        if (game.players[data.fbid].isWaiting) {
          game.playersWaiting--;
        }
        game.numPlayers--;
        delete game.players[data.fbid];
        // If leaving player causes game to be un-startable, reset
        if (game.numPlayers < 2) {
          game.playersWaiting = 0;
        }
        saveGame(game, function() {
          updateCurrentGame(data.fbid, undefined, function() {
            sendToPlayers(data.gameID, 'playerleft',  { gameID: game.id });
            sendToBoards(data.gameID, 'playerleft', { gameID: game.id });
          });
        });
      }
    }
  });

  /*
   * allows for players to say when they are ready to
   * begin -- when all players send this event, the game starts.   
   */
  socket.on('playerWaiting', function (data) {
    var username = data.username;
    var code = data.code;
    for (var gameID in currentGames) {
      var game = currentGames[gameID];
      if (game.code === data.code) {
        game.players[data.fbid].isWaiting = true;
        game.playersWaiting++;
        if ((game.playersWaiting === game.numPlayers) && (game.numPlayers > 1) && (!game.isStarted) && (game.numBoards > 0)) {
          //set playersWaiting = 0 not necessary because of start
          startGame(gameID);
        }
        saveGame(game);
      }
    }
  });

  /*
   * chatMessages that are sent during actual gameplay. 
   */
  socket.on('gameChat', function(data) {
    queryGame(socket.id, function (game) {
      sendToBoards(game.id, 'chatmessage', {
        fbid: data.fbid,
        message: data.message
      });
    });
  });

  /*
   * chatMessages that are sent during game creation
   */
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

  /*
   * returns a player's info for display on the mobileHome. 
   */
  socket.on('getme', function () {
    queryPlayer(socket.id, function(res){
      socket.emit('getme', res);
    });
  });

  /*
   * returns a list of all properties for the inspect view. 
   */
  socket.on('getProperties', function() {
    getPropertiesForGame(socket.id, function(props) {
      socket.emit('getProperties', props);
    });
  });

  /*
   * returns a list of properties owned by specific player for the manage view. 
   */
  socket.on('getMyProperties', function() {
    getPropertiesForGame(socket.id, function(props) {
      queryPlayer(socket.id, function(player) {
        socket.emit('getMyProperties', player.properties);
      });
    });
  });

  /*
   * handles the case when a board needs to refresh the page for some reason
   * and needs to have its socket info updated.   
   */
  socket.on('boardReconnect', function (data) {
    if (data.id !== undefined && data.id !== "") {
      var boar = monopoly.newBoard(data.id);
      boar.socketid = socket.id;
      socketToBoardId[socket.id] = data.id;
      saveObjectToDB('boards', boar, function() {
        queryBoard(socket.id, function (board) {
          boar.gameInProgress = board.gameInProgress;
          socket.emit('boardReconnect', {
            success: true,
            gameID: board.gameInProgress
          });
        });
      });
    } else {
      socket.emit('boardReconnect', { success: false });
    }
  });

  /*
   * handles the case where a player attempts to buy a house/hotel. 
   */
  socket.on('houseBuy', function(data) {
    console.log('trying to buy a house, yo');
    handleConstruction(data.space, socket.id, data.fbid);
  });

  /*
   * handles the case where a player attempts to sell a house/hotel. 
   */
  socket.on('houseSell', function(data) {
    console.log('trying to sell a house, yo');
    handleDemolition(data.space, socket.id, data.fbid);
  });

  /*
   * handles the case where someone rolls the dice. 
   */
  socket.on('diceroll', function(data) {
    handleRoll(data.result, data.doubles, socket.id, data.fbid);
    console.log("We got a roll of " + data.result + " from socket " + socket.id);
    socket.emit('diceroll', {success: (data.result !== undefined)});
  });

  /*
   * handles when a player has decided whether or not to buy the 
   * property they just landed on.   
   */
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

  /*
   * handles the case where a property is requested to be mortgaged. 
   */
  socket.on('propertyMortgage', function (data) {
    queryGame(socket.id, function (game) {
      console.log("Got the game, now going to try and mortgage");
      var owner = game.propertyOwners[data.space];
      if (owner !== data.fbid) {
        console.log("Well, you're trying to mortgage something you don't own!");
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

  /*
   * handles the case when a player wants to unmortgage something. 
   */
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
        var suc = debit(game, socket.id, (prop.card.price / 2) * 1.10, data.fbid);
        if (suc) propertyUnmortgage(game, prop, socket.id, data.fbid, true);
      }
    });
  });

  /*
   * gives back the state of the game to board client
   */
  socket.on('boardstate', function (data) {
    queryGameFromBoard(socket.id, function (game) {
      socket.emit('boardstate', {
        success: true,
        game: game
      });
    })
  });

  /*
   * gives back the state of the game to mobile client 
   */
  socket.on('getGame', function (data){
    queryGame(socket.id, function (game) {
      socket.emit('getGame', {
        game: game,
        success: true
      });
    });
  });

  /*
   * just lets the board know a mobile client is inspecting a property. 
   */
  socket.on('inspectProperty', function (data) {
    // route request to the boards
    queryGame(socket.id, function (game) {
      sendToBoards(game.id, 'inspectProperty', data);
    });
  });

  /*
   * route a trade request to the player in question. 
   */
  socket.on('tradeStart', function(data) {
    queryGame(socket.id, function(game) {
      socketsInGame(game.id, 'users', function (arr) {
        for (var i in arr) {
          if (arr[i].fbid === data.destfbid) {
            safeSocketEmit(arr[i].socketid, 'tradeStart', {
              originfbid: data.originfbid,
              destfbid: data.destfbid,
              requester: data.requester
            });
          }
        }
      });
    });
  });

  /*
   *  route the response to the trade request.
   */
  socket.on('tradeResponse', function(data) {
    queryGame(socket.id, function(game) {
      socketsInGame(game.id, 'users', function (arr) {
        for (var i in arr) {
          if (arr[i].fbid === data.originfbid) {
            safeSocketEmit(arr[i].socketid, 'tradeResponse', {
              destfbid: data.destfbid,
              originfbid: data.originfbid
            });
          }
        }
      });
    });
  });

  /*
   * handle the case when someone changes their trade offer and 
   * update the other party.   
   */
  socket.on('tradeUpdate', function(data) {
    queryGame(socket.id, function(game) {
      socketsInGame(game.id, 'users', function (arr) {
        var destsockid;
        var originsockid;
        for (var i in arr) {
          if (arr[i].fbid === data.destfbid) {
            destsockid = arr[i].socketid;
          }
          if (arr[i].fbid === data.originfbid) {
            originsockid = arr[i].socketid;
          }
        }
        console.log((!!connections[originsockid]));
        console.log((!!connections[destsockid]));
        updateTrade(originsockid, destsockid, data.tradeobj, data.agent);
      });
    });
  });

  /*
   * let the other player know the first player has canceled the trade.   
   */
  socket.on('tradeCancel', function(data){
    queryGame(socket.id, function(game) {
      socketsInGame(game.id, 'users', function(arr) {
        for (var i in arr) {
          if (arr[i].fbid === data.tofbid) {
            safeSocketEmit(arr[i].socketid, 'tradeCancel', {});
          }
        }
      });
    });
  });

  /*
   * route the final offer to the other party.  
   */
  socket.on('tradeFinalize', function(data) {
    queryGame(socket.id, function(game) {
      socketsInGame(game.id, 'users', function(arr) {
        for (var i in arr) {
          if (arr[i].fbid === data.tofbid) {
            safeSocketEmit(arr[i].socketid, 'tradeFinalize', {
              tradeobj: data.tradeobj
            });
          }
        }
      });
    });
  });

  /*
   * actually complete the trade and let both parties know it was successful. 
   */
  socket.on('tradeAccept', function(data) {
    queryGame(socket.id, function(game) {
      socketsInGame(game.id, 'users', function(arr) {
        handleTrade(game, data.tradeobj, data.originfbid, data.destfbid, socket.id);
        saveGame(game, function () {
          for (var i in arr) {
            if (arr[i].fbid === data.originfbid || 
                arr[i].fbid === data.destfbid) {
              safeSocketEmit(arr[i].socketid, 'tradeAccept', {});
            }
          }
          sendToBoards(game.id, 'tradeAccept', {
            originfbid: data.originfbid,
            destfbid: data.destfbid,
            tradeobj: data.tradeobj
          });
        });
      });
    });
  });
  
  /*
   *  route the rejection of the first party's trade to the second party.
   */
  socket.on('tradeReject', function(data) {
    queryGame(socket.id, function(game) {
      socketsInGame(game.id, 'users', function(arr) {
        for (var i in arr) {
          if (arr[i].fbid === data.tofbid) {
            safeSocketEmit(arr[i].socketid, 'tradeReject', {});
          }
        }
      });
    });
  });

  /*
   * handle the case when a player exits jail, whether that be via
   * goojf card or bail.   
   */
  socket.on('getOutOfJail', function (data) {
    queryGame(socket.id, function (game) {
      if (data.paid) {
        var suc = debit(game, socket.id, 50, data.fbid);
        if (suc) {
          game.players[data.fbid].jailed = false;
          game.players[data.fbid].jailTime = 0;
          sendToBoards(game.id, 'getOutOfJail', {
            fbid: data.fbid,
            debit: 50
          });
          socket.emit('getOutOfJail', { debit: 50 });
        } else console.log("can't pay for jail?");
      } else {
        var card = game.players[data.fbid].jailCards.shift();
        game.players[data.fbid].jailed = false;
        game.players[data.fbid].jailTime = 0;
        if (card === "chance") {
          chanceCommChestDeck.returnChanceJailCard(game);
        } else {
          chanceCommChestDeck.returnCommChestJailCard(game);
        }
        sendToBoards(game.id, 'getOutOfJail', {
          fbid: data.fbid,
          debit: 0
        });
        socket.emit('getOutOfJail', { debit: 0 });
      }
      saveGame(game);
    });
  });

  /*
   * handles the case where a player chooses to try to roll doubles to get
   * out of jail.   
   */
  socket.on('serveJailTime', function (data) {
    queryGame(socket.id, function (game) {
      game.players[data.fbid].jailTime++;
      saveGame(game);
    });
  });

  /*
   * deletes socket information if a socket disconnects. 
   */
  socket.on('disconnect', function () {
    console.log("trying to disconnect socket");
    var fbid = socketToPlayerId[socket.id];
    var boardid = socketToBoardId[socket.id];

    if (fbid !== undefined || boardid !== undefined) {
      for (var gameID in currentGames) {
        var game = currentGames[gameID];
        if (fbid !== undefined) {
          for (var pid in game.players) {
            if (fbid === pid) {
              // Remove them from the game if in the lobby
              if (!game.isStarted &&
                  !(game.numPlayers === game.playersWaiting)) {
                if (game.players[fbid] === game.host) {
                  console.log("going to delete because host left");
                  // If the host disconnected, delete the entire game
                  sendToOthers(gameID, 'hostleft', {}, socket.id);
                  sendToBoards(gameID, 'hostleft', {});
                  deleteGame(game);
                } else {
                  // Otherwise, the user leaves
                  if (game.players[fbid].isWaiting) {
                    game.playersWaiting--;
                  }
                  delete game.players[fbid];
                  game.numPlayers--;
                  saveGame(game, function() {
                    updateCurrentGame(fbid, undefined, function() {
                      sendToPlayers(gameID, 'playerleft',  { gameID: gameID });
                      sendToBoards(gameID, 'playerleft', { gameID: gameID });
                    });
                  });
                }
              }
            }
          }
        } else if (boardid !== undefined) {
          for (var bid in game.boards) {
            if (boardid === bid) {
              // Remove the board from the lobby
              delete game.boards[boardid];
              game.numBoards--;
              saveGame(game, function() {
                updateCurrentGameBoard(boardid, undefined, function () {
                  sendToPlayers(gameID, 'boardleft', { gameID: gameID });
                  sendToBoards(gameID, 'boardleft', { gameID: gameID });
                })
              });
            }
          }
        }
      }
    }
    delete socketToPlayerId[socket.id];
    delete socketToBoardId[socket.id];
    delete connections[socket.id];
  });
});

// ========================
// ==== Gameplay Logic  ===
// ========================

/*
 *  endTurn() checks a few last minute things such as number of dbls
 *  and who has the next turn, then saves the game and lets the
 *  board and players know who should go next.
 */
function endTurn(game) {
  var previd;
  for (var index in game.players) {
    if (game.players[index].playerNumber === game.currentTurn) {
      previd = game.players[index].fbid;
    }
  }
  if (!game.doubles || game.players[previd].jailed ||
      game.players[previd].wasJailed) {
    //logic for handling when a player rolls doubles thrice and 
    //is sent to jail for 'speeding'
    game.currentTurn = ((game.currentTurn + 1) % game.numPlayers);
    game.players[previd].numDbls = 0;
    game.players[previd].wasJailed = false;
  }
  var fbid;
  for (var index in game.players) {
    if (game.players[index].playerNumber === game.currentTurn) {
      fbid = game.players[index].fbid;
    }
  }
  if (fbid === undefined) throw ("endTurn exn", game.currentTurn);
  if (!game.players[fbid].bankrupt) {
    //if the player who deserves the next turn is bankrupt (out of
    //the game), then skip them and continue to the next person.
    saveGame(game, function(){
      sendToBoards(game.id, 'nextTurn', {
        previd: previd,
        fbid: fbid
      });
      sendToPlayers(game.id, 'nextTurn', {fbid: fbid});
    });
  } else endTurn(game);
}

/*
 * passGo() credits a person for passing go $200 and 
 * lets them and the boards know what is occurring. 
 */
function passGo(game, socketid, fbid) {
  credit(game, socketid, 200, fbid);
  safeSocketEmit(socketid, 'passGo!', {
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

/*
 * handleSale() does the heavy-lifting for when a player buys a property. 
 */
function handleSale(space, socketid, fbid) {
  queryGame(socketid, function(game) {
    var prop;
    var temp;
    
    for (var index in game.availableProperties) {
      //find property.
      if (game.availableProperties[index] &&
        game.availableProperties[index].id === space) {
        prop = game.availableProperties[index];
        temp = index;
      }
    }
    
    var suc = debit(game, socketid, prop.card.price, fbid);
    if (suc) {
      //if the money was taken correctly
      prop.owner = game.players[fbid].username.split(" ")[0]; // get the first name
      game.players[fbid].properties[space] = prop;
      game.propertyOwners[space] = fbid;
      //set the new owner, and delete it from available.
      delete game.availableProperties[temp];
      checkMonopoly(game, fbid, space);
      //make sure to check if this creates a monopoly.
      sendToBoards(game.id, 'propertySold', {
        property : space,
        propName: prop.card.title,
        fbid: fbid,
        cost: prop.card.price
      });
    }
    endTurn(game);
    //turn is over.
  });
}

/*
 * handleRoll() does the work when a player is moving. 
 */
function handleRoll(delta, dbls, socketid, fbid) {
  queryGame(socketid, function(game){
    game.doubles = dbls;
    
    if (dbls) {
      //handles the 'speeding' rules
      var numDbls = ++game.players[fbid].numDbls;
      if (numDbls === 3) {
        sendToJail(game, socketid, fbid);
        endTurn(game);
        return;
      }
    }
    
    if (game.players[fbid].jailed) {
      //if the player was in jail, check for doubles else end their turn.
      if (dbls) {
        sendToBoards(game.id, 'getOutOfJail', { fbid: fbid, debit: 0 });
        game.players[fbid].jailed = false;
        game.players[fbid].wasJailed = true;
        game.players[fbid].jailTime = 0;
      } else {
        sendToBoards(game.id, 'stayInJail', { fbid: fbid });
        endTurn(game);
        return;
      }
    }
    //check where they were, compute where they're going, 
    //and check if they've passed GO.
    var initial = game.players[fbid].space;
    game.players[fbid].space = ((game.players[fbid].space + delta) % 40);
    sendToBoards(game.id, 'movePlayer', {
      fbid: fbid,
      player: game.players[fbid].playerNumber,
      initial: initial,
      delta : delta,
      end: game.players[fbid].space
    });
    if (game.players[fbid].space < delta) passGo(game, socketid,fbid);
    
    handleSpace(game, socketid, game.players[fbid].space, fbid, delta);
    //handle any event that occurs by them landing on this space.
  });
}

/*
 *  this makes sure you're following monopoly build rules -- that you
 *  can't have four houses on one property and zero on another (max difference
 *  between any two properties in a monopoly === 1)
 */
function ensureBuildingParity(game, space, fbid, buildFlag) { 
  //buildFlag is true when adding a house, false when selling a house
  var delta = 1; //are you trying to make the number greater
  if (!buildFlag) delta = -1; //or smaller on that property
  var prop = game.players[fbid].properties[space];
  if ((prop === null) || (prop === undefined)) return false; 
  //should never happen.

  var target = (game.players[fbid].properties[space].numHouses + delta)
  if (prop.hotel) {
    target = target+5;
    //hotel acts as 'fifth' house
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
      //if the difference between any two is greater than one
    }
  }
  return true;
}

/*
 * handleConstruction() does the work when a house or hotel is bought 
 */
function handleConstruction(space, socketid, fbid){
  queryGame(socketid, function(game) {
    console.log('handling construction case');
    var prop = game.players[fbid].properties[space];
    if ((prop === undefined) || (prop === null)) {
      //can't find the property in your array
      safeSocketEmit(socketid, 'houseBuy', {
        space: space,
        fbid: fbid,
        success: false,
        reason: 'no ownership'
      });
      return;
    }
    if ((prop.monopoly) && (!prop.hotel)) { 
      if (!ensureBuildingParity(game, space, fbid, true)) {
        //not building with parity.
        safeSocketEmit(socketid, 'houseBuy', {
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
            //successful
            saveGame(game, function () {
              safeSocketEmit(socketid, 'houseBuy', {
                space: space,
                fbid: fbid,
                success: true
              });
              sendToBoards(game.id, 'hotelBuy', {
                space: space,
                propName: prop.card.title,
                cost: cost,
                fbid: fbid,
                success: true
              });
            });
          } else {
            //debit failed
            safeSocketEmit(socketid, 'houseBuy', {
              space: space,
              fbid: fbid,
              success: false,
              reason: 'no money'
            });
          }
        } else {
          //trying to buy more hotels than are available
          safeSocketEmit(socketid, 'houseBuy', {
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
            //successful
            game.availableHouses = (game.availableHouses - 1);
            prop.numHouses = (prop.numHouses + 1);
            saveGame(game, function () {
              safeSocketEmit(socketid, 'houseBuy', {
                space: space,
                fbid: fbid,
                success: true
              });
              sendToBoards(game.id, 'houseBuy', {
                space: space,
                propName: prop.card.title,
                cost: cost,
                fbid: fbid,
                success: true
              });
            });
          } else {
            //debit fails
            safeSocketEmit(socketid, 'houseBuy', {
              space:space,
              fbid: fbid,
              success: false,
              reason: 'no money'
            });
          }
        } else {
          //no houses available 
          safeSocketEmit(socketid, 'houseBuy', {
            space: space,
            fbid: fbid,
            success: false,
            reason: 'no houses left'
          });
        }
      }
    } else {
      //can't build anymore or don't own all three
      safeSocketEmit(socketid, 'houseBuy', {
        space: space,
        fbid: fbid,
        success: false,
        reason: 'already hotel or no monopoly'
      });
    }
  });
}

/*
 * handleDemolition() does the work for when a house is
 * trying to be sold. Similar to the above.
 */
function handleDemolition(space, socketid, fbid) {
  queryGame(socketid, function(game) {
    console.log('handling demolition case');
    var prop = game.players[fbid].properties[space];
    if ((prop === undefined) || (prop === null)) {
      safeSocketEmit(socketid, 'houseSell', {
        space: space,
        fbid: fbid,
        success: false,
        reason: 'no ownership'
      });
      return;
    }
    if ((prop.monopoly) && ((prop.numHouses > 0)||(prop.hotel))) { //able
      if (!ensureBuildingParity(game, space, fbid, false)) {
        safeSocketEmit(socketid, 'houseSell', {
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
            safeSocketEmit(socketid, 'houseSell', {
              space: space,
              fbid: fbid,
              success: true
            });
            sendToBoards(game.id, 'hotelSell', {
              space: space,
              propName: prop.card.title,
              cost: amt,
              fbid: fbid,
              success: true
            });
          });
        } else {
          safeSocketEmit(socketid, 'houseSell', {
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
          safeSocketEmit(socketid, 'houseSell', {
            space: space,
            fbid: fbid,
            success: true
          });
          sendToBoards(game.id, 'houseSell', {
            space: space,
            propName: prop.card.title,
            cost: amt,
            fbid: fbid,
            success: true
          });
        });
      }
    } else {
      safeSocketEmit(socketid, 'houseSell', {
        space: space,
        fbid: fbid,
        success: false,
        reason: 'no monopoly or no building'
      });
    }
  });
}

/*
 * checkMonopoly() checks the color group of the space
 * specified to see if the whole group is owned by the same person,
 * and sets the monopoly flags accordingly. 
 */
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
    group.forEach(function (space) {
      game.players[fbid].properties[space].monopoly = result;
    });
  }
}

/*
 * isOwnable and the below functions merely return a bool
 * if the condition is met -- in this case, if it's a buyable property. 
 */
function isOwnable(space) {
  console.log("inside is ownable with space " + space);
  var properties = [1,3,6,8,9,11,13,14,16,18,19,21,23,24,26,27,29,31,32,34,37,39]
  var railroads = [5,15,25,35]
  var utilities = [12,28]
  var total = properties.indexOf(space) + railroads.indexOf(space) + utilities.indexOf(space);
  return (total > -3);
}

/*
 * returns true if it's a chance space. 
 */
function isChance(space) {
  return (space === 7 || space === 22 || space === 36);
}
/*
 * returns true if it's a community chest space. 
 */
function isCommChest(space) {
  return (space === 2 || space === 17 || space === 33);
}
/*
 * returns true if it's a tax space. 
 */
function isTax(space) {
  return (space === 4 || space === 38);
}
/*
 * returns true if it's a corner space. 
 */
function isCorner(space) {
  return (space % 10 === 0);
}
/*
 * returns true if it's a railroad space. 
 */
function isRailroad(space) {
  return ((space % 5 === 0) && (space % 10 !== 0) && (space !== 0));
}
/*
 * returns the number of railroads owned by a player. 
 */
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
/*
 * returns true if ths space is a utility space. 
 */
function isUtility(space) {
  return (space === 12 || space === 28);
}
/*
 * returns true if the player owns both utilities. 
 */
function isUtilityMonopoly(game, owner, space) {
  if (space === 12) {
    return (game.propertyOwners[28] === owner);
  }
  else if (space === 28) {
    return (game.propertyOwners[12] === owner);
  }
  return false;
}
/*
 * returns true if the property has already been purchased.
 */
function isOwned(game, space) {
  var avails = game.availableProperties;
  for (var idx in avails) {
    if (avails[idx] && avails[idx].id === space) {
      return false;
    }
  }
  return true;
}
/*
 * returns true if the property is not owned by the player 
 */
function isOwnedByOther(game, space, fbid) {
  return (isOwned(game, space)) &&
    (game.propertyOwners[space] !== game.players[fbid]);
}

/*
 * collectRent() handles the process for transferring rent
 * money between two players.  
 */
function collectRent(game, space, socketid, tenant, roll) {
  var owner = game.propertyOwners[space];
  var property;
  var amt, atom;
  
  console.log(owner);

  // Get property at the space landed on
  for (var ind in game.players[owner].properties) {
    if (game.players[owner].properties[ind]) {
      if (game.players[owner].properties[ind].id === space)
        property = game.players[owner].properties[ind];
    }
  }

  // Error checking
  if (property === undefined) throw "property undefined";
  if (owner === tenant) {
    console.log("You don't pay rent for landing on your own property, stupid.");
    endTurn(game);
    return;
  }
  
  if (property.mortgaged) {
    console.log("Property is mortgaged.");
    endTurn(game);
    return;
  }

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
        //if no houses, straight rent
        amt = property.card.rent;
        if (property.monopoly) {
          //doubled when monopoly is owned.
          amt = (property.card.rent * 2);
        }
        if (property.hotel) {
          //hotel is the hotel amount
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

  var suc = forceDebit(game, socketid, amt, tenant, owner);
  if (suc) credit(game, socketid, amt, owner); 
  else {
    //the case of when a player is in default or bankrupt.
    console.log('debiting failed, is that right?');
    return;
  }
  safeSocketEmit(socketid, 'payingRent', {
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
    amount: amt
  });

  endTurn(game);
}

/*
 * handles the work when a property is being mortgaged. 
 */
function propertyMortgage(game, property, socketid, fbid, success) {
  console.log("Mortgaging property " + property.id);
  saveGame(game, function() {
    safeSocketEmit(socketid, 'propertyMortgage', {
      property: property,
      fbid: fbid,
      success: success
    });
    sendToBoards(game.id, 'propertyMortgage', {
      property: property,
      fbid: fbid,
      success: success,
      cost: property.card.price / 2
    });
  });
}

/*
 * handles the case when a property is being unmortgaged. 
 */
function propertyUnmortgage(game, property, socketid, fbid, success) {
  saveGame(game, function() {
    safeSocketEmit(socketid, 'propertyUnmortgage', {
      property: property,
      fbid: fbid,
      success: success
    });
    sendToBoards(game.id, 'propertyUnmortgage', {
      property: property,
      fbid: fbid,
      success: success,
      cost: (property.card.price / 2) * 1.10
    });
  });
}

/*
 * handles the case when a property is being purchased from the bank. 
 */
function propertyBuy(game, property, socketid, fbid) {
  console.log("Trying to buy property " + property.id);
  saveGame(game, function() {
    safeSocketEmit(socketid, 'propertyBuy', {
      property : property,
      fbid: fbid
    });
  });
}

/*
 * a function to relocate the user to jail. 
 */
function sendToJail(game, socketid, fbid) {
  var jail = 10;
  var initial = game.players[fbid].space;
  game.players[fbid].space = jail;
  game.players[fbid].jailed = true;
  sendToBoards(game.id, 'goToJail', {
    fbid: fbid,
    initial: initial
  });
  safeSocketEmit(socketid, 'goToJail', {
    reason: "Go to Jail"
  });
}

/*
 * handles tax payments. 
 */
function handleTax(game, space, socketid, fbid){
  var amt;
  if (space === 38) {
    amt = 75;
    var suc = forceDebit(game, socketid, amt, fbid);
    if (!suc) {
      console.log('could not pay tax');
      return;
    }
    sendToBoards(game.id, 'debit', {
      fbid: fbid,
      amount: amt,
      reason: "Luxury Tax"
    });
    endTurn(game);
  } else if (space === 4) {
    amt = 200;
    var suc = forceDebit(game, socketid, amt, fbid);
    if (!suc) {
      //default or bankruptcy case
      console.log('could not pay tax');
      return;
    }
    sendToBoards(game.id, 'debit', {
      fbid: fbid,
      amount: amt,
      reason: "Income Tax"
    });
    endTurn(game);
  } else {
    throw "should not have called this";
  }
}

/*
 * the workhorse of the game -- splits up the space into 
 * each type of space events and calls the necessary functions. 
 */
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
        reason: "landing on Go"
      });
      // double money for landing on go
    }
    if (space === 20) {
      credit(game,socketid,500, fbid);
      sendToBoards(game.id, 'credit', {
        fbid: fbid,
        amount: 500,
        reason: "landing on Free Parking"
      });
      // free parking is a straight $500
    }
    if (space === 30) {
      sendToJail(game, socketid, fbid);
    }
    endTurn(game);
  }
  if (isChance(space)) {
    handleChance(game, socketid, fbid);
  }
  if (isCommChest(space)) {
    handleCommChest(game, socketid, fbid);
  }
  if (isTax(space)) {
    handleTax(game, space, socketid, fbid);
  }
}

/*
 *  handles the specific chance cards.
 */
function handleChance(game, socketid, fbid) {
  chanceCommChestDeck.drawChance(game, function(card) {
    //draws a card
    var id = card.id; 
    sendToBoards(game.id, 'chance', {
        fbid: fbid,
        text: card.text
    });
    if (id < 5) { //advance type cards
      var initial = game.players[fbid].space;
      var end;
      if (id === 1) { //railroad case
        var quad = (Math.floor(initial/10));
        var half = (initial % 10);
        if (half < 5) {
          end =  ((quad * 10) + 5);
        } else {
          end = (((quad * 10) + 15) % 40);
        }
      } else {
        end = card.space;
      }
      game.players[fbid].space = end;
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
      handleSpace(game, socketid, end, fbid, delta)
      return;
    } else if (id === 5) { //send to jail card
      sendToJail(game, socketid, fbid);
    } else if (id < 9) { // credit type cards
      credit(game, socketid, card.amt, fbid);
      sendToBoards(game.id, 'credit', {
        fbid: fbid,
        amount: card.amt,
        reason: "Chance."
      });
    } else if (id < 11) { //debit type cards
     var amt = Math.abs(card.amt);
     var success = forceDebit(game, socketid, amt, fbid);
      if (success){
        sendToBoards(game.id, 'debit', {
          fbid: fbid,
          amount: amt,
          reason: "Chance."
        });
      } else return;
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
      handleSpace(game, socketid, newspace, fbid, 3);
      return;
    } else if (id === 12) { //GOoJF card
      game.players[fbid].jailCards.push('chance');
      safeSocketEmit(socketid, 'jailCard', {
        fbid: fbid,
        type: 'Chance'
      });
    } else console.log('chance card out of bounds');
    endTurn(game);
  });
}

/*
 * same as above with community chest. 
 */
function handleCommChest(game, socketid, fbid) {
  chanceCommChestDeck.drawCommChest(game, function(card) {
    var id = card.id;

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
      handleSpace(game, socketid, end, fbid, delta);
      return;
    } else if (id < 10) { // credit type cards
      credit(game, socketid, card.amt, fbid);
      sendToBoards(game.id, 'credit', {
        fbid: fbid,
        amount: card.amt,
        reason: "Community chest."
      });
    } else if (id < 12) { //debit type cards
      var amt = Math.abs(card.amt);
      var success = forceDebit(game, socketid, amt, fbid);
      if (success){
        sendToBoards(game.id, 'debit', {
          fbid: fbid,
          amount: amt,
          reason: "Community chest."
        });
      } else return;
    } else if (id === 12) { //GOoJF card
      game.players[fbid].jailCards.push('commChest');
      safeSocketEmit(socketid, 'jailCard', {
        fbid: fbid,
        type: 'Community Chest'
      });
    } else console.log('commChest card out of bounds');
    endTurn(game);
  });
}

/*
 * handles the case where the game is truly over.
 */
function endGame(game) {
  // Get player who wins
  var winner;
  for (var fbid in game.players) {
    if (!game.players[fbid].bankrupt) {
      winner = fbid;
      break;
    }
  }
  sendToPlayers(game.id, 'gameOver', { winner: winner });
  sendToBoards(game.id, 'gameOver', { winner: winner });
  // Delete the game from the database
  deleteGame(game);
}

/*
 * handles the case when one player is out of the game. 
 */
function bankrupt(game, socketid, fbid, target) {
  var player = game.players[fbid];
  if (target === undefined || target === "") {
    for (var pid in player.properties) {
      var prop = player.properties[pid];
      if (prop) {
        //transfer all the properties to the bank
        prop.owner = "Unowned";
        game.availableHouses = (game.availableHouses + prop.numHouses)
        prop.numHouses = 0;
        if (prop.hotel) {
          prop.hotel = false;
          game.availableHotels = (game.availableHotels + 1);
        }
        delete game.propertyOwners[pid];
        game.availableProperties[pid] = prop;
      }
    }
  } else {
    //transfer all the properties to the player owed.
    var newOwner = game.players[target].username.split(" ")[0];
    for (var pid in player.properties) {
      var prop = player.properties[pid];
      if (prop) {
        prop.owner = newOwner;
        game.propertyOwners[pid] = target;
        game.players[target].properties[pid] = prop;
        checkMonopoly(game, target, pid);
      }
    }
    credit(game,socketid,player.money,target); //transfer $
  }
  player.properties = {};
  player.money = 0;
  player.bankrupt = true;
  game.doubles = false;

  var temp = 0;
  for (var i in game.players) {
    if (!game.players[i].bankrupt) temp++;
  }
  
  sendToBoards(game.id, 'bankrupt', {
    fbid: fbid,
    target: target
  });
  
  //check to make sure there are players left.
  if (temp < 2) {
    endGame(game);
  } else {
    // Send bankrupt event
    safeSocketEmit(socketid, 'bankrupt', {});
    endTurn(game);
  }
}

/*
 *  calculates the total worth of a player for bankruptcy check
 */
function netWorth(game, fbid) {
  var worth = Number(game.players[fbid].money);
  //start with money
  for (var pid in game.players[fbid].properties) {
    var prop = game.players[fbid].properties[pid];
    if (prop) {
      if (!prop.mortgaged){
        //if the property is mortgaged, no worth added
        //else add half the cost.
        var pCost = (Number(prop.card.price) / 2);
        if ((!isUtility(prop.id)) && (!isRailroad(prop.id))){
          //if the property is built on, add half of the 
          //development worth
          var gCost = (Number(prop.card.housecost) / 2);
          var rCost = (Number(prop.card.hotelcost) / 2);
          var hNum = Number(prop.numHouses);
          var hot = prop.hotel;
          if (hot) {
            worth = (worth + (4 * gCost) + rCost + pCost);
          } else {
            worth = (worth + (hNum * gCost) + pCost);
          }
        } else {
          worth = (worth + pCost);
        }
      }
    }
  }
  return worth;
}

/*
 * handles the case where you are being forced to sell or 
 * mortgage to pay a debt you haven't paid. 
 */
function inDefault(game, socketid, amt, fbid, target) {
  game.players[fbid].inDefault = true;
  game.players[fbid].debt = amt;
  game.players[fbid].debtor = target;
  saveGame(game, function() {
    safeSocketEmit(socketid, 'inDefault', {
      amt: amt,
      fbid: fbid
    });
  });
}

/*
 * function to increase a player's money. 
 */
function credit(game,socketid, amt, fbid) {
  if (fbid !== undefined) {
    game.players[fbid].money = Number(game.players[fbid].money) + Number(amt);
    safeSocketEmit(socketid, 'credit', {fbid : fbid, amt: amt});
    //simply add the money
    if (game.players[fbid].inDefault) {
      //however, if the player is inDefault, and this transaction
      //now allows them to pay the debt, then take care of that
      if ((game.players[fbid].money) > (game.players[fbid].debt)) {
        var det = game.players[fbid].debt;
        var suc = forceDebit(game,socketid,det, fbid, game.players[fbid].debtor);
        if (suc) {
          safeSocketEmit(socketid, 'outOfDebt', {
            fbid: fbid,
            debt: det,
          });
          sendToBoards(game.id, 'debit', {
            fbid: fbid,
            amount: det,
            reason: "an outstanding debt."
          });
          if ((game.players[fbid].debtor) && (game.players[fbid].debtor !== "")) {
            sendToBoards(game.id, 'credit', {
              fbid: game.players[fbid].debtor,
              amount: det,
              reason: "collecting a debt."
            });
            //pay the man.
            credit(game, socketid, det, game.players[fbid].debtor);
          }
          //update player info.
          game.players[fbid].debt = 0;
          game.players[fbid].debtor = "";
          game.players[fbid].inDefault = false;
          endTurn(game); 
        } else console.log('serious credit problems');
      }
    }
  }
}

/*
 * a robust function to handle the removal of some amount of money from 
 * the player. This is used in the case where the debit is not optional,
 * ie, that if unable to paid, the player must lose the game.
 */
function forceDebit(game, socketid, amt, fbid, target) {
  console.log("forcedebit!");
  var suc = debit(game,socketid,amt,fbid);
  if (!suc) {
      console.log("netWorth: ", (netWorth(game, fbid)));
      if ((netWorth(game, fbid) - amt < 0)) {
        bankrupt(game, socketid, fbid, target);
      }
      else inDefault(game, socketid, amt, fbid, target);
  }
  return suc;
}

/*
 * a function to handle the removal of some amount of money from
 * the player. This is used in the case where the debit is optional,
 * that is, if they don't have enough money then they are not forced
 * to lose but merely cannot complete the action. 
 */
function debit(game, socketid, amt, fbid, reason) {
  if ((game.players[fbid].money - amt) < 0) {
    return false; // not enough money;
  } else {
    game.players[fbid].money = Number(Number(game.players[fbid].money) - Number(amt));
    safeSocketEmit(socketid, 'debit', {
      fbid : fbid,
      amt: amt,
      reason: reason
    });
    return true;
  }
}

/*
 * updateTrade() routes an update to a trade correctly.
 */
function updateTrade(originsocket, destsocket, obj, agent){
  if (agent === 'origin') {
    safeSocketEmit(destsocket, 'tradeUpdate', {
      originsockid: originsocket,
      destsockid: destsocket,
      tradeobj: obj
    });
  } else {
    safeSocketEmit(originsocket, 'tradeUpdate', {
      originsockid: originsocket,
      destsockid: destsocket,
      tradeobj: obj
    });
  }
}

/*
 *  handleTrade() actually completes the trade -- it transfers 
 * money between the players and transfers ownership of the 
 * corresponding properties.
 */
function handleTrade(game, tradeobj, originfbid, destfbid, socketid){
  var dop = tradeobj.destofferprops;
  var dom = tradeobj.destoffermoney;
  var oop = tradeobj.originofferprops;
  var oom = tradeobj.originoffermoney;
  console.log("oom", oom);
  console.log("dom", dom);
  
  //one side's money.
  var suc = debit(game, socketid, oom, originfbid, destfbid);
  if (!suc) throw "should never not have money for trade";
  credit(game,socketid, oom, destfbid);

  //the other side's money.
  suc = debit(game, socketid, dom, destfbid, originfbid);
  if (!suc) throw "should never not have money for trade";
  credit(game, socketid, dom, originfbid);

  var origPlay = game.players[originfbid];
  var destPlay = game.players[destfbid];

  for (var i in oop) {
    if (oop[i]) {
      var newOwner = destPlay.username.split(" ")[0];
      var prop = origPlay.properties[i];
      var pid = prop.id;
      if (prop) {
        prop.owner = newOwner;
        game.propertyOwners[pid] = destfbid;
        destPlay.properties[pid] = prop;
        delete origPlay.properties[pid];
        checkMonopoly(game, destfbid, pid);
      }
    }
  }

  for (var i in dop) {
    if (dop[i]) {
      var newOwner = origPlay.username.split(" ")[0];
      var prop = destPlay.properties[i];
      if (prop) {
        var pid = prop.id;
        prop.owner = newOwner;
        game.propertyOwners[pid] = originfbid;
        origPlay.properties[pid] = prop;
        delete destPlay.properties[pid];
        checkMonopoly(game, originfbid, pid);
      }
    }
  }
}


/*
 * userMaintain takes a socket and facebook data to
 * create a user object and then save it to the db. 
 */
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

/*
 * startGame gets the pending game ready 
 * and then tells its players. 
 */
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

/*
 * a version of socketEmit that has some error checking. 
 */
function safeSocketEmit(socketid, emitStr, emitArgs) {
  if (socketid !== undefined && connections[socketid] !== undefined) {
    connections[socketid].emit(emitStr, emitArgs);
    return true;
  } else {
    return false;
  }
}

/*
 * sends an emit message to all player sockets in a game. 
 */
function sendToPlayers(gameID, emitString, emitArgs) {
  socketsInGame(gameID, 'users', function(sockets) {
    for (var i = 0; i < sockets.length; i++) {
      safeSocketEmit(sockets[i].socketid, emitString, emitArgs);
    }
  });
}

/*
 * sends an emit message to all board sockets in a game. 
 */
function sendToBoards(gameID, emitString, emitArgs) {
  socketsInGame(gameID, 'boards', function(sockets) {
    for (var i = 0; i < sockets.length; i++) {
      safeSocketEmit(sockets[i].socketid, emitString, emitArgs);
    }
  });
}

/*
 * sends an emit message to all players except the given
 * player in a game. 
 */
function sendToOthers(gameID, emitString, emitArgs, senderID) {
  socketsInGame(gameID, 'users', function(sockets) {
    for (var i = 0; i < sockets.length; i++) {
      if (sockets[i].socketid !== senderID) {
        safeSocketEmit(sockets[i].socketid, emitString, emitArgs);
      }
    }
  });
}
