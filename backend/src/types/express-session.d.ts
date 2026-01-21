import 'express-session';

declare module 'express-session' {
  interface SessionData {
    oktaState?: string;
    oktaNonce?: string;
    oktaRedirectUri?: string;
  }
}
