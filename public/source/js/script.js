var HOST_IP = "192.168.1.79";
var PEER_PORT = 9000;

var userId, peerId, peer,
    token, peerToken;
var conn;

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
    if (video) {
        video.src = window.URL.createObjectURL(stream);
    }

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
    var msgcolor = "msg-color-blue";

    // If the message is yours, set text to right
    if(data.from == userId) {
        orientation = "text-right";
        msgcolor = "msg-color-purple";
    }

    var messageHTML =  '<div class="list-group-item msg-board">';
        messageHTML += '<h4 class="list-group-item-heading ' + msgcolor + '">' + data.from +'</h4>';
        messageHTML += '<p class="list-group-item-text">'+ data.text +'</p>';
        messageHTML += '</div><br>';

    $('#messages').append(messageHTML);
    $('#messages').scrollTop($('#messages')[0].scrollHeight);
}

function handleCall(userId, peerId, state) {
    //console.log(peerId + '->' + state);
    if (state === '1' && peerId !== userId) {
        console.log('Calling to ' + peerId);
        //if (peerToken === undefined || peerToken == null) {
        getToken(peerId, function(token) {
            console.log('peerId/peerToken: ' + peerId + '->' + token);
            conn = peer.connect(token, {
                metadata : { 'userId': userId }
            });
            conn.on('data', handleMessage);

            console.log(peer);
            var call = peer.call(token, window.localStream);

            call.on('stream', function (stream) {
                window.peer_stream = stream;
                onReceiveStream(stream, 'peer-camera');
            });

            $('#room').addClass('hidden');
            $('#chat').removeClass('hidden');
        });
    }
}

function showRow(userId, peerId, state) {
    var callcolor = (state === '1' ? 'green' : 'red');
    var listHTML = '<div class="list-board"><span class="cbutton-call" onClick="handleCall(\'' + userId + '\', \'' + peerId + '\', \'' + state + '\')"><i class="fa fa-2x fa-phone-square" style="color:' + callcolor + '"></i></span>';
        listHTML += '<span class="contact-name">' + peerId + '&nbsp;&nbsp;&#x2729;&#x2729;&#x2729;主任医师</span></div>';
    $('#contactlist').append(listHTML);
}

function updateContactList(callback) {
    $.ajax({
        type: "GET",
        url: '/api/userstate',
        dataType: "json",
        success: function (res) {
            callback(res);
        },
        error: function () {}
    });
}

// get random token by userid
function getToken(userId, callback) {
    //console.log('getToken called.');
    $.ajax({
        type: "GET",
        url: "/api/users/" + userId,
        success: function (token) {
            //console.log('getToken: ' + JSON.stringify(token));
            callback(token);
        },
        error: function () {}
    });
}

// leave chat room
function leave(userId) {
    //console.log('leave called.');
    var dataSend = {userId: userId};
    $.ajax({
        type: "POST",
        url: "/api/leave",
        dataType: 'json',
        data: dataSend,
        success: function (res) {
            //console.log(userId + ' left.');
        },
        error: function () {}
    });
}

