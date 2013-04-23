var fbobj = undefined;
var ppd = 70; // ppd = profile pic dimensions
var me = undefined; // variable to store player information
var socket;

var eventQueue = [];
var currentEvent = undefined;
var eventUpdateFreq = 500;
var eventTimer = 0;
var eventDuration = 3000;

var goToRoll = function() {
  window.location.replace("roll.html");
}

var goToInspect = function() {
  window.location.replace("inspect.html");
}

var goToTrade = function() {
  window.location.replace("trade.html");
}

var goToManage = function() {
  window.location.replace("manage.html");
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

function socketSetup() {
  socket.on('propertyBuy', function(prop) {
    var promptText = "Would you like to purchase " + prop.card.title;
    promptText += " for $" + prop.card.price;
    displayPrompt(promptText, function(res) {
      socket.emit('propertyBuy', {result: res});
    });
  });
  
  socket.on('payingRent', function (socketdata) {
    displayEvent("You paid $" + socketdata.amount + " in rent.");
  });
  
  socket.on('debit', function (socketdata) {
    displayEvent("You paid $" + socketdata.amount + " for " + socketdata.reason);
  });
  
  socket.on('credit', function (socketdata) {
    displayEvent("You received $" + socketdata.amount + " for " + socketdata.reason);
  });

  socket.on('passGo!', function (socketdata) {
    displayEvent("You collect $" + socketdata.amount + " for " + socketdata.reason);
  });

  socket.on('getOutOfJail', function (socketdata) {
    displayEvent("You collect got out of Jail!");
  });
  
  setInterval(updateGameEvents, eventUpdateFreq);
}

// @TODO: Need to update this with actual information about the current state
// of the player in the game once the database supports it.
function loadFBData() {
  var infodiv = $("#playerinfo");
  infodiv.empty();
  var picurl;
  var name = me.username;
  picurl = "https://graph.facebook.com/" + me.fbid + "/picture?width=" + ppd + "&height=" + ppd
  var info = $("<div>").addClass("infoList");
  info.append($("<li>").addClass("infoitem").html("<span class='playerdisp'>Player " + (me.playerNumber + 1) + ":</span> " + name));
  var moneydisp = $("<li>").addClass("infoitem").addClass("moneydisp").html("$" + me.money);
  info.append(moneydisp);


  // @TODO This is really messy, but it's how I was adding
  //        new get out of jail free cards.
  // 
  if (me.jailCards !== undefined && me.jailCards.length !== 0) {
    var getoutcards = $("<div>").attr("id", "getoutcards");
    var getouttext = "<p>OUT OF<p><p>JAIL FREE</p>"
    if ($.inArray("chance", me.jailCards)) {
      var getoutchance = $("<div>").attr({
        "class" : "getout",
        "id" : "getoutchance"
      });
      getoutchance.html(getouttext);
      getoutcards.append(getoutchance);
    }
    
    if ($.inArray("community", me.jailCards)) {
      var getoutcommunity = $("<div>").attr({
        "class" : "getout",
        "id" : "getoutcommunity"
      });
      getoutcommunity.html(getouttext);
      getoutcards.append(getoutcommunity);
    }
    info.append(getoutcards);
    socketSetup();
  }
  
  // add the profile picture and offset it to line it up with the roll button.
  // The + 2 is for the image border.
  var profilepic = $("<img>").attr("src", picurl).css("left", $("#rollbtn").offset().left + 2);
  infodiv.append(profilepic)
         .append(info);
  //infodiv.append(getoutcards);
  //getoutcards.css("right", $(window).width() - $("#tradebtn").offset().left - $("#tradebtn").width() - 2);

  info.css("left", $("#rollbtn").offset().left + 2 + ppd + 20);

  if (!me.myTurn) {
    $("#rollbtn").addClass("disabled");
    $("#managebtn").addClass("disabled");
    $("#tradebtn").addClass("disabled");
    disableButtons();
  } else {
    $("#rollbtn").removeClass("disabled");
    $("#managebtn").removeClass("disabled");
    $("#tradebtn").removeClass("disabled");
    enableButtons();
    
    if (me.jailed) {
      if (me.jailCards.length > 0) {
        if (me.jailTime === 3) {
          displayPrompt("You will use your Get out of Jail Free card to get out of jail.", function (res) {
            socket.emit('getOutOfJail', {
              paid: false,
              fbid: me.fbid
            });
          });
        } else {
          displayPrompt("Do you want to use your Get out of Jail Free card?", 
          function (res) {
            if (res) {
              socket.emit('getOutOfJail', {
                paid: false,
                fbid: me.fbid
              });
            } else {
              socket.emit('serveJailTime', {
                fbid: me.fbid
              });
            }
          });
        }
      } else {
        if (me.jailTime === 3) {
          displayPrompt("You must pay $50 to get out of jail.", function (res) {
            socket.emit('getOutOfJail', {
              paid: true,
              fbid: me.fbid
            });
          });
        } else {
          displayPrompt("Do you want to pay $50 to get out of jail?", 
          function (res) {
            if (res) {
              socket.emit('getOutOfJail', {
                paid: true,
                fbid: me.fbid
              });
            } else {
              socket.emit('serveJailTime', {
                fbid: me.fbid
              });
            }
          });
        }
      }
    }
  }


  window.scrollTo(0, 1);
}  

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
      FB.api('/me', function(response){
        window.fbobj = response;
        socket = io.connect(window.location.hostname);
        socket.emit('reopen', response); // tell the server who we are.
        socket.on('reopen', function(resp) {
          if (resp.success) {
            socket.emit('getme', {});
          }
        });
        socket.on('nextTurn', function(obj) {
          socket.emit('getme', {});
          if (obj.fbid === fbobj.id) {
            displayEvent("Your turn!");
          }
        });
        socket.on('getme', function(resp) {
          if (resp === undefined) {
            alert("YOU CAN'T SIT WITH US!");
            window.location.replace("desktop.html");
          }
          console.log("I AM ", resp);
          window.me = resp;
          loadFBData();
        });
      });
    } else {
      // not_authorized
      alert("You are not logged in");
      window.location.replace("desktop.html");
    }
  });
};

  // Load the SDK Asynchronously
  (function(d){
     var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
     if (d.getElementById(id)) {return;}
     js = d.createElement('script'); js.id = id; js.async = true;
     js.src = "//connect.facebook.net/en_US/all.js";
     ref.parentNode.insertBefore(js, ref);
   }(document));


