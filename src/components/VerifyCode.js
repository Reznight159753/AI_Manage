// src/components/VerifyCode.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './VerifyCode.css';
import lockImage from '../assets/images/42.png'
import assistantIcon from '../assets/icons/icon.svg';
import { FaArrowLeft } from 'react-icons/fa';

const VerifyCode = () => {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleVerify = (e) => {
    e.preventDefault();
    if (code.trim().length === 6) {
      navigate('/reset-password');
    } else {
      alert('Mã xác nhận phải có 6 ký tự');
    }
  };

  return (
    <div className="verify-container">
      <div className="verify-content">
        <div className="header">
          <div className="logo-container">
            <img src={assistantIcon} alt="Assistant Icon" className="logo-icon" />
            <h2 className="app-title">Trợ lý ảo</h2>
          </div>
        </div>

        <div className="verify-main">
          <div className="verify-form-container">
            <h1 className="form-title">Mã xác minh</h1>
            <p className="form-subtitle">Mã xác minh đã được gửi đến email của bạn.</p>

            <form onSubmit={handleVerify} className="verify-form">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="input-field"
                placeholder="Nhập mã xác minh"
                maxLength={6}
                required
              />
              <button type="submit" className="verify-button">Xác minh</button>
            </form>
          </div>

          <div className="verify-image-container">
            <img src={lockImage} alt="Verification" className="verify-image" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyCode;