// When the DOM is ready
$( document ).ready(function(event) {
    /**
     * Important: the host needs to be changed according to your requirements.
     * e.g if you want to access the Peer server from another device, the
     * host would be the IP of your host namely 192.xxx.xxx.xx instead
     * of localhost.
     */
    peer = new Peer({
        host: HOST_IP,
        port: PEER_PORT,
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
        token = peer.id;
        //console.log('token: ' + token);
    });

    // When someone connects to your session:
    // Hide the peer_id field of the connection form and set automatically its value
    // as the peer of the user that requested the connection.
    peer.on('connection', function (connection) {
        conn = connection;
        peerToken = connection.peer;

        // Use the handleMessage to callback when a message comes in
        conn.on('data', handleMessage);

        // Hide peer_id field and set the incoming peer id as value
        //$('#connected_peer').html(connection.metadata.userId);
        $('#room').addClass('hidden');
        $('#chat').removeClass('hidden');
        console.log('connected.');
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
                console.log('video call started.');
            });

            // Handle when the call finishes
            call.on('close', function(){
                alert("Video call ended.");
            });

            // use call.close() to finish a call
        } else {
            console.log("Call denied.");
        }
    });

    function join() {
        userId = $('#name').val();
        if (userId && token) {
             var dataSend = {userId: userId, token: token};
             $.ajax({
                type: "POST",
                url: "/api/updateusers",
                data: dataSend,
                dataType: "json",
                success: function (res) {
                    //console.log('saveUser: success.');
                    updateContactList(function(res) {
                        $('#login').addClass('hidden');
                        $('#room').removeClass('hidden');
                        //$('#chat').removeClass('hidden');
                        $(jQuery.parseJSON(JSON.stringify(res))).each(function() {  
                            showRow(userId, this.userId, this.state);
                        });
                    });
                },
                error: function () {
                    console.log('saveUser: error.');
                }
            });
        } else {
            alert("Please enter your nickname.");
            return false;
        }
    }

    function send() {
        // Message to be sent
        var text = $('#message').val();

        // Prepare the data to send
        var data = {
            from: userId,
            text: text
        };

        // Send the message
        conn.send(data);

        // Handle the message on UI
        handleMessage(data);

        $('#message').val('');
    }

    /**
     * Handle the send message button
     */
    $('#send-btn').click(function() {
        send();
    });

    $('#message').on('keypress', function (e) {
         if(e.which === 13){
            //Disable textbox to prevent multiple submit
            $(this).attr("disabled", "disabled");
            send();
            //Enable the textbox again if needed.
            $(this).removeAttr("disabled");
         }
    });

    /**
     * On click the join button, register the user
     */
    $('#login-btn').click(function() {
        join();
    });

    $('#name').on('keypress', function (e) {
         if(e.which === 13){
            //Disable textbox to prevent multiple submit
            $(this).attr("disabled", "disabled");
            join();
            //Enable the textbox again if needed.
            $(this).removeAttr("disabled");
         }
    });

    $('#leave-btn').click(function() {
        leave(userId);
        $('#chat').addClass('hidden');
        $('#login').removeClass('hidden');
    });

     /**
     *  Request a videocall
     */
    /*$('#call-btn').click(function() {
        console.log('Calling to ' + peerId);
        console.log(peer);

        var call = peer.call(peerToken, window.localStream);

        call.on('stream', function (stream) {
            window.peer_stream = stream;
            onReceiveStream(stream, 'peer-camera');
        });

        $('#video').removeClass('hidden');
    });*/
 
    /*$('#connect-to-peer-btn').click(function() {  
        peerId = $('#peer_id').val();      

        if (peerId) {
            if (peerToken === undefined || peerToken == null) {
                getToken(peerId, function(res) {
                    console.log('peerId/peerToken: ' + peerId + '->' + res);
                    peerToken = res;
                    conn = peer.connect(peerToken, {
                        metadata : { 'userId': userId }
                    });
                    conn.on('data', handleMessage);
                });
            } else {
                conn = peer.connect(peerToken, {
                        metadata : { 'userId': userId }
                    });
                conn.on('data', handleMessage);
            }
        } else {
            alert("Please provide a peer to chat with.");
            return false;
        }

        //$('#finduser').addClass('hidden');
        //$('#chat').removeClass('hidden');
    });*/

    /**
     * Starts the request of the camera and microphone
     *
     * @param {Object} callbacks
     */
    /*function requestLocalVideo(callbacks) {
        // Monkeypatch for crossbrowser geusermedia
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

        // Request audio and video
        navigator.getUserMedia({ audio: false, video: true }, callbacks.success , callbacks.error);
    }*/

    /**
     * Handle the providen stream (video & audio) to the desired video element
     *
     * @param {*} stream
     * @param {*} element_id
     */
    /*function onReceiveStream(stream, element_id) {
        // Retrieve the video element according to the desired
        var video = document.getElementById(element_id);
        // Set the given stream as the video source
        if (video) {
            video.src = window.URL.createObjectURL(stream);
        }

        // Store a global reference of the stream
        window.peer_stream = stream;
    }*/

    /**
     * Appends the received and sent message to the listview
     *
     * @param {Object} data
     */
    /*function handleMessage(data) {
        var orientation = "text-left";

        // If the message is yours, set text to right
        if(data.from == userId) {
            orientation = "text-right";
        }

        var messageHTML =  '<a href="javascript:void(0);" class="list-group-item' + orientation + '">';
            messageHTML += '<h4 class="list-group-item-heading">'+ data.from +'</h4>';
            messageHTML += '<p class="list-group-item-text">'+ data.text +'</p>';
            messageHTML += '</a>';

        $('#messages').append(messageHTML);
    }*/

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
