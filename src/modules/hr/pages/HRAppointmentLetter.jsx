import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HRSidebar from "../components/layout/HRSidebar";
import HRTopbar from "../components/layout/HRTopbar";
import API, { FILE_BASE_URL } from "../../../api";
import {
  User, Search, Printer, ChevronLeft, ChevronRight, ScrollText, CheckCircle, Save, Edit2
} from "lucide-react";
import html2canvas from "html2canvas";

// ─── Helper Utilities ────────────────────────────────────────────────────────
const TOTAL_PAGES = 5;
const PAGES_BUILT = 5; // all five appointment-letter pages are implemented

const gv = (val, fallback = "") => (val === null || val === undefined || val === "") ? fallback : val;

const formatDMY = (dateStr) => {
  if (!dateStr) return "";
  const parts = String(dateStr).trim().split("-");
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return `${parts[0]}-${parts[1]}-${parts[2]}`;
  }
  return dateStr;
};

const getFirstName = (fullName) => {
  if (!fullName) return "«First_Name»";
  const clean = fullName.trim().replace(/^(mr|mrs|ms|dr)\.?\s+/i, "");
  const parts = clean.split(/\s+/);
  return parts[0] || fullName;
};

const numberToWords = (num) => {
  if (!num || isNaN(num)) return "«Words»";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  };
  return convert(parseInt(num)).trim();
};

// ─── Annexure I (page 4) salary fields — monthly amounts entered by HR ───────
const SALARY_FIELDS = [
  { key: "basic", label: "Basic", group: "earn" },
  { key: "hra", label: "HRA", group: "earn" },
  { key: "conveyance", label: "Conveyance Allowance", group: "earn" },
  { key: "medical", label: "Medical Allowance", group: "earn" },
  { key: "special", label: "Special Allowance", group: "earn" },
  { key: "pf_employee", label: "PF-Employee Contribution", group: "ded" },
  { key: "esi_employee", label: "ESI-Employee Contribution", group: "ded" },
  { key: "professional_tax", label: "Professional Tax", group: "ded" },
  { key: "pf_employer", label: "PF-Employer Contribution", group: "other" },
  { key: "esi_employer", label: "ESI-Employer Contribution", group: "other" },
  { key: "leave_wages", label: "Leave Wages (2 per month)", group: "other" },
  { key: "canteen", label: "Canteen", group: "other" },
  { key: "bonus", label: "Bonus(8.33%)", group: "other" },
  { key: "gratuity", label: "Gratuity", group: "other" },
];

const emptySalary = () => SALARY_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {});

const parseNum = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
};

