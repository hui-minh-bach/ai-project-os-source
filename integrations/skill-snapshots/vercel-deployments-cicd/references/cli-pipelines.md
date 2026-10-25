# CLI Pipelines

These pipelines build and deploy with the Vercel CLI. Each needs the variables described in the skill's Required Environment Variables section. The user configures the token directly in protected CI secrets; do not collect or display its value. Enable a pipeline only when the user requests deployment automation for that repository and environment.

## Preview Deployments on PRs

The Git integration already provides preview URLs. When a custom CLI build is necessary, require a reviewer to approve the exact PR commit in a protected `preview-deploy` environment before it can access deployment or application secrets. Store the token in that environment, not repository-wide secrets. The same-repository guard below excludes forks; it does not make PR code trusted. Never switch to `pull_request_target` to expose secrets to forks. This workflow retains the URL as job output and does not post comments.

```yaml
# GitHub Actions
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read

env:
  VERCEL_ORG_ID: ${{ vars.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ vars.VERCEL_PROJECT_ID }}
  VERCEL_CLI_VERSION: ${{ vars.VERCEL_CLI_VERSION }}

jobs:
  preview:
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    environment: preview-deploy
    outputs:
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false
      - run: npm install -g "vercel@${VERCEL_CLI_VERSION:?set a reviewed exact version}"
      - run: vercel pull --yes --environment=preview
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      - run: vercel build
      - id: deploy
        run: |
          set -euo pipefail
          deployment_url="$(vercel deploy --prebuilt)"
          DEPLOYMENT_URL="$deployment_url" node --input-type=module -e '
            const value = process.env.DEPLOYMENT_URL;
            const url = new URL(value);
            if (url.protocol !== "https:" || url.origin !== value || !url.hostname.endsWith(".vercel.app")) process.exit(1);
          '
          printf 'url=%s\n' "$deployment_url" >> "$GITHUB_OUTPUT"
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

## GitLab CI

Protect `main` and production CI variables, restrict the deployment environment to authorized maintainers, and require the configured deployment approval. Do not make production variables available to merge-request pipelines. Set a reviewed exact `VERCEL_CLI_VERSION` in CI variables.

```yaml
deploy:
  image: node:20
  stage: deploy
  environment: production
  script:
    - npm install -g "vercel@${VERCEL_CLI_VERSION:?set a reviewed exact version}"
    - vercel pull --yes --environment=production
    - vercel build --prod
    - vercel deploy --prebuilt --prod
  only:
    - main
```

## Bitbucket Pipelines

Restrict the production deployment environment and its secured variables to the protected `main` branch and authorized deployers. Do not expose them to pull-request builds. Set a reviewed exact `VERCEL_CLI_VERSION` in pipeline variables.

```yaml
pipelines:
  branches:
    main:
      - step:
          name: Deploy to Vercel
          deployment: production
          image: node:20
          script:
            - npm install -g "vercel@${VERCEL_CLI_VERSION:?set a reviewed exact version}"
            - vercel pull --yes --environment=production
            - vercel build --prod
            - vercel deploy --prebuilt --prod
```
