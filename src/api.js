import axios from "axios";

// ─── Base API instance ───────────────────────────────────────────────────────
const getApiBaseUrl = () => {
    // 1. Vite environment variable (standard in Vite production builds)
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
        return import.meta.env.VITE_API_URL.replace(/\/+$/, "");
    }
    // 2. Window runtime config (for containerized deployments without rebuilding)
    if (typeof window !== "undefined" && window.__ENV__?.VITE_API_URL) {
        return window.__ENV__.VITE_API_URL.replace(/\/+$/, "");
    }
    // 3. Fallback to process.env (CRA / Webpack compatibility)
    if (typeof process !== "undefined" && process.env?.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL.replace(/\/+$/, "");
    }
    // 4. Fallback to localhost for local development
    return "http://localhost:8000";
};

const API_BASE_URL = getApiBaseUrl();

const API = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // Increase timeout to 30 seconds for uploads
});

export const FILE_BASE_URL = (typeof import.meta !== "undefined" && import.meta.env?.VITE_FILE_BASE_URL)
    ? import.meta.env.VITE_FILE_BASE_URL.replace(/\/+$/, "")
    : `${API_BASE_URL}/uploads`;

/**
 * Universal helper to resolve any file/photo/resume/document reference into a fully qualified URL.
 * Handles:
 * - full external URLs (https://..., http://...)
 * - data URLs (data:image/...)
 * - blob URLs (blob:http://...)
 * - objects with .url, .data, or .path properties
 * - relative paths (photos/abc.jpg, /uploads/photos/abc.jpg, uploads/photos/abc.jpg)
 */
export const getFileUrl = (value) => {
    if (!value) return "";
    if (typeof value === "object") {
        value = value.url || value.data || value.path || "";
    }
    if (!value || typeof value !== "string") return "";
    const trimmed = value.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
        return trimmed;
    }
    const cleanPath = trimmed.replace(/^\/?uploads\//, "").replace(/^\/+/, "");
    return `${FILE_BASE_URL}/${cleanPath}`;
};

// ─── Attach JWT token automatically to every request ────────────────────────
API.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ─── Auth Endpoints ──────────────────────────────────────────────────────────
export const registerUser = (data) => API.post("/auth/register", data);
// data: { email, password, role }
export const checkEmailAvailability = (email) =>
    API.get("/auth/check-email", { params: { email } });

export const loginUser = (data) => API.post("/auth/login", data);
// data: { email, password }
// returns: { access_token, token_type }

export const changePassword = (data) => API.post("/auth/change-password", data);

// ─── Candidate Endpoints ─────────────────────────────────────────────────────
export const getCandidateProfile = (userId) =>
    API.get(`/candidate/profile/${userId}`);

export const uploadFile = async (file, folder, targetUserId = null) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);
    if (targetUserId) {
        formData.append("target_user_id", targetUserId);
    }

    // Retry logic for unstable network uploads
    try {
        return await API.post("/candidate/upload", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
    } catch (error) {
        if (error.code === 'ERR_NETWORK') {
            console.warn("Network error during upload, retrying once...");
            return await API.post("/candidate/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
        }
        throw error;
    }
};

export const updateCandidateProfile = (userId, data) =>
    API.put(`/candidate/profile/${userId}`, data);

export const getSimilarJobsByDepartment = (department) =>
    API.get(`/candidate/jobs`, { params: { department } });

export const applyForJob = (data) => API.post("/candidate/apply", data);

export const getCandidateOptions = () => API.get("/candidate/options");

export const getCandidateDashboard = (candidateId = null) =>
    API.get("/candidate/dashboard", { params: candidateId ? { candidate_id: candidateId } : {} });

export const markNotificationsAsRead = (candidateId = null) =>
    API.post("/candidate/notifications/read-all", null, { params: candidateId ? { candidate_id: candidateId } : {} });

export const markSingleNotificationRead = (notificationId, candidateId = null) =>
    API.patch(`/candidate/notifications/${notificationId}/read`, null, { params: candidateId ? { candidate_id: candidateId } : {} });

export const getCandidateApplications = (candidateId = null) =>
    API.get("/candidate/applications", { params: candidateId ? { candidate_id: candidateId } : {} });

export const deleteApplication = (appId) => API.delete(`/candidate/application/${appId}`);

// ─── HR Admin Endpoints ──────────────────────────────────────────────────────
export const getAllCandidates = () => API.get("/hr/candidates");

export const getCandidateById = (userId) =>
    API.get(`/hr/candidates/${userId}`);

export const getHRStats = () => API.get("/hr/dashboard/stats");

export const getHRJobsOverview = () => API.get("/hr/dashboard/jobs-overview");

export const getHRApplications = (params) => API.get("/hr/applications", { params });

export const updateApplicationStatus = (appId, status) =>
    API.put(`/hr/applications/${appId}/status`, { status });

// 💼 HR Job Management
export const postJob = (data) => API.post("/hr/jobs", data);
export const getHRJobs = () => API.get("/hr/jobs");
export const deleteJob = (jobId) => API.delete(`/hr/jobs/${jobId}`);
export const getDepartments = () => API.get("/hr/departments");
export const updateJob = (jobId, data) =>
    API.put(`/hr/jobs/${jobId}`, data);

export default API;