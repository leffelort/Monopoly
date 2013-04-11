$(document).ready(function(){
  window.addEventListener('shake', shakeEventDidOccur, false);

  //function to call when shake occurs
  function shakeEventDidOccur () {
    var roll1 = Math.floor((Math.random() * 6) + 1);
    var roll2 = Math.floor((Math.random() * 6) + 1);
    $("#die1").html(roll1);
    $("#die2").html(roll2);
  }

  $("#rollstartbtn").click(shakeEventDidOccur);

});