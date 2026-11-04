import React from "react";
import { Upload, FileText, CheckCircle, Trash2 } from "lucide-react";
import { uploadFile, FILE_BASE_URL } from "../../../../api";

// ✅ Arrow-key navigation between focusable fields and upload zones
const handleFormKeyDown = (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const target = e.target;
  if (
    target.tagName !== "INPUT" &&
    target.tagName !== "TEXTAREA" &&
    target.tagName !== "SELECT" &&
    !(target.getAttribute("role") === "button")
  ) return;

  if (target.tagName === "INPUT" && (target.type === "text" || target.type === "tel" || target.type === "number")) {
    const { selectionStart, selectionEnd, value } = target;
    if (e.key === "ArrowLeft" && selectionStart !== 0) return;
    if (e.key === "ArrowRight" && selectionEnd !== value.length) return;
  }

  const container = e.currentTarget;
  const focusable = Array.from(
    container.querySelectorAll(
      'input:not([tabindex="-1"]):not([disabled]):not([type="file"]):not([type="checkbox"]), select:not([tabindex="-1"]):not([disabled]), textarea:not([tabindex="-1"]):not([disabled]), [tabindex="0"]:not([disabled])'
    )
  );
  const index = focusable.indexOf(target);
  if (index === -1) return;

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    (focusable[index - 1] || focusable[focusable.length - 1])?.focus();
  } else {
    e.preventDefault();
    (focusable[index + 1] || focusable[0])?.focus();
  }
};

