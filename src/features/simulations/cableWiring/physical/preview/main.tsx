import { createRoot } from "react-dom/client";

import "@/styles/index.css";
import { PhysicalCableChallenge } from "../PhysicalCableChallenge";
import { PRACTICE_BENCH } from "../setup";

/** Development-only entry for preview/index.html. Not imported by the app. */
createRoot(document.getElementById("root")!).render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
