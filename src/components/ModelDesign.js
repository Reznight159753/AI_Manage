import React, { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useTexture, Loader, Environment, useFBX, useAnimations, OrthographicCamera } from '@react-three/drei';
import { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial';
import { LineBasicMaterial, MeshPhysicalMaterial, Vector2 } from 'three';
import ReactAudioPlayer from 'react-audio-player';
import createAnimation from '../converter';
import blinkData from '../blendDataBlink.json';
import * as THREE from 'three';
import axios from 'axios';
import { SRGBColorSpace, LinearSRGBColorSpace } from 'three';
import { Send, Loader2 } from "lucide-react";
import { Mic, MicOff } from "lucide-react";
import './ModelDesign.css';
const _ = require('lodash');

const host = 'http://localhost:5000'; // Server TTS

// Cấu hình Viettel TTS
const VIETTEL_TTS_CONFIG = {
  url: 'https://viettelai.vn/tts/speech_synthesis',
  token: '', // API key (token) b2b7e8995ec7b6295eac0f5023a86990
  voice: 'hn-quynhanh',
  speed: 1.0,
  tts_return_option: 3, // MP3 format
  without_filter: false
};

// Cấu hình voice chat
const SILENCE_DURATION = 2000; // 2 giây
const VAD_THRESHOLD = 0.02; // Ngưỡng phát hiện giọng nói
const TARGET_SAMPLE_RATE = 8000;

// Utility function để tạo UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Hàm làm sạch văn bản tại frontend - chỉ loại bỏ ký tự đặc biệt nguy hiểm
function cleanText(text) {
  return text
    .replace(/[\uD800-\uDFFF]/g, '') // Loại bỏ surrogate characters
    .replace(/[^\x20-\x7E\u00C0-\u1EF9\s.,!?\-()]/g, '') // Giữ ASCII, tiếng Việt, dấu câu, dấu cách
    .trim();
}

function Avatar({ avatar_url, speak, setSpeak, text, setAudioSource, playing }) {
  let gltf = useGLTF(avatar_url);
  let morphTargetDictionaryBody = null;
  let morphTargetDictionaryLowerTeeth = null;

  const [
    bodyTexture, eyesTexture, teethTexture, bodySpecularTexture, bodyRoughnessTexture,
    bodyNormalTexture, teethNormalTexture, hairTexture, tshirtDiffuseTexture,
    tshirtNormalTexture, tshirtRoughnessTexture, hairAlphaTexture, hairNormalTexture,
    hairRoughnessTexture,
  ] = useTexture([
    "/images/body.webp", "/images/eyes.webp", "/images/teeth_diffuse.webp",
    "/images/body_specular.webp", "/images/body_roughness.webp", "/images/body_normal.webp",
    "/images/teeth_normal.webp", "/images/h_color.webp", "/images/tshirt_diffuse.webp",
    "/images/tshirt_normal.webp", "/images/tshirt_roughness.webp", "/images/h_alpha.webp",
    "/images/h_normal.webp", "/images/h_roughness.webp",
  ]);

  _.each([
    bodyTexture, eyesTexture, teethTexture, teethNormalTexture, bodySpecularTexture,
    bodyRoughnessTexture, bodyNormalTexture, tshirtDiffuseTexture, tshirtNormalTexture,
    tshirtRoughnessTexture, hairAlphaTexture, hairNormalTexture, hairRoughnessTexture,
  ], t => {
    t.colorSpace = SRGBColorSpace;
    t.flipY = false;
  });

  bodyNormalTexture.colorSpace = LinearSRGBColorSpace;
  tshirtNormalTexture.colorSpace = LinearSRGBColorSpace;
  teethNormalTexture.colorSpace = LinearSRGBColorSpace;
  hairNormalTexture.colorSpace = LinearSRGBColorSpace;

  gltf.scene.traverse(node => {
    if (node.type === 'Mesh' || node.type === 'LineSegments' || node.type === 'SkinnedMesh') {
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;

      if (node.name.includes("Body")) {
        node.material = new MeshPhysicalMaterial();
        node.material.map = bodyTexture;
        node.material.roughness = 1.7;
        node.material.roughnessMap = bodyRoughnessTexture;
        node.material.normalMap = bodyNormalTexture;
        node.material.normalScale = new Vector2(0.6, 0.6);
        node.material.color.setHex(0xF8E0A0);
        node.material.envMapIntensity = 0.8;
        morphTargetDictionaryBody = node.morphTargetDictionary;

        if (morphTargetDictionaryBody && morphTargetDictionaryBody['chinNarrow']) {
          node.morphTargetInfluences = node.morphTargetInfluences || [];
          node.morphTargetInfluences[morphTargetDictionaryBody['chinNarrow']] = 0.6;
        }
      }

      if (node.name.includes("Eyes")) {
        node.material = new MeshStandardMaterial();
        node.material.map = eyesTexture;
        node.material.roughness = 0.1;
        node.material.envMapIntensity = 0.5;
      }

      if (node.name.includes("Brows")) {
        node.material = new LineBasicMaterial({ color: 0x000000 });
        node.material.linewidth = 1;
        node.material.opacity = 0.5;
        node.material.transparent = true;
        node.visible = false;
      }

      if (node.name.includes("Teeth")) {
        node.material = new MeshStandardMaterial();
        node.material.roughness = 0.1;
        node.material.map = teethTexture;
        node.material.normalMap = teethNormalTexture;
        node.material.envMapIntensity = 0.7;
      }

      if (node.name.includes("Hair")) {
        node.material = new MeshStandardMaterial();
        node.material.map = hairTexture;
        node.material.alphaMap = hairAlphaTexture;
        node.material.normalMap = hairNormalTexture;
        node.material.roughnessMap = hairRoughnessTexture;
        node.material.transparent = true;
        node.material.depthWrite = false;
        node.material.side = 2;
        node.material.color.setHex(0x000000);
        node.material.envMapIntensity = 0.0;
      }

      if (node.name.includes("TSHIRT")) {
        node.material = new MeshStandardMaterial();
        node.material.map = tshirtDiffuseTexture;
        node.material.roughnessMap = tshirtRoughnessTexture;
        node.material.normalMap = tshirtNormalTexture;
        node.material.color.setHex(0xFFE4C4);
        node.material.envMapIntensity = 0.5;
      }

      if (node.name.includes("TeethLower")) {
        morphTargetDictionaryLowerTeeth = node.morphTargetDictionary;
      }
    }
  });

  const [clips, setClips] = useState([]);
  const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), []);

  // useEffect(() => {
  //   if (!speak) return;
  //   console.log('Gửi văn bản tới server TTS:', text);
  //   makeSpeech(text)
  //     .then(response => {
  //       let { blendData, filename } = response.data;
  //       let newClips = [
  //         createAnimation(blendData, morphTargetDictionaryBody, 'HG_Body'),
  //         createAnimation(blendData, morphTargetDictionaryLowerTeeth, 'HG_TeethLower')
  //       ];
  //       filename = `${host}${filename}?t=${Date.now()}`;
  //       console.log('File MP3:', filename);
  //       setClips(newClips);
  //       setAudioSource(filename);
  //       setSpeak(false);
  //     })
  //     .catch(err => {
  //       console.error('Lỗi khi tạo âm thanh:', err.message);
  //       setSpeak(false);
  //     });
  // }, [speak, text, setAudioSource]);

  useEffect(() => {
    if (!speak) return;
    console.log('Gửi văn bản tới Viettel TTS:', text);
    
    makeSpeech(text)
      .then(response => {
        let { blendData, filename } = response.data;
        
        // Với Viettel TTS, có thể không có blendData
        let newClips = [];
        if (blendData && blendData.length > 0) {
          newClips = [
            createAnimation(blendData, morphTargetDictionaryBody, 'HG_Body'),
            createAnimation(blendData, morphTargetDictionaryLowerTeeth, 'HG_TeethLower')
          ];
        }
        
        console.log('File MP3 từ Viettel:', filename);
        setClips(newClips);
        setAudioSource(filename);
        setSpeak(false);
      })
      .catch(err => {
        console.error('Lỗi khi tạo âm thanh Viettel:', err.message);
        setSpeak(false);
      });
  }, [speak, text, setAudioSource]);

  let idleFbx = useFBX('/idle.fbx');
  let { clips: idleClips } = useAnimations(idleFbx.animations);

  idleClips[0].tracks = _.filter(idleClips[0].tracks, track => {
    return track.name.includes("Head") || track.name.includes("Neck") || track.name.includes("Spine2");
  });

  idleClips[0].tracks = _.map(idleClips[0].tracks, track => {
    if (track.name.includes("Head")) track.name = "head.quaternion";
    if (track.name.includes("Neck")) track.name = "neck.quaternion";
    if (track.name.includes("Spine")) track.name = "spine2.quaternion";
    return track;
  });

  useEffect(() => {
    let idleClipAction = mixer.clipAction(idleClips[0]);
    idleClipAction.play();
    let blinkClip = createAnimation(blinkData, morphTargetDictionaryBody, 'HG_Body');
    let blinkAction = mixer.clipAction(blinkClip);
    blinkAction.play();
  }, [mixer]);

  useEffect(() => {
    if (!playing) return;
    _.each(clips, clip => {
      let clipAction = mixer.clipAction(clip);
      clipAction.setLoop(THREE.LoopOnce);
      clipAction.play();
    });
  }, [playing, clips]);

  useFrame((state, delta) => {
    mixer.update(delta);
  });

  return (
    <group name="avatar">
      <primitive object={gltf.scene} dispose={null} position={[-0.1, 0.5, 0]} scale={[0.6, 0.6, 0.6]} />
    </group>
  );
}

