  // Additional JS functions here
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
  		} else if (response.status === 'not_authorized') {
  		  // not_authorized
  		  login();
  		} else {
  		  // not_logged_in
  		  login();
  		}
 	});
    // Additional init code here

  };

  // Load the SDK Asynchronously
  (function(d){
     var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
     if (d.getElementById(id)) {return;}
     js = d.createElement('script'); js.id = id; js.async = true;
     js.src = "//connect.facebook.net/en_US/all.js";
     ref.parentNode.insertBefore(js, ref);
   }(document));

  function login() {
    FB.login(function(response) {
        if (response.authResponse) {
            // connected
        } else {
            // cancelled
        }
    })};
	}