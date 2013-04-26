var fbobj;
var socket;
var players = {};
var game;
var trader;
var leftplayer;
var rightplayer;

// Taken from MDN. Used for browers without bind support.
if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5 internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }
 
    var aArgs = Array.prototype.slice.call(arguments, 1), 
        fToBind = this, 
        fNOP = function () {},
        fBound = function () {
          return fToBind.apply(this instanceof fNOP && oThis
                                 ? this
                                 : oThis,
                               aArgs.concat(Array.prototype.slice.call(arguments)));
        };
 
    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();
 
    return fBound;
  };
}

function cancelClicked() {
  window.location.replace("mobileHome.html");
}


function displayPlayers() {
  playerSelect = $("#playerSelect");
  playerSelect.html(" ");
  for (fbid in players) {
    if (fbobj.id === fbid) continue;

    player = players[fbid];
    var playerCell = $("<div>").addClass("playerCell");
    var img = $("<img>").attr({
      "src" : "https://graph.facebook.com/" + fbid + "/picture?width=54&height=54"
    });
    var name = $("<h1>").html(player.username);
    var check = $("<div>").addClass("checkmark");
    var innerfbid = $("<div>").addClass("traderfbid")
                              .html(fbid)
                              .css("display", "none");
    playerCell.append(img, name, check);

    (function() {
      var curCell = playerCell;
      var fid = fbid;
      var p = player;
      curCell.click(function(){
        $(".selected").removeClass("selected");
        curCell.addClass("selected");
        traderfbid = fid;
        rightplayer = p;
      });
    })();

    playerSelect.append(playerCell);
  }
}


function socketSetup() {
  setupPage();
  
  socket.on('reopen', function() {
    window.scrollTo(0,1);
    socket.emit('getGame', {});
  });
  socket.on('getGame', function (game) {
    game = game.game;
    players = game.players;
    leftplayer = game.players[fbobj.id];
    displayPlayers();
  });
}

if (sessionStorage !== undefined && sessionStorage.user !== undefined) {
  fbobj = JSON.parse(sessionStorage.user);
  socket = io.connect(window.location.hostname);
  socketSetup();
  socket.emit('reopen', fbobj);
} else {
   // Load the SDK Asynchronously
  (function(d){
     var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
     if (d.getElementById(id)) {return;}
     js = d.createElement('script'); js.id = id; js.async = true;
     js.src = "//connect.facebook.net/en_US/all.js";
     ref.parentNode.insertBefore(js, ref);
   }(document));

  window.fbAsyncInit = function() {
    FB.init({
      appId      : '448108371933308', // App ID
      channelUrl : '//localhost:11611/channel.html', // Channel File
      status     : true, // check login status
      cookie     : true, // enable cookies to allow the server to access the session
      xfbml      : true  // parse XFBML
    });
  
    FB.getLoginStatus(function(response) {
      if (response.status === 'connected') {
        // connected
        window.scrollTo(0, 1); // scroll past broswer bar
        FB.api('/me', function(response){
          fbobj = response;
          socket = io.connect(window.location.hostname);
          socketSetup();
          socket.emit('reopen', response); // tell the server who we are.
        });
      } else {
        // not_authorized
        alert("You are not logged in");
        window.location.replace("mobile.html");
      }
    });
  };
}

function displayProperties(properties, propDiv) {
  var moneyCell = $("<div>").addClass("propertyCell")
                            .addClass("moneyCell");
  moneyCell.append($("<div>").addClass("proptext")
                             .addClass("propname")
                             .html("Money"));
  moneyCell.click(function() {
    if (moneyCell.hasClass("selected")) {
      moneyCell.removeClass("selected");
    } else {
      moneyCell.addClass("selected");
    }
  });
  var moneyInput = $("<input>").attr({
    "type": "text",
    "placeholder": "$0",
    "cols": "4",
    "rows": 2,
    "class": "moneyInput"
  });
  moneyCell.append(moneyInput);
  propDiv.append(moneyCell);
  for (var i = 0; i < properties.length; i++) {
    var prop = properties[i];
    if (!prop) continue;

    var card = prop.card;
    var cell = $("<div>").addClass("propertyCell");
    cell.append($("<div>").addClass("stripe")
                .addClass(card.color));
    cell.append($("<div>").addClass("proptext")
                .addClass("propname")
                .html(card.title));
    var bottom = $("<div>").addClass("cellBottom");
    if (prop.owner === "Unowned") {
      bottom.append($("<span>").addClass("proptext")
                  .addClass("price")
                  .html("$" + card.price));
    } else {
      if (prop.card.color !== "utility") {
        bottom.append($("<span>").addClass("proptext")
                      .addClass("rent")
                      .html("$" + card.rent));
      }
    }
    cell.append(bottom);

    (function() {
      var cur_prop = prop;
      var cur_cell = cell;
      cur_cell.click(function() {
        if (cur_cell.hasClass("selected")) {
          cur_cell.removeClass("selected");
        } else {
          cur_cell.addClass("selected");
        }
      });
    })();
    
    propDiv.append(cell);
  }
}

$(document).ready(function() {
  $("#tradeleft, #traderight").hide();
});

function setupPage () {

  window.addEventListener('load', function() {
    new FastClick(document.body);
    new FastClick(document.getElementById("tradeleft"));
  }, false);

}

function loadTradePanels() {
  $("#tradeleft .playerName").html(leftplayer.username.split(" ")[0]);
  $("#tradeleft .playerMoney").html("$" + leftplayer.money);
  displayProperties(leftplayer.properties, $("#tradeleft .playerProperties"));
  $("#tradeleft .cancelbtn").click(function() {
    window.location.replace("mobileHome.html");
  });

  $("#traderight .playerName").html(rightplayer.username.split(" ")[0]);
  $("#traderight .playerMoney").html("$" + rightplayer.money); 
  displayProperties(rightplayer.properties, $("#traderight .playerProperties"));
  $("#traderight .cancelbtn").click(function() {
    window.location.replace("mobileHome.html");
  });
}


function tradeButtonHandler() {
  if ($(".selected").length !== 1) {
    $(".errormsg").html("You must select someone to trade with.");
    return;
  }
  $("#playerSelect, .selectTitle, .buttons, .errormsg").hide();
  $("#tradeleft").show();
  $("#traderight").show();
  loadTradePanels();
}