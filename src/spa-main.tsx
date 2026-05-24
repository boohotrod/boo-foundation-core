import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { StandaloneLogin } from "./StandaloneLogin";
import "./styles.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);
const pathname = window.location.pathname;

if (pathname === "/" || pathname === "/login") {
  root.render(<StandaloneLogin />);
} else {
  const router = getRouter();
  root.render(<RouterProvider router={router} />);
}
