import React from "react";
import { createRoot } from "react-dom/client";
import { getArcadeCoreInfo } from "@bbh/arcade-core";

export function ArcadeClientShell(): JSX.Element {
  const coreInfo = getArcadeCoreInfo();

  return (
    <main>
      <h1>BBH Arcade</h1>
      <p>Core {coreInfo.version}</p>
    </main>
  );
}

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <ArcadeClientShell />
    </React.StrictMode>
  );
}
