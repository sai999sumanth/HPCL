import React, { useState, useEffect } from "react";
import PageWrapper from "@/components/layout/PageWrapper";
import { ArrowLeft } from "lucide-react";
import { apiClient } from "@/services/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubMenu {
  title: string;
  allowed_sub_menus?: SubMenu[];
}

export interface AllowedPage {
  menu_name: string;
  allowed_sub_menus: string[];
}

export interface Role {
  id: number;
  name: string;
  status: "Active" | "Inactive" | boolean;
  bu?: string[];
  allowed_pages: AllowedPage[];
}

export interface ModuleDefinition {
  menu_name: string;
  description: string;
  allowed_sub_menus: SubMenu[];
}

// Flatten all titles (including nested) from a SubMenu tree
const flattenSubMenus = (subMenus: SubMenu[]): string[] => {
  const titles: string[] = [];
  const traverse = (items: SubMenu[]) => {
    items.forEach((item) => {
      titles.push(item.title);
      if (item.allowed_sub_menus?.length) traverse(item.allowed_sub_menus);
    });
  };
  traverse(subMenus);
  return titles;
};

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md";
}) {
  const track = size === "sm" ? "w-8 h-[18px]" : "w-9 h-5";
  const thumb = size === "sm" ? "w-[13px] h-[13px]" : "w-[16px] h-[16px]";
  const onLeft = size === "sm" ? "left-[16px]" : "left-[18px]";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={!disabled ? onChange : undefined}
      className={`relative ${track} rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-300 ${checked ? "bg-blue-600" : "bg-gray-300"
        } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-[2px] ${thumb} rounded-full bg-white shadow-sm transition-all duration-200 ${checked ? onLeft : "left-[2px]"
          }`}
      />
    </button>
  );
}

// ─── PermissionsPanel — 3-column, all toggles ─────────────────────────────────

interface PermissionsPanelProps {
  allowed_pages: AllowedPage[];
  moduleDefinitions: ModuleDefinition[];
  onChange: (allowed_pages: AllowedPage[]) => void;
}

