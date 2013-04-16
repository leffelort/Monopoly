var socket;
var boardID;

function scaleBoard() {
  //var boardScale = 0.5;
  var boardScale = document.documentElement.clientHeight / 2000;
  $("#board").css("-webkit-transform", "scale(" + boardScale + ")");
  $("#wrapper").css("height", boardScale * 2000);
  //var offset = -500;
  var offset = (document.documentElement.clientWidth / 2) - (($("#board").height() * boardScale) / 2);
  $("#board").css("left", offset + "px");
  $("#leftbar").css("width", offset);
  $("#rightbar").css("width", offset);
}

function updateBoardState(game) {
  // update players
  for (var fbid in game.players) {
    var player = game.players[fbid];
    var playerNum = player.playerNumber + 1;
    $("#playertitle" + playerNum).html("Player " + playerNum + ": " + player.username);
    $("#playermoney" + playerNum).html("Money: $" + player.money);
    $(".playerpiece" + playerNum).removeClass("visible");
    $("#space" + player.space + " .playerpiece" + playerNum)
      .addClass("visible");
    
    player.properties.forEach(function (property) {
      $("#space" + property.id + " .propertyown")
        .addClass("playerown" + playerNum);
      
      var houses = $("#space" + property.id + " .houses");
      houses.removeClass("visible");
      var houseArray = houses.toArray();
      for (var i = 0; i < property.numHouses; i++) {
        houses[i].addClass("visible");
      }
      
      if (property.hotel) {
        $("#space" + property.id + " .hotel").addClass("visible");
      } else {
        $("#space" + property.id + " .hotel").removeClass("visible");
      }
    });
  }
}

function movePlayer(data) {
  $("#space" + data.initial + " .playerpiece" + (data.player + 1))
    .removeClass("visible");
  $("#space" + data.end + " .playerpiece" + (data.player + 1))
    .addClass("visible");
}

function attachSocketHandlers() {
  socket.on("boardReconnect", function (socketdata) {
    if (!socketdata.success) {
      alert("Error reconnecting.");
      window.location.replace("/realdesktop.html");
    } else {
      socket.emit('boardstate', {});
    }
  });
  
  socket.on('boardstate', function (socketdata) {
    if (socketdata.success) {
      updateBoardState(socketdata.game);
    }
  });
  
  socket.on('moveplayer', function (socketdata) {
    movePlayer(socketdata);
  });
}

$(document).ready(function() {
  // board scaling
  scaleBoard();
  $(window).resize(function() {
    scaleBoard();
  });
  
  // Socket reconnection
  boardID = localStorage["cmuopoly_boardID"];
  socket = io.connect(window.location.hostname);
  attachSocketHandlers();
  socket.emit("boardReconnect", {
    id: boardID
  });
});