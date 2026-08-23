import { useAuth } from "./AuthContext";
import { useRNBridge } from "./RNBridgeContext";

export function useEffectiveAuth() {
  const web = useAuth();       // tu auth actual (Firebase)
  const rn = useRNBridge();    // lo que llega desde WebView

  const effectiveUser = web.user || rn.rnUser;
  const isAuthed = !!effectiveUser;

  return {
    ...web,               // mantiene loading/login/register/logout igual
    rnUser: rn.rnUser,    // opcional por si lo quieres
    user: effectiveUser,  // ✅ user final para la app
    isAuthed,             // ✅ authed final
  };
}
