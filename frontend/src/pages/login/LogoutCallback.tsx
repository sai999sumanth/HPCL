import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import { apiClient } from '@/services/apiClient';

const LogoutCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleLogout = async () => {
      try {
        console.log("Processing logout callback...");
        
        // Call the logout API endpoint
        await apiClient.get('/api/logout');
        
        // Clear any session data
        sessionStorage.clear();
        localStorage.clear();
        
        // Clear user state from store (without calling API again)
        useAuthStore.setState({ user: null, error: null, authChecked: false });
        
        console.log("Logout successful, redirecting to login page");
        
        // Redirect to login page
        navigate("/", { replace: true });
      } catch (error) {
        console.error("Logout callback error:", error);
        
        // Even if API fails, clear local state and redirect
        sessionStorage.clear();
        localStorage.clear();
        useAuthStore.setState({ user: null, error: null, authChecked: false });
        
        navigate("/", { replace: true });
      }
    };

    handleLogout();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-white to-gray-100 text-gray-700">
      <div className="bg-white p-6 rounded-2xl shadow-lg flex flex-col items-center space-y-4">
        <svg
          className="animate-spin h-10 w-10 text-indigo-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <h2 className="text-lg font-semibold">🔓 Logging out...</h2>
        <p className="text-sm text-gray-500 text-center">Please wait while we log you out</p>
      </div>
    </div>
  );
};

export default LogoutCallback;

