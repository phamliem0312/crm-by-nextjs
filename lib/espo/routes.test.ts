import { describe, expect, it } from "vitest";
import metadataPhase3 from "./__fixtures__/metadata-phase3.json";
import metadataPhase4 from "./__fixtures__/metadata-phase4.json";
import metadataFixture from "./__fixtures__/metadata-records.json";
import {
  classicHref,
  isNewUiScope,
  recordCreateHref,
  recordEditHref,
  recordViewHref,
  safeClassicHash,
  scopeListHref,
} from "./routes";
import type { Metadata } from "./types";

const metadata = metadataFixture as unknown as Metadata;

describe("routes", () => {
  it("opens business entities in the new UI", () => {
    for (const scope of ["Account", "Contact", "Lead", "Opportunity", "Case", "Task"]) {
      expect(isNewUiScope(scope, metadata)).toBe(true);
    }

    expect(scopeListHref("Account", metadata)).toBe("/Account");
    expect(recordViewHref("Account", "a b", metadata)).toBe("/Account/a%20b");
    expect(recordEditHref("Account", "1", metadata)).toBe("/Account/1/edit");
    expect(recordCreateHref("Account", metadata)).toBe("/Account/create");
  });

  it("opens Meeting/Call and the Stream page in the new UI (phase 3)", () => {
    const withEvents = metadataPhase3 as unknown as Metadata;

    expect(isNewUiScope("Meeting", withEvents)).toBe(true);
    expect(recordViewHref("Call", "c1", withEvents)).toBe("/Call/c1");
    expect(scopeListHref("Stream", metadata)).toBe("/stream");
  });

  it("opens Email, Calendar and Import in the new UI (phase 4)", () => {
    const withEmail = metadataPhase4 as unknown as Metadata;

    expect(isNewUiScope("Email", withEmail)).toBe(true);
    expect(recordViewHref("Email", "e1", withEmail)).toBe("/Email/e1");
    expect(recordCreateHref("Email", withEmail)).toBe("/Email/create");
    expect(scopeListHref("Calendar", metadata)).toBe("/Calendar");
    expect(scopeListHref("Import", metadata)).toBe("/Import");
    expect(recordViewHref("Import", "i1", metadata)).toBe("/Import/i1");
    expect(isNewUiScope("EmailTemplate", withEmail)).toBe(false);
  });

  it("opens custom entities in the new UI", () => {
    const withCustom = {
      ...metadata,
      scopes: { ...metadata.scopes, CProject: { entity: true, object: true, tab: true, isCustom: true } },
    } as Metadata;

    expect(isNewUiScope("CProject", withCustom)).toBe(true);
  });

  it("keeps special, disabled and non-entity scopes in classic", () => {
    expect(isNewUiScope("Campaign", metadata)).toBe(false);
    expect(isNewUiScope("Calendar", metadata)).toBe(false);
    expect(isNewUiScope("NoSuchScope", metadata)).toBe(false);
    expect(isNewUiScope("../x", metadata)).toBe(false);
    expect(isNewUiScope("Account", null)).toBe(false);
    expect(isNewUiScope("Account", { scopes: { Account: { entity: true, object: true, disabled: true } } })).toBe(false);
  });

  it("sends other scopes to classic", () => {
    expect(scopeListHref("Account")).toBe("/classic?to=%23Account");
    expect(recordViewHref("Campaign", "x", metadata)).toBe("/classic?to=%23Campaign%2Fview%2Fx");
    expect(classicHref("Admin")).toBe("/classic?to=%23Admin");
  });

  it.each([
    ["#Admin", "#Admin"],
    ["#Account/view/1", "#Account/view/1"],
    [null, "#"],
    ["Admin", "#"],
    ["https://evil.test", "#"],
    ["#a\nb", "#"],
    ["#a\\b", "#"],
  ])("safeClassicHash(%j) → %j", (value, expected) => {
    expect(safeClassicHash(value)).toBe(expected);
  });
});
