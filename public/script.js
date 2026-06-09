const socket = io();

const PASSWORD = "1234"; // changeable password
let myUsername = prompt("Enter your name");

const passwordScreen = document.getElementById("password-screen");
const chatScreen = document.getElementById("chat-screen");
const passwordInput = document.getElementById("password-input");
const passwordBtn = document.getElementById("password-btn");
const passwordError = document.getElementById("password-error");

const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const messagesDiv = document.getElementById("messages");
const typingDiv = document.getElementById("typing");
const usersOnlineDiv = document.getElementById("users-online");

const emojiBtn = document.getElementById("emoji-btn");
const attachBtn = document.getElementById("attach-btn");
const fileInput = document.getElementById("file-input");

const startCallBtn = document.getElementById("start-call");
const endCallBtn = document.getElementById("end-call");
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");

let localStream;
let peerConnection;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

passwordBtn.addEventListener("click", () => {
  if (passwordInput.value === PASSWORD) {
    passwordScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
    socket.emit("join", myUsername);
  } else {
    passwordError.textContent = "Wrong password!";
  }
});

sendBtn.addEventListener("click", () => {
  const msg = messageInput.value;
  if (!msg) return;
  addMessage(myUsername, msg);
  socket.emit("chat-message", msg);
  messageInput.value = "";
});

messageInput.addEventListener("input", () => {
  socket.emit("typing", messageInput.value.length > 0);
});

socket.on("chat-message", (data) => addMessage(data.username, data.message));
socket.on("typing", (data) => {
  typingDiv.textContent = data.typing ? `${data.username} is typing...` : "";
});
socket.on("online-users", (users) => {
  usersOnlineDiv.textContent = "Online: " + users.join(", ");
});

function addMessage(username, message) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.textContent = `${username}: ${message}`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Emoji picker
emojiBtn.addEventListener("click", () => {
  messageInput.value += "😊";
  messageInput.focus();
});

// Attach files
attachBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    addMessage(myUsername, `[File] ${file.name}`);
    socket.emit("chat-message", `[File] ${file.name}`);
  };
  reader.readAsDataURL(file);
});

// Video call
startCallBtn.addEventListener("click", async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) return;
    // Normally send ICE candidate
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  // For simplicity broadcasting to all
  socket.emit("call-user", { offer, to: null });
});

socket.on("call-made", async (data) => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("make-answer", { answer, to: data.from });
});

socket.on("answer-made", async (data) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
});

endCallBtn.addEventListener("click", () => {
  if (peerConnection) peerConnection.close();
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
});
