var socket; 
var rollresult;
var fbobj;

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
        socket.emit('reopen', response); // tell the server who we are.

        socket.on('diceroll', function(res) {
          if (res.success) {
            $("#rollvalue").html("You rolled a " + rollresult + "!");
            console.log("successfully handled");
            setTimeout(function() {
              window.location.replace("mobileHome.html");
            }, 1500);
          } else {
            console.log("something went wrong... that's not good.");
          }
        });
      });

      allowRolls();
    } else {
      // not_authorized
      alert("You are not logged in");
      window.location.replace("desktop.html");
    }
  });
};

// Load the FB SDK Asynchronously
(function(d){
   var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
   if (d.getElementById(id)) {return;}
   js = d.createElement('script'); js.id = id; js.async = true;
   js.src = "//connect.facebook.net/en_US/all.js";
   ref.parentNode.insertBefore(js, ref);
 }(document));

$(document).ready(function(){
  // resize to fit phone screen
  $('body').height($(window).height() + 60);
});

// get response back from the server about whether or not it handled
// the user's roll properly

function allowRolls() {
  //function to call when shake occurs
  function shakeEventDidOccur () {
    console.log("I've been shooked fooooool.")
    var roll1 = Math.floor((Math.random() * 6) + 1);
    var roll2 = Math.floor((Math.random() * 6) + 1);
    $("#die1 .dieval").html(roll1);
    $("#die2 .dieval").html(roll2);
    // unbind the events
    window.removeEventListener('devicemotion', shakeEventHandler, false);
    $("#rollstartbtn").unbind('click', shakeEventDidOccur);

    var total = roll1 + roll2
    rollresult = total;
    socket.emit('diceroll', {
      result: total,
      doubles: (roll1 === roll2),
      fbid: fbobj.id
    });
  }

  // Shamelessly taken from 
  // http://stackoverflow.com/questions/4475219/detect-a-shake-in-ios-safari-with-javascript
  if (typeof window.DeviceMotionEvent != 'undefined') {
    // Shake sensitivity (a lower number is more)
    var sensitivity = 25;

    // Position variables
    var x1 = 0, y1 = 0, z1 = 0, x2 = 0, y2 = 0, z2 = 0;

    // Listen to motion events and update the position
    var shakeEventHandler = function (e) {
      x1 = e.accelerationIncludingGravity.x;
      y1 = e.accelerationIncludingGravity.y;
      z1 = e.accelerationIncludingGravity.z;
    }
    window.addEventListener('devicemotion', shakeEventHandler, false);

    // Periodically check the position and fire
    // if the change is greater than the sensitivity
    setInterval(function () {
        var change = Math.abs(x1-x2+y1-y2+z1-z2);

        if (change > sensitivity) {
          shakeEventDidOccur();
        }

        // Update new position
        x2 = x1;
        y2 = y1;
        z2 = z1;
    }, 150);
  }

  $("#rollstartbtn").click(shakeEventDidOccur);
}
