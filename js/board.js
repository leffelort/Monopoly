var socket;
var boardID;

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

function attachSocketHandlers() {
  socket.on("boardReconnect", function (socketdata) {
    if (!socketdata.success) {
      alert("Error reconnecting.");
      window.location.replace("/realdesktop.html");
    }
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