export default function Declaration({
  formData,
  setFormData,
  readOnly,
  setIsDirty,
  validationErrors = {},
  isHRMode = false,
  candidateUserId = null,
}) {
  const declaration = formData.declaration || {};

  React.useEffect(() => {
    const formattedToday = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
    if (!declaration.date || (declaration.date.includes("-") && declaration.date.split("-")[0].length === 4)) {
      setFormData((prev) => ({
        ...prev,
        declaration: {
          ...(prev.declaration || {}),
          date: formattedToday,
        },
      }));
    }
  }, [declaration.date, setFormData]);

  const today = declaration.date || new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
  const aadhaarFile =
    declaration.aadhaar ||
    (formData.aadhar_doc_path && {
      name: "Aadhaar Card",
      data: formData.aadhar_doc_path,
    });

  const panFile =
    declaration.pan ||
    (formData.pan_doc_path && {
      name: "PAN Card",
      data: formData.pan_doc_path,
    });

  const sslcFile =
    declaration.sslc ||
    (formData.sslc_doc_path && {
      name: "Marks Sheets",
      data: formData.sslc_doc_path,
    });

  /* ---------------- FILE HELPERS ---------------- */

  const handleFileChange = async (field, file) => {
    if (!file) return;

    // PDF-only validation
    const ext = file.name.split(".").pop().toLowerCase();
    if (file.type !== "application/pdf" && ext !== "pdf") {
      alert("Invalid file type. Only PDF format is allowed for documents.");
      const input = document.getElementById(`${field}Upload`);
      if (input) input.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("File must be under 2MB");
      const input = document.getElementById(`${field}Upload`);
      if (input) input.value = "";
      return;
    }

    const folderMap = {
      aadhaar: "aadhar",
      pan: "pan",
      sslc: "sslc",
    };
    const folder = folderMap[field] || field;

    try {
      const res = await uploadFile(file, folder, isHRMode && candidateUserId ? candidateUserId : null);
      const filePath = res.data.path;

      setFormData((prev) => ({
        ...prev,
        [`${folder}_doc_path`]: filePath,
        declaration: {
          ...(prev.declaration || {}),
          [field]: {
            name: file.name,
            data: filePath,
          },
        },
      }));

      setIsDirty(true);
    } catch (err) {
      console.error("Upload failed:", err);
      alert(`File upload failed. Please try again.`);
    } finally {
      const input = document.getElementById(`${field}Upload`);
      if (input) input.value = "";
    }
  };

  const removeFile = (field) => {
    const folderMap = {
      aadhaar: "aadhar",
      pan: "pan",
      sslc: "sslc",
    };
    const folder = folderMap[field] || field;

    setFormData((prev) => ({
      ...prev,
      [`${folder}_doc_path`]: null,
      declaration: {
        ...(prev.declaration || {}),
        [field]: null,
      },
    }));
    setIsDirty(true);
    const input = document.getElementById(`${field}Upload`);
    if (input) input.value = "";
  };

  const handleView = (fileData) => {
    if (!fileData) return;

    console.log("FILE DATA:", fileData);

    // Backend file path
    if (typeof fileData === "string") {
      let fileUrl = fileData;

      // Already full URL
      if (fileData.startsWith("http")) {
        window.open(fileData, "_blank");
        return;
      }

      // candidate/aadhar/... → uploads/aadhar/...
      if (fileData.startsWith("/candidate/")) {
        fileUrl = fileData.replace("/candidate/", "");
      }

      if (fileUrl.startsWith("/")) {
        fileUrl = fileUrl.substring(1);
      }

      window.open(`${FILE_BASE_URL}/${fileUrl}`, "_blank");
      return;
    }
  };

  /* ---------------- DECLARATION UPDATE ---------------- */

  const updateDeclaration = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      declaration: {
        ...(prev.declaration || {}),
        [field]: value,
      },
    }));
    setIsDirty(true);
  };

  return (
    <div className="space-y-6 max-w-4xl" onKeyDown={handleFormKeyDown}>

      {/* ================== 📂 CARD 1: UPLOAD DOCUMENTS ================== */}
      <div className="bg-white rounded-2xl shadow p-6 hover:shadow-md transition">
        <h3 className="text-md font-semibold text-gray-800 mb-6">
          Upload Documents
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Aadhaar */}
          <div>
            <label className="text-sm font-medium mb-1 block">
              Aadhaar Card <span className="text-red-500">*</span>
            </label>

            {/* tabIndex makes upload zone reachable by arrow-key nav; Enter/Space opens file picker */}
            <div
              tabIndex={readOnly ? -1 : 0}
              role="button"
              aria-label="Upload Aadhaar Card"
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !readOnly) {
                  e.preventDefault();
                  document.getElementById("aadhaarUpload")?.click();
                }
              }}
              className={`transition-all rounded-xl p-6 text-center flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#0057B8] ${aadhaarFile
                ? "border-2 border-solid border-[#0057B8] bg-blue-50/10"
                : validationErrors.declAadhaar
                ? "border-2 border-dashed border-red-500 bg-red-50/20"
                : "border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50/50"
                }`}
            >
              {aadhaarFile ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm w-full relative">
                    <FileText className="w-6 h-6 text-[#0057B8]" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {aadhaarFile.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleView(aadhaarFile.data)}
                        className="text-[11px] text-[#0057B8] font-bold hover:underline"
                      >
                        View Document
                      </button>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeFile("aadhaar")}
                        className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                        title="Remove Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" /> Aadhaar Attached Successfully
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    id="aadhaarUpload"
                    className="hidden"
                    accept=".pdf"
                    disabled={readOnly}
                    onChange={(e) =>
                      handleFileChange("aadhaar", e.target.files[0])
                    }
                  />
                  <label
                    htmlFor="aadhaarUpload"
                    className="cursor-pointer flex flex-col items-center gap-2 group w-full"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition">
                      <Upload className="w-4 h-4 text-[#0057B8]" />
                    </div>
                    <span className="text-sm font-semibold text-[#0057B8] hover:underline">
                      Click to upload Aadhaar Card
                    </span>
                    <span className="text-[10px] text-gray-400">Accepts PDF format only</span>
                  </label>
                </>
              )}
            </div>
            {validationErrors.declAadhaar && !aadhaarFile && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.declAadhaar}</p>
            )}
          </div>

          {/* PAN */}
          <div>
            <label className="text-sm font-medium mb-1 block">
              PAN Card <span className="text-red-500">*</span>
            </label>

            {/* tabIndex makes upload zone reachable by arrow-key nav */}
            <div
              tabIndex={readOnly ? -1 : 0}
              role="button"
              aria-label="Upload PAN Card"
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !readOnly) {
                  e.preventDefault();
                  document.getElementById("panUpload")?.click();
                }
              }}
              className={`transition-all rounded-xl p-6 text-center flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#0057B8] ${panFile
                ? "border-2 border-solid border-[#0057B8] bg-blue-50/10"
                : validationErrors.declPan
                ? "border-2 border-dashed border-red-500 bg-red-50/20"
                : "border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50/50"
                }`}
            >
              {panFile ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm w-full relative">
                    <FileText className="w-6 h-6 text-[#0057B8]" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {panFile.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleView(panFile.data)}
                        className="text-[11px] text-[#0057B8] font-bold hover:underline"
                      >
                        View Document
                      </button>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeFile("pan")}
                        className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                        title="Remove Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" /> PAN Attached Successfully
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    id="panUpload"
                    className="hidden"
                    accept=".pdf"
                    disabled={readOnly}
                    onChange={(e) =>
                      handleFileChange("pan", e.target.files[0])
                    }
                  />
                  <label
                    htmlFor="panUpload"
                    className="cursor-pointer flex flex-col items-center gap-2 group w-full"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition">
                      <Upload className="w-4 h-4 text-[#0057B8]" />
                    </div>
                    <span className="text-sm font-semibold text-[#0057B8] hover:underline">
                      Click to upload PAN Card
                    </span>
                    <span className="text-[10px] text-gray-400">Accepts PDF format only</span>
                  </label>
                </>
              )}
            </div>
            {validationErrors.declPan && !panFile && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.declPan}</p>
            )}
          </div>

          {/* SSLC */}
          <div>
            <label className="text-sm font-medium mb-1 block">
              All Marks Sheets <span className="text-red-500">*</span>
            </label>

            {/* tabIndex makes upload zone reachable by arrow-key nav */}
            <div
              tabIndex={readOnly ? -1 : 0}
              role="button"
              aria-label="Upload Marks Sheets"
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !readOnly) {
                  e.preventDefault();
                  document.getElementById("sslcUpload")?.click();
                }
              }}
              className={`transition-all rounded-xl p-6 text-center flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#0057B8] ${sslcFile
                ? "border-2 border-solid border-[#0057B8] bg-blue-50/10"
                : validationErrors.declSslc
                ? "border-2 border-dashed border-red-500 bg-red-50/20"
                : "border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50/50"
                }`}
            >
              {sslcFile ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm w-full relative">
                    <FileText className="w-6 h-6 text-[#0057B8]" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {sslcFile.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleView(sslcFile.data)}
                        className="text-[11px] text-[#0057B8] font-bold hover:underline"
                      >
                        View Document
                      </button>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeFile("sslc")}
                        className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                        title="Remove Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" /> Marks Sheets Attached Successfully
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    id="sslcUpload"
                    className="hidden"
                    accept=".pdf"
                    disabled={readOnly}
                    onChange={(e) =>
                      handleFileChange("sslc", e.target.files[0])
                    }
                  />
                  <label
                    htmlFor="sslcUpload"
                    className="cursor-pointer flex flex-col items-center gap-2 group w-full"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition">
                      <Upload className="w-4 h-4 text-[#0057B8]" />
                    </div>
                    <span className="text-sm font-semibold text-[#0057B8] hover:underline">
                      Click to upload Marks Sheets
                    </span>
                    <span className="text-[10px] text-gray-400">Accepts PDF format only</span>
                  </label>
                </>
              )}
            </div>
            {validationErrors.declSslc && !sslcFile && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.declSslc}</p>
            )}
          </div>

        </div>
      </div>

      {/* ================== 📝 CARD 2: DECLARATION ================== */}
      <div className="bg-white rounded-2xl shadow p-6 hover:shadow-md transition">
        <h3 className="text-md font-semibold text-gray-800 mb-4">
          Declaration
        </h3>

        <p className="text-sm text-gray-700 leading-relaxed">
          I declare that the above information is correct to the best of my
          knowledge. I authorize the company to verify the details at any point
          of time.
        </p>

        {/* Checkbox */}
        <div className="flex items-start gap-2 mt-4">
          <input
            type="checkbox"
            checked={declaration.agreed || false}
            disabled={readOnly}
            onChange={(e) =>
              updateDeclaration("agreed", e.target.checked)
            }
            className={validationErrors.declaration ? "border-red-500 outline-red-500 text-red-500" : ""}
          />
          <label className={`text-sm ${validationErrors.declaration ? "text-red-500 font-semibold" : "text-gray-700"}`}>
            I agree to the above declaration <span className="text-red-500">*</span>
          </label>
        </div>
        {validationErrors.declaration && (
          <p className="text-red-500 text-xs mt-1">{validationErrors.declaration}</p>
        )}

        {/* Signature */}
        <div className="mt-4">
          <label className={`text-sm font-medium ${validationErrors.signature ? "text-red-500" : "text-gray-700"}`}>
            Digital Signature (Full Name) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Enter your full name"
            value={declaration.signature || ""}
            disabled={readOnly}
            onChange={(e) =>
              updateDeclaration("signature", e.target.value)
            }
            className={`mt-1 w-full border-b outline-none px-2 py-1 transition ${
              validationErrors.signature
                ? "border-red-500 text-red-600 placeholder-red-300"
                : "border-gray-300 focus:border-[#0057B8]"
            }`}
          />
          {validationErrors.signature && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.signature}</p>
          )}
        </div>

        {/* Date & Place */}
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium">Date:</label>
            <input
              type="text"
              value={today}
              disabled
              className="ml-3 border-b bg-gray-50 px-2 py-1 text-gray-500"
            />
          </div>

          <div>
            <label className={`text-sm font-medium ${validationErrors.place ? "text-red-500" : "text-gray-700"}`}>
              Place: <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter Place"
              value={declaration.place || ""}
              disabled={readOnly}
              onChange={(e) =>
                updateDeclaration("place", e.target.value)
              }
              className={`ml-3 border-b outline-none px-2 py-1 transition ${
                validationErrors.place
                  ? "border-red-500 text-red-600 placeholder-red-300"
                  : "border-gray-300 focus:border-[#0057B8]"
              }`}
            />
            {validationErrors.place && (
              <p className="text-red-500 text-xs mt-1 ml-3">{validationErrors.place}</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}