import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { initNative, hideSplash } from "./native/index.js";

// Native kabukta oturum token'ı Preferences'tan geri yüklenene kadar BEKLENİR — useAuthSession
// mount anında getToken() okuduğu için bu iş React'ten önce bitmeli (bkz. native/index.js).
// Web'de initNative() anında çözülür, davranış değişmez.
initNative().finally(() => {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  hideSplash();
});
