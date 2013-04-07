// This will be populated with list of games from the server as JSON objects
var gameList = [];
var currentGame;
// Index of the currently selected game
var selectedGameIndex;

var socket;

var username = "testUser";

// GAME HOSTING
function openHostScreen() {
  $("#homeScreen").hide();
  $("#hostGameScreen").show();
}

function hostGame() {
  var gameName = $("#nameInput").val().trim();
  var password = $("#passwordInput").val();
  var numPlayers = Number($("#numPlayersInput").val());
  
  // Validate the form
  if (gameName === "") {
    alert("Please enter a game name.");
  }
  else if (isNaN(numPlayers) || numPlayers < 2 || numPlayers > 4) {
    alert("Number of players must be 2 to 4!");
  }
  else {
    document.activeElement.blur();
    $.ajax({
      type: "post",
      url: "/hostGame",
      data: {
        hostName: window.username,
        gameName: gameName,
        password: password,
        numPlayers: numPlayers
      },
      success: function(data) {
        if (data.success) {
          openGameLobbyScreen($("#hostGameScreen"), data.id);
        }
      }
    });
  }
}

// GAME JOINING
function openJoinScreen() {
  $("#homeScreen").hide();
  $("#joinGameScreen").show();
  getGameList();
}

function getGameList() {
  $.ajax({
    type: "get",
    url: "/gameList",
    success: function(data) {
      if (data.success) {
        gameList = data.gameList;
        createGameListTable();
      }
    }
  });
}

function createGameListTable() {
  var gameTable = $("#gameTable");
  gameTable.empty();
  
  if (gameList.length === 0) {
    gameTable.hide();
    $("#noGamesMessage").show();
  }
  else {
    gameTable.show();
    $("#noGamesMessage").hide();
    var headerRow = $("<tr>")
      .append($("<th>").html("Game name"))
      .append($("<th>").html("Password"))
      .append($("<th>").html("Status"));
    gameTable.append(headerRow);
  
    gameList.forEach(function (game, index, array) {
      var row = $("<tr>")
        .append($("<td>").html(game.name))
        .append($("<td>").html(game.password))
        .append($("<td>").html(game.status));
      if (index % 2 === 1) {
        row.addClass("alt");
      }
      row.click(function (event) {
        if (selectedGameIndex !== undefined)
          $("tr.selected").removeClass("selected");
        $(this).addClass("selected");
        selectedGameIndex = index;
      });
      gameTable.append(row);
    });
  }
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
        createGameLobby();
      }
    }
  });
}

function createGameLobby() {
  // Populate game lobby with game info
  $("#gameTitle").html(currentGame.name);
  currentGame.players.forEach(function (player, index) {
    $("#gameLobby").append($("<h2>")
      .html("Player " + (index + 1) + ": " + player.username));
  });
  $("#phoneCode").html(currentGame.code);
}

// HOME SCREEN
function openHomeScreen(prevScreen) {
  prevScreen.hide();
  $("#homeScreen").show();
}

function attachButtonEvents() {
  $("#hostBtn").click(function (event) {
    openHostScreen();
  });
  $("#joinBtn").click(function (event) {
    openJoinScreen();
  });
  $("#hostGameForm").submit(function (event) {
    hostGame();
    event.preventDefault();
  });
  $("#hostCancelBtn").click(function (event) {
    openHomeScreen($("#hostGameScreen"));
  });
  $("#joinCancelBtn").click(function (event) {
    openHomeScreen($("#joinGameScreen"));
  });
}

$(document).ready(function () {
	window.addEventListener('load', function() {
    	new FastClick(document.body);
	}, false);
  attachButtonEvents();
});
