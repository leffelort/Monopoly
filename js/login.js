$(document).ready(function() {
  $(".buttons").hide();
  $(".facebookLogin").show();
  $("#facebookLoginButton").click(function() {
    FB.getLoginStatus(function(response) {
      if (response.status === 'connected') {
        $(".facebookLogin").hide();
        $(".buttons").show();
      } else {
        // FB SDK handles login and all the stuffz.
      }
    });
  });
});