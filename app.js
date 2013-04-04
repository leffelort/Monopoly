// ========================
// ==== Express server ====
// ========================
var express = require("express");
var app = express();
var fs = require("fs");


app.use(express.bodyParser());

app.configure(function(){
  app.use(express.static(__dirname));
});
/*
app.get("/:staticFilename", function (request, response) {
  response.sendfile(request.params.staticFilename);
});
*/


app.listen(11611);



// ========================
// === Socket.io server ===
// ========================

var io = require('socket.io').listen(8686);

io.sockets.on('connection', function (socket) {
 socket.on('code', function (data) {console.log(data)});
  socket.on('disconnect', function () { });
});