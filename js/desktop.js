// This will be populated with list of games from the server as JSON objects
var gameList;

// Index of the currently selected game
var selectedGame;

function openHomeScreen(prevScreen) {
  prevScreen.hide();
  $("#homeScreen").show();
}

function openHostScreen() {
  $("#homeScreen").hide();
  $("#hostGameScreen").show();
}

function openJoinScreen() {
  $("#homeScreen").hide();
  $("#joinGameScreen").show();
  // Grab games from server, and populate the table
  $("#gameList tbody tr").each(function (index) {
    if (index % 2 === 1) {
      $(this).addClass("alt");
    }
    $(this).click(function (event) {
      if (selectedGame !== undefined)
        $("tr.selected").removeClass("selected");
      $(this).addClass("selected");
      selectedGame = index;
    });
  });
}

$(document).ready(function () {
  $("#hostGameScreen").hide();
  $("#joinGameScreen").hide();
  
  $("#hostBtn").click(function (event) {
    openHostScreen();
  });
  $("#joinBtn").click(function (event) {
    openJoinScreen();
  });
  $("#hostCancelBtn").click(function (event) {
    openHomeScreen($("#hostGameScreen"));
  });
  $("#joinCancelBtn").click(function (event) {
    openHomeScreen($("#joinGameScreen"));
  });
});
