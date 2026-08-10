// import { create } from 'zustand';
// import menuData from '@/components/layout/menuData.json'; // Your original menu JSON

// interface MenuItem {
//   title: string;
//   icon: string;
//   path?: string;
//   type: string;
//   hidden?: boolean;
//   children?: MenuItem[];
// }

// interface AllowedMenu {
//   menu_name: string;
//   allowed_sub_menus: string[];
// }

// interface MenuState {
//   originalMenu: MenuItem[];
//   allowedMenu: AllowedMenu[];
//   filteredMenu: MenuItem[];
//   setAllowedMenu: (allowedMenu: AllowedMenu[]) => void;
//   filterMenuItems: () => void;
// }

// const useMenuStore = create<MenuState>((set, get) => ({
//   originalMenu: menuData.menuItems,
//   allowedMenu: [],
//   filteredMenu: [],
  
//   setAllowedMenu: (allowedMenu) => {
//     set({ allowedMenu });
//     get().filterMenuItems();
//   },
  
//   filterMenuItems: () => {
//     const { originalMenu, allowedMenu } = get();

//       if (allowedMenu.length === 0) {
//         set({ filteredMenu: originalMenu });
//         return;
//       }
    
//     const filteredMenu = originalMenu.map(menuItem => {
//       // Find if this menu is in allowed menu
//       const allowedMenuConfig = allowedMenu.find(
//         allowed => allowed.menu_name === menuItem.title
//       );
      
//       // If menu isn't allowed at all, mark it as hidden
//       if (!allowedMenuConfig) {
//         return { ...menuItem, hidden: true };
//       }
      
//       // If menu has children, process them based on allowed sub-menus
//       if (menuItem.children) {
//         const processedChildren = menuItem.children.map(child => ({
//           ...child,
//           hidden: !allowedMenuConfig.allowed_sub_menus.includes(child.title)
//         }));
        
//         // Check if any children are visible
//         const hasVisibleChildren = processedChildren.some(child => !child.hidden);
        
//         return {
//           ...menuItem,
//           children: processedChildren,
//           hidden: !hasVisibleChildren
//         };
//       }
      
//       return menuItem;
//     });
    
//     set({ filteredMenu });
//   }
// }));

// export default useMenuStore;








import { create } from 'zustand';
import menuData from '@/components/layout/menuData.json';

interface MenuItem {
  title: string;
  icon: string;
  path?: string;
  type: string;
  hidden?: boolean;
  children?: MenuItem[];
}

interface AllowedSubMenu {
  title: string;
  allowed_sub_menus?: AllowedSubMenu[];
}

interface AllowedMenu {
  menu_name: string;
  allowed_sub_menus: AllowedSubMenu[];
}

interface MenuState {
  originalMenu: MenuItem[];
  allowedMenu: AllowedMenu[];
  filteredMenu: MenuItem[];
  setAllowedMenu: (allowedMenu: AllowedMenu[]) => void;
  filterMenuItems: () => void;
}

const useMenuStore = create<MenuState>((set, get) => ({
  originalMenu: menuData.menuItems,
  allowedMenu: [],
  filteredMenu: [],

  setAllowedMenu: (allowedMenu) => {
    set({ allowedMenu });
    get().filterMenuItems();
  },

  filterMenuItems: () => {
    const { originalMenu, allowedMenu } = get();

    if (allowedMenu.length === 0) {
      set({ filteredMenu: originalMenu });
      return;
    }

    const filterRecursive = (menuItems: MenuItem[], allowedSubMenus: AllowedSubMenu[]): MenuItem[] => {
      return menuItems
        .map(menuItem => {
          const matchedAllowed = allowedSubMenus.find(m => m.title === menuItem.title);

          if (!matchedAllowed) {
            return null;
          }

          let children: MenuItem[] | undefined = undefined;
          if (menuItem.children && matchedAllowed.allowed_sub_menus) {
            children = filterRecursive(menuItem.children, matchedAllowed.allowed_sub_menus);
          }

          return {
            ...menuItem,
            children,
            hidden: false
          };
        })
        .filter(Boolean) as MenuItem[];
    };

    const filtered = originalMenu.map(root => {
      const allowed = allowedMenu.find(a => a.menu_name === root.title);

      if (!allowed) return { ...root, hidden: true };

      const children = root.children
        ? filterRecursive(root.children, allowed.allowed_sub_menus)
        : undefined;

      return {
        ...root,
        children,
        hidden: false,
      };
    });

    set({ filteredMenu: filtered });
  }
}));

export default useMenuStore;