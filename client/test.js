const localVideo = document.getElementById('local_video');
let localStream = null;

function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
            playVideo(localVideo, stream);
            localStream = stream;
        })
        .catch(function(error) {
            console.error('mediaDevice.getUserMedia() error:', error);
            return;
        });
}

function playVideo(element, stream) {
    element.srcObject = stream;
    element.play();
}

function stopVideo(element) {
    // element.stop()
    element.srcObject = null;
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
            // playVideo(localVideo, stream);
            localVideo.stop()
            localVideo.srcObject = null;
            localStream = stream;
        })
        .catch(function(error) {
            console.error('mediaDevice.getUserMedia() error:', error);
            return;
        });
}