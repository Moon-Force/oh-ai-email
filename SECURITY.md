# Security Policy

## Reporting a Vulnerability

Email the maintainers at the address listed in GitHub Security advisories or open a private security advisory.
Do not file a public issue for sensitive reports.

We aim to acknowledge within 72 hours.

## Scope

- IMAP/SMTP credential handling, local SQLite encryption, HTML mail sandbox.
- AI routing (cloud vs local) — credential storage and transport.

## Secrets

- Never commit API keys, mail passwords, or tokens. Use OS keychain / `safeStorage`.
- AI settings must state where content goes (cloud vs local).
