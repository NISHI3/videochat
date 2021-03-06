const localVideo = document.getElementById('local_video');
const remoteVideo = document.getElementById('remote_video');
const textForSendSdp = document.getElementById('text_for_send_sdp');
const textToReceiveSdp = document.getElementById('text_for_receive_sdp');
let localStream = null;
let peerConnection = null;

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;

function startVideo() {
    // getDeviceStream({ video: true, audio: true })
    getScreen()
        .then(function(stream) {
            // // playVideo(localVideo, stream);
            // attachMediaStream_($('#local_video')[0], stream);
            // localStream = stream;
        })
        .catch(function(error) {
            console.error('mediaDevice.getUserMedia() error:', error);
            return;
        });
}

function getDeviceStream(option) {
    if ('getUserMedia' in navigator.mediaDevices) {
        console.log('navigator.mediaDevices.getUserMedia');
        return navigator.mediaDevices.getUserMedia(option);
    } else {
        console.log('wrap navigator.getUserMedia with Promise');
        return new Promise(function(resolve, reject) {
            navigator.getUserMedia(option, resolve, reject);
        });
    }
}

function getScreen() {
    if (screen.isEnabledExtension()) {
        screen.startScreenShare({
            Width: 1440,
            Height: 900,
            FrameRate: 20
        }, function(stream) {
            attachMediaStream_($('#local_video')[0], stream);
            localStream = stream;
        })
    } else {
        alert('ExtensionまたはAddonをインストールして下さい');
    }
}


// $(function() {
//     ('#start-screen').click(function() {
//         if (screen.isEnabledExtension()) {
//             screen.startScreenShare({
//                 Width: 480,
//                 Height: 360,
//                 FrameRate: 20
//             }, function(stream) {
//                 attachMediaStream_($('#local_video')[0], stream);
//                 if (existingCall != null) {
//                     var _peerid = existingCall.peer;
//                     existingCall.close();
//                     var call = peer.call(_peerid, stream);
//                     step3(call);
//                 }
//                 localStream = stream;

//             }, function(error) {
//                 console.log(error);
//             }, function() {
//                 alert('ScreenShareを終了しました');
//             });
//         } else {
//             alert('ExtensionまたはAddonをインストールして下さい');
//         }

//     });

//     //スクリーンシェアを終了
//     $('#stop-screen').click(function() {
//         //sc.stopScreenShare();
//         localStream.stop();
//     });
// });

function playVideo(element, stream) {
    element.srcObject = stream;
    element.play();
}

function stopVideo() {
    localStream.stop();
}

function attachMediaStream_(videoDom, stream) {
    // Adapter.jsをインクルードしている場合はそちらのFunctionを利用する
    if (typeof(attachMediaStream) !== 'undefined' && attachMediaStream) {
        attachMediaStream(videoDom, stream);
    } else {
        videoDom.setAttribute('src', URL.createObjectURL(stream));
    }

}

// WebRTCを利用する準備をする
function prepareNewConnection() {
    // RTCPeerConnectionを初期化する
    const pc_config = { "iceServers": [{ "urls": "stun:stun.skyway.io:3478" }] };
    const peer = new RTCPeerConnection(pc_config);

    // リモートのストリームを受信した場合のイベントをセット
    if ('ontrack' in peer) {
        peer.ontrack = function(event) {
            console.log('-- peer.ontrack()');
            playVideo(remoteVideo, event.streams[0]);
        };
    } else {
        peer.onaddstream = function(event) {
            console.log('-- peer.onaddstream()');
            playVideo(remoteVideo, event.stream);
        };
    }

    // ICE Candidateを収集したときのイベント
    peer.onicecandidate = function(evt) {
        if (evt.candidate) {
            console.log(evt.candidate);
            sendIceCandidate(evt.candidate);
        } else {
            console.log('empty ice event');
            // sendSdp(peer.localDescription);
        }
    };

    // ICEのステータスが変更になったときの処理
    peer.oniceconnectionstatechange = function() {
        console.log('ICE connection Status has changed to ' + peer.iceConnectionState);
        switch (peer.iceConnectionState) {
            case 'closed':
            case 'failed':
                // ICEのステートが切断状態または異常状態になったら切断処理を実行する
                if (peerConnection) {
                    hangUp();
                }
                break;
            case 'dissconnected':
                break;
        }
    };

    // ローカルのストリームを利用できるように準備する
    if (localStream) {
        console.log('Adding local stream...');
        peer.addStream(localStream);
    } else {
        console.warn('no local stream, but continue.');
    }

    return peer;
}

// 手動シグナリングのための処理を追加する
function sendSdp(sessionDescription) {
    console.log('---sending sdp ---');
    textForSendSdp.value = sessionDescription.sdp;
    // textForSendSdp.focus();
    // textForSendSdp.select();
    const message = JSON.stringify(sessionDescription);
    console.log('sending SDP=' + message);
    ws.send(message);
}

// Connectボタンが押されたら処理を開始
function connect() {
    if (!peerConnection) {
        console.log('make Offer');
        makeOffer();
    } else {
        console.warn('peer already exist.');
    }
}

