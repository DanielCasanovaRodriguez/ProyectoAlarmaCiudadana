
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import { installFriendlyToasts } from "./utils/friendlyToasts";
  import "leaflet/dist/leaflet.css";
  import "./index.css";

  installFriendlyToasts();

  createRoot(document.getElementById("root")!).render(<App />);
