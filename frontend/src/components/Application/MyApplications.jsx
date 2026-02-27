import React, { useContext, useEffect, useState } from "react";
import { Context } from "../../main";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import ResumeModal from "./ResumeModal";
import PDFViewer from './PDFViewer';
import PDFJSViewer from './PDFJSViewer';

const MyApplications = () => {
  const { user } = useContext(Context);
  const [applications, setApplications] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [resumeImageUrl, setResumeImageUrl] = useState("");
  const [viewMode, setViewMode] = useState('modal'); // Only using 'modal' now

  const { isAuthorized } = useContext(Context);
  const navigateTo = useNavigate();

  // Remove the toggleViewMode function since we're not switching between views anymore

  useEffect(() => {
    try {
      if (user && user.role === "Employer") {
        axios
          .get("http://localhost:4000/api/v1/application/employer/getall", {
            withCredentials: true,
          })
          .then((res) => {
            setApplications(res.data.applications);
          });
      } else {
        axios
          .get("http://localhost:4000/api/v1/application/jobseeker/getall", {
            withCredentials: true,
          })
          .then((res) => {
            setApplications(res.data.applications);
          });
      }
    } catch (error) {
      toast.error(error.response.data.message);
    }
  }, [isAuthorized]);

  if (!isAuthorized) {
    navigateTo("/");
  }

  const deleteApplication = (id) => {
    try {
      axios
        .delete(`http://localhost:4000/api/v1/application/delete/${id}`, {
          withCredentials: true,
        })
        .then((res) => {
          toast.success(res.data.message);
          setApplications((prevApplication) =>
            prevApplication.filter((application) => application._id !== id)
          );
        });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  };

  const openModal = (imageUrl) => {
    console.log("Opening modal with URL:", imageUrl);
    setResumeImageUrl(imageUrl);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  return (
    <section className="my_applications page">
      {user && user.role === "Job Seeker" ? (
        <div className="container">
          <center>
          <h1>My Applications</h1>
          </center>
          {applications.length <= 0 ? (
            <>
              {" "}
              <center>
              <h4>No Applications Found</h4></center>{" "}
            </>
          ) : (
            applications.map((element) => {
              return (
                <JobSeekerCard
                  element={element}
                  key={element._id}
                  deleteApplication={deleteApplication}
                  openModal={openModal}
                />
              );
            })
          )}
        </div>
      ) : (
        <div className="container">
          <center>
          <h1>Applications From Job Seekers</h1>
          </center>
          {applications.length <= 0 ? (
            <>
            <center>
              <h4>No Applications Found</h4>
              </center>
            </>
          ) : (
            applications.map((element) => {
              return (
                <EmployerCard
                  element={element}
                  key={element._id}
                  openModal={openModal}
                />
              );
            })
          )}
        </div>
      )}
      {modalOpen && (
        <ResumeModal imageUrl={resumeImageUrl} onClose={closeModal} />
      )}
    </section>
  );
};

export default MyApplications;

const JobSeekerCard = ({ element, deleteApplication, openModal }) => {
  return (
    <div className="job_seeker_card">
      {/* Left section - Applicant info */}
      <div className="applicant-info">
        <p><span>Name:</span> {element.name}</p>
        <p><span>Email:</span> {element.email}</p>
        <p><span>Phone:</span> {element.phone}</p>
        <p><span>Address:</span> {element.address}</p>
        <p><span>CoverLetter:</span> {element.coverLetter}</p>
        <p className="status-display">
          <span>Application Status:</span>
          <span className={`status ${element.status}`}>
            {element.status.charAt(0).toUpperCase() + element.status.slice(1)}
          </span>
        </p>
      </div>
      
      {/* Middle section - View PDF button */}
      <div className={`resume-section ${element.status !== "pending" ? "right-aligned" : ""}`}>
        <div 
          className="pdf-thumbnail" 
          onClick={() => openModal(element.resume.url)}
        >
          View PDF Resume
        </div>
      </div>
      
      {/* Right section - Delete button (only for pending) */}
      {element.status === "pending" && (
        <div className="action-section">
          <button 
            className="delete-btn"
            onClick={() => deleteApplication(element._id)}
          >
            Delete Application
          </button>
        </div>
      )}
    </div>
  );
};

const EmployerCard = ({ element, openModal }) => {
  const [status, setStatus] = useState(element.status);

  const handleStatusUpdate = async (newStatus) => {
    try {
      const response = await axios.put(
        `http://localhost:4000/api/v1/application/status/${element._id}`,
        { status: newStatus },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        setStatus(newStatus);
        toast.success(response.data.message);
      }
    } catch (error) {
      toast.error(error.response.data.message);
    }
  };

  return (
    <div className="job_seeker_card">
      {/* Left section - Applicant info */}
      <div className="applicant-info">
        <p><span>Name:</span> {element.name}</p>
        <p><span>Email:</span> {element.email}</p>
        <p><span>Phone:</span> {element.phone}</p>
        <p><span>Address:</span> {element.address}</p>
        <p><span>CoverLetter:</span> {element.coverLetter}</p>
        <p className="status-display">
          <span>Application Status:</span>
          <span className={`status ${status}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </p>
      </div>
      
      {/* Middle section - View PDF button */}
      <div className="resume-section">
        <div 
          className="pdf-thumbnail" 
          onClick={() => openModal(element.resume.url)}
        >
          View PDF Resume
        </div>
      </div>
      
      {/* Right section - Action buttons */}
      <div className="action-section">
        <button 
          onClick={() => handleStatusUpdate("accepted")}
          className={status === "accepted" ? "accept-btn active" : "accept-btn"}
          disabled={status === "accepted"}
        >
          Accept
        </button>
        <button 
          onClick={() => handleStatusUpdate("rejected")}
          className={status === "rejected" ? "reject-btn active" : "reject-btn"}
          disabled={status === "rejected"}
        >
          Reject
        </button>
      </div>
    </div>
  );
};
