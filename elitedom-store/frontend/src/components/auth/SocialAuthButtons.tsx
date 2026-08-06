"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { oauthLogin } from "@/lib/auth-api";
import type { CustomerSession } from "@/types/store";

type GoogleCredentialResponse = { credential?: string };
type GoogleAccounts = {
  id: {
    initialize: (options: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
    }) => void;
    renderButton: (
      element: HTMLElement,
      options: { theme: "outline"; size: "large"; width: number; text: "continue_with" },
    ) => void;
  };
};
type AppleAuthorization = { authorization?: { id_token?: string } };
type AppleAuth = {
  auth: {
    init: (options: {
      clientId: string;
      scope: string;
      redirectURI: string;
      usePopup: boolean;
    }) => void;
    signIn: () => Promise<AppleAuthorization>;
  };
};

type ProviderWindow = Window & {
  google?: { accounts: GoogleAccounts };
  AppleID?: AppleAuth;
};

type Props = {
  continueWithApple: string;
  onError: (message: string) => void;
  onSession: (session: CustomerSession) => void;
  providerUnavailable: string;
};

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const appleClientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ?? "";

export function SocialAuthButtons({
  continueWithApple,
  onError,
  onSession,
  providerUnavailable,
}: Props) {
  const googleButton = useRef<HTMLDivElement>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [appleReady, setAppleReady] = useState(false);
  const [isAppleLoading, setAppleLoading] = useState(false);

  useEffect(() => {
    if (!googleReady || !googleClientId || !googleButton.current) return;
    const providerWindow = window as ProviderWindow;
    const google = providerWindow.google;
    if (!google) return;
    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        if (!response.credential) {
          onError(providerUnavailable);
          return;
        }
        void oauthLogin("google", response.credential)
          .then(onSession)
          .catch((error: unknown) =>
            onError(error instanceof Error ? error.message : providerUnavailable),
          );
      },
    });
    googleButton.current.replaceChildren();
    google.accounts.id.renderButton(googleButton.current, {
      theme: "outline",
      size: "large",
      width: 360,
      text: "continue_with",
    });
  }, [googleReady, onError, onSession, providerUnavailable]);

  useEffect(() => {
    if (!appleReady || !appleClientId) return;
    const apple = (window as ProviderWindow).AppleID;
    if (!apple) return;
    apple.auth.init({
      clientId: appleClientId,
      scope: "name email",
      redirectURI: `${window.location.origin}/signin`,
      usePopup: true,
    });
  }, [appleReady]);

  async function handleAppleSignIn() {
    const apple = (window as ProviderWindow).AppleID;
    if (!apple || !appleClientId) {
      onError(providerUnavailable);
      return;
    }
    setAppleLoading(true);
    try {
      const result = await apple.auth.signIn();
      const idToken = result.authorization?.id_token;
      if (!idToken) throw new Error(providerUnavailable);
      onSession(await oauthLogin("apple", idToken));
    } catch (error) {
      onError(error instanceof Error ? error.message : providerUnavailable);
    } finally {
      setAppleLoading(false);
    }
  }

  const hasProvider = Boolean(googleClientId || appleClientId);

  return (
    <div className="grid gap-3">
      {googleClientId && (
        <>
          <Script
            onLoad={() => setGoogleReady(true)}
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
          />
          <div className="flex min-h-11 justify-center overflow-hidden" ref={googleButton} />
        </>
      )}

      {appleClientId && (
        <>
          <Script
            onLoad={() => setAppleReady(true)}
            src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
            strategy="afterInteractive"
          />
          <button
            className="button-secondary w-full disabled:cursor-wait disabled:opacity-60"
            disabled={!appleReady || isAppleLoading}
            onClick={handleAppleSignIn}
            type="button"
          >
            <span aria-hidden="true">●</span>
            {isAppleLoading ? "…" : continueWithApple}
          </button>
        </>
      )}

      {!hasProvider && (
        <p className="rounded-xl border border-border bg-elevated px-4 py-3 text-center text-xs leading-5 text-muted">
          {providerUnavailable}
        </p>
      )}
    </div>
  );
}
