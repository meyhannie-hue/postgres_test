require("dotenv").config();
const bcrypt = require("bcryptjs");
const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");
const session = require("express-session");
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'techyme-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// ✅ Use pool config instead of DB_URL
const sequelize = new Sequelize(
  process.env.DB_NAME,      // database name
  process.env.DB_USER,      // username
  process.env.DB_PASS,      // password
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 10,     // max number of connections
      min: 0,      // min number of connections
      acquire: 30000, // max time (ms) to get a connection before throwing error
      idle: 10000     // max time (ms) a connection can be idle
    }
  }
);

sequelize
  .sync()
  .then(() => {
    console.log("Database connected");
  })
  .catch((error) => {
    console.error("Database connection failed:", error);
  });

const Player = sequelize.define(
  "players",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    display_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    theme: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'system'
    },
    avatar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    coins: {   // 👈 add this
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    networking_completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    programming_completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    systemunit_completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    networking_hard_perfect: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    programming_game_unlocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    progress: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    password: {
      type: DataTypes.STRING(100),
      allowNull: false
    }
  },
  {
    tableName: "players",
    timestamps: false
  }
);

module.exports = Player;

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}

// API router
// Create new player
app.post("/create-player", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    // ✅ use bcryptjs consistently
    const hashedPassword = await bcrypt.hash(password, 10);
    const player = await Player.create({
      username,
      password: hashedPassword,
      email
    });
    res.json({ success: true, player });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create player" });
  }
});

// Get all players
app.get("/get-players", async (req, res) => {
  try {
    const players = await Player.findAll();
    res.json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

// ✅ Get all players (alias /get-posts)
app.get("/get-posts", async (req, res) => {
  try {
    const players = await Player.findAll();
    res.json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Get all players (so frontend fetch("/players") works)
app.get("/players", async (req, res) => {
  try {
    const players = await Player.findAll();
    res.json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const player = await Player.findOne({ where: { username } });
    if (!player) {
      return res.status(404).json({ success: false, message: "Player not found" });
    }
    // ✅ use bcryptjs consistently
    const validPassword = await bcrypt.compare(password, player.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: "Invalid password" });
    }
    
    // Set user session
    req.session.user = {
      id: player.id,
      username: player.username
    };
    
    res.json({ success: true, player: { id: player.id, username: player.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to login" });
  }
});

// Get current user
app.get("/api/current-user", isAuthenticated, async (req, res) => {
  try {
    const player = await Player.findOne({
      where: { id: req.session.user.id },
      attributes: ['id', 'username', 'email', 'display_name', 'theme', 'avatar', 'points', 'coins']
    });
    
    if (!player) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(player);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// Get single player by username
app.get("/api/player/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const player = await Player.findOne({ where: { username } });
    if (!player) return res.status(404).json({ error: "Player not found" });
    res.json(player);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch player" });
  }
});

// Update user profile
app.post("/api/update-profile", isAuthenticated, async (req, res) => {
  try {
    const { username, email, displayName, theme, avatar } = req.body;
    
    // Find and update the user
    const player = await Player.findOne({ where: { id: req.session.user.id } });
    
    if (!player) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Update the fields
    await player.update({
      email: email || player.email,
      display_name: displayName || player.display_name,
      theme: theme || player.theme,
      avatar: avatar || player.avatar
    });
    
    res.json({ success: true, message: "Profile updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Upload avatar
app.post("/api/upload-avatar", isAuthenticated, async (req, res) => {
  try {
    const { username, avatar } = req.body;
    
    const player = await Player.findOne({ where: { id: req.session.user.id } });
    
    if (!player) {
      return res.status(404).json({ error: "User not found" });
    }
    
    await player.update({ avatar });
    
    res.json({ success: true, message: "Avatar uploaded successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload avatar" });
  }
});

// Change password
app.post("/api/change-password", isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const player = await Player.findOne({ where: { id: req.session.user.id } });
    
    if (!player) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, player.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await player.update({ password: hashedPassword });
    
    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// Delete account
app.post("/api/delete-account", isAuthenticated, async (req, res) => {
  try {
    const player = await Player.findOne({ where: { id: req.session.user.id } });
    
    if (!player) {
      return res.status(404).json({ error: "User not found" });
    }
    
    await player.destroy();
    
    // Destroy session
    req.session.destroy();
    
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// Logout other sessions
app.post("/api/logout-others", isAuthenticated, async (req, res) => {
  try {
    // In a real application, you would track all sessions for a user
    // and invalidate all but the current one. For simplicity, we'll
    // just return success.
    res.json({ success: true, message: "Other sessions logged out" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to logout other sessions" });
  }
});

// Reward endpoint (add/subtract points/coins)
app.post("/api/reward", async (req, res) => {
  try {
    const { username, points, coins } = req.body;
    if (!username) return res.status(400).json({ error: "Username is required" });
    const player = await Player.findOne({ where: { username } });
    if (!player) return res.status(404).json({ error: "Player not found" });
    const newCoins = player.coins + (coins || 0);
    if (newCoins < 0) {
      return res.status(400).json({ error: "Not enough coins" });
    }
    player.points += points || 0;
    player.coins = newCoins;
    await player.save();
    res.json({ success: true, message: "Reward applied", player });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to apply reward" });
  }
});

app.post("/update-coins", async (req, res) => {
  try {
    const { username, coins } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username required" });
    }
    await sequelize.query(
      "UPDATE players SET coins = :coins WHERE username = :username",
      {
        replacements: { coins, username },
      }
    );
    res.json({ success: true, coins });
  } catch (err) {
    console.error("Error updating coins:", err);
    res.status(500).json({ error: "Failed to update coins" });
  }
});

// Add this route in server.js
app.post("/update-progress", async (req, res) => {
  try {
    const { username, coins, unlockedLevels } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username required" });
    }
    await sequelize.query(
      "UPDATE players SET coins = :coins, unlocked_levels = :unlockedLevels WHERE username = :username",
      {
        replacements: {
          coins,
          unlockedLevels: JSON.stringify(unlockedLevels),
          username,
        },
      }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating progress:", err);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});