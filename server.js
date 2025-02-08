const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT;
const SECRET_KEY = process.env.JWT_SECRET;

app.use(express.json());

app.use(cors({
  origin: ["https://pixo-v1.netlify.app"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Database connected"))
  .catch((err) => {
    console.error("db error:", err.message);
    process.exit(1);
  });

const imageSchema = new mongoose.Schema({
  url: String,
  title: String,
  author: String,
  music: {
    title: String,
    artist: String,
    url: String,
  },
  date: Date,
  title: String,
  songname: String,
  songartist: String,
  tags: Array
});

const Image = mongoose.model("Image", imageSchema);

app.get("/", (req, res) => {
  res.send("backend on");
});

app.get('/get-images', async (req, res) => {
  const beforeDate = req.query.before;
  const limit = 4;

  const query = beforeDate ? 
      { date: { $lt: new Date(beforeDate) } } : {};
  const images = await Image.find(query).sort({ date: -1 }).limit(limit);

  res.json(images);
});


app.get("/get-random-image", async (req, res) => {
  try {
    const totalImages = await Image.countDocuments();
    
    if (totalImages === 0) {
      return res.status(404).json({ error: "0 image found" });
    }

    const randomIndex = Math.floor(Math.random() * totalImages);

    const randomImage = await Image.findOne().skip(randomIndex);
    
    res.json({
      _id: randomImage._id,
      url: randomImage.url,
      author: randomImage.author,
      date: randomImage.date,
      title: randomImage.title,
      songname: randomImage.songname,
      songartist: randomImage.songartist,
      tags: randomImage.tags
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ "another error " : error });
  }
});

app.get("/get-image-by-id/:id", async (req, res) => {
  try {
    const imageId = req.params.id;
    const image = await Image.findById(imageId);

    if (!image) {
      return res.status(404).json({ error: "image not found" });
    }

    res.json({
      _id: image._id,
      url: image.url,
      author: image.author,
      date: image.date,
      title: image.title,
      songname: image.songname,
      songartist: image.songartist,
      tags: image.tags
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "failed to fetch image ;(" });
  }
});


app.post("/upload-image", async (req, res) => {
  try {
    const { url, author, title, songname, songartist, tags } = req.body;

    if (!url || !author || !title || !songname || !songartist || !tags) {
      return res.status(400).json({ error: "all fields are mandatory" });
    }

    const newImage = new Image({
      url,
      author,
      date: new Date(),
      title,
      songname,
      songartist,
      tags
    });

    await newImage.save();
    res.status(201).json({ message: "yep!", image: newImage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "nope!" });
  }
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model("User", userSchema);

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access denied" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "All fields are required" });
    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });

    await newUser.save();
    res.status(201).json({ message: "Registration successful" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "All fields are required" });

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, username: user.username }, SECRET_KEY, { expiresIn: "1h" });
    res.json({ message: "Login successful", token });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

app.get("/get-user-images/:author", async (req, res) => {
  try {
    const { author } = req.params;
    const images = await Image.find({ author });
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: "Error retrieving images" });
  }
});


app.get("/protected", authenticateToken, (req, res) => {
  res.json({ message: "authenticated", user: req.user });
});

app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`);
});
