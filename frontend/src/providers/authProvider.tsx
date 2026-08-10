import useAuthStore from "@/store/authStore";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import menuData from '../components/layout/menuData.json';
import ApiLoader from "@/services/apiLoader";

const PUBLIC_ROUTES = ['/', '/forgot-password', '/register'];

type MenuItem = {
  title: string;
  icon?: string;
  type: 'submenu' | 'item';
  path?: string;
  children?: MenuItem[];
};

type AllowedMenuItem = { //
  menu_name: string;
  allowed_sub_menus: string[];
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

  return dfs(originalMenu) || '/dnc/home/wall';
};

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { checkAuth, user, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [initialAuthCheckComplete, setInitialAuthCheckComplete] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setInitialAuthCheckComplete(true);
    };
    initAuth();
  }, []);

  // When user logs out in another tab, storage event fires here → clear auth and redirect to login
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'logout-event') {
        useAuthStore.setState({ user: null, error: null });
        navigate('/', { replace: true });
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [navigate]);

  useEffect(() => {
    // Don't perform any redirects until initial auth check is complete
    if (!initialAuthCheckComplete || isLoading) return;

    const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname);
    let homePath = '/dnc/home/wall'; // Default: NOVEX dashboard

    if (user?.allowedPages?.length > 0) {
      homePath = findFirstAllowedPath(menuData.menuItems as MenuItem[], user.allowedPages);
    }

    const from = location.state?.from || homePath;

    // Only redirect if user is not authenticated and trying to access private route
    if (!user?.is_authenticated && !isPublicRoute) {
      navigate('/', {
          replace: true,
          state: { from: location.pathname }
      });
      return;
    }
    // Only redirect authenticated users away from public routes if they have a different destination
    if (user?.is_authenticated && isPublicRoute && location.pathname !== from) {
      navigate(from, { replace: true });
    }
  }, [user?.is_authenticated, initialAuthCheckComplete, isLoading, location.pathname]);

  if (isLoading || !initialAuthCheckComplete) {
    return <ApiLoader loading={true} />;
  }

  return children;
};

export default AuthProvider;