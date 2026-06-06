import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DemoCatalog } from "./DemoCatalog";

describe("DemoCatalog", () => {
  it("renders the available demos grouped by topic", () => {
    const router = createMemoryRouter([{ path: "/", element: <DemoCatalog /> }]);

    render(<RouterProvider router={router} />);

    expect(
      screen.getByRole("heading", {
        name: "Filtering and sample rate conversion",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Digital communications" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Live spectral analysis" }),
    ).toBeInTheDocument();

    expect(screen.getByText("Windowed FIR Low-Pass Designer")).toBeInTheDocument();
    expect(screen.getByText("RRC Roll-Off Explorer")).toBeInTheDocument();
    expect(screen.getByText("Live Microphone Audio Analyzer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rrc roll-off explorer/i })).toHaveAttribute(
      "href",
      "/demo/rrc-rolloff",
    );
  });
});
