<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

This folder (`backend/`) is a **NestJS Backend-for-Frontend (BFF)** that completes the **Okta OIDC redirect flow** and then issues **your own short-lived app JWT** to a React Native app using a **one-time code exchange**.

It implements:

- `GET /auth/okta/login`: starts Okta login (state + nonce stored in session)
- `GET /auth/okta/callback`: validates state/nonce, exchanges code, reads claims, mints one-time code, redirects to mobile deep-link
- `POST /auth/mobile/exchange`: exchanges one-time code for your **internal** app JWT (short-lived)
- Example protected routes:
  - `GET /me` (requires app JWT)
  - `GET /admin/ping` (requires app JWT + `APP_ADMIN` group)

---

## Okta setup (PLACEHOLDERS)

### 1) Create an OIDC app for NestJS (Web App)

- Okta Admin → **Applications** → **Create App Integration** → **OIDC** → **Web Application**
- **Grant type**: Authorization Code
- **Sign-in redirect URI**: `https://api.company.com/auth/okta/callback`  
  (for local dev you can use `http://localhost:3000/auth/okta/callback`)
- Save:
  - **Client ID**
  - **Client Secret**
- Your **Issuer** will look like:
  - `https://{yourOktaDomain}/oauth2/default` (default auth server), **or**
  - `https://{yourOktaDomain}/oauth2/{customAuthServerId}`

### 2) Send AD/Okta groups in the ID token

- Okta Admin → **Security** → **API** → **Authorization Servers** → (your server) → **Claims** → **Add Claim**
- **Name**: `groups`
- **Include in**: ID Token (Access Token optional)
- **Value type**: Groups
- **Filter**: limit to your app groups (example: `APP_.*`) to keep tokens small

After this, the ID Token should include at least: `sub`, `email`, `groups`.

---

## Local run (dev)

### 1) Install

```bash
cd backend
npm install
```

### 2) Configure env

Copy env example and fill in values:

```bash
cp .env.example .env
```

### 2a) (Optional but recommended) Run Redis locally for session persistence

If you set `REDIS_URL`, the backend stores `express-session` data in Redis (recommended for production-like behavior).

Start Redis via Docker:

```bash
docker run --name okta-bff-redis -p 6379:6379 -d redis:7-alpine
```

Then set:

```bash
REDIS_URL=redis://localhost:6379
```

Required variables (see `.env.example`):

- `SESSION_SECRET`
- `OKTA_ISSUER`
- `OKTA_CLIENT_ID`
- `OKTA_CLIENT_SECRET`
- `OKTA_REDIRECT_URI`
- `APP_JWT_SECRET`

### 3) Start

```bash
npm run start
```

---

## React Native “thin” integration (no native OIDC yet)

## Architecture flow (sequence)

```text
React Native App                 System Browser                NestJS BFF                     Okta
     |                                |                           |                           |
     | open URL                        |                           |                           |
     |-------------------------------> | GET /auth/okta/login       |                           |
     |                                |--------------------------> |                           |
     |                                |                           |  store state/nonce + app redirect_uri in session
     |                                |                           |  302 -> Okta authorize URL
     |                                | <-------------------------|                           |
     |                                | -------------------------->                           |
     |                                |             (user signs in, MFA, policies)            |
     |                                | <--------------------------                           |
     |                                | GET /auth/okta/callback?code&state                    |
     |                                |--------------------------> |                           |
     |                                |                           |  validate state/nonce (session)
     |                                |                           |  exchange code for tokens
     |                                |                           |  read claims: sub/email/groups
     |                                |                           |  create ONE_TIME_CODE (TTL ~ 60s)
     |                                |                           |  302 -> myapp://auth/callback?code=ONE_TIME_CODE
     |                                | <-------------------------|                           |
     | receives deep link (code)       |                           |                           |
     |-------------------------------> |                           |                           |
     | POST /auth/mobile/exchange {code}                           |                           |
     |-----------------------------------------------------------> |                           |
     |                                |                           |  consume ONE_TIME_CODE (one-time)
     |                                |                           |  mint app JWT (15m)
     |                                | <-------------------------|                           |
     | receives {token}               |                           |                           |
     | call APIs with Authorization: Bearer <token>               |                           |
     |----------------------------------------------------------->|                           |
```

---

### Step A: Mobile opens login URL in system browser

Mobile opens (example deep link):

```text
https://api.company.com/auth/okta/login?redirect_uri=myapp://auth/callback
```

This backend stores the `redirect_uri` in the session, then redirects to Okta.

### Step B: After Okta login, backend redirects back with a one-time code

After Okta calls `GET /auth/okta/callback`, the backend redirects to:

```text
myapp://auth/callback?code=ONE_TIME_CODE
```

Important: we **do not** put the JWT in the URL.

### Step C: Mobile exchanges the code for the internal app JWT

Mobile calls:

#### Example: exchange one-time code for app JWT

```bash
curl -X POST http://localhost:3000/auth/mobile/exchange \
  -H 'content-type: application/json' \
  -d '{"code":"ONE_TIME_CODE"}'
```

Response:

```json
{ "token": "<your_app_jwt>", "expiresIn": "15m" }
```

#### Example: call protected APIs with the app JWT

```bash
curl http://localhost:3000/me \
  -H 'authorization: Bearer <your_app_jwt>'
```

```bash
curl http://localhost:3000/admin/ping \
  -H 'authorization: Bearer <your_app_jwt>'
```

---

## Authorization model (groups)

- **Authentication** (login/MFA/policies): Okta (triggered via redirects)
- **Authorization** (what user can do): this backend via `groups` claim (AD → Okta → ID Token)

Example route protection:

- `GET /me`: requires valid internal JWT
- `GET /admin/ping`: requires internal JWT + `APP_ADMIN` group

---

## Production notes

- **Sessions**: configure `REDIS_URL` to persist `express-session` data in Redis (recommended for production). Without `REDIS_URL`, the server uses in-memory sessions (dev only).
- **One-time codes**: current implementation uses an in-memory map. In prod/multi-instance, store codes in Redis with TTL and one-time semantics.
- **HTTPS**: required in prod (secure cookies).
- **Do not log tokens or one-time codes**.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
