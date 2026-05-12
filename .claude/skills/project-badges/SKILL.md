---
name: project-badges
description: Generate shields.io badge rows for project READMEs using personal link and project metadata. Use when the user asks to add badges, project links, social links, license badges, or shield badges to a README.
---

# Project Badges

Generate consistent, styled shields.io badge rows for any project README using personal link data stored in `<skill-dir>/assets/badges.yml`.

## When to Use

- User asks to add badges, shields, or social links to a README
- User asks for project link badges or shield.io badges
- User wants to update or refresh existing badges in a README

## Workflow

### 1. Load Badge Data

Read `<skill-dir>/assets/badges.yml`. It contains:
- `style` — global style config (`format`)
- `badges` — list of badge entries, each with `name`, `logo`, `label`, `url`, `logoColor`, `color`

### 2. Ask the User

Before generating, present a numbered list of all badges from the YAML so the caller can select specific ones. Build the list dynamically: use each badge's `name` as the display label, and append the `label` field in parentheses when it differs from the `name`. End with "Which badges would you like? (default: all)".

Also confirm **where to place them** in the README (default: after the first headline and any immediate subheadline/tagline).

### 3. Construct Shields.io URLs

Each badge uses a single-color pattern:

```
https://img.shields.io/badge/LABEL-COLOR?style=FORMAT&logo=LOGO&logoColor=LOGOCOLOR
```

Field mapping:

| URL Field | Source | Notes |
|-----------|--------|-------|
| `LABEL` | badge `label` | Encode: spaces → `_`, literal underscores → `__`, `@` → `%40` |
| `COLOR` | badge `color` | Badge background (per-badge brand color) |
| `FORMAT` | `style.format` | e.g. `for-the-badge` |
| `LOGO` | badge `logo` | Shields.io simple-icons slug |
| `LOGOCOLOR` | badge `logoColor` | |

The icon and text sit together on one solid-colored background.

Wrap each badge as a clickable markdown image:

```markdown
[![ALT](SHIELDS_URL)](BADGE_URL)
```

Where `ALT` is the badge `name` and `BADGE_URL` is the badge `url`.

#### Resolve Placeholders

Some badge `url` values contain `{{repo_url}}` placeholders. Before constructing the final markdown, resolve these:

1. Detect the current repository's remote URL (e.g., via `git remote get-url origin`).
2. Convert SSH remotes (`git@github.com:user/repo.git`) to HTTPS (`https://github.com/user/repo`), stripping any trailing `.git`.
3. Replace all `{{repo_url}}` occurrences in badge URLs with the resolved HTTPS URL.
4. Check whether the default branch (e.g., `main` vs `master`) matches any branch references in the URL. If it differs, replace the branch segment to match.

### 4. Insert or Update

- Place all badges on a **single line**, separated by spaces.
- If badges already exist in the README (look for a line of consecutive `[![` image links pointing to `img.shields.io`), **offer to update** them rather than duplicating.

## Example Output

Given all five badges with default style (assuming `{{repo_url}}` resolves to `https://github.com/CypherPoet/example-repo`):

```markdown
[![X](https://img.shields.io/badge/%40cypher__poet-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/cypher_poet) [![PayPal](https://img.shields.io/badge/PayPal-003087?style=for-the-badge&logo=paypal&logoColor=white)](https://www.paypal.com/ncp/payment/L6M553P28YPDY) [![Cash App](https://img.shields.io/badge/Cash_App-00C244?style=for-the-badge&logo=cashapp&logoColor=white)](https://cash.app/$CypherPoet) [![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=000000)](https://buymeacoffee.com/cypherpoet) [![MIT License](https://img.shields.io/badge/MIT_License-3DA639?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](https://github.com/CypherPoet/example-repo/blob/main/LICENSE)
```
