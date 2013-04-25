var Game = function(id, code, name, maxPlayers) {
  this.id = id;
  this.code = code;
  this.host = undefined;
  this.name = name;
  this.maxPlayers = maxPlayers;
  this.numBoards = 0;
  this.numPlayers = 0;
  this.playersWaiting = 0;
  this.isStarted = false;
  this.players = {};
  this.boards = {};
  this.currentTurn = undefined;
  this.doubles = false;
  this.availableHouses = 32;
  this.availableHotels = 12;
  this.availableProperties = [];
  this.propertyOwners = {};
  this.chanceDeck = [];
  this.commChestDeck = [];
  this.chanceJailCardUsed = false;
  this.commChestJailCardUsed = false;
}

var Player = function(username, fbid) {
  this.fbid = fbid;
  this.username = username;
  this.money = 1500;
  this.properties = [];
  this.jailed = false;
  this.jailTime = 0;
  this.jailCards = [];
  this.space = 0;
  this.playerNumber = 0;
}

var Property = function(card) {
  this.id = card.space;
  this.numHouses = 0;
  this.hotel = false;
  this.monopoly = false;
  this.mortgaged = false;
  this.owner = "Unowned";
  this.card = card;
}

var Board = function(id) {
  this.id = id;
  this.socketid;
  this.gameInProgress;
}

module.exports.newBoard = function(id) {
	return new Board(id);
}

module.exports.newGame = function(id, code, name, maxPlayers) {
  return new Game(id, code, name, maxPlayers);
}
module.exports.newPlayer = function(username, fbid) {
  return new Player(username, fbid);
}
module.exports.newProperty = function(card) {
  return new Property(card);
}

