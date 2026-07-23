# Python Code Generator with GitHub Integration — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

An invite-only Telegram bot that generates Python code from natural language prompts, creates downloadable ZIP archives of generated projects, and optionally uploads selected files to a GitHub repository with explicit user confirmation. All interactions occur within the team's Telegram chat.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- invite-only team members
- Python developers
- power users

## Success criteria

- Code generation with file previews
- ZIP archive delivery
- GitHub upload confirmation workflow
- Invite-only access enforcement

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu for code generation
- **Upload to GitHub** (button, actor: user, callback: github:upload) — Initiate GitHub upload workflow
  - inputs: repo name, branch name, file path
  - outputs: commit summary
- **Get ZIP** (button, actor: user, callback: zip:generate) — Generate ZIP archive of current project
  - inputs: project ID
  - outputs: Telegram file attachment

## Flows

### Code Generation
_Trigger:_ /start or text message

1. Receive natural language prompt
2. Generate Python files
3. Display preview with action buttons

_Data touched:_ Request, Generated Project

### GitHub Upload
_Trigger:_ github:upload callback

1. Request target repository
2. Validate branch/path
3. Confirm upload
4. Execute commit

_Data touched:_ GitHub link/commit

### ZIP Delivery
_Trigger:_ zip:generate callback

1. Package current project files
2. Generate ZIP archive
3. Send as Telegram file

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: persistent)_ — Telegram account with invite access
  - fields: telegram_id, github_oauth_token
- **Request** _(retention: session)_ — Code generation prompt and context
  - fields: prompt_text, generated_files
- **Generated Project** _(retention: persistent)_ — Directory structure and file contents
  - fields: file_tree, code_contents
- **ZIP package** _(retention: session)_ — Archive of generated project
  - fields: archive_data, expiration_time
- **GitHub Commit** _(retention: persistent)_ — Upload metadata and audit trail
  - fields: repo_name, commit_sha, uploaded_files

## Integrations

- **Telegram** (required) — Bot API messaging and file delivery
- **GitHub** (required) — Code repository uploads
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Manage invite whitelist
- Configure GitHub OAuth tokens
- Set project retention TTL

## Notifications

- Code generation status
- ZIP readiness
- GitHub upload success/failure

## Permissions & privacy

- Invite-only access via telegram_id whitelist
- Explicit GitHub upload confirmation
- No automatic credential storage

## Edge cases

- Expired project data
- GitHub API rate limits
- Unauthorized access attempts

## Required tests

- End-to-end code generation -> ZIP download
- GitHub upload confirmation workflow
- Invite boundary enforcement

## Assumptions

- Admin manages invite list via telegram_id
- GitHub uploads use per-team OAuth token
- 7-day project retention TTL
