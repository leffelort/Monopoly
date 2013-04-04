// ========================
// ==== Express server ====
// ========================
var express = require("express");
var app = express();
app.get("/static/:staticFilename", function (request, response) {
  response.sendfile("static/" + request.params.staticFilename);
});
app.listen(8889);



// ========================
// === Socket.io server ===
// ========================

var io = require('socket.io').listen(8888);
io.sockets.on("connection", function(socket) {
  socket.on('msg', function(data) {
    socket.emit('status', { success: 'true'});
	io.sockets.emit('newmsg', { body: data.body });
  });
});