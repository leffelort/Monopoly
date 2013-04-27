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

var ppd = 75;

function scaleBoard() {
  var height = Math.max(document.documentElement.clientHeight, 720);
  var scale = height / 2000;
  var boardHeight = height - 15; // border compensation
  var boardScale = boardHeight / 2000;
  $("#board").css("-webkit-transform", "scale(" + boardScale + ")");
  $(".pieces2").css("-webkit-transform", "rotate(" + 90 + "deg)");
  $(".pieces3").css("-webkit-transform", "rotate(" + 180 + "deg)");
  $(".pieces4").css("-webkit-transform", "rotate(" + 270 + "deg)");
  $("#wrapper").css("height", scale * 2000);

  var width = Math.max(document.documentElement.clientWidth, 1024);
  var offset = (width / 2) -
    (($("#board").height() * boardScale) / 2) - 7.5;
  $("#board").css("left", (offset) + "px");
  $("#leftbar").css("width", offset);
  $("#rightbar").css("width", offset);

  // fix chat log height
  $(".logBox").css("max-height", scale * 2000 * 0.5 - 60);
}

function refreshBoardState(game) {
  console.log("refreshBoardState");
  // update players
  for (var fbid in game.players) {
    var player = game.players[fbid];
    var playerNum = player.playerNumber + 1;
    window.players[player.fbid] = playerNum;
    window.playerNames[player.fbid] = player.username.split(' ')[0];
    $("#playerinfo" + playerNum).addClass("visible");
    var picurl = "https://graph.facebook.com/" + player.fbid + "/picture?width=" + ppd + "&height=" + ppd;
    $("#playericon" + playerNum).attr("src", picurl);
    $("#playertitle" + playerNum).html("Player " + playerNum + ": " + playerNames[player.fbid]);
    $("#playermoney" + playerNum).html("$" + player.money);
    $(".playerpiece" + playerNum).removeClass("visible");
    if (player.space === 10) {
      if (player.jailed) {
        $("#space" + player.space + " #jail .playerpiece" + playerNum)
          .addClass("visible");
      } else {
        $("#space" + player.space + " .justVisiting .playerpiece" + playerNum)
          .addClass("visible");
      }
    } else {
      $("#space" + player.space + " .playerpiece" + playerNum)
        .addClass("visible");
    }
    if (player.playerNumber === game.currentTurn) {
      if (player.space === 10 && !player.jailed) {
        // special case just-visiting
        $("#space" + player.space + " .playerpiece" + playerNum)
          .addClass("currentTurn");
      } else {
        $("#space" + player.space + " .playerpiece" + playerNum)
          .addClass("currentTurn" + players[fbid]);
      }
    }

    player.properties.forEach(function (property) {
      if (property !== null) {
        $("#space" + property.id + " .propertyown")
          .addClass("player" + playerNum);

        if (property.hotel) {
          $("#space" + property.id + " .hotel").addClass("visible");
        } else {
          $("#space" + property.id + " .hotel").removeClass("visible");

          var houses = $("#space" + property.id + " .houses");
          houses.addClass("visible");
          for (var i = 1; i <= property.numHouses; i++) {
            $("#space" + property.id + " .house" + i).addClass("visible");
          }
        }
      }
    });
  }
  
  // Populate chat/event logs
  if (localStorage["cmuopoly_eventLog"] !== "") {
    var eventLog = JSON.parse(localStorage["cmuopoly_eventLog"]);
    console.log(localStorage["cmuopoly_eventLog"]);
    console.log(eventLog);
    eventLog.forEach(function (msg) {
      addToEventLog(msg);
    });
  } 
  
  if (localStorage["cmuopoly_chatLog"] !== "") {
    var chatLog = JSON.parse(localStorage["cmuopoly_chatLog"]);
    console.log(localStorage["cmuopoly_chatLog"]);
    console.log(chatLog);
    chatLog.forEach(function (msg) {
      addChatMessage(msg.fbid, msg.message);
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
      console.log("removing event: ", currentEvent);
      currentEvent = undefined;
      $(".gameEvent").removeClass("visible");
    }
  }
}

function displayEvent(eventStr) {
  eventQueue.push(eventStr);
  addToEventLog(eventStr);
  saveEvent(eventStr);
}

function addToEventLog(eventStr) {
  var log = $("#eventLog .logMessage").toArray();
  var li = $("<li>").addClass("logMessage");
  if (log.length % 2 !== 0) {
    li.addClass("alt");
  }
  li.html(eventStr);
  $("#eventLog").append(li);
  $('#eventLog').scrollTop($('#eventLog')[0].scrollHeight);
}

function saveEvent(eventStr) {
  if (localStorage["cmuopoly_eventLog"] !== "") {
    var eventLog = JSON.parse(localStorage["cmuopoly_eventLog"]);
    eventLog.push(eventStr);
    localStorage["cmuopoly_eventLog"] = JSON.stringify(eventLog);
  } else {
    localStorage["cmuopoly_eventLog"] = JSON.stringify([eventStr]);
  }
}

function addChatMessage(fbid, message) {
  var log = $("#chatLog .logMessage").toArray();
  var li = $("<li>").addClass("logMessage");
  if (log.length % 2 !== 0) {
    li.addClass("alt");
  }
  var sender = $("<span>").addClass("chatSender").html(playerNames[fbid]);
  var messageText = $("<span>").html(": " + message);
  li.append(sender).append(messageText);
  $("#chatLog").append(li);
  $('#chatLog').scrollTop($('#chatLog')[0].scrollHeight);
  
}

function saveChatMessage(fbid, message) {
  var msg = { fbid: fbid, message: message };
  if (localStorage["cmuopoly_chatLog"] !== "") {
    var chatLog = JSON.parse(localStorage["cmuopoly_chatLog"]);
    chatLog.push(msg);
    localStorage["cmuopoly_chatLog"] = JSON.stringify(chatLog);
  } else {
    localStorage["cmuopoly_chatLog"] = JSON.stringify([msg])
  }
}

function movePlayer(fbid, initial, end) {
  console.log("movePlayer: ", fbid);
  $("#space" + initial + " .playerpiece" + players[fbid])
    .removeClass("visible").removeClass("currentTurn" + players[fbid]);
  if (end === 10) {
    $("#space" + end + " .playerpiece" + players[fbid])
      .addClass("visible").addClass("currentTurn");
    // Special case just visiting the jail
    // see jailPlayer() for the special case of going to jail
    $("#jail .playerpiece" + players[fbid])
      .removeClass("visible").removeClass("currentTurn" + players[fbid]);
  } else {
    $("#space" + end + " .playerpiece" + players[fbid])
      .addClass("visible").addClass("currentTurn" + players[fbid]);
  }
}

function jailPlayer(fbid, initial) {
  console.log("jailPlayer:", fbid);
  $("#space" + initial + " .playerpiece" + players[fbid])
    .removeClass("visible").removeClass("currentTurn" + players[fbid]);
  $("#space30 .playerpiece" + players[fbid])
    .removeClass("visible").removeClass("currentTurn" + players[fbid]);
  $("#jail .playerpiece" + players[fbid])
    .addClass("visible").addClass("currentTurn" + players[fbid]);
}

function updatePlayerMoney(fbid, money) {
  $("#playermoney" + players[fbid]).html("Money: $" + money);
}

function debit(fbid, amt) {
  var old = Number($("#playermoney" + players[fbid]).html().replace("$", ""));
  $("#playermoney" + players[fbid]).html("$" + (old - amt));
}

function credit(fbid, amt) {
  var old = Number($("#playermoney" + players[fbid]).html().replace("$", ""));
  $("#playermoney" + players[fbid]).html("$" + (old + amt));
}

function propertySold(fbid, propid, propname, cost) {
  console.log("propertySold: " + fbid);
  $("#space" + propid + " .propertyown").addClass("player" + players[fbid]);
  debit(fbid, cost);
  displayEvent(playerNames[fbid] + " bought " + propname);
}

function nextTurn(previd, fbid) {
  if ($("#space10 .playerpiece" + players[previd]).hasClass("visible")) {
    if ($("#jail .playerpiece" + players[previd]).hasClass("visible")) {
      $("#jail .playerpiece" + players[previd] + ".visible")
        .removeClass("currentTurn" + players[previd]);
    } else {
      $("#space10 .playerpiece" + players[previd] + ".visible")
        .removeClass("currentTurn");
    }
  } else {
    $(".playerpiece" + players[previd] + ".visible")
      .removeClass("currentTurn" + players[previd]);
  }
  if ($("#space10 .playerpiece" + players[fbid]).hasClass("visible")) {
    if ($("#jail .playerpiece" + players[fbid]).hasClass("visible")) {
      $("#jail .playerpiece" + players[fbid] + ".visible")
        .addClass("currentTurn" + players[fbid]);
    } else {
      $("#space10 .playerpiece" + players[fbid] + ".visible")
        .addClass("currentTurn");
    }
  } else {
    $(".playerpiece" + players[fbid] + ".visible")
      .addClass("currentTurn" + players[fbid]);
  }
  displayEvent(playerNames[fbid] + "'s turn!");
}

function inspectProperty(fbid, propid) {
  if (propid === undefined) {
    $("#playerinspect" + players[fbid]).empty();
  } else {
    $(".inspect").removeClass("player" + players[fbid]);
    $("#space" + propid + " .inspect").addClass("player" + players[fbid]);
    var space = $("#space" + propid).html();
    var inspect = $("#playerinspect" + players[fbid]).html(space);
    inspect.attr('class', '').addClass("playerinspect");
    if (propid > 0 && propid < 10) {
      inspect.addClass("inspectRow1");
    } else if (propid > 10 && propid < 20) {
      inspect.addClass("inspectRow2");
    } else if (propid > 20 && propid < 30) {
      inspect.addClass("inspectRow3");
    } else {
      inspect.addClass("inspectRow4");
    }
  }
}

function houseBuy(propid) {
  var visibleHouses = $("#space" + propid + " .house.visible").toArray();
  switch (visibleHouses.length) {
    case 0:
      $("#space" + propid + " .house1").addClass("visible");
      break;
    case 1:
      $("#space" + propid + " .house2").addClass("visible");
      break;
    case 2:
      $("#space" + propid + " .house3").addClass("visible");
      break;
    case 3:
      $("#space" + propid + " .house4").addClass("visible");
      break;
  }
}

function houseSell(propid) {
  var visibleHouses = $("#space" + propid + " .house.visible").toArray();
  switch (visibleHouses.length) {
    case 1:
      $("#space" + propid + " .house1").removeClass("visible");
      break;
    case 2:
      $("#space" + propid + " .house2").removeClass("visible");
      break;
    case 3:
      $("#space" + propid + " .house3").removeClass("visible");
      break;
    case 4:
      $("#space" + propid + " .house4").removeClass("visible");
      break;
  }
}

function hotelBuy(propid) {
  $("#space" + propid + " .houses").removeClass("visible");
  $("#space" + propid + " .hotel").addClass("visible");
}

function hotelSell(propid) {
  $("#space" + propid + " .hotel").removeClass("visible");
  $("#space" + propid + " .houses").addClass("visible");
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
  });

  socket.on('getOutOfJail', function (socketdata) {
    displayEvent(playerNames[socketdata.fbid] + " got out of jail!");
    debit(socketdata.fbid, socketdata.debit);
  });

  socket.on('stayInJail', function (socketdata) {
    displayEvent(playerNames[socketdata.fbid] + " stayed in jail.");
  });

  socket.on('propertySold', function (socketdata) {
    propertySold(socketdata.fbid, socketdata.property, socketdata.propName, socketdata.cost)
  });

  socket.on('nextTurn', function (socketdata) {
    nextTurn(socketdata.previd, socketdata.fbid);
  });

  socket.on('payingRent', function (socketdata) {
    debit(socketdata.tenant, socketdata.amount);
    credit(socketdata.owner, socketdata.amount);
    displayEvent(playerNames[socketdata.tenant] + " paid " + playerNames[socketdata.owner] + " $" + socketdata.amount + " in rent.");
  });

  socket.on('debit', function (socketdata) {
    debit(socketdata.fbid, socketdata.amount);
    displayEvent(playerNames[socketdata.fbid] + " paid $" + socketdata.amount + " for " + socketdata.reason);
  });

  socket.on('credit', function (socketdata) {
    credit(socketdata.fbid, socketdata.amount);
    displayEvent(playerNames[socketdata.fbid] + " received $" + socketdata.amount + " for " + socketdata.reason);
  });

  socket.on('inspectProperty', function (socketdata) {
    inspectProperty(socketdata.fbid, socketdata.property);
  });

  socket.on('houseBuy', function (socketdata) {
    houseBuy(socketdata.space);
    debit(socketdata.fbid, socketdata.cost);
    displayEvent(playerNames[socketdata.fbid] + " bought a house on " + propName);
  });

  socket.on('houseSell', function (socketdata) {
    houseSell(socketdata.space);
    credit(socketdata.fbid, socketdata.cost);
    displayEvent(playerNames[socketdata.fbid] + " sold a house on " + propName);
  });

  socket.on('hotelBuy', function (socketdata) {
    hotelBuy(socketdata.space);
    debit(socketdata.fbid, socketdata.cost);
    displayEvent(playerNames[socketdata.fbid] + " bought a hotel on " + propName);
  });

  socket.on('hotelSell', function (socketdata) {
    hotelSell(socketdata.space);
    credit(socketdata.fbid, socketdata.cost);
    displayEvent(playerNames[socketdata.fbid] + " sold a hotel on " + propName);
  });

  socket.on('chance', function (socketdata) {
    displayEvent(playerNames[socketdata.fbid] + ' landed on Chance!\n"' + socketdata.text + '"');
  });

  socket.on('commChest', function (socketdata) {
    displayEvent(playerNames[socketdata.fbid] + ' landed on Community Chest!\n"' + socketdata.text + '"');
  });

  socket.on('chatmessage', function (socketdata) {
    addChatMessage(socketdata.fbid, socketdata.message);
    saveChatMessage(socketdata.fbid, socketdata.message);
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
