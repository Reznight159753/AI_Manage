const express = require("express");
const axios = require("axios");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Cấu hình multer để lưu file tạm
const upload = multer({ dest: "uploads/" });

// Proxy cho STT
app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file part in the request" });
    }

    if (req.file.mimetype !== "audio/wav" && path.extname(req.file.originalname).toLowerCase() !== ".wav") {
      fs.unlinkSync(req.file.path); // Xóa file tạm
      return res.status(400).json({ error: "Invalid file format. Only WAV files allowed" });
    }

    // Gửi yêu cầu tới Viettel AI API
    const formData = new FormData();
    formData.append("file", fs.createReadStream(req.file.path), req.file.originalname);
    formData.append("token", "ba512f585fca1c689a55c8ed2cc26ae7"); // Thay bằng token từ https://viettelai.vn/dashboard/token

    const response = await axios.post("https://viettelai.vn/asr/recognize", formData, {
      headers: {
        ...formData.getHeaders(),
        accept: "*/*",
      },
    });

    // Xóa file tạm
    fs.unlinkSync(req.file.path);

    res.json(response.data);
  } catch (err) {
    console.error("Proxy Error /api/transcribe:", err.message);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path); // Xóa file tạm nếu có lỗi
    }
    res.status(500).json({ error: err.message });
  }
});

const PORT = 4001;
app.listen(PORT, () => {
  console.log(`🚀 Proxy server chạy ở http://localhost:${PORT}`);
});

// node src\api_helper\server_stt.js