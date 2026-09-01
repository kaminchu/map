import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "../../stores/uiStore";
import { Toasts } from "./Toast";

describe("Toasts", () => {
  beforeEach(() => useUiStore.setState({ toasts: [] }));

  it("keeps the toast shadow clear of the bottom navigation", () => {
    useUiStore.getState().addToast({ kind: "error", message: "操作に失敗しました。" });

    render(<Toasts />);

    const container = screen.getByRole("status").parentElement;
    expect(container).not.toBeNull();
    expect(getComputedStyle(container!).bottom).toBe(
      "calc(6rem + env(safe-area-inset-bottom))",
    );
  });
});
