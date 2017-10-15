var HOST_IP = "192.168.0.12";
//var HOST_IP = "54.183.234.32";
var PEER_PORT = 9000;

var userId, peerId,
    token, peerToken;
var conn, peer;

/**
 *   Function   : confirmBox
 *   Description: Customized confirm box
 *   Arguments  : [IN] title - the title of the confirm box
 *                [IN] act - action
 *                [IN] content - message
 *                [IN] btn1text - button1 (Cancel)
 *                [IN] btn2text - button2 (Ok)
 *                [IN] functionText - JQuery UI function to be called
 *                [IN] parameterList - params passed in (optional)
 *   Returns    : -
 *   Comments   : JQuery UI confirm box
 *
 */
function confirmBox(title, act, content, btn1text, btn2text, 
    functionText, parameterList, callback) {
    var btn1css = (btn1text === '' ? "hidecss" : "showcss");
    var btn2css = (btn2text === '' ? "hidecss" : "showcss");
    $("#lblMessage").html(content);

    $("#dialog").dialog({
        resizable: false,
        title: title,
        modal: true,
        width: '500px',
        height: 'auto',
        bgiframe: false,
        show: {effect: "blind", duration: 300 },
        hide: {effect: 'scale', duration: 400 },
        buttons: [
            {
                text: btn1text,
                "class": btn1css,
                click: function () {
                    $("#dialog").dialog('close');
                    callback(false);
                }
            },
            {
                text: btn2text,
                "class": btn2css,
                click: function () {
                    $("#dialog").dialog('close');
                    callback(true);
                }
            }
        ]
    });
}

function singleConfirmBox(title, act, content, btntext, 
    functionText, parameterList, callback) {
    var btncss = (btntext === '' ? "hidecss" : "showcss");
    $("#lblMessage").html(content);

    $("#dialog").dialog({
        resizable: false,
        title: title,
        modal: true,
        width: '500px',
        height: 'auto',
        bgiframe: false,
        show: {effect: "blind", duration: 300 },
        hide: {effect: 'scale', duration: 400 },
        buttons: [
            {
                text: btntext,
                "class": btncss,
                click: function () {
                    $("#dialog").dialog('close');
                    callback(true);
                }
            }            
        ]
    });
}

function showHint(title, act, content, functionText, parameterList, callback) {
    $("#lblMessage-1").html(content);

    $("#dialog-1").dialog({
        resizable: false,
        closeOnEscape: false,
        title: title,
        modal: true,
        width: '500px',
        height: 'auto',
        bgiframe: false,
        show: {effect: "blind", duration: 300 },
        hide: {effect: 'scale', duration: 400 },
        open: function(e, ui) {
            var foo = $(this);
            setTimeout(function() {
               foo.dialog('close');
            }, 3000);
            $(".ui-dialog-titlebar-close").hide();
        }         
    });
}

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
    if (data.text == '#QUIT#') {
        console.log(data.from + ' left.');
        if (userId !== data.from) {
            var msg = data.from + "退出了视频聊天。";
            singleConfirmBox('提示', '1', msg, '确认', 'Foo', null, function(r) {
                //console.log('quit.');
                updateContactList(function(res) {
                    //console.log('quit-00.');
                    $('#chat').addClass('hidden');
                    $('#room').removeClass('hidden');
                   //console.log(JSON.stringify(res));
                    $(jQuery.parseJSON(JSON.stringify(res))).each(function() {
                        if (userId != this.userId) {
                            showRow(userId, this.userId, this.state);
                        }
                    });
                });
            });
        }
        return;
    }

    var orientation = "text-left";
    var msgcolor = "msg-color-blue";
    var backcolor = "msg-board";

    // If the message is yours, set text to right
    if(data.from == userId) {
        orientation = "text-right";
        msgcolor = "msg-color-purple";
        backcolor = "msg-board-color";
    }

    var messageHTML =  '<div class="list-group-item ' + backcolor + '">';
        messageHTML += '<h4 class="list-group-item-heading ' + msgcolor + '">' + data.from +'</h4>';
        messageHTML += '<p class="list-group-item-text">'+ data.text +'</p>';
        messageHTML += '</div><br>';

    $('#messages').append(messageHTML);
    $('#messages').scrollTop($('#messages')[0].scrollHeight);
}