function PermissionsPanel({ allowed_pages, moduleDefinitions, onChange }: PermissionsPanelProps) {

  const isMenuEnabled = (menuName: string) =>
    allowed_pages.some((p) => p.menu_name === menuName);

  const getEnabledTitles = (menuName: string): string[] =>
    allowed_pages.find((p) => p.menu_name === menuName)?.allowed_sub_menus ?? [];

  // ── Toggle top-level module ──────────────────────────────────────────────
  const toggleMenu = (menuName: string) => {
    if (isMenuEnabled(menuName)) {
      // Turn OFF → remove from list entirely
      onChange(allowed_pages.filter((p) => p.menu_name !== menuName));
    } else {
      // Turn ON → add with empty sub-menus
      onChange([...allowed_pages, { menu_name: menuName, allowed_sub_menus: [] }]);
    }
  };

  // ── Toggle a sub-menu (col 2): auto-selects/deselects all its nested items ──
  const toggleSubMenu = (menuName: string, subMenu: SubMenu) => {
    const existing = allowed_pages.find((p) => p.menu_name === menuName);
    if (!existing) return;

    // All titles in this subMenu tree (self + all descendants)
    const allTitles = flattenSubMenus([subMenu]);
    const allOn = allTitles.every((t) => existing.allowed_sub_menus.includes(t));

    let updated: string[];
    if (allOn) {
      // Turn OFF → remove all titles in this subtree
      updated = existing.allowed_sub_menus.filter((t) => !allTitles.includes(t));
    } else {
      // Turn ON → add all titles in this subtree
      updated = [...new Set([...existing.allowed_sub_menus, ...allTitles])];
    }

    onChange(
      allowed_pages.map((p) =>
        p.menu_name === menuName ? { ...p, allowed_sub_menus: updated } : p
      )
    );
  };

  // ── Toggle a nested item (col 3) individually ────────────────────────────
  const toggleNestedItem = (menuName: string, nestedTitle: string, parentSubMenu: SubMenu) => {
    const existing = allowed_pages.find((p) => p.menu_name === menuName);
    if (!existing) return;

    const isOn = existing.allowed_sub_menus.includes(nestedTitle);
    let updated: string[];

    if (isOn) {
      // Turn OFF nested item
      updated = existing.allowed_sub_menus.filter((t) => t !== nestedTitle);
      // If no more children of parentSubMenu are on, also remove parentSubMenu title
      const siblingTitles = flattenSubMenus(parentSubMenu.allowed_sub_menus ?? []);
      const anyOtherSiblingOn = siblingTitles
        .filter((t) => t !== nestedTitle)
        .some((t) => updated.includes(t));
      if (!anyOtherSiblingOn) {
        updated = updated.filter((t) => t !== parentSubMenu.title);
      }
    } else {
      // Turn ON nested item → also ensure its parent sub-menu title is included
      updated = [...new Set([...existing.allowed_sub_menus, nestedTitle, parentSubMenu.title])];
    }

    onChange(
      allowed_pages.map((p) =>
        p.menu_name === menuName ? { ...p, allowed_sub_menus: updated } : p
      )
    );
  };

  // ── Derive checked state ─────────────────────────────────────────────────
  const isSubMenuOn = (enabledTitles: string[], subMenu: SubMenu): boolean => {
    const all = flattenSubMenus([subMenu]);
    return all.length > 0 && all.every((t) => enabledTitles.includes(t));
  };

  const isSubMenuPartial = (enabledTitles: string[], subMenu: SubMenu): boolean => {
    const all = flattenSubMenus([subMenu]);
    const count = all.filter((t) => enabledTitles.includes(t)).length;
    return count > 0 && count < all.length;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      {/* Sticky header */}
      <div className="grid grid-cols-[200px_280px_2fr] bg-slate-50 border-b-2 border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-2 text-[12px] font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
          Module
        </div>
        <div className="px-4 py-2 text-[12px] font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
          Sub-menu
        </div>
        <div className="px-4 py-2 text-[12px] font-bold text-gray-700 uppercase tracking-wider">
          Nested items
        </div>
      </div>

      {moduleDefinitions.map((mod) => {
        const menuEnabled = isMenuEnabled(mod.menu_name);
        const enabledTitles = getEnabledTitles(mod.menu_name);
        const topLevel = mod.allowed_sub_menus;
        const rows = topLevel.length > 0 ? topLevel : [null as SubMenu | null];

        return (
          <div key={mod.menu_name} className="border-b border-gray-200">
            {/* Single grid container for entire module */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: "200px 280px 2fr",
                gridTemplateRows: `repeat(${rows.length}, auto)`
              }}
            >
              {/* Module cell - spans all rows */}
              <div
                className="px-4 py-3 border-r border-gray-200 flex items-start"
                style={{ gridColumn: 1, gridRow: `1 / span ${rows.length}` }}
              >
                <div className="flex items-start gap-2.5 w-full">
                  {/* Checkbox for module */}
                  <button
                    type="button"
                    onClick={() => toggleMenu(mod.menu_name)}
                    className={`w-[15px] h-[15px] mt-0.5 rounded-[3px] border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${menuEnabled
                        ? "border-blue-600 bg-blue-600"
                        : "border-gray-300 bg-white"
                      }`}
                    aria-checked={menuEnabled}
                    aria-label={mod.menu_name}
                    role="checkbox"
                  >
                    {menuEnabled && (
                      <span className="text-white text-[10px] font-bold leading-none">✓</span>
                    )}
                  </button>
                  <span
                    className="w-[3px] h-5 rounded-sm flex-shrink-0 mt-0.5 transition-colors"
                    style={{ background: menuEnabled ? "#2563eb" : "#d1d5db" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-900 leading-tight truncate">
                      {mod.menu_name}
                    </p>
                    {mod.description && (
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight line-clamp-2">
                        {mod.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Sub-menu and nested items rows */}
              {rows.map((subMenu, rowIdx) => {
                // ── Col 2: sub-menu toggle ──────────────────────────────────
                let subMenuCell: React.ReactNode = null;
                if (subMenu) {
                  const on = isSubMenuOn(enabledTitles, subMenu);
                  subMenuCell = (
                    <div className="flex items-center justify-between w-full gap-3 pt-0.5">
                      <span
                        className={`text-[12px] font-medium leading-tight ${menuEnabled ? "text-gray-800" : "text-gray-400"
                          }`}
                      >
                        {subMenu.title}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Toggle
                          checked={on}
                          onChange={() => { if (menuEnabled) toggleSubMenu(mod.menu_name, subMenu); }}
                          disabled={!menuEnabled}
                          label={`Toggle ${subMenu.title}`}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                }

                // ── Col 3: nested item toggles ──────────────────────────────
                let nestedCell: React.ReactNode = null;
                if (subMenu && subMenu.allowed_sub_menus && subMenu.allowed_sub_menus.length > 0) {
                  const subMenuOn = isSubMenuOn(enabledTitles, subMenu) || isSubMenuPartial(enabledTitles, subMenu);
                  nestedCell = (
                    <div className="flex flex-col divide-y divide-gray-100 w-full">
                      {subMenu.allowed_sub_menus.map((nested) => {
                        const nestedOn = enabledTitles.includes(nested.title);
                        return (
                          <div
                            key={nested.title}
                            className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0"
                          >
                            <span
                              className={`text-[12px] leading-tight ${menuEnabled && subMenuOn ? "text-gray-700" : "text-gray-400"
                                }`}
                            >
                              {nested.title}
                            </span>
                            <Toggle
                              checked={nestedOn}
                              onChange={() =>
                                toggleNestedItem(mod.menu_name, nested.title, subMenu)
                              }
                              disabled={!menuEnabled}
                              label={`Toggle ${nested.title}`}
                              size="sm"
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                } else if (subMenu) {
                  nestedCell = (
                    <span className="text-[10px] text-gray-500 italic">–</span>
                  );
                }

                return (
                  <React.Fragment key={rowIdx}>
                    {/* Col 2 — Sub-menu */}
                    <div
                      className={`px-4 py-3 border-r border-gray-200 flex items-start ${rowIdx < rows.length - 1 ? "border-b border-gray-100" : ""
                        }`}
                      style={{ gridColumn: 2, gridRow: rowIdx + 1 }}
                    >
                      {subMenuCell}
                    </div>

                    {/* Col 3 — Nested items */}
                    <div
                      className={`px-4 py-3 flex items-start ${rowIdx < rows.length - 1 ? "border-b border-gray-100" : ""
                        }`}
                      style={{ gridColumn: 3, gridRow: rowIdx + 1 }}
                    >
                      {nestedCell}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── AddRole ──────────────────────────────────────────────────────────────────

interface AddRoleProps {
  initialRole?: Role | null;
  onSave: (role: Role) => void;
  onCancel: () => void;
  onRefresh?: () => void;
}

export function AddRole({ initialRole, onSave, onCancel, onRefresh }: AddRoleProps) {
  const [roleName, setRoleName] = useState(initialRole?.name ?? "");
  // Initialize selectedBu from initialRole if it exists
  const [selectedBu, setSelectedBu] = useState<string[]>(() => {
    if (initialRole && (initialRole as any)?.bu) {
      const bu = (initialRole as any).bu;
      return Array.isArray(bu) ? bu : [bu];
    }
    return [];
  });
  const [buDropdownOpen, setBuDropdownOpen] = useState(false);
  const [roleStatus, setRoleStatus] = useState<"Active" | "Inactive">(
    initialRole
      ? initialRole.status === true || initialRole.status === "Active"
        ? "Active"
        : "Inactive"
      : "Active"
  );
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setBuDropdownOpen(false);
    };
    if (buDropdownOpen) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [buDropdownOpen]);
  const [moduleDefinitions, setModuleDefinitions] = useState<ModuleDefinition[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(false);

  const normalizeAllowedPages = (pages: any[] | undefined): AllowedPage[] => {
    if (!pages || !Array.isArray(pages)) return [];
    const flatten = (subMenus: any[]): string[] => {
      const titles: string[] = [];
      const traverse = (items: any[]) => {
        items.forEach((item) => {
          const title = typeof item === "string" ? item : item?.title || "";
          if (title) titles.push(title);
          if (item && typeof item === "object" && Array.isArray(item.allowed_sub_menus)) {
            traverse(item.allowed_sub_menus);
          }
        });
      };
      traverse(subMenus);
      return titles.filter(Boolean);
    };
    return pages.map((page: any) => ({
      menu_name: page.menu_name || "",
      allowed_sub_menus: Array.isArray(page.allowed_sub_menus)
        ? flatten(page.allowed_sub_menus)
        : [],
    }));
  };

  const [allowed_pages, setAllowedPages] = useState<AllowedPage[]>(
    normalizeAllowedPages(initialRole?.allowed_pages)
  );
  const [nameError, setNameError] = useState("");

  const fetchModuleDefinitions = async () => {
    setIsLoadingModules(true);
    try {
      const response = await apiClient.post("/api/roles/get_menu_submenu_details", {});
      if (response.data && response.data.status === true) {
        const data = response.data.data || [];
        const normalizeSubMenus = (items: any[]): SubMenu[] =>
          items
            .map((item) => {
              const subMenu: SubMenu = {
                title: typeof item === "string" ? item : item?.title || "",
              };
              if (
                item &&
                typeof item === "object" &&
                Array.isArray(item.allowed_sub_menus)
              ) {
                subMenu.allowed_sub_menus = normalizeSubMenus(item.allowed_sub_menus);
              }
              return subMenu;
            })
            .filter((sm) => sm.title);
        const normalized = data.map((item: any) => ({
          menu_name: item.menu_name || "",
          description: item.description || "",
          allowed_sub_menus: Array.isArray(item.allowed_sub_menus)
            ? normalizeSubMenus(item.allowed_sub_menus)
            : [],
        }));
        setModuleDefinitions(normalized);
      }
    } catch (error) {
      console.error("Error fetching module definitions:", error);
    } finally {
      setIsLoadingModules(false);
    }
  };

  useEffect(() => {
    fetchModuleDefinitions();
  }, []);

  const handleSave = async () => {
    if (!roleName.trim()) {
      setNameError("Role name is required.");
      return;
    }

    const reconstructSubMenus = (subMenus: SubMenu[], enabledTitles: string[]): any[] =>
      subMenus
        .map((sm) => {
          const hasEnabledChild =
            sm.allowed_sub_menus?.some(
              (child) => reconstructSubMenus([child], enabledTitles).length > 0
            ) || false;
          if (enabledTitles.includes(sm.title) || hasEnabledChild) {
            const node: any = { title: sm.title };
            if (sm.allowed_sub_menus?.length) {
              const nested = reconstructSubMenus(sm.allowed_sub_menus, enabledTitles);
              if (nested.length > 0) node.allowed_sub_menus = nested;
            }
            return node;
          }
          return null;
        })
        .filter(Boolean);

    const formattedAllowedPages = allowed_pages.map((page) => {
      const moduleDef = moduleDefinitions.find((m) => m.menu_name === page.menu_name);
      const nestedSubMenus = moduleDef
        ? reconstructSubMenus(moduleDef.allowed_sub_menus, page.allowed_sub_menus)
        : page.allowed_sub_menus.map((title) => ({ title }));
      return { menu_name: page.menu_name, allowed_sub_menus: nestedSubMenus };
    });

    try {
      const response = await apiClient.post("/api/roles/create_role_ui", {
        role_name: roleName.trim(),
        bu: selectedBu,
        allowed_pages: formattedAllowedPages,
      });
      const success =
        (Array.isArray(response.data) && response.data[0] === true) ||
        response.data?.status === true;
      if (success) {
        onSave({
          id: initialRole?.id ?? Date.now(),
          name: roleName.trim(),
          status: roleStatus,
          bu: selectedBu,
          allowed_pages,
        });
        onRefresh?.();
      } else {
        const errorMsg =
          (Array.isArray(response.data) && response.data[1]) ||
          response.data?.message ||
          "Unknown error";
        console.error("Error saving role:", errorMsg);
      }
    } catch (error) {
      console.error("Error saving role:", error);
    }
  };

  return (
    <PageWrapper state={initialRole ? "edit-role" : "add-role"}>
      <style>{`
        .bu-dropdown-button::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex-shrink-0 pt-2 pb-3 bg-gray-50 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center justify-center hover:opacity-70 transition-opacity"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5 text-gray-900" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900">
                {initialRole ? "Edit Role" : "Add New Role"}
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                {initialRole ? "Update Role" : "Save Role"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col px-1 overflow-hidden gap-1">
          {/* Role details row at top */}
          <div className="flex-shrink-0">
            <div className="flex items-start gap-4 px-1">
              {/* Role Name */}
              <div className="flex-1">
                <label
                  htmlFor="role-name"
                  className="block text-[12px] font-semibold text-gray-900 mb-1"
                >
                  Role name
                </label>
                <input
                  id="role-name"
                  type="text"
                  value={roleName}
                  onChange={(e) => {
                    setRoleName(e.target.value);
                    setNameError("");
                  }}
                  placeholder="e.g. Admin"
                  className={`w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none transition-all bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 ${nameError ? "border-red-400" : ""
                    }`}
                />
                {nameError && (
                  <p className="text-red-500 text-[9px] mt-1">{nameError}</p>
                )}
              </div>

              {/* SBU Multi-Select */}
              <div className="flex-1">
                <label className="block text-[12px] font-semibold text-gray-900 mb-1">SBU</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBuDropdownOpen(!buDropdownOpen);
                    }}

                    className="w-full px-3 text-xs border border-gray-200 rounded-lg outline-none transition-all bg-white text-gray-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-left flex items-center gap-1 overflow-x-auto overflow-y-hidden bu-dropdown-button"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none", height: "32px", minHeight: "32px", maxHeight: "32px" }}
                  >
                    {selectedBu.length > 0 ? (
                      <div className="flex items-center gap-1 flex-nowrap" style={{ WebkitOverflowScrolling: "touch" }}>
                        {selectedBu.map((bu) => (
                          <span
                            key={bu}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-800 rounded text-[10px] font-medium flex-shrink-0"
                          >
                            {bu}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBu(selectedBu.filter((b) => b !== bu));
                              }}
                              className="ml-0.5 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">Select BU</span>
                    )}
                  </button>
                  {buDropdownOpen && (
                    <div
                      className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {["RO", "LPG", "SOD", "DS"].map((option) => (
                        <div
                          key={option}
                          onClick={() => {
                            if (selectedBu.includes(option)) {
                              setSelectedBu(selectedBu.filter((b) => b !== option));
                            } else {
                              setSelectedBu([...selectedBu, option]);
                            }
                          }}
                          className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${selectedBu.includes(option) ? "bg-blue-50 text-blue-800" : "text-gray-900"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedBu.includes(option)}
                            readOnly
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          {option}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-start">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="text-[11px] font-semibold text-gray-900">Active</h3>
                    <p className="text-[9px] text-gray-400 mt-0.5">
                      Inactive roles cannot be assigned.
                    </p>
                  </div>
                  <Toggle
                    checked={roleStatus === "Active"}
                    onChange={() =>
                      setRoleStatus(roleStatus === "Active" ? "Inactive" : "Active")
                    }
                    label="Toggle active status"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Permissions section takes full remaining space */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="border border-gray-200 rounded-lg overflow-hidden h-full flex flex-col bg-white">
              <div className="p-2 border-b border-gray-200 bg-slate-100 flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-900 pl-3 border-l-[3px] border-blue-600">
                  Permissions
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {isLoadingModules ? (
                  <div className="p-4 text-gray-500 text-sm">Loading permissions...</div>
                ) : (
                  <PermissionsPanel
                    allowed_pages={allowed_pages}
                    moduleDefinitions={moduleDefinitions}
                    onChange={setAllowedPages}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}







