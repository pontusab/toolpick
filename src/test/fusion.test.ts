import { describe, it, expect } from "bun:test";
import { fuseResults } from "../search/fusion";

describe("fuseResults", () => {
  it("fuses two result sets with weighted scores", () => {
    const a = [
      { name: "foo", score: 1.0 },
      { name: "bar", score: 0.5 },
    ];
    const b = [
      { name: "bar", score: 1.0 },
      { name: "baz", score: 0.8 },
    ];

    const fused = fuseResults(a, b, 0.3, 0.7, 10);

    expect(fused.length).toBe(3);
    expect(fused[0].name).toBe("bar");
    expect(fused[0].score).toBeCloseTo(0.3 * 0.5 + 0.7 * 1.0, 5);
  });

  it("respects maxResults", () => {
    const a = [
      { name: "a", score: 3 },
      { name: "b", score: 2 },
      { name: "c", score: 1 },
    ];
    const b = [
      { name: "d", score: 3 },
      { name: "e", score: 2 },
    ];

    const fused = fuseResults(a, b, 0.5, 0.5, 2);
    expect(fused.length).toBe(2);
  });

  it("handles empty first set", () => {
    const b = [{ name: "only", score: 1.0 }];
    const fused = fuseResults([], b, 0.5, 0.5, 10);
    expect(fused.length).toBe(1);
    expect(fused[0].name).toBe("only");
    expect(fused[0].score).toBeCloseTo(0.5, 5);
  });

  it("handles empty second set", () => {
    const a = [{ name: "only", score: 1.0 }];
    const fused = fuseResults(a, [], 0.5, 0.5, 10);
    expect(fused.length).toBe(1);
    expect(fused[0].name).toBe("only");
    expect(fused[0].score).toBeCloseTo(0.5, 5);
  });

  it("handles both sets empty", () => {
    const fused = fuseResults([], [], 0.5, 0.5, 10);
    expect(fused).toEqual([]);
  });

  it("normalizes scores relative to each set's max", () => {
    const a = [{ name: "x", score: 10 }];
    const b = [{ name: "x", score: 100 }];
    const fused = fuseResults(a, b, 0.5, 0.5, 10);
    expect(fused[0].score).toBeCloseTo(1.0, 5);
  });

  it("handles zero scores gracefully", () => {
    const a = [{ name: "x", score: 0 }];
    const b = [{ name: "x", score: 0 }];
    const fused = fuseResults(a, b, 0.5, 0.5, 10);
    expect(fused[0].score).toBe(0);
  });

  it("returns results sorted by score descending", () => {
    const a = [
      { name: "low", score: 0.1 },
      { name: "high", score: 1.0 },
    ];
    const b = [
      { name: "low", score: 0.1 },
      { name: "high", score: 1.0 },
    ];
    const fused = fuseResults(a, b, 0.5, 0.5, 10);
    expect(fused[0].name).toBe("high");
    expect(fused[1].name).toBe("low");
  });
});
