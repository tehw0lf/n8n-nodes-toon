# n8n-nodes-toon Development Guide

## Project Overview

This is an n8n community node for bidirectional conversion between TOON (Token-Oriented Object Notation) and JSON formats. The implementation follows the **TOON Specification v2.0** (see `SPEC.md`) with **zero external production dependencies**.

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
└── __tests__/            # Test suite (161 tests)
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

| Spec Section | Feature | Status |
|-------------|---------|---------|
| §2 | Canonical number format | ✅ |
| §3 | Value normalization | ✅ |
| §4 | Type inference | ✅ |
| §5 | Root form determination | ✅ |
| §6 | Array header format | ✅ |
| §7 | String quoting and escaping | ✅ |
| §9.3 | Tabular array detection | ✅ |
| §11 | Delimiter scoping | ✅ |
| §12 | Indentation rules | ✅ |
| §13.4 | Key folding/path expansion | ✅ |
| §14 | Strict mode validation | ✅ |

## Testing

```bash
# Run all tests (161 tests)
npm test

# Coverage achieved:
# - ToonEncoder: 96% (82 tests)
# - ToonDecoder: 83% (83 tests)
# - ToonUtils: 76% (24 tests)
# - Integration: 36 tests
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

## Resources

- **TOON Specification:** See `SPEC.md` in the repository root
- **n8n Documentation:** https://docs.n8n.io/integrations/creating-nodes/
- **Project Repository:** https://github.com/tehw0lf/n8n-nodes-toon

## License

MIT License - see LICENSE file for details

**Author:** tehw0lf <tehwolf@protonmail.com>
