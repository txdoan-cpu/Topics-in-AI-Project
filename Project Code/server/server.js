require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const aiRoutes = require("./api/ai");
const authRoutes = require("./api/auth");
const connectDb = require("./db");
const { requirePageAuth } = require("./utils/auth");

const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const clientPath = path.join(__dirname, "..", "client");

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(clientPath));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);

app.get("/", (req, res) => res.sendFile(path.join(clientPath, "index.html")));
app.get("/play", requirePageAuth, (req, res) => res.sendFile(path.join(clientPath, "play.html")));
app.get("/history", (req, res) => res.sendFile(path.join(clientPath, "history.html")));
app.get("/replay", (req, res) => res.sendFile(path.join(clientPath, "replay.html")));
app.get("*", (req, res) => res.redirect("/"));

async function startServer(port) {
  try {
    await connectDb();
    console.log("Connected to MongoDB Atlas.");
  } catch (error) {
    console.error("Failed to connect to MongoDB.", error.message);
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`Chess server listening on http://localhost:${port}`);
    if (port !== DEFAULT_PORT) {
      console.log(`Requested port ${DEFAULT_PORT} was unavailable. Using port ${port} instead.`);
    }
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use. Retrying on port ${nextPort}.`);
      startServer(nextPort);
      return;
    }

    throw error;
  });
}

startServer(DEFAULT_PORT);
