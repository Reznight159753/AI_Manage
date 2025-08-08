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
import './ModelDesign.css';
const _ = require('lodash');

const host = 'http://localhost:5000';

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
    console.log('Gửi văn bản tới server:', text);
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

function makeSpeech(text) {
  const cleanedText = cleanText(text);
  console.log('Văn bản gửi đi:', cleanedText);
  if (!cleanedText) {
    console.error('Lỗi: Văn bản sau khi làm sạch là rỗng');
    return Promise.reject(new Error('Văn bản rỗng sau khi làm sạch'));
  }
  return axios.post(host + '/talk', { text: cleanedText, language: 'vi-VN', voice: 'vi-VN-HoaiMy' });
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
  
  // States cho chat interface - đơn giản hóa
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: 'Xin chào! Tôi là Arwen. Tôi có thể nói bất cứ điều gì bạn muốn. Hãy nhập tin nhắn và tôi sẽ trả lời bạn.',
      timestamp: new Date()
    }
  ]);
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit', 
      hour12: true 
    }) + ' +07, ' + new Date().toLocaleDateString('en-GB')
  );

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
    const cleanedText = cleanText(value);
    setText(cleanedText);
  }

  function handleSend() {
    if (!text.trim() || speak) return;

    // Thêm tin nhắn của user
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: text.trim(),
      timestamp: new Date()
    };

    // Cập nhật messages
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    // Chuẩn bị cho phản hồi AI
    const currentText = text.trim();
    setText("");
    
    // Thêm tin nhắn AI và kích hoạt speech
    setTimeout(() => {
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: `Tôi hiểu bạn nói: "${currentText}". Tôi sẽ lặp lại nội dung này.`,
        timestamp: new Date()
      };
      
      const updatedMessages = [...newMessages, aiMessage];
      setMessages(updatedMessages);
      
      // Sử dụng nội dung AI để tạo giọng nói
      setSpeechText(aiMessage.content);
      setIsTyping(true);
      setSpeak(true);
    }, 100);
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
    alert('Chức năng Voice Chat sẽ được phát triển trong tương lai!');
  }

  return (
    <div className={`container ${isMobile ? 'mobile-layout' : 'desktop-layout'}`}>
      {/* Header - hiện trên cùng khi mobile */}
      {isMobile && (
        <div className="mobile-header">
          <div className="avatar-info">
            <div className="avatar-icon">A</div>
            <div className="avatar-name">Arwen AI</div>
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
              <div className="avatar-name">Arwen AI</div>
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
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.type === 'user' ? 'user-message' : 'ai-message'}`}
              >
                {message.content}
              </div>
            ))}
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
            />
            <div className="button-group">
              <button
                onClick={handleSend}
                className={`send-button ${(!text.trim() || speak) ? 'disabled-button' : ''}`}
                disabled={!text.trim() || speak}
              >
                {speak ? 'Đang gửi...' : 'Gửi'}
              </button>
              <button
                onClick={handleVoiceChat}
                className="voice-button"
                title="Voice Chat (Chưa khả dụng)"
              >
                🎤
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