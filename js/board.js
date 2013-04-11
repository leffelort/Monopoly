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

$(document).ready(function() {
  scaleBoard();
  $(window).resize(function() {
    scaleBoard();
  });
});