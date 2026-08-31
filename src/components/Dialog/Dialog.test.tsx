import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("closes from the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open title="確認" onClose={onClose}>
        内容
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
