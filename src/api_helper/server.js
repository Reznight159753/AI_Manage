// server.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Proxy cho QA
app.post("/api/ask", async (req, res) => {
  try {
    const response = await axios.post(
      "https://907f3d43ada4.ngrok-free.app/qa/ask",
      req.body,
      { headers: { "Content-Type": "application/json", "Accept": "application/json" } }
    );
    res.json(response.data);
  } catch (err) {
    console.error("Proxy Error /api/ask:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Proxy cho unique questions
app.post("/api/questions", async (req, res) => {
  try {
    const response = await axios.post(
      "https://907f3d43ada4.ngrok-free.app/conversation/get_unique_questions",
      {},
      { headers: { "Content-Type": "application/json", "Accept": "application/json" } }
    );
    res.json(response.data);
  } catch (err) {
    console.error("Proxy Error /api/questions:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Proxy server chạy ở http://localhost:${PORT}`);
});


// node src\api_helper\server.js