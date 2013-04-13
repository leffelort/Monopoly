$(document).ready(function(){

  socket = io.connect(window.location.hostname);

  $('body').height($(window).height() + 60);
  setTimeout(function(){
    window.scrollTo(0, 1);
  }, 400);
  //function to call when shake occurs
  function shakeEventDidOccur () {
    console.log("I've been shooked fooooool.")
    var roll1 = Math.floor((Math.random() * 6) + 1);
    var roll2 = Math.floor((Math.random() * 6) + 1);
    $("#die1").html(roll1);
    $("#die2").html(roll2);
    window.removeEventListener('devicemotion', shakeEventHandler, false);
    var total = roll1 + roll2

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

});