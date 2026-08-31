import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles/global.css";
import { Router } from "wouter";
import { App } from "./app/App";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router base={base}>
      <App />
    </Router>
  </StrictMode>,
);
