import { describe, it, expect } from "vitest";
import { parseError } from "./Error";

describe("error", () => {
  it("parseError undefined", () => {
    expect(parseError("som")).toEqual('unknown "som"');
  });

  it("parseError Error", () => {
    expect(parseError(new Error("som"))).toContain("som");
  });
});
