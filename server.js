const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Image Upload
app.post("/upload-image", upload.single("image"), (req, res) => {
  res.json({
    url: "/uploads/" + req.file.filename
  });
});

// Audio Upload
app.post("/upload-audio", upload.single("audio"), (req, res) => {
  res.json({
    url: "/uploads/" + req.file.filename
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