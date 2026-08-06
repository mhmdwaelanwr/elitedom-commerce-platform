# Stage 4 — Authentication and Session Security

## Delivered scope

- Egyptian mobile sign-in with a six-digit, five-minute OTP.
- Twilio SMS delivery using either a Messaging Service SID or a sender number.
- Development-only debug OTP delivery when Twilio is not configured.
- Per-mobile resend delay, hourly request limit, maximum verification attempts, and single-use challenges.
- Email/password sign-in retained as a supported fallback.
- Google Identity Services browser flow and backend ID-token audience verification.
- Apple Sign in with Apple browser flow and backend JWKS signature/audience verification.
- Stable provider-subject identity linking to prevent duplicate accounts.
- Revocable device sessions with user agent, IP address, expiry, and authentication method.
- Rotating HttpOnly refresh cookies with replay detection.
- Immediate access-token rejection after a tracked session is revoked.
- Account security page for listing sessions, revoking one device, or signing out every device.
- Access tokens remain in React memory and are no longer persisted in browser storage.

## Database migration

`0008_auth_sessions_otp` creates:

- `elitedom_auth_identity`
- `elitedom_auth_session`
- `elitedom_otp_challenge`

The migration supports a full downgrade and replay through the CI migration smoke test.

## Environment variables

### Phone OTP

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`

Development can run without Twilio. The API returns `delivery=debug` and a debug code only while `ENVIRONMENT=development`.

### Google

- `GOOGLE_OAUTH_CLIENT_ID` for backend audience verification.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for the frontend SDK.

Use the same Google Web Client ID for both values. Configure the storefront origins in Google Cloud Console.

### Apple

- `APPLE_OAUTH_CLIENT_ID` for backend audience verification.
- `NEXT_PUBLIC_APPLE_CLIENT_ID` for the frontend SDK.

Use the Apple Service ID for both values and register the exact storefront `/signin` return URL in Apple Developer settings.

`NEXT_PUBLIC_*` variables are embedded at image build time and are forwarded through Docker Compose build arguments.

## Security decisions

- OTP codes are never stored in plaintext; the database stores an HMAC digest.
- Refresh tokens are never returned in JSON or stored by JavaScript.
- Only a SHA-256 digest of each current refresh token is persisted.
- A replayed rotated refresh token revokes its entire device session.
- New access tokens contain a `sid`; protected endpoints verify that session is still active.
- Legacy access tokens without `sid` remain valid only until their existing short expiry to allow a safe rollout.
- Google and Apple accounts are keyed by verified provider subject rather than mutable email alone.
- Internal synthetic email identifiers required by the existing Partner schema are hidden from phone users.

## Validation matrix

- Email/password login creates a tracked session.
- Phone OTP creates or reuses one verified phone account.
- OTP cannot be reused and locks after repeated incorrect attempts.
- Refresh rotates the credential and replay revokes the session.
- Current and remote sessions can be revoked.
- Sign out all devices invalidates every associated access token.
- English and Arabic sign-in and security pages.
- Light and dark themes.
- Google/Apple buttons remain hidden safely until public client identifiers are configured.

## Deferred

- Redis-backed distributed OTP/IP rate limiting for multi-instance production deployments.
- MFA enrollment for administrator roles.
- Email verification and password recovery flows.
- Native mobile deep-link OAuth callbacks.
- Passkeys/WebAuthn.
