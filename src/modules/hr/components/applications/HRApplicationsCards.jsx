import React, { useState, useRef } from "react";
import { Eye, X, GripVertical, CheckCircle2 } from "lucide-react";
import { FILE_BASE_URL, getFileUrl } from "../../../../api";

export default function HRApplicationsCards({ app, onView, onDragStart, onDragEnd }) {
  const [showQuickCard, setShowQuickCard] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isCardDragging, setIsCardDragging] = useState(false);
  const dragOccurredRef = useRef(false);

  const isOnboarding = app.status === "Onboarding";
  const isDraggable = !isOnboarding;

  const baseClasses = `bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm border transition-all duration-200 select-none relative group ${
    isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
  }`;
  const standardClasses =
    "border-gray-100 dark:border-gray-800 hover:shadow-md hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-700";
  const onboardingClasses =
    "border-emerald-200 dark:border-emerald-800 hover:border-emerald-500 hover:shadow-emerald-100 dark:hover:shadow-emerald-950/20 hover:shadow-md hover:-translate-y-0.5";

  const photoPath = app.candidate_profile?.photo_path || app.photo_path || app.candidate_profile?.photo || app.photo;
  const photoUrl = photoPath && !imageError ? getFileUrl(photoPath) : null;
  const initials = (app.candidate_profile?.name || "?").charAt(0).toUpperCase();

  const handleDragStart = (e) => {
    if (!isDraggable) {
      e.preventDefault();
      return;
    }
    dragOccurredRef.current = true;
    setIsCardDragging(true);
    e.dataTransfer.setData("application/json", JSON.stringify({ id: app.id, status: app.status }));
    e.dataTransfer.effectAllowed = "move";
    if (onDragStart) {
      onDragStart(app);
    }
  };

  const handleDragEnd = (e) => {
    setIsCardDragging(false);
    if (onDragEnd) {
      onDragEnd(app);
    }
    setTimeout(() => {
      dragOccurredRef.current = false;
    }, 150);
  };

  const handleClick = () => {
    if (dragOccurredRef.current) return;
    setShowQuickCard(true);
  };

  return (
    <>
      {/* Kanban Board Compact Card */}
      <div
        draggable={isDraggable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        className={`${baseClasses} ${isOnboarding ? onboardingClasses : standardClasses} ${isCardDragging ? "opacity-40 scale-95 border-dashed border-blue-500 shadow-none" : ""
          }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={app.candidate_profile?.name || "Candidate"}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700 flex-shrink-0"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm flex-shrink-0 shadow-sm">
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">
                {app.candidate_profile?.name || "Unknown Candidate"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
                {app.job_title || app.department || "No Department"}
              </p>
            </div>
          </div>

          {isOnboarding ? (
            <div className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" title="Onboarding completed">
              <CheckCircle2 size={16} />
            </div>
          ) : (
            <div className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors flex-shrink-0" title="Drag to move forward">
              <GripVertical size={16} />
            </div>
          )}
        </div>
      </div>

      {/* Pop-Up Details Card Modal */}
      {showQuickCard && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowQuickCard(false);
          }}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-6 max-w-sm w-full relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close X Button */}
            <button
              onClick={() => setShowQuickCard(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              aria-label="Close popup"
            >
              <X size={18} />
            </button>

            {/* Candidate Header */}
            <div className="flex items-center gap-3.5 mb-4 pr-6">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={app.candidate_profile?.name || "Candidate"}
                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700 flex-shrink-0 shadow-sm"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-base flex-shrink-0 shadow-sm">
                  {initials}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-snug truncate">
                  {app.candidate_profile?.name || "Unknown Candidate"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
                  {app.job_title || app.department || "No Department"}
                </p>
              </div>
            </div>

            {/* Details Box */}
            <div className="text-xs text-gray-700 dark:text-gray-300 space-y-2 mb-6 bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800">
              <p>
                <span className="font-semibold text-gray-500 dark:text-gray-400">Email:</span>{" "}
                {app.candidate_profile?.email || "N/A"}
              </p>
              <p>
                <span className="font-semibold text-gray-500 dark:text-gray-400">Experience:</span>{" "}
                {app.experience_type || "N/A"}
              </p>
              <p>
                <span className="font-semibold text-gray-500 dark:text-gray-400">Status:</span>{" "}
                <span className="font-medium text-blue-600 dark:text-blue-400">{app.status}</span>
              </p>
            </div>

            {/* View Application Button */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowQuickCard(false);
                  onView(app);
                }}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold bg-[#0057B8] hover:bg-[#0047a3] text-white px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer"
              >
                <Eye size={16} />
                View Application
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}