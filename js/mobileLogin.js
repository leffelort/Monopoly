$(document).ready(function () {
  var socket = io.connect('http://localhost:8686');
  $("#codeSubmit").click(function (event) {
	var code = $("#codeInput").val();
	socket.emit('code', {body: code});
  });
});