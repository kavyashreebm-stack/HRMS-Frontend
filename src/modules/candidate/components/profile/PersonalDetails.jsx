import React, { useState, useEffect, useRef } from "react";
import { Input, Select, Textarea } from "../ui/FormElements";
import API, { uploadFile, FILE_BASE_URL } from "../../../../api";
import { formatDDMMYYYY, isValidDate, parseDate } from "../utils/dateHelpers";
import { Trash2, Upload, FileText, CheckCircle, Plus, X } from "lucide-react";

const getFileUrl = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    value = value.data || value.url || value.path || "";
  }
  if (!value || typeof value !== "string") return "";
  if (value.startsWith("http") || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }
  return `${FILE_BASE_URL}/${value.replace(/^\/?uploads\//, "").replace(/^\/+/, "")}`;
};

export default function PersonalDetails({
  formData,
  setFormData,
  readOnly,
  setIsDirty,
  validationErrors = {},
  isHRMode = false,
  candidateUserId = null,
  ensureCandidateUser = null,
}) {
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [languagesList, setLanguagesList] = useState([]);
  const [newLanguageInput, setNewLanguageInput] = useState("");
  const [showAddLanguageForm, setShowAddLanguageForm] = useState(false);
  const [skillsList, setSkillsList] = useState([]);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [focusedSkillIndex, setFocusedSkillIndex] = useState(-1);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [showAddSkillForm, setShowAddSkillForm] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const languageRef = useRef();
  const skillRef = useRef();
  const languageDropdownRef = useRef();
  const skillDropdownRef = useRef();
  const isInitializedRef = useRef(false);
  const photoRef = useRef(null);
  const resumeRef = useRef(null);

  // Address matching state
  const [isSameAddress, setIsSameAddress] = useState(false);

  // Load languages from backend on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await API.get("/candidate/languages");
        setLanguagesList(res.data);
      } catch (err) {
        console.error("Failed to load languages:", err);
        // Fallback standard options if API fails
        setLanguagesList(["English", "Hindi", "Kannada", "Tamil", "Telugu", "Malayalam"]);
      }
    })();
  }, []);

  useEffect(() => {
    const loadSkills = async () => {
      try {
        const res = await API.get("/candidate/skills");
        setSkillsList(res.data || []);
      } catch (err) {
        console.error(err);
      }
    };

    loadSkills();
  }, []);

  // Sync initial isSameAddress from data
  useEffect(() => {
    if (!isInitializedRef.current && formData.correspondenceAddress && formData.permanentAddress) {
      if (formData.correspondenceAddress === formData.permanentAddress) {
        setIsSameAddress(true);
      }
      isInitializedRef.current = true;
    }
  }, [formData.correspondenceAddress, formData.permanentAddress]);

  // Handle clicking outside language or skill dropdowns to close them
  useEffect(() => {
    const clickHandler = (e) => {
      if (languageRef.current && !languageRef.current.contains(e.target)) {
        setShowLanguageDropdown(false);
      }
      if (skillRef.current && !skillRef.current.contains(e.target)) {
        setShowSkillDropdown(false);
      }
    };
    document.addEventListener("mousedown", clickHandler);
    return () => document.removeEventListener("mousedown", clickHandler);
  }, []);


  /* ✅ MASKING HELPER (Disabled - returns string unmasked as requested) */
  const maskString = (str) => {
    return str || "";
  }; useEffect(() => {
    const target = sessionStorage.getItem("targetProfileField");
    if (!target) return;

    let attempts = 0;

    const scrollToTarget = () => {
      const ref = target === "photo" ? photoRef : resumeRef;
      const el = ref.current;

      if (!el && attempts < 50) {
        attempts++;
        requestAnimationFrame(scrollToTarget);
        return;
      }

      if (!el) return;

      sessionStorage.removeItem("targetProfileField");

      const targetCard =
        el.querySelector("div[role='button']") || el;

      targetCard.scrollIntoView({
        behavior: "auto", // instant
        block: "center",
      });

      targetCard.style.transition =
        "box-shadow 0.3s ease, border-color 0.3s ease";
      targetCard.style.boxShadow =
        "0 0 0 4px rgba(239,68,68,0.8), 0 0 25px rgba(239,68,68,0.6)";
      targetCard.style.borderColor = "#dc2626";

      setTimeout(() => {
        targetCard.style.boxShadow = "";
        targetCard.style.borderColor = "";
      }, 3000);
    };

    requestAnimationFrame(scrollToTarget);
  }, []);

  const updateField = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // If permanent address same as correspondence, copy it automatically
      if (field === "correspondenceAddress" && isSameAddress) {
        updated.permanentAddress = value;
      }
      return updated;
    });
    setIsDirty?.(true);
  };

  // Toggle same address checkbox
  const handleSameAddressChange = (checked) => {
    setIsSameAddress(checked);
    if (checked) {
      updateField("permanentAddress", formData.correspondenceAddress || "");
    }
    setIsDirty?.(true);
  };

  const toggleLanguage = (lang) => {
    let updated = formData.languages || [];
    if (updated.includes(lang)) {
      updated = updated.filter((l) => l !== lang);
    } else {
      updated = [...updated, lang];
    }
    updateField("languages", updated);
  };
  const toggleSkill = (skill) => {
    let updated = formData.skills || [];

    if (updated.includes(skill)) {
      updated = updated.filter((s) => s !== skill);
    } else {
      updated = [...updated, skill];
    }

    updateField("skills", updated);
  };

  // Add a new language dynamically to database
  const handleAddNewLanguage = async () => {
    const clean = newLanguageInput.trim();
    if (!clean) return;
    try {
      const res = await API.post("/candidate/languages", { name: clean });
      setLanguagesList(res.data);
      setNewLanguageInput("");
      setShowAddLanguageForm(false);
      // Automatically toggle the newly added language
      const formattedName = clean.charAt(0).toUpperCase() + clean.slice(1);
      toggleLanguage(formattedName);
    } catch (err) {
      console.error("Failed to add language:", err);
      alert("Failed to add language. Please try again.");
    }
  };
  const handleAddSkill = async () => {
    const clean = newSkillInput.trim();

    if (!clean) return;

    try {
      const res = await API.post("/candidate/skills", {
        name: clean,
      });

      setSkillsList(res.data);

      setNewSkillInput("");

      setShowAddSkillForm(false);

      toggleSkill(clean);
    } catch (err) {
      alert("Failed to add skill.");
    }
  };


  // Row update logic for emergency contacts
  const updateEmergency = (index, field, value) => {
    const updatedContacts = [...(formData.emergencyContacts || [])];
    let finalVal = value;
    if (field === "contact") {
      finalVal = value.replace(/\D/g, "").slice(0, 10); // Restrict to exactly 10 digits
    }
    updatedContacts[index] = { ...updatedContacts[index], [field]: finalVal };
    updateField("emergencyContacts", updatedContacts);
  };

  const addEmergencyContact = () => {
    // Validation check: ensure existing contacts are fully completed
    const list = formData.emergencyContacts || [];
    const incomplete = list.some(c => !c.name?.trim() || !c.relationship?.trim() || !c.contact?.trim());
    if (incomplete) {
      alert("Please fill in all fields of existing emergency contacts before adding a new contact.");
      return;
    }
    const updated = [...list, { name: "", relationship: "", contact: "" }];
    updateField("emergencyContacts", updated);
  };

  const removeEmergencyContact = (index) => {
    const updated = (formData.emergencyContacts || []).filter((_, i) => i !== index);
    updateField("emergencyContacts", updated.length > 0 ? updated : [{ name: "", relationship: "", contact: "" }]);
  };

  // File Upload Handlers (with specific types & removals)
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Type validation: jpg, png, jpeg
    const allowed = ["image/jpeg", "image/png", "image/jpg"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(file.type) && !["jpg", "jpeg", "png"].includes(ext)) {
      alert("Invalid image file type. Only JPG, JPEG, and PNG are allowed.");
      e.target.value = "";
      return;
    }

    try {
      // If HR mode and candidate user not yet created, create them first
      // so the document is stored under the candidate's user_id, not HR's.
      let targetId = candidateUserId;
      if (isHRMode && !targetId && typeof ensureCandidateUser === "function") {
        targetId = await ensureCandidateUser();
      }
      const res = await uploadFile(file, "photos", isHRMode && targetId ? targetId : null);
      setFormData((prev) => ({
        ...prev,
        photo: { name: file.name, data: res.data.path },
        photo_path: res.data.path,
      }));
      setIsDirty?.(true);
    } catch (err) {
      console.error("Photo upload error:", err);
      const msg = err.response?.data?.detail || err.message || "Photo upload failed. Please try again.";
      alert(msg);
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Type validation: pdf only
    const allowedExtensions = ["pdf"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      alert("Invalid file type. Only PDF resume format is allowed.");
      e.target.value = "";
      return;
    }

    try {
      // If HR mode and candidate user not yet created, create them first
      // so the document is stored under the candidate's user_id, not HR's.
      let targetId = candidateUserId;
      if (isHRMode && !targetId && typeof ensureCandidateUser === "function") {
        targetId = await ensureCandidateUser();
      }
      const res = await uploadFile(file, "resumes", isHRMode && targetId ? targetId : null);
      setFormData((prev) => ({
        ...prev,
        resume: { name: file.name, data: res.data.path },
        resume_path: res.data.path,
      }));
      setIsDirty?.(true);
    } catch (err) {
      console.error("Resume upload error:", err);
      const msg = err.response?.data?.detail || err.message || "Resume upload failed. Please try again.";
      alert(msg);
    }
  };

  const removePhoto = () => {
    setFormData((prev) => ({
      ...prev,
      photo: null,
      photo_path: null,
    }));
    setIsDirty?.(true);
  };

  const removeResume = () => {
    setFormData((prev) => ({
      ...prev,
      resume: null,
      resume_path: null,
    }));
    setIsDirty?.(true);
  };

  // Date Change Handler with Masking
  const handleDobChange = (val) => {
    const prevVal = formData.dob || "";
    let finalVal = val;
    if (val.length >= prevVal.length) {
      finalVal = formatDDMMYYYY(val);
    } else {
      if (prevVal.endsWith("-") && val.length === prevVal.length - 1) {
        finalVal = val.slice(0, -1);
      }
    }
    updateField("dob", finalVal);
  };

  // Handle Aadhar restricted to 12 digits
  const handleAadharChange = (v) => {
    const clean = v.replace(/\D/g, "").slice(0, 12);
    updateField("aadhar", clean);
  };

  // Handle PAN: format AAAAA0000A (5 alpha + 4 numeric + 1 alpha = 10 chars)
  const handlePanChange = (v) => {
    const raw = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10);
    // Guide input: first 5 must be alpha, next 4 must be numeric, last 1 must be alpha
    let result = "";
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (i < 5) {
        // positions 0-4: letters only
        if (/[A-Z]/.test(ch)) result += ch;
      } else if (i < 9) {
        // positions 5-8: digits only
        if (/[0-9]/.test(ch)) result += ch;
      } else {
        // position 9: letter only
        if (/[A-Z]/.test(ch)) result += ch;
      }
    }
    updateField("pan", result);
  };

  // Handle Bank Account restricted to 14 digits
  const handleBankAccountChange = (v) => {
    const clean = v.replace(/\D/g, "").slice(0, 14);
    updateField("bankAccount", clean);
  };

  // Handle IFSC: format AAAA000000 (4 alpha + 6 numeric = 10 chars)
  const handleIfscChange = (v) => {
    const raw = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10);
    // Guide input: first 4 must be alpha, next 6 must be numeric
    let result = "";
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (i < 4) {
        // positions 0-3: letters only
        if (/[A-Z]/.test(ch)) result += ch;
      } else {
        // positions 4-9: digits only
        if (/[0-9]/.test(ch)) result += ch;
      }
    }
    updateField("ifsc", result);
  };

  // Handle UAN restricted to 12 digits
  const handleUanChange = (v) => {
    const clean = v.replace(/\D/g, "").slice(0, 12);
    updateField("uan", clean);
  };

  // Handle ESIC restricted to 10 digits
  const handleEsicChange = (v) => {
    const clean = v.replace(/\D/g, "").slice(0, 10);
    updateField("esic", clean);
  };

  // Handle phone fields restricted to 10 digits
  const handlePhoneChange = (field, v) => {
    const clean = v.replace(/\D/g, "").slice(0, 10);
    updateField(field, clean);
  };

  // ---- Live inline error helpers ----
  const isExperienced = formData.candidateType === "experienced";

  const getLiveError = (field) => {
    // Return a live error (shown immediately while typing) if field has a format requirement
    if (validationErrors[field]) return validationErrors[field];
    const val = formData[field] || "";
    if (!val) return ""; // don't show error while field is untouched/empty (unless triggered by save)
    switch (field) {
      case "mobilePrimary":
        return val.replace(/\D/g, "").length !== 10 ? "Must be exactly 10 digits" : "";
      case "mobileAlternate":
        return val.replace(/\D/g, "").length !== 10 ? "Must be exactly 10 digits" : "";
      case "aadhar":
        return val.replace(/\D/g, "").length !== 12 ? "Must be exactly 12 digits" : "";
      case "pan": {
        const panVal = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        if (panVal.length !== 10) return "Must be exactly 10 characters (e.g. ABCDE1234F)";
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panVal)) return "Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)";
        return "";
      }
      case "bankAccount":
        return val.replace(/\D/g, "").length !== 14 ? "Must be exactly 14 digits" : "";
      case "ifsc": {
        const ifscVal = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        if (ifscVal.length !== 10) return "Must be exactly 10 characters (e.g. SBIN123456)";
        if (!/^[A-Z]{4}[0-9]{6}$/.test(ifscVal)) return "Invalid IFSC format. Must be 4 letters followed by 6 digits (e.g. SBIN123456)";
        return "";
      }
      case "uan":
        return val.replace(/\D/g, "").length !== 12 ? "Must be exactly 12 digits" : "";
      case "esic":
        return val.replace(/\D/g, "").length !== 10 ? "Must be exactly 10 digits" : "";
      default:
        return "";
    }
  };

  const getEmergencyError = (index, field) => {
    if (validationErrors[`emergencyContacts_${index}`]) {
      return validationErrors[`emergencyContacts_${index}`];
    }
    const contact = (formData.emergencyContacts || [])[index] || {};
    const val = contact[field] || "";
    if (!val) return validationErrors.emergencyContacts ? "Required" : "";
    if (field === "contact" && val.replace(/\D/g, "").length !== 10) return "Must be exactly 10 digits";
    return "";
  };

  // ✅ Keyboard Accessibility & Alt+ArrowDown for languages dropdown
  const handleLanguageTriggerKeyDown = (e) => {
    if (readOnly) return;

    // Handle ArrowLeft and ArrowRight immediately for form navigation, closing dropdown if open
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      setShowLanguageDropdown(false);
      const container = languageRef.current?.closest('[data-profile-form]') || document.querySelector('[data-profile-form]');
      if (container) {
        const focusable = Array.from(
          container.querySelectorAll(
            'input:not([tabindex="-1"]):not([type="file"]):not([type="checkbox"]):not([disabled]), select:not([tabindex="-1"]):not([disabled]), textarea:not([tabindex="-1"]):not([disabled]), [tabindex="0"]:not([disabled])'
          )
        );
        const self = languageRef.current?.querySelector('[tabindex="0"]') || languageRef.current;
        const idx = focusable.indexOf(self);
        if (idx !== -1) {
          if (e.key === "ArrowLeft") {
            const prev = focusable[idx - 1] || focusable[focusable.length - 1];
            prev?.focus();
          } else {
            const next = focusable[idx + 1] || focusable[0];
            next?.focus();
          }
        }
      }
      return;
    }

    if (!showLanguageDropdown) {
      if ((e.altKey && e.key === "ArrowDown") || e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setShowLanguageDropdown(true);
        setFocusedIndex(0);
      }
      return;
    }

    if (showLanguageDropdown) {
      const total = languagesList.length + 1; // +1 for Add New button
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIdx = (focusedIndex + 1) % total;
        setFocusedIndex(nextIdx);
        // Scroll focused item into view
        if (languageDropdownRef.current) {
          const items = languageDropdownRef.current.querySelectorAll('label, button');
          if (items[nextIdx]) items[nextIdx].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIdx = (focusedIndex - 1 + total) % total;
        setFocusedIndex(prevIdx);
        // Scroll focused item into view
        if (languageDropdownRef.current) {
          const items = languageDropdownRef.current.querySelectorAll('label, button');
          if (items[prevIdx]) items[prevIdx].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < languagesList.length) {
          toggleLanguage(languagesList[focusedIndex]);
        } else if (focusedIndex === languagesList.length) {
          setShowAddLanguageForm(true);
        }
      } else if (e.key === "Escape" || e.key === "Tab") {
        setShowLanguageDropdown(false);
      }
    }
  };

  // ✅ Keyboard Accessibility & Arrow key navigation for Skills dropdown
  const handleSkillTriggerKeyDown = (e) => {
    if (readOnly) return;

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      setShowSkillDropdown(false);
      const container = skillRef.current?.closest('[data-profile-form]') || document.querySelector('[data-profile-form]');
      if (container) {
        const focusable = Array.from(
          container.querySelectorAll(
            'input:not([tabindex="-1"]):not([type="file"]):not([disabled]), select:not([tabindex="-1"]):not([disabled]), textarea:not([tabindex="-1"]):not([disabled]), [tabindex="0"]:not([disabled])'
          )
        );
        const self = skillRef.current?.querySelector('[tabindex="0"]') || skillRef.current;
        const idx = focusable.indexOf(self);
        if (idx !== -1) {
          if (e.key === "ArrowLeft") {
            (focusable[idx - 1] || focusable[focusable.length - 1])?.focus();
          } else {
            (focusable[idx + 1] || focusable[0])?.focus();
          }
        }
      }
      return;
    }

    if (!showSkillDropdown) {
      if ((e.altKey && e.key === "ArrowDown") || e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setShowSkillDropdown(true);
        setFocusedSkillIndex(0);
      }
      return;
    }

    if (showSkillDropdown) {
      const total = skillsList.length + 1; // +1 for Add New button
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIdx = (focusedSkillIndex + 1) % total;
        setFocusedSkillIndex(nextIdx);
        if (skillDropdownRef.current) {
          const items = skillDropdownRef.current.querySelectorAll('label, button');
          if (items[nextIdx]) items[nextIdx].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIdx = (focusedSkillIndex - 1 + total) % total;
        setFocusedSkillIndex(prevIdx);
        if (skillDropdownRef.current) {
          const items = skillDropdownRef.current.querySelectorAll('label, button');
          if (items[prevIdx]) items[prevIdx].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (focusedSkillIndex >= 0 && focusedSkillIndex < skillsList.length) {
          toggleSkill(skillsList[focusedSkillIndex]);
        } else if (focusedSkillIndex === skillsList.length) {
          setShowAddSkillForm(true);
        }
      } else if (e.key === "Escape" || e.key === "Tab") {
        setShowSkillDropdown(false);
      }
    }
  };

  // ✅ Arrow Left/Right key navigation between inputs when at boundaries
  const handleFormKeyDown = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

    // Skip when language or skill dropdown is open or when focus is inside them
    if (showLanguageDropdown || showSkillDropdown) return;
    if (languageRef.current && languageRef.current.contains(e.target)) return;
    if (skillRef.current && skillRef.current.contains(e.target)) return;

    const target = e.target;
    // Allow: standard form fields AND focusable widget divs (tabindex="0", e.g. upload zones)
    const isFormField = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
    const isFocusableWidget = target.getAttribute("tabindex") === "0" || target.getAttribute("role") === "button";
    if (!isFormField && !isFocusableWidget) return;

    // For text-like inputs, safely check boundary selection.
    if (target.tagName === "INPUT") {
      let selStart = 0;
      let selEnd = target.value ? target.value.length : 0;
      try {
        if (target.selectionStart !== null && target.selectionStart !== undefined) {
          selStart = target.selectionStart;
          selEnd = target.selectionEnd;
        }
      } catch (err) {
        selStart = 0;
        selEnd = target.value ? target.value.length : 0;
      }
      if (e.key === "ArrowLeft" && selStart !== 0) return;
      if (e.key === "ArrowRight" && selEnd !== (target.value ? target.value.length : 0)) return;
    }

    const container = e.currentTarget;
    const focusable = Array.from(
      container.querySelectorAll(
        'input:not([tabindex="-1"]):not([type="file"]):not([disabled]), select:not([tabindex="-1"]):not([disabled]), textarea:not([tabindex="-1"]):not([disabled]), [tabindex="0"]:not([disabled])'
      )
    );
    const index = focusable.indexOf(target);
    if (index === -1) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = focusable[index - 1] || focusable[focusable.length - 1];
      prev?.focus();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = focusable[index + 1] || focusable[0];
      next?.focus();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-6" onKeyDown={handleFormKeyDown} data-profile-form>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Name */}
        <Input
          label="Name"
          required
          value={formData.name || ""}
          onChange={(v) => updateField("name", v.toUpperCase())}
          disabled={readOnly}
          error={validationErrors.name}
        />

        {/* Designation */}
        <Input
          label="Designation Applied For"
          required
          value={formData.designation || ""}
          onChange={(v) => updateField("designation", v)}
          disabled={readOnly}
          error={validationErrors.designation}
        />

        {/* Candidate Type — Fresher / Experienced */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">
            Candidate Type <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            {["fresher", "experienced"].map((type) => (
              <label
                key={type}
                tabIndex={readOnly ? -1 : 0}
                onClick={() => !readOnly && updateField("candidateType", type)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !readOnly) {
                    e.preventDefault();
                    e.stopPropagation();
                    updateField("candidateType", type);
                  }
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 cursor-pointer select-none font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#0057B8] ${
                  formData.candidateType === type
                    ? "border-[#0057B8] bg-blue-50 text-[#0057B8]"
                    : validationErrors.candidateType
                    ? "border-red-500 bg-red-50/20 text-red-500"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                } ${readOnly ? "pointer-events-none opacity-70" : ""}`}
              >
                <input
                  type="radio"
                  name="candidateType"
                  value={type}
                  checked={formData.candidateType === type}
                  disabled={readOnly}
                  onChange={() => updateField("candidateType", type)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !readOnly) {
                      e.preventDefault();
                      e.stopPropagation();
                      updateField("candidateType", type);
                    }
                  }}
                  className="accent-[#0057B8] w-4 h-4 cursor-pointer"
                />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </label>
            ))}
          </div>
          {validationErrors.candidateType && (
            <p className="text-xs text-red-500 mt-1">{validationErrors.candidateType}</p>
          )}
        </div>

        {/* Addresses with checkbox same address */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
          <Textarea
            label="Correspondence Address"
            required
            value={formData.correspondenceAddress || ""}
            onChange={(v) => updateField("correspondenceAddress", v)}
            disabled={readOnly}
            error={validationErrors.correspondenceAddress}
          />
          <div className="flex flex-col justify-between">
            <Textarea
              label="Permanent Address"
              required
              value={formData.permanentAddress || ""}
              onChange={(v) => updateField("permanentAddress", v)}
              disabled={readOnly || isSameAddress}
              error={validationErrors.permanentAddress}
            />
            {!readOnly && (
              <label
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSameAddressChange(!isSameAddress);
                  }
                }}
                className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-4 cursor-pointer select-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded p-1"
              >
                <input
                  type="checkbox"
                  checked={isSameAddress}
                  onChange={(e) => handleSameAddressChange(e.target.checked)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSameAddressChange(!isSameAddress);
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                Permanent address same as correspondence address
              </label>
            )}
          </div>
        </div>

        {/* Mobile (Primary) */}
        <Input
          label="Mobile (Primary)"
          required
          value={formData.mobilePrimary || ""}
          onChange={(v) => handlePhoneChange("mobilePrimary", v)}
          disabled={readOnly}
          error={getLiveError("mobilePrimary") || validationErrors.mobilePrimary}
          placeholder="10-digit number"
        />

        {/* Mobile (Alternate) */}
        <Input
          label="Mobile (Alternate)"
          value={formData.mobileAlternate || ""}
          onChange={(v) => handlePhoneChange("mobileAlternate", v)}
          disabled={readOnly}
          error={getLiveError("mobileAlternate") || validationErrors.mobileAlternate}
          placeholder="10-digit number"
        />

        {/* Email ID — kept as type="text" so selectionStart/End work for arrow-key navigation */}
        <Input
          label="Email ID"
          required
          type="text"
          value={formData.email || ""}
          onChange={(v) => updateField("email", v.toLowerCase())}
          disabled={readOnly}
          error={validationErrors.email}
        />

        {/* Date of Birth */}
        <Input
          label="Date of Birth"
          placeholder="DD-MM-YYYY"
          required
          value={formData.dob || ""}
          onChange={handleDobChange}
          disabled={readOnly}
          error={
            validationErrors.dob || (formData.dob && !isValidDate(formData.dob)
              ? "Must follow format DD-MM-YYYY (e.g. 24-06-1995)"
              : (() => {
                if (!formData.dob || !isValidDate(formData.dob)) return "";
                const parsed = parseDate(formData.dob);
                const today = new Date(); today.setHours(0, 0, 0, 0);
                return parsed && parsed >= today ? "Date of Birth cannot be today or a future date" : "";
              })())
          }
        />

        {/* Marital Status */}
        <Select
          label="Marital Status"
          value={formData.maritalStatus || ""}
          onChange={(v) => updateField("maritalStatus", v)}
          disabled={readOnly}
          options={[
            { label: "Select", value: "" },
            { label: "Single", value: "single" },
            { label: "Married", value: "married" },
            { label: "Other", value: "other" },
          ]}
        />

        {/* Gender */}
        <Select
          label="Gender"
          value={formData.gender || ""}
          onChange={(v) => updateField("gender", v)}
          disabled={readOnly}
          options={[
            { label: "Select", value: "" },
            { label: "Female", value: "female" },
            { label: "Male", value: "male" },
            { label: "Other", value: "other" },
          ]}
        />

        {/* Dynamic Languages Known Dropdown */}
        <div className="mb-4 relative" ref={languageRef}>
          <label className="block text-sm font-medium mb-1">Languages Known</label>
          <div
            tabIndex={readOnly ? -1 : 0}
            className={`w-full border border-gray-300 px-3 py-2 rounded-lg flex justify-between items-center bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 ${readOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-gray-400"
              }`}
            onClick={() => !readOnly && setShowLanguageDropdown(!showLanguageDropdown)}
            onKeyDown={handleLanguageTriggerKeyDown}
          >
            <span className={`text-sm ${formData.languages?.length ? "text-black" : "text-gray-400"}`}>
              {formData.languages?.length ? formData.languages.join(", ") : "Select Languages"}
            </span>
            {!readOnly && <span className="text-xs text-gray-500">▼</span>}
          </div>

          {!readOnly && showLanguageDropdown && (
            <div ref={languageDropdownRef} className="absolute w-full mt-1 border rounded-xl shadow-xl bg-white max-h-60 overflow-y-auto z-50 p-2 space-y-1">
              {languagesList.map((lang, idx) => (
                <label
                  key={lang}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-sm ${focusedIndex === idx ? "bg-blue-50 font-semibold text-blue-700" : "hover:bg-blue-50/50"
                    }`}
                >
                  <input
                    type="checkbox"
                    tabIndex={-1} // ✅ Skip tab focus
                    checked={(formData.languages || []).includes(lang)}
                    onChange={() => toggleLanguage(lang)}
                    className="rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                  />{" "}
                  {lang}
                </label>
              ))}

              <div className="border-t border-gray-100 pt-2 mt-2">
                {showAddLanguageForm ? (
                  <div className="flex gap-2 p-1">
                    <input
                      type="text"
                      placeholder="Enter language..."
                      value={newLanguageInput}
                      onChange={(e) => setNewLanguageInput(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewLanguage}
                      className="bg-[#0057B8] hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 rounded"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddLanguageForm(false)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-1 rounded"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    tabIndex={-1} // ✅ Skip tab focus
                    onClick={() => setShowAddLanguageForm(true)}
                    className={`w-full flex items-center justify-center gap-1 py-1 text-xs text-[#0057B8] font-bold rounded-lg ${focusedIndex === languagesList.length ? "bg-blue-50" : "hover:bg-blue-50"
                      }`}
                  >
                    <Plus className="w-3 h-3" /> Add New Language
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Skills */}
        <div className="mb-4 relative" ref={skillRef}>
          <label className="block text-sm font-medium mb-1">
            Skills
          </label>

          <div
            tabIndex={readOnly ? -1 : 0}
            className={`w-full border border-gray-300 px-3 py-2 rounded-lg flex justify-between items-center bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 ${readOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-gray-400"
              }`}
            onClick={() => !readOnly && setShowSkillDropdown(!showSkillDropdown)}
            onKeyDown={handleSkillTriggerKeyDown}
          >
            <span className={`text-sm ${formData.skills?.length ? "text-black" : "text-gray-400"}`}>
              {formData.skills?.length
                ? formData.skills.join(", ")
                : "Select Skills"}
            </span>

            {!readOnly && <span className="text-xs text-gray-500">▼</span>}
          </div>

          {!readOnly && showSkillDropdown && (
            <div ref={skillDropdownRef} className="absolute w-full mt-1 border rounded-xl shadow-xl bg-white max-h-60 overflow-y-auto z-50 p-2 space-y-1">
              {skillsList.map((skill, idx) => (
                <label
                  key={skill}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-sm ${focusedSkillIndex === idx ? "bg-blue-50 font-semibold text-blue-700" : "hover:bg-blue-50/50"
                    }`}
                >
                  <input
                    type="checkbox"
                    tabIndex={-1}
                    checked={(formData.skills || []).includes(skill)}
                    onChange={() => toggleSkill(skill)}
                    className="rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                  />{" "}
                  {skill}
                </label>
              ))}

              <div className="border-t border-gray-100 pt-2 mt-2">
                {showAddSkillForm ? (
                  <div className="flex gap-2 p-1">
                    <input
                      type="text"
                      placeholder="Enter skill..."
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSkill(); } }}
                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      className="bg-[#0057B8] hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 rounded"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddSkillForm(false)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-1 rounded"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowAddSkillForm(true)}
                    className={`w-full flex items-center justify-center gap-1 py-1 text-xs text-[#0057B8] font-bold rounded-lg ${focusedSkillIndex === skillsList.length ? "bg-blue-50" : "hover:bg-blue-50"
                      }`}
                  >
                    <Plus className="w-3 h-3" /> Add New Skill
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Identity & Bank details with masking in readOnly */}
        <Input
          label="Aadhar Card No"
          required
          value={maskString(formData.aadhar)}
          onChange={(v) => handleAadharChange(v)}
          disabled={readOnly}
          placeholder="12-digit number"
          error={getLiveError("aadhar") || validationErrors.aadhar}
        />
        <Input
          label="PAN Card No"
          required
          value={maskString(formData.pan)}
          onChange={(v) => handlePanChange(v)}
          disabled={readOnly}
          placeholder="ABCDE1234F"
          error={getLiveError("pan") || validationErrors.pan}
        />
        <Input
          label="Passport No"
          value={maskString(formData.passport)}
          onChange={(v) => updateField("passport", v)}
          disabled={readOnly}
        />
        <Input
          label="Bank Account No"
          required
          value={maskString(formData.bankAccount)}
          onChange={(v) => handleBankAccountChange(v)}
          disabled={readOnly}
          placeholder="14-digit number"
          error={getLiveError("bankAccount") || validationErrors.bankAccount}
        />
        <Input
          label="Bank Name"
          required
          value={formData.bankName || ""}
          onChange={(v) => updateField("bankName", v)}
          disabled={readOnly}
          error={validationErrors.bankName}
        />
        <Input
          label="IFSC Code"
          required
          value={maskString(formData.ifsc)}
          onChange={(v) => handleIfscChange(v)}
          disabled={readOnly}
          placeholder="SBIN123456"
          error={getLiveError("ifsc") || validationErrors.ifsc}
        />
        <Input
          label="UAN No"
          required={isExperienced}
          value={maskString(formData.uan)}
          onChange={(v) => handleUanChange(v)}
          disabled={readOnly}
          placeholder="12-digit number"
          error={getLiveError("uan") || validationErrors.uan}
        />
        <Input
          label="ESIC No"
          required={isExperienced}
          value={maskString(formData.esic)}
          onChange={(v) => handleEsicChange(v)}
          disabled={readOnly}
          placeholder="10-digit number"
          error={getLiveError("esic") || validationErrors.esic}
        />

        {/* PHOTO ATTACHMENT */}
        <div ref={photoRef} className="md:col-span-2" id="photo-upload-container">
          <label className="block text-sm font-medium mb-1">
            Photo <span className="text-red-500">*</span>{" "}
            <span className="text-xs text-gray-400 font-normal">(JPG, JPEG, PNG only - 2MB Max)</span>
          </label>
          <div
            tabIndex={readOnly ? -1 : 0}
            role="button"
            aria-label="Upload Photo"
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !readOnly) {
                e.preventDefault();
                document.getElementById("photoUpload")?.click();
              }
            }}
            className={`transition-all rounded-xl p-6 text-center flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#0057B8] ${
              formData.photo || formData.photo_path
                ? "border-2 border-solid border-[#0057B8] bg-blue-50/10"
                : validationErrors.photo
                ? "border-2 border-dashed border-red-400 bg-red-50/40"
                : "border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50/50"
            }`}
          >
            {formData.photo || formData.photo_path ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <img
                    src={getFileUrl(formData.photo?.data || formData.photo_path)}
                    alt="Uploaded candidate"
                    className="w-16 h-16 rounded-full object-cover border-2 border-[#0057B8] cursor-pointer shadow-md"
                    onClick={() => setShowPhotoPreview(true)}
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-md transition"
                      title="Remove Photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> Photo Attached Successfully
                </div>
              </div>
            ) : readOnly ? (
              <div className="flex flex-col items-center gap-1 py-3 text-gray-400">
                <span className="text-xs font-semibold">No photo uploaded</span>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  id="photoUpload"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={readOnly}
                />
                <label
                  htmlFor="photoUpload"
                  className="cursor-pointer flex flex-col items-center gap-2 group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition">
                    <Upload className="w-4 h-4 text-[#0057B8]" />
                  </div>
                  <span className="text-sm font-semibold text-[#0057B8] hover:underline">
                    Click to upload photo
                  </span>
                  <span className="text-[10px] text-gray-400">Accepts JPG, PNG, JPEG formats</span>
                </label>
              </>
            )}
          </div>
          {validationErrors.photo && !formData.photo && !formData.photo_path && (
            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
              <span>⚠</span> {validationErrors.photo}
            </p>
          )}
        </div>

        {/* RESUME ATTACHMENT */}
        <div ref={resumeRef} className="md:col-span-2" id="resume-upload-container">
          <label className="block text-sm font-medium mb-1">
            Resume <span className="text-red-500">*</span>{" "}
            <span className="text-xs text-gray-400 font-normal">(PDF only - 5MB Max)</span>
          </label>
          <div
            tabIndex={readOnly ? -1 : 0}
            role="button"
            aria-label="Upload Resume"
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !readOnly) {
                e.preventDefault();
                document.getElementById("resumeUpload")?.click();
              }
            }}
            className={`transition-all rounded-xl p-6 text-center flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#0057B8] ${
              formData.resume || formData.resume_path
                ? "border-2 border-solid border-[#0057B8] bg-blue-50/10"
                : validationErrors.resume
                ? "border-2 border-dashed border-red-400 bg-red-50/40"
                : "border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50/50"
            }`}
          >
            {formData.resume || formData.resume_path ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm max-w-md w-full relative">
                  <FileText className="w-6 h-6 text-[#0057B8]" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">
                      {formData.resume?.name || (formData.resume_path ? formData.resume_path.split("/").pop() : "Candidate_CV.pdf")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowResumePreview(true)}
                      className="text-[11px] text-[#0057B8] font-bold hover:underline"
                    >
                      View Resume
                    </button>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={removeResume}
                      className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                      title="Remove Resume"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> Resume Attached Successfully
                </div>
              </div>
            ) : readOnly ? (
              <div className="flex flex-col items-center gap-1 py-3 text-gray-400">
                <span className="text-xs font-semibold">No resume uploaded</span>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept=".pdf"
                  id="resumeUpload"
                  className="hidden"
                  onChange={handleResumeUpload}
                  disabled={readOnly}
                />
                <label
                  htmlFor="resumeUpload"
                  className="cursor-pointer flex flex-col items-center gap-2 group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition">
                    <Upload className="w-4 h-4 text-[#0057B8]" />
                  </div>
                  <span className="text-sm font-semibold text-[#0057B8] hover:underline">
                    Click to upload resume
                  </span>
                  <span className="text-[10px] text-gray-400">Accepts PDF format only</span>
                </label>
              </>
            )}
          </div>
          {validationErrors.resume && !formData.resume && !formData.resume_path && (
            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
              <span>⚠</span> {validationErrors.resume}
            </p>
          )}
        </div>

        {/* EMERGENCY CONTACTS */}
        <div className="md:col-span-2 mt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className={`text-sm font-bold uppercase tracking-wide ${
              validationErrors.emergencyContacts ? "text-red-600" : "text-gray-800"
            }`}>
              Emergency Contacts <span className="text-red-500">*</span>
            </h3>
            {!readOnly && (
              <button
                type="button"
                onClick={addEmergencyContact}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#0057B8] hover:bg-blue-700 text-white font-bold transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add Emergency Contact
              </button>
            )}
          </div>
          {validationErrors.emergencyContacts && (
            <p className="text-red-500 text-xs mb-2 flex items-center gap-1">
              <span>⚠</span> {validationErrors.emergencyContacts}
            </p>
          )}
          {formData.emergencyContacts?.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No emergency contacts added. Please add at least one.</p>
          ) : (
            <div className="space-y-4">
              {formData.emergencyContacts?.map((contact, index) => (
                <div key={index} className={`grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-xl relative ${
                  validationErrors[`emergencyContacts_${index}`]
                    ? "border-red-300 bg-red-50/30"
                    : "border-gray-100 bg-gray-50/30"
                }`}>
                  <Input
                    label="Name"
                    required
                    value={contact.name || ""}
                    onChange={(v) => updateEmergency(index, "name", v)}
                    disabled={readOnly}
                    error={!contact.name?.trim() && validationErrors.emergencyContacts ? "Required" : ""}
                  />
                  <Input
                    label="Relationship"
                    required
                    value={contact.relationship || ""}
                    onChange={(v) => updateEmergency(index, "relationship", v)}
                    disabled={readOnly}
                    error={!contact.relationship?.trim() && validationErrors.emergencyContacts ? "Required" : ""}
                  />
                  <Input
                    label="Contact No"
                    required
                    value={contact.contact || ""}
                    onChange={(v) => updateEmergency(index, "contact", v)}
                    disabled={readOnly}
                    placeholder="10-digit number"
                    error={getEmergencyError(index, "contact")}
                  />
                  {!readOnly && (formData.emergencyContacts.length > 1 || formData.emergencyContacts[0].name !== "") && (
                    <button
                      type="button"
                      onClick={() => removeEmergencyContact(index)}
                      className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* PHOTO PREVIEW MODAL */}
      {showPhotoPreview && (formData.photo || formData.photo_path) && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowPhotoPreview(false)}
        >
          <div className="bg-white p-4 rounded-2xl shadow-xl max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={getFileUrl(formData.photo?.data || formData.photo_path)}
              alt="Preview"
              className="w-full max-h-[70vh] object-contain rounded-lg border"
            />
            <button
              className="mt-4 w-full py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-sm transition"
              onClick={() => setShowPhotoPreview(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* RESUME PREVIEW MODAL */}
      {showResumePreview && (formData.resume || formData.resume_path) && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60] p-4 lg:p-10"
          onClick={() => setShowResumePreview(false)}
        >
          <div
            className="bg-white w-full max-w-5xl h-[90vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900">Resume Preview</h3>
                <p className="text-xs text-gray-500">
                  {formData.resume?.name || (formData.resume_path ? formData.resume_path.split("/").pop() : "Candidate_CV.pdf")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={getFileUrl(formData.resume?.data || formData.resume_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-[#0057B8] hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open in New Tab
                </a>
                <button
                  onClick={() => setShowResumePreview(false)}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-700 transition"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100">
              <iframe
                src={getFileUrl(formData.resume?.data || formData.resume_path)}
                className="w-full h-full border-none"
                title="Resume"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}