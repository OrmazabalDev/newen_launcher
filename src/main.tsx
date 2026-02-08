import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Id del contenedor raíz donde React monta toda la aplicación.
const ROOT_ELEMENT_ID = "root";

// Elemento del DOM donde se inicializa React.
const rootElement = document.getElementById(ROOT_ELEMENT_ID);

if (!rootElement) {
  throw new Error(`No se encontró el elemento #${ROOT_ELEMENT_ID} en el DOM.`);
}

// Raíz de React para renderizar la aplicación.
const reactRoot = ReactDOM.createRoot(rootElement);

// Render principal con StrictMode para detectar problemas en desarrollo.
reactRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
