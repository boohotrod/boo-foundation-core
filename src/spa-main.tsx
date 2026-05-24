import ReactDOM from "react-dom/client";
import { StandaloneLogin } from "./StandaloneLogin";
import "./styles.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);
const pathname = window.location.pathname;

if (pathname === "/" || pathname === "/login") {
  root.render(<StandaloneLogin />);
} else {
  Promise.all([import("@tanstack/react-router"), import("./router")]).then(
    ([{ RouterProvider }, { getRouter }]) => {
      root.render(<RouterProvider router={getRouter()} />);
    },
  );
}
