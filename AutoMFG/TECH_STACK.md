# AutoMFG — Technology Stack & Architecture

This document outlines the complete technology stack, libraries, and architectural patterns utilized in the **AutoMFG** Manufacturing Execution System (MES) application.

---

## ⚡ Core Framework & Build Tooling

* **React 18**: Frontend UI library for building component-based user interfaces.
* **Vite (v8)**: Ultra-fast modern frontend tooling used for local development server and optimized production bundling.
* **JavaScript / ES Modules**: Core application logic utilizing JSX/ESM syntax, paired with TypeScript compiler (`tsc`) for build verification.

---

## 🧭 Routing & State Management

* **React Router DOM (v7)**: Handles client-side routing, protected routes (`<ProtectedRoute>`), module-level access control, and navigation flows.
* **Zustand (v5)**: Lightweight, high-performance global state management used for authentication (`authStore`), Role-Based Access Control (RBAC), and active production metrics.

---

## 📊 Data Visualization & Tables

* **Recharts (v3.8)**: Declarative charting library used for building interactive OEE (Overall Equipment Effectiveness) dashboards, cycle time charts, and quality yield graphs.
* **TanStack React Table (v8)**: Headless utility for constructing powerful, high-performance data grids, work order tables, and quality inspection logs with sorting/filtering capabilities.

---

## 🎨 Styling & Design System

* **Vanilla CSS (`index.css`)**: Fully bespoke, high-fidelity CSS architecture featuring custom CSS variables and utility classes.
* **BMW-Inspired Premium Dark Theme**: Curated dark-mode design system utilizing deep blacks/charcoals (`#000000`, `#0f0f0f`), BMW Blue accents (`#1c69d4`), and vibrant status indicators (Andon alerts, scrap badges).
* **Google Fonts**: Uses **Barlow** (body text) and **Barlow Condensed** (headings, metrics, shift badges) for an authentic industrial/automotive aesthetic.
* **Lucide React (v1.16)**: Comprehensive iconography suite for navigation sidebars, status chips, and action buttons.

---

## ⏱️ Utilities

* **date-fns (v4)**: Modern utility library for precise date, shift time, and timestamp manipulation across handover logs and maintenance schedules.
