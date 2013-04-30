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
          
        if (property.mortgaged) {
          $("#space" + property.id + " .propertyown").addClass("mortgaged");
        }

        if (property.hotel) {
          $("#space" + property.id + " .houses").removeClass("visible");
          $("#space" + property.id + " .hotel").addClass("visible");
        } else {
          $("#space" + property.id + " .hotel").removeClass("visible");

          var houses = $("#space" + property.id + " .houses");
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
  } else if (end === 30) {
    // If player lands on jail space, don't show anything since they're just
    // going to go to jail anyway.
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

function transaction(fbid, amt) {
  var oldMoney = Number($("#playermoney" + players[fbid]).html().replace("$", ""));
  console.log("transaction: " + oldMoney + " + " + amt);
  var newMoney = oldMoney + amt;
  $("#playermoney" + players[fbid]).html("$" + newMoney);
}

// Bankrupt player's money
function bankruptMoney(fbid) {
  $("#playermoney" + players[fbid]).html("Bankrupt");
}

function bankruptProps(fbid, target) {
  // Go through every space, if it's owned by fbid, give it to target
  // If target is undefined, give prop to bank
  for (var i = 0; i < 39; i++) {
    var prop = $("#space" + i + " .propertyown.player" + players[fbid]);
    if (prop !== undefined) {
      if (target !== undefined) {
        giveProperty(fbid, target, i);
      } else {
        buyProperty(fbid, i);
      }
    }
  }
}

// Bank sells property propid to player fbid.
function sellProperty(fbid, propid) {
  console.log("propertySold: " + fbid);
  $("#space" + propid + " .propertyown").addClass("player" + players[fbid]);
}

// Bank takes property propid from player fbid (on bankruptcy to the bank)
function buyProperty(fbid, propid) {
  // Remove houses/hotels first
  $("#space" + propid + " .houses").addClass("visible");
  $("#space" + propid + " .house").removeClass("visible");
  $("#space" + propid + " .hotel").removeClass("visible");
  
  $("#space" + propid + " .propertyown")
    .removeClass("mortgaged").removeClass("player" + players[fbid]);
}

// transfers ownership of property propid from origin to dest.
function giveProperty(origin, dest, propid) {
  $("#space" + propid + " .propertyown").removeClass("player" + players[origin])
    .addClass("player" + players[dest]);
}

// Transfers $amt from origin to dest.
function giveMoney(origin, dest, amt) {
  transaction(origin, amt * -1);
  transaction(dest, amt);
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

function propertyMortgage(propid) {
  $("#space" + propid + " .propertyown").addClass("mortgaged");
}

function propertyUnmortgage(propid) {
  $("#space" + propid + " .propertyown").removeClass("mortgaged");
}

function attachSocketHandlers() {
  socket.on("boardReconnect", function (data) {
    if (!data.success) {
      alert("The game is over.");
      window.location.replace("/desktop.html");
    } else {
      socket.emit('boardstate', {});
    }
  });

  socket.on('boardstate', function (data) {
    if (data.success) {
      refreshBoardState(data.game);
      setInterval(updateGameEvents, eventUpdateFreq);
    }
  });

  socket.on('movePlayer', function (data) {
    movePlayer(data.fbid, data.initial, data.end);
  });

  socket.on('goToJail', function (data) {
    jailPlayer(data.fbid, data.initial);
    displayEvent(playerNames[data.fbid] + " was sent to jail!");
  });

  socket.on('getOutOfJail', function (data) {
    displayEvent(playerNames[data.fbid] + " got out of jail!");
    transaction(data.fbid, data.debit * -1);
  });

  socket.on('stayInJail', function (data) {
    displayEvent(playerNames[data.fbid] + " stayed in jail.");
  });

  socket.on('propertySold', function (data) {
    sellProperty(data.fbid, data.property);
    transaction(data.fbid, data.cost * -1);
    displayEvent(playerNames[data.fbid] + " bought " + data.propName);
  });

  socket.on('nextTurn', function (data) {
    nextTurn(data.previd, data.fbid);
  });

  socket.on('payingRent', function (data) {
    transaction(data.tenant, data.amount * -1);
    transaction(data.owner, data.amount);
    displayEvent(playerNames[data.tenant] + " paid " + playerNames[data.owner] + " $" + data.amount + " in rent.");
  });

  socket.on('debit', function (data) {
    transaction(data.fbid, data.amount * -1);
    displayEvent(playerNames[data.fbid] + " paid $" + data.amount + " for " + data.reason);
  });

  socket.on('credit', function (data) {
    transaction(data.fbid, data.amount);
    displayEvent(playerNames[data.fbid] + " received $" + data.amount + " for " + data.reason);
  });

  socket.on('inspectProperty', function (data) {
    inspectProperty(data.fbid, data.property);
  });

  socket.on('houseBuy', function (data) {
    houseBuy(data.space);
    transaction(data.fbid, data.cost * -1);
    displayEvent(playerNames[data.fbid] + " bought a house on " + data.propName);
  });

  socket.on('houseSell', function (data) {
    houseSell(data.space);
    transaction(data.fbid, data.cost);
    displayEvent(playerNames[data.fbid] + " sold a house on " + data.propName);
  });

  socket.on('hotelBuy', function (data) {
    hotelBuy(data.space);
    transaction(data.fbid, data.cost * -1);
    displayEvent(playerNames[data.fbid] + " bought a hotel on " + data.propName);
  });

  socket.on('hotelSell', function (data) {
    hotelSell(data.space);
    transaction(data.fbid, data.cost);
    displayEvent(playerNames[data.fbid] + " sold a hotel on " + data.propName);
  });
  
  socket.on('propertyMortgage', function (data) {
    transaction(data.fbid, data.cost);
    propertyMortgage(data.property.id);
    displayEvent(playerNames[data.fbid] + " mortgaged " + 
      data.property.card.title);
  });
  
  socket.on('propertyUnmortgage', function (data) {
    transaction(data.fbid, data.cost * -1);
    propertyUnmortgage(data.property.id);
    displayEvent(playerNames[data.fbid] + " unmortgaged " + 
      data.property.card.title);
  });

  socket.on('chance', function (data) {
    displayEvent(playerNames[data.fbid] + ' landed on Chance!\n"' + data.text + '"');
  });

  socket.on('commChest', function (data) {
    displayEvent(playerNames[data.fbid] + ' landed on Community Chest!\n"' + data.text + '"');
  });

  socket.on('chatmessage', function (data) {
    addChatMessage(data.fbid, data.message);
    saveChatMessage(data.fbid, data.message);
  });

  socket.on('tradeAccept', function (data) {
    var originmoney, originprops, origintrade;
    var destmoney, destprops, desttrade;
    console.log(data.tradeobj);
    // Transfer money
    if (data.tradeobj.originoffermoney > 0) {
      giveMoney(data.originfbid, data.destfbid, data.tradeobj.originoffermoney);
      originmoney = "$" + data.tradeobj.originoffermoney;
    } else {
      originmoney = "";
    }


    if (data.tradeobj.destoffermoney > 0) {
      giveMoney(data.destfbid, data.originfbid, data.tradeobj.destoffermoney);
      destmoney = "$" + data.tradeobj.destoffermoney;
    } else {
      destmoney = "";
    }

    // Transfer properties
    data.tradeobj.originofferprops.forEach(function (prop, propid) {
      if (prop !== null) {
        giveProperty(data.originfbid, data.destfbid, propid);
        if (originprops === undefined) {
          originprops = prop.card.title;
        } else {
          originprops = originprops + ", " + prop.card.title;
        }
      }
    });
    if (originprops === undefined) originprops = "";
    
    data.tradeobj.destofferprops.forEach(function (prop, propid) {
      if (prop !== null) {
        giveProperty(data.destfbid, data.originfbid, propid);
        if (destprops === undefined) {
          destprops = prop.card.title;
        } else {
          destprops = destprops + ", " + prop.card.title;
        }
      }
    });
    if (destprops === undefined) destprops = "";

    // Construct event string
    if (originmoney !== "") {
      if (originprops !== "") {
        origintrade = originmoney + " and " + originprops;
      } else {
        origintrade = originmoney;
      }
    } else {
      if (originprops !== "") {
        origintrade = originprops;
      } else {
        origintrade = "nothing";
      }
    }

    if (destmoney !== "") {
      if (destprops !== "") {
        desttrade = destmoney + " and " + destprops;
      } else {
        desttrade = destmoney;
      }
    } else {
      if (destprops !== "") {
        desttrade = destprops;
      } else {
        desttrade = "nothing";
      }
    }
    var eventStr = playerNames[data.originfbid] + " traded " + origintrade +
      " to " + playerNames[data.destfbid] + " for " + desttrade;
    displayEvent(eventStr);
  });
  
  socket.on('bankrupt', function (data) {
    bankruptMoney(data.fbid);
    bankruptProps(data.fbid, data.target);
    if (data.target === undefined) {
      displayEvent(playerNames[data.fbid] + " has gone bankrupt, giving all assets to the bank!");
    } else {
      displayEvent(playerNames[data.fbid] + " has gone bankrupt, giving all assets to " + playerNames[data.target]);
    }
  });
  
  socket.on('gameOver', function (data) {
    displayEvent("Game Over! " + playerNames[data.winner] + " wins!");
    
    // delete localStorage
    delete localStorage["cmuopoly_boardID"];
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
