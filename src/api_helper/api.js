import axios from 'axios';

const API_BASE_URL = 'http://192.168.1.32:8000';

export const askAssistant = async (userInput, sessionId) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/ask`, {
      user_input: userInput,
      session_id: sessionId,
    });
    return response.data.response; // Lấy trường 'response' từ JSON
  } catch (error) {
    console.error('Lỗi khi gọi API:', error);
    throw error;
  }
};