function displayPrompt(msg, callback) {
  if (callback === undefined) {
    callback = function(bool) {
      console.log(bool);
    };
  }
  var height = $(window).height() * 0.8;
  var confirmWrapper = $("<div>").addClass("confirmWrapper");
  var blackness = $("<div>").addClass("blackness");
  confirmWrapper.append(blackness);
  var confirmbox = $("<div>").addClass("confirmbox")
                             .html($("<div>")
                                   .addClass("promptmsg")
                                   .html("<p>" + msg + "</p>"));
                             //.height(height)
                             //.width(height);
  var boxes = $("<div>").addClass("boxeyboxes");
  var yesbox = $("<div>").attr("id", "yesbox")
                         .addClass("promptbox")
                         .html("<p>&#10003;</p>");
  var nobox = $("<div>").attr("id", "nobox")
                        .addClass("promptbox")
                        .html("<p>&#10060;</p>");
  boxes.append(yesbox, nobox);
  confirmbox.append(boxes);
  confirmWrapper.append(confirmbox);
  $("#content").append(confirmWrapper);

  $("#yesbox").click(function() {
    callback(true);
    $(".confirmWrapper").remove();
  });
  $("#nobox").click(function() {
    callback(false);
    $(".confirmWrapper").remove();
  });
}

function enableButtons() {
  $("#rollbtn").click(goToRoll);
  $("#managebtn").click(goToManage);
}

function disableButtons(){
  $("#rollbtn").unbind(goToRoll);
  $("#managebtn").unbind(goToManage);
}

$(document).ready(function() {
  window.addEventListener('load', function() {
    new FastClick(document.body);
  }, false);

  // hacky way to resize the view properly.
  var initialHeight = $("#gameButtons").height();
  $("#content").height($(window).height() + 60);
  $("#inspectbtn").click(goToInspect);
  setInterval(updateGameEvents, eventUpdateFreq);
});

