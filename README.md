# @tehw0lf/n8n-nodes-toon

[![npm version](https://img.shields.io/npm/v/@tehw0lf/n8n-nodes-toon.svg)](https://www.npmjs.com/package/@tehw0lf/n8n-nodes-toon)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This is an n8n community node that provides bidirectional conversion between **TOON (Token-Oriented Object Notation)** and JSON formats. TOON is a line-oriented, indentation-based format optimized for LLM prompts and structured data interchange.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

## Table of Contents

- [What is TOON?](#what-is-toon)
- [Installation](#installation)
- [Operations](#operations)
- [Configuration Options](#configuration-options)
- [Usage Examples](#usage-examples)
- [Use Cases](#use-cases)
- [Compatibility](#compatibility)
- [Zero Dependencies](#zero-dependencies)
- [Resources](#resources)

## What is TOON?

**TOON (Token-Oriented Object Notation)** is a compact text format that encodes the JSON data model with explicit structure and minimal quoting. It's particularly efficient for arrays of uniform objects — common in data exports, API responses, and LLM prompts.

### Key Features

- **Line-oriented and indentation-based** — similar to YAML but more deterministic
- **Minimal quoting** — strings are quoted only when necessary
- **Explicit array lengths** — detect truncation and malformed data
- **Tabular arrays** — declare field lists once, then list values row by row
- **Multiple delimiters** — comma, tab, or pipe for different use cases
- **Zero external dependencies** — pure Node.js implementation

### Quick Example

**JSON:**
```json
{
  "users": [
    {"id": 1, "name": "Alice", "role": "admin"},
    {"id": 2, "name": "Bob", "role": "user"}
  ]
}
```

**TOON:**
```
users[2]{id,name,role}:
  1,Alice,admin
  2,Bob,user
```

The TOON format is **50% more compact** than JSON for tabular data, making it ideal for:
- **LLM prompts** — fit more context in token limits
- **Data serialization** — compact representation of structured data
- **API responses** — human-readable but machine-parseable
- **Configuration files** — cleaner syntax than JSON

## Installation

Follow the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

### npm

```bash
npm install @tehw0lf/n8n-nodes-toon
```

### n8n Cloud

In n8n Cloud or self-hosted n8n (v0.200+):

1. Go to **Settings** → **Community Nodes**
2. Select **Install**
3. Enter `@tehw0lf/n8n-nodes-toon` and agree to the risks
4. Click **Install**

The TOON node will appear in your node palette under the **Transform** category.

## Operations

The TOON node supports two operations:

### 1. JSON to TOON

Convert JSON data to TOON format.

**Input:** JSON object or array
**Output:** TOON formatted text

**Use case:** Prepare data for LLM prompts, compact serialization

### 2. TOON to JSON

Parse TOON formatted text back to JSON.

**Input:** TOON formatted text
**Output:** JSON object or array

**Use case:** Parse LLM responses, deserialize TOON data

## Configuration Options

### Encoding Options (JSON→TOON)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **Indent Size** | Number | `2` | Spaces per indentation level |
| **Delimiter** | Choice | `comma` | Delimiter for array values (`comma`, `tab`, `pipe`) |
| **Key Folding** | Choice | `off` | Collapse single-key chains (`off`, `safe`) |
| **Flatten Depth** | Number | `999` | Maximum segments to fold (999 = unlimited) |
| **Include Token Metrics** | Boolean | `false` | Add token count comparison to output |

### Decoding Options (TOON→JSON)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **Expected Indent Size** | Number | `2` | Expected indentation for validation |
| **Strict Mode** | Boolean | `true` | Enforce array counts and indentation |
| **Expand Paths** | Choice | `off` | Split dotted keys (`off`, `safe`) |

### Input/Output Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **Input Data** | String | `={{ $json }}` | Data to convert. Supports drag-and-drop, field names, dot notation, and expressions. Auto-detects input type. |
| **Output Field** | String | `data` | Field name for output |

#### Input Data Details

The **Input Data** field auto-detects the input type:
- **Drag-and-drop**: Drag fields from the left panel - automatically evaluated by n8n
- **Field names**: Simple field access (e.g., `data`)
- **Dot notation**: Nested access (e.g., `users[0].name`)
- **Expressions**: Full n8n expressions (e.g., `={{ $json.users.filter(u => u.active) }}`)
- **Literal TOON** (for decoding): If a string doesn't match a field path, treated as TOON data

### Token Metrics Output

When **Include Token Metrics** is enabled for JSON→TOON conversion, the output includes a `tokenMetrics` object:

```json
{
  "data": "users[2]{id,name}:\n  1,Alice\n  2,Bob",
  "tokenMetrics": {
    "json": 123,
    "toon": 58,
    "saved": 65,
    "reduction": 0.5285
  }
}
```

- **json**: Estimated token count for JSON input
- **toon**: Estimated token count for TOON output
- **saved**: Number of tokens saved
- **reduction**: Reduction ratio (0.5285 = 52.85% reduction)

## Usage Examples

### Example 1: LLM Context Preparation

**Workflow:** Fetch Users → JSON to TOON → Send to LLM

Use TOON to fit more context into LLM token limits while maintaining readability.

**Input (JSON):**
```json
{
  "users": [
    {"id": 1, "name": "Alice", "role": "admin", "active": true},
    {"id": 2, "name": "Bob", "role": "user", "active": true},
    {"id": 3, "name": "Charlie", "role": "user", "active": false}
  ]
}
```

**Output (TOON - comma delimiter):**
```
users[3]{id,name,role,active}:
  1,Alice,admin,true
  2,Bob,user,true
  3,Charlie,user,false
```

**Token Savings:** ~40-50% fewer tokens than equivalent JSON for structured data.

### Example 2: Parse LLM Structured Output

**Workflow:** Send Prompt to LLM → TOON to JSON → Process Data

LLMs can generate TOON format more reliably than JSON due to simpler syntax.

**LLM Output (TOON):**
```
result:
  tasks[3]{name,priority,status}:
    "Update docs",high,pending
    "Fix bug #123",high,done
    "Refactor code",low,pending
  summary: "3 tasks identified"
```

**Parsed JSON:**
```json
{
  "result": {
    "tasks": [
      {"name": "Update docs", "priority": "high", "status": "pending"},
      {"name": "Fix bug #123", "priority": "high", "status": "done"},
      {"name": "Refactor code", "priority": "low", "status": "pending"}
    ],
    "summary": "3 tasks identified"
  }
}
```

### Example 3: Working with CSV Data

n8n has excellent built-in CSV support via the "Extract from File" node. Use TOON for transformations:

**Workflow:** Read File → Extract from CSV → JSON to TOON → Transform → TOON to JSON → Use Data

1. Use n8n's "Extract from File" (CSV) node to parse CSV files
2. The extracted data is already JSON (one item per row)
3. Use "JSON to TOON" to convert to TOON format for LLM processing
4. Use "TOON to JSON" to convert back to JSON for further processing

### Example 4: Key Folding for Nested Data

**Workflow:** API Request → JSON to TOON (Key Folding: Safe) → Transform

Simplify deeply nested JSON structures.

**Input:**
```json
{
  "user": {
    "profile": {
      "name": "Alice",
      "email": "alice@example.com"
    }
  }
}
```

**Output (with Key Folding):**
```
user.profile.name: Alice
user.profile.email: alice@example.com
```

### Example 5: Different Delimiters

Use tab delimiters for data with commas in values.

**TOON (tab delimiter):**
```
products[2]{id	name	price}:
  1	"Widget, Small"	9.99
  2	"Gadget, Large"	19.99
```

## Use Cases

### 1. LLM Integration

**Problem:** JSON wastes tokens on quotes, brackets, and redundant keys.

**Solution:** TOON reduces token usage by 40-50% for structured data.

```
Workflow: Data Source → JSON to TOON → LLM → TOON to JSON → Process
```

### 2. API Response Transformation

**Problem:** API responses are verbose JSON that's hard to read in logs.

**Solution:** Convert to TOON for compact, human-readable logging.

```
Workflow: API Request → JSON to TOON → Log/Store → TOON to JSON → Use
```

### 3. Data Format Conversion

**Problem:** Need to transform data between different formats for different systems.

**Solution:** Use TOON as an intermediate format for transformations.

```
Workflow: Extract from CSV → JSON to TOON → Transform → TOON to JSON → Send to API
```

### 4. Configuration Management

**Problem:** JSON config files are verbose and don't support comments well.

**Solution:** Store configs in TOON format for better readability.

```
Workflow: Read TOON Config → TOON to JSON → Apply Settings
```

### 5. Report Generation

**Problem:** Need to generate readable reports from structured data.

**Solution:** Convert to TOON for human-friendly text representation.

```
Workflow: Fetch Data → JSON to TOON → Format Report → Send Email
```

## Compatibility

- **n8n version:** 0.200.0 or later
- **Node.js:** 18.x or later
- **TOON Specification:** v4.1

## Specification Compliance

This node implements **TOON Specification v4.1** in full: every normative requirement of Sections 1–16 for encoders and decoders, using the default options. Two additional convenience options fall outside the specification and are documented as [non-spec extensions](#non-spec-extensions) below.

### Implemented Features

✅ **Core Features (100%)**
- All JSON data types (objects, arrays, primitives)
- Indentation-based structure with configurable spacing
- Array length declarations `[N]`
- Tabular arrays for uniform objects `[N]{field1,field2}:`
- Nested field groups for uniform nested-object columns (§9.3): `orders[2]{id,customer{name,country},total}:`
- Keyed tabular form for objects of uniform objects (§9.5): `users[2:]{age,city}:`
- Hyphen syntax for objects as list items, including headers carried on the hyphen line (§10)
- Full-line comment lines, stripped by the decoder and never emitted by the encoder (§5.1)
- All three delimiters: comma (default), tab, pipe
- Deterministic string quoting and escaping
- CRLF input, byte-order-mark removal, and trailing-space handling (§12)
- Strict mode validation per the §14 checklist (counts, row widths, header syntax, duplicate keys, indentation)

### Non-Spec Extensions

⚠️ These two options are **this node's own convenience features, not part of the TOON specification**. v4.1 treats dotted keys as ordinary literal keys with no structural meaning (§8), so output produced with key folding enabled decodes to dotted keys — not nested objects — in any conforming TOON implementation. Both default to `off`; leave them off for interoperable output.

- **Key Folding** (`keyFolding: "safe"`) - Collapse nested single-key objects into dotted paths (e.g., `{a: {b: {c: 1}}}` → `a.b.c: 1`)
- **Path Expansion** (`expandPaths: "safe"`) - Expand dotted keys back into nested objects during decoding

### Notes on Encoder Output

The encoder selects a form from each value's shape and position, as §1.4 requires, rather than by preference:

- Uniform arrays of objects use tabular form; objects of uniform objects use keyed tabular form.
- Primitive arrays are always inline (§9.1 defines no line-length threshold).
- Empty arrays are `key: []` in field position and `[]` at the root; the legacy `key[0]:` form is accepted on decode but never emitted.
- Field order follows the first object's key encounter order, so decoded elements of tabular and keyed tabular forms carry the header's field order (§2).

### Documented Implementation Behavior

The specification requires implementations to document the following (§2, §3, §4, §13.2):

**Host-type normalization (§3).** Values are normalized to the JSON data model before encoding:

| Host value | Encoded as |
|---|---|
| `NaN`, `Infinity`, `-Infinity` | `null` |
| `undefined`, functions, symbols | `null` |
| Objects with a `toJSON()` method | the normalized result of `toJSON()`, applied recursively |
| `Date` | ISO 8601 string via the built-in `toJSON()` (quoted, since it contains colons) |

**Numeric domain and out-of-range policy (§4).** Numbers are IEEE-754 doubles, the JavaScript numeric domain. Decoded numeric tokens outside that domain return the nearest approximate double rather than erroring or returning a string; values beyond `Number.MAX_SAFE_INTEGER` may therefore lose precision on round-trip. Tokens are classified by the §4 number grammar, not by `Number()`, so `.5`, `1.`, `+5`, `0x10`, `Infinity`, and `NaN` all decode as strings.

**Object key order (§2).** Key order is preserved as encountered, except that tabular and keyed tabular forms reorder to the header's field order. One deviation is inherent to the JavaScript object model: **integer-like keys are hoisted** and ordered numerically ahead of string keys, so a document with keys `b`, `1`, `a` decodes to an object ordered `1`, `b`, `a`. Array order is always preserved.

**Prototype keys (§15).** Decoded keys are installed with `Object.defineProperty`, so `__proto__`, `constructor`, and `prototype` become ordinary own data properties and decoding never mutates a prototype chain.

### Round-Trip Guarantee

All JSON data can be encoded to TOON and decoded back to JSON with full fidelity. The implementation passes all conformance requirements for encoders and decoders per the specification.

## Advanced Features

### Strict Mode

When enabled (default), the decoder validates:
- Array element counts match declared length
- Indentation multiples match expected indent size
- Proper structure and syntax

Disable for lenient parsing of hand-written TOON.

### Path Expansion

Convert dotted keys into nested objects:

**TOON:**
```
user.name: Alice
user.email: alice@example.com
```

**JSON (with expandPaths: safe):**
```json
{
  "user": {
    "name": "Alice",
    "email": "alice@example.com"
  }
}
```

### Round-Trip Guarantees

TOON guarantees lossless round-trip conversion:

- **JSON → TOON → JSON** preserves all data and structure
- Works with any valid JSON input
- Maintains data types (strings, numbers, booleans, null)

## Zero Dependencies

This node has **zero production dependencies**:
- Pure Node.js implementation
- No external libraries required
- Minimal package size
- No security vulnerabilities from dependencies

**Note:** There is another package called `n8n-nodes-toon` (non-scoped) that wraps the official `@toon-format/toon` library. This package (`@tehw0lf/n8n-nodes-toon`) implements the TOON specification directly, resulting in zero production dependencies and full control over the implementation.

## Troubleshooting

### Issue: "Input must be a string" error

**Cause:** TOON to JSON operation expects string input.

**Solution:** Ensure input field contains TOON text, not a JSON object.

### Issue: Strict mode validation errors

**Cause:** TOON data doesn't match expected structure.

**Solution:** Disable strict mode or fix indentation/counts in TOON data.

### Issue: Key folding conflicts

**Cause:** Both `user.name` and `user` keys exist in same object.

**Solution:** Use `keyFolding: "safe"` which only folds when safe, or disable key folding.

### Issue: Round-trip doesn't match exactly

**Cause:** TOON normalizes data (e.g., -0 → 0, sorts object keys).

**Solution:** This is expected — TOON preserves semantic meaning, not exact formatting.

## Automated Monitoring

This repository includes automated workflows for continuous monitoring:

### Specification Monitoring

Monitors the official TOON specification for updates:

- **Frequency:** Checks run every Monday at 9:00 AM UTC
- **Automatic Detection:** Compares `toonSpecVersion` in `package.json` against the upstream GitHub Releases API
- **Issue Creation:** Automatically opens a GitHub issue when updates are detected
- **Manual Trigger:** Can be triggered manually via GitHub Actions

When a specification update is detected, the workflow:
1. Creates a labeled issue (`spec-update`, `enhancement`) with version details
2. Includes a diff summary showing the changes
3. Provides links to the official specification
4. Avoids duplicate issues for the same version

See [`.github/workflows/monitor-spec.yml`](.github/workflows/monitor-spec.yml) for implementation details.

### Security Monitoring

Performs comprehensive security scanning to detect vulnerabilities:

- **Frequency:** Runs daily at 2:00 AM UTC
- **Source Code Scanning:** Semgrep analysis for security issues (OWASP Top 10, etc.)
- **Dependency Scanning:** npm audit on dependencies
- **Published Package Scanning:** Checks the live npm package for newly disclosed vulnerabilities
- **Automatic Trigger:** Also runs on changes to `package.json` or `package-lock.json`

When vulnerabilities are detected, the workflow:
1. Creates a labeled issue (`security`, `vulnerability`, `dependencies`)
2. Includes severity levels and full audit report
3. Provides remediation guidance with specific commands
4. Updates existing issues instead of creating duplicates

See [`.github/workflows/security-scan.yml`](.github/workflows/security-scan.yml) for implementation details.

## Resources

- **TOON Specification v4.1:** Official spec at [github.com/toon-format/spec](https://github.com/toon-format/spec) or see [SPEC.md](SPEC.md) in this repository
- **n8n Documentation:** https://docs.n8n.io/
- **Community Nodes Guide:** https://docs.n8n.io/integrations/community-nodes/
- **GitHub Repository:** https://github.com/tehw0lf/n8n-nodes-toon
- **Issues & Support:** https://github.com/tehw0lf/n8n-nodes-toon/issues

## License

MIT © [tehw0lf](https://github.com/tehw0lf)

## Author

**tehw0lf** <tehwolf@protonmail.com>

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

---

**Note:** This node implements the [TOON Specification v4.1](https://github.com/toon-format/spec). See `SPEC.md` for complete format documentation or visit the official spec repository.
