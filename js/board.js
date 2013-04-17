var socket;
var boardID;

// Map from fbid to player number (1-indexed).
var players = {};
var playerNames = {};

var eventQueue = [];
var currentEvent = undefined;
var eventUpdateFreq = 500;
var eventTimer = 0;
var eventDuration = 3000;

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

function refreshBoardState(game) {
  // update players
  for (var fbid in game.players) {
    var player = game.players[fbid];
    var playerNum = player.playerNumber + 1;
    window.players[player.fbid] = playerNum;
    window.playerNames[player.fbid] = player.username;
    $("#playertitle" + playerNum).html("Player " + playerNum + ": " + player.username);
    $("#playermoney" + playerNum).html("Money: $" + player.money);
    $(".playerpiece" + playerNum).removeClass("visible");
    $("#space" + player.space + " .playerpiece" + playerNum)
      .addClass("visible");
    if (player.playerNumber === game.currentTurn) {
      $("#space" + player.space + " .playerpiece" + playerNum)
        .addClass("currentTurn");
    }
    
    player.properties.forEach(function (property) {
      if (property !== null) {
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
      }
    });
  }
}

function updateGameEvents() {
  // If no event currently active, check queue
  if (currentEvent === undefined) {
    if (eventQueue.length > 0) {
      console.log(eventQueue);
      currentEvent = eventQueue.shift();
      console.log("display new event: ", currentEvent)
      eventTimer = 0;
      $(".gameEvent").html(currentEvent);
      $(".gameEvent").addClass("visible");
    }
  } else {
    // If the current event has been there for the duration, remove it
    eventTimer += eventUpdateFreq;
    if (eventTimer >= eventDuration) {
      console.log("removing event: ", currentEvent)
      currentEvent = undefined;
      $(".gameEvent").removeClass("visible");
    }
  }
}

function displayEvent(eventStr) {
  eventQueue.push(eventStr);
}

function movePlayer(fbid, initial, end) {
  console.log("movePlayer: ", fbid);
  $("#space" + initial + " .playerpiece" + players[fbid])
    .removeClass("visible").removeClass("currentTurn");
  $("#space" + end + " .playerpiece" + players[fbid])
    .addClass("visible").addClass("currentTurn");
  if (end === 10) {
    // Special case just visiting the jail
    // see jailPlayer() for the special case of going to jail
    $("#jail .playerpiece" + players[fbid])
      .removeClass("visible").removeClass("currentTurn");
  }
}

function jailPlayer(fbid, initial) {
  console.log("jailPlayer:", fbid);
  $("#space" + initial + " .playerpiece" + players[fbid])
    .removeClass("visible").removeClass("currentTurn");
  $("#jail .playerpiece" + players[fbid])
    .addClass("visible").addClass("currentTurn");
}

function updatePlayerMoney(fbid, money) {
  $("#playermoney" + players[fbid]).html("Money: $" + money);
}

function propertySold(fbid, propid, propname, money) {
  console.log("propertySold: " + fbid);
  $("#space" + propid + " .propertyown").addClass("playerown" + players[fbid]);
  updatePlayerMoney(fbid, money);
  displayEvent(playerNames[fbid] + " bought " + propname);
}

function nextTurn(previd, fbid) {
  $(".playerpiece" + players[previd] + ".visible").removeClass("currentTurn");
  $(".playerpiece" + players[fbid] + ".visible").addClass("currentTurn");
  displayEvent(playerNames[fbid] + "'s turn!");
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
      refreshBoardState(socketdata.game);
      setInterval(updateGameEvents, eventUpdateFreq);
    }
  });
  
  socket.on('movePlayer', function (socketdata) {
    movePlayer(socketdata.fbid, socketdata.initial, socketdata.end);
  });
  
  socket.on('goToJail', function (socketdata) {
    jailPlayer(socketdata.fbid, socketdata.initial);
    displayEvent(playerNames[socketdata.fbid] + " was sent to jail!");
  })
  
  socket.on('propertySold', function (socketdata) {
    propertySold(socketdata.fbid, socketdata.property, socketdata.propName, socketdata.money)
  });
  
  socket.on('nextTurn', function (socketdata) {
    nextTurn(socketdata.previd, socketdata.fbid);
  });
  
  socket.on('payingRent', function (socketdata) {
    updatePlayerMoney(socketdata.tenant, socketdata.tenantMoney);
    updatePlayerMoney(socketdata.owner, socketdata.ownerMoney);
    displayEvent(playerNames[socketdata.tenant] + " paid " + playerNames[socketdata.owner] + " $" + socketdata.amount + " in rent.");
  });
  
  socket.on('debit', function (socketdata) {
    updatePlayerMoney(socketdata.fbid, socketdata.money);
    displayEvent(playerNames[socketdata.fbid] + " paid $" + socketdata.amount + " for " + socketdata.reason);
  });
  
  socket.on('credit', function (socketdata) {
    updatePlayerMoney(socketdata.fbid, socketdata.money);
    displayEvent(playerNames[socketdata.fbid] + " received $" + socketdata.amount + " for " + socketdata.reason);
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