// This will be populated with list of games from the server as JSON objects
var gameList = [];
var currentGame;
// Index of the currently selected game
var selectedGameIndex;

var socket;

var username = undefined;
var fbid = undefined;

var gameCode; //need this to be a global for now :/ ~pjm
var isWaiting = false;

// GAME HOSTING
function openHostScreen() {
  $("#homeScreen").hide();
  $("#hostGameScreen").show();
}

function hostGame() {
  var gameName = $("#nameInput").val().trim();
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
        numPlayers: numPlayers
      },
      success: function(data) {
        if (data.success) {
          socket.emit('hostgame', {
            gameID: data.id,
            username: window.username,
            fbid: window.fbid
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
      fbid: window.fbid
    });
  }
}

function leaveGame() {
  var gameID = currentGame.id;
  currentGame = undefined;
  socket.emit('leavegame', {
    gameID: gameID,
    fbid: fbid
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
  $("#title").hide();
  $("#waitingBtn").hide();
  // Populate game lobby with game info
  $("#gameTitle").html(currentGame.name);
  var index = 1;
  $("#gameLobby").html("");
  var row = $("<div>").addClass("gameLobbyRow");;
  for (var id in currentGame.players) {
    var player = currentGame.players[id];
    // if (index % 2 === 1) {
    //   row = $("<div>").addClass("gameLobbyRow");
    // }
    var userSquare = $("<div>").addClass("userSquare");
    userSquare.append($("<img>").attr("src", "https://graph.facebook.com/" + player.fbid + "/picture?width=50&height=50"))
              .append($("<h2>").html(index + ": " + player.username.split(" ")[0]));
    row.append(userSquare);
    // if (index % 2 === 1)
    //   $("#gameLobby").append(row);
    index++;
  }
  $("#gameLobby").append(row);
  $("#boardLobby").html("Number of boards connected: " + currentGame.numBoards);
  $("#phoneCode").html(currentGame.code);
  if (currentGame.numPlayers < 2 || currentGame.numBoards < 1) {
    $("#waitingBtn").hide();
    $("#startGameBtn").show();
    $("#startGameBtn")[0].setAttribute("disabled", true);
  } else {
    $("#startGameBtn")[0].removeAttribute("disabled");
  }
  window.scrollTo(0,1);
}

function sendMessage() {
  var message = $("#chatBox").val().trim();
  if (message !== "") {
    socket.emit('chatmessage', {
      gameID: currentGame.id,
      type: 'message',
      sender: window.username,
      message: message
    });
    $("#chatBox").val("");
  }
}

// HOME SCREEN
function openHomeScreen(prevScreen) {
  $("#title").show();
  prevScreen.hide();
  $("#homeScreen").show();
}

function startWaiting() {
	$("#startGameBtn").hide();
	$("#waitingBtn").show();
	socket.emit('playerWaiting', {
    code: gameCode,
    username: window.username,
    fbid: window.fbid
  });
  isWaiting = true;
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
  $("#chatForm").submit(function (event) {
    event.preventDefault();
    sendMessage();
  });
}

function attachSocketHandlers() {
  socket.on('hostgame', function (socketdata) {
    if (socketdata.success) {
      openGameLobbyScreen($("#hostGameScreen"), socketdata.gameID);
    }
  });

  socket.on('joingame', function (socketdata) {
    console.log(socketdata);
    if (socketdata.success) {
      openGameLobbyScreen($("#joinGameScreen"), socketdata.gameID);
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

  socket.on('boardjoin', function (socketdata) {
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

  socket.on('chatmessage', function (socketdata) {
    var message = $("<li>");
    if (socketdata.type === "event") {
      message.addClass("chatEvent");
      message.html(socketdata.message);
    }
    else if (socketdata.type === "message") {
      message.addClass("chatMessage");
      var first = socketdata.sender.split(" ")[0];
      var sender = $("<span>").addClass("chatSender").html(first);
      var messageText = $("<span>").html(": " + socketdata.message);
      message.append(sender).append(messageText);
    }
    $("#chatWindow").append(message);
    $('#chatWindow').scrollTop($('#chatWindow')[0].scrollHeight);
    console.log(socketdata);
  });

	socket.on('gameReady', function () {
		console.log("READY.");
		window.location = "/mobileHome.html";
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
    if (sessionStorage !== undefined) {
      sessionStorage["user"] = JSON.stringify(me);
    }
    window.username = me.name;
    window.fbid = me.id;
    socket.emit('login', me);
  });
  attachSocketHandlers();
}

  window.fbAsyncInit = function() {
    FB.init({
      appId      : '448108371933308', // App ID
      channelUrl : '//localhost:11611/channel.html', // Channel File
      status     : true, // check login status
      cookie     : true, // enable cookies to allow the server to access the session
      xfbml      : true  // parse XFBML
    });

    // Additional init code here
    setupHomescreen();
  };

  // Load the SDK Asynchronously
  (function(d){
     var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
     if (d.getElementById(id)) {return;}
     js = d.createElement('script'); js.id = id; js.async = true;
     js.src = "//connect.facebook.net/en_US/all.js";
     ref.parentNode.insertBefore(js, ref);
   }(document));

var setupHomescreen = function () {
	window.addEventListener('load', function() {
    	new FastClick(document.body);
	}, false);
  $("#facebookLoginButton").click(function() {
    FB.getLoginStatus(function(response) {
      if (response.status === 'connected') {
        afterLogin();
      } else {
        login(afterLogin);
      }
    });
  });
  window.scrollTo(0,1);
  attachButtonEvents();
}

$(document).ready(function() {
  $(".buttons").hide();
  $(".facebookLogin").show();
  $("#facebookLoginButton").click(function() {
    FB.getLoginStatus(function(response) {
      if (response.status === 'connected') {
        $(".facebookLogin").hide();
        $(".buttons").show();
      } else {
        // FB SDK handles login and all the stuffz.
      }
    });
  });
});
