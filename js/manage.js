var propertyDatabase = {};
var setupPage;
var socket;
var fbobj;
var current_prop;
var inDefault;


function socketSetup() {
  socket.on('getMyProperties', function(props){
    props.sort(function(a,b) {
      if (!a) return 1;
      if (!b) return -1;
      return a.card.space - b.card.space;
    });
    displayProperties(props);
  });

  socket.on('reopen', function (data){
    inDefault = data.inDefault;
    console.log("inDefault = " + inDefault);
    setupPage();
  });

  socket.on('propertyMortgage', function(res) {
    if (res.success) {
      current_prop.mortgaged = true;
      console.log("property was mortgaged");
      loadDetailedView(current_prop);
    } else {
      console.log("Could not mortgage");
    }
    setupMortgageBtn();
  });

  socket.on('propertyUnmortgage', function(res) {
    if (res.success) {
      console.log("property was UNmortgaged");
      current_prop.mortgaged = false;
      loadDetailedView(current_prop);
    } else {
      console.log("Could not UNmortgage");
    }
    setupMortgageBtn();
  });

  socket.on('houseBuy', function(res) {
    if (res.success) {
      console.log("you bought a house!");
    } else {
      console.log("LOL SUCKS you didn't buy a house cause, ", res.reason);
    }
  });

  socket.on('houseSell', function(res) {
    if (res.success) {
      console.log("you sold a house!");
    } else {
      console.log("LOL SUCKS you didn't sell a house cause, ", res.reason);
    }
  });

  socket.on('outOfDebt', function (data) {
    window.location.replace("mobileHome.html");
  });
  
  socket.on('bankrupt', function (socketdata) {
    displayPrompt("You went bankrupt! :(", function () {
      window.location.replace("/mobile.html");
    }, false);
  });
  
  socket.on('gameOver', function (socketdata) {
    displayPrompt("Game over!", function () {
      window.location.replace("/mobile.html");
    }, false);
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
(function(d){
   var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
   if (d.getElementById(id)) {return;}
   js = d.createElement('script'); js.id = id; js.async = true;
   js.src = "//connect.facebook.net/en_US/all.js";
   ref.parentNode.insertBefore(js, ref);
 }(document));

function getProperties() {
  socket.emit("getMyProperties", {});
}

function mortgageHandler(prop) {
  $("#mortgagebtn").unbind();
  if (prop.mortgaged === true) {
    console.log("I want to unmortgage!");
    socket.emit('propertyUnmortgage', {
      fbid: fbobj.id,
      space: prop.id
    });
  } else {
    console.log("I'm going to mortgage now!");
    socket.emit('propertyMortgage', {
      fbid: fbobj.id,
      space: prop.id
    });
  }
  setupMortgageBtn();
}

function setupMortgageBtn() {
  if (current_prop.numHouses > 0 || current_prop.hotel === true) {
    $("#mortgagebtn").addClass("unavailable")
                     .unbind();
    $("#mortgagebtn .btncaption").html("Mortgage");
    return;
  }
  if (current_prop.mortgaged === true) {
    $("#mortgagebtn .btncaption").html("Unmortgage");
  } else {
    $("#mortgagebtn .btncaption").html("Mortgage");
  }
  $("#mortgagebtn").click(function() {
    mortgageHandler(current_prop);
  });
}

function setupHouseButtons() {
  $("#houseminusbtn").unbind();
  $("#houseplusbtn").unbind();
  if (current_prop.monopoly === true) {
    $("#houseminusbtn").removeClass("unavailable");
    $("#houseplusbtn").removeClass("unavailable");
    $("#houseminusbtn").click(function() {
      socket.emit('houseSell', {
        space: current_prop.id,
        fbid: fbobj.id
      });
    });
    if (inDefault) {
      // If in default, you can't buy houses ever
      $("#houseplusbtn").addClass("unavailable");
    } else {
      $("#houseplusbtn").click(function() {
        socket.emit('houseBuy', {
          space: current_prop.id,
          fbid: fbobj.id
        });
      });
    }
  } else {
    $("#houseminusbtn").addClass("unavailable");
    $("#houseplusbtn").addClass("unavailable");
  }
}

function loadDetailedView(prop) {
  current_prop = prop;
  enablePropertyOptions();
  $("#mortgagebtn").unbind();
  var property = prop.card;
  $("#propDetails").html(" ");
  var detailedView = $("<div>").addClass("propertyCard");
  var titleDeed = $("<div>").addClass("titleDeed");
  var mortgaged = $("<div>").addClass("mortgaged").html("MORTGAGED");
  if (prop.mortgaged) mortgaged.show();
  titleDeed.append(mortgaged);
  var titleTextColor = "black";
  if (property.color === "blue" || property.color === "purple") {
    titleTextColor = "white";
  }
  var details;
  var costTable;
  if (property.color === "rr") { // handle railroad
    titleDeed.append($("<div>").addClass("railroadImg"));
    titleDeed.append($("<div>").addClass("propertyName")
                 .addClass("railroad")
                 .append($("<h1>").html(property.title))
                 .css("color", titleTextColor));
    details = $("<div>").addClass("details")
                        .addClass("railroad");
    details.append($("<div>").addClass("rentDisplay")
                 .html(property.rent + "."));
    var houseCosts = $("<div>").addClass("houseCosts");

    costTable = $("<table>").addClass("railroad");
    costTable.append($("<tr>").append($("<td>").html("If 2 R.R.'s are owned"),
                      $("<td>").html("$ " + property.tworr + ".")));
    costTable.append($("<tr>").append($("<td>").html("If 3  &nbsp; &nbsp; \" &nbsp; &nbsp; \" &nbsp; &nbsp; \""),
                      $("<td>").html(property.threerr + ".")));
    costTable.append($("<tr>").append($("<td>").html("If 4  &nbsp; &nbsp; \" &nbsp; &nbsp; \" &nbsp; &nbsp; \""),
                      $("<td>").html(property.fourrr + ".")));
    houseCosts.append(costTable);

    details.append(houseCosts);
    details.addClass("railroad");
    details.append($("<div>").addClass("mortgage")
                           .html(property.mortgage + "."));
    details.append($("<div>").addClass("copyright")
                .html("&copy;1935 Hasbro, Inc."));

  } else if (property.color === "utility") {
    if (property.title.indexOf("Light") != -1) {
      titleDeed.append($("<div>").addClass("electricImg"));
    } else {
      titleDeed.append($("<div>").addClass("waterImg"));
    }

    titleDeed.append($("<div>").addClass("propertyName")
                 .addClass("utility")
                 .append($("<h1>").html(property.title))
                 .css("color", titleTextColor));
    details = $("<div>").addClass("details")
                        .addClass("utility");
    var houseCosts = $("<div>").addClass("houseCosts");

    costTable = $("<div>").addClass("utilityCostTable");
    costTable.append($("<span>").addClass("utilityText")
                                .html("If one \"Utility\" is owned rent is 4 times amount shown on dice."));
    costTable.append($("<span>").addClass("utilityText")
                                .html("If both \"Utilities\" are owned rent is 10 times amount shown on dice."));
    houseCosts.append(costTable);

    details.append(houseCosts);
    details.append($("<div>").addClass("mortgage")
                           .html(property.mortgage + "."));
    details.append($("<div>").addClass("copyright")
                .html("&copy;1935 Hasbro, Inc."));

  } else { // handle regular property
    titleDeed.append($("<div>").addClass("propertyName")
                 .addClass(property.color)
                 .append($("<h1>").html(property.title))
                 .css("color", titleTextColor));
    details = $("<div>").addClass("details");
    details.append($("<div>").addClass("rentDisplay")
                 .html(property.rent + "."));
    var houseCosts = $("<div>").addClass("houseCosts");

    var costTable = $("<table>");
    costTable.append($("<tr>").append($("<td>").html("With 1 House"),
                      $("<td>").html("$ " + property.onehouse + ".")));
    costTable.append($("<tr>").append($("<td>").html("With 2 Houses"),
                      $("<td>").html(property.twohouse + ".")));
    costTable.append($("<tr>").append($("<td>").html("With 3 Houses"),
                      $("<td>").html(property.threehouse + ".")));
    costTable.append($("<tr>").append($("<td>").html("With 4 Houses"),
                      $("<td>").html(property.fourhouse + ".")));
    houseCosts.append(costTable);
    details.append(houseCosts);

    details.append($("<div>").addClass("hotel")
                           .html(property.hotel + "."));
    details.append($("<div>").addClass("mortgage")
                           .html(property.mortgage + "."));
    details.append($("<div>").addClass("houses")
                           .html(property.housecost + "."));
    details.append($("<div>").addClass("hotelCost")
                           .html(property.hotelcost + "."));
    details.append($("<div>").addClass("monopoly")
                           .html("If a player owns ALL the Lots of any Color-Group, the rent is Doubled on Unimproved Lots in that group."));
    details.append($("<div>").addClass("copyright")
                .html("&copy;1935 Hasbro, Inc."));
  }


  titleDeed.append(details);
  detailedView.append(titleDeed);
  detailedView.hide();
  $("#propDetails").append(detailedView);
  var widthPercent = (document.documentElement.clientWidth * 0.40) / 440;
  var heightPercent = (document.documentElement.clientHeight) / 520;
  var percentScale = (widthPercent > heightPercent) ? heightPercent : widthPercent;
  $("#propDetails .propertyCard").css("-webkit-transform", "scale(" + percentScale + ")");
  $("#propDetails .propertyCard").css("transform", "scale(" + percentScale + ")");
  $("#propDetails .propertyCard").css("-ms-transform", "scale(" + percentScale + ")");

  detailedView.show();
  setupMortgageBtn(prop);
  setupHouseButtons();

  // Send currently viewed property to the server so the board can update
  socket.emit('inspectProperty', {
    fbid: window.fbid,
    property: propertyDatabase[property.title].id
  });
}

// @TODO: Make sure the properties display current data
function displayProperties(properties) {
  var propDiv = $("#propList");
  for (var i = 0; i < properties.length; i++) {
    var prop = properties[i];
    if (!prop) continue;

    var card = prop.card;
    propertyDatabase[card.title] = prop;
    var cell = $("<div>").addClass("propertyCell");
    cell.append($("<div>").addClass("stripe")
                .addClass(card.color));
    cell.append($("<div>").addClass("proptext")
                .addClass("propname")
                .html(card.title));
    var bottom = $("<div>").addClass("cellBottom");
    if (prop.owner === "Unowned") {
      bottom.append($("<span>").addClass("proptext")
                  .addClass("price")
                  .html("$" + card.price));
    } else {
      if (prop.card.color !== "utility") {
        bottom.append($("<span>").addClass("proptext")
                      .addClass("rent")
                      .html("$" + card.rent));
      }
    }
    bottom.append($("<span>").addClass("owner")
                 .html(fbobj.first_name));
    cell.append(bottom);

    (function() {
      var cur_prop = prop;
      var cur_cell = cell;
      cur_cell.click(function() {
        $(".propertyCell.selected").removeClass("selected");
        cur_cell.addClass("selected");
        var thisprop = propertyDatabase[cur_prop.card.title];
        loadDetailedView(thisprop);
      });
    })();

    propDiv.append(cell);
  }
  if (document.documentElement.clientHeight > 268) {
    $("#propList").css("height", document.documentElement.clientHeight);
  }
}

function disablePropertyOptions() {
  $("#houseplusbtn, #houseminusbtn, #mortgagebtn").addClass("unavailable");
}

function enablePropertyOptions() {
  $("#houseplusbtn, #houseminusbtn, #mortgagebtn").removeClass("unavailable");
}

window.addEventListener('load', function() {
  new FastClick(document.body);
}, false);

var setupPage = function() {
  $("#propDetails").css({
    "max-height" : document.documentElement.clientHeight,
    "width" : document.documentElement.clientWidth - $("#propList").width()
  });
  if (inDefault) {
    $("#backBtn").addClass("unavailable");
  } else {
    $("#backbtn").click(function(){
      window.location.replace("mobileHome.html");
    });
  }
  disablePropertyOptions();
  window.scrollTo(0, 1);
  // get property data from the database.
  getProperties();

}
