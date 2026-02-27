import React, { useState } from "react";
import { MdOutlineMailOutline } from "react-icons/md";
import { FaPencilAlt } from "react-icons/fa";
import { Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [favouriteSport, setFavouriteSport] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState(1);

  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(
        "http://localhost:4000/api/v1/user/forgot-password",
        { email, favouriteSport },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );
      toast.success(data.message);
      setStep(2);
    } catch (error) {
      toast.error(error.response.data.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(
        "http://localhost:4000/api/v1/user/reset-password",
        { email, favouriteSport, newPassword },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );
      toast.success(data.message);
      setEmail("");
      setFavouriteSport("");
      setNewPassword("");
    } catch (error) {
      toast.error(error.response.data.message);
    }
  };

  return (
    <section className="authPage forgotPasswordPage">
      <div className="container">
        <div className="header">
          <img src="/careerconnect-black.png" alt="logo" />
          <h3>Reset Your Password</h3>
        </div>
        {step === 1 ? (
          <form onSubmit={handleVerify}>
            <div className="inputTag">
              <label>Email Address</label>
              <div>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <MdOutlineMailOutline />
              </div>
            </div>
            <div className="inputTag">
              <label>Favourite Sport</label>
              <div>
                <input
                  type="text"
                  placeholder="Enter your favourite sport"
                  value={favouriteSport}
                  onChange={(e) => setFavouriteSport(e.target.value)}
                  required
                />
                <FaPencilAlt />
              </div>
            </div>
            <button type="submit">Verify</button>
            <Link to="/login">Back to Login</Link>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div className="inputTag">
              <label>New Password</label>
              <div>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <button type="submit">Reset Password</button>
            <Link to="/login">Back to Login</Link>
          </form>
        )}
      </div>
    </section>
  );
};

export default ForgotPassword;
