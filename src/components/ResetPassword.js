//src/components/ResetNewPassword.js
import React, { useState } from "react";
import "./ResetPassword.css";
import lockImage from "../assets/images/41.png";
import assistantIcon from "../assets/icons/icon.svg";

const ResetNewPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleReset = (e) => {
    e.preventDefault();
    if (password !== confirm) {
      alert("Mật khẩu không khớp");
      return;
    }
    alert("Đặt lại mật khẩu thành công!");
  };

  return (
    <div className="resetpw-container">
      <div className="resetpw-content">
        <div className="header">
          <div className="logo-container">
            <img
              src={assistantIcon}
              alt="Assistant Icon"
              className="logo-icon"
            />
            <h2 className="app-title">Trợ lý ảo</h2>
          </div>
        </div>

        <div className="resetpw-main">
          <div className="resetpw-form-container">
            <h1 className="form-title">Đặt mật khẩu</h1>
            <p className="form-subtitle">
              Tạo mật khẩu mới cho tài khoản của bạn.
            </p>

            <form onSubmit={handleReset} className="resetpw-form">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Mật khẩu mới"
                required
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input-field"
                placeholder="Nhập lại mật khẩu"
                required
              />
              <button type="submit" className="resetpw-button">
                Đặt mật khẩu
              </button>
            </form>
          </div>

          <div className="resetpw-image-container">
            <img src={lockImage} alt="Reset" className="resetpw-image" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetNewPassword;
