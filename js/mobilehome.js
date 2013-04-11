var fbobj = undefined;

function loadFBData() {
  var infodiv = $("#playerinfo");
  var name = fbobj.name;
  var picurl = "https://graph.facebook.com/" + fbobj.username + "/picture?width=70&height=70"
  var info = $("<div>").addClass("infoList");
  info.append($("<li>").addClass("infoitem").html("<span class='playerdisp'>Player 1:</span> " + name));
  var moneydisp = $("<li>").addClass("infoitem").addClass("moneydisp").html("$1500");
  info.append(moneydisp);

  var getoutcards = $("<div>").attr("id", "getoutcards");
  var getoutchance = $("<div>").attr({
    "class" : "getout",
    "id" : "getoutchance"
  });
  var getouttext = "<p>OUT OF<p><p>JAIL FREE</p>"
  getoutchance.html(getouttext);
  var getoutcommunity = $("<div>").attr({
    "class" : "getout",
    "id" : "getoutcommunity"
  });
  getoutcommunity.html(getouttext);
  getoutcards.append(getoutchance);

  moneydisp.append(getoutchance);
  
  // add the profile picture and offset it to line it up with the roll button.
  // The + 2 is for the image border.
  var profilepic = $("<img>").attr("src", picurl).css("left", $("#rollbtn").offset().left + 2);
  infodiv.append(profilepic)
         .append(info);
  infodiv.append(getoutcards);
  getoutcards.css("right", $(window).width() - $("#tradebtn").offset().left - $("#tradebtn").width() - 2);

  info.css("left", profilepic.offset().left + profilepic.width() + 20);
  window.scrollTo(0, 1);
}  

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
        window.fbobj = response;
        loadFBData();
      });
    } else {
      // not_authorized
      alert("You are not logged in");
      window.location.replace("desktop.html");
    }
  });
};

  // Load the SDK Asynchronously
  (function(d){
     var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
     if (d.getElementById(id)) {return;}
     js = d.createElement('script'); js.id = id; js.async = true;
     js.src = "//connect.facebook.net/en_US/all.js";
     ref.parentNode.insertBefore(js, ref);
   }(document));

$(document).ready(function() {
  window.addEventListener('load', function() {
    new FastClick(document.body);
  }, false);

  // hacky way to resize the view properly.
  var initialHeight = $("#gameButtons").height();
  $("#content").height($(window).height() + 60);

  $("#inspectbtn").click(function() {
    window.location = "/inspect.html";
  });
});

