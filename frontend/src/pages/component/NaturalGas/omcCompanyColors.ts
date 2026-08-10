/**
 * Natural Gas JV / entity colours — HPCL, HOGPL, BGL.
 * Palette: #9fdef0, #2a5d78, #f5a954 (in entity order below).
 */
export const OMC_COMPANY_NAMES = ["HPCL", "HOGPL", "BGL"] as const;
export type OmcCompanyName = (typeof OMC_COMPANY_NAMES)[number];

export const OMC_COMPANY_HEX: Record<OmcCompanyName, string> = {
  HPCL: "#9fdef0",
  HOGPL: "#2a5d78",
  BGL: "#f5a954",
};

/** Data field keys (state cluster rows, filters, APIs) */
export const OMC_FIELD_KEYS = ["hpcl", "hogpl", "bgl"] as const;
export type OmcFieldKey = (typeof OMC_FIELD_KEYS)[number];

export function hexToAm5Int(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}
