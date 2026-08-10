import type {
  IDoesFilterPassParams,
  IFilterParams,
  IRowNode,
} from "ag-grid-community";

export type AgGridCheckboxFilterParams = {
  /** When set, values for this filter are derived from row data (e.g. joined arrays or full name). */
  filterValueGetter?: (data: any) => any;
  /** When set, only these options appear (no row scan). Values still matched via `filterValueGetter` / cell value. */
  staticValues?: string[];
};

function rowFilterValue(
  params: IFilterParams,
  node: IRowNode | null | undefined
): any {
  const p = params as IFilterParams & {
    filterParams?: AgGridCheckboxFilterParams;
    colDef?: { filterParams?: AgGridCheckboxFilterParams };
  };
  const fp = p.filterParams ?? p.colDef?.filterParams;
  if (!node?.data) return undefined;
  if (typeof fp?.filterValueGetter === "function") {
    return fp.filterValueGetter(node.data);
  }
  return params.getValue(node as IRowNode);
}

/**
 * Excel-style column filter: unique values with checkboxes, search, select/deselect all.
 * Matches the UX used on VTS Insight; optional `filterParams.filterValueGetter` for derived values.
 */
export class AgGridCheckboxFilter {
  private params!: IFilterParams;
  private filterValue = new Set<string>();
  private eGui: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private checkboxContainer: HTMLElement | null = null;
  private allValues: string[] = [];

