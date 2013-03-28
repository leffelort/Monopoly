var canvas = $("#canvas")[0];
var ctx = canvas.getContext("2d");

var board = new Image();
board.src = "mockups/cmuopoloyMockup.png";

var house = new Image();
house.src = "images/house.png";

var dog = new Image();
dog.src = "images/dog.png";

$(document).ready(function() {
  board.onload = function() {
    ctx.drawImage(board, 0, 0, canvas.width, canvas.height);
    console.log("abcdef");
  };
  
  house.onload = function() {
    ctx.drawImage(house, 500, 500, 50, 50);
  };
  
  dog.onload = function() {
    ctx.drawImage(dog, 750, 750);
  };
});