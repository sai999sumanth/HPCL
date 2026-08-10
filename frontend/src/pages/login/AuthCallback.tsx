import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import axios from 'axios';
import menuData from '@/components/layout/menuData.json';

interface ApiResponse {
  menu_name: any;
  allowed_sub_menus: any[];
  sap_id: any[];
  sales_area: any[];
  state: any[];
  zone: any[];
  region: any[];
  bu: any[];
  allowed_roles: any[];
  system_role: any[];
  is_authenticated: boolean;
  employee_id: string;
  email: string;
  first_name: string;
  novex_role: any[];
  last_name: string;
  permissions: any[];
}

// Simple JWT decode function (without verification)
const decodeJwt = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

// Store encrypted data in sessionStorage
const storeEncryptedData = (key: string, value: string): void => {
  try {
    sessionStorage.setItem(key, value);
  } catch (error) {
    console.error('Error storing encrypted data:', error);
  }
};

type MenuItem = {
  title: string;
  icon?: string;
  type: 'submenu' | 'item';
  path?: string;
  children?: MenuItem[];
};

const findFirstAllowedPath = (
  originalMenu: MenuItem[],
  allowedMenu: any[]
): string => {
  const isMenuAllowed = (menuTitle: string, allowedMenus: any[]): boolean => {
    for (const permission of allowedMenus) {
      if (permission.menu_name === menuTitle) return true;
      if (permission.title === menuTitle) return true;
    }
    return false;
  };

  const isSubMenuAllowed = (subMenuTitle: string, parentMenu: string, allowedMenus: any[]): boolean => {
    for (const permission of allowedMenus) {
      if (permission.menu_name === parentMenu && permission.allowed_sub_menus) {
        for (const subMenu of permission.allowed_sub_menus) {
          if (subMenu.title === subMenuTitle) return true;
          if (subMenu.allowed_sub_menus) {
            for (const deepSubMenu of subMenu.allowed_sub_menus) {
              if (deepSubMenu.title === subMenuTitle) return true;
            }
          }
        }
      }
    }
    return false;
  };

  const dfs = (items: MenuItem[], parentTitle: string | null = null, rootParent: string | null = null): string | null => {
    for (const item of items) {
      if (item.type === 'item') {
        if (!parentTitle) {
          if (isMenuAllowed(item.title, allowedMenu)) {
            return item.path || null;
          }
        } else {
          const rootMenuTitle = rootParent || parentTitle;
          if (isSubMenuAllowed(item.title, rootMenuTitle, allowedMenu)) {
            return item.path || null;
          }
        }
      }
      if (item.type === 'submenu') {
        const newRootParent = rootParent || (parentTitle ? parentTitle : item.title);
        const path = dfs(item.children || [], item.title, newRootParent);
        if (path) return path;
      }
    }
    return null;
  };

  return dfs(originalMenu) || '/sodTerminal/terminalHome';
};

const AuthCallback = () => {
  console.log("AuthCallback component mounted!");
  
  const navigate = useNavigate();
  const location = useLocation();
  const { ssoLogin } = useAuthStore();
  
  const hasRunRef = useRef(false); // Prevent multiple runs
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const completeLogin = async () => {
      if (hasRunRef.current) {
        console.log("Already processing authentication, skipping...");
        return; // Skip if already run
      }

      hasRunRef.current = true;
      console.log("Starting SSO auth callback...");
      console.log("Current URL:", window.location.href);
      console.log("Search params:", location.search);

      // Check if we have the auth code in URL params
      const urlParams = new URLSearchParams(location.search);
      const code = urlParams.get('code');

      console.log("urlParams code ===>", code);

      if (!code) {
        console.error("No authorization code found in URL");
        sessionStorage.clear();
        setError("No authorization code found. Please try logging in again.");
        return;
      }

      try {
        // Call the SSO login method which follows the same pattern as regular login
        console.log("Calling SSO login with code:", code);
        await ssoLogin(code);
        
        // Get latest user state after SSO login
        const currentUser = useAuthStore.getState().user;
        console.log("currentUser after SSO:", currentUser);

        if (currentUser?.is_authenticated) {
          // Decode & persist Keycloak user id (sub) if token exists
          const token = sessionStorage.getItem("access_token") || '';
          if (token) {
            const claims = decodeJwt(token);
            const kcUserId = claims?.sub ?? null;
            console.log("🔑 Keycloak User ID (sub):", kcUserId ?? "(missing)");
            if (kcUserId) sessionStorage.setItem("KC_SUB", kcUserId);
          }

          // Calculate home path based on user permissions
          let homePath = '/sodTerminal/terminalHome'; // Default path
          if (currentUser?.allowedPages?.length > 0) {
            homePath = findFirstAllowedPath(menuData.menuItems as MenuItem[], currentUser.allowedPages);
          }

          console.log("SSO Authentication successful, navigating to:", homePath);
          navigate(homePath, { replace: true });
        } else {
          throw new Error("Authentication failed - user not authenticated");
        }
      } catch (err) {
        console.error("SSO Auth failed:", err);
        console.error("Full error details:", {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          url: window.location.href
        });

        // Clear any partial auth data
        sessionStorage.clear();

        // Show error message
        const errorMessage = axios.isAxiosError(err)
          ? err.response?.data?.msg || err.message || "SSO authentication failed. Please try logging in again."
          : err instanceof Error
          ? err.message
          : "SSO authentication failed. Please try logging in again.";

        setError(errorMessage);
        console.error("SSO Authentication failed:", errorMessage);
      }
    };

    completeLogin();
  }, [location.search, navigate, ssoLogin]);

  console.log("AuthCallback component rendering...");
  console.log("Current URL:", window.location.href);
  console.log("Current pathname:", window.location.pathname);
  console.log("Search params:", window.location.search);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-white to-gray-100 text-gray-700">
        <div className="bg-white p-6 rounded-2xl shadow-lg flex flex-col items-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-red-600">Authentication Failed</h2>
          <p className="text-sm text-gray-600 text-center">{error}</p>
          <button
            onClick={() => {
              sessionStorage.clear();
              navigate("/");
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

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
        <h2 className="text-lg font-semibold">🔐 Processing Keycloak Authentication...</h2>
        <p className="text-sm text-gray-500 text-center">Please wait while we exchange your auth code for tokens</p>
        <p className="text-xs text-gray-400 text-center">Current URL: {window.location.pathname}</p>
        <p className="text-xs text-gray-400 text-center">Check browser console for detailed logs</p>
      </div>
    </div>
  );
};

export default AuthCallback;

