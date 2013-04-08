// This will be populated with list of games from the server as JSON objects
var gameList = [];
var currentGame;
// Index of the currently selected game
var selectedGameIndex;

var socket;

var username = "testUser";
var fbusername = undefined;

var gameCode; //need this to be a global for now :/ ~pjm

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
        gameName: gameName,
        password: password,
        numPlayers: numPlayers
      },
      success: function(data) {
        if (data.success) {
          socket.emit('hostgame', {
            gameID: data.id,
            username: window.username,
            fbusername: window.fbusername
          });
          socket.on('hostgame', function (socketdata) {
            if (socketdata.success) {
              openGameLobbyScreen($("#hostGameScreen"), data.id);
            }
          });
        }
      }
    });
  }
}

// GAME JOINING
function openJoinScreen() {
  $("#homeScreen").hide();
  $("#joinGameScreen").show();
  //getGameList();
}

function joinGame() {
  gameCode = Number($("#codeInput").val());
  // Form validation
  if (isNaN(gameCode) || gameCode < 1000 || gameCode > 9999) {
    alert("Code must be 4 digits!");
  }
  else {
    console.log(gameCode);
    socket.emit('joingame', {
      code: gameCode,
      username: window.username,
      fbusername: window.fbusername
    });
    socket.on('joingame', function (socketdata) {
      console.log(socketdata);
      if (socketdata.success) {
        openGameLobbyScreen($("#joinGameScreen"), socketdata.gameID);
      }
      else {
        alert(socketData.message);
      }
    })
  }
}

function leaveGame() {
  var gameID = currentGame.id;
  currentGame = undefined;
  socket.emit('leavegame', {
    gameID: gameID
  });
  openHomeScreen($("#gameLobbyScreen"));
}

/*
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
*/

// GAME LOBBY
function openGameLobbyScreen(prevScreen, gameID) {
  prevScreen.hide();
  $("#gameLobbyScreen").show();
  getGameInfo(gameID);
	socket.on('newplayer', function (socketdata) {
		getGameInfo(gameID);
	});
  socket.on('playerleft', function (socketdata) {
    getGameInfo(gameID);
  });
  socket.on('hostleft', function (socketdata) {
    alert("The host has left the game.");
    currentGame = undefined;
    openHomeScreen($("#gameLobbyScreen"));
  });
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
    userSquare.append($("<img>").attr("src", "https://graph.facebook.com/" + player.fbusername + "/picture?width=100&height=100"))
              .append($("<h2>").html("Player " + index + ": " + player.username));
    row.append(userSquare);
    if (index % 2 === 1)
      $("#gameLobby").append(row);
    index++;
  }
  $("#phoneCode").html(currentGame.code);
  var numPlayers = (index - 1);
  if (numPlayers < 2) {
	$("#startGameBtn")[0].setAttribute("disabled", true);
  }  else {
	$("#startGameBtn")[0].removeAttribute("disabled");
  }
}

// HOME SCREEN
function openHomeScreen(prevScreen) {
  prevScreen.hide();
  $("#homeScreen").show();
}

function startWaiting() {
	$("#startGameBtn").hide();
	$("#waitingBtn").show();
	socket.emit('playerWaiting', {
      code: gameCode,
      username: window.username
    });
	socket.on('gameReady', function () {
		console.log("READY.");
		window.location = "/mobileHome.html";
	});
}

function attachButtonEvents() {
  $("#hostBtn").click(function (event) {
    openHostScreen();
  });
  $("#joinBtn").click(function (event) {
    openJoinScreen();
  });
  $("#hostGameForm").submit(function (event) {
    event.preventDefault();
    hostGame();
  });
  $("#hostCancelBtn").click(function (event) {
    openHomeScreen($("#hostGameScreen"));
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
  $("#startGameBtn").click(function (event) {
    $("#startGameBtn").hide();
    $("#waitingBtn").show();
    startWaiting();
  });
}

function login(afterLogin) {
  FB.login(function(response) {
      if (response.authResponse) {
          afterLogin();
      } else {
          // cancelled
      }
  });
}

var afterLogin = function() {
  $(".facebookLogin").hide();
  $(".buttons").show();
  socket = io.connect(window.location.hostname);
  FB.api('/me', function(me) {
    console.log(me);
    window.username = me.name;
    window.fbusername = me.username;
    socket.emit('login', me);
  });
}

$(document).ready(function () {
	window.addEventListener('load', function() {
    	new FastClick(document.body);
	}, false);
  $(".buttons").hide();
  $(".facebookLogin").show();
  $("#facebookLoginButton").click(function() {
    FB.getLoginStatus(function(response) {
      if (response.status === 'connected') {
        afterLogin();
      } else {
        login(afterLogin);
      }
    });
  });
  attachButtonEvents();
  $("#waitingBtn").show();
});
