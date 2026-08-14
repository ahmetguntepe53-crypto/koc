import { useEffect } from "react";
import { api, getToken, setToken } from "../api.js";

// Kimlik doğrulama: oturum geri yükleme/giriş/çıkış/şifremi unuttum. PP'deki aynı desen (setter'ları
// parametre olarak alan domain hook'u) — composition root state'i sahiplenir, bu hook yalnızca ona
// yazar.
export function useAuthSession({ setAuthUser, setAuthChecked, setScreen }) {
  useEffect(() => {
    const token = getToken();
    if (!token) { setAuthChecked(true); return; }
    api.me()
      .then(({ user }) => { if (!getToken()) return; setAuthUser(user); })
      .catch(() => setToken(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    setToken(res.token);
    setAuthUser(res.user);
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setAuthUser(null);
    setScreen("login");
  };

  const forgotPassword = (email) => api.forgotPassword(email);

  return { login, logout, forgotPassword };
}
