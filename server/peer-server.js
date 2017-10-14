var PEER_PORT = 9000;
// include nodeJS file system module
var fs = require('fs');

// signaling (peer) server
var PeerServer = require('peer').PeerServer;

// peer server uses 9000 port # by default.
var server = PeerServer({
    port: PEER_PORT,
    path: '/peerjs',
    ssl: {
        key: fs.readFileSync('./../ssl/key.pem', 'utf8'),
        cert: fs.readFileSync('./../ssl/cert.pem', 'utf8')
    }
});
