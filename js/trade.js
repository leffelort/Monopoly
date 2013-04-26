var fbobj;
var socket;
var players = {};
var game;

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


function displayPlayers() {
  playerSelect = $("#playerSelect");
  playerSelect.html(" ");
  for (fbid in players) {
    player = players[fbid];
    var playerCell = $("<div>").addClass("playerCell");
    var img = $("<img>").attr({
      "src" : "https://graph.facebook.com/" + fbid + "picture?width=54&height=54"
    });
    var name = $("<h1>").html(player.username);
    var check = $("<div>").addClass("checkmark");
    playerCell.append(img, name, check);

    var select = (function() {
      $(".selected").removeClass("selected");
      $(this).addClass("selected");
    }).bind(this);
    playerCell.click(select);

    playerSelect.append(playerCell);
  }
}


function socketSetup() {
  setupPage();
  
  socket.on('reopen', function() {
    window.scrollTo(0,1);
    socket.on('getGame', function (game) {
      game = game;
      players = game.players;
      displayPlayers();
    });
  });
}

if (sessionStorage !== undefined && sessionStorage.user !== undefined) {
  fbobj = JSON.parse(sessionStorage.user);
  socket = io.connect(window.location.hostname);
  socketSetup();
  socket.emit('reopen', fbobj);
} else {
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

var setupPage = function() {
  $("#tradeleft, #traderight").hide();

  window.addEventListener('load', function() {
    new FastClick(document.body);
  }, false);

}


function tradeButtonHandler() {
  $("#playerSelect").hide();
  $("#tradeleft").show();
  $("#traderight").show();
}