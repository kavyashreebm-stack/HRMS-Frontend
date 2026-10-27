import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HRSidebar from "../components/layout/HRSidebar";
import HRTopbar from "../components/layout/HRTopbar";
import API, { FILE_BASE_URL } from "../../../api";
import { formatDDMMYYYY, isValidDate } from "../../candidate/components/utils/dateHelpers";
import {
  User, Search, Printer, FileText, Save, Edit2, CheckCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, UserPlus
} from "lucide-react";


// ─── Helper Utilities ────────────────────────────────────────────────────────
const gv = (val, fallback = "") => (val === null || val === undefined || val === "") ? fallback : val;

const formatDMY = (dateStr) => {
  if (!dateStr) return "";
  // Already DD-MM-YYYY — return as-is
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    // If stored as YYYY-MM-DD (legacy), convert to DD-MM-YYYY
    if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return `${parts[0]}-${parts[1]}-${parts[2]}`;
  }
  return dateStr;
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function HROnboarding() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [showHRPanel, setShowHRPanel] = useState(true);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await API.get("/hr/applications");
      setApplications(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };


  // HR-only fields
  const [hrFields, setHrFields] = useState({
    employee_id: "", date_of_joining: "", designation: "",
    basic: "", hra: "", conveyance: "", medical_allow: "",
    witness1_name: "", witness1_address: "",
    witness2_name: "", witness2_address: "",
  });

  const setHR = (key, val) => setHrFields(prev => ({ ...prev, [key]: val }));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await API.get("/hr/applications", { params: { status: "Onboarding" } });
        setApplications(res.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSelect = (app) => {
    setSelectedApp(app);
    const cp = app.candidate_profile || {};
    const decl = cp.declaration || {};
    const empList = cp.employment || [];
    const lastEmp = empList[0] || {};
    const lastExitDate = lastEmp.to || lastEmp.to_date || "";

    setHrFields({
      employee_id: cp.employee_id || "",
      date_of_joining: formatDMY(cp.date_of_joining || ""),
      designation: cp.designation || "",
      basic: decl.basic || "",
      hra: decl.hra || "",
      conveyance: decl.conveyance || "",
      medical_allow: decl.medical_allow || "",
      witness1_name: decl.witness1_name || "",
      witness1_address: decl.witness1_address || "",
      witness2_name: decl.witness2_name || "",
      witness2_address: decl.witness2_address || "",
    });
    setSaveStatus("");
  };

  const handleSave = async () => {
    if (!selectedApp?.user_id) return;
    setIsSaving(true); setSaveStatus("Saving...");
    try {
      const cp = selectedApp.candidate_profile || {};
      const { employee_id, date_of_joining, designation, ...declFields } = hrFields;
      const updatedDeclaration = { ...(cp.declaration || {}), ...declFields };
      await API.put(`/candidate/profile/${selectedApp.user_id}`, {
        ...cp,
        employee_id,
        date_of_joining,
        designation,
        declaration: updatedDeclaration,
      });
      const updatedCp = {
        ...(selectedApp.candidate_profile || {}),
        employee_id,
        date_of_joining,
        designation,
        declaration: updatedDeclaration,
      };
      setSelectedApp(prev => ({
        ...prev,
        candidate_profile: updatedCp,
      }));
      setApplications(prev =>
        prev.map(a => (a.id === selectedApp.id ? { ...a, candidate_profile: updatedCp } : a))
      );
      setSaveStatus("Saved!");
      setTimeout(() => setSaveStatus(""), 2500);
    } catch (e) { setSaveStatus("Failed"); console.error(e); }
    finally { setIsSaving(false); }
  };

  const handlePrevCandidate = () => {
    if (!selectedApp || filtered.length === 0) return;
    const index = filtered.findIndex(app => app.id === selectedApp.id);
    if (index > 0) {
      handleSelect(filtered[index - 1]);
    }
  };

  const handleNextCandidate = () => {
    if (!selectedApp || filtered.length === 0) return;
    const index = filtered.findIndex(app => app.id === selectedApp.id);
    if (index !== -1 && index < filtered.length - 1) {
      handleSelect(filtered[index + 1]);
    }
  };

  const handleFormKeyDown = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

    const target = e.target;
    const isFormField = target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA";
    if (!isFormField) return;

    // For text-like inputs, navigate only at the boundary
    if (target.tagName === "INPUT" && (target.type === "text" || target.type === "number")) {
      const { selectionStart, selectionEnd, value } = target;
      if (e.key === "ArrowLeft" && selectionStart !== 0) return;
      if (e.key === "ArrowRight" && selectionEnd !== (value || "").length) return;
    }

    const container = e.currentTarget;
    const focusable = Array.from(
      container.querySelectorAll(
        'input:not([tabindex="-1"]):not([disabled]), select:not([tabindex="-1"]):not([disabled]), textarea:not([tabindex="-1"]):not([disabled])'
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

  const filtered = applications.filter(app => {
    const name = app.candidate_profile?.name || "";
    const email = app.candidate_profile?.email || "";
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
  });



  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen text-gray-800 dark:text-gray-100">
      <HRSidebar />

      <div className="flex-1 flex flex-col min-w-0 print:hidden">
        <HRTopbar />
        <div className="p-6 max-w-7xl mx-auto w-full flex-1 flex flex-col">


          {/* Search */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 mb-5 shadow-sm flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Search by name or email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 shrink-0">
              <CheckCircle className="text-emerald-500 w-4 h-4" />
              {applications.length} ready for onboarding
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Loading candidates...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 py-20 text-center px-4">
              <User className="w-10 h-10 text-blue-200 dark:text-blue-900 mb-3" />
              <h3 className="font-bold text-gray-900 dark:text-white">No onboarding candidates</h3>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 max-w-xs">Move applications to "Onboarding" status to see them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              {/* Left: Candidate List */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider px-1">Candidates</p>
                {filtered.map(app => {
                  const cp = app.candidate_profile || {};
                  const isSelected = selectedApp?.id === app.id;
                  return (
                    <div key={app.id} onClick={() => handleSelect(app)}
                      className={`p-4 rounded-xl border cursor-pointer flex items-center gap-3 bg-white dark:bg-gray-800 shadow-sm transition ${isSelected ? "border-blue-600 ring-2 ring-blue-50 dark:ring-blue-950/30" : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"}`}>
                      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/40 overflow-hidden">
                        {cp.photo_path
                          ? <img src={cp.photo_path.includes("://") ? cp.photo_path : `${FILE_BASE_URL}/${cp.photo_path}`} alt="" className="w-full h-full object-cover" />
                          : <User className="w-5 h-5 text-blue-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">{gv(cp.name, "No Name")}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{gv(app.job_title || app.department, "General")}</p>
                        {cp.employee_id && <span className="text-[10px] font-bold text-emerald-600">ID: {cp.employee_id}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right: Admin Console */}
              {selectedApp ? (
                <div className="lg:col-span-2 space-y-4">
                  {/* Actions bar */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      {/* Left Arrow Button */}
                      <button
                        onClick={handlePrevCandidate}
                        disabled={filtered.findIndex(app => app.id === selectedApp.id) <= 0}
                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition"
                        title="Previous Candidate"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                      </button>

                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{selectedApp.candidate_profile?.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{selectedApp.job_title || selectedApp.department}</p>
                      </div>

                      {/* Right Arrow Button */}
                      <button
                        onClick={handleNextCandidate}
                        disabled={filtered.findIndex(app => app.id === selectedApp.id) >= filtered.length - 1}
                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition"
                        title="Next Candidate"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                      </button>
                    </div>

                    <button onClick={() => window.print()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-100 transition">
                      <Printer className="w-4 h-4" /> Print All 6 Forms
                    </button>
                  </div>

                  {/* HR Fields Panel */}
                  <div className="bg-white dark:bg-gray-850 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                    <button onClick={() => setShowHRPanel(p => !p)}
                      className="w-full flex justify-between items-center px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-white">
                        <Edit2 className="w-4 h-4 text-blue-600" /> HR Administration Fields
                      </div>
                      {showHRPanel ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>

                    {showHRPanel && (
                      <div className="p-5 space-y-5 bg-white dark:bg-gray-800" onKeyDown={handleFormKeyDown}>
                        {/* Joining Info */}
                        <div>
                          <p className="text-[10px] font-bold text-blue-600 uppercase mb-3">Joining Information</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Field label="Employee ID" k="employee_id" placeholder="AE-2026-1001" hrFields={hrFields} setHR={setHR} />
                            <Field label="Date of Joining" k="date_of_joining" type="date" hrFields={hrFields} setHR={setHR} />
                            <Field label="Designation on Joining" k="designation" placeholder="Software Engineer" hrFields={hrFields} setHR={setHR} />
                          </div>
                        </div>
                        {/* Wages */}
                        <div>
                          <p className="text-[10px] font-bold text-blue-600 uppercase mb-3">Wages (₹ per month)</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <Field label="Basic" k="basic" placeholder="15000" hrFields={hrFields} setHR={setHR} />
                            <Field label="HRA" k="hra" placeholder="6000" hrFields={hrFields} setHR={setHR} />
                            <Field label="Conveyance" k="conveyance" placeholder="3000" hrFields={hrFields} setHR={setHR} />
                            <Field label="Medical Allow" k="medical_allow" placeholder="2000" hrFields={hrFields} setHR={setHR} />
                          </div>
                        </div>
                        {/* Witnesses */}
                        <div>
                          <p className="text-[10px] font-bold text-blue-600 uppercase mb-3">Witnesses (Gratuity Form F)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Witness 1 – Full Name & Address" k="witness1_name" placeholder="Name, full address..." hrFields={hrFields} setHR={setHR} />
                            <Field label="Witness 2 – Full Name & Address" k="witness2_name" placeholder="Name, full address..." hrFields={hrFields} setHR={setHR} />
                          </div>
                        </div>

                        <div className="flex items-center gap-4 pt-2">
                          <button onClick={handleSave} disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg text-xs transition disabled:opacity-50">
                            <Save className="w-3.5 h-3.5" />
                            {isSaving ? "Saving..." : "Save All Info"}
                          </button>
                          {saveStatus && <span className={`text-xs font-bold ${saveStatus === "Saved!" ? "text-emerald-600" : "text-red-500"}`}>{saveStatus}</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Form Preview */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                    <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider mb-3">Live 7-Page Form Preview (Scrollable)</p>
                    <div className="border border-gray-100 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 p-4 max-h-[55vh] overflow-y-auto shadow-inner">
                      <div className="bg-white max-w-[210mm] mx-auto rounded-lg shadow-sm border border-gray-100 p-6 pointer-events-none select-none">
                        <AllFormsHtml cp={selectedApp.candidate_profile || {}} app={selectedApp} hr={hrFields} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                  <FileText className="w-10 h-10 text-blue-100 dark:text-blue-900 mb-3" />
                  <h3 className="font-bold text-gray-800 dark:text-white">Select a Candidate</h3>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 max-w-xs">Click any candidate on the left to view and edit their complete 7-page onboarding form.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PRINTABLE AREA — visible only during print */}
      {selectedApp && (
        <>
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 8mm 6mm; }
              html, body, #root, main, .print-area-container {
                overflow: visible !important;
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                position: static !important;
              }
              body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
              body * { visibility: hidden; }
              .print-area, .print-area * { visibility: visible; }
              .print-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                display: block !important;
                overflow: visible !important;
                background: #fff !important;
              }
              .print-area > div { width: 100%; margin: 0 auto; box-sizing: border-box; }
            }
          `}</style>
          <div className="hidden print:block print-area print-area-container bg-white text-black">
            <AllFormsHtml cp={selectedApp.candidate_profile || {}} app={selectedApp} hr={hrFields} />
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD COMPONENT — defined at module level so React never re-mounts inputs.
// If defined inside HROnboarding, React treats it as a new component type on
// every render, unmounting and remounting the input, which drops focus.
// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, k, type = "text", placeholder = "", hrFields, setHR }) {
  const isDateField = ["date_of_joining"].includes(k);

  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">{label}</label>
      {type === "select" ? (
        <select value={hrFields[k] || "No"} onChange={e => setHR(k, e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white">
          <option value="No">No</option>
          <option value="Yes">Yes</option>
        </select>
      ) : isDateField ? (
        <div>
          <input
            type="text"
            placeholder="DD-MM-YYYY"
            value={hrFields[k] || ""}
            maxLength={10}
            onChange={e => {
              const prevVal = hrFields[k] || "";
              let val = e.target.value;
              if (val.length >= prevVal.length) val = formatDDMMYYYY(val);
              else if (prevVal.endsWith("-") && val.length === prevVal.length - 1) val = val.slice(0, -1);
              setHR(k, val);
            }}
            className={`w-full px-3 py-2 bg-white dark:bg-gray-700 border rounded-lg text-xs focus:outline-none focus:ring-2 transition text-gray-900 dark:text-white ${hrFields[k] && !isValidDate(hrFields[k])
              ? "border-red-500 focus:ring-red-400"
              : "border-gray-200 dark:border-gray-600 focus:ring-blue-500"
              }`}
          />
          {hrFields[k] && !isValidDate(hrFields[k]) && (
            <p className="text-red-500 text-[10px] mt-0.5">Invalid date (use DD-MM-YYYY)</p>
          )}
        </div>
      ) : (
        <input
          type={type}
          placeholder={placeholder}
          value={hrFields[k] || ""}
          onChange={e => setHR(k, e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-gray-900 dark:text-white"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALL 8 FORMS COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function AllFormsHtml({ cp, app, hr }) {
  const famList = cp.family || [];
  const getFam = (rel) => famList.find(f => f.relation?.toLowerCase() === rel.toLowerCase()) || { name: "", relation: rel, occupation: "", dob: "" };
  const father = getFam("Father");
  const mother = getFam("Mother");
  const spouse = famList.find(f => ["spouse", "wife", "husband"].includes(f.relation?.toLowerCase()?.trim())) || { name: "", relation: "Spouse", occupation: "", dob: "" };
  const hasFather = Boolean(father.name && father.name.trim());
  const hasSpouse = !hasFather && Boolean(spouse.name && spouse.name.trim());
  const displayName = hasFather ? father.name : (hasSpouse ? spouse.name : "");

  const isExperienced =
    (cp.candidate_type?.toLowerCase() === "experienced") ||
    (cp.candidateType?.toLowerCase() === "experienced") ||
    (app?.experienceStatus?.toLowerCase() === "experienced") ||
    (Array.isArray(cp.employment) && cp.employment.some(e => Boolean((e.organization || e.company || e.company_name || "").trim())));
  const children = famList.filter(f => ["child", "son", "daughter"].includes(f.relation?.toLowerCase()));
  const child1 = children[0] || { name: "", relation: "Child 1", occupation: "", dob: "" };
  const child2 = children[1] || { name: "", relation: "Child 2", occupation: "", dob: "" };
  const ecList = cp.emergency_contacts || [];
  const ec1 = ecList[0] || { name: "", relationship: "", contact: "" };
  const ec2 = ecList[1] || { name: "", relationship: "", contact: "" };
  const eduList = (cp.education || []).map((edu) => ({
    ...edu,
    degree: edu.degree || edu.course || "",
    institute: edu.institute || edu.institution || edu.college || "",
    from: edu.from || edu.from_date || edu.startDate || edu.start_date || "",
    to: edu.to || edu.to_date || edu.endDate || edu.end_date || "",
    specialization: edu.specialization || edu.branch || "",
  }));
  const empList = (cp.employment || []).map((emp) => ({
    ...emp,
    organization: emp.organization || emp.company || emp.company_name || "",
    designation: emp.designation || emp.role || emp.position || "",
    from: emp.from || emp.from_date || emp.startDate || emp.start_date || "",
    to: emp.to || emp.to_date || emp.endDate || emp.end_date || "",
    current: emp.current !== undefined ? Boolean(emp.current) : (Boolean(emp.is_current) || false),
  }));
  const emp1 = empList[0] || {};
  const emp2 = empList[1] || {};
  const ref = cp.reference_person || {};
  const med = cp.medical || {};
  const decl = cp.declaration || {};
  const totalWages = [hr.basic, hr.hra, hr.conveyance, hr.medical_allow]
    .map(v => parseFloat(v) || 0).reduce((a, b) => a + b, 0);
  const todayDMY = formatDMY(new Date().toISOString().split("T")[0]);

  const formatMonthYear = (dateStr) => {
    if (!dateStr) return "";
    const clean = String(dateStr).trim();
    if (!clean) return "";
    if (clean.toLowerCase() === "current" || clean.toLowerCase() === "present") return "CURRENT";
    const myMatch = clean.match(/^(\d{1,2})[\/\-](\d{4})$/);
    if (myMatch) {
      return `${String(myMatch[1]).padStart(2, "0")}/${myMatch[2]}`;
    }
    const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      return `${String(dmyMatch[2]).padStart(2, "0")}/${dmyMatch[3]}`;
    }
    const ymdMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymdMatch) {
      return `${String(ymdMatch[2]).padStart(2, "0")}/${ymdMatch[1]}`;
    }
    const parts = clean.split(/[-\/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[1].padStart(2, "0")}/${parts[0]}`;
      }
      return `${parts[1].padStart(2, "0")}/${parts[2]}`;
    }
    return clean;
  };

  const pageStyle = {
    pageBreakAfter: "always",
    breakAfter: "page",
    pageBreakInside: "avoid",
    breakInside: "avoid",
    width: "100%",
    minHeight: "277mm",
    background: "#fff",

    paddingTop: "4mm",
    paddingRight: "3mm",
    paddingBottom: "4mm",
    paddingLeft: "3mm",

    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "11px",
    lineHeight: "1.4",
    color: "#000",

    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxSizing: "border-box"
  };
  const lastPageStyle = { ...pageStyle, pageBreakAfter: "auto" };

  const TH = ({ children, style = {} }) => <td style={{ border: "1px solid #000", padding: "5px 6px", fontWeight: "bold", background: "#f5f5f5", ...style }}>{children}</td>;
  const TD = ({ children, style = {} }) => <td style={{ border: "1px solid #000", padding: "5px 6px", ...style }}>{children}</td>;
  const SH = ({ children }) => <div style={{ fontWeight: "bold", fontSize: "11px", background: "#d9d9d9", padding: "6px 8px", border: "1px solid #000", borderBottom: "none", textTransform: "uppercase", letterSpacing: "0.5px" }}>{children}</div>;

  const fmtFam = (val) => {
    if (val === null || val === undefined || val === "") return "N/A";
    const clean = val.toString().trim().toLowerCase();
    if (clean === "not applicable" || clean === "na" || clean === "n/a" || clean === "none" || clean === "nil" || clean === "-") {
      return "N/A";
    }
    return val;
  };

  const epfPageStyle = {
    ...pageStyle,
    minHeight: "277mm",
    height: "277mm",
    paddingTop: "6mm",
    paddingRight: "8mm",
    paddingBottom: "6mm",
    paddingLeft: "8mm",
    fontSize: "9px",
    lineHeight: "1.3",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    boxSizing: "border-box",
    pageBreakAfter: "always",
    breakAfter: "page",
    pageBreakInside: "avoid",
    breakInside: "avoid"
  };

  const ETD = ({ children, style = {}, colSpan, rowSpan }) => (
    <td colSpan={colSpan} rowSpan={rowSpan} style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "8.5px", verticalAlign: "middle", ...style }}>
      {children}
    </td>
  );
  const ETH = ({ children, style = {}, colSpan, rowSpan }) => (
    <th colSpan={colSpan} rowSpan={rowSpan} style={{ border: "1px solid #000", padding: "4px 3px", fontWeight: "bold", background: "#f5f5f5", fontSize: "8px", verticalAlign: "middle", textAlign: "center", ...style }}>
      {children}
    </th>
  );
  const MandatoryBadge = () => (
    <span style={{ backgroundColor: "#ffff00", color: "#000", fontWeight: "bold", padding: "1px 6px", fontSize: "8.5px", display: "inline-block", letterSpacing: "0.2px" }}>
      MANDATORY
    </span>
  );



  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* ══════════════════════════════════════════════════════════════════
          PAGE 1 — PERSONAL & EDUCATIONAL DETAILS
      ══════════════════════════════════════════════════════════════════ */}
      <div style={pageStyle}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "15px", fontWeight: "bold", fontFamily: "Arial, sans-serif", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px" }}>AUTOCRAT ENGINEERS</div>
            <div style={{ fontSize: "12px", fontWeight: "bold", fontFamily: "Arial, sans-serif", marginBottom: "16px" }}>Plot No 21 &amp; 22, Phase-1, EPIP, Whitefield, Bangalore – 560 066</div>
            <div style={{ fontSize: "20px", fontWeight: "bold", fontFamily: "Georgia, 'Times New Roman', Times, serif", textTransform: "uppercase", letterSpacing: "1.5px" }}>EMPLOYEE JOINING FORM</div>
          </div>

          {/* Personal Details Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: "11px" }}>
            <colgroup>
              <col style={{ width: "50%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "25%" }} />
            </colgroup>
            <tbody>
              {/* PERSONAL DETAILS Header */}
              <tr>
                <td colSpan={3} style={{ background: "#d9d9d9", border: "1px solid #000", fontWeight: "bold", fontSize: "11px", padding: "6px 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  PERSONAL DETAILS
                </td>
              </tr>
              {/* Row 1: Name & Photo */}
              <tr>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  NAME (CAPITAL LETTERS): <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{(cp.name || "").toUpperCase()}</span>
                </td>
                <td
                  rowSpan={5}
                  style={{
                    border: "1px solid #000",
                    width: "25%",
                    height: "160px",
                    textAlign: "center",
                    verticalAlign: "middle",
                    padding: "4px",
                    boxSizing: "border-box",
                  }}
                >
                  {cp.photo_path ? (
                    <img
                      src={
                        cp.photo_path.includes("://")
                          ? cp.photo_path
                          : `${FILE_BASE_URL}/${cp.photo_path}`
                      }
                      alt="Employee Photo"
                      style={{
                        width: "100%",
                        height: "200px",
                        maxWidth: "100%",
                        objectFit: "contain",
                        display: "block",
                        margin: "0 auto",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        background: "#ffff00",
                        color: "#000",
                        fontWeight: "bold",
                        fontSize: "11px",
                        padding: "3px 6px",
                        display: "inline-block",
                      }}
                    >
                      PHOTO
                    </span>
                  )}
                </td>
              </tr>
              {/* Row 2: Designation */}
              <tr>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  DESIGNATION: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{(hr.designation || cp.designation || "").toUpperCase()}</span>
                </td>
              </tr>
              {/* Row 3: Date of Joining */}
              <tr>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  DATE OF JOINING: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{formatDMY(hr.date_of_joining)}</span>
                </td>
              </tr>
              {/* Row 4: Employee ID */}
              <tr>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  EMPLOYEE ID: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{hr.employee_id || ""}</span>
                </td>
              </tr>
              {/* Row 5: Correspondence Address */}
              <tr>
                <td
                  colSpan={2}
                  style={{
                    border: "1px solid #000",
                    padding: "5px 8px",
                    height: "56px",
                    verticalAlign: "top",
                    lineHeight: "1.4"
                  }}
                >
                  <span style={{ fontWeight: "bold" }}>
                    CORRESPONDENCE ADDRESS:
                  </span>

                  <span style={{
                    marginLeft: "8px",
                    fontWeight: "normal",
                    textTransform: "uppercase"
                  }}>
                    {cp.correspondence_address || ""}
                  </span>
                </td>
              </tr>
              {/* Row 6: Permanent Address */}
              <tr>
                <td
                  colSpan={3}
                  style={{
                    border: "1px solid #000",
                    padding: "5px 8px",
                    height: "56px",
                    verticalAlign: "top",
                    lineHeight: "1.4"
                  }}
                >
                  <span style={{ fontWeight: "bold" }}>
                    PERMANENT ADDRESS:
                  </span>

                  <span style={{
                    marginLeft: "8px",
                    fontWeight: "normal",
                    textTransform: "uppercase"
                  }}>
                    {cp.permanent_address || ""}
                  </span>
                </td>
              </tr>
              {/* Row 7: Mobile No & Email ID */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  MOBILE NO: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{gv(cp.phone_number)}{cp.mobile2 ? `, ${cp.mobile2}` : ""}</span>
                </td>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  EMAIL ID: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{gv(cp.email)}</span>
                </td>
              </tr>
              {/* Row 8: Date of Birth & Martial Status */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  DATE OF BIRTH: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{formatDMY(cp.date_of_birth)}</span>
                </td>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  MARTIAL STATUS: <span style={{ fontWeight: "normal", marginLeft: "8px", textTransform: "uppercase" }}>{gv(cp.marital_status)}</span>
                </td>
              </tr>
              {/* Row 9: Aadhar No & Pan Card No */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  AADHAR NO: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{gv(cp.aadhar)}</span>
                </td>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  PAN CARD NO: <span style={{ fontWeight: "normal", marginLeft: "8px", textTransform: "uppercase" }}>{gv(cp.pan)}</span>
                </td>
              </tr>
              {/* Row 10: Passport No & Bank Account No */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  PASSPORT NO: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{gv(cp.passport, "N/A")}</span>
                </td>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  BANK ACCOUNT NO: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{gv(cp.bank_account)}</span>
                </td>
              </tr>
              {/* Row 11: IFSC Code & Bank Name */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  IFSC CODE: <span style={{ fontWeight: "normal", marginLeft: "8px", textTransform: "uppercase" }}>{gv(cp.ifsc)}</span>
                </td>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  BANK NAME: <span style={{ fontWeight: "normal", marginLeft: "8px", textTransform: "uppercase" }}>{gv(cp.bank_name)}</span>
                </td>
              </tr>
              {/* Row 12: UAN & ESIC */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  UAN: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{gv(cp.uan)}</span>
                </td>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "5px 8px", fontWeight: "bold", height: "32px" }}>
                  ESIC: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{gv(cp.esic)}</span>
                </td>
              </tr>
              {/* EMERGENCY CONTACT DETAILS Header */}
              <tr>
                <td colSpan={3} style={{ background: "#fff", border: "1px solid #000", fontWeight: "bold", fontSize: "11px", padding: "6px 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  EMERGENCY CONTACT DETAILS
                </td>
              </tr>
              {/* Column Headers */}
              <tr style={{ fontWeight: "bold" }}>
                <td style={{ border: "1px solid #000", padding: "5px 8px", height: "28px" }}>NAME:</td>
                <td style={{ border: "1px solid #000", padding: "5px 8px", height: "28px" }}>RELATIONSHIP:</td>
                <td style={{ border: "1px solid #000", padding: "5px 8px", height: "28px" }}>CONTACT NO:</td>
              </tr>
              {/* Emergency Contact Data Rows */}
              {[ec1, ec2].map((ec, idx) => (
                <tr key={idx}>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", height: "34px", textTransform: "uppercase", fontWeight: "normal" }}>{gv(ec.name)}</td>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", height: "34px", textTransform: "uppercase", fontWeight: "normal" }}>{gv(ec.relationship)}</td>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", height: "34px", fontWeight: "normal" }}>{gv(ec.contact)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Educational Details Section */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginTop: "16px", fontSize: "11px" }}>
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "38%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <tbody>
              {/* EDUCATIONAL DETAILS Header */}
              <tr>
                <td colSpan={5} style={{ background: "#d9d9d9", border: "1px solid #000", fontWeight: "bold", fontSize: "11px", padding: "6px 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  EDUCATIONAL DETAILS
                </td>
              </tr>
              {/* Column Headers */}
              <tr style={{ fontWeight: "bold", textAlign: "center" }}>
                <td style={{ border: "1px solid #000", padding: "5px 6px", height: "30px" }}>DEGREE</td>
                <td style={{ border: "1px solid #000", padding: "5px 6px", height: "30px" }}>UNIVERSITY/INSTITUTE</td>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "30px" }}>FROM</td>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "30px" }}>TO</td>
                <td style={{ border: "1px solid #000", padding: "5px 6px", height: "30px" }}>SPECIALIZATION</td>
              </tr>
              {/* Exactly 3 Rows */}
              {(() => {
                const rows = [];
                for (let i = 0; i < 3; i++) {
                  rows.push(eduList[i] || { degree: "", institute: "", from: "", from_date: "", to: "", to_date: "", specialization: "" });
                }
                return rows.map((e, idx) => (
                  <tr key={idx}>
                    <td style={{ border: "1px solid #000", padding: "8px 8px", height: "72px", textTransform: "uppercase", fontWeight: "normal" }}>{gv(e.degree)}</td>
                    <td style={{ border: "1px solid #000", padding: "8px 8px", height: "72px", textTransform: "uppercase", fontWeight: "normal" }}>{gv(e.institute)}</td>
                    <td style={{ border: "1px solid #000", padding: "8px 4px", height: "72px", textAlign: "center", fontWeight: "normal" }}>{formatDMY(e.from || e.from_date || "")}</td>
                    <td style={{ border: "1px solid #000", padding: "8px 4px", height: "72px", textAlign: "center", fontWeight: "normal" }}>{formatDMY(e.to || e.to_date || "")}</td>
                    <td style={{ border: "1px solid #000", padding: "8px 8px", height: "72px", textTransform: "uppercase", fontWeight: "normal" }}>{gv(e.specialization)}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PAGE 2 — EMPLOYMENT & FAMILY DETAILS
      ══════════════════════════════════════════════════════════════════ */}
      <div style={pageStyle}>
        <div style={{ paddingTop: "6mm" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "22px" }}>
            <div style={{ fontSize: "18px", fontWeight: "bold", fontFamily: "Arial, sans-serif", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>AUTOCRAT ENGINEERS</div>
            <div style={{ fontSize: "14px", fontWeight: "bold", fontFamily: "Arial, sans-serif", marginBottom: "0px" }}>Plot No 21 &amp; 22, Phase-1, EPIP, Whitefield, Bangalore – 560 066</div>
          </div>

          {/* Employment & Reference Details Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: "11px" }}>
            <colgroup>
              <col style={{ width: "50%" }} />
              <col style={{ width: "50%" }} />
            </colgroup>
            <tbody>
              {/* Header */}
              <tr>
                <td colSpan={2} style={{ background: "#d9d9d9", border: "1px solid #000", fontWeight: "bold", fontSize: "11px", padding: "6px 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  PREVIOUS EMPLOYMENT DETAILS &amp; PROFESSIONAL REFERENCES
                </td>
              </tr>
              {/* Row 1: Organization */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold", height: "38px" }}>
                  ORGANIZATION: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{(emp1.organization || "").toUpperCase()}</span>
                </td>
                <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold", height: "38px" }}>
                  ORGANIZATION: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{(emp2.organization || "").toUpperCase()}</span>
                </td>
              </tr>
              {/* Row 2: Duration */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold", height: "38px" }}>
                  DURATION (Month/Year): {emp1.from || emp1.to ? (
                    <>
                      <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{formatMonthYear(emp1.from)}</span>
                      <span style={{ margin: "0 15px" }}>TO</span>
                      <span style={{ fontWeight: "normal" }}>{emp1.current ? "CURRENT" : formatMonthYear(emp1.to)}</span>
                    </>
                  ) : (
                    <span style={{ fontWeight: "normal", marginLeft: "40px" }}>TO</span>
                  )}
                </td>
                <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold", height: "38px" }}>
                  DURATION (Month/Year): {emp2.from || emp2.to ? (
                    <>
                      <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{formatMonthYear(emp2.from)}</span>
                      <span style={{ margin: "0 15px" }}>TO</span>
                      <span style={{ fontWeight: "normal" }}>{emp2.current ? "CURRENT" : formatMonthYear(emp2.to)}</span>
                    </>
                  ) : (
                    <span style={{ fontWeight: "normal", marginLeft: "40px" }}>TO</span>
                  )}
                </td>
              </tr>
              {/* Row 3: Designation */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold", height: "38px" }}>
                  DESIGNATION: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{(emp1.designation || "").toUpperCase()}</span>
                </td>
                <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold", height: "38px" }}>
                  DESIGNATION: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{(emp2.designation || "").toUpperCase()}</span>
                </td>
              </tr>
              {/* Row 4: Name of the Person Reference */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold", height: "38px" }}>
                  NAME OF THE PERSON (Reference): <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{cp.reference_source === "Person Referral" ? (cp.reference_person?.name || "").toUpperCase() : (cp.reference_source || "").toUpperCase()}</span>
                </td>
                <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold", height: "38px" }}>
                  NAME OF THE PERSON (Reference): <span style={{ fontWeight: "normal", marginLeft: "8px" }}></span>
                </td>
              </tr>
              {/* Row 5: Designation */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold", height: "38px" }}>
                  DESIGNATION: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{cp.reference_source === "Person Referral" ? (cp.reference_person?.designation || "").toUpperCase() : ""}</span>
                </td>
                <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold", height: "38px" }}>
                  DESIGNATION: <span style={{ fontWeight: "normal", marginLeft: "8px" }}></span>
                </td>
              </tr>
              {/* Row 6: Contact No */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold", height: "38px" }}>
                  CONTACT NO: <span style={{ fontWeight: "normal", marginLeft: "8px" }}>{cp.reference_source === "Person Referral" ? cp.reference_person?.contact || "" : ""}</span>
                </td>
                <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold", height: "38px" }}>
                  CONTACT NO: <span style={{ fontWeight: "normal", marginLeft: "8px" }}></span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Family Details Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginTop: "20px", fontSize: "11px" }}>
            <colgroup>
              <col style={{ width: "7%" }} />
              <col style={{ width: "37%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "18%" }} />
            </colgroup>
            <tbody>
              {/* Header */}
              <tr>
                <td colSpan={5} style={{ background: "#d9d9d9", border: "1px solid #000", fontWeight: "bold", fontSize: "11px", padding: "6px 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  FAMILY DETAILS
                </td>
              </tr>
              {/* Table Headers */}
              <tr style={{ fontWeight: "bold", textAlign: "center" }}>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "32px" }}>SL<br />NO.</td>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "32px" }}>NAME</td>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "32px" }}>RELATION</td>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "32px" }}>OCCUPATION</td>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "32px" }}>DATE OF BIRTH</td>
              </tr>
              {/* Exactly 5 Rows */}
              {(() => {
                const familyRows = [
                  { sl: 1, rel: "Father", m: father },
                  { sl: 2, rel: "Mother", m: mother },
                  { sl: 3, rel: "Spouse", m: spouse },
                  { sl: 4, rel: "Child 1", m: child1 },
                  { sl: 5, rel: "Child 2", m: child2 },
                ];
                return familyRows.map(({ sl, rel, m }) => {
                  const hasName = !!m.name;
                  return (
                    <tr key={sl}>
                      <td style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center", height: "38px" }}>{sl}</td>
                      <td style={{ border: "1px solid #000", padding: "5px 8px", height: "38px", textTransform: "uppercase", fontWeight: "normal" }}>{gv(m.name)}</td>
                      <td style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center", textTransform: "uppercase", fontWeight: "normal" }}>{hasName ? (m.relation || rel).toUpperCase() : ""}</td>
                      <td style={{ border: "1px solid #000", padding: "5px 8px", height: "38px", textTransform: "uppercase", fontWeight: "normal" }}>{hasName ? gv(m.occupation) : ""}</td>
                      <td style={{ border: "1px solid #000", padding: "5px 4px", height: "38px", textAlign: "center", fontWeight: "normal" }}>{hasName ? formatDMY(m.dob) : ""}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>

          {/* Medical Details Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginTop: "20px", fontSize: "11px" }}>
            <colgroup>
              <col style={{ width: "15%" }} />
              <col style={{ width: "35%" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <tbody>
              {/* Header */}
              <tr>
                <td colSpan={4} style={{ background: "#d9d9d9", border: "1px solid #000", fontWeight: "bold", fontSize: "11px", padding: "6px 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  MEDICAL DETAILS
                </td>
              </tr>
              {/* Table Headers */}
              <tr style={{ fontWeight: "bold", textAlign: "center" }}>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "32px" }}>BLOOD GROUP</td>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "32px" }}>KNOWN DISABILITY IF ANY</td>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "32px" }}>KNOWN MEDICAL CONDITIONS IF<br />ANY</td>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "32px" }}>SINCE NO. OF YEARS</td>
              </tr>
              {/* Single Data Row */}
              <tr style={{ textAlign: "center" }}>
                <td style={{ border: "1px solid #000", padding: "5px 4px", fontWeight: "bold", height: "40px" }}>{(med.bloodGroup || "").toUpperCase()}</td>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "40px", textTransform: "uppercase", fontWeight: "normal" }}>{med.hasDisability === "Yes" ? `YES (${(med.disabilityYears || "").toUpperCase()} YRS)` : (med.hasDisability === "No" ? "NO" : "")}</td>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "40px", textTransform: "uppercase", fontWeight: "normal" }}>{med.hasCondition === "Yes" ? "YES" : (med.hasCondition === "No" ? "NO" : "")}</td>
                <td style={{ border: "1px solid #000", padding: "5px 4px", height: "40px", fontWeight: "normal" }}>{med.hasCondition === "Yes" ? gv(med.conditionYears) : ""}</td>
              </tr>
            </tbody>
          </table>

          {/* Declaration Section */}
          <div style={{ marginTop: "20px" }}>
            <div style={{ background: "#d9d9d9", border: "1px solid #000", fontWeight: "bold", fontSize: "11px", padding: "6px 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              DECLARATION
            </div>
            <div style={{ border: "1px solid #000", borderTop: "none", padding: "14px 16px", fontSize: "11px", lineHeight: "1.4" }}>
              <div style={{ textAlign: "justify", marginBottom: "26px" }}>
                I declare that the above information is correct to the best of my knowledge. I authorize the company to verify the details at any point of time to authenticate the records.
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div style={{ fontSize: "11px" }}>
                  <div style={{ marginBottom: "24px" }}><b>Date:</b> ___________________________</div>
                  <div><b>Place:</b> ___________________________</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
                  <span style={{ backgroundColor: "#ffff00", fontWeight: "bold", fontSize: "11px", padding: "1px 4px" }}>Signature</span>
                  <div style={{ width: "200px", height: "55px", border: "1.5px solid #5a8ab8", borderRadius: "10px", backgroundColor: "#fff" }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>


      {/* ══════════════════════════════════════════════════════════════════
          PAGE 3 — EPFO FORM 11 (DECLARATION FORM)
      ══════════════════════════════════════════════════════════════════ */}
      <div style={epfPageStyle}>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >


          {/* Top Form Identification & EPFO Header */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "2px" }}>
            <div style={{ textAlign: "right", lineHeight: "1.25" }}>
              <div style={{ fontSize: "8.5px" }}>New Form - 11 - Declaration Form</div>
              <div style={{ fontSize: "7.5px", color: "#333" }}>(To be retained by the employer for future reference)</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "13px", fontWeight: "bold", color: "#0055b8", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: "2px" }}>
                EMPLOYEES' PROVIDENT FUND ORGANISATION
              </div>
              <div style={{ fontSize: "8.5px", color: "#000", lineHeight: "1.25" }}>
                Employees' Provident Fund Scheme, 1952 (Paragraph 34 &amp; 57) and
              </div>
              <div style={{ fontSize: "8.5px", color: "#000", lineHeight: "1.25" }}>
                Employees' Pension Scheme, 1995 (Paragraph 24)
              </div>
              <div style={{ fontSize: "7.5px", color: "#222", marginTop: "1px" }}>
                (Declaration by a person taking up Employment in any Establishment on which EPF Scheme, 1952 and for EPS, 1995 is applicable)
              </div>
            </div>
          </div>

          {/* Main Form Table (Rows 1 to 11) */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1.5px solid #000" }}>
            <tbody>
              {/* 1 */}
              <tr>
                <ETD style={{ width: "4%", textAlign: "center" }}>1.</ETD>
                <ETD style={{ width: "50%" }}>
                  Name of Member <span style={{ color: "red", fontWeight: "normal" }}>(Aadhar Name)</span>
                </ETD>
                <ETD style={{ width: "46%" }}>
                  {cp.name ? <span style={{ fontWeight: "normal" }}>{cp.name.toUpperCase()}</span> : <MandatoryBadge />}
                </ETD>
              </tr>

              {/* 2 */}
              <tr>
                <ETD style={{ textAlign: "center" }}>2.</ETD>
                <ETD>
                  <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      Father's Name
                      <span style={{ display: "inline-block", width: "10px", height: "10px", border: "1px solid #000", textAlign: "center", lineHeight: "9px", fontSize: "9px", fontWeight: "bold" }}>
                        {hasFather ? "✓" : ""}
                      </span>
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      Spouse's Name
                      <span style={{ display: "inline-block", width: "10px", height: "10px", border: "1px solid #000", textAlign: "center", lineHeight: "9px", fontSize: "9px", fontWeight: "bold" }}>
                        {hasSpouse ? "✓" : ""}
                      </span>
                    </span>
                  </div>
                  <div style={{ fontSize: "7px", color: "#444", marginTop: "1px" }}>
                    (Please tick whichever applicable)
                  </div>
                </ETD>
                <ETD>
                  {displayName ? <span style={{ fontWeight: "normal" }}>{displayName.toUpperCase()}</span> : <MandatoryBadge />}
                </ETD>
              </tr>

              {/* 3 */}
              <tr>
                <ETD style={{ textAlign: "center" }}>3.</ETD>
                <ETD>Date of Birth (dd/mm/yyyy)</ETD>
                <ETD>
                  {cp.date_of_birth ? <span style={{ fontWeight: "normal" }}>{formatDMY(cp.date_of_birth)}</span> : <MandatoryBadge />}
                </ETD>
              </tr>

              {/* 4 */}
              <tr>
                <ETD style={{ textAlign: "center" }}>4.</ETD>
                <ETD>Gender (Male / Female / Transgender)</ETD>
                <ETD>
                  {cp.gender ? <span style={{ fontWeight: "normal" }}>{cp.gender.toUpperCase()}</span> : <MandatoryBadge />}
                </ETD>
              </tr>

              {/* 5 */}
              <tr>
                <ETD style={{ textAlign: "center" }}>5.</ETD>
                <ETD>
                  Marital Status ? <span style={{ fontSize: "7px", color: "#444" }}>(Single/Married/Widow/Widower/Divorcee)</span>
                </ETD>
                <ETD>
                  {cp.marital_status ? <span style={{ fontWeight: "normal" }}>{cp.marital_status.toUpperCase()}</span> : <MandatoryBadge />}
                </ETD>
              </tr>

              {/* 6 */}
              <tr>
                <ETD rowSpan={2} style={{ textAlign: "center" }}>6.</ETD>
                <ETD>(a) eMail ID</ETD>
                <ETD>
                  {cp.email ? <span style={{ fontWeight: "normal" }}>{cp.email}</span> : <MandatoryBadge />}
                </ETD>
              </tr>
              <tr>
                <ETD>
                  (b) Mobile No <span style={{ color: "red", fontWeight: " normal" }}>(Aadhar Registered)</span>
                </ETD>
                <ETD>
                  {cp.phone_number ? <span style={{ fontWeight: "normal" }}>{cp.phone_number}</span> : <MandatoryBadge />}
                </ETD>
              </tr>

              {/* 7 */}
              <tr>
                <ETD style={{ textAlign: "center" }}>7.</ETD>
                <ETD>Whether earlier member of the Employee's Provident Fund Scheme, 1952 ?</ETD>
                <ETD style={{ textAlign: "left" }}>Yes / No</ETD>
              </tr>

              {/* 8 */}
              <tr>
                <ETD style={{ textAlign: "center" }}>8.</ETD>
                <ETD>Whether earlier member of the Employee's Pension Scheme, 1995 ?</ETD>
                <ETD style={{ textAlign: "left" }}>Yes / No</ETD>
              </tr>

              {/* 9 */}
              <tr>
                <ETD rowSpan={6} style={{ textAlign: "center" }}>9.</ETD>
                <ETD>
                  <strong>Previous Employment details</strong> <span style={{ color: "red", fontWeight: "bold" }}>(If Yes, 7 &amp; 8 details above)</span>
                </ETD>
                <ETD style={{ textAlign: "left" }}>
                  <span style={{ fontWeight: "normal" }}>{isExperienced ? "Yes" : "No"}</span>
                </ETD>
              </tr>
              <tr>
                <ETD>a) Universal Account Number (UAN)</ETD>
                <ETD>{isExperienced && cp.uan ? <span style={{ fontWeight: "normal" }}>{cp.uan}</span> : ""}</ETD>
              </tr>
              <tr>
                <ETD>b) Previous PF Account Number</ETD>
                <ETD></ETD>
              </tr>
              <tr>
                <ETD>c) Date of Exit from previous Employment? (dd/mm/yyyy)</ETD>
                <ETD></ETD>
              </tr>
              <tr>
                <ETD>d) Scheme Certificate No (If issued)</ETD>
                <ETD></ETD>
              </tr>
              <tr>
                <ETD>e) Pension Payment Order (PPO) (If issued)</ETD>
                <ETD></ETD>
              </tr>

              {/* 10 */}
              <tr>
                <ETD rowSpan={4} style={{ textAlign: "center" }}>10.</ETD>
                <ETD>a) International Worker</ETD>
                <ETD style={{ textAlign: "left" }}>Yes / No</ETD>
              </tr>
              <tr>
                <ETD>b) If Yes, state country of origin (name of other country)</ETD>
                <ETD></ETD>
              </tr>
              <tr>
                <ETD>c) Passport No.</ETD>
                <ETD>{cp.passport ? <span style={{ fontWeight: "bold" }}>{cp.passport}</span> : ""}</ETD>
              </tr>
              <tr>
                <ETD>d) Validity of passport (dd/mm/yyyy) to (dd/mm/yyyy)</ETD>
                <ETD></ETD>
              </tr>

              {/* 11 */}
              <tr>
                <ETD rowSpan={4} style={{ textAlign: "center" }}>11.</ETD>
                <ETD>
                  <strong>KYC Details :</strong> (attach self-attested copies of following KYCs)
                </ETD>
                <ETD style={{ fontStyle: "italic", fontSize: "8.5px", color: "#555", textAlign: "left" }}>
                  Must Enclose Scan copy for the following documents
                </ETD>
              </tr>
              <tr>
                <ETD>a) Bank Account No. &amp; IFS Code</ETD>
                <ETD>
                  {cp.bank_account && cp.ifsc ? (
                    <span style={{ fontWeight: "normal" }}>{cp.bank_account} &amp; {cp.ifsc}</span>
                  ) : (
                    cp.bank_account || cp.ifsc || <MandatoryBadge />
                  )}
                </ETD>
              </tr>
              <tr>
                <ETD>b) AADHAR Number</ETD>
                <ETD>
                  {cp.aadhar ? <span style={{ fontWeight: "normal" }}>{cp.aadhar}</span> : <MandatoryBadge />}
                </ETD>
              </tr>
              <tr>
                <ETD>c) Permanent Account Number (PAN), If available</ETD>
                <ETD>
                  {cp.pan ? <span style={{ fontWeight: "normal" }}>{cp.pan}</span> : <MandatoryBadge />}
                </ETD>
              </tr>
            </tbody>
          </table>

          {/* Separate 12th Row Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1.5px solid #000", marginTop: "1px" }}>
            <colgroup>
              <col style={{ width: "4%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <tbody>
              <tr>
                <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5px", verticalAlign: "middle" }}>
                  12.
                </td>
                <td style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", fontSize: "7.5px", verticalAlign: "middle", lineHeight: "1.2" }}>
                  First EPF Member<br />Enrolled Date
                </td>
                <td style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", fontSize: "7.5px", verticalAlign: "middle", lineHeight: "1.2" }}>
                  First Employment EPF<br />Wages
                </td>
                <td style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", fontSize: "7.5px", verticalAlign: "middle", lineHeight: "1.2" }}>
                  Are you EPF Member<br />before <span style={{ color: "red", fontWeight: "bold" }}>01/09/2014</span>
                </td>
                <td style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", fontSize: "7.5px", verticalAlign: "middle", lineHeight: "1.2" }}>
                  If <span style={{ color: "red", fontWeight: "bold" }}>Yes, EPF</span> Amount<br />Withdrawn?
                </td>
                <td style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", fontSize: "7.5px", verticalAlign: "middle", lineHeight: "1.2" }}>
                  If <span style={{ color: "red", fontWeight: "bold" }}>Yes, EPS (Pension)</span><br />Amount Withdrawn?
                </td>
                <td style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", fontSize: "7.5px", verticalAlign: "middle", lineHeight: "1.2" }}>
                  After Sep 2014 earned <span style={{ color: "red", fontWeight: "bold" }}>EPF</span><br /><span style={{ color: "red", fontWeight: "bold" }}>(Pension)</span> Amount Withdrawn<br />before Join current Employer?
                </td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #000", textAlign: "center", padding: "4px 2px", fontSize: "8px", height: "26px" }}></td>
                <td style={{ border: "1px solid #000", textAlign: "center", padding: "4px 2px", fontSize: "8px", height: "26px" }}></td>
                <td style={{ border: "1px solid #000", textAlign: "center", padding: "4px 2px", fontSize: "8px", height: "26px" }}></td>
                <td style={{ border: "1px solid #000", textAlign: "center", padding: "4px 2px", fontSize: "8px", height: "26px" }}></td>
                <td style={{ border: "1px solid #000", textAlign: "center", padding: "4px 2px", fontSize: "8px", height: "26px" }}></td>
                <td style={{ border: "1px solid #000", textAlign: "center", padding: "4px 2px", fontSize: "8px", height: "26px" }}></td>
              </tr>
            </tbody>
          </table>

          {/* UNDERTAKING — immediately next to 12th row bottom with no space */}
          <div style={{ textAlign: "center", fontWeight: "bold", textDecoration: "underline", fontSize: "9px", marginTop: "0px", marginBottom: "0px" }}>
            UNDERTAKING
          </div>
          <div style={{ fontSize: "8px", lineHeight: "1.3" }}>
            <div>1) Certified that the particulars are true to the best of my knowledge</div>
            <div>2) I authorize EPFO to use my Aadhar for verification / authentication / eKYC purpose for service delivery</div>
            <div>
              3) Kindly transfer the fund and service details, if applicable, from the previous PF account as declared above to the present PF account.
              <div style={{ marginLeft: "14px", fontSize: "7px", color: "#333" }}>
                (The transfer would be possible only if the identified KYC details approved by previous employer has been verified by present employer using his Digital Signature)
              </div>
            </div>
            <div>4) In case of changes in above details, the same will be intimated to employer at the earlies</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "4px", marginBottom: "2px" }}>
            <div style={{ fontSize: "8px", lineHeight: "1.3" }}>
              <div style={{ marginBottom: "4px" }}>Date :</div>
              <div>Place :</div>
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#e4e4e4", letterSpacing: "1px", userSelect: "none" }}>
              HarSun
            </div>
            <div>
              <span style={{ backgroundColor: "#ffff00", color: "#000", fontWeight: "bold", fontSize: "8.5px", padding: "1px 6px" }}>
                Signature of Member
              </span>
            </div>
          </div>

          {/* DECLARATION BY PRESENT EMPLOYER — no space after undertaking or before text */}
          <div style={{ textAlign: "center", fontWeight: "bold", textDecoration: "underline", fontSize: "9px", marginTop: "3px", marginBottom: "1px" }}>
            DECLARATION BY PRESENT EMPLOYER
          </div>
          <div style={{ fontSize: "8px", lineHeight: "1.3" }}>
            <div>
              <strong>A.</strong> &nbsp;The member Mr./Ms./Mrs. _________________________________ has joined on ___________________ and has been allotted PF Number ___________________.
            </div>
            <div style={{ marginTop: "2px" }}>
              <strong>B.</strong> &nbsp;In case the person was earlier not a member of EPF Scheme, 1952 and EPS, 1995: (Post allotment of UAN) The UAN allotted to the member is:
            </div>
            <div style={{ marginLeft: "14px", marginTop: "1px" }}>
              Please Tick the Appropriate Option: &nbsp;&nbsp;&nbsp;&nbsp; The KYC details of the Above member in the UAN database
            </div>
            <div style={{ marginLeft: "14px", marginTop: "2px", display: "flex", gap: "20px" }}>
              <span>☐ &nbsp; Have not been uploaded</span>
              <span>|</span>
              <span>☐ &nbsp; Have been uploaded but not approved</span>
              <span>|</span>
              <span>Have been uploaded and approved with DSC</span>
            </div>
            <div style={{ marginTop: "2px" }}>
              <strong>C.</strong> &nbsp;In case the person was earlier a member of EPF Scheme, 1952 and EPS, 1995:
            </div>
            <div style={{ marginLeft: "14px", marginTop: "1px", display: "flex", alignItems: "flex-start", gap: "6px" }}>
              <span>☐</span>
              <span>The KYC details of the Above member in the UAN database have been approved with Digital Signature Certificate and transfer request has been generated on portal</span>
            </div>
            <div style={{ marginLeft: "14px", marginTop: "1px", display: "flex", alignItems: "flex-start", gap: "6px" }}>
              <span>☐</span>
              <span>As the DSC of establishment are not registered with EPFO, the member has been informed to file physical claim (Form-13) for transfer of funds from his previous establishment.</span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "6px", fontSize: "8px" }}>
            <div>
              Date : &nbsp;
            </div>
            <div>
              Signature of Employer with Seal of Establishment
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PAGE 4 — FORM Q (APPOINTMENT ORDER)
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{ ...pageStyle, minHeight: "277mm", height: "277mm", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box", fontFamily: "'Times New Roman', Times, serif", padding: "6mm 8mm 10mm 8mm" }}>
        <div>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "14px", paddingTop: "2px" }}>
            <div style={{ fontSize: "16px", fontWeight: "bold", textTransform: "uppercase" }}>FORM “Q”</div>
            <div style={{ fontSize: "10.5px", marginTop: "1px" }}>(See Rule 24 (9A))</div>
            <div style={{ fontSize: "15px", fontWeight: "bold", textTransform: "uppercase", marginTop: "3px", letterSpacing: "0.5px" }}>APPOINTMENT ORDER</div>
          </div>

          {/* Main Table - Stretched 12 rows */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: "11px" }}>
            <colgroup>
              <col style={{ width: "5%" }} />
              <col style={{ width: "37%" }} />
              <col style={{ width: "58%" }} />
            </colgroup>
            <tbody>
              {/* 1 */}
              <tr style={{ height: "64px" }}>
                <TD style={{ textAlign: "left", verticalAlign: "top", padding: "6px 8px" }}>1.</TD>
                <TD style={{ verticalAlign: "top", padding: "6px 8px" }}>Name and address of the Establishment</TD>
                <TD style={{ verticalAlign: "top", padding: "6px 8px", fontWeight: "bold" }}>
                  AUTOCRAT ENGINEERS<br />
                  21&amp;22, PHASE 1, EPIP<br />
                  WHITEFIELD, BANGALORE 560066
                </TD>
              </tr>

              {/* Blank Row between 1 and 2 */}
              <tr style={{ height: "66px" }}>
                <TD style={{ padding: "0" }}></TD>
                <TD style={{ padding: "0" }}></TD>
                <TD style={{ padding: "0" }}></TD>
              </tr>

              {/* 2 */}
              <tr style={{ height: "64px" }}>
                <TD style={{ textAlign: "left", verticalAlign: "top", padding: "6px 8px" }}>2.</TD>
                <TD style={{ verticalAlign: "top", padding: "6px 8px" }}>Name and address of the Employer</TD>
                <TD style={{ verticalAlign: "top", padding: "6px 8px", fontWeight: "bold" }}>
                  AUTOCRAT ENGINEERS<br />
                  21&amp;22, PHASE 1, EPIP<br />
                  WHITEFIELD, BANGALORE 560066
                </TD>
              </tr>

              {/* 3 */}
              <tr style={{ height: "38px" }}>
                <TD style={{ textAlign: "left", verticalAlign: "middle", padding: "5px 8px" }}>3.</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px" }}>Name of the Employee</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px", textTransform: "uppercase" }}>
                  {cp.name || ""}
                </TD>
              </tr>

              {/* 4 */}
              <tr style={{ height: "112px" }}>
                <TD style={{ textAlign: "left", verticalAlign: "top", padding: "8px 8px" }}>4.</TD>
                <TD style={{ verticalAlign: "top", padding: "8px 8px" }}>His / Her Postal Address</TD>
                <TD style={{ verticalAlign: "top", padding: "8px 8px", textTransform: "uppercase" }}>
                  {cp.correspondence_address || ""}
                </TD>
              </tr>

              {/* 5 */}
              <tr style={{ height: "112px" }}>
                <TD style={{ textAlign: "left", verticalAlign: "top", padding: "8px 8px" }}>5.</TD>
                <TD style={{ verticalAlign: "top", padding: "8px 8px" }}>His / her Permanent Address</TD>
                <TD style={{ verticalAlign: "top", padding: "8px 8px", textTransform: "uppercase" }}>
                  {cp.permanent_address || ""}
                </TD>
              </tr>

              {/* 6 */}
              <tr style={{ height: "38px" }}>
                <TD style={{ textAlign: "left", verticalAlign: "middle", padding: "5px 8px" }}>6.</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px" }}>Father's / Husband's Name</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px", textTransform: "uppercase" }}>
                  {father.name || spouse.name || ""}
                </TD>
              </tr>

              {/* 7 */}
              <tr style={{ height: "38px" }}>
                <TD style={{ textAlign: "left", verticalAlign: "middle", padding: "5px 8px" }}>7.</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px" }}>Date of Birth / Age</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px" }}>
                  {formatDMY(cp.date_of_birth)}
                </TD>
              </tr>

              {/* 8 */}
              <tr style={{ height: "38px" }}>
                <TD style={{ textAlign: "left", verticalAlign: "middle", padding: "5px 8px" }}>8.</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px" }}>Date of His / Her entry into employment</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px" }}>
                  {formatDMY(hr.date_of_joining)}
                </TD>
              </tr>

              {/* 9 */}
              <tr style={{ height: "38px" }}>
                <TD style={{ textAlign: "left", verticalAlign: "middle", padding: "5px 8px" }}>9.</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px" }}>Designation</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px", textTransform: "uppercase" }}>
                  {cp.designation || hr.designation || ""}
                </TD>
              </tr>

              {/* 10 */}
              <tr style={{ height: "38px" }}>
                <TD style={{ textAlign: "left", verticalAlign: "middle", padding: "5px 8px" }}>10.</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px" }}>Nature of work entrusted to him</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px" }}></TD>
              </tr>

              {/* 11 */}
              <tr style={{ height: "38px" }}>
                <TD style={{ textAlign: "left", verticalAlign: "middle", padding: "5px 8px" }}>11.</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px" }}>His / Her serial number in the Register of Employment</TD>
                <TD style={{ verticalAlign: "middle", padding: "5px 8px" }}>{hr.ticket_no || ""}</TD>
              </tr>

              {/* 12 */}
              <tr>
                <TD style={{ textAlign: "left", verticalAlign: "top", padding: "5px 8px" }}>12.</TD>
                <TD style={{ verticalAlign: "top", padding: "5px 8px" }}>
                  Rates of Wages payable to him / her as on 7<sup>th</sup> of every month
                </TD>
                <TD style={{ padding: 0, verticalAlign: "middle" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #000", height: "25px" }}>
                        <td style={{ width: "35%", padding: "3px 6px", borderRight: "1px solid #000" }}>a)&nbsp;&nbsp;Basic</td>
                        <td style={{ padding: "3px 6px" }}>:&nbsp;&nbsp;{hr.basic ? `₹ ${hr.basic}` : ""}</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #000", height: "25px" }}>
                        <td style={{ width: "35%", padding: "3px 6px", borderRight: "1px solid #000" }}>b)&nbsp;&nbsp;HRA</td>
                        <td style={{ padding: "3px 6px" }}>:&nbsp;&nbsp;{hr.hra ? `₹ ${hr.hra}` : ""}</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #000", height: "25px" }}>
                        <td style={{ width: "35%", padding: "3px 6px", borderRight: "1px solid #000" }}>c)&nbsp;&nbsp;Conveyance</td>
                        <td style={{ padding: "3px 6px" }}>:&nbsp;&nbsp;{hr.conveyance ? `₹ ${hr.conveyance}` : ""}</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #000", height: "25px" }}>
                        <td style={{ width: "35%", padding: "3px 6px", borderRight: "1px solid #000" }}>d)&nbsp;&nbsp;Medical Allow</td>
                        <td style={{ padding: "3px 6px" }}>:&nbsp;&nbsp;{hr.medical_allow ? `₹ ${hr.medical_allow}` : ""}</td>
                      </tr>
                      <tr style={{ height: "25px" }}>
                        <td style={{ width: "35%", padding: "3px 6px", borderRight: "1px solid #000", fontWeight: "bold" }}>TOTAL</td>
                        <td style={{ padding: "3px 6px", fontWeight: "bold" }}>:&nbsp;&nbsp;{totalWages ? `₹ ${totalWages.toFixed(0)}` : ""}</td>
                      </tr>
                    </tbody>
                  </table>
                </TD>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Signature Section pushed right to the end of the page */}
        <div style={{ marginTop: "auto", paddingTop: "20px", fontSize: "11px", lineHeight: "1.6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ width: "26%" }}>
              <div>Place: Bangalore</div>
            </div>
            <div style={{ width: "36%" }}>
              <div>Accepted by</div>
            </div>
            <div style={{ width: "36%", textAlign: "right" }}>
              <div>Signature of Employer</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "22px" }}>
            <div style={{ width: "26%" }}>
              <div>Date:</div>
            </div>
            <div style={{ width: "36%" }}>
              <span style={{ backgroundColor: "#ffff00", color: "#000", fontWeight: "bold", padding: "1px 3px", lineHeight: "1.3", display: "inline-block" }}>
                Signature of the<br />Employee
              </span>
            </div>
            <div style={{ width: "36%" }}></div>
          </div>
        </div>
      </div>
      {/* ══════════════════════════════════════════════════════════════════
          PAGE 5 — FORM F (GRATUITY NOMINATION — PAGE 1)
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{
        ...pageStyle,
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: "11px",
        paddingTop: "8mm",
        paddingBottom: "8mm",
        paddingLeft: "10mm",
        paddingRight: "10mm",
      }}>
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

          {/* ── Header ── */}
          <div style={{ textAlign: "center", marginBottom: "14px" }}>
            <div style={{ fontSize: "13px", fontWeight: "bold", textDecoration: "underline", fontFamily: "'Times New Roman', Times, serif" }}>
              The Karnataka Payment of Gratuity Rules, 1973:
            </div>
            <div style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "1.5px", fontFamily: "'Times New Roman', Times, serif", marginTop: "2px" }}>
              FORM – 'F'
            </div>
            <div style={{ fontSize: "11px", fontStyle: "italic", fontFamily: "'Times New Roman', Times, serif", marginTop: "2px" }}>
              [See sub-Rule (1) of Rule 6]
            </div>
            <div style={{ fontSize: "13px", fontWeight: "bold", fontFamily: "'Times New Roman', Times, serif", marginTop: "4px" }}>
              Nomination
            </div>
          </div>

          {/* ── "To" block ── */}
          <div style={{ fontSize: "11px", fontFamily: "'Times New Roman', Times, serif", lineHeight: "1.7", marginBottom: "16px" }}>
            <div>To</div>
          </div>

          {/* ── Body paragraphs ── */}
          <div style={{ fontSize: "12px", fontFamily: "'Times New Roman', Times, serif", lineHeight: "2.0", textAlign: "justify", marginBottom: "14px" }}>
            <p style={{ margin: "0 0 12px 0" }}>
              I&nbsp;
              <span style={{ borderBottom: "1px solid #000", minWidth: "160px", display: "inline-block", verticalAlign: "bottom", paddingBottom: "1px" }}>
                {(cp.name || "").toUpperCase()}
              </span>
              &nbsp;whose particulars are given in the statement below,
              hereby nominate the person(s) mentioned below to receive the gratuity payable after my death
              as also the gratuity standing to my credit in the event of my death before that amount has
              become payable, or having become payable has not been paid and direct that the said amount of
              gratuity shall be paid in proportion indicated against the name(s) of the nominee(s).
            </p>
            <p style={{ margin: "0 0 12px 0" }}>
              2. I hereby certify that the person(s) mentioned is a /are member(s) of my family within the
              meaning g of clause (h) of Section 2 of the Payment of Gratuity Act, 1972.
            </p>
            <p style={{ margin: "0 0 12px 0" }}>
              3. I hereby declare that I have no family within the meaning of clause (h) of Section 2 of the said Act.
            </p>
            <p style={{ margin: "0 0 12px 0" }}>
              4. (a) My father/mother/parents is/are not dependent on me<br />
              &nbsp;&nbsp;&nbsp;&nbsp;(b) My husband's father/mother/parents is/are not dependent on my husband.
            </p>
            <p style={{ margin: "0 0 12px 0" }}>
              5. I have excluded my husband from my family by a notice dated the …………… to the
              Controlling Authority in terms of the proviso to clause (h) of Section 2 of the said Act.
            </p>
            <p style={{ margin: "0 0 6px 0" }}>
              6. Nomination made herein invalidates my previous nomination.
            </p>
          </div>

          {/* ── NOMINEE(S) heading ── */}
          <div style={{
            textAlign: "center",
            fontWeight: "bold",
            fontSize: "12px",
            fontFamily: "'Times New Roman', Times, serif",
            margin: "10px 0 6px 0"
          }}>
            NOMINEE(S)
          </div>

          {/* ── NOMINEE(S) table ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontFamily: "'Times New Roman', Times, serif", fontSize: "12px" }}>
            <thead>
              {/* Label header row */}
              <tr>
                <th style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center", fontWeight: "bold", width: "8%", verticalAlign: "middle" }}>
                  Sl No
                </th>
                <th style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "center", fontWeight: "bold", width: "38%", verticalAlign: "middle" }}>
                  Name in full with full address of<br />nominee(s):
                </th>
                <th style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center", fontWeight: "bold", width: "18%", verticalAlign: "middle" }}>
                  Relationship<br />with the<br />employee
                </th>
                <th style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center", fontWeight: "bold", width: "14%", verticalAlign: "middle" }}>
                  Age of<br />nominee
                </th>
                <th style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center", fontWeight: "bold", width: "22%", verticalAlign: "middle" }}>
                  Proportion by<br />which the<br />gratuity will<br />be shared
                </th>
              </tr>
              {/* Column-number sub-header row */}
              <tr style={{ background: "#f5f5f5" }}>
                <th style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "center", fontWeight: "bold", fontSize: "11px" }}>1</th>
                <th style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "center", fontWeight: "bold", fontSize: "11px" }}>2</th>
                <th style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "center", fontWeight: "bold", fontSize: "11px" }}>4</th>
                <th style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "center", fontWeight: "bold", fontSize: "11px" }}>5</th>
                <th style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "center", fontWeight: "bold", fontSize: "11px" }}>6</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "1.", person: father },
                { label: "2.", person: mother },
              ].map(({ label, person: m }) => (
                <tr key={label}>
                  <td style={{ border: "1px solid #000", padding: "8px 4px", textAlign: "center", fontWeight: "bold", height: "155px", verticalAlign: "top", fontFamily: "'Times New Roman', Times, serif" }}>
                    {label}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "8px 10px", height: "155px", verticalAlign: "top", fontFamily: "'Times New Roman', Times, serif" }}>
                    {m.name ? <span style={{ fontWeight: "bold" }}>{m.name.toUpperCase()}</span> : ""}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "8px 4px", textAlign: "center", height: "155px", verticalAlign: "top", fontFamily: "'Times New Roman', Times, serif" }}>
                    {m.relation || ""}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "8px 4px", textAlign: "center", height: "155px", verticalAlign: "top" }}></td>
                  <td style={{ border: "1px solid #000", padding: "8px 4px", textAlign: "center", height: "155px", verticalAlign: "top" }}></td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PAGE 6 — FORM F (GRATUITY — STATEMENT & WITNESS)
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{
        ...lastPageStyle,
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: "12px",
        paddingTop: "8mm",
        paddingBottom: "8mm",
        paddingLeft: "10mm",
        paddingRight: "10mm",
      }}>
        <div style={{ display: "flex", flexDirection: "column" }}>

          {/* ── Statement heading ── */}
          <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "12px", marginTop: "40px", marginBottom: "2px", fontFamily: "'Times New Roman', Times, serif" }}>
            Statement
          </div>

          {/* ── Statement table ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: "12px", fontFamily: "'Times New Roman', Times, serif" }}>
            <tbody>
              {[
                ["1. Name of employee in full:", (cp.name || "").toUpperCase()],
                ["2. Sex:", (cp.gender || "").replace(/\b\w/g, c => c.toUpperCase())],
                ["3. Religion:", gv(hr.religion || (cp.declaration || {}).religion)],
                ["4. Whether unmarried/married/widow/widower:", (cp.marital_status || "").replace(/\b\w/g, c => c.toUpperCase())],
                ["5. Department/Branch/Section where employed:", gv(app.department)],
                ["6. Post held with Ticket No. or Serial No. if any:", gv(hr.ticket_no || (cp.declaration || {}).ticket_no)],
                ["7. Date of appointment:", formatDMY(hr.date_of_joining)],
              ].map(([label, val]) => (
                <tr key={label} style={{ borderBottom: "1px solid #000", height: "35px" }}>
                  <td style={{ border: "1px solid #000", padding: "4px 6px", width: "52%", fontFamily: "'Times New Roman', Times, serif" }}>{label}</td>
                  <td style={{ border: "1px solid #000", padding: "4px 6px", fontFamily: "'Times New Roman', Times, serif", fontWeight: "normal" }}>
                    {val}
                  </td>
                </tr>
              ))}
              {/* Row 8 — Permanent address with taller cell */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "4px 6px", verticalAlign: "top", height: "70px", fontFamily: "'Times New Roman', Times, serif" }}>
                  8. Permanent address:
                </td>
                <td style={{ border: "1px solid #000", padding: "4px 6px", height: "70px", verticalAlign: "top", fontFamily: "'Times New Roman', Times, serif" }}>
                  {cp.permanent_address || ""}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Village / Place / Date–Signature block ── */}
          <div style={{ fontSize: "12px", fontFamily: "'Times New Roman', Times, serif", marginTop: "15px", lineHeight: "2.0" }}>
            <div>Village Thana Sub-Division Post Office District State</div>
            <div>Place:</div>
          </div>

          <div style={{ fontSize: "12px", fontFamily: "'Times New Roman', Times, serif", marginTop: "50px" }}>
            Date: Signature/Thumb impression of the employee
          </div>

          {/* ── Declaration by witnesses ── */}
          <div style={{ textAlign: "center", marginTop: "55px", fontFamily: "'Times New Roman', Times, serif" }}>
            <div style={{ fontWeight: "bold", fontSize: "12px" }}>Declaration by witnesses</div>
            <div style={{ fontSize: "12px", marginTop: "2px" }}>Nomination signed/thumb impressed before me:</div>
          </div>

          {/* ── Witnesses two-column layout ── */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px", marginBottom: "50px", fontSize: "12px", fontFamily: "'Times New Roman', Times, serif" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "normal", marginBottom: "25px" }}>Name in full and full address Of witnesses:</div>
              {/* Witness 1 */}
              <div style={{ marginBottom: "50px" }}>1.</div>

              {/* Witness 2 */}
              <div style={{ marginBottom: "50px" }}>2.</div>

            </div>
            <div style={{ width: "38%", textAlign: "left", paddingLeft: "30px" }}>
              <div style={{ fontWeight: "normal", marginBottom: "16px" }}>Signature of witnesses:</div>
            </div>
          </div>

          {/* ── Place & Date at bottom ── */}
          <div style={{ marginTop: "20px", fontSize: "12px", fontFamily: "'Times New Roman', Times, serif", lineHeight: "2.0" }}>
            <div>Place:</div>
            <div>Date:</div>
          </div>

        </div>
      </div>
    </div >
  );
}

