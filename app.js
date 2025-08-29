require("dotenv").config();
const bcrypt = require("bcryptjs");
const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");


const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

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
      allowNull: false
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

// API router
// Create new player
app.post("/create-player", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // ✅ use bcryptjs consistently
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    const player = await Player.create({
      username,
      password: hashedPassword
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
    const bcrypt = require("bcryptjs");
    const validPassword = await bcrypt.compare(password, player.password);

    if (!validPassword) {
      return res.status(401).json({ success: false, message: "Invalid password" });
    }

    res.json({ success: true, player });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to login" });
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
  // Reward endpoint
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





// Serve static files from  the "public" directory
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
