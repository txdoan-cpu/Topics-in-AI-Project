const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token." });
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  authMiddleware
};

