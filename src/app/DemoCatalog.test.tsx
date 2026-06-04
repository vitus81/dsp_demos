import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DemoCatalog } from "./DemoCatalog";

describe("DemoCatalog", () => {
  it("renders the available demos", () => {
    const router = createMemoryRouter([{ path: "/", element: <DemoCatalog /> }]);

    render(<RouterProvider router={router} />);

    expect(screen.getByText("RRC Roll-Off Explorer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rrc roll-off explorer/i })).toHaveAttribute(
      "href",
      "/demo/rrc-rolloff",
    );
  });
});
