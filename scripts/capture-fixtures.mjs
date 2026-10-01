// Chụp fixture từ API Espo thật cho test Vitest (lib/espo/__fixtures__/).
// Cần ESPO_URL, ESPO_ADMIN_USERNAME/PASSWORD và ESPO_LIMITED_USERNAME/PASSWORD trong .env.local.
// Chỉ giữ các phần test cần, để fixture nhỏ và không chứa dữ liệu nhạy cảm (token, SMTP…).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "lib", "espo", "__fixtures__");
const espoUrl = (process.env.ESPO_URL ?? "").replace(/\/+$/, "");
const apiUrl = (process.env.ESPO_API_URL ?? `${espoUrl}/api/v1`).replace(/\/+$/, "");

if (!espoUrl) {
  throw new Error("Missing ESPO_URL.");
}

const accounts = {
  admin: [process.env.ESPO_ADMIN_USERNAME, process.env.ESPO_ADMIN_PASSWORD],
  limited: [process.env.ESPO_LIMITED_USERNAME, process.env.ESPO_LIMITED_PASSWORD],
};

const SETTINGS_KEYS = [
  "applicationName", "language", "timeZone", "dateFormat", "timeFormat", "weekStart",
  "thousandSeparator", "decimalMark", "currencyList", "defaultCurrency", "baseCurrency",
  "currencyFormat", "currencyDecimalPlaces", "tabList", "quickCreateList", "globalSearchEntityList",
  "scopeColorsDisabled", "tabColorsDisabled", "tabIconsDisabled", "aclAllowDeleteCreated",
  "cacheTimestamp", "appTimestamp", "recordsPerPage", "recordsPerPageSmall",
  // Giai đoạn 3: dashboard, thông báo, stream, export, hoạt động.
  "recordsPerPageKanban", "dashboardLayout", "forcedDashboardLayout", "notificationsCheckInterval",
  "popupNotificationsCheckInterval", "availableReactions", "notePinnedMaxCount", "exportDisabled",
  "exportIdleCountThreshold", "activitiesEntityList", "historyEntityList", "b2cMode",
];

const PREFERENCES_KEYS = [
  "dateFormat", "timeFormat", "timeZone", "weekStart", "language", "thousandSeparator", "decimalMark",
  "useCustomTabList", "addCustomTabs", "tabList",
  "dashboardLayout", "dashletsOptions", "defaultReminders", "defaultRemindersTask", "followEntityOnStreamPost",
];

const RECORD_SCOPES = ["Account", "Contact", "Lead", "Opportunity", "Case", "Task"];

/** Entity của giai đoạn 3 (sự kiện, stream, thông báo). */
const EXTRA_SCOPES = ["Meeting", "Call", "Note", "Notification", "Reminder"];

const LAYOUT_TYPES = ["list", "detail", "filters", "massUpdate", "bottomPanelsDetail", "defaultSidePanel", "listSmall", "sidePanelsDetail", "kanban", "detailConvert"];

const USER_KEYS =["id", "userName", "name", "type", "isActive", "teamsIds", "avatarColor"];

const pick = (object, keys) =>
  Object.fromEntries(keys.filter((key) => object && key in object).map((key) => [key, object[key]]));

const b64 = (value) => Buffer.from(value, "utf8").toString("base64");

async function login([userName, password]) {
  if (!userName || !password) {
    throw new Error("Missing ESPO_*_USERNAME/PASSWORD in .env.local.");
  }

  const response = await fetch(`${apiUrl}/App/user`, {
    headers: { "Espo-Authorization": b64(`${userName}:${password}`), "Espo-Authorization-By-Token": "false" },
  });

  if (!response.ok) {
    throw new Error(`Login as ${userName} failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    data,
    headers: { "Espo-Authorization": b64(`${userName}:${data.token}`), "Espo-Authorization-By-Token": "true" },
  };
}

async function get(headers, path) {
  const response = await fetch(`${apiUrl}/${path}`, { headers });

  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status}`);
  }

  return response.json();
}

function write(name, data) {
  writeFileSync(join(outDir, name), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${name}`);
}

mkdirSync(outDir, { recursive: true });

for (const [kind, credentials] of Object.entries(accounts)) {
  const { data, headers } = await login(credentials);

  write(`app-user-${kind}.json`, {
    user: pick(data.user, USER_KEYS),
    acl: data.acl,
    preferences: pick(data.preferences, PREFERENCES_KEYS),
    settings: pick(data.settings, SETTINGS_KEYS),
    language: data.language,
  });

  const metadata = await get(headers, "Metadata");

  // Chỉ phần navbar/ACL cần: scopes và iconClass/color của clientDefs.
  write(`metadata-${kind}.json`, {
    scopes: metadata.scopes,
    clientDefs: Object.fromEntries(
      Object.entries(metadata.clientDefs ?? {}).map(([scope, defs]) => [scope, pick(defs, ["iconClass", "color"])]),
    ),
  });

  if (kind === "admin") {
    const language = await get(headers, `I18n?language=${encodeURIComponent(data.language)}`);

    write("i18n.json", {
      Global: pick(language.Global, [
        "labels", "messages", "scopeNames", "scopeNamesPlural", "navbarTabs", "lists", "options",
        "streamMessages", "streamMessagesMale", "streamMessagesFemale", "notificationMessages", "reactions",
        "listViewModes", "durationUnits", "dashlets",
      ]),
      User: pick(language.User, ["labels", "messages"]),
      ...Object.fromEntries([...RECORD_SCOPES, "Meeting", "Call", "Note", "Notification", "Export", "Stream"].map((scope) => [scope, language[scope]])),
    });

    // Giai đoạn 3: dashlet, panel phụ, reaction, nhắc nhở, export, entity sự kiện/stream.
    write("metadata-phase3.json", {
      scopes: pick(metadata.scopes, [...RECORD_SCOPES, ...EXTRA_SCOPES]),
      entityDefs: pick(metadata.entityDefs, EXTRA_SCOPES),
      clientDefs: pick(metadata.clientDefs, [...RECORD_SCOPES, ...EXTRA_SCOPES]),
      dashlets: metadata.dashlets,
      streamDefs: metadata.streamDefs,
      app: {
        clientRecord: metadata.app?.clientRecord,
        reactions: metadata.app?.reactions,
        popupNotifications: metadata.app?.popupNotifications,
        export: { formatList: metadata.app?.export?.formatList },
      },
    });

    // Engine bản ghi (giai đoạn 2): metadata + layout của các entity mục tiêu.
    write("metadata-records.json", {
      scopes: pick(metadata.scopes, RECORD_SCOPES),
      entityDefs: pick(metadata.entityDefs, RECORD_SCOPES),
      clientDefs: pick(metadata.clientDefs, RECORD_SCOPES),
      logicDefs: pick(metadata.logicDefs, RECORD_SCOPES),
      entityAcl: pick(metadata.entityAcl, RECORD_SCOPES),
      fields: metadata.fields,
      app: { regExpPatterns: metadata.app?.regExpPatterns, currency: { symbolMap: pick(metadata.app?.currency?.symbolMap, ["USD", "EUR", "VND"]) } },
    });

    const layouts = {};

    for (const scope of RECORD_SCOPES) {
      layouts[scope] = {};

      for (const type of LAYOUT_TYPES) {
        const response = await fetch(`${apiUrl}/${scope}/layout/${type}`, { headers });

        if (response.ok) {
          layouts[scope][type] = await response.json();
        }
      }
    }

    write("layouts.json", layouts);
  }
}
