import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "./Progress";

describe("Progress", () => {
  it("exposes a numeric accessible progress value", () => {
    render(<Progress value={42} label="ダウンロード" />);
    expect(screen.getByRole("progressbar", { name: "ダウンロード" })).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
    expect(screen.getByText("42%")).toBeInTheDocument();
  });
});