const fmtMoney = (v) =>
  v === null || v === undefined ? "" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function HRAppointmentLetter() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState(null);

  // HR Appointment Fields state
  const [hrFields, setHrFields] = useState({
    date_of_joining: "",
    cost_to_company: "",
    location: "",
    salary: emptySalary(), // page 4 (Annexure I) monthly amounts — blank for now, backend later
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await API.get("/hr/applications", { params: { status: "Onboarding" } });
        if (Array.isArray(res.data) && res.data.length > 0) {
          setApplications(res.data);
        } else {
          const allRes = await API.get("/hr/applications");
          setApplications(allRes.data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelect = (app) => {
    setSelectedApp(app);
    const cp = app.candidate_profile || {};
    const decl = cp.declaration || {};

    // Get DOJ from HR Administration fields
    const dojVal = cp.date_of_joining || decl.date_of_joining || app.date_of_joining || "";

    // Get CTC from declaration.cost_to_company or ctc_annual or wages sum
    let ctcVal = decl.cost_to_company || decl.ctc_annual || decl.appt_ctc_annual || "";
    if (!ctcVal) {
      const totalWages = [decl.basic, decl.hra, decl.conveyance, decl.medical_allow]
        .map(v => parseFloat(v) || 0)
        .reduce((a, b) => a + b, 0);
      if (totalWages > 0) {
        ctcVal = String(totalWages * 12);
      }
    }

    setHrFields({
      date_of_joining: dojVal,
      cost_to_company: ctcVal,
      location: decl.location || "",
      salary: decl.salary || emptySalary(),
    });
    setSaveStatus("");
  };

  const handleSave = async () => {
    if (!selectedApp?.user_id) return;
    setIsSaving(true);
    setSaveStatus("Saving...");
    try {
      const cp = selectedApp.candidate_profile || {};
      const decl = cp.declaration || {};
      const updatedDecl = {
        ...decl,
        cost_to_company: hrFields.cost_to_company,
        ctc_annual: hrFields.cost_to_company,
        location: hrFields.location || "",
        salary: hrFields.salary || emptySalary(),
      };

      await API.put(`/candidate/profile/${selectedApp.user_id}`, {
        ...cp,
        date_of_joining: hrFields.date_of_joining,
        declaration: updatedDecl,
      });

      const updatedCp = {
        ...cp,
        date_of_joining: hrFields.date_of_joining,
        declaration: updatedDecl,
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
    } catch (e) {
      console.error(e);
      setSaveStatus("Failed to save");
      setTimeout(() => setSaveStatus(""), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = "";
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const filtered = applications.filter(app => {
    const name = app.candidate_profile?.name || "";
    const email = app.candidate_profile?.email || "";
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
  });

  const handlePrevCandidate = () => {
    if (!selectedApp || filtered.length === 0) return;
    const index = filtered.findIndex(app => app.id === selectedApp.id);
    if (index > 0) handleSelect(filtered[index - 1]);
  };

  const handleNextCandidate = () => {
    if (!selectedApp || filtered.length === 0) return;
    const index = filtered.findIndex(app => app.id === selectedApp.id);
    if (index !== -1 && index < filtered.length - 1) handleSelect(filtered[index + 1]);
  };

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen text-gray-800 dark:text-gray-100">
      <HRSidebar />

      <div className="flex-1 flex flex-col min-w-0 print:hidden">
        <HRTopbar />
        <div className="p-6 max-w-7xl mx-auto w-full flex-1 flex flex-col">

          {/* Search Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 mb-5 shadow-sm flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 shrink-0">
              <CheckCircle className="text-emerald-500 w-4 h-4" />
              {applications.length} candidates available
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
              <h3 className="font-bold text-gray-900 dark:text-white">No candidates found</h3>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 max-w-xs">Move applications to "Onboarding" status to generate appointment letters.</p>
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
                    <div
                      key={app.id}
                      onClick={() => handleSelect(app)}
                      className={`p-4 rounded-xl border cursor-pointer flex items-center gap-3 bg-white dark:bg-gray-800 shadow-sm transition ${isSelected
                        ? "border-blue-600 ring-2 ring-blue-50 dark:ring-blue-950/30"
                        : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                        }`}
                    >
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

              {/* Right: Appointment Letter View & HR Controls */}
              {selectedApp ? (
                <div className="lg:col-span-2 space-y-4">
                  {/* Actions bar */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex justify-between items-center rounded-xl">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handlePrevCandidate}
                        disabled={filtered.findIndex(app => app.id === selectedApp.id) <= 0}
                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition"
                        title="Previous Candidate"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                      </button>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{selectedApp.candidate_profile?.name || "Candidate"}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{selectedApp.job_title || selectedApp.department || "Onboarding"}</p>
                      </div>
                      <button
                        onClick={handleNextCandidate}
                        disabled={filtered.findIndex(app => app.id === selectedApp.id) >= filtered.length - 1}
                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition"
                        title="Next Candidate"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                      </button>
                    </div>
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-100 transition"
                    >
                      <Printer className="w-4 h-4" /> Print Appointment Letter
                    </button>
                  </div>

                  {/* HR Appointment Fields Panel */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
                      <div className="flex items-center gap-2">
                        <Edit2 className="w-4 h-4 text-blue-600" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 dark:text-gray-200">
                          HR Appointment Fields
                        </h4>
                      </div>
                      {saveStatus && (
                        <span className={`text-xs font-bold ${saveStatus === "Saved!" ? "text-emerald-600" : "text-red-500"}`}>
                          {saveStatus}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Date of Joining */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                          Date of Joining (DOJ)
                        </label>
                        <input
                          type="text"
                          placeholder="DD-MM-YYYY"
                          value={hrFields.date_of_joining || ""}
                          onChange={e => setHrFields(prev => ({ ...prev, date_of_joining: e.target.value }))}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">Applies everywhere Date of Joining is mentioned</p>
                      </div>

                      {/* Yearly CTC */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                          Cost to Company (Yearly CTC in ₹)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 350000 or 3,50,000"
                          value={hrFields.cost_to_company || ""}
                          onChange={e => setHrFields(prev => ({ ...prev, cost_to_company: e.target.value }))}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">Populates in Cost_to_Company2 &amp; converts to Words</p>
                      </div>
                    </div>

                    {/* Annexure I — Salary structure (page 4) */}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <h5 className="font-bold text-[11px] uppercase tracking-wider text-gray-800 dark:text-gray-200 mb-1">
                        Annexure I — Salary Structure (Page 4)
                      </h5>
                      <p className="text-[10px] text-gray-400 mb-3">
                        Enter monthly amounts in ₹. Per Annum, Gross Salary, Total Deductions, Net Salary and Cost to Company are calculated automatically.
                      </p>

                      <div className="mb-3 max-w-xs">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                          Location
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Whitefield"
                          value={hrFields.location || ""}
                          onChange={e => setHrFields(prev => ({ ...prev, location: e.target.value }))}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {SALARY_FIELDS.map(f => (
                          <div key={f.key}>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                              {f.label}
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Per month"
                              value={hrFields.salary?.[f.key] || ""}
                              onChange={e =>
                                setHrFields(prev => ({
                                  ...prev,
                                  salary: { ...(prev.salary || emptySalary()), [f.key]: e.target.value },
                                }))
                              }
                              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg text-xs transition disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? "Saving..." : "Save Details"}
                      </button>
                    </div>
                  </div>

                  {/* Letter Preview */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                    <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider mb-3">
                      Appointment Letter Preview (Pages 1–{PAGES_BUILT} of {TOTAL_PAGES})
                    </p>
                    <div className="border border-gray-100 dark:border-gray-700 rounded-lg bg-gray-200 dark:bg-gray-900 p-4 max-h-[85vh] overflow-auto shadow-inner">
                      <div style={{ width: "210mm", margin: "0 auto" }}>
                        <AppointmentLetterHtml
                          cp={selectedApp.candidate_profile || {}}
                          app={selectedApp}
                          hrFields={hrFields}
                          preview
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                  <ScrollText className="w-10 h-10 text-blue-100 dark:text-blue-900 mb-3" />
                  <h3 className="font-bold text-gray-800 dark:text-white">Select a Candidate</h3>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 max-w-xs">Click any candidate on the left to preview and print their appointment letter.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PRINTABLE AREA — visible only during window.print() */}
      {selectedApp && (
        <>
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 0 !important;
              }
              html, body, #root, main, .print-area-container {
                overflow: visible !important;
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                position: static !important;
                background: #fff !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body * {
                visibility: hidden !important;
              }
              .print-area, .print-area * {
                visibility: visible !important;
                color: #000000 !important;
                -webkit-text-stroke: 0.18px #000000 !important;
                text-stroke: 0.18px #000000 !important;
              }
              .print-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: auto !important;
                max-height: none !important;
                display: block !important;
                overflow: visible !important;
                background: #fff !important;
                padding: 0 !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print-area > div {
                width: 210mm !important;
                height: auto !important;
                max-height: none !important;
                margin: 0 !important;
                box-sizing: border-box !important;
              }
              /* Each letter page prints on its own A4 sheet */
              .letter-page {
                break-after: page !important;
                page-break-after: always !important;
                break-inside: avoid !important;
                margin: 0 !important;
                box-shadow: none !important;
              }
              .letter-page:last-child {
                break-after: auto !important;
                page-break-after: auto !important;
              }
            }
          `}</style>
          <div className="hidden print:block print-area print-area-container bg-white text-black">
            <AppointmentLetterHtml
              cp={selectedApp.candidate_profile || {}}
              app={selectedApp}
              hrFields={hrFields}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// APPOINTMENT LETTER — SHARED PIECES
// ═════════════════════════════════════════════════════════════════════════════

// Footer used on every page: double maroon rule + company name + page number
function PageFooter({ page, total = TOTAL_PAGES }) {
  return (
    <div style={{ marginTop: "16px" }}>
      {/* Full bold border */}
      <div style={{ height: "4.5px", backgroundColor: "#7a1c1c", width: "100%", marginBottom: "1.5px" }} />
      {/* One thin 1px border next to it (real CSS border so it never disappears at any zoom / in print) */}
      <div style={{ height: 0, borderTop: "1px solid #7a1c1c", width: "100%", marginBottom: "5px", boxSizing: "content-box" }} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "15px",
          fontWeight: "normal",
          fontFamily: '"Times New Roman", Times, serif',
          color: "#000000",
          letterSpacing: "0.3px",
        }}
      >
        <span>AUTOCRAT ENGINEERS</span>
        <span>Page {page} of {total}</span>
      </div>
    </div>
  );
}

// Base A4 page style shared by all pages (pages override font / padding as needed)
const basePageStyle = {
  width: "210mm",
  height: "297mm",
  maxHeight: "297mm",
  boxSizing: "border-box",
  color: "#000000",
  fontWeight: "500",
  background: "#fff",
  overflow: "hidden",
  pageBreakAfter: "avoid",
  breakAfter: "avoid",
  WebkitFontSmoothing: "antialiased",
  WebkitTextStroke: "0.15px #000000",
};

// ─── PAGE 1 OF 5 ─────────────────────────────────────────────────────────────
function AppointmentLetterPage1({ cp = {}, app = {}, hrFields = {} }) {
  const decl = cp.declaration || {};

  // 1) Candidate Name
  const candidateName = cp.name || "Name";

  // 2) Candidate Permanent Address
  const candidateAddress = cp.permanent_address || cp.correspondence_address || "Address";

  // 3) First Name for "Dear First_Name,"
  const firstName = getFirstName(cp.name);

  // 4) Designation from HR administration fields (or application job title)
  const designation = cp.designation || app.job_title || "Designation";

  // 5) Date of Joining from HR Administration fields / HR input
  const rawDoj = hrFields.date_of_joining || cp.date_of_joining || decl.date_of_joining || app.date_of_joining || "";
  const displayDOJ = rawDoj ? formatDMY(rawDoj) : "DOJ";

  // Terms and figures
  const probationMonths = decl.probation_period || "Probation";

  // Cost to Company (CTC) from HR Appointment Fields
  const rawCtc = hrFields.cost_to_company || decl.cost_to_company || decl.ctc_annual || decl.appt_ctc_annual || "";
  const numericCtc = parseFloat(String(rawCtc).replace(/[^0-9.]/g, ""));

  let costToCompanyDisplay = "Cost_to_Company2";
  let costInWords = "Words";

  if (rawCtc) {
    if (!isNaN(numericCtc) && numericCtc > 0) {
      costToCompanyDisplay = String(rawCtc).includes(",")
        ? String(rawCtc).replace(/^Rs\.?\s*/i, "").trim()
        : numericCtc.toLocaleString("en-IN");
      costInWords = numberToWords(numericCtc);
    } else {
      costToCompanyDisplay = String(rawCtc).trim();
    }
  }

  const pageStyle = {
    ...basePageStyle,
    fontFamily: '"Times New Roman", Times, serif',
    fontSize: "15px",
    lineHeight: "1.44",
    // Top padding leaves space for company letterhead (logo + company name)
    // Matched to reference letterhead template (~17% of A4 ≈ 50mm)
    paddingTop: "50mm",
    paddingBottom: "14mm",
    paddingLeft: "26.5mm",
    paddingRight: "26.5mm",
  };

  return (
    <div style={{ fontFamily: '"Times New Roman", Times, serif', color: "#000000" }}>
      <div style={pageStyle}>
        {/* Top Right Date */}
        <div style={{ textAlign: "right", marginBottom: "14px", fontSize: "13.6px", color: "#000000", fontWeight: "500" }}>
          Date:{displayDOJ}
        </div>

        {/* Addressee */}
        <div style={{ marginBottom: "14px", fontSize: "13.6px", lineHeight: "1.45", color: "#000000" }}>
          <div>Mr. {candidateName}</div>
          <div style={{ whiteSpace: "pre-line" }}>{candidateAddress}</div>
        </div>

        {/* Salutation */}
        <div style={{ marginBottom: "18px", fontSize: "13.6px", color: "#000000" }}>
          Dear {firstName},
        </div>

        {/* Subject Line */}
        <div style={{ textAlign: "center", fontWeight: "bold", textDecoration: "underline", fontSize: "15px", letterSpacing: "0.5px", marginBottom: "18px", color: "#000000" }}>
          SUB: APPOINTMENT LETTER
        </div>

        {/* Introductory Paragraph */}
        <div style={{ textAlign: "justify", marginBottom: "14px", fontSize: "15.5px", lineHeight: "1.4", color: "#000000" }}>
          With reference to your application for employment and subsequent interviews you had with us, you are offered an appointment in our establishment on the following terms and conditions with effect from Date-{displayDOJ}.
        </div>

        {/* Designation Line */}
        <div style={{ marginBottom: "14px", fontSize: "15.5px", color: "#000000" }}>
          You will be designated as &ldquo;<strong>{designation}</strong>&rdquo;
        </div>

        {/* Terms & Conditions (Points 1 to 6) */}
        <div style={{ fontSize: "15.5px", lineHeight: "1.3", color: "#000000" }}>
          {/* 1 */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px", fontSize: "15.5px", textAlign: "justify" }}>
            <div style={{ minWidth: "18px", flexShrink: 0 }}>1.</div>
            <div>Your joining date shall be on {displayDOJ}.</div>
          </div>

          {/* 2 */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px", fontSize: "15.5px", textAlign: "justify" }}>
            <div style={{ minWidth: "18px", flexShrink: 0 }}>2.</div>
            <div>
              <strong>Duties and Responsibilities:</strong> Your duties will be as specified by the Management and your designation, business title and reporting relationship may undergo change from time to time as may be determined by the Management. You will promote the Company&apos;s interests at all times and carry out such other duties as may be assigned to you, consistent with your status and position in the Company.
            </div>
          </div>

          {/* 3 */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px", fontSize: "15.5px", textAlign: "justify" }}>
            <div style={{ minWidth: "18px", flexShrink: 0 }}>3.</div>
            <div>
              You will be on probation for a period of «{probationMonths}» months from the date of your joining. Your probationary period may be extended at the discretion of the Management which will also be communicated to you in writing. On the satisfactory completion to your period of probation and/ or any extended period thereafter, you may be confirmed in writing by the Management. If you are not confirmed in writing, you will be deemed to be continued on probation. During the period of probation or at the end of it, your services may be terminated without notice or compensation and without assigning any reason thereto.
            </div>
          </div>

          {/* 4 */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px", fontSize: "15.5px", textAlign: "justify" }}>
            <div style={{ minWidth: "18px", flexShrink: 0 }}>4.</div>
            <div>
              Your yearly CTC (Cost to Company) will be <strong>Rs.{costToCompanyDisplay}</strong> (Rupees<br />{costInWords} only)
            </div>
          </div>

          {/* 5 */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px", fontSize: "15.5px", textAlign: "justify" }}>
            <div style={{ minWidth: "18px", flexShrink: 0 }}>5.</div>
            <div>
              You will not be entitled to any other benefits in cash or kind. On being confirmed, you will be given such benefits or allowances as the Management may decide at its sole discretion from time to time. Your annual increment will be subject to our entire satisfaction of your overall performance including work, conduct and attendance.
            </div>
          </div>

          {/* 6 */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "0px", fontSize: "15.5px", textAlign: "justify" }}>
            <div style={{ minWidth: "18px", flexShrink: 0 }}>6.</div>
            <div>
              Your services may, on being confirmed, be terminated by either party with three month&apos;s notice or salary in lieu thereof or you may be dismissed by the Company without notice or compensation for an act of misconduct or if your overall performance is not satisfactory.
            </div>
          </div>
        </div>

        {/* Footer directly below point 6 */}
        <PageFooter page={1} />
      </div>
    </div>
  );
}

// ─── PAGE 2 OF 5 (points 7 to 14) ────────────────────────────────────────────
function AppointmentLetterPage2() {
  const pageStyle = {
    ...basePageStyle,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "13.4px",
    lineHeight: "1.32",
    paddingTop: "30mm",
    paddingBottom: "14mm",
    paddingLeft: "22mm",
    paddingRight: "22mm",
  };

  const points = [
    "During the period of probation or on confirmation as the case may be, you will be liable and shall accept transfer to any of the establishments sister concern / branch / from one department to another or any of the establishments units wherever be the interest of the company, in Karnataka State or anywhere in India, where the company has interest without any additional emoluments.",
    "You shall not at any time disclose to anyone any information know-how, knowledge, secrets, methods, plans, etc., of the establishment. During the period of employment with the establishment you shall not carry on any business, profession or calling of your own, but carry out your duty diligently, loyally and to the best of your capacity.",
    "During the course of your employment, until your retirement or termination, whichever is earlier, it is your responsibility to keep the Management informed of your latest postal address for purposes of communication. If you change your address without informing the Management, with due acknowledgement, the Management will not be responsible for sending any communication through news paper or other notification. Communications will be sent to the last known address given by you, by RPAD and you will face the consequences thereof.",
    "This Appointment is made on the understanding that the information given by you, in your application dated is correct, true and complete. If it is found at any time that the information given by you is not correct/ true / complete, this appointment may be withdrawn before you join service with us or your services may be terminated after you have taken up employment with us. You may also note that salary information is confidential and should not be discussed with anyone in the Company. In case your salary details are revealed to others it will lead to termination of self and the person with whom the information is being shared.",
    "If you are confirmed in a permanent post after the probation, you will retire from services on your attaining 60 years of age, unless the management at their discretion for special reasons grant extension to your services or offer re-employment subject you're being found medically fit.",
    "You are entitled for Earned leave as per the provisions of the Factories Act and Rules there under or the Shops Act and Rules there under, whichever is applicable.",
    "If for a period of eight consecutive days, you found absent yourself without permission or overstay leave, you shall be deemed to have voluntarily retired from the services within the meaning of Section-2 (00) (a) of the Industrial Disputes Act, 1947.",
    "If for reasons of shortage of power, breakdown of machinery, accumulation of stocks, or for any other reasons, there is no adequate work to be given to you, the Management reserves the right to lay you off and in case the establishment has employed less than fifty workers on an average, on any day during the last 12 months, you will not be eligible to be paid any lay-off compensation. However, in case the establishment employs more than fifty workers, provisions of Industrial Disputes Act relating to lay-off shall apply.  However, if the establishment employs more than fifty workers and your lay-off extends beyond forty-five days in a total of 12 months, periods of lay-offs above forty-five days shall be without any compensation.",
  ];

  return (
    <div style={pageStyle}>
      {/* Points 7 to 14 */}
      <div style={{ marginLeft: "6mm", marginRight: "11mm" }}>
        {points.map((text, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: i === points.length - 1 ? "0px" : "10px",
              textAlign: "justify",
            }}
          >
            <div style={{ minWidth: "22px", flexShrink: 0 }}>{i + 7}.</div>
            <div>{text}</div>
          </div>
        ))}
      </div>

      {/* Footer directly below point 14; space below stays empty */}
      <PageFooter page={2} />
    </div>
  );
}

// ─── PAGE 3 OF 5 (points 15 to 18) ───────────────────────────────────────────
function AppointmentLetterPage3() {
  const pageStyle = {
    ...basePageStyle,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "13.4px",
    lineHeight: "1.32",
    paddingTop: "27mm",
    paddingBottom: "14mm",
    paddingLeft: "22mm",
    paddingRight: "22mm",
  };

  const numStyle = { minWidth: "22px", flexShrink: 0 };
  const rowStyle = { display: "flex", gap: "8px", marginBottom: "10px", textAlign: "justify" };

  return (
    <div style={pageStyle}>
      <div style={{ marginLeft: "6mm", marginRight: "11mm" }}>
        {/* Continuation of point 14 (no number) */}
        <div style={{ paddingLeft: "30px", marginBottom: "10px", textAlign: "justify" }}>
          You shall also be at liberty to resign from the services, during the period of lay-off and management shall set off the lay-off compensation paid to you from any benefits that you may be eligible for.
        </div>

        {/* 15 */}
        <div style={rowStyle}>
          <div style={numStyle}>15.</div>
          <div>
            You shall not strike work either singly or in concert with others without giving to the management, notice of at least fifteen days in writing of your intention to strike work and before the expiry of the said notice period.  The violation of this clause apart from attracting disciplinary action shall also make you liable for deduction of wages as provided under Section 9(2) of Payment of Wages Act.
          </div>
        </div>

        {/* 16 */}
        <div style={rowStyle}>
          <div style={numStyle}>16.</div>
          <div>
            <strong>Period of Notice for Termination:</strong> Management employs you with the view that you will have a long-term career with us. However, if it becomes necessary for you to leave the employment, the contract of employment will be terminated by either party or by you, by giving a written notice. Your notice period during the probation would be 30 days, however upon confirmation; you may terminate your employment by giving 90 days of notice in writing. Taking into consideration the nature of your duty it will be absolutely necessary for you to work for the Company during the notice period unless the same is specifically waived by the Management. Upon termination of your employment, you will be immediately deliver to the company all books, laptop computers, mobile phones, documents, effects, money, securities, records, computer disks and data in soft &amp; hard copies or other property whatsoever belonging to the company or its customers which you then have or should have in passion, power or control. You shall not be entitled to any notice or pay in lieu thereof if your services are terminated for reasons of misconduct. Misconduct includes (but is not limited to) dishonesty, fraud, breach of confidentiality, pilferage and theft, attending work under the influence of alcohol, drugs or other intoxicating substances, serious breach of the rules and policy, disobedience of reasonable orders from superiors, causing actual or threatening physical harm and causing damage to Company property.
            <br />
            Full and Final Settlement payment will be paid by cheque or bank transfer between 30-45days from the last working day in the company.
          </div>
        </div>

        {/* 17 */}
        <div style={rowStyle}>
          <div style={numStyle}>17.</div>
          <div>
            <strong>Other Terms and Conditions:</strong> The terms and conditions of employment not covered by this Letter of Appointment and the Employee Non-competition, Developments and Non-Disclosure Agreement, such as usage of information technology, code of conduct and ethics, hours of work, performance reviews, increments etc. shall be as per the rules, regulations and policies applicable to employees from time to time. Your leave entitlement will be as per the policy notified by the management from time to time. Please check with HR for your leave entitlement for the current year. With the acceptance of above terms and conditions, we would request your signature on the duplicate of this order, in token of your acceptance.
          </div>
        </div>

        {/* 18 */}
        <div style={{ ...rowStyle, marginBottom: "0px" }}>
          <div style={numStyle}>18.</div>
          <div>
            Workman shall take precautions to safeguard the company&apos;s property and to prevent accident or damage or fire to it. A workman shall at once report to his superior or foreman or manager any defect, which he may notice in any machinery/ equipment connected with his work. He shall also immediately report any defect or occurrence which he may notice and which might endanger himself or any other workman/person or might result in damage to the company&apos;s or any workman&apos;s/ person&apos;s property. If any damage is caused to the Company property/ Self/ any other person, Employee can be warned or fined or cost of damage can recovered by Management. Decision will be made after review and management decision is final.
          </div>
        </div>
      </div>

      {/* Footer directly below point 18 */}
      <PageFooter page={3} />
    </div>
  );
}
// ─── PAGE 4 OF 5 (Annexure I — salary structure) ─────────────────────────────
function AppointmentLetterPage4({ cp = {}, app = {}, hrFields = {} }) {
  const decl = cp.declaration || {};
  const sal = hrFields.salary || {};

  // Header block
  const candidateName = cp.name || "Name";
  const designation = cp.designation || app.job_title || "Designation";
  const location = hrFields.location || "Location";
  const rawDoj = hrFields.date_of_joining || cp.date_of_joining || decl.date_of_joining || app.date_of_joining || "";
  const displayDOJ = rawDoj ? formatDMY(rawDoj) : "DOJ";

  // Calculations (monthly → annual = ×12)
  const val = (k) => parseNum(sal[k]);
  const sumOf = (group) => {
    const vals = SALARY_FIELDS.filter(f => f.group === group).map(f => val(f.key)).filter(v => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const grossM = sumOf("earn");
  const dedM = sumOf("ded");
  const netM = grossM !== null ? grossM - (dedM || 0) : null;

  const annualCtc = parseNum(hrFields.cost_to_company ?? decl.cost_to_company ?? decl.ctc_annual);
  const ctcM = annualCtc !== null ? annualCtc / 12 : null;
  const ctcWords = annualCtc ? numberToWords(annualCtc) : "";

  const yearly = (m) => (m === null ? null : m * 12);

  const line = (f) => ({ label: f.label, m: val(f.key), y: yearly(val(f.key)) });
  const fieldRows = (group) => SALARY_FIELDS.filter(f => f.group === group).map(line);

  const rows = [
    ...fieldRows("earn"),
    { label: "Gross Salary", m: grossM, y: yearly(grossM), bold: true },
    ...fieldRows("ded"),
    { label: "Total Deductions", m: dedM, y: yearly(dedM), bold: true },
    { label: "Net Salary", m: netM, y: yearly(netM), bold: true },
    ...fieldRows("other"),
    { label: "Cost to Company", m: ctcM, y: annualCtc, bold: true, bottomLabel: true },
  ];

  const labelFont = 'Arial, Helvetica, sans-serif';
  const valueFont = 'Cambria, "Times New Roman", Times, serif';

  const pageStyle = {
    ...basePageStyle,
    position: "relative",
    fontFamily: labelFont,
    fontSize: "13px",
    lineHeight: "1.3",
    paddingTop: "35mm",
    paddingBottom: "14mm",
    paddingLeft: "22mm",
    paddingRight: "33.5mm",
  };

  // One row ≈ 18.6px (17.6 line + 1px border), same as the reference
  const cell = {
    border: "1px solid #000",
    padding: "0 4px",
    verticalAlign: "top",
    fontFamily: labelFont,
    fontSize: "14.5px",
    lineHeight: "20px",
  };
  const valueCell = { ...cell, fontFamily: valueFont };
  const noteStyle = { fontWeight: "bold", textAlign: "justify", fontSize: "13px", lineHeight: "1.3", fontFamily: labelFont };

  return (
    <div style={pageStyle}>
      {/* Heading */}
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "13px", marginBottom: "15px" }}>
        Annexure I:
      </div>

      {/* Salary table */}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "40%" }} />
          <col style={{ width: "31%" }} />
          <col style={{ width: "29%" }} />
        </colgroup>
        <tbody>
          {/* Candidate details */}
          {[
            ["Name", candidateName],
            ["Designation", designation],
            ["Location", location],
            ["Date of Joining", displayDOJ],
          ].map(([label, value]) => (
            <tr key={label}>
              <td style={cell}>{label}</td>
              <td style={{ ...valueCell, textAlign: "center", fontWeight: "bold" }} colSpan={2}>{value}</td>
            </tr>
          ))}

          {/* Column headings */}
          <tr>
            <td style={{ ...cell, fontWeight: "bold" }}>Salary Components</td>
            <td style={{ ...cell, fontWeight: "bold", textAlign: "center" }}>Per Month (INR)</td>
            <td style={{ ...cell, fontWeight: "bold", textAlign: "center" }}>Per Annum (INR)</td>
          </tr>

          {/* Salary rows */}
          {rows.map((r) => (
            <tr key={r.label}>
              <td
                style={{
                  ...cell,
                  fontWeight: r.bold ? "bold" : "normal",
                  verticalAlign: r.bottomLabel ? "bottom" : "top",
                  height: r.bottomLabel ? "35px" : undefined,
                }}
              >
                {r.label}
              </td>
              <td style={{ ...valueCell, fontWeight: r.bold ? "bold" : "normal", textAlign: "left" }}>{fmtMoney(r.m)}</td>
              <td style={{ ...valueCell, fontWeight: r.bold ? "bold" : "normal", textAlign: "left" }}>{fmtMoney(r.y)}</td>
            </tr>
          ))}

          {/* In words */}
          <tr>
            <td style={{ ...cell, borderTop: "none" }} colSpan={3}>
              In words: {ctcWords}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Notes below the table */}
      <div style={{ marginTop: "20px", letterSpacing: "0.05em" }}>
        <div style={noteStyle}>
          Income Tax and other applicable taxes shall be deducted from the salary on monthly basis as per Government Policy. Any revision is salary is subjective to changes statutory norms.
        </div>
        <div style={noteStyle}>*Bonus is also subject to Bonus Act.</div>
        <div style={noteStyle}>*Gratuity applicable upon 5 years of continuous service, considered at 4.81%</div>
        <div style={noteStyle}>*Subsidized canteen food can be availed at Rs.30 per meal (one meal per day is allowed).</div>
        <div style={noteStyle}>*Separate salary account will be opened and salary will be processed to Axis Bank/Kotak Bank Account only</div>
      </div>

      {/* Place / Date / Signature */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: "34px",
          paddingLeft: "6mm",
          fontFamily: 'Calibri, Arial, Helvetica, sans-serif',
          fontSize: "13px",
          lineHeight: "1.2",
        }}
      >
        <div>
          <div>Place: Bangalore</div>
          <div>Date:</div>
        </div>
        <div>Signature of the Human Resource</div>
      </div>

      {/* Footer pinned near the bottom, like the reference */}
      <div style={{ position: "absolute", left: "22mm", right: "33.5mm", top: "925px" }}>
        <PageFooter page={4} />
      </div>
    </div>
  );
}
// ─── PAGE 5 OF 5 (Endorsement) ────────────────────────────────────────────────
function AppointmentLetterPage5({ cp = {}, app = {}, hrFields = {} }) {
  const pageStyle = {
    ...basePageStyle,
    position: "relative",
    fontFamily: '"Times New Roman", Times, serif',
    fontSize: "13px",
    lineHeight: "1.65",
    paddingTop: "65mm",
    paddingBottom: "14mm",
    paddingLeft: "22mm",
    paddingRight: "33.5mm",
  };

  return (
    <div style={pageStyle}>
      {/* Endorsement heading */}
      <div
        style={{
          textAlign: "center",
          fontWeight: "bold",
          textDecoration: "underline",
          fontSize: "13px",
          lineHeight: "1.2",
          marginBottom: "10px",
        }}
      >
        ENDORSEMENT
      </div>

      {/* Acceptance statement */}
      <div style={{ textAlign: "justify", marginLeft: "0", marginRight: "0" }}>
        I hereby confirm acceptance of the above appointment, on the terms and conditions stipulated therein. I undertake to confirm to the Management rules and regulations including its service rules and Code of Conduct and all other policies now in force and as may be amended or added from time to time. I Agree that the Letter of Appointment constitutes my entire agreement with the Company regarding the topics covered
      </div>

      {/* Employee acknowledgement */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: "64px",
          fontSize: "13px",
          lineHeight: "1.35",
        }}
      >
        <div>
          <div>Place:</div>
          <div style={{ marginTop: "12px" }}>Date:</div>
        </div>
        <div style={{ paddingRight: "43mm", whiteSpace: "nowrap" }}>
          Signature of the Employee
        </div>
      </div>

      {/* Footer aligned with the previous pages and pinned near the bottom */}
      <div style={{ position: "absolute", left: "22mm", right: "33.5mm", top: "925px" }}>
        <PageFooter page={5} />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// COMBINED LETTER — used by both the preview and the print area.
// To add a page: build its component above, then add it to the `pages` array.
// ═════════════════════════════════════════════════════════════════════════════
function AppointmentLetterHtml({ cp = {}, app = {}, hrFields = {}, preview = false }) {
  const pages = [
    <AppointmentLetterPage1 cp={cp} app={app} hrFields={hrFields} />,
    <AppointmentLetterPage2 />,
    <AppointmentLetterPage3 />,
    <AppointmentLetterPage4 cp={cp} app={app} hrFields={hrFields} />,
    <AppointmentLetterPage5 cp={cp} app={app} hrFields={hrFields} />,
  ];

  return (
    <div>
      {pages.map((page, i) => (
        <div
          key={i}
          className="letter-page"
          style={
            preview
              ? {
                width: "210mm",
                height: "297mm",
                background: "#fff",
                border: "1px solid #d1d5db",
                boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                marginBottom: i < pages.length - 1 ? "16px" : 0,
              }
              : { width: "210mm", height: "297mm" }
          }
        >
          {page}
        </div>
      ))}
    </div>
  );
}
