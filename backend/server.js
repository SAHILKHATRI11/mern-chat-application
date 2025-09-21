const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const socketio = require("socket.io");
const socketIo = require("./socket");
const userRouter = require("./routes/userRoutes");
const groupRouter = require("./routes/groupRoute");
const messageRouter = require("./routes/messageRoute");
dotenv.config();

const app = express();
const server = http.createServer(app);

// Updated CORS configuration for production
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://mern-chat-application-woad.vercel.app",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};

const io = socketio(server, {
  cors: corsOptions,
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint for Render
app.get("/", (req, res) => {
  res.json({ message: "Backend server is running!" });
});

// Connect to DB
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to the DB");
  })
  .catch((err) => {
    console.log("MongoDB connection failed", err);
  });

// Initialize Socket.IO
socketIo(io);

// API Routes
app.use("/api/users", userRouter);
app.use("/api/groups", groupRouter);
app.use("/api/messages", messageRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
