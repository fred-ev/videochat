/**
 * This script starts a https server accessible at https://youripaddresss:8443
 * to test the chat.
 */
var HTTP_PORT = 8080;
var HTTPS_PORT = 8443;
var MONGO_URL = "mongodb://localhost:27017/webrtc";

var fs     = require('fs');
var http   = require('http');
var https  = require('https');
var path   = require("path");
var os     = require('os');
var bodyParser = require('body-parser');
var ifaces = os.networkInterfaces();

// Public Self-signed Certificates for HTTPS connection
var privateKey  = fs.readFileSync('./../ssl/key.pem', 'utf8');
var certificate = fs.readFileSync('./../ssl/cert.pem', 'utf8');

var credentials = {key: privateKey, cert: certificate};
var express = require('express');
var app = express();

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

// mongodb
var db;
var MongoClient = require('mongodb').MongoClient;

// get user random token
function getToken(userId, callback) {
    db.collection('Users').findOne({'userId': userId}, {'token' : 1}, function(err, res){
        if(err) {
            console.log(err);
        } 
        if (res) {
            callback(res.token);
        } else {
            console.log('getToken error.');
        }
    });
}

// get user state
function getState(callback) {
    //db.collection('Users').find({ userId: { $not: '0' } }, {'userId': 1, 'state' : 1}, function(err, res){
    db.collection('Users').find({ state: { $nin : ['0'] } }, {'userId': 1, 'state' : 1}).toArray(function(err, res) {
        if(err) {
            console.log(err);
        } 
        if (res) {
            callback(res);
        } else {
            console.log('getState error.');
            callback("ERROR");
        }
    });
}

// save user
function saveUser(req, callback) {
    db.collection('Users').findOneAndUpdate(
        { "userId" : req.body.userId },
        { $set: { "userId" : req.body.userId, "token" : req.body.token, "state" : '1'} },
        { upsert:true, returnNewDocument : true }, function(err, res){
        
        if(err) {
            console.log(err);
        } 
        if (res) {
            callback(res);
        } else {
            console.log('saveUser error.');
        }
    });
}

/**
 *  Show in the console the URL access for other devices in the network
 */
Object.keys(ifaces).forEach(function (ifname) {
    var alias = 0;

    ifaces[ifname].forEach(function (iface) {
        if ('IPv4' !== iface.family || iface.internal !== false) {
            // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
            return;
        }
        
        console.log("");
        console.log("Welcome to the Chat Sandbox");
        console.log("");
        console.log("Test the chat interface from this device at : ", "https://localhost:8443");
        console.log("");
        console.log("And access the chat sandbox from another device through LAN using any of the IPS:");
        console.log("Important: Node.js needs to accept inbound connections through the Host Firewall");
        console.log("");

        if (alias > 0) {
            console.log("Multiple ipv4 addreses were found ... ");
            // this single interface has multiple ipv4 addresses
            console.log(ifname + ':' + alias, "https://"+ iface.address + ":8443");
        } else {
            // this interface has only one ipv4 adress
            console.log(ifname, "https://"+ iface.address + ":8443");
        }

        ++alias;
    });
});

// Allow access from all the devices of the network (as long as connections are allowed by the firewall)
var LANAccess = "0.0.0.0";

//Establish DB connection
MongoClient.connect(MONGO_URL, function (err, database) {
    if (err) 
        throw err;
    else
    {
        db = database;
        console.log('MongoDB connected.');

        //Start app only after connection is ready
        httpServer.listen(HTTP_PORT, LANAccess); // http
        httpsServer.listen(HTTPS_PORT, LANAccess); // https
    }
 });

// Expose the css and js resources as "resources"
app.use('/resources', express.static('./source'));
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname+'/index.html'));
});

// GET http://x.x.x.x:8443/api/users/chris, get token
app.get('/api/users/:userId', function(req, res) {
    getToken(req.params.userId, function(token) {
        //console.log('GetToken api: ' + token);
        res.send(token);
    });
});

// GET http://x.x.x.x:8443/api/userstate, get user state
app.get('/api/userstate', function(req, res) {
    getState(function(state) {
        res.send(state);
    });
});

// POST http://x.x.x.x:8443/api/updateusers, parameters sent with 
app.post('/api/updateusers', function(req, res) {
    saveUser(req, function(result) {
        res.send(result);
    });
});

// POST http://x.x.x.x:8443/api/leave, parameters sent with 
app.post('/api/leave', function(req, res) {
    db.collection('Users').updateOne(
        { "userId" : req.body.userId },
        { $set: { "state" : '0'} }, function(err, res){
        
        if(err) {
            console.log(err);
        } 
        if (res) {
            //console.log(req.body.userId + ' left.');
        } else {
            console.log('saveUser error.');
            //res.send("ERROR");
        }
    });
});

