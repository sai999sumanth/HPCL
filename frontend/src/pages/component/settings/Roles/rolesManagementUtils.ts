export const ROLES_LIST_FIELDS = [
  "id",
  "name",
  "status",
  "permissions"
] as const;

export function isRoleStatusActive(role: any): boolean {
  const statusRaw = role?.status ?? role?.enable;
  return (
    statusRaw === true ||
    statusRaw === 1 ||
    String(statusRaw).toLowerCase() === "active"
  );
}

export function rolesStatusFilterValue(data: any): string {
  return isRoleStatusActive(data) ? "Active" : "Inactive";
}

export function rolesBuFilterValue(data: any): string {
  const bu = data?.bu;
  const buValues = Array.isArray(bu) ? bu : bu == null ? [] : [bu];
  return buValues
    .map((item: any) => String(item ?? "").trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(", ");
}

export function rolesMenuFilterValue(data: any): string {
  const allowedPages = data?.allowed_pages || [];
  if (!Array.isArray(allowedPages) || allowedPages.length === 0) {
    return "";
  }
  return allowedPages
    .map((page: any) => page.menu_name)
    .filter(Boolean)
    .sort()
    .join(", ");
}

export function rolesSubMenuFilterValue(data: any): string {
  const allowedPages = data?.allowed_pages || [];
  if (!Array.isArray(allowedPages) || allowedPages.length === 0) {
    return "";
  }
  
  const allSubMenus: string[] = [];
  
  const getSubMenuTitle = (sm: any): string => {
    if (typeof sm === "string") {
      return sm;
    }
    if (sm && typeof sm === "object" && sm.title) {
      return sm.title;
    }
    return "";
  };
  
  allowedPages.forEach((page: any) => {
    if (Array.isArray(page.allowed_sub_menus)) {
      page.allowed_sub_menus.forEach((sm: any) => {
        const title = getSubMenuTitle(sm);
        if (title) {
          allSubMenus.push(title);
        }
      });
    }
  });
  
  return allSubMenus.sort().join(", ");
}

// Helper functions to collect all unique menu/submenu items from roles data
export function collectAllUniqueMenus(roles: any[]): string[] {
  const menus = new Set<string>();
  roles.forEach(role => {
    const allowedPages = role?.allowed_pages || [];
    if (Array.isArray(allowedPages)) {
      allowedPages.forEach(page => {
        if (page?.menu_name) {
          menus.add(page.menu_name);
        }
      });
    }
  });
  return Array.from(menus).sort();
}

export function collectAllUniqueSubMenus(roles: any[]): string[] {
  const subMenus = new Set<string>();
  roles.forEach(role => {
    const allowedPages = role?.allowed_pages || [];
    if (Array.isArray(allowedPages)) {
      allowedPages.forEach(page => {
        const pageSubMenus = page?.allowed_sub_menus || [];
        if (Array.isArray(pageSubMenus)) {
          pageSubMenus.forEach(sm => {
            let title = "";
            if (typeof sm === "string") {
              title = sm;
            } else if (sm && typeof sm === "object" && sm.title) {
              title = sm.title;
            }
            if (title) {
              subMenus.add(title);
            }
          });
        }
      });
    }
  });
  return Array.from(subMenus).sort();
}

export function escapeCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
