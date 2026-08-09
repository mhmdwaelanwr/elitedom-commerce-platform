import { clientEnv } from "@/lib/env";

type GoogleCredentialResponse = { credential?: string };
type GooglePromptNotification = {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
};

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (input: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
      prompt: (callback?: (notification: GooglePromptNotification) => void) => void;
      cancel: () => void;
    };
  };
};

type AppleIdentity = {
  auth: {
    init: (input: {
      clientId: string;
      scope: string;
      redirectURI: string;
      usePopup: boolean;
    }) => void;
    signIn: () => Promise<{ authorization?: { id_token?: string } }>;
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
    AppleID?: AppleIdentity;
  }
}

const scriptPromises = new Map<string, Promise<void>>();

function loadScript(src: string) {
  const existing = scriptPromises.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const found = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (found?.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = found ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("Authentication provider could not be loaded.")), { once: true });
    if (!found) document.head.appendChild(script);
  });
  scriptPromises.set(src, promise);
  return promise;
}

export async function getGoogleIdToken() {
  if (!clientEnv.googleClientId) throw new Error("Google sign-in is not configured yet.");
  await loadScript("https://accounts.google.com/gsi/client");
  if (!window.google) throw new Error("Google sign-in is unavailable.");

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    window.google?.accounts.id.initialize({
      client_id: clientEnv.googleClientId,
      callback: (response) => {
        if (settled) return;
        settled = true;
        if (response.credential) resolve(response.credential);
        else reject(new Error("Google did not return an identity token."));
      },
    });
    window.google?.accounts.id.prompt((notification) => {
      if (settled) return;
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        settled = true;
        const reason = notification.getNotDisplayedReason?.() ?? notification.getSkippedReason?.() ?? "cancelled";
        reject(new Error(`Google sign-in was not completed (${reason}).`));
      }
    });
  });
}

export async function getAppleIdToken() {
  if (!clientEnv.appleClientId) throw new Error("Apple sign-in is not configured yet.");
  await loadScript("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js");
  if (!window.AppleID) throw new Error("Apple sign-in is unavailable.");

  window.AppleID.auth.init({
    clientId: clientEnv.appleClientId,
    scope: "name email",
    redirectURI: `${clientEnv.siteUrl}/auth`,
    usePopup: true,
  });
  const result = await window.AppleID.auth.signIn();
  const token = result.authorization?.id_token;
  if (!token) throw new Error("Apple did not return an identity token.");
  return token;
}
