const mongoose = require("mongoose");

async function connectDb() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is not configured.");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
  return mongoose.connection;
}

module.exports = connectDb;

