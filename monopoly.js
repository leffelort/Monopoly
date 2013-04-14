var Game = function(id, code, name, password, maxPlayers) {  
  this.id = id;
  this.code = code;
  this.host = undefined;
  this.name = name;
  this.password = password;
  this.maxPlayers = maxPlayers;
  this.numBoards = 0;
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
  this.jailCards = [];
  this.space = 0;
  this.playerNumber = 0;
}

var Property = function() {
  this.numberOfHouses = 0;
  this.hotel = false;
}

var Board = function() {
	this.boardNumber;
}

module.exports.newBoard = function() {
	return new Board();
}

module.exports.newGame = function(id, code, name, password, maxPlayers) {
  return new Game(id, code, name, password, maxPlayers);
}
module.exports.newPlayer = function(username, fbusername) {
  return new Player(username, fbusername);
}
module.exports.newProperty = new Property();

