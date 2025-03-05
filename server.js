const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require("dotenv").config();
const fs = require('fs');
const ytdl = require('ytdl-core');

const app = express();
const PORT = process.env.PORT;
const SECRET_KEY = process.env.JWT_SECRET;

app.use(express.json());

app.use(cors({
  origin: ["https://pixo-v1.netlify.app", "http://10.5.0.2:5173"],
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
  author: String,
  date: Date,
  title: String,
  songname: String,
  songlink: String,
  tags: Array,
  views: { type: Number, default: 0 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // arrays of users
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

app.post("/like-image", async (req, res) => {
  try {
    const { imageId, userId } = req.body;

    if (!imageId || !userId) {
      return res.status(400).json({ error: "Both imageId and userId are required" });
    }

    const image = await Image.findById(imageId);
    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    /* if (image.likes.includes(userId)) {
      return res.status(400).json({ error: "You have already liked this image" });
    } */

    image.likes.push(userId);
    await image.save();

    res.status(200).json({ message: "Like added successfully", likes: image.likes.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while adding the like" });
  }
});

app.post("/dislike-image", async (req, res) => {
  try {
    const { imageId, userId } = req.body;

    if (!imageId || !userId) {
      return res.status(400).json({ error: "Image ID and User ID are required" });
    }

    const image = await Image.findById(imageId);

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    if (!image.likes.includes(userId)) {
      return res.status(400).json({ error: "User hasn't liked this image" });
    }

    image.likes = image.likes.filter(like => like.toString() !== userId);

    await image.save();

    res.status(200).json({ likes: image.likes.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while processing the dislike" });
  }
});


app.get("/image/:imageId", async (req, res) => {
  try {
    const imageId = req.params.imageId;
    const image = await Image.findById(imageId);

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.status(200).json(image);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while retrieving the image" });
  }
});


app.get("/image-likes/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await Image.findById(imageId).populate('likes');
    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.status(200).json({ likes: image.likes.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while fetching likes" });
  }
});


app.get("/get-random-image", async (req, res) => {
  try {
    const totalImages = await Image.countDocuments();
    
    if (totalImages === 0) {
      return res.status(404).json({ error: "0 image found" });
    }

    const randomIndex = Math.floor(Math.random() * totalImages);
    const randomImage = await Image.findOne().skip(randomIndex);

    randomImage.views += 1;
    await randomImage.save();

    // Recupera il picture dell'utente associato
    const user = await User.findOne({ username: randomImage.author });
    const userPicture = user ? user.picture : null;

    res.json({
      _id: randomImage._id,
      url: randomImage.url,
      author: randomImage.author,
      date: randomImage.date,
      title: randomImage.title,
      songname: randomImage.songname,
      songlink: randomImage.songlink,
      tags: randomImage.tags,
      views: randomImage.views,
      likes: randomImage.likes,
      picture: userPicture // Aggiungi il campo picture
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while fetching a random image" });
  }
});


app.get("/get-image-by-id/:id", async (req, res) => {
  try {
    const imageId = req.params.id;
    const image = await Image.findById(imageId);
    if (!image) {
      return res.status(404).json({ error: "image not found" });
    }

    image.views += 1;
    await image.save();

    const user = await User.findOne({ username: image.author });
    const userPicture = user ? user.picture : null;

    res.json({
      _id: image._id,
      url: image.url,
      author: image.author,
      date: image.date,
      title: image.title,
      songname: image.songname,
      songlink: image.songlink,
      tags: image.tags,
      views: image.views,
      likes: image.likes,
      picture: userPicture
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "failed to fetch image ;(" });
  }
});


/* async function getAudioLinkFromYouTube(songlink) {
  try {
    const info = await ytdl.getInfo(songlink);
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    const bestAudio = audioFormats[0];
    return bestAudio.url;
  } catch (error) {
    console.error('Errore nell\'estrazione dell\'audio:', error);
    throw new Error('Errore nell\'estrazione dell\'audio');
  }
} */

/* async function uploadImageToImgur(imageBase64) {
  const url = "https://api.imgur.com/3/upload";
  const formData = new FormData();
  formData.append('image', imageBase64);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      "Authorization": `Client-ID ${clientId}`
    },
    body: formData
  });
  
  const data = await response.json();
  if (data.success) {
    return data.data.link;
  } else {
    return "error uploading image";
  }
}
  
app.post("/upload-image-to-imgur", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image required" });
    }
    const link = await uploadImageToImgur(req.file.buffer.toString('base64'));
    
    if (link.startsWith("error")) {
      return res.status(500).json({ error: "Error uploading image" });
    }
    res.status(200).json({ success: true, data: { link } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred during image upload" });
  }
}); */

app.post("/upload-image", async (req, res) => {
  try {
    const { url, author, title, songname, songlink, tags } = req.body;

    if (!url || !author || !title || !tags) {
      return res.status(400).json({ error: "all fields are mandatory" });
    }

    const deAuthor = jwt.decode(author)

    if (!deAuthor) {
      return res.status(400).json({ error: "Invalid token" });
    }

    const username = deAuthor.username;

    const newImage = new Image({
      url,
      author: username,
      date: new Date(),
      title,
      songname,
      songlink,
      tags
    });
    console.log(newImage)

    /* const audioLink = await getAudioLinkFromYouTube(songlink);
    console.log(audioLink);
    newImage.songlink = audioLink; */
    
    await newImage.save();
    res.status(201).json({ message: "yep!", image: newImage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "nope!" });
  }
});

/* app.post("/upload-image", async (req, res) => {
  try {
    const { url, author, title, songname, songlink, tags } = req.body;

    if (!url || !author || !title || !songname || !songlink || !tags) {
      return res.status(400).json({ error: "all fields are mandatory" });
    }

    const newImage = new Image({
      url,
      author,
      date: new Date(),
      title,
      songname,
      songlink,
      tags
    });

    await newImage.save();
    res.status(201).json({ message: "yep!", image: newImage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "nope!" });
  }
}); */

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  picture: { type: String, required: true }
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
    const { username, password, picture } = req.body;
    if (!username || !password || !picture) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, picture });

    await newUser.save();
    res.status(201).json({ message: "Registration successful" });
  } catch (error) {
    console.error("Error during registration:", error);
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

app.get("/get-all-images", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;

    let images;
    if (search && search.trim() !== "") {
      images = await Image.find({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { tags: { $regex: search, $options: "i" } }
        ]
      }).limit(limit);
    } else {
      images = await Image.aggregate([{ $sample: { size: limit } }]);
    }
    
    res.json(images);
  } catch (error) {
    console.error("Error retrieving images:", error);
    res.status(500).json({ error: "Error retrieving images" });
  }
});


app.get("/get-user-by-id/profile/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ username: user.username, picture: user.picture });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/protected", authenticateToken, (req, res) => {
  res.json({ message: "authenticated", user: req.user });
});

app.listen(PORT, () => {
  console.log(`server running`);
});
