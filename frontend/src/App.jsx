import React, { useContext, useEffect, lazy, Suspense } from "react";
import "./App.css";
import { Context } from "./main";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";
import ForgotPassword from "./components/Auth/ForgotPassword";
import { Toaster } from "react-hot-toast";
import axios from "axios";
import Navbar from "./components/Layout/Navbar";
import Footer from "./components/Layout/Footer";
import Home from "./components/Home/Home";
import Jobs from "./components/Job/Jobs";
import JobDetails from "./components/Job/JobDetails";
import Application from "./components/Application/Application";
import MyApplications from "./components/Application/MyApplications";
import PostJob from "./components/Job/PostJob";
import NotFound from "./components/NotFound/NotFound";
import MyJobs from "./components/Job/MyJobs";
import { JobProvider } from "./context/JobContext";
import { DashboardProvider } from "./context/DashboardContext";

// Lazy load dashboard and interview components (Task 19.3)
const Dashboard = lazy(() => import("./components/Dashboard/Dashboard"));
const InterviewAccept = lazy(() => import("./components/Interview/InterviewAccept"));
const InterviewReject = lazy(() => import("./components/Interview/InterviewReject"));
const SlotSelection = lazy(() => import("./components/Interview/SlotSelection"));
const NegotiationChat = lazy(() => import("./components/Interview/NegotiationChat"));

// Loading fallback
const PageLoading = () => (
  <div className="page-loading">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
);

const App = () => {
  const { isAuthorized, setIsAuthorized, setUser } = useContext(Context);
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get(
          "http://localhost:4000/api/v1/user/getuser",
          {
            withCredentials: true,
          }
        );
        setUser(response.data.user);
        setIsAuthorized(true);
      } catch (error) {
        setIsAuthorized(false);
      }
    };
    fetchUser();
  }, [isAuthorized]);

  return (
    <>
      <BrowserRouter>
        <JobProvider>
          <DashboardProvider>
            <Navbar />
            <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/" element={<Home />} />
                <Route path="/job/getall" element={<Jobs />} />
                <Route path="/job/:id" element={<JobDetails />} />
                <Route path="/application/:id" element={<Application />} />
                <Route path="/applications/me" element={<MyApplications />} />
                <Route path="/job/post" element={<PostJob />} />
                <Route path="/job/me" element={<MyJobs />} />

                {/* Dashboard Routes (Task 18.1) */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/dashboard/:jobId" element={<Dashboard />} />

                {/* Interview Routes (Task 18.1) */}
                <Route path="/interview/accept/:interviewId" element={<InterviewAccept />} />
                <Route path="/interview/reject/:interviewId" element={<InterviewReject />} />
                <Route path="/interview/select-slot/:interviewId" element={<SlotSelection />} />
                <Route path="/interview/negotiate/:interviewId" element={<NegotiationChat />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <Footer />
            <Toaster />
          </DashboardProvider>
        </JobProvider>
      </BrowserRouter>
    </>
  );
};

export default App;
