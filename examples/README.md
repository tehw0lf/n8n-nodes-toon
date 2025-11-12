# n8n-nodes-toon Example Workflows

This directory contains example n8n workflows demonstrating various use cases for the TOON node.

## How to Import

1. Open n8n
2. Click **Workflows** → **Import from File**
3. Select one of the JSON files from this directory
4. Click **Import**

## Available Examples

### 1. JSON to TOON Basic (`1-json-to-toon-basic.json`)

**What it does:** Demonstrates basic JSON to TOON conversion with sample user data.

**Use case:** Learning the basics of TOON format conversion.

**Key concepts:**
- Basic node configuration
- JSON input handling
- TOON output formatting

### 2. LLM Integration (`2-llm-integration.json`)

**What it does:** Fetches product data from an API, converts to TOON, and sends to OpenAI for analysis.

**Use case:** Reducing token usage in LLM prompts by using compact TOON format.

**Key concepts:**
- API integration
- TOON for LLM context
- Key folding option for nested data
- Real-world workflow pattern

**Benefits:**
- 30-50% reduction in tokens sent to LLM
- More context fits within token limits
- Faster API responses
- Lower costs

### 3. Round-Trip Verification (`4-round-trip-test.json`)

**What it does:** Converts JSON to TOON and back to JSON, verifying data integrity.

**Use case:** Testing data fidelity and understanding normalization rules.

**Key concepts:**
- Round-trip conversion testing
- Data integrity verification
- Normalization behavior (undefined → null, -0 → 0, etc.)

**Important:** This workflow includes a JavaScript function to compare original and round-trip data.

## Customization Tips

### Changing Delimiters

Edit the `delimiter` parameter in TOON nodes:
- `"comma"` - For general use (default)
- `"tab"` - For spreadsheet-compatible output
- `"pipe"` - When data contains commas

### Key Folding

Set `keyFolding` to:
- `"off"` - Keep nested structure (default)
- `"safe"` - Collapse single-key chains (e.g., `a: b: c:` → `a.b.c:`)

### Strict Mode

In TOON to JSON operations:
- `strict: true` - Enforce array counts and indentation (recommended)
- `strict: false` - Allow minor format variations

### Path Expansion

Set `expandPaths` to:
- `"off"` - Keep dotted keys as-is (default)
- `"safe"` - Expand `user.name` → nested `{ user: { name: ... } }`

## Common Patterns

### Pattern 1: API → TOON → LLM
```
HTTP Request → JSON to TOON → OpenAI/Anthropic
```
**Why:** Reduces token usage, fits more data in prompts

### Pattern 2: LLM → TOON → JSON → Process
```
OpenAI/Anthropic → TOON to JSON → Function/IF → Database
```
**Why:** LLMs can output TOON more reliably than JSON

### Pattern 3: CSV → JSON → TOON → Transform
```
Read File → Extract from CSV → JSON to TOON → Transform → TOON to JSON
```
**Why:** Use n8n's native CSV support, then TOON for transformations

### Pattern 4: Data Validation
```
Input → JSON to TOON → TOON to JSON (strict) → IF (error) → Alert
```
**Why:** Strict mode catches malformed or truncated data

## Working with CSV Data

**Note:** This node focuses on JSON ↔ TOON conversion. For CSV data:

1. Use n8n's built-in **"Extract from File"** node to parse CSV files
2. The extracted data is already JSON (one item per row)
3. Use **"JSON to TOON"** to convert to TOON format
4. Use **"TOON to JSON"** to convert back for further processing

**Workflow:**
```
Read Binary File → Extract from CSV → JSON to TOON → Transform → TOON to JSON → Use Data
```

## Testing Your Workflows

1. **Start with sample data** - Use Set node to provide test data
2. **Check each step** - Inspect output at each node
3. **Handle errors** - Enable "Continue on Fail" for production workflows
4. **Verify output** - Ensure TOON format is correct before using in production

## Error Handling

All example workflows can be enhanced with error handling:

1. Add **IF** node after TOON operations
2. Check for `error` in output
3. Route to error handler (e.g., Slack notification, database log)

Example:
```
TOON Node → IF (error exists?) → [Yes] → Send Alert
                                 [No] → Continue workflow
```

## Performance Tips

- For large datasets (>1000 items), monitor memory usage
- Use `continue-on-fail` to handle malformed data gracefully
- Consider batching very large datasets if needed

## Support

For questions or issues:
- GitHub Issues: https://github.com/tehw0lf/n8n-nodes-toon/issues
- n8n Community Forum: https://community.n8n.io/

## Contributing

Have a useful workflow pattern? Submit a pull request with:
- Descriptive JSON filename
- Update to this README with description
- Comments in the workflow explaining key steps

---

**Author:** tehw0lf
**License:** MIT
