var Game = function(id, code, name, password, maxPlayers) {  
  this.id = id;
  this.code = code;
  this.host = undefined;
  this.name = name;
  this.password = password;
  this.maxPlayers = maxPlayers;
  this.numPlayers = 0;
  this.playersWaiting = 0;
  this.isStarted = false;
  this.players = {};
  this.boards = {};
  this.currentTurn = undefined;
  this.availableHouses = 32;
  this.availableHotels = 12;
  this.availableProperties;
}

var Player = function(username, fbusername) {
  this.fbusername = fbusername
  this.username = username;
  this.money = 1500;
  this.properties = [];
}

var Property = function() {
  this.numberOfHouses = 0;
  this.hotel = false;
}

module.exports.newGame = function(id, code, name, password, maxPlayers) {
  return new Game(id, code, name, password, maxPlayers);
}
module.exports.newPlayer = function(username, fbusername) {
  return new Player(username, fbusername);
}
module.exports.newProperty = new Property();
