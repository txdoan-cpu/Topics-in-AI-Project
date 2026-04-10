const mongoose = require("mongoose");

async function connectDb() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is not configured.");
  }

  if (mongoUri.includes("<db_username>") || mongoUri.includes("<db_password>")) {
    throw new Error("MONGO_URI still contains placeholder values. Replace <db_username> and <db_password> with real MongoDB Atlas credentials.");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
  return mongoose.connection;
}

module.exports = connectDb;
