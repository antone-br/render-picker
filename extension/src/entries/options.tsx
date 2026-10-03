import { createRoot } from "react-dom/client";

import { OptionsPage } from "../ui/options-page";

const el = document.getElementById("root");
if (el) createRoot(el).render(<OptionsPage />);
