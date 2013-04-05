// This will be populated with list of games from the server as JSON objects
var gameList = [];

// Index of the currently selected game
var selectedGame;

var username = "testUser";

function openHomeScreen(prevScreen) {
  prevScreen.hide();
  $("#homeScreen").show();
}

function openHostScreen() {
  $("#homeScreen").hide();
  $("#hostGameScreen").show();
}

function openJoinScreen() {
  $("#homeScreen").hide();
  $("#joinGameScreen").show();
  
  getGameList();
}

function createGameListTable() {
  var gameTable = $("#gameTable");
  gameTable.empty();
  var headerRow = $("<tr>")
    .append($("<th>").html("Game name"))
    .append($("<th>").html("Password"))
    .append($("<th>").html("Status"));
  gameTable.append(headerRow);
  
  gameList.forEach(function (game, index, array) {
    console.log(game);
    var row = $("<tr>")
      .append($("<td>").html(game.name))
      .append($("<td>").html(game.password))
      .append($("<td>").html(game.status));
    if (index % 2 === 1) {
      row.addClass("alt");
    }
    row.click(function (event) {
      if (selectedGame !== undefined)
        $("tr.selected").removeClass("selected");
      $(this).addClass("selected");
      selectedGame = index;
    });
    
    gameTable.append(row);
  });
}

function getGameList() {
  $.ajax({
    type: "get",
    url: "/gameList",
    success: function(data) {
      if (data.success) {
        gameList = data.gameList;
        console.log(gameList);
        createGameListTable();
      }
    }
  });
}

function hostGame() {
  var gameName = $("#nameInput").val();
  var password = $("#passwordInput").val();
  var numPlayers = $("#numPlayersInput").val();
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
        console.log("I MADE A GAME!");
      }
    }
  })
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
  $("#hostGameScreen").hide();
  $("#joinGameScreen").hide();
  attachButtonEvents();
});
