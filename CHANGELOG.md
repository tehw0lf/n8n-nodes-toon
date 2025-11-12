# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial implementation of TOON node for n8n
- Two operations: JSON to TOON, TOON to JSON
- TOON Specification v2.0 compliant encoder and decoder
- Comprehensive test suite with 161 passing tests and high coverage
- Support for multiple delimiters (comma, tab, pipe)
- Key folding option for collapsing single-key object chains
- Path expansion option for expanding dotted keys
- Strict mode validation with detailed error messages
- Configurable indentation and formatting options
- Continue-on-fail support for error handling

### Technical Details
- Zero external production dependencies
- ~2,000 lines of TypeScript code
- Modular architecture with separate encoder, decoder, and utilities
- Full type safety with TypeScript interfaces
- Comprehensive error handling with custom error types

## [1.0.0] - TBD

### Added
- Initial stable release
- Full TOON Specification v2.0 compliance
- Production-ready test coverage
- Complete documentation with examples
- Ready for npm publication

---

## Version Compatibility

| Version | n8n Version | Node.js | TOON Spec |
|---------|-------------|---------|-----------|
| 1.0.0   | 0.200.0+    | 18+     | v2.0      |

## Breaking Changes

None yet  this is the initial release.

## Migration Guide

This is the initial release, no migration required.

## Known Issues

None  all 161 tests passing with high coverage.

## Future Roadmap

Potential features for future versions:

- **v1.1.0**: Performance optimizations for large datasets
- **v1.2.0**: Streaming support for very large files
- **v1.3.0**: Additional output formats (Markdown tables, HTML)
- **v2.0.0**: TOON Specification v3.0 support (if released)

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/tehw0lf/n8n-nodes-toon/issues
- GitHub Discussions: https://github.com/tehw0lf/n8n-nodes-toon/discussions
- n8n Community Forum: https://community.n8n.io/

---

**Note:** Dates in `[Unreleased]` will be set upon release to npm.
