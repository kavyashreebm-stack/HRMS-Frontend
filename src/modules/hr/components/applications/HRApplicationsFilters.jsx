import React from "react";
import { Search, LayoutGrid, List } from "lucide-react";

export default function HRApplicationsFilters({
  search,
  setSearch,
  status,
  setStatus,
  view,
  setView,
}) {
  return (
    <div className="w-full bg-white dark:bg-gray-800 border border-transparent dark:border-gray-700 p-4 rounded-xl shadow-md mb-6">
      <div className="flex items-center justify-between">
        {/* LEFT SECTION */}
        <div className="flex items-center gap-4 w-full">
          {/* SEARCH */}
          <div className="relative w-[280px] md:w-[320px] shadow-sm rounded-lg">
            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search Candidates or Jobs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-300 focus:outline-none"
            />
          </div>
          {/* STATUS FILTER */}
          <div className="flex gap-2 flex-wrap">
            {[
              "Applied",
              "Application Reviewed",
              "Interview Scheduled",
              "On Hold",
              "Offered",
              "Onboarding",
            ].map((item) => (
              <button
                key={item}
                onClick={() => setStatus(status === item ? "" : item)}
                className={`px-4 py-2 rounded-full text-sm transition ${
                  status === item
                    ? "bg-[#0057B8] text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className="flex gap-2">
          <button
            onClick={() => setView("kanban")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition-all ${
              view === "kanban"
                ? "bg-[#0057B8] text-white"
                : "bg-white dark:bg-gray-750 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          <button
            onClick={() => setView("table")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition-all ${
              view === "table"
                ? "bg-[#0057B8] text-white"
                : "bg-white dark:bg-gray-750 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
