import React from "react";
import { Menu } from "lucide-react";
import type { IHeaderParams } from "ag-grid-community";

export function ManualUserGridHeader(props: IHeaderParams) {
  const openFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    props.api.showColumnFilter(props.column);
  };
  const onSortClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.progressSort?.(e.shiftKey);
  };

  return (
    <div
      className="flex flex-row items-center justify-center gap-1.5 w-full h-full px-1 text-white"
      role="presentation"
    >
      <button
        type="button"
        className="text-xs font-semibold whitespace-nowrap bg-transparent border-0 p-0 text-white cursor-pointer hover:underline"
        onClick={onSortClick}
      >
        {props.displayName}
      </button>
      <button
        type="button"
        className="rounded p-0 text-white hover:bg-white/15 shrink-0 border-0 bg-transparent cursor-pointer flex items-center justify-center"
        aria-label="Open manual user filter"
        onClick={openFilter}
      >
        <Menu
          className="h-3.5 w-3.5 shrink-0 opacity-95"
          strokeWidth={2}
          aria-hidden
        />
      </button>
    </div>
  );
}
