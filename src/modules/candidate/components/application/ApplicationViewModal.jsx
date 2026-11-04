import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import API, { FILE_BASE_URL, getFileUrl } from "../../../../api";

export default function ApplicationViewModal({ application, onClose }) {
  const formRef = useRef();
  const [showResumePreview, setShowResumePreview] = useState(false);

  // ─── Normalization: Handle backend (snake_case/nested) vs frontend (camelCase) ───
  const profile = application.candidate_profile || application.candidateProfile || {};

  // Resolve createdAt from snake_case (backend) or camelCase (frontend)
  const resolvedCreatedAt = application.created_at || application.createdAt || null;

  const normalizedApp = {
    ...application,
    ...profile,
    // Basic Details
    name: application.name || profile.name,
    currentAddress: application.current_address || application.currentAddress || profile.correspondence_address || profile.currentAddress,
    permanentAddress: application.permanent_address || application.permanentAddress || profile.permanent_address || profile.permanentAddress,
    mobile: application.mobile_no || application.mobile || profile.phone_number || profile.mobile,
    dob: application.date_of_birth || application.dob || profile.date_of_birth || profile.dob,
    email: application.email_id || application.email || profile.email,
    experienceStatus: application.experience_type || application.experienceStatus,
    // Job info
    jobTitle: application.job_title || application.jobTitle || null,
    // Skills (from candidate profile)
    skills: profile.skills || application.skills || null,
    // Resolved application date
    createdAt: resolvedCreatedAt,

    // Other Details (flattened from other_details if present)
    ...(application.other_details || {}),

    // Lists
    education: (application.education_snapshot || profile.education || application.education || []).map(edu => ({
      ...edu,
      yearPassing: edu.yearPassing || edu.to || edu.to_date || "",
    })),
    technicalQualifications: (application.technical_skills || profile.technical_qualifications || profile.technicalQualifications || application.technicalQualifications || []).map(tech => ({
      ...tech,
      yearPassing: tech.yearPassing || tech.to || tech.to_date || "",
    })),
    employmentHistory: (application.employment_snapshot || profile.employment || profile.employment_history || profile.employmentHistory || application.employmentHistory || []).map(emp => ({
      ...emp,
      companyName: emp.companyName || emp.organization || "",
      durationFrom: emp.durationFrom || emp.from || emp.from_date || "",
      durationTo: emp.durationTo || emp.to || emp.to_date || "",
    })),

    // Files
    photoSrc: getFileUrl(
      application.photo_path ||
      profile.photo_path ||
      application.photo ||
      profile.photo ||
      application.photoUrl ||
      profile.photoUrl ||
      null
    ) || null,
    resumeSrc: getFileUrl(
      application.resume_path ||
      profile.resume_path ||
      application.resume ||
      profile.resume ||
      application.resumeUrl ||
      profile.resumeUrl ||
      null
    ) || null,
  };

  // Register number — use application.id directly (not normalizedApp.id, which gets overwritten
  // by ...profile spread). application.id is the DB auto-incremented primary key.
  const appYear = resolvedCreatedAt ? new Date(resolvedCreatedAt).getFullYear() : new Date().getFullYear();
  const appId = application.id ?? normalizedApp.appNumber ?? 0;
  const appNumber = normalizedApp.appNumber || `AE-APP-${appYear}-${String(appId).padStart(4, "0")}`;

  // Application date — must be the date the candidate applied (created_at), NEVER today's date
  const appDateStr = resolvedCreatedAt
    ? new Date(resolvedCreatedAt).toLocaleDateString("en-GB").replace(/\//g, "-")
    : "N/A";

  const hasTech = (normalizedApp.technicalQualifications || []).some(
    t => (t.course && t.course.trim()) || (t.institute && t.institute.trim()) || (t.yearPassing && t.yearPassing.trim())
  );
  const hasExp = normalizedApp.experienceStatus === "experienced";
  const eduSecNum = 3;
  const techSecNum = 4;
  const expSecNum = hasTech ? 5 : 4;
  const docSecNum = 3 + (hasTech ? 1 : 0) + (hasExp ? 1 : 0) + 1;

  // ─── Helper to fetch and convert image to Base64 for jsPDF ────────────────
  const getBase64Image = async (url) => {
    if (!url) return null;

    // Fallback 1: Try to grab from DOM if already rendered
    const imgFromDOM = document.querySelector(`img[src="${url}"]`);
    if (imgFromDOM && imgFromDOM.complete && imgFromDOM.naturalWidth !== 0) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = imgFromDOM.naturalWidth;
        canvas.height = imgFromDOM.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imgFromDOM, 0, 0);
        return canvas.toDataURL("image/jpeg");
      } catch (e) {
        console.warn("[PDF] DOM Image capture failed (CORS), falling back to fetch...", e);
      }
    }

    // Fallback: Network fetch
    const urlsToTry = [url];

    for (const u of urlsToTry) {
      try {
        console.log(`[PDF] Attempting fetch from: ${u}`);
        const response = await fetch(u);
        if (!response.ok) continue;
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.error(`[PDF] Fetch failed for ${u}:`, err);
      }
    }
    return null;
  };

  // ─── Programmatic PDF — no HTML/CSS rendering at all ────────────────────────
  const handleDownloadPDF = async () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const W = 210;
    const margin = 10;
    const usable = W - margin * 2;
    let y = margin;

    const app = normalizedApp;
    // Always use the stored application date (never today)
    const dateStr = app.createdAt
      ? new Date(app.createdAt).toLocaleDateString("en-GB").replace(/\//g, "-")
      : "N/A";
    const skills = Array.isArray(app.skills) ? app.skills.join(", ") : app.skills || "";
    const languages = Array.isArray(app.languages) ? app.languages.join(", ") : app.languages || "";

    const formatDateToDDMMYYYY = (dateStr) => {
      if (!dateStr) return "";
      const [y, m, d] = dateStr.split("-");
      if (y && m && d && y.length === 4) return `${d}-${m}-${y}`;
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return dateStr;
      return `${String(dateObj.getDate()).padStart(2, "0")}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${dateObj.getFullYear()}`;
    };

    // ── Style helpers ──────────────────────────────────────────────────────────
    const solidBorder  = () => { pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.25); };
    const thinBorder   = () => { pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.15); };
    const grayDivider  = () => { pdf.setDrawColor(209,213,219); pdf.setLineWidth(0.15); };

    // Auto-size cell height for wrapped text
    const cellH = (text, w, fs) => {
      pdf.setFontSize(fs);
      const lines = pdf.splitTextToSize(String(text || ""), w - 3);
      const lineHeight = fs * 0.45; // mm per pt approx
      return Math.max(6.5, lines.length * lineHeight + 2);
    };

    // Draw a single bordered cell with centred text
    const drawCell = (text, x, cy, w, h, isLabel = false) => {
      thinBorder();
      if (isLabel) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(x, cy, w, h, "FD");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(71, 85, 105);
      } else {
        pdf.rect(x, cy, w, h, "S");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(30, 41, 59);
      }
      const fs    = isLabel ? 7.5 : 8.5;
      const lines = pdf.splitTextToSize(String(text || ""), w - 3);
      const lh    = fs * 0.4;
      const totH  = lines.length * lh;
      pdf.text(lines, x + 1.5, cy + (h - totH) / 2 + lh - 0.5);
    };

    // Section header bar (matches HTML section-header style)
    const sectionBar = (title, cy) => {
      thinBorder();
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, cy, usable, 6, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text(title, margin + 2, cy + 4.2);
      return cy + 6;
    };

    // Full-width row  — label (lw) | value (totalW - lw), anchored at left margin
    const fullRow = (label, value, cy, lw = 37, totalW = usable) => {
      const vw = totalW - lw;
      const h  = Math.max(cellH(label, lw, 7.5), cellH(value, vw, 8.5), 6.5);
      drawCell(label, margin,      cy, lw, h, true);
      drawCell(value, margin + lw, cy, vw, h, false);
      return cy + h;
    };

    // Split row — two label|value pairs side by side
    const splitRow = (l1, v1, l2, v2, cy, lw = 35, totalW = usable) => {
      const half = totalW / 2;
      const vw   = half - lw;
      const h    = Math.max(
        cellH(l1, lw, 7.5), cellH(v1, vw, 8.5),
        cellH(l2, lw, 7.5), cellH(v2, vw, 8.5),
        6.5
      );
      drawCell(l1, margin,             cy, lw, h, true);
      drawCell(v1, margin + lw,        cy, vw, h, false);
      drawCell(l2, margin + half,      cy, lw, h, true);
      drawCell(v2, margin + half + lw, cy, vw, h, false);
      return cy + h;
    };

    // ── HEADER BOX ── matches HTML: border, red title, address, gray divider, subtitle ──
    solidBorder();
    pdf.rect(margin, y, usable, 24, "S");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.setTextColor(220, 38, 38);
    pdf.text("AUTOCRAT ENGINEERS", W / 2, y + 8, { align: "center", charSpace: 0.5 });

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(31, 41, 55);
    pdf.text("PLOT NO. 21 & 22, EXPORT PROMOTION INDUSTRIAL PARK, PHASE 1, WHITEFIELD, BENGALURU-560066", W / 2, y + 13, { align: "center" });
    pdf.text("KARNATAKA-INDIA", W / 2, y + 16.5, { align: "center" });

    grayDivider();
    pdf.line(margin + 5, y + 18.5, margin + usable - 5, y + 18.5);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(17, 24, 39);
    pdf.text("CANDIDATE APPLICATION FORM", W / 2, y + 22, { align: "center", charSpace: 0.3 });

    y += 24.5;

    // ── REGISTRATION NO / APPLICATION DATE ROW ── matches HTML labels exactly ──
    const half   = usable / 2;
    const regLw  = 40; // "Registration No :"  label width
    const dateLw = 40; // "Application Date :" label width
    const regVw  = half - regLw;
    const dateVw = half - dateLw;
    const barH   = 7.5;

    // Left: Registration No
    thinBorder();
    pdf.setFillColor(248, 250, 252);
    pdf.rect(margin, y, regLw, barH, "FD");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(71, 85, 105);
    pdf.text("Registration No :", margin + 1.5, y + 4.8);

    thinBorder();
    pdf.rect(margin + regLw, y, regVw, barH, "S");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(30, 64, 175); // blue-800
    pdf.text(appNumber, margin + regLw + 1.5, y + 4.8);

    // Right: Application Date
    thinBorder();
    pdf.setFillColor(248, 250, 252);
    pdf.rect(margin + half, y, dateLw, barH, "FD");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(71, 85, 105);
    pdf.text("Application Date :", margin + half + 1.5, y + 4.8);

    thinBorder();
    pdf.rect(margin + half + dateLw, y, dateVw, barH, "S");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(30, 41, 59);
    pdf.text(dateStr, margin + half + dateLw + 1.5, y + 4.8);

    y += barH;

    // ── SECTION 1: PERSONAL DETAILS ──
    // Matches HTML: full-width label (w-[140px] ≈ 37mm) | value, photo box on right
    const secStartY = y;
    y = sectionBar("1). PERSONAL DETAILS", y);

    const photoW = 38; // matches HTML w-40 (160px)
    const tableW = usable - photoW;
    const lblW   = 37; // matches HTML w-[140px] = 140px ≈ 37mm

    const skillsStr = Array.isArray(app.skills) ? app.skills.join(", ") : (app.skills || "");

    // All personal detail rows use fullRow (no split) — exactly like the HTML table
    y = fullRow("Name :",                  (app.name || "").toUpperCase(),                       y, lblW, tableW);
    y = fullRow("Job Applied For :",       (app.jobTitle || app.department || "").toUpperCase(), y, lblW, tableW);
    y = fullRow("Current Address :",       (app.currentAddress || "").toUpperCase(),             y, lblW, tableW);
    y = fullRow("Permanent Address :",     (app.permanentAddress || "").toUpperCase(),           y, lblW, tableW);
    y = fullRow("Mobile No :",             (app.mobile || "").toUpperCase(),                     y, lblW, tableW);
    y = fullRow("Date of Birth :",         formatDateToDDMMYYYY(app.dob),                       y, lblW, tableW);
    y = fullRow("Email ID :",              (app.email || "").toLowerCase(),                      y, lblW, tableW);
    y = fullRow("Skills :",                skillsStr.toUpperCase(),                              y, lblW, tableW);
    y = fullRow("Fresher / Experienced :", (app.experienceStatus || "").toUpperCase(),           y, lblW, tableW);

    // Photo box — right side, spans full height of personal details section
    const photoH    = y - secStartY - 6; // 6 = section bar height
    const photoMinH = Math.max(photoH, 42);
    const photoX    = margin + tableW;
    const photoY    = secStartY + 6;
    thinBorder();
    pdf.rect(photoX, photoY, photoW, photoMinH, "S");

    if (app.photoSrc) {
      try {
        const b64 = await getBase64Image(app.photoSrc);
        if (b64) {
          const fmt = b64.includes("png") ? "PNG" : "JPEG";
          pdf.addImage(b64, fmt, photoX + 0.5, photoY + 0.5, photoW - 1, photoMinH - 1);
        }
      } catch (err) { console.error("PDF Photo Error:", err); }
    }

    y = Math.max(y, photoY + photoMinH);
    y += 2;

    // ── SECTION 2: OTHER DETAILS ──
    y = sectionBar("2). OTHER DETAILS", y);
    y = splitRow("Source :",               (app.source || "Direct Access").toUpperCase(),
                 "Notice Period :",        (app.availability || "Immediate Joiner").toUpperCase(), y);
    y = splitRow("Worked at AE before? :", app.aeBefore === "yes" ? "YES" : "NO",
                 "Languages Known :",      Array.isArray(app.languages) ? app.languages.join(", ").toUpperCase() : (app.languages || "").toUpperCase(), y);
    y += 3;

    // ── SECTION 3: EDUCATIONAL DETAILS ──
    y = sectionBar("3). EDUCATIONAL DETAILS", y);

    // Column widths match HTML: w-[20%], w-[35%], w-[20%], w-[25%]
    const eCw = [usable * 0.20, usable * 0.35, usable * 0.20, usable * 0.25];
    const eCx = [margin, margin + eCw[0], margin + eCw[0] + eCw[1], margin + eCw[0] + eCw[1] + eCw[2]];

    pdf.setFillColor(241, 245, 249);
    eCw.forEach((w, i) => { thinBorder(); pdf.rect(eCx[i], y, w, 5.5, "FD"); });
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(0, 0, 0);
    ["NAME OF DEGREE", "NAME OF INSTITUTE", "YEAR (DD-MM-YYYY)", "SPECIALIZATION"]
      .forEach((h, i) => pdf.text(h, eCx[i] + 1.5, y + 4));
    y += 5.5;

    (app.education || []).forEach(edu => {
      const h = Math.max(6.5,
        cellH(edu.degree || "", eCw[0], 7), cellH(edu.institute || "", eCw[1], 7),
        cellH(edu.yearPassing || "", eCw[2], 7), cellH(edu.specialization || "", eCw[3], 7));
      eCw.forEach((w, i) => { thinBorder(); pdf.rect(eCx[i], y, w, h, "S"); });
      drawCell((edu.degree || "").toUpperCase(),         eCx[0], y, eCw[0], h, false);
      drawCell((edu.institute || "").toUpperCase(),      eCx[1], y, eCw[1], h, false);
      drawCell((edu.yearPassing || "").toUpperCase(),    eCx[2], y, eCw[2], h, false);
      drawCell((edu.specialization || "").toUpperCase(), eCx[3], y, eCw[3], h, false);
      y += h;
    });
    y += 3;

    let secIdx = 3;

    // ── SECTION 4: TECHNICAL QUALIFICATIONS (conditional) ──
    const hasPdfTech = (app.technicalQualifications || []).some(
      t => (t.course && t.course.trim()) || (t.institute && t.institute.trim()) || (t.yearPassing && t.yearPassing.trim())
    );
    if (hasPdfTech) {
      secIdx++;
      y = sectionBar(`${secIdx}). TECHNICAL QUALIFICATIONS`, y);

      // Column widths match HTML: w-[35%], w-[45%], w-[20%]
      const tCw = [usable * 0.35, usable * 0.45, usable * 0.20];
      const tCx = [margin, margin + tCw[0], margin + tCw[0] + tCw[1]];

      pdf.setFillColor(241, 245, 249);
      tCw.forEach((w, i) => { thinBorder(); pdf.rect(tCx[i], y, w, 5.5, "FD"); });
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(0, 0, 0);
      ["COURSE/SPECIALISATION", "NAME OF INSTITUTE", "PASSING (DD-MM-YYYY)"]
        .forEach((h, i) => pdf.text(h, tCx[i] + 1.5, y + 4));
      y += 5.5;

      (app.technicalQualifications || []).forEach(tech => {
        const h = Math.max(6.5,
          cellH(tech.course || "", tCw[0], 7), cellH(tech.institute || "", tCw[1], 7),
          cellH(tech.yearPassing || "", tCw[2], 7));
        tCw.forEach((w, i) => { thinBorder(); pdf.rect(tCx[i], y, w, h, "S"); });
        drawCell((tech.course || "").toUpperCase(),      tCx[0], y, tCw[0], h, false);
        drawCell((tech.institute || "").toUpperCase(),   tCx[1], y, tCw[1], h, false);
        drawCell((tech.yearPassing || "").toUpperCase(), tCx[2], y, tCw[2], h, false);
        y += h;
      });
      y += 3;
    }

    // ── SECTION 5: PREVIOUS EMPLOYMENT DETAIL ──
    const isExp = app.experienceStatus === "experienced";
    secIdx++;
    y = sectionBar(`${secIdx}). PREVIOUS EMPLOYMENT DETAIL`, y);
    y = fullRow("Total Work Experience :", isExp ? (app.totalExperience || "").toUpperCase() : "0 YEARS (FRESHER)", y, 50);

    if (isExp && (app.employmentHistory || []).length > 0) {
      // Column widths match HTML: w-[30%], w-[30%], w-[20%], w-[20%]
      const empCw = [usable * 0.30, usable * 0.30, usable * 0.20, usable * 0.20];
      const empCx = [margin, margin + empCw[0], margin + empCw[0] + empCw[1], margin + empCw[0] + empCw[1] + empCw[2]];

      pdf.setFillColor(241, 245, 249);
      empCw.forEach((w, i) => { thinBorder(); pdf.rect(empCx[i], y, w, 5.5, "FD"); });
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(0, 0, 0);
      ["COMPANY NAME", "DESIGNATION", "FROM (DD-MM-YYYY)", "TO (DD-MM-YYYY)"]
        .forEach((h, i) => pdf.text(h, empCx[i] + 1.5, y + 4));
      y += 5.5;

      (app.employmentHistory || []).forEach(emp => {
        const h = Math.max(6.5,
          cellH(emp.companyName || "", empCw[0], 7), cellH(emp.designation || "", empCw[1], 7),
          cellH(emp.durationFrom || "", empCw[2], 7), cellH(emp.durationTo || "", empCw[3], 7));
        empCw.forEach((w, i) => { thinBorder(); pdf.rect(empCx[i], y, w, h, "S"); });
        drawCell((emp.companyName || "").toUpperCase(),  empCx[0], y, empCw[0], h, false);
        drawCell((emp.designation || "").toUpperCase(),  empCx[1], y, empCw[1], h, false);
        drawCell((emp.durationFrom || "").toUpperCase(), empCx[2], y, empCw[2], h, false);
        drawCell((emp.durationTo || "").toUpperCase(),   empCx[3], y, empCw[3], h, false);
        y += h;
      });
    } else {
      y = fullRow("Current Status :", "CANDIDATE IS A FRESHER - NO PREVIOUS EMPLOYMENT HISTORY", y, 50);
    }
    y += 3;

    // ── SECTION 6: DOCUMENT REGISTRY ──
    // Columns match HTML: Sl. | Document Title | File Info | Status
    secIdx++;
    y = sectionBar(`${secIdx}). DOCUMENT REGISTRY`, y);

    const dCw = [10, 65, 80, 35];
    const dCx = [margin, margin + 10, margin + 75, margin + 155];

    pdf.setFillColor(241, 245, 249);
    dCw.forEach((w, i) => { thinBorder(); pdf.rect(dCx[i], y, w, 5.5, "FD"); });
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(0, 0, 0);
    ["SL.", "DOCUMENT TITLE", "FILE INFO", "STATUS"]
      .forEach((h, i) => pdf.text(h, dCx[i] + 1.5, y + 4));
    y += 5.5;

    const docRow = (sl, title, info, status, cy) => {
      const h = Math.max(6.5, cellH(title, dCw[1], 7), cellH(info, dCw[2], 7));
      dCw.forEach((w, i) => { thinBorder(); pdf.rect(dCx[i], cy, w, h, "S"); });
      drawCell(sl,     dCx[0], cy, dCw[0], h, false);
      drawCell(title,  dCx[1], cy, dCw[1], h, false);
      drawCell(info,   dCx[2], cy, dCw[2], h, false);
      drawCell(status, dCx[3], cy, dCw[3], h, false);
      return cy + h;
    };

    y = docRow("1", "Professional Resume / CV",
      app.resume?.name || (app.resumeSrc ? "Resume Uploaded" : "No Resume Provided"),
      app.resumeSrc ? "UPLOADED" : "PENDING", y);
    y = docRow("2", "Identity Photograph",
      app.photo?.name || (app.photoSrc ? "Attached" : "Not Provided"),
      app.photoSrc ? "ATTACHED" : "MISSING", y);
    y += 3;

    // ── DECLARATION ── matches HTML declaration box ──
    solidBorder();
    pdf.rect(margin, y, usable, 27, "S");

    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(0, 0, 0);
    pdf.text("CANDIDATE DECLARATION:", margin + 3, y + 5);

    pdf.setFont("helvetica", "italic"); pdf.setFontSize(7); pdf.setTextColor(60, 60, 60);
    pdf.text(
      "I hereby declare that the information provided in this application is true and complete to the best of my knowledge. I authorize Autocrat Engineers to verify all information provided.",
      margin + 3, y + 9, { maxWidth: usable - 6 }
    );

    // Signature line (left) + Date (right) — matches HTML flex justify-between
    thinBorder();
    pdf.line(margin + 5, y + 21, margin + 60, y + 21);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(0, 0, 0);
    pdf.text("Applicant Signature", margin + 5, y + 25);
    pdf.text(`Date: ${dateStr}`, margin + usable - 55, y + 25);

    pdf.save(`Application_${(app.name || "Candidate").replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-800 w-full max-w-5xl h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
        >
          {/* Action Header */}
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-gray-600 dark:text-gray-400" />
              <h2 className="text-md font-bold text-gray-800 dark:text-white">Application Document Preview</h2>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleDownloadPDF} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-lg shadow-blue-100">
                <Download size={14} /> Download PDF
              </button>
              <button onClick={onClose} className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded transition-all">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Sequential Content Area */}
          <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-955 p-8 flex justify-center items-start">
            <div
              ref={formRef}
              className="bg-white w-full max-w-[210mm] min-h-[297mm] h-max shadow-lg p-8 flex flex-col text-black"
              style={{ fontFamily: "'Arial', sans-serif", fontSize: "11.5px" }}
            >
              {/* Header Box */}
              <div className="border border-black p-3 mb-2 flex flex-col items-center text-center">
                <h1 className="text-3xl font-black text-red-600 tracking-widest mb-1">AUTOCRAT ENGINEERS</h1>

                <p className="text-[10px] font-bold text-gray-800 leading-relaxed uppercase">
                  Plot No. 21 &amp; 22, Export Promotion Industrial Park, Phase 1, Whitefield, Bengaluru-560066 <br />
                  KARNATAKA-INDIA
                </p>

                <div className="w-full border-t border-gray-300 mt-2 pt-2">
                  <h2 className="text-sm font-bold text-gray-900 tracking-widest uppercase">Candidate Application Form</h2>
                </div>
              </div>

              {/* Application Details Bar */}
              <div className="flex border border-black border-b-0 text-[10px]">
                <div className="flex-1 border-r border-black p-2 flex bg-transparent">
                  <span className="font-bold w-40 uppercase">Registration No :</span>
                  <span className="font-bold text-blue-800 text-[12px]">{appNumber}</span>
                </div>
                <div className="flex-1 p-2 flex">
                  <span className="font-bold w-40 uppercase">Application Date :</span>
                  <span className="font-bold text-[12px]">{appDateStr}</span>
                </div>
              </div>

              {/* Section 1: PERSONAL DETAILS */}
              <div className="section-header p-2 bg-gray-50 font-bold border border-black uppercase text-[10px]">1). PERSONAL DETAILS</div>
              <div className="flex border border-black border-t-0">
                <div className="flex-1 min-w-0">
                  <table className="w-full h-full border-collapse table-fixed text-[11px]">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-1.5 label border-r border-black w-[140px] text-[10px]">Name :</td>
                        <td className="p-1.5 value break-words">{normalizedApp.name}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-1.5 label border-r border-black w-[140px] text-[10px]">Job Applied For :</td>
                        <td className="p-1.5 value uppercase break-words">{normalizedApp.jobTitle || normalizedApp.department}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-1.5 label border-r border-black w-[140px] text-[10px]">Current Address :</td>
                        <td className="p-1.5 value break-words">{normalizedApp.currentAddress}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-1.5 label border-r border-black w-[140px] text-[10px]">Permanent Address :</td>
                        <td className="p-1.5 value break-words">{normalizedApp.permanentAddress}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-1.5 label border-r border-black w-[140px] text-[10px]">Mobile No :</td>
                        <td className="p-1.5 value break-words">{normalizedApp.mobile}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-1.5 label border-r border-black w-[140px] text-[10px]">Date of Birth :</td>
                        <td className="p-1.5 value break-words">{normalizedApp.dob}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-1.5 label border-r border-black w-[140px] text-[10px]">Email ID :</td>
                        <td className="p-1.5 value break-words">{normalizedApp.email}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-1.5 label border-r border-black w-[140px] text-[10px]">Skills :</td>
                        <td className="p-1.5 value uppercase break-words">
                          {Array.isArray(normalizedApp.skills)
                            ? normalizedApp.skills.join(", ")
                            : (normalizedApp.skills || "")}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 label border-r border-black w-[140px] text-[10px]">Fresher / Experienced :</td>
                        <td className="p-1.5 value uppercase font-bold break-words">{normalizedApp.experienceStatus}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="w-40 border-l border-black p-3 flex flex-col items-center justify-center bg-transparent">
                  <div className="w-32 h-40 border border-black bg-white flex items-center justify-center relative overflow-hidden shadow-inner">
                    {normalizedApp.photoSrc ? (
                      <img
                        src={normalizedApp.photoSrc}
                        alt="Candidate"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = "none";
                          const fallback = e.target.parentElement?.querySelector(".photo-fallback");
                          if (fallback) fallback.style.display = "block";
                        }}
                      />
                    ) : null}
                    <div
                      className={`photo-fallback text-[9px] text-gray-400 font-bold text-center p-2 uppercase ${
                        normalizedApp.photoSrc ? "hidden" : "block"
                      }`}
                    >
                      Paste Photograph Here
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: OTHER DETAILS */}
              <div className="section-header p-2 bg-gray-50 font-bold border border-black uppercase mt-1 text-[10px]">2). OTHER DETAILS</div>
              <table className="w-full border-collapse border border-black border-t-0 text-[10px]">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="p-1 label border-r border-black w-1/4">Source :</td>
                    <td className="p-1 value uppercase">{normalizedApp.source || "Direct Access"}</td>
                    <td className="p-1 label border-l border-r border-black w-1/4">Notice Period :</td>
                    <td className="p-1 value uppercase">{normalizedApp.availability || "Immediate Joiner"}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 label border-r border-black w-1/4">Worked at AE before? :</td>
                    <td className="p-1 value uppercase">{normalizedApp.aeBefore === 'yes' ? 'Yes' : 'No'}</td>
                    <td className="p-1 label border-l border-r border-black w-1/4">Languages Known :</td>
                    <td className="p-1 value uppercase">{(normalizedApp.languages || []).join(", ")}</td>
                  </tr>
                </tbody>
              </table>

              {/* Section 3: EDUCATIONAL DETAILS */}
              <div className="section-header p-1.5 bg-gray-50 font-bold border border-black uppercase mt-1 text-[10px]">3). EDUCATIONAL DETAILS</div>
              <table className="w-full border-collapse border border-black border-t-0 text-center text-[9px]">
                <thead>
                  <tr className="label text-center font-bold bg-gray-50 uppercase">
                    <td className="border-r border-black p-1 w-[20%]">Name of Degree</td>
                    <td className="border-r border-black p-1 w-[35%]">Name of Institute</td>
                    <td className="border-r border-black p-1 w-[20%]">Year (DD-MM-YYYY)</td>
                    <td className="p-1 w-[25%]">Specialization</td>
                  </tr>
                </thead>
                <tbody>
                  {(normalizedApp.education || []).map((edu, idx) => (
                    <tr key={idx} className="border-t border-black">
                      <td className="p-1 border-r border-black text-left uppercase">{edu.degree}</td>
                      <td className="p-1 border-r border-black text-left uppercase">{edu.institute}</td>
                      <td className="p-1 border-r border-black text-center uppercase">{edu.yearPassing}</td>
                      <td className="p-1 text-left uppercase">{edu.specialization}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Section 4: TECHNICAL QUALIFICATIONS */}
              {hasTech && (
                <>
                  <div className="section-header p-1.5 bg-gray-50 font-bold border border-black uppercase mt-1 text-[10px]">{techSecNum}). TECHNICAL QUALIFICATIONS</div>
                  <table className="w-full border-collapse border border-black border-t-0 text-center text-[9px]">
                    <thead>
                      <tr className="label text-center font-bold bg-gray-50 uppercase">
                        <td className="border-r border-black p-1 w-[35%]">Course/Specialisation</td>
                        <td className="border-r border-black p-1 w-[45%]">Name of Institute</td>
                        <td className="p-1 w-[20%]">Passing (DD-MM-YYYY)</td>
                      </tr>
                    </thead>
                    <tbody>
                      {(normalizedApp.technicalQualifications || []).map((tech, idx) => (
                        <tr key={idx} className="border-t border-black">
                          <td className="p-1 border-r border-black text-left uppercase">{tech.course}</td>
                          <td className="p-1 border-r border-black text-left uppercase">{tech.institute}</td>
                          <td className="p-1 uppercase">{tech.yearPassing}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Section 5: EMPLOYMENT HISTORY */}
              {hasExp && (
                <>
                  <div className="section-header p-1.5 bg-gray-50 font-bold border border-black uppercase mt-1 text-[10px]">{expSecNum}). PREVIOUS EMPLOYMENT DETAIL</div>
                  <table className="w-full border-collapse border border-black border-t-0 text-center text-[9px]">
                    <thead>
                      <tr className="label text-center font-bold bg-gray-50 uppercase">
                        <td className="border-r border-black p-1 w-[30%]">Company Name</td>
                        <td className="border-r border-black p-1 w-[30%]">Designation</td>
                        <td className="border-r border-black p-1 w-[20%]">From (DD-MM-YYYY)</td>
                        <td className="p-1 w-[20%]">To (DD-MM-YYYY)</td>
                      </tr>
                    </thead>
                    <tbody>
                      {(normalizedApp.employmentHistory || []).map((emp, idx) => (
                        <tr key={idx} className="border-t border-black">
                          <td className="p-1 border-r border-black text-left uppercase">{emp.companyName}</td>
                          <td className="p-1 border-r border-black text-left uppercase">{emp.designation}</td>
                          <td className="p-1 border-r border-black uppercase">{emp.durationFrom}</td>
                          <td className="p-1 uppercase">{emp.durationTo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Document Registry */}
              <div className="section-header p-1.5 bg-gray-50 font-bold border border-black uppercase mt-1 text-[10px]">
                {docSecNum}). DOCUMENT REGISTRY
              </div>
              <table className="w-full border-collapse border border-black border-t-0 text-center text-[9px]">
                <thead>
                  <tr className="label text-center font-bold bg-gray-50 uppercase">
                    <td className="border-r border-black w-10">Sl.</td>
                    <td className="border-r border-black">Document Title</td>
                    <td className="border-r border-black">File Info</td>
                    <td className="w-32 text-center">Action</td>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-black">
                    <td className="p-1 border-r border-black">1</td>
                    <td className="p-1 border-r border-black text-left">Professional Resume / CV</td>
                    <td className="p-1 border-r border-black text-left">{normalizedApp.resume?.name || (normalizedApp.resumeSrc ? normalizedApp.resumeSrc.split("/").pop().split("?")[0] : "No Resume")}</td>
                    <td className="p-1">
                      {normalizedApp.resumeSrc ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setShowResumePreview(true)}
                            className="text-blue-600 font-bold hover:underline uppercase text-[9px]"
                          >
                            VIEW RESUME
                          </button>
                          <a
                            href={normalizedApp.resumeSrc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-[11px] font-bold"
                            title="Open in new tab"
                          >
                            ↗
                          </a>
                        </div>
                      ) : (
                        <span className="text-gray-400">PENDING</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* DECLARATION */}
              <div className="mt-2 border border-black p-2 text-justify">
                <p className="font-bold uppercase text-[8px] mb-1 underline">Candidate Declaration:</p>
                <p className="text-[9px] leading-tight italic text-gray-700">
                  I hereby declare that the information provided in this application is true and complete to the best of my knowledge. I authorize Autocrat Engineers to verify all information provided.
                </p>

                <div className="flex justify-between items-end mt-4 px-4">
                  <div className="text-center w-48 border-t border-black pt-1">
                    <p className="text-[8px] font-bold uppercase">Applicant Signature</p>
                  </div>
                  <p className="text-[8px] font-bold uppercase">Date: {appDateStr}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
        {showResumePreview && normalizedApp.resumeSrc && (
          <div
            className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowResumePreview(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50">
                <div className="flex items-center gap-3">
                  <FileText className="text-[#0057B8]" size={22} />
                  <div>
                    <h3 className="font-bold text-base text-gray-900">Resume Preview</h3>
                    <p className="text-xs text-gray-500">
                      {normalizedApp.resume?.name || normalizedApp.resumeSrc.split("/").pop().split("?")[0]}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={normalizedApp.resumeSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0057B8] hover:bg-blue-700 rounded-lg shadow-sm transition"
                  >
                    Open in New Tab ↗
                  </a>
                  <a
                    href={normalizedApp.resumeSrc}
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                  >
                    <Download size={14} /> Download
                  </a>
                  <button
                    onClick={() => setShowResumePreview(false)}
                    className="p-1.5 hover:bg-gray-200 text-gray-500 rounded-lg transition ml-1"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-gray-100 relative flex flex-col">
                <iframe
                  src={normalizedApp.resumeSrc}
                  title="Resume Preview"
                  className="w-full flex-1 border-0"
                />
                <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between">
                  <span>If document preview does not load due to browser restrictions, click &quot;Open in New Tab&quot;.</span>
                  <a
                    href={normalizedApp.resumeSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline hover:text-amber-900 ml-2"
                  >
                    Open in New Tab ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}