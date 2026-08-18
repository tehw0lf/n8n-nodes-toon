# Development Guide

## Project Overview

This is an n8n community node for bidirectional conversion between TOON (Token-Oriented Object Notation) and JSON formats. The implementation follows the **TOON Specification v4.1** (see `SPEC.md`) with **zero external production dependencies**. Archived copies of earlier spec revisions are kept alongside it as `SPEC-v*-archived.md`.

## Development Setup

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode for development
npm run build:watch

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Development mode with n8n
npm run dev
```

## Architecture

```
nodes/Toon/
├── types.ts              # TypeScript interfaces and type definitions
├── ToonUtils.ts          # Core utilities (escaping, quoting, number formatting)
├── ToonEncoder.ts        # JSON → TOON encoder
├── ToonDecoder.ts        # TOON → JSON decoder
├── Toon.node.ts          # Main n8n node implementation
├── Toon.node.json        # Node metadata
├── toon.svg              # Node icon
└── __tests__/            # Test suite (179 tests)
    ├── ToonUtils.test.ts
    ├── ToonEncoder.test.ts
    ├── ToonDecoder.test.ts
    └── integration.test.ts
```

## Operations

1. **JSON to TOON** - Convert JavaScript objects to TOON format
2. **TOON to JSON** - Parse TOON text back to JavaScript objects

## Configuration Options

### Encoding (JSON→TOON)
```typescript
{
  indent: 2,              // Spaces per indentation level
  delimiter: 'comma',     // 'comma' | 'tab' | 'pipe'
  keyFolding: 'off',      // 'off' | 'safe'
  flattenDepth: 999       // Max segments to fold (999 = Infinity)
}
```

### Decoding (TOON→JSON)
```typescript
{
  indent: 2,              // Expected indentation for validation
  strict: true,           // Enforce counts, indentation, rules
  expandPaths: 'off'      // 'off' | 'safe'
}
```

## TOON Specification Compliance

Spec version: tracked in `package.json` field `toonSpecVersion` — see that
file for the current value. It is deliberately not duplicated here, so it
cannot go stale.

Version annotations like *(v3.0.3)* in the table below mark the release that
introduced a given rule; they are historical and intentionally not updated.

| Spec Section | Feature | Implementation | Status |
|---|---|---|---|
| §2 | Canonical number format (no exponent, no trailing zeros, -0→0) | `ToonUtils.canonicalizeNumber` | ✅ |
| §3 | Value normalization (undefined/function/symbol/NaN/Infinity→null) | `ToonEncoder.normalizeValue` | ✅ |
| §3 | `toJSON()` hook honored before normalization *(v3.0.3)* | `ToonEncoder.normalizeValue` | ✅ |
| §4 | Type inference (boolean, null, number, string) | `ToonUtils.parseToken` | ✅ |
| §4 | Forbidden leading zeros in integer part treated as strings *(v3.0.3)* | `ToonUtils.isNumericToken` | ✅ |
| §5 | Root form determination (array / primitive / object) | `ToonDecoder.determineRootForm` | ✅ |
| §6 | Array header parsing (`[N]`, `[N\t]`, `[N\|]`) | `ToonDecoder.parseArrayHeader` | ✅ |
| §7.1 | String escaping (`\\`, `\"`, `\n`, `\r`, `\t`) | `ToonUtils.escapeString` / `unescapeString` | ✅ |
| §7.2 | String quoting rules (reserved words, numbers, delimiters, etc.) | `ToonUtils.needsQuoting` | ✅ |
| §7.3 | Key quoting rules | `ToonUtils.keyNeedsQuoting` | ✅ |
| §8 | Key-value parsing | `ToonDecoder.parseObject` | ✅ |
| §9.3 | Tabular array detection (uniform objects with primitive values) | `ToonUtils.isUniformArray`, `ToonEncoder.encodeTabular` | ✅ |
| §9.3 | Non-whitespace between `]` and `{`/`:` → fall-through to key-value *(v3.0.3)* | `ToonDecoder.isValidArrayHeader` | ✅ |
| §11 | Delimiter scoping (comma / tab / pipe) | `ToonDecoder.parseDelimitedTokens`, `ToonEncoder.encodePrimitiveArray` | ✅ |
| §12 | No trailing newline | `ToonEncoder.encode` | ✅ |
| §13.4 | Key folding (safe mode, dotted paths) | `ToonEncoder.foldKeys` | ✅ |
| §13.4 | Path expansion (safe mode) | `ToonDecoder.expandPaths` | ✅ |
| §14 | Strict mode: indentation, array counts, tab errors | `ToonDecoder.parseLines`, `parseArray`, `parseTabularArray` | ✅ |
| §14 | Strict mode: invalid array header (non-whitespace between `]` and `{`/`:`) *(v3.0.3)* | `ToonDecoder.isInvalidArrayHeader` | ✅ |

