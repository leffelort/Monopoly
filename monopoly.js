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
  this.propertyOwners = {};
}



var Player = function(username, fbid) {
  this.fbid = fbid;
  this.username = username;
  this.money = 1500;
  this.properties = [];
  this.jailCards = [];
  this.space = 0;
  this.playerNumber = 0;
}

var Property = function() {
  //this doesn't jive with our property obj in the database :|
  this.numHouses = 0;
  this.hotel = false;
  this.monopoly = false;
  this.mortgaged = false;
}

var Board = function(id, boardnumber) {
  this.id = id;
	this.boardNumber = boardnumber;
}

module.exports.newBoard = function(id, boardnumber) {
	return new Board(id, boardnumber);
}

module.exports.newGame = function(id, code, name, password, maxPlayers) {
  return new Game(id, code, name, password, maxPlayers);
}
module.exports.newPlayer = function(username, fbid) {
  return new Player(username, fbid);
}
module.exports.newProperty = new Property();