  private keyFor(value: any): string {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  init(params: IFilterParams) {
    this.params = params;
    this.eGui = document.createElement("div");
    this.eGui.className =
      "p-0 bg-white border border-gray-200 rounded shadow-lg";
    this.eGui.style.minWidth = "250px";
    this.eGui.style.maxHeight = "400px";
    this.eGui.style.display = "flex";
    this.eGui.style.flexDirection = "column";

    const p = this.params as IFilterParams & {
      filterParams?: AgGridCheckboxFilterParams;
      colDef?: { filterParams?: AgGridCheckboxFilterParams };
    };
    const fp = p.filterParams ?? p.colDef?.filterParams;

    if (Array.isArray(fp?.staticValues) && fp.staticValues.length > 0) {
      this.allValues = [...fp.staticValues]
        .map((v) => this.keyFor(v))
        .sort((a, b) => a.localeCompare(b));
    } else {
      const uniqueKeys = new Set<string>();
      this.params.api.forEachNode((node) => {
        if (node.data) {
          const value = rowFilterValue(this.params, node);
          if (value !== null && value !== undefined) {
            uniqueKeys.add(this.keyFor(value));
          }
        }
      });
      this.allValues = Array.from(uniqueKeys).sort((a, b) => a.localeCompare(b));
    }

    const searchContainer = document.createElement("div");
    searchContainer.className = "p-2 border-b border-gray-200";
    searchContainer.style.flexShrink = "0";

    this.searchInput = document.createElement("input");
    this.searchInput.type = "text";
    this.searchInput.placeholder = "Search...";
    this.searchInput.className =
      "w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500";
    this.searchInput.addEventListener("input", () => {
      this.filterCheckboxes();
    });

    searchContainer.appendChild(this.searchInput);
    this.eGui.appendChild(searchContainer);

    this.checkboxContainer = document.createElement("div");
    this.checkboxContainer.style.overflowY = "auto";
    this.checkboxContainer.style.flex = "1";
    this.checkboxContainer.style.minHeight = "0";

    this.allValues.forEach((key) => {
      const label = document.createElement("label");
      label.className =
        "flex items-center gap-2 p-1.5 hover:bg-gray-50 cursor-pointer";
      label.style.display = "flex";
      label.setAttribute("data-value", key);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className =
        "w-4 h-4 text-blue-600 border-gray-300 rounded outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0";
      checkbox.checked = true;
      this.filterValue.add(key);

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this.filterValue.add(key);
        } else {
          this.filterValue.delete(key);
        }
        this.params.filterChangedCallback();
      });

      const span = document.createElement("span");
      const labelText =
        key === ""
          ? "(Blanks)"
          : key === "yes"
            ? "Yes"
            : key === "no"
              ? "No"
              : key;
      span.textContent = labelText;
      span.className = "text-sm text-gray-700";

      label.appendChild(checkbox);
      label.appendChild(span);
      this.checkboxContainer!.appendChild(label);
    });

    this.eGui.appendChild(this.checkboxContainer);

    const buttonContainer = document.createElement("div");
    buttonContainer.className =
      "flex gap-2 p-2 border-t border-gray-200 bg-gray-50";
    buttonContainer.style.flexShrink = "0";

    const selectAllBtn = document.createElement("button");
    selectAllBtn.textContent = "Select All";
    selectAllBtn.className =
      "flex-1 px-2 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors";
    selectAllBtn.addEventListener("click", () => {
      this.filterValue.clear();
      const visibleLabels = this.checkboxContainer!.querySelectorAll(
        'label:not([style*="display: none"])'
      );
      visibleLabels.forEach((label) => {
        const checkbox = label.querySelector(
          'input[type="checkbox"]'
        ) as HTMLInputElement | null;
        if (checkbox) {
          checkbox.checked = true;
          const value = label.getAttribute("data-value");
          if (value !== null) {
            this.filterValue.add(value);
          }
        }
      });
      this.params.filterChangedCallback();
    });

    const deselectAllBtn = document.createElement("button");
    deselectAllBtn.textContent = "Deselect All";
    deselectAllBtn.className =
      "flex-1 px-2 py-1.5 text-xs font-medium bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors";
    deselectAllBtn.addEventListener("click", () => {
      const visibleLabels = this.checkboxContainer!.querySelectorAll(
        'label:not([style*="display: none"])'
      );
      visibleLabels.forEach((label) => {
        const checkbox = label.querySelector(
          'input[type="checkbox"]'
        ) as HTMLInputElement | null;
        if (checkbox) {
          checkbox.checked = false;
          const value = label.getAttribute("data-value");
          if (value !== null) {
            this.filterValue.delete(value);
          }
        }
      });
      this.params.filterChangedCallback();
    });

    buttonContainer.appendChild(selectAllBtn);
    buttonContainer.appendChild(deselectAllBtn);
    this.eGui.appendChild(buttonContainer);
  }

  private filterCheckboxes() {
    if (!this.checkboxContainer || !this.searchInput) return;

    const searchTerm = this.searchInput.value.toLowerCase();
    const labels = this.checkboxContainer.querySelectorAll("label");

    labels.forEach((label) => {
      const value = String(
        label.getAttribute("data-value") || ""
      ).toLowerCase();
      if (value.includes(searchTerm)) {
        label.style.display = "flex";
      } else {
        label.style.display = "none";
      }
    });
  }

  getGui() {
    return this.eGui!;
  }

  private isAllOptionsSelected(): boolean {
    if (this.allValues.length === 0) return true;
    return this.allValues.every((v) => this.filterValue.has(v));
  }

  doesFilterPass(params: IDoesFilterPassParams) {
    if (this.isAllOptionsSelected()) return true;
    if (this.filterValue.size === 0) return false;
    const value = rowFilterValue(this.params, params.node);
    if (value === null || value === undefined) {
      return this.filterValue.has("");
    }
    return this.filterValue.has(this.keyFor(value));
  }

  isFilterActive() {
    if (this.allValues.length > 0 && this.isAllOptionsSelected()) {
      return false;
    }
    if (this.filterValue.size === 0) {
      return this.allValues.length > 0;
    }
    return true;
  }

  getModel() {
    if (!this.isFilterActive()) {
      return null;
    }
    return Array.from(this.filterValue);
  }

  setModel(model: any) {
    if (!this.checkboxContainer) return;

    if (model == null || (Array.isArray(model) && model.length === 0)) {
      this.filterValue = new Set(this.allValues);
      const labels = this.checkboxContainer.querySelectorAll("label");
      labels.forEach((label) => {
        const checkbox = label.querySelector(
          'input[type="checkbox"]'
        ) as HTMLInputElement | null;
        if (checkbox) {
          checkbox.checked = true;
        }
      });
      return;
    }

    if (Array.isArray(model)) {
      this.filterValue = new Set(model);
      const labels = this.checkboxContainer.querySelectorAll("label");
      labels.forEach((label) => {
        const checkbox = label.querySelector(
          'input[type="checkbox"]'
        ) as HTMLInputElement;
        if (checkbox) {
          const value = label.getAttribute("data-value");
          checkbox.checked = value !== null && this.filterValue.has(value);
        }
      });
    }
  }
}