## Testing

```bash
# Run all tests (179 tests)
npm test
```

## Pre-commit Checklist

Before committing changes:

```bash
npm run lint && npm run test && npm run build
```

All commands must pass with exit code 0.

## Local Testing with n8n

```bash
# In this directory
npm run build
npm link

# In your n8n installation directory
npm link n8n-nodes-toon

# Restart n8n
npm run start  # or n8n start
```

## Publishing to npm

```bash
# Ensure all checks pass
npm run lint && npm run test && npm run build

# Verify package contents
npm pack
tar -tzf n8n-nodes-toon-*.tgz

# Publish (requires npm account and NPM_TOKEN)
npm publish
```

## Error Handling

Custom error types:
- `ToonEncodingError` - Issues during JSON→TOON conversion
- `ToonDecodingError` - Issues during TOON→JSON parsing (includes line numbers)

All errors integrate with n8n's `NodeOperationError` for proper workflow error handling.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass and coverage remains high
6. Submit a pull request

## Automated Monitoring Workflows

### Specification Monitoring

An automated GitHub Actions workflow monitors the official TOON specification for updates:

**Workflow:** `.github/workflows/monitor-spec.yml`

**Schedule:** Every Monday at 9:00 AM UTC (can be triggered manually)

**Behavior:**
- Fetches the latest `SPEC.md` from https://github.com/toon-format/spec
- Compares version and date against our local copy
- Opens a GitHub issue if changes are detected (with diff summary)
- Prevents duplicate issues for the same version
- Adds reminder comments to existing open issues

**Spec versioning nuance:**

The specification lives in its own repository (`toon-format/spec`), separate
from the reference implementation (`toon-format/toon`). It versions
independently of its content, so a new release does **not** imply the spec text
changed — v3.3.0, v3.3.1, and v3.3.2 all ship a byte-identical `SPEC.md`, with
only repo tooling changing between them.

The workflow therefore compares content as well as version numbers, and labels
the issue accordingly:

- **Content changed** → "TOON Specification Update Available", full review
  checklist plus diff.
- **Content identical** → "TOON Spec Version Bump (no content change)". Only
  bump `toonSpecVersion` in `package.json` and take a patch bump on our own
  version; `SPEC.md`, `nodes/Toon/`, and the tests stay untouched.

Note that `toonSpecVersion` tracks the spec repo, which is a different version
line from the `@toon-format/toon` reference implementation — do not conflate
the two.

**Manual Trigger:**
```bash
# Via GitHub UI: Actions → Monitor TOON Specification → Run workflow
# Or via gh CLI:
gh workflow run monitor-spec.yml
```

### Security Monitoring

An automated workflow performs comprehensive security scanning:

**Workflow:** `.github/workflows/security-scan.yml`

**Schedule:** Daily at 2:00 AM UTC (also on dependency changes)

**Security Checks:**
- **Source Code:** Semgrep analysis (OWASP Top 10, security-audit, CI rules)
- **Dependencies:** npm audit for known vulnerabilities
- **Artifacts:** Trivy scanning on built packages
- **Published Package:** npm audit on the live published package

**Behavior:**
- Reuses the comprehensive `build-test-publish` workflow for security scanning
- Checks the published npm package for newly disclosed vulnerabilities
- Creates GitHub issues with severity levels and remediation guidance
- Updates existing security issues instead of creating duplicates
- Non-blocking (exit code 0) to ensure full scan completion

**Manual Trigger:**
```bash
# Via GitHub UI: Actions → Security Monitoring → Run workflow
# Or via gh CLI:
gh workflow run security-scan.yml
```

**Issue Labels:** `security`, `vulnerability`, `dependencies`

## Resources

- **TOON Specification:** See `SPEC.md` in the repository root
- **Official Spec Repository:** https://github.com/toon-format/spec
- **n8n Documentation:** https://docs.n8n.io/integrations/creating-nodes/
- **Project Repository:** https://github.com/tehw0lf/n8n-nodes-toon

## License

MIT License - see LICENSE file for details

**Author:** tehw0lf <tehwolf@protonmail.com>