// Hàm gọi API TTS (giữ nguyên)
// function makeSpeech(text) {
//   const cleanedText = cleanText(text);
//   console.log('Văn bản gửi đi TTS:', cleanedText);
//   if (!cleanedText) {
//     console.error('Lỗi: Văn bản sau khi làm sạch là rỗng');
//     return Promise.reject(new Error('Văn bản rỗng sau khi làm sạch'));
//   }
//   return axios.post(host + '/talk', { text: cleanedText, language: 'vi-VN', voice: 'vi-VN-HoaiMy' });
// }

async function makeSpeech(text) {
  const cleanedText = cleanText(text);
  console.log('Văn bản gửi đi TTS:', cleanedText);
  
  if (!cleanedText) {
    console.error('Lỗi: Văn bản sau khi làm sạch là rỗng');
    return Promise.reject(new Error('Văn bản rỗng sau khi làm sạch'));
  }

  try {
    const response = await axios.post(VIETTEL_TTS_CONFIG.url, {
      text: cleanedText,
      voice: VIETTEL_TTS_CONFIG.voice,
      speed: VIETTEL_TTS_CONFIG.speed,
      tts_return_option: VIETTEL_TTS_CONFIG.tts_return_option,
      token: VIETTEL_TTS_CONFIG.token,
      without_filter: VIETTEL_TTS_CONFIG.without_filter
    }, {
      headers: {
        'accept': '*/*',
        'Content-Type': 'application/json'
      },
      responseType: 'blob' // Quan trọng: nhận file audio dạng blob
    });

    // Tạo URL cho audio blob
    const audioBlob = response.data;
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Trả về format giống server cũ để không phải sửa logic khác
    return {
      data: {
        blendData: [], // Có thể để trống nếu không cần morph targets
        filename: audioUrl
      }
    };
    
  } catch (error) {
    console.error('Lỗi Viettel TTS:', error);
    throw new Error(`Lỗi TTS: ${error.message}`);
  }
}

