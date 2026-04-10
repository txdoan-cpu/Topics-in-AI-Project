const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AUTH_COOKIE_NAME = "chess_token";

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
      username: user.username,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function getCookieToken(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = cookieHeader.split(";").map((entry) => entry.trim());
  const authCookie = cookies.find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`));
  return authCookie ? decodeURIComponent(authCookie.slice(AUTH_COOKIE_NAME.length + 1)) : null;
}

function getRequestToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return getCookieToken(req);
}

function authMiddleware(req, res, next) {
  const token = getRequestToken(req);

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

function requirePageAuth(req, res, next) {
  const token = getRequestToken(req);

  if (!token) {
    return res.redirect("/?auth=required");
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.redirect("/?auth=required");
  }
}

module.exports = {
  AUTH_COOKIE_NAME,
  hashPassword,
  comparePassword,
  signToken,
  authMiddleware,
  requirePageAuth
};
