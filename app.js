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

app.get("/properties", function(req, resp) {
	var userid = req.body.userid;
	var gameid = req.body.gameid;
	getPropertiesFromDatabase(function(obj){ 
		console.log(obj);
		resp.send({
			props : obj,
			success:true
		});
	});
});

var mongo = require('mongodb');
var host = 'localhost';
var port = mongo.Connection.DEFAULT_PORT;

var options = {w : 1};
var dbName = 'monopoly';

var client = new mongo.Db(
		dbName,
		new mongo.Server(host, port),
		options
	);

function getPropertiesFromDatabase(onOpen) {

	client.open(onDbReady);

	function onDbReady(error) {
		if (error) 
			throw error;
		client.collection('properties', onPropertyCollectionReady);
	}

	function logger(error, result) {
		if (error)
			throw error;
		console.log(result);
	}

	function onPropertyCollectionReady(error, propertyCollection) {
		if (error)
			throw error;
		var props = propertyCollection.find({}).toArray(function(err, array) {
			console.log(array);
			onOpen(array);
			closeDb();
		});
	}
}

function closeDb() {
	client.close();
}

app.listen(11611);



// ========================
// === Socket.io server ===
// ========================

var io = require('socket.io').listen(8686);

io.sockets.on('connection', function (socket) {
  socket.on('code', function (data) {console.log(data)});
  socket.on('disconnect', function () { });
});

