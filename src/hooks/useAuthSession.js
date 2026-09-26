import { useCallback, useEffect } from "react";
import { api, getToken, setToken, setUnauthorizedHandler, NETWORK_ERROR_MESSAGE } from "../api.js";

const SESSION_ENDED_NOTICE = "Oturumun sona erdi — lütfen tekrar giriş yap.";

// Kimlik doğrulama: oturum geri yükleme/giriş/çıkış/şifremi unuttum. PP'deki aynı desen (setter'ları
// parametre olarak alan domain hook'u) — composition root state'i sahiplenir, bu hook yalnızca ona
// yazar.
export function useAuthSession({ setAuthUser, setAuthChecked, setScreen, setAuthError = () => {}, setSessionNotice = () => {} }) {
  // Açılışta kayıtlı token'la oturumu doğrular. Token YALNIZCA sunucu oturumu açıkça reddederse
  // (401 / askıya alınmış hesap) silinir — önceden her hata (uçak modu, zayıf okul Wi-Fi'ı, sunucu
  // yeniden başlarken 502) token'ı silip kullanıcıyı şifresini yeniden girmeye zorluyordu. Ağ/sunucu
  // hatasında token korunur, App "Tekrar dene" ekranı gösterir (bkz. App.jsx > authError).
  const checkSession = useCallback(() => {
    const token = getToken();
    if (!token) { setAuthChecked(true); return Promise.resolve(); }
    return api.me()
      .then(({ user }) => { if (!getToken()) return; setAuthError(""); setAuthUser(user); })
      .catch((err) => {
        if (err.status === 401 || err.code === "BANNED") {
          setToken(null);
          setAuthError("");
        } else {
          setAuthError(err.network ? NETWORK_ERROR_MESSAGE : "Sunucuya şu an ulaşılamıyor — biraz sonra tekrar dene.");
        }
      })
      .finally(() => setAuthChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Oturum içindeyken sunucu token'ı reddederse (bkz. api.js > setUnauthorizedHandler) doğrudan
    // giriş ekranına dönülür ve nedeni orada gösterilir.
    setUnauthorizedHandler((err) => {
      setToken(null);
      setAuthUser(null);
      setScreen("login");
      setSessionNotice(err.code === "BANNED" ? err.message : SESSION_ENDED_NOTICE);
    });
    checkSession();
    return () => setUnauthorizedHandler(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => {
    const res = await api.login(email, password);
    setToken(res.token);
    setSessionNotice("");
    setAuthUser(res.user);
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setAuthUser(null);
    setSessionNotice("");
    setScreen("login");
  };

  const forgotPassword = (email) => api.forgotPassword(email);

  return { login, logout, forgotPassword, retrySession: checkSession };
}
