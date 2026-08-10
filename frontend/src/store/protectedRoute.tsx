import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuthStore from "@/store/authStore";
import { useEffect, useState } from "react";
import ApiLoader from "@/services/apiLoader";

interface ProtectedRouteProps {
  requiredPermission?: string;
}

const ProtectedRoute = ({ requiredPermission }: ProtectedRouteProps) => {
  const { user, isLoading, checkAuth, authChecked } = useAuthStore();
  const location = useLocation();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setIsInitializing(false);
    };

    if (!authChecked) {
      initAuth();
    } else {
      setIsInitializing(false);
    }
  }, [checkAuth, authChecked]);

  // Show loading state while checking authentication
  if (isLoading || isInitializing) {
    return <ApiLoader loading={true} />;
  }

  // Only make routing decisions after auth check is complete
  if (!user?.is_authenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  // Check for specific page permission if required
  if (requiredPermission && !user.allowedPages.includes(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
