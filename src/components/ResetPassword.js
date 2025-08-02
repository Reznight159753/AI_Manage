// src/components/ResetPassword.js
import React, { useState } from 'react';
import './ResetPassword.css';

const ResetPassword = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSendCode = (e) => {
    e.preventDefault();
    // Giả lập gửi mã
    if (email.includes('@')) {
      setStep(2);
    } else {
      alert('Vui lòng nhập email hợp lệ');
    }
  };

  const handleVerifyCode = (e) => {
    e.preventDefault();
    if (code.trim().length === 6) {
      setStep(3);
    } else {
      alert('Mã xác nhận gồm 6 ký tự');
    }
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Mật khẩu không khớp!');
      return;
    }
    alert('Mật khẩu của bạn đã được đặt lại thành công!');
    // Reset form
    setStep(1);
    setEmail('');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="reset-container">
      <div className="reset-box">
        <h2>Khôi phục mật khẩu</h2>
        {step === 1 && (
          <form onSubmit={handleSendCode}>
            <label>Email</label>
            <input
              type="email"
              placeholder="Nhập email của bạn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit">Gửi mã</button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyCode}>
            <label>Mã xác nhận</label>
            <input
              type="text"
              placeholder="Nhập mã 6 chữ số"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button type="submit">Xác minh</button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword}>
            <label>Mật khẩu mới</label>
            <input
              type="password"
              placeholder="Nhập mật khẩu mới"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <label>Nhập lại mật khẩu</label>
            <input
              type="password"
              placeholder="Xác nhận mật khẩu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <button type="submit">Đặt lại mật khẩu</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
