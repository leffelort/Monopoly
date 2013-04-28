var socket; 
var rollresult;
var fbobj;

function socketSetup() {
  socket.on('diceroll', function(res) {
    if (res.success) {
      $("#rollvalue").html("You rolled a " + rollresult + "!");
      console.log("successfully handled");
    } else {
      console.log("something went wrong... that's not good.");
    }
  });

  socket.on('propertyBuy', function(prop) {
    console.log("Got propety ", prop);
    var property = prop.property;
    var promptText = "Would you like to purchase " + property.card.title;
    promptText += " for $" + property.card.price;
    setTimeout(function() {
      displayPrompt(promptText, function(res) {
        socket.emit('propertyBuy', {
          result: res,
          fbid: fbobj.id,
          space: property.card.space
        });
      });
    }, 1000);
  });

  socket.on('nextTurn', function(player) {
    if (player.fbid === fbobj.id) {
      allowRolls();
      setTimeout(function() {
        $("#rollvalue").html("Doubles! Roll again!");
      }, 1000);
    } else {
      setTimeout(function(){
        window.location.replace("mobileHome.html");
      }, 750);
    }
  });

  socket.on('reopen', function() {
    window.scrollTo(0,1);
    allowRolls();
  });
  
  socket.on('inDefault', function (obj) {
    var promptStr = "You owe $" + obj.amt + " and don't have enough money to pay. You must sell assets to pay your debt.";
    displayPrompt(promptStr, function () {
      window.location.replace("manage.html");
    }, false);
  });
}


if (sessionStorage !== undefined && sessionStorage.user !== undefined) {
  fbobj = JSON.parse(sessionStorage.user);
  socket = io.connect(window.location.hostname);
  socketSetup();
  socket.emit('reopen', fbobj);
} else {
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

// Load the FB SDK Asynchronously

$(document).ready(function(){
  // resize to fit phone screen
});

function forceRoll(val, dbls) {
  if (dbls === undefined) dbls = false;
  rollresult = val;
  socket.emit('diceroll', {
    result: val,
    doubles: dbls,
    fbid: fbobj.id
  });
}

function displayPrompt(msg, callback, choice) {
  if (callback === undefined) {
    callback = function(bool) {
      console.log(bool);
    };
  }
  var height = $(window).height() * 0.8;
  var confirmWrapper = $("<div>").addClass("confirmWrapper");
  var blackness = $("<div>").addClass("blackness");
  if (document.documentElement.clientHeight > 268) {
    blackness.css("height", document.documentElement.height);
  } else if ($(document).height() > 268) {
    blackness.css("height", $(document).height());
  }
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
  boxes.append(yesbox);
  if (choice === undefined || choice) {
    var nobox = $("<div>").attr("id", "nobox")
                          .addClass("promptbox")
                          .html("<p>&#10060;</p>");
    boxes.append(nobox);
  }
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


// get response back from the server about whether or not it handled
// the user's roll properly

var numberWords = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six"
}

function rollAnimation() {
  console.log("calling roll animation");
  $("#die1").removeClass();
  $("#die2").removeClass();
  var rand1 = Math.floor((Math.random() * 6) + 1);
  var rand2 = Math.floor((Math.random() * 6) + 1);
  $("#die1").addClass("die").addClass(numberWords[rand1]);
  $("#die2").addClass("die").addClass(numberWords[rand2]);
}

function allowRolls() {
  //function to call when shake occurs
  function shakeEventDidOccur () {
    console.log("I've been shooked fooooool.");
    $("#rollstartbtn").unbind('click', shakeEventDidOccur);

    // unbind the events
    //window.removeEventListener('devicemotion', shakeEventHandler, false);

    var animation_handle = setInterval(rollAnimation, 100);
    setTimeout(function() {
      clearInterval(animation_handle);
      $("#die1").removeClass();
      $("#die2").removeClass();
      var roll1 = Math.floor((Math.random() * 6) + 1);
      var roll2 = Math.floor((Math.random() * 6) + 1);
      $("#die1").addClass("die").addClass(numberWords[roll1]);
      $("#die2").addClass("die").addClass(numberWords[roll2]);
      var total = roll1 + roll2
      rollresult = total;
      socket.emit('diceroll', {
        result: total,
        doubles: (roll1 === roll2),
        fbid: fbobj.id
      });
    }, 2000);
  }

  // // Shamelessly taken from 
  // // http://stackoverflow.com/questions/4475219/detect-a-shake-in-ios-safari-with-javascript
  // if (typeof window.DeviceMotionEvent != 'undefined') {
  //   // Shake sensitivity (a lower number is more)
  //   var sensitivity = 25;

  //   // Position variables
  //   var x1 = 0, y1 = 0, z1 = 0, x2 = 0, y2 = 0, z2 = 0;

  //   // Listen to motion events and update the position
  //   var shakeEventHandler = function (e) {
  //     x1 = e.accelerationIncludingGravity.x;
  //     y1 = e.accelerationIncludingGravity.y;
  //     z1 = e.accelerationIncludingGravity.z;
  //   }
  //   window.addEventListener('devicemotion', shakeEventHandler, false);

  //   // Periodically check the position and fire
  //   // if the change is greater than the sensitivity
  //   setInterval(function () {
  //       var change = Math.abs(x1-x2+y1-y2+z1-z2);

  //       if (change > sensitivity) {
  //         shakeEventDidOccur();
  //       }

  //       // Update new position
  //       x2 = x1;
  //       y2 = y1;
  //       z2 = z1;
  //   }, 150);
  // }

  $("#rollstartbtn").click(shakeEventDidOccur);
}