// Hàm gọi API AI Assistant với React proxy
async function callAIAssistant(userInput, sessionId) {
  const endpoint = 'http://localhost:4000/api/ask';
  
  try {
    const response = await axios.post(endpoint, {
      user_input: userInput,   // giống curl
      session_id: sessionId    // giống curl
    }, {
      timeout: 100000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      withCredentials: false
    });

    console.log('API Response:', response.data);
    const responseData = response.data;

    // Nếu server trả string
    if (typeof responseData === 'string') {
      return responseData.trim();
    }

    // Nếu server trả object có field chuẩn
    if (responseData?.response) return responseData.response.trim();
    if (responseData?.answer) return responseData.answer.trim();
    if (responseData?.message) return responseData.message.trim();
    if (responseData?.data) return responseData.data.trim();

    // Nếu là object khác => stringify
    if (typeof responseData === 'object') {
      return JSON.stringify(responseData, null, 2);
    }

    return 'Phản hồi không hợp lệ từ server.';

  } catch (error) {
    console.error('Error calling API:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return `Lỗi kết nối: ${error.message}`;
  }
}


// Hàm suggestedQuestions
async function fetchSuggestedQuestions() {
  const endpoint = "http://localhost:4000/api/questions"; // gọi qua proxy

  try {
    console.log(`📡 Attempting to fetch from: ${endpoint}`);
    const response = await axios.post(endpoint, {}, {
      timeout: 50000,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });

    console.log("✅ Response received:", response.data);

    const responseData = response.data;

    // Format { unique_questions: [{ user: "câu hỏi" }] }
    if (responseData?.unique_questions && Array.isArray(responseData.unique_questions)) {
      const questions = responseData.unique_questions
        .map(item => item?.user?.trim() || null)
        .filter(Boolean);

      if (questions.length > 0) {
        console.log("Successfully extracted questions:", questions);
        return questions;
      }
    }

    console.warn(`No valid questions found in response:`, responseData);
    return [];

  } catch (error) {
    console.error(`Error with endpoint ${endpoint}:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw new Error("Không thể lấy câu hỏi gợi ý từ API. Vui lòng kiểm tra kết nối mạng và thử lại.");
  }
}


function Bg() {
  const texture = useTexture('/images/bg.webp');
  return (
    <mesh position={[0, 1.5, -2.5]}>
      <planeGeometry args={[1.4, 0.788]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}


function VoiceStatusIndicator({
  isVoiceChatActive,
  isSpeaking,
  isProcessing,
  voiceActivityLevel = 0,
  onStop
}) {
  if (!isVoiceChatActive) return null;
  
  return (
    <div className="voice-status-indicator">
      <div className="voice-status-content">
        <div className={`voice-icon ${isSpeaking ? 'speaking' : 'listening'}`}>
          <Mic size={20} />
          {isSpeaking && <div className="pulse-ring"></div>}
        </div>
       
        <div className="voice-info">
          <div className="voice-status-text">
            {isProcessing ? 'Đang xử lý...' :
            isSpeaking ? 'Đang nghe...' :
            'Sẵn sàng nghe'}
          </div>
         
          <div className="volume-meter">
            <div
              className="volume-bar"
              style={{ width: `${Math.min(voiceActivityLevel * 100, 100)}%` }}
            ></div>
          </div>
        </div>
       
        <button
          onClick={onStop}
          className="stop-voice-button"
          title="Dừng voice chat"
        >
          ×
        </button>
      </div>
    </div>
  );
}


function ModelDesign() {
  const navigate = useNavigate();
  const audioPlayer = useRef();
  const chatAreaRef = useRef();

  // State cho voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [silenceCountdown, setSilenceCountdown] = useState(0);
  const audioContextRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const vadProcessorRef = useRef(null);
  const streamRef = useRef(null);


  // Session ID - tạo UUID duy nhất cho mỗi phiên
  const [sessionId] = useState(() => generateUUID());
  
  // States cho model 3D
  const [speak, setSpeak] = useState(false);
  const [text, setText] = useState("");
  const [speechText, setSpeechText] = useState("");
  const [audioSource, setAudioSource] = useState(null);
  const [playing, setPlaying] = useState(false);
  
  // State cho màn hình mobile
  const [isMobile, setIsMobile] = useState(false);
  
  // State cho hiệu ứng typing animation
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingSpeed = 30; // Tốc độ typing cố định (ms)
  
  // State cho trạng thái loading
  const [isProcessing, setIsProcessing] = useState(false);
  
  // State cho connection status
  const [connectionStatus, setConnectionStatus] = useState('checking');
  
  // States cho chat interface
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: 'Xin chào! Tôi là Arwen, trợ lý AI của bạn. Tôi có thể trò chuyện và trả lời các câu hỏi của bạn. Hãy nhập tin nhắn để bắt đầu!',
      timestamp: new Date()
    }
  ]);

  // State cho suggested questions
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  // const [showSuggestions, setShowSuggestions] = useState(true);

  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit', 
      hour12: true 
    }) + ' +07, ' + new Date().toLocaleDateString('en-GB')
  );

  // Test connection khi component mount
  // useEffect(() => {
  //   const testConnection = async () => {
  //     console.log('🔍 Testing connection to AI server...');
  //     try {
  //       const response = await callAIAssistant('test', sessionId);
  //       if (response.includes('không thể kết nối')) {
  //         setConnectionStatus('failed');
  //       } else {
  //         setConnectionStatus('connected');
  //         console.log('✅ Connection test successful');
  //       }
  //     } catch (error) {
  //       setConnectionStatus('failed');
  //       console.log('❌ Connection test failed:', error);
  //     }
  //   };
    
  //   testConnection();
  // }, [sessionId]);

  useEffect(() => {
    console.log('🚀 Component mounted, loading suggested questions...');
    
    const loadSuggestions = async () => {
      try {
        const questions = await fetchSuggestedQuestions();
        console.log('📝 Setting suggested questions:', questions);
        setSuggestedQuestions(questions.slice(0, 5)); // Chỉ lấy 5 câu đầu

        // Force log state để debug
        setTimeout(() => {
          console.log('📊 Current suggestedQuestions state:', questions.slice(0, 5));
          console.log('📊 Current showSuggestions state:', true);
        }, 100);
        
      } catch (error) {
        console.error('❌ Error in loadSuggestions:', error);
        // Vẫn set fallback questions
        setSuggestedQuestions([
          "trường có bao nhiêu khoa ?",
          "đối tượng tuyển sinh của trường đại học", 
          "phạm vi tuyển sinh của trường đại học",
          "hi",
        ]);
      }
    };
    
    loadSuggestions();
  }, []);

  // Kiểm tra kích thước màn hình
  useEffect(() => {
    const checkScreenSize = () => {
      const isMobileScreen = window.innerWidth <= 1000 ||  // Tăng từ 768 lên 1000
                          (window.innerWidth < window.innerHeight && window.innerWidth <= 1200);  // Tăng từ 1024 lên 1200
      setIsMobile(isMobileScreen);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Cập nhật thời gian
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit', 
          hour12: true 
        }) + ' +07, ' + new Date().toLocaleDateString('en-GB')
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Typing animation effect
  useEffect(() => {
    if (!speechText || !isTyping) return;
    
    let index = 0;
    setDisplayedText("");
    
    const timer = setInterval(() => {
      setDisplayedText(speechText.slice(0, index + 1));
      index++;
      
      if (index >= speechText.length) {
        clearInterval(timer);
        setIsTyping(false);
      }
    }, typingSpeed);
    
    return () => clearInterval(timer);
  }, [speechText, isTyping]);

  // Tự động scroll xuống cuối khi có tin nhắn mới
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Debug: Log session ID và connection status
  useEffect(() => {
    console.log('Session ID:', sessionId);
    console.log('Connection Status:', connectionStatus);
  }, [sessionId, connectionStatus]);

  useEffect(() => {
    const cleanup = async () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (vadProcessorRef.current) {
        vadProcessorRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      setIsRecording(false);
      setVoiceLevel(0);
      setSilenceCountdown(0);
    };

    return cleanup;
  }, []);


  async function handleSuggestedQuestionClick(question) {
    if (isProcessing) return;
    
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: question,
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    setIsProcessing(true);

    try {
      const aiResponse = await callAIAssistant(question, sessionId);
      
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date()
      };
      
      const updatedMessages = [...newMessages, aiMessage];
      setMessages(updatedMessages);
      
      // Kích hoạt speech nếu không phải error message
      if (!aiResponse.includes('không thể kết nối') && !aiResponse.includes('Phản hồi không hợp lệ')) {
        setSpeechText(aiResponse);
        setIsTyping(true);
        setSpeak(true);
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('failed');
      }
      
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: `Đã xảy ra lỗi: ${error.message}`,
        timestamp: new Date()
      };
      
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      setConnectionStatus('failed');
    }
    
    setIsProcessing(false);
  }

// Hàm gọi API Speech-to-Text
// Hàm gọi API Speech-to-Text
async function callSpeechToText(audioBlob) {
  // Chuyển đổi audio sang WAV trước khi gửi
  const wavBlob = await convertToWav(audioBlob);
  const formData = new FormData();
  formData.append('file', wavBlob, 'recording.wav');

  const endpoint = 'http://localhost:8000/recognize-stream';

  try {
    console.log(`Gọi API Speech-to-Text: ${endpoint}`);

    const response = await axios.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json'
      },
      timeout: 30000,
    });

    console.log('Phản hồi Speech-to-Text:', response.data);

    // Cập nhật logic xử lý response theo format mới
    if (response.data && response.data.status === 'success') {
      if (response.data.transcript && response.data.transcript.trim()) {
        return response.data.transcript.trim();
      } else {
        // Xử lý trường hợp code 204 (không có kết quả)
        if (response.data.code === 204) {
          throw new Error('Không nhận dạng được giọng nói. Vui lòng nói to và rõ hơn.');
        } else {
          throw new Error('Không nhận được văn bản từ API');
        }
      }
    } else {
      // Xử lý trường hợp status là 'error'
      throw new Error(response.data.message || 'Nhận dạng giọng nói thất bại');
    }
  } catch (error) {
    console.error(`Lỗi Speech-to-Text với ${endpoint}:`, error.message);
    
    if (error.response) {
      const errorData = error.response.data;
      
      // Xử lý response error theo format mới
      if (errorData && errorData.status === 'error') {
        throw new Error(`Lỗi API: ${errorData.message} (Mã: ${errorData.code})`);
      } else if (error.response.status === 400) {
        throw new Error(`Lỗi định dạng file: ${errorData.detail || 'File không hợp lệ'}`);
      } else if (error.response.status === 500) {
        throw new Error(`Lỗi server: ${errorData.detail || errorData.message || 'Lỗi xử lý âm thanh'}`);
      } else {
        throw new Error(`Nhận dạng giọng nói thất bại: ${errorData.detail || errorData.message || 'Lỗi không xác định'} (Mã: ${error.response.status})`);
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Yêu cầu hết thời gian sau 30 giây');
    } else {
      throw new Error(`Lỗi mạng: ${error.message}`);
    }
  }
}

const startRecording = async () => {
  try {
    const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
    if (permissionStatus.state === 'denied') {
      throw new Error('Quyền truy cập microphone bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: TARGET_SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.current = stream;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: TARGET_SAMPLE_RATE,
    });
    audioContextRef.current = audioContext;

    console.log(`AudioContext tạo với sample rate: ${audioContext.sampleRate}Hz`);

    const supportedMimeTypes = ['audio/wav', 'audio/webm', 'audio/ogg'];
    let mimeType = supportedMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));

    if (!mimeType) {
      throw new Error('Trình duyệt không hỗ trợ định dạng âm thanh nào (WAV, WebM, OGG).');
    }

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;

    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.start(100);

    // Tạo Voice Activity Detection
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(1024, 1, 1);
    vadProcessorRef.current = processor;

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      let sum = 0.0;
      for (let i = 0; i < input.length; i++) {
        sum += input[i] * input[i];
      }
      const rms = Math.sqrt(sum / input.length);

      setVoiceLevel(Math.min(rms * 100, 100));

      if (rms > VAD_THRESHOLD) {
        // Có giọng nói - hủy timer silence
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setSilenceCountdown(0);
      } else {
        // Im lặng - bắt đầu đếm ngược
        if (!silenceTimerRef.current) {
          console.log('Bắt đầu đếm ngược 2 giây im lặng');

          let countdown = SILENCE_DURATION / 100;
          setSilenceCountdown(countdown);

          countdownIntervalRef.current = setInterval(() => {
            countdown -= 1;
            setSilenceCountdown(Math.max(0, countdown));
          }, 100);

          silenceTimerRef.current = setTimeout(() => {
            console.log('Đã im lặng 2 giây, gửi audio');
            setSilenceCountdown(0);
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            sendAudioToSTT();
          }, SILENCE_DURATION);
        }
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    setIsRecording(true);
    console.log(`Bắt đầu ghi âm với ${TARGET_SAMPLE_RATE}Hz`);
  } catch (error) {
    console.error('Lỗi khi bắt đầu ghi âm:', error);
    alert(`Không thể truy cập microphone: ${error.message}`);
  }
};

const stopRecording = async () => {
  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
    mediaRecorderRef.current.stop();
  }
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop());
  }
  if (vadProcessorRef.current) {
    vadProcessorRef.current.disconnect();
  }
  if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
    await audioContextRef.current.close();
  }
  if (silenceTimerRef.current) {
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
  }
  if (countdownIntervalRef.current) {
    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = null;
  }

  audioChunksRef.current = [];
  setIsRecording(false);
  setVoiceLevel(0);
  setSilenceCountdown(0);
  console.log('Dừng ghi âm');
};

const sendAudioToSTT = async () => {
  if (audioChunksRef.current.length === 0) {
    console.log('Không có âm thanh để gửi');
    return;
  }

  setIsProcessing(true);
  console.log('Chuẩn bị gửi âm thanh đến STT API...');

  mediaRecorderRef.current.stop();

  await new Promise((resolve) => {
    mediaRecorderRef.current.onstop = resolve;
  });

  try {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
    const wavBlob = await convertToWav(audioBlob);

    const audioSize = (wavBlob.size / 1024).toFixed(2);
    console.log(`Audio: ${audioSize}KB, ${TARGET_SAMPLE_RATE}Hz`);

    // Reset chunks và tiếp tục ghi
    audioChunksRef.current = [];
    mediaRecorderRef.current.start(100);

    const transcribedText = await callSpeechToText(wavBlob);

    if (transcribedText.trim()) {
      setText(transcribedText);

      // Tạo user message
      const userMessage = {
        id: Date.now(),
        type: 'user',
        content: transcribedText.trim(),
        timestamp: new Date()
      };

      // Thêm user message trước
      setMessages(prevMessages => [...prevMessages, userMessage]);

      // Gọi AI và thêm AI message
      try {
        const aiResponse = await callAIAssistant(transcribedText, sessionId);

        const aiMessage = {
          id: Date.now() + Math.random(), // Đảm bảo ID unique
          type: 'ai',
          content: aiResponse,
          timestamp: new Date()
        };

        // Thêm AI message
        setMessages(prevMessages => [...prevMessages, aiMessage]);

        if (!aiResponse.includes('không thể kết nối')) {
          setSpeechText(aiResponse);
          setIsTyping(true);
          setSpeak(true);
          setConnectionStatus('connected');
        }
      } catch (error) {
        console.error('Lỗi gọi AI:', error);
        
        // Thêm error message nếu cần
        const errorMessage = {
          id: Date.now() + Math.random(),
          type: 'ai',
          content: `Lỗi kết nối: ${error.message}`,
          timestamp: new Date()
        };
        
        setMessages(prevMessages => [...prevMessages, errorMessage]);
      }

      setText("");
    } else {
      console.log('Không nhận dạng được giọng nói');
    }

  } catch (error) {
    console.error('Lỗi xử lý giọng nói:', error);
  }

  setIsProcessing(false);
};

async function processVoiceInput(audioBlob) {
  setIsProcessing(true);

  try {
    console.log('🔄 Đang chuyển giọng nói thành văn bản...');
    const transcribedText = await callSpeechToText(audioBlob);

    if (transcribedText.trim()) {
      setText(transcribedText);

      const userMessage = {
        id: Date.now(),
        type: 'user',
        content: transcribedText.trim(),
        timestamp: new Date()
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);

      const aiResponse = await callAIAssistant(transcribedText, sessionId);

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date()
      };

      setMessages([...newMessages, aiMessage]);

      if (!aiResponse.includes('không thể kết nối')) {
        setSpeechText(aiResponse);
        setIsTyping(true);
        setSpeak(true);
        setConnectionStatus('connected');
      }

      setText("");
    } else {
      alert('Không nhận dạng được giọng nói. Vui lòng thử lại.');
    }

  } catch (error) {
    console.error('❌ Lỗi xử lý giọng nói:', error);
    // Hiển thị thông báo lỗi chi tiết hơn
    alert('Lỗi nhận dạng giọng nói: ' + error.message);
  }

  setIsProcessing(false);
}

const convertToWav = async (audioBlob) => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: TARGET_SAMPLE_RATE });
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const wavBlob = audioBufferToWav(audioBuffer);
    return wavBlob;
  } catch (error) {
    console.error('Lỗi khi chuyển đổi âm thanh:', error);
    return audioBlob;
  } finally {
    if (audioContext.state !== 'closed') {
      await audioContext.close();
    }
  }
};

const audioBufferToWav = (buffer) => {
  const length = buffer.length;
  const numberOfChannels = 1;
  const sampleRate = TARGET_SAMPLE_RATE;
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(arrayBuffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * numberOfChannels * 2, true);

  const channelData = buffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < channelData.length; i++, offset += 2) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
};


function handleVoiceChat() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

// Audio player handlers

function playerEnded() {
  // Cleanup blob URL để tránh memory leak
  if (audioSource && audioSource.startsWith('blob:')) {
    URL.revokeObjectURL(audioSource);
  }
  
  setAudioSource(null);
  setSpeak(false);
  setPlaying(false);
}

  function playerReady() {
    audioPlayer.current.audioEl.current.play();
    setPlaying(true);
  }

  // Chat handlers
  function handleTextChange(e) {
    const value = e.target.value.substring(0, 500);
    //const cleanedText = cleanText(value);
    setText(value);
  }

  async function handleSend() {
    if (!text.trim() || isProcessing) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: text.trim(),
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    const currentInput = text.trim();
    setText("");
    setIsProcessing(true);

    try {
      const aiResponse = await callAIAssistant(currentInput, sessionId);
      
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date()
      };
      
      const updatedMessages = [...newMessages, aiMessage];
      setMessages(updatedMessages);
      
      // Kích hoạt speech nếu không phải error message
      if (!aiResponse.includes('không thể kết nối') && !aiResponse.includes('Phản hồi không hợp lệ')) {
        setSpeechText(aiResponse);
        setIsTyping(true);
        setSpeak(true);
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('failed');
      }
      
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: `Đã xảy ra lỗi: ${error.message}`,
        timestamp: new Date()
      };
      
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      setConnectionStatus('failed');
    }
    
    setIsProcessing(false);
  }

  function handleLogin() {
    navigate('/login');
  }

  function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // function handleVoiceChat() {
  //   if (isRecording) {
  //     stopRecording();
  //   } else {
  //     startRecording();
  //   }
  // }



  return (
    <div className={`container ${isMobile ? 'mobile-layout' : 'desktop-layout'}`}>

        <ReactAudioPlayer
          src={audioSource}
          ref={audioPlayer}
          onEnded={playerEnded}
          onCanPlayThrough={playerReady}
        />
      {/* Header - hiện trên cùng khi mobile */}
      {isMobile && (
        <div className="mobile-header">
          <div className="avatar-info">
            <div className="avatar-icon">A</div>
            <div className="avatar-name">
              Arwen AI 
              <span className={`connection-status ${connectionStatus}`}>
                {connectionStatus === 'connected' && '🟢'}
                {connectionStatus === 'failed' && '🔴'}
                {connectionStatus === 'checking' && '🟡'}
              </span>
            </div>
          </div>
          <div className="header-right">
            <div className="current-time">{currentTime}</div>
            <button onClick={handleLogin} className="login-button">
              Đăng nhập
            </button>
          </div>
        </div>
      )}

      {/* Model 3D Panel */}
      <div className="model-panel">
        <Canvas dpr={2} onCreated={(ctx) => {
          ctx.gl.physicallyCorrectLights = true;
        }}>
          <OrthographicCamera
            makeDefault
            zoom={isMobile ? 1200 : 1300}
            position={[0, 1.5, 0.5]}
          />

          <Suspense fallback={null}>
            <Environment background={false} files="/images/photo_studio_loft_hall_1k.hdr" />
          </Suspense>

          <Suspense fallback={null}>
            <Bg />
          </Suspense>

          <Suspense fallback={null}>
            <Avatar
              avatar_url="/model.glb"
              speak={speak}
              setSpeak={setSpeak}
              text={speechText}
              setAudioSource={setAudioSource}
              playing={playing}
            />
          </Suspense>
        </Canvas>
        {/* Voice Status Indicator */}
        <VoiceStatusIndicator
          isVoiceChatActive={isRecording}
          isSpeaking={voiceLevel > 10} // hoặc threshold phù hợp
          isProcessing={isProcessing}
          voiceActivityLevel={voiceLevel / 100}
          onStop={stopRecording}
        />
        <Loader dataInterpolation={(p) => `Đang tải... vui lòng đợi`} />
        
        {/* Speech Bubble trong model */}
        {(displayedText || isTyping) && (
          <div className={`speech-bubble ${isMobile ? 'mobile-bubble' : ''}`}>
            <div className="bubble-text">
              {displayedText}
              {isTyping && <span className="typing-cursor">|</span>}
            </div>
            <div className="bubble-tail"></div>
          </div>
        )}
      </div>

      {/* Chat Panel */}
      <div className="chat-panel">
        {/* Header cho desktop */}
        {!isMobile && (
          <div className="header_model">
            <div className="avatar-info">
              <div className="avatar-icon">A</div>
              <div className="avatar-name">
                Arwen AI
                <span className={`connection-status ${connectionStatus}`}>
                  {connectionStatus === 'connected' && '🟢'}
                  {connectionStatus === 'failed' && '🔴'}
                  {connectionStatus === 'checking' && '🟡'}
                </span>
              </div>
              {/* <div className="session-info">Session: {sessionId.substring(0, 8)}...</div> */}
              <div className="session-info">Session: {sessionId}</div>
            </div>
            <div className="header-right">
              <div className="current-time">{currentTime}</div>
              <button onClick={handleLogin} className="login-button">
                Đăng nhập
              </button>
            </div>
          </div>
        )}

        {/* Chat Messages - chỉ hiện trên desktop */}
        {!isMobile && (
          <div className="chat-area" ref={chatAreaRef}>
            {/* Connection status message */}
            {connectionStatus === 'failed' && (
              <div className="message system-message">
                🔴 Lỗi kết nối AI Server. Đang cố gắng kết nối lại...
              </div>
            )}
            {connectionStatus === 'connected' && messages.length === 1 && (
              <div className="message system-message">
                🟢 Đã kết nối thành công với AI Server!
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.type === 'user' ? 'user-message' : 'ai-message'}`}
              >
                {message.content}
              </div>
            ))}        
            {/* Loading indicator */}
            {isProcessing && (
              <div className="message ai-message processing">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            {!text.trim() && suggestedQuestions.length > 0 && (
              <div className="suggested-questions user-suggestions">
                <div className="suggestions-grid">
                  {suggestedQuestions.map((question, index) => (
                    <button
                      key={index}
                      className="suggestion-button"
                      onClick={() => handleSuggestedQuestionClick(question)}
                      disabled={isProcessing}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Area */}
        <div className={`input-area ${isMobile ? 'mobile-only-input' : ''}`}>
          <div className="input-container">
            <textarea
              className="text-input"
              value={text}
              onChange={handleTextChange}
              onKeyPress={handleKeyPress}
              placeholder="Nhập tin nhắn của bạn..."
              rows={1}
              disabled={isProcessing}
            />
            <div className="button-group">
              <button
                onClick={handleSend}
                className={`send-button ${(!text.trim() || isProcessing) ? 'disabled-button' : ''}`}
                disabled={!text.trim() || isProcessing}
              >
                {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
              </button>
              <button
                onClick={handleVoiceChat}
                className={`voice-button ${isRecording ? 'recording' : ''}`}
                // title={isRecording ? "Dừng ghi âm" : "Bắt đầu ghi âm"}
                disabled={isProcessing}
              >
                {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ReactAudioPlayer
        src={audioSource}
        ref={audioPlayer}
        onEnded={playerEnded}
        onCanPlayThrough={playerReady}
      />
    </div>
  );
}

export default ModelDesign;