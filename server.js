const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use(cors({
  origin: ["http://localhost:5173", "http://10.5.0.2:5173", "https://pixo-v1.netlify.app"],
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
    res.status(500).json({ "Another error " : error });
  }
});

app.post("/upload-image", async (req, res) => {
  try {
    const { url, author, title, songname, songartist, tags } = req.body;

    if (!url || !author || !title || !songname || !songartist || !tags) {
      return res.status(400).json({ error: "all fields are mandatory" }); // straight up from google translate
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

app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`);
});
