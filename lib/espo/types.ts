// Kiểu viết tay cho dữ liệu bootstrap của Espo (App/user, Metadata). Chỉ khai báo phần đang dùng;
// kiểu đầy đủ của REST API sẽ sinh từ /OpenApi (npm run gen:api-types).

export type AclAction = "create" | "read" | "edit" | "delete" | "stream";

export type AclLevel = "all" | "team" | "own" | "no" | "yes";

/** Quyền theo scope: object theo action, hoặc boolean cho scope không phải entity (ví dụ Calendar). */
export type AclScopeData = Partial<Record<AclAction, AclLevel>> | boolean;

export type AclFieldLevels = Partial<Record<"yes" | "no", string[]>>;

export type AclData = {
  table: Record<string, AclScopeData>;
  fieldTable?: Record<string, Record<string, Partial<Record<"read" | "edit", "yes" | "no">>>>;
  fieldTableQuickAccess?: Record<
    string,
    {
      fields?: Partial<Record<"read" | "edit", AclFieldLevels>>;
      attributes?: Partial<Record<"read" | "edit", AclFieldLevels>>;
    }
  >;
  /** Các quyền dạng `assignmentPermission`, `exportPermission`… */
  [permission: `${string}Permission`]: AclLevel | undefined;
};

export type TabDivider = { type: "divider"; text?: string | null; id?: string };

export type TabUrl = {
  type: "url";
  url?: string;
  text?: string | null;
  iconClass?: string | null;
  color?: string | null;
  aclScope?: string | null;
  onlyAdmin?: boolean;
  openInNewTab?: boolean;
  id?: string;
};

export type TabGroup = {
  type?: "group";
  text?: string | null;
  iconClass?: string | null;
  color?: string | null;
  itemList?: TabItem[];
  id?: string;
};

/** Phần tử của `tabList`: tên scope, `_delimiter_`, divider, URL hoặc group. */
export type TabItem = string | TabDivider | TabUrl | TabGroup;

export type Settings = {
  applicationName?: string;
  language?: string;
  timeZone?: string;
  dateFormat?: string;
  timeFormat?: string;
  weekStart?: number;
  thousandSeparator?: string;
  decimalMark?: string;
  tabList?: TabItem[];
  quickCreateList?: string[];
  globalSearchEntityList?: string[];
  scopeColorsDisabled?: boolean;
  tabColorsDisabled?: boolean;
  tabIconsDisabled?: boolean;
  aclAllowDeleteCreated?: boolean;
  cacheTimestamp?: number;
  appTimestamp?: number;
  [key: string]: unknown;
};

export type Preferences = {
  dateFormat?: string | null;
  timeFormat?: string | null;
  timeZone?: string | null;
  weekStart?: number | null;
  language?: string | null;
  thousandSeparator?: string | null;
  decimalMark?: string | null;
  useCustomTabList?: boolean;
  addCustomTabs?: boolean;
  tabList?: TabItem[] | null;
  [key: string]: unknown;
};

export type EspoUser = {
  id: string;
  userName: string;
  name?: string;
  type: "admin" | "regular" | "portal" | "api" | "system" | "super-admin";
  isActive?: boolean;
  teamsIds?: string[];
  avatarColor?: string | null;
  [key: string]: unknown;
};

/** Dữ liệu `GET App/user` gửi xuống client (bỏ `token`). */
export type AppUserData = {
  user: EspoUser;
  acl: AclData;
  preferences: Preferences;
  settings: Settings;
  appParams?: Record<string, unknown>;
  language: string;
};

export type ScopeDefs = {
  entity?: boolean;
  tab?: boolean;
  acl?: boolean | string;
  disabled?: boolean;
  tabAclPermission?: string;
  module?: string;
  [key: string]: unknown;
};

export type ClientDefs = {
  iconClass?: string;
  color?: string;
  [key: string]: unknown;
};

export type Metadata = {
  scopes?: Record<string, ScopeDefs>;
  clientDefs?: Record<string, ClientDefs>;
  [key: string]: unknown;
};
