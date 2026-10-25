# Deployment Checks

[Deployment Checks](https://vercel.com/docs/deployment-checks) hold each production deployment until every required check passes, then assign production domains automatically. Vercel keeps building from Git, and only a tested build goes live.

- Keep auto-assignment of production domains on. The checks decide when it happens.
- Add checks in **Settings → Build and Deployment → Deployment Checks**.
- **Force Promote** bypasses the checks; do not use it to work around failures unless the user explicitly requests that release and understands which checks are being skipped.

| Source | What it checks |
| --- | --- |
| Vercel ([native](https://vercel.com/docs/deployment-checks#native-deployment-checks)) | Runs the `lint` and `typecheck` (or `type-check`, `check-types`) scripts from `package.json`, skipping a check with no matching script. Each check can be limited to specific environments |
| GitHub | Commit statuses and GitHub Actions check runs on the deployed commit. Requires Vercel for GitHub |
| Integrations | Marketplace integrations for testing, monitoring, and observability |

## Test Each Deployment with GitHub Actions

Vercel sends the `vercel.deployment.ready` [repository dispatch event](https://vercel.com/docs/git/vercel-for-github#repository-dispatch-events) after it creates a deployment and before checks run. Configure this automation only when the user requests deployment checks. A dispatch event is a signal to verify a deployment, not proof that its URL or commit is safe for credentials.

Use this workflow order:

1. From a trusted workflow on the protected default branch, look up the deployment through authenticated Vercel tools or the [deployment API](https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url). Verify the approved team, project, environment, deployment URL, and commit against that response. Do not print the full API response; it can include private environment data. Reject missing or mismatched metadata before using a bypass secret.
2. Run a reviewed test harness from the protected branch with `contents: read` and checkout's `persist-credentials: false`. Do not check out and execute `client_payload.git.sha` merely because the event names it. To test code from another commit with credentials, first require review of that exact commit in a protected CI environment.
3. Set `BASE_URL` to the verified deployment origin, not the raw dispatch payload. Give the bypass secret only to the test step, and use the cookie fixture below. Keep application/deployment tokens out of the test job.
4. If commit status reporting was requested, use a separate reporting job with only the permissions required by `vercel/repository-dispatch/actions/status`, pinned to a reviewed commit SHA. That job must not check out or execute deployment code. It must report the actual test result for the verified commit; do not report success merely because the reporting job ran.

For CLI deployments, the staged-production example in the main skill already passes an authenticated deployment URL to tests and gates promotion on their result. Never bypass failed checks to make this workflow pass.

## Reach Protected Deployments from CI

[Standard Protection](https://vercel.com/docs/deployment-protection#standard-protection) covers every URL except production domains, including the URL of a production deployment waiting on checks.

**Browser tests:** have the user configure a [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation) secret directly in the protected CI environment. Use one authenticated request to the verified deployment origin to obtain Vercel's scoped bypass cookie. Disable redirects for that exchange so the raw secret cannot be forwarded to another URL. Subsequent browser requests use the cookie jar; do not put the bypass secret in global `extraHTTPHeaders` or URL parameters.

```ts
// tests/fixtures.ts; protected tests import test and expect from this fixture.
import { test as base, expect } from '@playwright/test';

export { expect };
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (!baseURL || !bypass) throw new Error('Verified BASE_URL and CI bypass secret are required');
    const deployment = new URL(baseURL);
    if (deployment.protocol !== 'https:' || deployment.username || deployment.password) {
      throw new Error('Expected the verified HTTPS deployment origin');
    }
    const response = await context.request.get(deployment.origin, {
      headers: {
        'x-vercel-protection-bypass': bypass,
        'x-vercel-set-bypass-cookie': 'true',
      },
      maxRedirects: 0,
    });
    const location = response.headers().location;
    if (location && new URL(location, deployment.origin).origin !== deployment.origin) {
      throw new Error('Deployment authentication redirected outside the verified origin');
    }
    const cookies = await context.cookies(deployment.origin);
    const authenticated = cookies.some(cookie => cookie.name === '_vercel_jwt' && cookie.secure &&
      cookie.domain.replace(/^\./, '') === deployment.hostname);
    if (response.status() >= 400 || !authenticated) {
      throw new Error('Deployment authentication did not establish a cookie');
    }
    await use(context);
  },
});
```

Set Playwright's `baseURL` from the verified `BASE_URL`. Keep traces and exported `storageState` disabled for these authenticated tests, or handle them as secrets without publishing them as CI artifacts. [Playwright shares cookies between `context.request` and the browser context](https://playwright.dev/docs/api/class-apirequestcontext), so the fixture needs no saved authentication file.

**Scripted requests:** when the user requests it, add GitHub Actions as a [Trusted Source](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources#add-a-github-actions-service) instead of storing a secret. Scope the rule to the repository and environments the job may reach. Grant only the relevant job `id-token: write`, send the token from `core.getIDToken()` only to the verified deployment origin in the `x-vercel-trusted-oidc-idp-token` header, and disable automatic redirects for that request. Never log or expose the token.

For agent or local access to a protected URL: `⤳ skill: access-protected-vercel-deployment`.
