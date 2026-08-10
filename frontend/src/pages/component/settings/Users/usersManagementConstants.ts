/** Request `fields` for list API — only these keys are returned (matches /api/users `fields` param). */
export const USERS_LIST_FIELDS = [
  "id",
  "username",
  "first_name",
  "last_name",
  "zone",
  "sap_id",
  "bu",
  "novex_role",
  "system_role",
  "manual_user",
  "status",
  "is_ad_user",
  "file_path",
  "login_user_id",
] as const;

export const BU_OPTIONS = ["RO", "LPG", "TAS", "DS"] as const;

/** Toolbar list filter: first row means “no BU restriction” on the API. */
export const BU_ALL_LABEL = "All";
