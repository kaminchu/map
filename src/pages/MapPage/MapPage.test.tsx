import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapPage } from "./MapPage";

vi.mock("../../map/createMap", () => ({
  createMap: () => ({
    remove: vi.fn(),
  }),
}));

describe("MapPage", () => {
  it("renders without repeatedly updating", () => {
    render(<MapPage />);

    expect(screen.getByLabelText("国土地理院の地図")).toBeInTheDocument();
  });
});
