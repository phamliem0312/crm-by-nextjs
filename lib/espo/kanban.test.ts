import { describe, expect, it } from "vitest";
import { kanbanStatusField, moveKanbanItem, type KanbanGroup } from "./kanban";
import type { Metadata } from "./types";

const groups: KanbanGroup[] = [
  { name: "A", total: 3, list: [{ id: "1", stage: "A" }, { id: "2", stage: "A" }, { id: "3", stage: "A" }] },
  { name: "B", total: 1, list: [{ id: "4", stage: "B" }] },
];

describe("moveKanbanItem", () => {
  it("moves a card to another group at the given index", () => {
    const result = moveKanbanItem(groups, "2", "B", 0, "stage");

    expect(result[0].list.map((item) => item.id)).toEqual(["1", "3"]);
    expect(result[0].total).toBe(2);
    expect(result[1].list).toEqual([{ id: "2", stage: "B" }, { id: "4", stage: "B" }]);
    expect(result[1].total).toBe(2);
  });

  it("reorders inside a group without changing totals", () => {
    const result = moveKanbanItem(groups, "1", "A", 2, "stage");

    expect(result[0].list.map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(result[0].total).toBe(3);
  });

  it("ignores unknown ids", () => {
    expect(moveKanbanItem(groups, "x", "B", 0, "stage")).toBe(groups);
  });
});

describe("kanbanStatusField", () => {
  it("needs kanbanViewMode and an existing status field", () => {
    const metadata: Metadata = {
      scopes: { Opportunity: { statusField: "stage" }, Case: { statusField: "status" } },
      clientDefs: { Opportunity: { kanbanViewMode: true }, Case: {} },
      entityDefs: { Opportunity: { fields: { stage: { type: "enum" } } }, Case: { fields: { status: { type: "enum" } } } },
    };

    expect(kanbanStatusField(metadata, "Opportunity")).toBe("stage");
    expect(kanbanStatusField(metadata, "Case")).toBeNull();
  });
});
