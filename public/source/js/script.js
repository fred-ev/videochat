// global map that stores username and peer id
var map = {};
var count = 0;

function getLongPeerId(key) {
    return map[key];
}

// When the DOM is ready
document.addEventListener("DOMContentLoaded", function(event) {
    var peerId;
    var userName;
    var conn;

    /**
     * Important: the host needs to be changed according to your requirements.
     * e.g if you want to access the Peer server from another device, the
     * host would be the IP of your host namely 192.xxx.xxx.xx instead
     * of localhost.
     */
    var peer = new Peer({
        host: "192.168.1.73",
        port: 9000,
        path: '/peerjs',
        debug: 1,
        config: {
            'iceServers': [
                { url: 'stun:stun1.l.google.com:19302' },
                {
                    url: 'turn:numb.viagenie.ca',
                    credential: 'muazkh',
                    username: 'webrtc@live.com'
                }
            ]
        }
    });

    // Once the initialization succeeds:
    // Show the ID that allows other user to connect to your session.
    peer.on('open', function () {
        count++;
        var userId = 'test' + count;
        map['userId'] = peer.id;
        //document.getElementById("peer-id-label").innerHTML = peer.id;
        document.getElementById("peer-id-label").innerHTML = userId;
        console.log('----- userId / peerId: ' + userId + '/' + peer.id);
    });

    // When someone connects to your session:
    // Hide the peer_id field of the connection form and set automatically its value
    // as the peer of the user that requested the connection.
    peer.on('connection', function (connection) {
        conn = connection;
        peerId = connection.peer;

        // Use the handleMessage to callback when a message comes in
        conn.on('data', handleMessage);

        // Hide peer_id field and set the incoming peer id as value
        document.getElementById("peer_id").className += " hidden";
        document.getElementById("peer_id").value = peerId;
        document.getElementById("connected_peer").innerHTML = connection.metadata.username;
    });

    peer.on('error', function(err){
        alert("An error ocurred with peer: " + err);
        console.error(err);
    });

    /**
     * Handle the on receive call event
     */
    peer.on('call', function (call) {
        var acceptsCall = confirm("Videocall incoming, do you want to accept it?");

        if(acceptsCall){
            // Answer the call with your own video/audio stream
            call.answer(window.localStream);

            // Receive data
            call.on('stream', function (stream) {
                // Store a global reference of the other user stream
                window.peer_stream = stream;
                // Display the stream of the other user in the peer-camera video element !
                onReceiveStream(stream, 'peer-camera');
            });

            // Handle when the call finishes
            call.on('close', function(){
                alert("Video call ended.");
            });

            // use call.close() to finish a call
        }else{
            console.log("Call denied.");
        }
    });

    /**
     * Starts the request of the camera and microphone
     *
     * @param {Object} callbacks
     */
    function requestLocalVideo(callbacks) {
        // Monkeypatch for crossbrowser geusermedia
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

        // Request audio and video
        navigator.getUserMedia({ audio: false, video: true }, callbacks.success , callbacks.error);
    }

    /**
     * Handle the providen stream (video & audio) to the desired video element
     *
     * @param {*} stream
     * @param {*} element_id
     */
    function onReceiveStream(stream, element_id) {
        // Retrieve the video element according to the desired
        var video = document.getElementById(element_id);
        // Set the given stream as the video source
        video.src = window.URL.createObjectURL(stream);

        // Store a global reference of the stream
        window.peer_stream = stream;
    }

    /**
     * Appends the received and sent message to the listview
     *
     * @param {Object} data
     */
    function handleMessage(data) {
        var orientation = "text-left";

        // If the message is yours, set text to right !
        if(data.from == userName){
            orientation = "text-right"
        }

        var messageHTML =  '<a href="javascript:void(0);" class="list-group-item' + orientation + '">';
                messageHTML += '<h4 class="list-group-item-heading">'+ data.from +'</h4>';
                messageHTML += '<p class="list-group-item-text">'+ data.text +'</p>';
            messageHTML += '</a>';

        document.getElementById("messages").innerHTML += messageHTML;
    }

    /**
     * Handle the send message button
     */
    document.getElementById("send-message").addEventListener("click", function(){
        // Message to be sent
        var text = document.getElementById("message").value;

        // Prepare the data to send
        var data = {
            from: userName,
            text: text
        };

        // Send the message
        conn.send(data);

        // Handle the message on UI
        handleMessage(data);

        document.getElementById("message").value = "";
    }, false);

    /**
     *  Request a videocall
     */
    document.getElementById("call").addEventListener("click", function(){
        console.log('Calling to ' + peerId);
        console.log(peer);

        //var call = peer.call(peer_id, window.localStream);
        var call = peer.call(getLongPeerId(peerId), window.localStream);

        call.on('stream', function (stream) {
            window.peer_stream = stream;
            onReceiveStream(stream, 'peer-camera');
        });
    }, false);

    /**
     * On click the connect button, initialize connection with peer
     */
    document.getElementById("connect-to-peer-btn").addEventListener("click", function(){
        userName = document.getElementById("name").value;
        peerId = document.getElementById("peer_id").value;

        if (peerId) {
            /*conn = peer.connect(peer_id, {
                metadata: {
                    'username': username
                }
            });*/
            conn = peer.connect(getPeerId(peerId), {
                metadata: {
                    'username': userName
                }
            });

            conn.on('data', handleMessage);
        }else{
            alert("Please provide a peer to connect with.");
            return false;
        }

        document.getElementById("chat").className = "";
        document.getElementById("connection-form").className += " hidden";
    }, false);

    /**
     * Initialize application by requesting local video.
     */
    requestLocalVideo({
        success: function(stream){
            window.localStream = stream;
            onReceiveStream(stream, 'my-camera');
        },
        error: function(err){
            alert("Cannot get access to your camera.");
            console.error(err);
        }
    });
}, false);
