import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { applyTheme, readTheme } from "@/lib/theme";
import { router } from "@/router";
import "@/styles/globals.css";
import "@/styles/p14-responsive.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Elitedom frontend root element was not found.");
}

applyTheme(readTheme());

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
