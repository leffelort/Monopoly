var propertyDatabase = undefined;
var setupPage;

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
        socket = io.connect(window.location.hostname);
        socket.emit('reopen', response); // tell the server who we are.
        setupPage();
      });
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

function getProperties() {
	$.ajax({
		type: "get",
		data: {"userid" : "whatever", "gameid" : "whatever"},
		url: "/properties",
		success: function(data) {
			if (data.success === true) {
				displayProperties(data.props);
			} else {
				console.log("error");
			}
		}
	});
}

function loadDetailedView(property) {
	$("#propDetails").html(" ");
	var detailedView = $("<div>").addClass("propertyCard");
	var titleDeed = $("<div>").addClass("titleDeed");
	titleDeed.append($("<div>").addClass("propertyName")
							   .addClass(property.color)
							   .append($("<h1>").html(property.title))
							   );
	var details = $("<div>").addClass("details");
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

	titleDeed.append(details);
	detailedView.append(titleDeed);
	detailedView.hide();
	$("#propDetails").append(detailedView);
	var percentScale = (document.documentElement.clientWidth * 0.40) / 440;
	$("#propDetails .propertyCard").css("-webkit-transform", "scale(" + percentScale + ")");
	detailedView.show();
}


// @TODO: Make sure the properties display current data
function displayProperties(properties) {
	var propDiv = $("#propList");
	propertyDatabase = properties;
	for (var i = 0; i < properties.length; i++) {
		var prop = properties[i];
		propertyDatabase[prop.title] = prop;
		var cell = $("<div>").addClass("propertyCell");
		cell.append($("<div>").addClass("stripe")
							  .addClass(prop.color));
		cell.append($("<div>").addClass("proptext")
							  .addClass("propname")
							  .html(prop.title));
		var bottom = $("<div>").addClass("cellBottom");
		bottom.append($("<span>").addClass("proptext")
							  .addClass("price")
							  .html("$" + prop.price));
		bottom.append($("<span>").addClass("owner")
							   .html("Unowned"));
		cell.append(bottom);

		(function() {
			var cur_prop = prop;
			var cur_cell = cell;
			cur_cell.click(function() {
				$(".propertyCell.selected").removeClass("selected");
				cur_cell.addClass("selected");
				loadDetailedView(propertyDatabase[cur_prop.title]);
			});
		})();
		
		propDiv.append(cell);
	}
	$("#propList").css("height", document.documentElement.clientHeight + 60);
}

var setupPage = function() {
	window.addEventListener('load', function() {
    	new FastClick(document.body);
	}, false);
	$("#propDetails").css({
		"height" : document.documentElement.clientHeight + 60,
		"width" : document.documentElement.clientWidth - $("#propList").width()
	});
	window.scrollTo(0, 1);
	// get property data from the database.
	getProperties();

}