// handle oncoming calls.
function handleCall(uid, pid, state) {
    //console.log(peerId + '->' + state);
    if (state === '1' && pid !== uid) {
        console.log('Calling to ' + pid);
        getToken(pid, function(token) {
            console.log('peerId/peerToken: ' + pid + '->' + token);
            conn = peer.connect(token, {
                metadata : { 'userId': userId }
            });
            conn.on('data', handleMessage);

            console.log(peer);
            var call = peer.call(token, window.localStream);

            call.on('stream', function (stream) {
                window.peer_stream = stream;
                onReceiveStream(stream, 'peer-camera');
                console.log("handleCall: call started.");
                $('#room').addClass('hidden');
                $('#chat').removeClass('hidden');
            });

            // Handle when the call finishes
            call.on('close', function(){
                console.log("handleCall: call ended.");               
                closeChannel(uid, pid);
            });
            var msg = "您已向" + pid + "发出视频邀请，请等待回应...";
            showHint('提示', '1', msg, 'Foo', null, function(res) {});
        });
    }
}

// show one row of the list
function showRow(uid, pid, state) {
    var callcolor = (state === '1' ? 'green' : 'red');
    var listHTML = '<div class="list-board"><span class="cbutton-call" onClick="handleCall(\'' + uid + '\', \'' + pid + '\', \'' + state + '\')"><i class="fa fa-2x fa-phone-square" style="color:' + callcolor + '"></i></span>';
        listHTML += '<span class="contact-name">' + pid + '&nbsp;&nbsp;&#x2729;&#x2729;&#x2729;主任医师</span></div>';
    $('#contactlist').append(listHTML);
}

// update contact list
function updateContactList(callback) {
    $('#contactlist').html('');
    $.ajax({
        type: "GET",
        url: '/api/userstate',
        async: false,
        success: function (res) {
            callback(res);
        },
        error: function () {}
    });
}

// get random token by userid
function getToken(uid, callback) {
    //console.log('getToken called.');
    $.ajax({
        type: "GET",
        url: "/api/users/" + uid,
        success: function (token) {
            //console.log('getToken: ' + JSON.stringify(token));
            callback(token);
        },
        error: function () {}
    });
}

// get userid by token
function getUserId(token, callback) {
    //console.log('getUserId called.');
    $.ajax({
        type: "GET",
        url: "/api/tokens/" + token,
        success: function (uid) {
            //console.log('getUserId: ' + JSON.stringify(uid));
            callback(uid);
        },
        error: function () {}
    });
}

