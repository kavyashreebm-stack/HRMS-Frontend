import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sun, Moon, ChevronDown } from "lucide-react";

export default function HRTopbar() {
  const [showPanel, setShowPanel] = useState(false);
  const [theme, setTheme] = useState(
    localStorage.getItem("hr_theme") || "light"
  );

  const navigate = useNavigate();
  const location = useLocation();

  // Apply Theme
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("hr_theme", theme);
  }, [theme]);

  // Dynamic header content based on current route
  const getHeaderContent = () => {
    const path = location.pathname;
    if (path.includes("/hr/all-profiles")) {
      return {
        title: "All Candidate Profiles",
        subtitle: "Review and manage all candidate profiles",
      };
    }
    if (path.includes("/hr/all-applications")) {
      return {
        title: "Candidate Pool",
        subtitle: "Review and manage candidate applications",
      };
    }
    if (path.includes("/hr/job-postings")) {
      return {
        title: "Career Opportunities",
        subtitle: "Create and manage career opportunities",
      };
    }
    if (path.includes("/hr/onboarding")) {
      return {
        title: "Employee Onboarding",
        subtitle: "Welcome and onboard new employees seamlessly",
      };
    }
    // Default: Dashboard
    if (path.includes("/hr/appointment-letter")) {
      return {
        title: "Appointment Letter",
        subtitle: "Generate and send appointment letters to new employees",
      };
    }
    return {
      title: "HR Dashboard",
      subtitle: "Manage recruitment & onboarding efficiently",
    };
  };

  const headerContent = getHeaderContent();

  // Get HR Name
  const getHRName = () => {
    try {
      const user = JSON.parse(localStorage.getItem("loggedInUser"));
      if (user?.email) return user.email.split("@")[0];
    } catch (error) { }
    return "HR Manager";
  };

  // Avatar Initials
  const getInitials = (name) => {
    if (!name) return "HR";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const hrName = getHRName();

  return (
    <div className="h-24 bg-white/70 dark:bg-gray-900 backdrop-blur-xl border-b border-white/40 dark:border-gray-700 flex items-center justify-between px-10 shadow-md">

      {/* Left */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">
          {headerContent.title}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
          {headerContent.subtitle}
        </p>
      </div>

      {/* Right — Avatar with Theme Popup */}
      <div className="relative">

        {/* Clickable Avatar Button */}
        <button
          onClick={() => setShowPanel((prev) => !prev)}
          className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl px-3 py-2 transition-all duration-200"
          aria-label="Open theme settings"
        >
          {/* Avatar */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0057B8] to-indigo-400 text-white font-bold text-sm flex items-center justify-center ring-2 ring-[#0057B8] ring-offset-2 shadow-md">
              {getInitials(hrName)}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full ring-2 ring-white dark:ring-gray-900"></span>
          </div>

          {/* Name & Role */}
          <div className="hidden md:block text-left"> 
            <p className="text-sm font-semibold text-gray-800 dark:text-white leading-tight capitalize">
              {hrName}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              HR Manager
            </p>
          </div>

          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform duration-200 ${showPanel ? "rotate-180" : ""}`}
          />
        </button>

        {/* Theme Settings Popup — floats within topbar area */}
        {showPanel && (
          <div className="absolute right-0 top-full w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-[9999] overflow-hidden">
            <div className="px-2 pt-2 pb-1">

              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-xl border text-sm font-semibold transition-all duration-200 ${theme === "light"
                    ? "bg-blue-500 text-white border-blue-500 shadow-md"
                    : "bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-400 hover:text-blue-600"
                    }`}
                >
                  <Sun size={15} />
                  Light
                </button>

                <button
                  onClick={() => setTheme("dark")}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-xl border text-sm font-semibold transition-all duration-200 ${theme === "dark"
                    ? "bg-blue-500 text-white border-blue-500 shadow-md"
                    : "bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-500 hover:text-gray-800"
                    }`}
                >
                  <Moon size={15} />
                  Dark
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}