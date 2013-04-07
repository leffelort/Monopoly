exports.newGame = function(id, code, name, password, maxPlayers, host) {
  var game = new Object();
  
  game.id = id;
  game.code = code;
  game.host = new Player(host);
  game.name = name;
  game.password = password;
  game.maxPlayers = maxPlayers;
  game.numPlayers = 1;      /* Number of players currently connected */
  game.isStarted = false;
  game.players = [game.host];
  game.boards = [];
  game.currentTurn = undefined;
  game.availableHouses = 32;
  game.availableHotels = 12;
  game.availableProperties = [];    /* TODO: fill this in with all properties */
  
  return game;
}

var Player = function (username) {
  this.username = username;
  this.socket = undefined;
  this.money = 1500;
  this.properties = [];
}

var Property = function() {
  this.numberOfHouses = 0;
  this.hotel = false;
}