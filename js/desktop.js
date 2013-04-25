// This will be populated with list of games from the server as JSON objects
var gameList = [];
var currentGame;
// Index of the currently selected game
var selectedGameIndex;

var socket;
var boardID;

var gameCode; //need this to be a global for now :/ ~pjm

function joinGame() {
  gameCode = Number($("#codeInput").val());

  // Form validation
  if (isNaN(gameCode) || gameCode < 1000 || gameCode > 9999) {
    alert("Code must be 4 digits!");
  }
  else {
    console.log(gameCode);
    socket.emit('boardjoin', { code: gameCode });
  }

  $("#codeInput").val("");
}

function leaveGame() {
  var gameID = currentGame.id;
  currentGame = undefined;
  socket.emit('boardleave', {
    gameID: gameID,
    boardID: boardID
  });
  openHomeScreen($("#gameLobbyScreen"));
}

// GAME LOBBY
function openGameLobbyScreen(prevScreen, gameID) {
  prevScreen.hide();
  $("#gameLobbyScreen").show();
  getGameInfo(gameID);
}

function getGameInfo(gameID) {
  $.ajax({
    type: "get",
    url: "/game/" + gameID,
    success: function(data) {
      if (data.success) {
        currentGame = data.game;
		    gameCode = currentGame.code;
        createGameLobby();
      }
    }
  });
}

function createGameLobby() {
  $("#waitingBtn").hide();
  // Populate game lobby with game info
  $("#gameTitle").html(currentGame.name);
  var index = 1;
  $("#gameLobby").html("");
  var row;
  for (var id in currentGame.players) {
    var player = currentGame.players[id];
    if (index % 2 === 1) {
      row = $("<div>").addClass("gameLobbyRow");
    }
    var userSquare = $("<div>").addClass("userSquare");
    userSquare.append($("<img>").attr("src", "https://graph.facebook.com/" + player.fbid + "/picture?width=75&height=75"))
              .append($("<h2>").html("Player " + index + ": " + player.username.split(" ")[0]));
    row.append(userSquare);
    if (index % 2 === 1)
      $("#gameLobby").append(row);
    index++;
  }
  $("#boardLobby").html("Number of boards connected: " + currentGame.numBoards);
  $("#phoneCode").html(currentGame.code);
}

// HOME SCREEN
function openHomeScreen(prevScreen) {
  prevScreen.hide();
  $("#homeScreen").show();
}

function attachButtonEvents() {
  $("#joinBtn").click(function (event) {
    openJoinScreen();
  });
  $("#joinCancelBtn").click(function (event) {
    openHomeScreen($("#joinGameScreen"));
  });
  $("#codeForm").submit(function (event) {
    event.preventDefault();
    joinGame();
  });
  $("#leaveGameBtn").click(function (event) {
    leaveGame();
  });
  $("#chatForm").submit(function (event) {
    event.preventDefault();
    sendMessage();
  });
}

function attachSocketHandlers() {
  socket.on('boardjoin', function (socketdata) {
    console.log(socketdata);
    if (socketdata.success) {
      boardID = socketdata.boardID;
      localStorage["cmuopoly_boardID"] = boardID;
      openGameLobbyScreen($("#homeScreen"), socketdata.gameID);
    }
    else {
      alert(socketdata.message);
    }
  });

	socket.on('newplayer', function (socketdata) {
		getGameInfo(socketdata.gameID);
	});

  socket.on('playerleft', function (socketdata) {
    getGameInfo(socketdata.gameID);
  });

  socket.on('boardleft', function (socketdata) {
    getGameInfo(socketdata.gameID);
  });

  socket.on('hostleft', function (socketdata) {
    alert("The host has left the game.");
    currentGame = undefined;
    openHomeScreen($("#gameLobbyScreen"));
  });

	socket.on('gameReady', function () {
		console.log("READY.");
		window.location = "/board/monopoly.html";
	});
}

$(document).ready(function () {
  // Fast click (this is still here since you can run desktop on a tablet
  // if you wish)
	window.addEventListener('load', function() {
    	new FastClick(document.body);
	}, false);

  // Set up socket
  socket = io.connect(window.location.hostname);
  attachSocketHandlers();

  // Set up UI
  attachButtonEvents();
});
