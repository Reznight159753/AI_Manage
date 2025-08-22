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

// AI Endpoints - sử dụng proxy để tránh CORS
const AI_ENDPOINTS = [
  //'http://localhost:3001/api/ai',  // Proxy server
  'https://3a686927e9b9.ngrok-free.app/'      // Fallback: Direct connection
];

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

  useEffect(() => {
    if (!speak) return;
    console.log('Gửi văn bản tới server TTS:', text);
    makeSpeech(text)
      .then(response => {
        let { blendData, filename } = response.data;
        let newClips = [
          createAnimation(blendData, morphTargetDictionaryBody, 'HG_Body'),
          createAnimation(blendData, morphTargetDictionaryLowerTeeth, 'HG_TeethLower')
        ];
        filename = `${host}${filename}?t=${Date.now()}`;
        console.log('File MP3:', filename);
        setClips(newClips);
        setAudioSource(filename);
        setSpeak(false);
      })
      .catch(err => {
        console.error('Lỗi khi tạo âm thanh:', err.message);
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
function makeSpeech(text) {
  const cleanedText = cleanText(text);
  console.log('Văn bản gửi đi TTS:', cleanedText);
  if (!cleanedText) {
    console.error('Lỗi: Văn bản sau khi làm sạch là rỗng');
    return Promise.reject(new Error('Văn bản rỗng sau khi làm sạch'));
  }
  return axios.post(host + '/talk', { text: cleanedText, language: 'vi-VN', voice: 'vi-VN-HoaiMy' });
}

// Hàm gọi API AI Assistant với React proxy
async function callAIAssistant(userInput, sessionId) {
  const endpoints = [
    '/ask',  // React proxy
    'http://localhost:3001/api/ai/ask',  // Proxy server backup
    'https://3a686927e9b9.ngrok-free.app/ask'  // Direct connection backup
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.post(endpoint, {
        user_input: userInput,
        session_id: sessionId
      }, {
        timeout: 50000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        withCredentials: false
      });
      
      // Debug: Log response để xem structure
      console.log('API Response:', response.data);
      
      const responseData = response.data;
      
      // Xử lý response theo thứ tự ưu tiên
      // 1. Nếu response là string trực tiếp
      if (typeof responseData === 'string' && responseData.trim()) {
        return responseData.trim();
      }
      
      // 2. Nếu response có các field thông thường
      if (responseData?.response && typeof responseData.response === 'string') {
        return responseData.response.trim();
      }
      
      if (responseData?.answer && typeof responseData.answer === 'string') {
        return responseData.answer.trim();
      }
      
      if (responseData?.message && typeof responseData.message === 'string') {
        return responseData.message.trim();
      }
      
      if (responseData?.data && typeof responseData.data === 'string') {
        return responseData.data.trim();
      }
      
      // 3. Nếu response là object, thử convert thành string
      if (typeof responseData === 'object' && responseData !== null) {
        // Nếu có keys, thử lấy value đầu tiên là string
        const keys = Object.keys(responseData);
        for (const key of keys) {
          if (typeof responseData[key] === 'string' && responseData[key].trim()) {
            return responseData[key].trim();
          }
        }
        
        // Fallback: stringify object
        console.warn('Unknown response format:', responseData);
        return `Server response: ${JSON.stringify(responseData)}`;
      }
      
      // 4. Fallback cuối cùng
      return 'Phản hồi không hợp lệ từ server.';
      
    } catch (error) {
      console.error(`Error with endpoint ${endpoint}:`, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      // Nếu là endpoint cuối cùng và vẫn lỗi
      if (endpoint === endpoints[endpoints.length - 1]) {
        return `Lỗi kết nối: ${error.message}`;
      }
      
      continue;
    }
  }
  
  return `Xin lỗi, không thể kết nối đến server AI. Vui lòng thử lại sau.`;
}

// Hàm suggestedQuestions
// Hàm fetchSuggestedQuestions với fallback endpoint
async function fetchSuggestedQuestions() {
  const endpoints = [
    '/get_unique_questions',  // React proxy
    'http://localhost:3001/api/ai/get_unique_questions',  // Proxy server backup
    'https://3a686927e9b9.ngrok-free.app/get_unique_questions'  // Direct connection backup
  ];

  const fallbackQuestions = [
    "trường có bao nhiêu khoa ?",
    "đối tượng tuyển sinh của trường đại học",
    "phạm vi tuyển sinh của trường đại học",
    "hi"
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint, {
        timeout: 50000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        withCredentials: false
      });

      console.log("Suggested Questions Response:", response.data);

      const responseData = response.data;

      // ✅ Xử lý đúng format trả về
      if (responseData?.unique_questions && Array.isArray(responseData.unique_questions)) {
        return responseData.unique_questions
          .map(item => (item.user ? item.user.trim() : null))
          .filter(q => q); // loại bỏ null/empty
      }

      console.warn("Unknown suggested questions response format:", responseData);
      return fallbackQuestions;

    } catch (error) {
      console.error(`Error with endpoint ${endpoint}:`, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      if (endpoint === endpoints[endpoints.length - 1]) {
        return fallbackQuestions;
      }

      continue;
    }
  }

  return fallbackQuestions;
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

function ModelDesign() {
  const navigate = useNavigate();
  const audioPlayer = useRef();
  const chatAreaRef = useRef();
  // State cho voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  
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
  useEffect(() => {
    const testConnection = async () => {
      console.log('🔍 Testing connection to AI server...');
      try {
        const response = await callAIAssistant('test', sessionId);
        if (response.includes('không thể kết nối')) {
          setConnectionStatus('failed');
        } else {
          setConnectionStatus('connected');
          console.log('✅ Connection test successful');
        }
      } catch (error) {
        setConnectionStatus('failed');
        console.log('❌ Connection test failed:', error);
      }
    };
    
    testConnection();
  }, [sessionId]);

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
      const isMobileScreen = window.innerWidth <= 768 || 
                           (window.innerWidth < window.innerHeight && window.innerWidth <= 1024);
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
  async function callSpeechToText(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');

    const endpoints = [
      'https://40cb57cb8ef5.ngrok-free.app/transcribe',
      '/transcribe', // Nếu có proxy
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Calling Speech-to-Text: ${endpoint}`);
        
        const response = await axios.post(endpoint, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000, // 30s cho upload audio
        });

        console.log('Speech-to-Text response:', response.data);
        return response.data.text || response.data.transcription || '';
        
      } catch (error) {
        console.error(`STT Error with ${endpoint}:`, error);
        continue;
      }
    }
    
    throw new Error('Không thể kết nối đến Speech-to-Text server');
  }
  // Bắt đầu recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const chunks = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await processVoiceInput(audioBlob);
        
        // Dừng tất cả tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
      
      console.log('🎤 Started recording...');
      
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      alert('Không thể truy cập microphone. Vui lòng cho phép quyền truy cập.');
    }
  }

  // Dừng recording
  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      console.log('⏹️ Stopped recording');
    }
  }

  // Xử lý voice input
  async function processVoiceInput(audioBlob) {
    setIsProcessing(true);
    
    try {
      // Convert to WAV if needed
      const wavBlob = await convertToWav(audioBlob);
      
      // Gọi Speech-to-Text API
      console.log('🔄 Converting speech to text...');
      const transcribedText = await callSpeechToText(wavBlob);
      
      if (transcribedText.trim()) {
        // Set text vào input
        setText(transcribedText);
        
        // Tự động gửi luôn
        const userMessage = {
          id: Date.now(),
          type: 'user',
          content: transcribedText.trim(),
          timestamp: new Date()
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);

        // Gọi AI
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
        
        setText(""); // Clear input
      } else {
        alert('Không nhận dạng được giọng nói. Vui lòng thử lại.');
      }
      
    } catch (error) {
      console.error('❌ Voice processing error:', error);
      alert('Lỗi xử lý giọng nói: ' + error.message);
    }
    
    setIsProcessing(false);
  }

// Convert audio to WAV format
  async function convertToWav(audioBlob) {
    // Đơn giản hóa: return blob gốc, server sẽ handle conversion
    return audioBlob;
  }

// Audio player handlers
function playerEnded() {
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

  function handleVoiceChat() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  return (
    <div className={`container ${isMobile ? 'mobile-layout' : 'desktop-layout'}`}>
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
            zoom={isMobile ? 800 : 1300}
            position={[0, 1.5, 1]}
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
                {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              </button>
              <button
                onClick={handleVoiceChat}
                className={`voice-button ${isRecording ? 'recording' : ''}`}
                // title={isRecording ? "Dừng ghi âm" : "Bắt đầu ghi âm"}
                disabled={isProcessing}
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
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