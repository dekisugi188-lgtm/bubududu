const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true })); // needed to read req.body.room on multipart-adjacent routes

// Make sure the private upload directory exists (not inside public/)
const uploadDir = path.join(__dirname, "private_uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Stored OUTSIDE the public/ static folder, so it can never be
    // reached by a direct guessable URL — only via the private /file route below.
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Random 32-byte (64 hex char) token instead of a guessable timestamp.
    const randomName = crypto.randomBytes(32).toString("hex");
    cb(null, randomName + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Tracks which room each uploaded file belongs to, so it can only be
// retrieved by someone who knows that room's password.
// filename -> room
const fileOwners = new Map();

// Image Upload
app.post("/upload-image", upload.single("image"), (req, res) => {
  const room = req.body.room;
  if (!room) {
    return res.status(400).json({ error: "Missing room" });
  }
  fileOwners.set(req.file.filename, room);
  res.json({
    url: "/file/" + req.file.filename
  });
});

// Audio Upload
app.post("/upload-audio", upload.single("audio"), (req, res) => {
  const room = req.body.room;
  if (!room) {
    return res.status(400).json({ error: "Missing room" });
  }
  fileOwners.set(req.file.filename, room);
  res.json({
    url: "/file/" + req.file.filename
  });
});

// Private file retrieval — only works if the caller supplies the
// correct room password as a query parameter (?room=...).
app.get("/file/:filename", (req, res) => {
  const filename = req.params.filename;
  const room = req.query.room;
  const owner = fileOwners.get(filename);

  if (!owner || !room || owner !== room) {
    return res.status(403).send("Forbidden");
  }

  res.sendFile(filename, { root: uploadDir }, (err) => {
    if (err && !res.headersSent) {
      res.status(404).send("Not found");
    }
  });
});

io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("join-room",(room)=>{

  socket.join(room);
  socket.room=room;

  const clients=
  io.sockets.adapter.rooms.get(room);

  if(clients && clients.size>=2){

    io.to(room).emit("status","online");

  }

});

  // Text Messages
  socket.on("message", (msg) => {
    if (socket.room) {
      socket.to(socket.room).emit("message", msg);
    }
  });

  // Images
  socket.on("image", (url) => {
    if (socket.room) {
      socket.to(socket.room).emit("image", url);
    }
  });

  // Voice Notes
  socket.on("audio", (url) => {
    if (socket.room) {
      socket.to(socket.room).emit("audio", url);
    }
  });

  // Typing
  socket.on("typing", () => {
    if (socket.room) {
      socket.to(socket.room).emit("typing");
    }
  });

  // ---- WebRTC Call Signaling ----

  // Caller starts a call (video or audio)
  socket.on("call-user", (data) => {
    if (socket.room) {
      socket.to(socket.room).emit("incoming-call", {
        offer: data.offer,
        callType: data.callType
      });
    }
  });

  // Callee accepts and sends back an answer
  socket.on("make-answer", (data) => {
    if (socket.room) {
      socket.to(socket.room).emit("answer-made", {
        answer: data.answer
      });
    }
  });

  // Either side exchanges ICE candidates
  socket.on("ice-candidate", (candidate) => {
    if (socket.room) {
      socket.to(socket.room).emit("ice-candidate", candidate);
    }
  });

  // Callee rejects
  socket.on("reject-call", () => {
    if (socket.room) {
      socket.to(socket.room).emit("call-rejected");
    }
  });

  // Either side hangs up
  socket.on("end-call", () => {
    if (socket.room) {
      socket.to(socket.room).emit("call-ended");
    }
  });

  socket.on("disconnect",()=>{

  if(socket.room){

    const clients=
    io.sockets.adapter.rooms.get(socket.room);

    if(!clients || clients.size<=1){

      socket.to(socket.room)
            .emit("status","offline");

    }
  }

});
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});