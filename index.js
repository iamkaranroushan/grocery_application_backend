import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { graphqlHTTP } from "express-graphql";
import { resolvers } from "./src/graphql/resolvers.js";
import { schema } from "./src/graphql/schema.js";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

dotenv.config();

// Create express app
const app = express();
const port = process.env.PORT || 8000;

// Create HTTP server from Express app
const server = createServer(app);

// Setup Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://192.168.1.3:3000",
      "https://grocery-application-frontend.onrender.com"
    ],
    credentials: true,
  },

});


// Handle socket connections
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  //on connection we got user role and admin role and we can now set the room
  socket.on("join", ({ role, userId }) => {
    if (role === "admin") {
      socket.join("admin")
      console.log(`admin joined`);
    }
    else {
      socket.join(`user-${userId}`);
      console.log(`User ${userId} joined`);
    };
  });

  socket.on("orderPlaced", (orderData) => {
    console.log("New order placed:", orderData);
    io.to("admin").emit("newOrder", { message: "New order placed", order: orderData });
  })

  socket.on("orderUpdated", (orderData) => {
    const userRoom = `user-${orderData.id}`;
    io.to(userRoom).emit("updatedOrder", { message: "New order updated", order: orderData });
    console.log("order update:", userRoom, orderData);
  })


  socket.on("check", ({ message }) => {
    console.log(message);
  })

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://192.168.1.3:3000",
      "https://grocery-application-frontend.onrender.com"
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  console.log("Incoming Cookies:", req.headers.cookie);
  next();
});

// Basic route
app.get("/", (req, res) => {
  res.send(
    `<p style="font-size: 100px; text:center; margin-left:10px; margin-top:10px;" >
      GROCERY APPLICATION: BACKEND
    </p>`
  );
});

// GraphQL route
app.use(
  "/graphql",
  graphqlHTTP((req, res) => ({
    schema: schema,
    rootValue: resolvers,
    graphiql: true,
    context: { req, res, io }, // Pass io to resolvers via context
  }))
);

// Start HTTP + WebSocket server
server.listen(port, () => {
  console.log(`Server listening on https://grocery-application-frontend.onrender.com/`);
});