// Offer SDPを生成する
function makeOffer() {
    peerConnection = prepareNewConnection();
    peerConnection.onnegotiationneeded = function() {
        peerConnection.createOffer()
            .then(function(sessionDescription) {
                console.log('createOffer() succsess in promise');
                return peerConnection.setLocalDescription(sessionDescription);
            }).then(function() {
                console.log('setLocalDescription() succsess in promise');
                sendSdp(peerConnection.localDescription);
            }).catch(function(err) {
                console.error(err);
            });
    }
}

// Answer SDPを生成する
function makeAnswer() {
    console.log('sending Answer. Creating remote session description...');
    if (!peerConnection) {
        console.error('peerConnection NOT exist!');
        return;
    }
    peerConnection.createAnswer()
        .then(function(sessionDescription) {
            console.log('createAnswer() succsess in promise');
            return peerConnection.setLocalDescription(sessionDescription);
        }).then(function() {
            console.log('setLocalDescription() succsess in promise');
            sendSdp(peerConnection.localDescription);
        }).catch(function(err) {
            console.error(err);
        });
}

// SDPのタイプを判別しセットする
function onSdpText() {
    const text = textToReceiveSdp.value;
    if (peerConnection) {
        // Offerした側が相手からのAnserをセットする場合
        console.log('Received answer text...');
        const answer = new RTCSessionDescription({
            type: 'answer',
            sdp: text,
        });
        setAnswer(answer);
    } else {
        // Offerを受けた側が相手からのOfferをセットする場合
        console.log('Received offer text...');
        const offer = new RTCSessionDescription({
            type: 'offer',
            sdp: text,
        });
        setOffer(offer);
    }
    textToReceiveSdp.value = '';
}

// Offer側のSDPをセットした場合の処理
function setOffer(sessionDescription) {
    if (peerConnection) {
        console.error('peerConnection alreay exist!');
    }
    peerConnection = prepareNewConnection();
    peerConnection.onnegotiationneeded = function() {
        peerConnection.setRemoteDescription(sessionDescription)
            .then(function() {
                console.log('setRemoteDescription(offer) succsess in promise');
                makeAnswer();
            }).catch(function(err) {
                console.error('setRemoteDescription(offer) ERROR: ', err);
            });
    }
}

// Answer側のSDPをセットした場合の処理
function setAnswer(sessionDescription) {
    if (!peerConnection) {
        console.error('peerConnection NOT exist!');
        return;
    }
    peerConnection.setRemoteDescription(sessionDescription)
        .then(function() {
            console.log('setRemoteDescription(answer) succsess in promise');
        }).catch(function(err) {
            console.error('setRemoteDescription(answer) ERROR: ', err);
        });
}

// P2P通信を切断する
function hangUp() {
    if (peerConnection) {
        if (peerConnection.iceConnectionState !== 'closed') {
            peerConnection.close();
            peerConnection = null;
            const message = JSON.stringify({ type: 'close' });
            console.log('sending close message');
            ws.send(message);
            cleanupVideoElement(remoteVideo);
            textForSendSdp.value = '';
            textToReceiveSdp.value = '';
            return;
        }
    }
    console.log('peerConnection is closed.');

}

// ビデオエレメントを初期化する
function cleanupVideoElement(element) {
    element.pause();
    element.srcObject = null;
}

// const wsUrl = 'ws://localhost:3001/';
// const wsUrl = 'ws://192.168.1.61:3001/';
const wsUrl = 'ws://192.168.179.2:3001/';
const ws = new WebSocket(wsUrl);
ws.onopen = function(evt) {
    console.log('ws open()');
};
ws.onerror = function(err) {
    console.error('ws onerror() ERR:', err);
};
ws.onmessage = function(evt) {
    console.log('ws onmessage() data:', evt.data);
    const message = JSON.parse(evt.data);
    if (message.type === 'offer') {
        // offer 受信時
        console.log('Received offer ...');
        textToReceiveSdp.value = message.sdp;
        const offer = new RTCSessionDescription(message);
        setOffer(offer);
    } else if (message.type === 'answer') {
        // answer 受信時
        console.log('Received answer ...');
        textToReceiveSdp.value = message.sdp;
        const answer = new RTCSessionDescription(message);
        setAnswer(answer);
    } else if (message.type === 'candidate') {
        // ICE candidate 受信時
        console.log('Received ICE candidate ...');
        const candidate = new RTCIceCandidate(message.ice);
        console.log(candidate);
        addIceCandidate(candidate);
    } else if (message.type === 'close') {
        // closeメッセージ受信時
        console.log('peer is closed ...');
        hangUp();
    }
};

// ICE candaidate受信時にセットする
function addIceCandidate(candidate) {
    if (peerConnection) {
        peerConnection.addIceCandidate(candidate);
    } else {
        console.error('PeerConnection not exist!');
        return;
    }
}

// ICE candidate生成時に送信する
function sendIceCandidate(candidate) {
    console.log('---sending ICE candidate ---');
    const message = JSON.stringify({ type: 'candidate', ice: candidate });
    console.log('sending candidate=' + message);
    ws.send(message);
}