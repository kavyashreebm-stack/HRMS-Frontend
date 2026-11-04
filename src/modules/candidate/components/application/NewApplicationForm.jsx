import React, { useState, useEffect } from "react";
import { Input, Select, Textarea } from "../ui/FormElements";
import { Eye, FileText, Download, X, Plus, Trash2, ShieldCheck, Info, User, Edit2 } from "lucide-react";
import { compressImage } from "../../../../shared/utils/imageUtils";
import { formatDDMMYYYY, isValidDate, isToAfterFrom, parseDate, displayDateDDMMYYYY } from "../utils/dateHelpers";
import { getCandidateOptions, getCandidateProfile, uploadFile, FILE_BASE_URL, getFileUrl } from "../../../../api";

const yesNoOptions = [
  { label: "Select", value: "" },
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
];

const experienceStatusOptions = [
  { label: "Fresher", value: "fresher" },
  { label: "Experienced", value: "experienced" },
];

const noticePeriodOptions = [
  { label: "Select", value: "" },
  { label: "Immediate Joiner", value: "immediate joiner" },
  { label: "15 Days", value: "15 days" },
  { label: "1 Month", value: "1 month" },
  { label: "3 Months", value: "3 months" },
];

const maritalStatusOptions = [
  { label: "Select", value: "" },
  { label: "Single", value: "single" },
  { label: "Married", value: "married" },
  { label: "Other", value: "other" },
];