// leave chat room
function leaveRoom(uid) {
    //console.log('leave called.');
    if (uid) {
        var dataSend = {userId: uid};
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
}

// close chat channel.
function closeChannel(uid, pid) {
    //console.log('closeChannel called.');
    if (uid && pid) {
        leaveRoom(uid);
        var dataSend = {userId: pid};
        $.ajax({
            type: "POST",
            url: "/api/close",
            dataType: 'json',
            data: dataSend,
            success: function (res) {
                //console.log(userId + ' left.');
            },
            error: function () {}
        });
    }
}

// open chat channel.
function openChannel(uid, pid) {
    //console.log('openChannel called.');
    console.log('openChannel: userId/peerId: ' + uid + '/' + pid);
    if (uid && pid) {
        var dataSend = {userId: uid, peerId: pid};
        $.ajax({
            type: "POST",
            url: "/api/join",
            dataType: 'json',
            data: dataSend,
            success: function (res) {
                //console.log(userId + ' left.');
            },
            error: function () {}
        });
    }
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

    // once the initialization succeeds:
    // show the ID that allows other user to connect to your session.
    peer.on('open', function () {
        token = peer.id;
    });

    peer.on('close', function () {
        conn = null;
        peer = null;
    });

    // when someone connects to your session:
    // hide the peer_id field of the connection form and set automatically its value
    // as the peer of the user that requested the connection.
    peer.on('connection', function (connection) {
        conn = connection;
        //peerToken = connection.peer;

        // use the handleMessage to callback when a message comes in
        conn.on('data', handleMessage);
        console.log('connected.');
    });

    // handle errors
    peer.on('error', function(err){
        //alert("An error ocurred with peer: " + err);
        var msg = "网络连接错误，请稍后重试。";
        singleConfirmBox('提示', '1', msg, '确认', 'Foo', null, function(res) {});
        
        leaveRoom(userId);
        console.error(err);

        $('#chat').addClass('hidden');
        $('#room').addClass('hidden');
        $('#login').removeClass('hidden');
    });

    // handle onReceive call event
    peer.on('call', function (call) {
        peerToken = call.peer;        
        getUserId(peerToken, function(pid) {
            peerId = pid;
            //var acceptCall = confirm("Videocall incoming, do you want to accept it?");
            var msg = peerId + "发出视频邀请，您是否接受？";
            confirmBox('提示', '1', msg, '取消', '接受', 'Foo', null, function(res) {
                if (res) {
                    // answer the call with your own video/audio stream
                    call.answer(window.localStream);

                    // receive data
                    call.on('stream', function (stream) {
                        // store a global reference of the other user stream
                        window.peer_stream = stream;
                        // display the stream of the other user in the peer-camera video element
                        onReceiveStream(stream, 'peer-camera');
                        console.log('onCall: call started.');
                    });

                    // Handle when the call ends
                    call.on('close', function(){
                        console.log("onCall: call ended.");
                        closeChannel(userId, peerId);
                    });

                    openChannel(userId, peerId);
                    $('#room').addClass('hidden');
                    $('#chat').removeClass('hidden');
                } else {
                    console.log("onCall: call denied.");
                }
            });
        });
    });

    // handle joining the room
    function joinRoom() {
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
                        $(jQuery.parseJSON(JSON.stringify(res))).each(function() {
                            if (userId != this.userId) {
                                showRow(userId, this.userId, this.state);
                            }
                        });
                    });
                },
                error: function () {
                    console.log('joinRoom: error.');
                }
            });
        } else {
            //alert("Please enter your nickname.");
            var msg = "请输入您的昵称。";
            singleConfirmBox('提示', '1', msg, '确认', 'Foo', null, function(res) {});
            return false;
        }
    }

    // handle sending messages
    function sendMessage() {
        // message to be sent
        var text = $('#message').val();

        // prepare the data to send
        var data = {
            from: userId,
            text: text
        };

        // send the message
        conn.send(data);

        // handle the message on UI
        handleMessage(data);
        $('#message').val('');
    }

    // close the channel
    function closeMessage(uid) {
        //console.log('closeMessage: ' + uid);
        // prepare the data to send
        var data = {
            from: uid,
            text: '#QUIT#'
        };

        // send the message
        conn.send(data);

        // handle close message
        handleMessage(data);
    }

    // handle the send message button
    $('#send-btn').click(function() {
        sendMessage();
    });

    // on keypress when entering message
    $('#message').on('keypress', function (e) {
         if(e.which === 13){
            //Disable textbox to prevent multiple submit
            $(this).attr("disabled", "disabled");
            sendMessage();
            //Enable the textbox again if needed.
            $(this).removeAttr("disabled");
         }
    });

    // on click the JOIN button, register the user
    $('#login-btn').click(function() {
        joinRoom();
    });

    // on keypress when entering nickname
    $('#name').on('keypress', function (e) {
         if(e.which === 13){
            //Disable textbox to prevent multiple submit
            $(this).attr("disabled", "disabled");
            joinRoom();
            //Enable the textbox again if needed.
            $(this).removeAttr("disabled");
         }
    });

    // on click the LEAVE button
    $('#leave-btn').click(function() {
        var msg = "您是否要退出视频聊天？";
        confirmBox('提示', '', msg, '取消', '确认', 'Foo', null, function(res) {
            if (res) {
                console.log("Call ended.");
                closeChannel(userId, peerId);
                closeMessage(userId);
                $('#chat').addClass('hidden');
                $('#login').removeClass('hidden');
            } else {
                // do nothing
            }
        });
    });

    window.onbeforeunload = function(e) {
        if (e) {
            var msg = "您是否要退出聊天系统？";
            confirmBox('提示', '', msg, '取消', '确认', 'Foo', null, function(res) {
                if (res) {
                    closeChannel(userId, peerId);
                }
            });
        }
    };
    
    // initialize application by requesting local video
    requestLocalVideo({
        success: function(stream){
            window.localStream = stream;
            onReceiveStream(stream, 'my-camera');
        },
        error: function(err){
            //alert("Cannot get access to your camera.");
            var msg = "无法连接视频设备, 请稍后重试。";
            singleConfirmBox('提示', '1', msg, '确认', 'Foo', null, function(res) {});
            console.error(err);
        }
    });
}, false);
