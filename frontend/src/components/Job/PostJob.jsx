import React, { useContext, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Context } from "../../main";
import { calculateBuffer } from "../../utils/helpers";
import { FaBriefcase, FaRobot } from "react-icons/fa";

const PostJob = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState("");
  const [salaryFrom, setSalaryFrom] = useState("");
  const [salaryTo, setSalaryTo] = useState("");
  const [fixedSalary, setFixedSalary] = useState("");
  const [salaryType, setSalaryType] = useState("default");
  const [numberOfOpenings, setNumberOfOpenings] = useState(1);

  const { isAuthorized, user } = useContext(Context);
  const navigateTo = useNavigate();

  const bufferValue = calculateBuffer(numberOfOpenings);

  const handleJobPost = async (e) => {
    e.preventDefault();
    if (salaryType === "Fixed Salary") {
      setSalaryFrom("");
      setSalaryTo("");
    } else if (salaryType === "Ranged Salary") {
      setFixedSalary("");
    } else {
      setSalaryFrom("");
      setSalaryTo("");
      setFixedSalary("");
    }

    const jobData =
      fixedSalary.length >= 4
        ? {
          title,
          description,
          category,
          country,
          city,
          location,
          fixedSalary,
          numberOfOpenings: parseInt(numberOfOpenings),
        }
        : {
          title,
          description,
          category,
          country,
          city,
          location,
          salaryFrom,
          salaryTo,
          numberOfOpenings: parseInt(numberOfOpenings),
        };

    await axios
      .post("http://localhost:4000/api/v1/job/post", jobData, {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
        },
      })
      .then((res) => {
        toast.success(res.data.message);
        navigateTo("/job/me");
      })
      .catch((err) => {
        toast.error(err.response.data.message);
      });
  };

  if (!isAuthorized || (user && user.role !== "Employer")) {
    navigateTo("/");
  }

  return (
    <>
      <div className="job_post page">
        <div className="container">
          <h3>POST NEW JOB</h3>
          <form onSubmit={handleJobPost}>
            <div className="wrapper">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Job Title"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select Category</option>
                <option value="Graphics & Design">Graphics & Design</option>
                <option value="Mobile App Development">Mobile App Development</option>
                <option value="Frontend Web Development">Frontend Web Development</option>
                <option value="MERN Stack Development">MERN Stack Development</option>
                <option value="Account & Finance">Account & Finance</option>
                <option value="Artificial Intelligence">Artificial Intelligence</option>
                <option value="Video Animation">Video Animation</option>
                <option value="MEAN Stack Development">MEAN Stack Development</option>
                <option value="Data Entry Operator">Data Entry Operator</option>
              </select>
            </div>
            <div className="wrapper">
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country"
              />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
            </div>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
            />

            {/* Number of Openings - Task 4.1 */}
            <div className="openings_wrapper">
              <label className="openings_label">
                <FaBriefcase style={{ marginRight: "8px" }} />
                Number of Openings *
              </label>
              <div className="openings_input_group">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={numberOfOpenings}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(100, parseInt(e.target.value) || 1));
                    setNumberOfOpenings(val);
                  }}
                  placeholder="Number of openings"
                  required
                  id="number-of-openings"
                />
                <div className="buffer_preview">
                  <FaRobot style={{ color: "#2d5649", fontSize: "18px" }} />
                  <div className="buffer_info">
                    <span className="buffer_label">Shortlisting Buffer</span>
                    <span className="buffer_value">{bufferValue} candidates</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Automation Settings Preview */}
            <div className="automation_preview">
              <h4 className="automation_preview_title">
                <FaRobot style={{ marginRight: "8px" }} />
                AI Automation Preview
              </h4>
              <div className="automation_preview_grid">
                <div className="automation_preview_item">
                  <span className="preview_stat_label">Openings</span>
                  <span className="preview_stat_value">{numberOfOpenings}</span>
                </div>
                <div className="automation_preview_item">
                  <span className="preview_stat_label">Buffer Candidates</span>
                  <span className="preview_stat_value">{bufferValue}</span>
                </div>
                <div className="automation_preview_item">
                  <span className="preview_stat_label">Total Shortlisted</span>
                  <span className="preview_stat_value highlight">
                    {parseInt(numberOfOpenings) + bufferValue}
                  </span>
                </div>
                <div className="automation_preview_item">
                  <span className="preview_stat_label">Buffer Formula</span>
                  <span className="preview_stat_value small">
                    {numberOfOpenings == 1
                      ? "Fixed: 4"
                      : numberOfOpenings >= 2 && numberOfOpenings <= 5
                        ? `H×3 = ${numberOfOpenings}×3`
                        : `H×2 = ${numberOfOpenings}×2`}
                  </span>
                </div>
              </div>
              <p className="automation_note">
                AI will automatically rank applicants, send interview invitations, and manage scheduling.
              </p>
            </div>

            <div className="salary_wrapper">
              <select
                value={salaryType}
                onChange={(e) => setSalaryType(e.target.value)}
              >
                <option value="default">Select Salary Type</option>
                <option value="Fixed Salary">Fixed Salary</option>
                <option value="Ranged Salary">Ranged Salary</option>
              </select>
              <div>
                {salaryType === "default" ? (
                  <p>Please provide Salary Type *</p>
                ) : salaryType === "Fixed Salary" ? (
                  <input
                    type="number"
                    placeholder="Enter Fixed Salary"
                    value={fixedSalary}
                    onChange={(e) => setFixedSalary(e.target.value)}
                  />
                ) : (
                  <div className="ranged_salary">
                    <input
                      type="number"
                      placeholder="Salary From"
                      value={salaryFrom}
                      onChange={(e) => setSalaryFrom(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Salary To"
                      value={salaryTo}
                      onChange={(e) => setSalaryTo(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
            <textarea
              rows="10"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Job Description"
            />
            <button type="submit">Create Job</button>
          </form>
        </div>
      </div>
    </>
  );
};

export default PostJob;