export default function NewApplicationForm({
  formData,
  setFormData,
  readOnly,
  setIsDirty,
  isDirty,
  onSubmit,
  onBack,
  isSubmitting = false,
  setActiveTab,
  candidateId,
}) {
  const [jobs, setJobs] = useState([]);
  const [sources, setSources] = useState([{ label: "Select", value: "" }]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem("loggedInUser"));

        // Fetch candidate options (mandatory)
        try {
          const optRes = await getCandidateOptions();
          // Use open jobs list so candidate picks a specific job posting
          const jobOpts = (optRes.data.jobs || []).map(j => ({ label: j.label, value: j.value, department: j.department, job_id: j.id }));
          setJobs([{ label: "Select a Job Opening", value: "", department: "", job_id: null }, ...jobOpts]);
          setSources([{ label: "Select", value: "" }, ...optRes.data.sources]);
        } catch (optErr) {
          console.error("Failed to fetch candidate options", optErr);
        }

        // Fetch profile (optional, fail gracefully on 404)
        let p = null;
        const targetProfileId = candidateId || storedUser?.id;
        if (targetProfileId) {
          try {
            const profileRes = await getCandidateProfile(targetProfileId);
            p = profileRes.data;
          } catch (profileErr) {
            console.warn("No existing candidate profile found for auto-fill", profileErr);
          }
        }

        if (p) {
          const photoUrl = getFileUrl(p.photo_path || p.photo);
          const resumeUrl = getFileUrl(p.resume_path || p.resume);
          console.log("PROFILE DATA:", p);
          setFormData(prev => {
            const updated = { ...prev };

            // Always sync photo/resume from the profile if available
            if (cleanPhotoPath) {
              updated.photo = { name: "Profile Photo", url: `${FILE_BASE_URL}/${cleanPhotoPath}`, is_profile: true };
              updated.photo_path = cleanPhotoPath;
            }
            if (cleanResumePath) {
              updated.resume = { name: "Candidate Resume", url: `${FILE_BASE_URL}/${cleanResumePath}`, is_profile: true };
              updated.resume_path = cleanResumePath;
            }

            // Pre-populate other fields only if name (or whole form) is not yet initialized
            if (!prev.name) {
              updated._fromProfile = true;
              updated.name = p.name || "";
              updated.email = p.email || "";
              updated.mobile = p.phone_number || "";
              // Backend stores DD-MM-YYYY; only convert if it arrives as YYYY-MM-DD (4-digit first part)
              updated.dob = (p.date_of_birth?.includes("-") && p.date_of_birth.split("-")[0].length === 4)
                ? `${p.date_of_birth.split("-")[2]}-${p.date_of_birth.split("-")[1]}-${p.date_of_birth.split("-")[0]}`
                : p.date_of_birth || "";
              updated.maritalStatus = p.marital_status || "";
              updated.gender = p.gender || "";
              updated.currentAddress = p.correspondence_address || "";
              updated.permanentAddress = p.permanent_address || "";
              updated.education = p.education?.length ? p.education.map(e => ({
                degree: e.degree || "",
                institute: e.institute || "",
                yearPassing: e.to || "",
                specialization: e.specialization || ""
              })) : [{ degree: "", institute: "", yearPassing: "", specialization: "" }];
              updated.technicalQualifications = p.technical_qualifications?.length ? p.technical_qualifications : [{ course: "", institute: "", yearPassing: "" }];
              updated.employmentHistory = p.employment?.length ? p.employment.map(e => ({
                companyName: e.organization || "",
                designation: e.designation || "",
                durationFrom: e.from || "",
                durationTo: e.to || "",
                current: e.current || false
              })) : [{ companyName: "", designation: "", durationFrom: "", durationTo: "", current: false }];
              updated.referenceSource = p.reference_source || "";
              updated.referencePerson = p.reference_person || {};

              // Auto-populate Candidate Type (Fresher / Experienced) from Candidate Profile
              if (p.candidate_type) {
                const cType = p.candidate_type.toLowerCase();
                updated.experienceStatus = cType;
                if (cType === "fresher") {
                  updated.totalExperience = "0";
                }
              }
            } else if (!prev.experienceStatus && p.candidate_type) {
              const cType = p.candidate_type.toLowerCase();
              updated.experienceStatus = cType;
              if (cType === "fresher" && !updated.totalExperience) {
                updated.totalExperience = "0";
              }
            }

            return updated;
          });
        } else if (!formData.name) {
          // If no profile exists, pre-populate candidate email from logged-in user info
          setFormData(prev => ({
            ...prev,
            email: prev.email || storedUser?.email || ""
          }));
        }
      } catch (err) {
        console.error("Failed to initialize form", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Auto-calculate total experience from DD-MM-YYYY durationFrom/durationTo
  useEffect(() => {
    if (formData.experienceStatus === "experienced" && formData.employmentHistory?.length) {
      let totalMonths = 0;
      let hasValidDates = false;
      formData.employmentHistory.forEach(emp => {
        if (emp.durationFrom) {
          const fromDate = parseDate(emp.durationFrom);

          // If Current Job, use today's date
          const toDate = emp.current
            ? new Date()
            : (emp.durationTo ? parseDate(emp.durationTo) : null);

          if (
            fromDate &&
            toDate &&
            !isNaN(fromDate) &&
            !isNaN(toDate) &&
            toDate >= fromDate
          ) {
            const months =
              (toDate.getFullYear() - fromDate.getFullYear()) * 12 +
              (toDate.getMonth() - fromDate.getMonth()) +
              1;

            if (months > 0) {
              totalMonths += months;
              hasValidDates = true;
            }
          }
        }
      });
      if (hasValidDates) {
        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;
        let computedExp = "";
        if (years > 0) computedExp += `${years} ${years === 1 ? "Year" : "Years"}`;
        if (months > 0) { if (computedExp) computedExp += " "; computedExp += `${months} ${months === 1 ? "Month" : "Months"}`; }
        if (!computedExp) computedExp = "0 Years";
        const isComputedPattern = !formData.totalExperience ||
          /^\d+\s*Years?(\s+\d+\s*Months?)?$/i.test(formData.totalExperience) ||
          formData.totalExperience === "0";
        if (formData.totalExperience !== computedExp && isComputedPattern) {
          setFormData(prev => ({ ...prev, totalExperience: computedExp }));
        }
      }
    }
  }, [formData.employmentHistory, formData.experienceStatus]);

  // isPastDate — for a DD-MM-YYYY string, returns true if the date is before today
  const isPastDate = (dateStr) => {
    if (!dateStr) return false;
    const d = parseDate(dateStr);
    if (!d || isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  };

  // Returns true if the given DD-MM-YYYY date string is strictly in the future (after today)
  const isFutureDate = (dateStr) => {
    if (!dateStr) return false;
    const parsed = parseDate(dateStr);
    if (!parsed || isNaN(parsed.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parsed > today;
  };

  const validateForm = () => {
    const errs = {};

    if (!formData.job_id) {
      errs.job_id = "Please select a Job Opening to apply for.";
    }

    const fieldLabels = {
      name: "Name",
      currentAddress: "Current Address",
      permanentAddress: "Permanent Address",
      mobile: "Mobile No",
      email: "Email ID",
      dob: "Date of Birth",
      maritalStatus: "Marital Status",
      experienceStatus: "Candidate Type (Fresher or Experienced)",
      totalExperience: "Total Work Experience",
      availability: "Notice Period",
    };

    const requiredFields = Object.keys(fieldLabels);
    for (let field of requiredFields) {
      if (field === "totalExperience" && formData.experienceStatus === "fresher") continue;
      if (!formData[field]) {
        errs[field] = `Please fill the required field: ${fieldLabels[field]}`;
      }
    }

    // DOB validation — must be DD-MM-YYYY and a valid date
    if (formData.dob) {
      if (!isValidDate(formData.dob)) {
        errs.dob = "Please enter a valid Date of Birth in DD-MM-YYYY format.";
      } else {
        const dobDate = parseDate(formData.dob);
        if (dobDate && dobDate > new Date()) {
          errs.dob = "Date of Birth cannot be a future date.";
        }
      }
    }

    if (formData.aeBefore === "yes") {
      if (!formData.aeBeforeFrom || !formData.aeBeforeFrom.trim()) {
        errs.aeBeforeFrom = "Please enter the Worked From date for your previous employment at AE.";
      } else if (!isValidDate(formData.aeBeforeFrom)) {
        errs.aeBeforeFrom = "Please enter a valid Worked From date (DD-MM-YYYY) for your previous employment at AE.";
      } else if (isFutureDate(formData.aeBeforeFrom)) {
        errs.aeBeforeFrom = "Worked From date cannot be a future date for previous AE employment.";
      }

      if (!formData.aeBeforeTo || !formData.aeBeforeTo.trim()) {
        errs.aeBeforeTo = "Please enter the Worked To date for your previous employment at AE.";
      } else if (!isValidDate(formData.aeBeforeTo)) {
        errs.aeBeforeTo = "Please enter a valid Worked To date (DD-MM-YYYY) for your previous employment at AE.";
      } else if (isFutureDate(formData.aeBeforeTo)) {
        errs.aeBeforeTo = "Worked To date cannot be a future date for previous AE employment.";
      }

      if (formData.aeBeforeFrom && formData.aeBeforeTo && isValidDate(formData.aeBeforeFrom) && isValidDate(formData.aeBeforeTo)) {
        const fromD = parseDate(formData.aeBeforeFrom);
        const toD = parseDate(formData.aeBeforeTo);
        if (fromD && toD && toD < fromD) {
          errs.aeBeforeTo = "The Worked To date cannot be before the Worked From date.";
        }
      }
    }

    if (!formData.availability) {
      errs.availability = "Please select Notice Period.";
    }

    if (!formData.photo && !formData.photo_path) {
      errs.photo = "Please upload your photo";
    }
    if (!formData.resume && !formData.resume_path) {
      errs.resume = "Please upload your resume";
    }

    setErrors(errs);
    const keys = Object.keys(errs);
    if (keys.length > 0) {
      alert(errs[keys[0]]);
      return false;
    }
    return true;
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  // Today's date in YYYY-MM-DD format for min attribute on date inputs
  const todayDate = new Date().toISOString().split("T")[0];

  const handleAddEducation = () => {
    const current = formData.education || [];
    if (current.length >= 2) return;
    updateField("education", [...current, { degree: "", institute: "", yearPassing: "", specialization: "" }]);
  };

  const handleRemoveEducation = (index) => {
    const current = formData.education || [];
    updateField("education", current.filter((_, i) => i !== index));
  };

  const handleAddTechnical = () => {
    const current = formData.technicalQualifications || [];
    if (current.length >= 2) return;
    updateField("technicalQualifications", [...current, { course: "", institute: "", yearPassing: "" }]);
  };

  const handleRemoveTechnical = (index) => {
    const current = formData.technicalQualifications || [];
    updateField("technicalQualifications", current.filter((_, i) => i !== index));
  };

  const handleAddEmployment = () => {
    const current = formData.employmentHistory || [];
    if (current.length >= 2) return;
    updateField("employmentHistory", [...current, { companyName: "", designation: "", durationFrom: "", durationTo: "", current: false }]);
  };

  const handleRemoveEmployment = (index) => {
    const current = formData.employmentHistory || [];
    updateField("employmentHistory", current.filter((_, i) => i !== index));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Photo must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const compressed = await compressImage(reader.result, 600, 800, 0.7);
        const res = await uploadFile(file, "photos");
        updateField("photo", { name: file.name, url: compressed });
        updateField("photo_path", res.data.path ? res.data.path.replace(/^uploads\//, "") : "");
      } catch (err) {
        console.error("Upload failed", err);
        alert("Upload failed. Please try again.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Resume must be under 5MB");
      return;
    }
    try {
      const res = await uploadFile(file, "resumes");
      const fileURL = URL.createObjectURL(file);
      updateField("resume", { name: file.name, url: fileURL });
      updateField("resume_path", res.data.path ? res.data.path.replace(/^uploads\//, "") : "");
    } catch (err) {
      alert("Upload failed. Please try again.");
    }
  };

  const handleBackToList = () => {
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Leave anyway?")) return;
    }
    setIsDirty(false);
    onBack();
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="bg-white rounded-2xl shadow h-full flex flex-col border border-gray-100">
      <div className="p-6 border-b flex justify-between items-center bg-white z-10 shadow-sm rounded-t-2xl">
        <h2 className="text-xl font-semibold text-slate-800 tracking-normal">Job Application Form</h2>
        <div className="flex gap-3">
          <button onClick={handleBackToList} disabled={isSubmitting} className="bg-gray-100 text-gray-600 px-6 py-2 rounded-full font-bold hover:bg-gray-200 transition disabled:opacity-50">← Back</button>
          {!readOnly && (
            <button
              onClick={() => !isSubmitting && validateForm() && onSubmit()}
              disabled={isSubmitting}
              className={`px-8 py-2 rounded-full font-bold shadow-lg transition ${isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-[#0057B8] text-white hover:bg-blue-700 shadow-blue-100"}`}
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 pb-32 space-y-12">
        {formData._fromProfile && (
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-4 items-center animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md"><Info size={20} /></div>
            <p className="text-sm font-medium text-blue-800">
              Some fields are auto-populated from your Candidate Profile and cannot be edited. To update them, please modify your Candidate Profile first.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          <div className="col-span-2 border-l-4 border-[#0057B8] pl-3">
            <h3 className="text-xl font-semibold text-slate-800">
              Personal Information
            </h3>
          </div>
          <Input label="Name" required value={formData.name || ""} onChange={(v) => updateField("name", v)} disabled={readOnly || formData._fromProfile} error={errors.name} />
          <Select
            label="Job Opening Applied For"
            required
            value={formData.job_id ? String(formData.job_id) : ""}
            onChange={(v) => {
              const selected = jobs.find(j => String(j.value) === String(v));
              updateField("job_id", selected?.job_id || null);
              updateField("department", selected?.department || "");
            }}
            disabled={readOnly}
            options={jobs}
            error={errors.job_id}
          />
          <Textarea label="Current Address" required rows={2} value={formData.currentAddress || ""} onChange={(v) => updateField("currentAddress", v)} disabled={readOnly || formData._fromProfile} error={errors.currentAddress} />
          <Textarea label="Permanent Address" required rows={2} value={formData.permanentAddress || ""} onChange={(v) => updateField("permanentAddress", v)} disabled={readOnly || formData._fromProfile} error={errors.permanentAddress} />
          <Input
            label="Mobile No"
            required
            placeholder="10-digit number"
            value={formData.mobile || ""}
            onChange={(v) => updateField("mobile", v.replace(/\D/g, "").slice(0, 10))}
            disabled={readOnly || formData._fromProfile}
            error={
              errors.mobile ||
              (formData.mobile && formData.mobile.replace(/\D/g, "").length !== 10
                ? "Must be exactly 10 digits"
                : "")
            }
          />
          <Input
            label="Date of Birth (DD-MM-YYYY)"
            placeholder="DD-MM-YYYY"
            required
            value={formData.dob || ""}
            onChange={(v) => {
              const prevVal = formData.dob || "";
              let finalVal = v;
              if (v.length >= prevVal.length) finalVal = formatDDMMYYYY(v);
              else if (prevVal.endsWith("-") && v.length === prevVal.length - 1) finalVal = v.slice(0, -1);
              updateField("dob", finalVal);
            }}
            disabled={readOnly || formData._fromProfile}
            error={
              errors.dob || (formData.dob && !isValidDate(formData.dob)
                ? "Invalid date (use DD-MM-YYYY)"
                : (() => {
                    if (!formData.dob || !isValidDate(formData.dob)) return "";
                    const parsed = parseDate(formData.dob);
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    return parsed && parsed >= today ? "Date of Birth cannot be today or a future date" : "";
                  })())
            }
          />
          <Input label="Email ID" required value={formData.email || ""} onChange={(v) => updateField("email", v)} disabled={readOnly || formData._fromProfile} error={errors.email} />
          <Select label="Marital Status" required value={formData.maritalStatus || ""} onChange={(v) => updateField("maritalStatus", v)} disabled={readOnly || formData._fromProfile} options={maritalStatusOptions} error={errors.maritalStatus} />

          <div className="col-span-2 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
            <label className="block text-sm font-bold text-gray-700 mb-4">Are you a Fresher or Experienced? *</label>
            <div className="flex gap-8">
              {experienceStatusOptions.map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="experienceStatus"
                    value={opt.value}
                    checked={formData.experienceStatus === opt.value}
                    onChange={(e) => {
                      updateField("experienceStatus", e.target.value);
                      if (e.target.value === "fresher") updateField("totalExperience", "0");
                    }}
                    disabled={readOnly || (formData._fromProfile && !!formData.experienceStatus)}
                    className="w-5 h-5 text-blue-600 border-2 border-gray-300 focus:ring-blue-500"
                  />
                  <span className={`text-sm font-bold transition ${formData.experienceStatus === opt.value ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'}`}>{opt.label}</span>
                </label>
              ))}
            </div>
            {errors.experienceStatus && (
              <p className="text-xs text-red-500 mt-2 font-medium">{errors.experienceStatus}</p>
            )}
          </div>

          <div className="col-span-2 mt-4 flex items-center justify-between border-t pt-8">

            <div className="col-span-2 border-l-4 border-[#0057B8] pl-3">
              <h3 className="text-xl font-semibold text-slate-800">
                Educational Details
              </h3>
            </div>
            {!readOnly && !formData._fromProfile && (formData.education?.length || 0) < 2 && (
              <button onClick={handleAddEducation} className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-sm font-bold hover:bg-blue-100 transition flex items-center gap-2"><Plus size={16} /> Add More</button>
            )}
          </div>
          <div className="col-span-2 space-y-4">
            {(formData.education || [{ degree: "", institute: "", yearPassing: "", specialization: "" }]).map((edu, idx) => (
              <div key={`edu-${idx}`} className="p-8 relative bg-white rounded-3xl shadow-sm border border-gray-100 hover:border-blue-100 transition-all">
                {!readOnly && !formData._fromProfile && (formData.education?.length || 0) > 1 && (
                  <button onClick={() => handleRemoveEducation(idx)} className="absolute top-6 right-6 text-red-400 hover:text-red-600 transition"><Trash2 size={18} /></button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Degree" value={edu.degree || ""} onChange={(v) => {
                    const newEdu = [...(formData.education || [])];
                    newEdu[idx] = { ...newEdu[idx], degree: v };
                    updateField("education", newEdu);
                  }} disabled={readOnly || formData._fromProfile} />
                  <Input label="University / Institute" value={edu.institute || ""} onChange={(v) => {
                    const newEdu = [...(formData.education || [])];
                    newEdu[idx] = { ...newEdu[idx], institute: v };
                    updateField("education", newEdu);
                  }} disabled={readOnly || formData._fromProfile} />
                  <Input label="Year of Passing (DD-MM-YYYY)" placeholder="DD-MM-YYYY" value={edu.yearPassing || ""} onChange={(v) => {
                    const prevVal = edu.yearPassing || "";
                    let finalVal = v;
                    if (v.length >= prevVal.length) finalVal = formatDDMMYYYY(v);
                    else if (prevVal.endsWith("-") && v.length === prevVal.length - 1) finalVal = v.slice(0, -1);
                    const newEdu = [...(formData.education || [])];
                    newEdu[idx] = { ...newEdu[idx], yearPassing: finalVal };
                    updateField("education", newEdu);
                  }} disabled={readOnly || formData._fromProfile} />
                  <Input label="Specialization" value={edu.specialization || ""} onChange={(v) => {
                    const newEdu = [...(formData.education || [])];
                    newEdu[idx] = { ...newEdu[idx], specialization: v };
                    updateField("education", newEdu);
                  }} disabled={readOnly || formData._fromProfile} />
                </div>
              </div>
            ))}
          </div>

          <div className="col-span-2 mt-4 flex items-center justify-between border-t pt-8">

            <div className="col-span-2 border-l-4 border-[#0057B8] pl-3">
              <h3 className="text-xl font-semibold text-slate-800">
                Technical Certifications
              </h3>
            </div>
            {!readOnly && (formData.technicalQualifications?.length || 0) < 2 && (
              <button onClick={handleAddTechnical} className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-sm font-bold hover:bg-blue-100 transition flex items-center gap-2"><Plus size={16} /> Add More</button>
            )}
          </div>
          <div className="col-span-2 space-y-4">
            {(formData.technicalQualifications || [{ course: "", institute: "", yearPassing: "" }]).map((tech, idx) => (
              <div key={`tech-${idx}`} className="p-8 relative bg-white rounded-3xl shadow-sm border border-gray-100 hover:border-blue-100 transition-all">
                {!readOnly && (formData.technicalQualifications?.length || 0) > 1 && (
                  <button onClick={() => handleRemoveTechnical(idx)} className="absolute top-6 right-6 text-red-400 hover:text-red-600 transition"><Trash2 size={18} /></button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Input label="Course" value={tech.course || ""} onChange={(v) => {
                    const newTech = [...(formData.technicalQualifications || [])];
                    newTech[idx] = { ...newTech[idx], course: v };
                    updateField("technicalQualifications", newTech);
                  }} disabled={readOnly} />
                  <Input label="Institute" value={tech.institute || ""} onChange={(v) => {
                    const newTech = [...(formData.technicalQualifications || [])];
                    newTech[idx] = { ...newTech[idx], institute: v };
                    updateField("technicalQualifications", newTech);
                  }} disabled={readOnly} />
                  <Input label="Year (DD-MM-YYYY)" placeholder="DD-MM-YYYY" value={tech.yearPassing || ""} onChange={(v) => {
                    const prevVal = tech.yearPassing || "";
                    let finalVal = v;
                    if (v.length >= prevVal.length) finalVal = formatDDMMYYYY(v);
                    else if (prevVal.endsWith("-") && v.length === prevVal.length - 1) finalVal = v.slice(0, -1);
                    const newTech = [...(formData.technicalQualifications || [])];
                    newTech[idx] = { ...newTech[idx], yearPassing: finalVal };
                    updateField("technicalQualifications", newTech);
                  }} disabled={readOnly} />
                </div>
              </div>
            ))}
          </div>

          {formData.experienceStatus === "experienced" && (
            <div className="col-span-2 mt-4 space-y-6">
              <div className="flex items-center justify-between border-t pt-8">
                <h3 className="text-xl font-semibold text-slate-800 tracking-normal">Previous Employment Details</h3>
                {!readOnly && (formData.employmentHistory?.length || 0) < 2 && (
                  <button onClick={handleAddEmployment} className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-sm font-bold hover:bg-blue-100 transition flex items-center gap-2"><Plus size={16} /> Add More</button>
                )}
              </div>
              {(formData.employmentHistory || [{ companyName: "", designation: "", durationFrom: "", durationTo: "" }]).map((emp, idx) => (
                <div key={`emp-${idx}`} className="bg-white rounded-3xl shadow-sm p-8 relative border border-gray-100 hover:border-blue-100 transition-all">
                  {!readOnly && (formData.employmentHistory?.length || 0) > 1 && (
                    <button onClick={() => handleRemoveEmployment(idx)} className="absolute top-6 right-6 text-red-400 hover:text-red-600 transition"><Trash2 size={18} /></button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="Company Name" value={emp.companyName || ""} onChange={(v) => {
                      const newEmp = [...(formData.employmentHistory || [])];
                      newEmp[idx] = { ...newEmp[idx], companyName: v };
                      updateField("employmentHistory", newEmp);
                    }} disabled={readOnly} />
                    <Input label="Designation" value={emp.designation || ""} onChange={(v) => {
                      const newEmp = [...(formData.employmentHistory || [])];
                      newEmp[idx] = { ...newEmp[idx], designation: v };
                      updateField("employmentHistory", newEmp);
                    }} disabled={readOnly} />
                    <Input label="From (DD-MM-YYYY)" placeholder="DD-MM-YYYY" value={emp.durationFrom || ""} onChange={(v) => {
                      const prevVal = emp.durationFrom || "";
                      let finalVal = v;
                      if (v.length >= prevVal.length) finalVal = formatDDMMYYYY(v);
                      else if (prevVal.endsWith("-") && v.length === prevVal.length - 1) finalVal = v.slice(0, -1);
                      const newEmp = [...(formData.employmentHistory || [])];
                      newEmp[idx] = { ...newEmp[idx], durationFrom: finalVal };
                      updateField("employmentHistory", newEmp);
                    }} disabled={readOnly}
                      error={emp.durationFrom && !isValidDate(emp.durationFrom) ? "Invalid date (use DD-MM-YYYY)" : ""}
                    />
                    {!emp.current && (
                      <Input label="To (DD-MM-YYYY)" placeholder="DD-MM-YYYY" value={emp.durationTo || ""} onChange={(v) => {
                        const prevVal = emp.durationTo || "";
                        let finalVal = v;
                        if (v.length >= prevVal.length) finalVal = formatDDMMYYYY(v);
                        else if (prevVal.endsWith("-") && v.length === prevVal.length - 1) finalVal = v.slice(0, -1);
                        const newEmp = [...(formData.employmentHistory || [])];
                        newEmp[idx] = { ...newEmp[idx], durationTo: finalVal };
                        updateField("employmentHistory", newEmp);
                      }} disabled={readOnly}
                        error={
                          emp.durationTo && !isValidDate(emp.durationTo)
                            ? "Invalid date (use DD-MM-YYYY)"
                            : emp.durationFrom && emp.durationTo && isValidDate(emp.durationFrom) && isValidDate(emp.durationTo) && !isToAfterFrom(emp.durationFrom, emp.durationTo)
                              ? "To date must be after From date"
                              : ""
                        }
                      />
                    )}
                  </div>

                  {/* Current Job Checkbox */}
                  <div className="flex items-center gap-4 mt-4 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-gray-600">
                      <input
                        type="checkbox"
                        checked={emp.current || false}
                        disabled={readOnly}
                        onChange={(e) => {
                          const newEmp = [...(formData.employmentHistory || [])];
                          newEmp[idx] = {
                            ...newEmp[idx],
                            current: e.target.checked,
                            durationTo: e.target.checked ? "" : (newEmp[idx].durationTo || "")
                          };
                          updateField("employmentHistory", newEmp);
                        }}
                        className="rounded text-blue-600 border-gray-300 focus:ring-blue-500 w-4 h-4"
                      />
                      Current Job
                    </label>
                  </div>
                </div>
              ))}
              <Input
                label="Total Experience"
                required
                value={formData.totalExperience || ""}
                onChange={(v) => {
                  updateField("totalExperience", v);
                }}
                onFocus={(e) => {
                  const val = e.target.value.trim();
                  if (val.endsWith(" Years")) {
                    updateField("totalExperience", val.replace(" Years", ""));
                  }
                }}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val && /^\d+(\.\d+)?$/.test(val)) {
                    updateField("totalExperience", `${val} Years`);
                  }
                }}
                disabled={readOnly}
                error={errors.totalExperience}
              />
            </div>
          )}

          <div className="col-span-2 border-l-4 border-[#0057B8] pl-3">
            <h3 className="text-xl font-semibold text-slate-800">
              Other Details
            </h3>
          </div>

          <Select label="Referred Through" required value={formData.referenceSource || ""} onChange={(v) => updateField("referenceSource", v)} disabled={readOnly || formData._fromProfile} options={sources} error={errors.referenceSource} />
          <Select label="Worked at AE before?" required value={formData.aeBefore || ""} onChange={(v) => updateField("aeBefore", v)} disabled={readOnly} options={yesNoOptions} />
          {formData.aeBefore === "yes" && (
            <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 p-6 rounded-3xl border border-gray-100 mb-4">
              <div className="col-span-2 flex items-center gap-3">
                <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                <span className="text-sm font-bold text-gray-700">Previous AE Employment Period</span>
              </div>
              <Input
                label="Worked From (DD-MM-YYYY)"
                placeholder="DD-MM-YYYY"
                required
                value={formData.aeBeforeFrom || ""}
                disabled={readOnly}
                onChange={(v) => {
                  const prevVal = formData.aeBeforeFrom || "";
                  let finalVal = v;
                  if (v.length >= prevVal.length) {
                    finalVal = formatDDMMYYYY(v);
                  } else {
                    if (prevVal.endsWith("-") && v.length === prevVal.length - 1) {
                      finalVal = v.slice(0, -1);
                    }
                  }
                  updateField("aeBeforeFrom", finalVal);
                }}
                error={
                  errors.aeBeforeFrom || (formData.aeBeforeFrom && !isValidDate(formData.aeBeforeFrom)
                    ? "Invalid date format (use DD-MM-YYYY)"
                    : formData.aeBeforeFrom && isFutureDate(formData.aeBeforeFrom)
                      ? "Worked From date cannot be a future date"
                      : "")
                }
              />
              <Input
                label="Worked To (DD-MM-YYYY)"
                placeholder="DD-MM-YYYY"
                required
                value={formData.aeBeforeTo || ""}
                disabled={readOnly}
                onChange={(v) => {
                  const prevVal = formData.aeBeforeTo || "";
                  let finalVal = v;
                  if (v.length >= prevVal.length) {
                    finalVal = formatDDMMYYYY(v);
                  } else {
                    if (prevVal.endsWith("-") && v.length === prevVal.length - 1) {
                      finalVal = v.slice(0, -1);
                    }
                  }
                  updateField("aeBeforeTo", finalVal);
                }}
                error={
                  errors.aeBeforeTo || (formData.aeBeforeTo && !isValidDate(formData.aeBeforeTo)
                    ? "Invalid date format (use DD-MM-YYYY)"
                    : formData.aeBeforeFrom && formData.aeBeforeTo && parseDate(formData.aeBeforeTo) < parseDate(formData.aeBeforeFrom)
                      ? "Worked To date cannot be before Worked From date"
                      : formData.aeBeforeTo && isFutureDate(formData.aeBeforeTo)
                        ? "Worked To date cannot be a future date"
                        : "")
                }
              />
            </div>
          )}
          <Select label="Are you at least 18 years old?" required value={formData.is18 || ""} onChange={(v) => updateField("is18", v)} disabled={readOnly} options={yesNoOptions} />
          <Select
            label="Notice Period"
            required
            value={formData.availability || ""}
            onChange={(v) => updateField("availability", v)}
            disabled={readOnly}
            options={noticePeriodOptions}
            error={errors.availability}
          />

          {/* DOCUMENTS SECTION */}
          <div className="col-span-2 mt-4 border-t pt-8">
            <div className="flex items-center gap-3 mb-8">

              <div className="col-span-2 border-l-4 border-[#0057B8] pl-3">
                <h3 className="text-xl font-semibold text-slate-800">
                  Documents
                </h3>
              </div>
            </div>
            {/* PHOTO ATTACHMENT */}
            <div className="md:col-span-2" id="photo-upload-container">
              <label className="block text-sm font-medium mb-1">
                Photo * <span className="text-xs text-gray-400 font-normal">(JPG, JPEG, PNG only - 2MB Max)</span>
              </label>

              <div
                className={`transition-all rounded-xl p-6 text-center flex flex-col items-center justify-center
      ${formData.photo || formData.photo_path
                    ? "border-2 border-solid border-[#0057B8] bg-blue-50/10"
                    : "border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50/50"
                  }`}
              >
                {formData.photo || formData.photo_path ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <img
                        src={
                          formData.photo?.url ||
                          `${FILE_BASE_URL}/${formData.photo_path}`
                        }
                        alt="Uploaded  candidate"
                        className="w-16 h-16 rounded-full object-cover border-2 border-[#0057B8] cursor-pointer shadow-md"
                        onClick={() => setShowPhotoPreview(true)}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        Photo Attached Successfully
                      </div>

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            sessionStorage.setItem("targetProfileField", "photo");
                            setActiveTab?.("profile");
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium text-[#0057B8] border border-[#0057B8] rounded-md hover:bg-blue-50 transition flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Change Photo</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      sessionStorage.setItem("targetProfileField", "photo");
                      setActiveTab?.("profile");
                    }}
                    className="cursor-pointer flex flex-col items-center gap-2 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition">
                      <User className="w-4 h-4 text-[#0057B8]" />
                    </div>

                    <span className="text-sm font-semibold text-[#0057B8] hover:underline">
                      Click to add photo
                    </span>

                    <span className="text-[10px] text-gray-400">
                      Add photo from Candidate Profile
                    </span>
                  </div>
                )}
              </div>
            </div>
            {/* RESUME ATTACHMENT */}
            <div className="md:col-span-2" id="resume-upload-container">
              <label className="block text-sm font-medium mb-1">
                Resume * <span className="text-xs text-gray-400 font-normal">(PDF, DOC, DOCX only - 5MB Max)</span>
              </label>

              <div
                className={`transition-all rounded-xl p-6 text-center flex flex-col items-center justify-center
      ${formData.resume || formData.resume_path
                    ? "border-2 border-solid border-[#0057B8] bg-blue-50/10"
                    : "border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50/50"
                  }`}
              >
                {formData.resume || formData.resume_path ? (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm max-w-md w-full relative">
                      <FileText className="w-6 h-6 text-[#0057B8]" />

                      <div className="flex-1 text-left min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {formData.resume?.name || "Candidate_CV.pdf"}
                        </p>

                        <button
                          type="button"
                          onClick={() => setShowResumePreview(true)}
                          className="text-[11px] text-[#0057B8] font-bold hover:underline"
                        >
                          View Resume
                        </button>
                      </div>


                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        Resume Attached Successfully
                      </div>

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            sessionStorage.setItem("targetProfileField", "resume");
                            setActiveTab?.("profile");
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium text-[#0057B8] border border-[#0057B8] rounded-md hover:bg-blue-50 transition flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Change Resume</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      sessionStorage.setItem("targetProfileField", "resume");
                      setActiveTab?.("profile");
                    }}
                    className="cursor-pointer flex flex-col items-center gap-2 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition">
                      <FileText className="w-4 h-4 text-[#0057B8]" />
                    </div>

                    <span className="text-sm font-semibold text-[#0057B8] hover:underline">
                      Click to add resume
                    </span>

                    <span className="text-[10px] text-gray-400">
                      Add resume from Candidate Profile
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {
        showPhotoPreview && (formData.photo || formData.photo_path) && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPhotoPreview(false)}>
            <div className="bg-white p-6 rounded-[40px]" onClick={(e) => e.stopPropagation()}>
              <img src={formData.photo?.url || `${FILE_BASE_URL}/${formData.photo_path}`} alt="Preview" className="w-64 h-80 object-cover rounded-3xl shadow-xl" />
              <button className="mt-6 w-full py-3 bg-gray-900 text-white rounded-2xl font-bold" onClick={() => setShowPhotoPreview(false)}>Close</button>
            </div>
          </div>
        )
      }

      {
        showResumePreview && (formData.resume || formData.resume_path) && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 lg:p-10" onClick={() => setShowResumePreview(false)}>
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[40px] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                <h3 className="font-black text-gray-800">RESUME PREVIEW</h3>
                <button onClick={() => setShowResumePreview(false)} className="p-3 hover:bg-gray-200 rounded-full bg-white border"><X size={20} /></button>
              </div>
              <div className="flex-1 bg-gray-100 relative">
                {(formData.resume?.name?.toLowerCase().endsWith(".pdf") || formData.resume_path?.toLowerCase().endsWith(".pdf")) ? (
                  <iframe src={formData.resume?.url || `${FILE_BASE_URL}/${formData.resume_path}`} className="w-full h-full border-none" title="Resume Preview" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-20 bg-white">
                    <FileText size={80} className="text-gray-200 mb-6" />
                    <p className="text-2xl font-black text-gray-900 mb-4">No Preview Available</p>
                    <a href={formData.resume?.url || `${FILE_BASE_URL}/${formData.resume_path}`} download className="bg-blue-600 text-white px-10 py-4 rounded-3xl font-black shadow-xl flex items-center gap-3"><Download size={20} /> Download Document</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}