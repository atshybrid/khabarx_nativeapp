# Chrome Setup for PDF Generation

## Problem
Server cannot generate PDF receipts because Chrome is not installed for Puppeteer.

## Error Message
```
Could not find Chrome (ver. 141.0.7390.78). This can occur if either
1. you did not perform an installation before running the script (e.g. `npx puppeteer browsers install chrome`) or
2. your cache path is incorrectly configured (which is: /opt/render/.cache/puppeteer).
```

## Solutions

### For Development
```bash
npx puppeteer browsers install chrome
```

### For Production (Render)
Add to your `render.yaml` or build script:
```yaml
services:
  - type: web
    buildCommand: |
      npm install
      npx puppeteer browsers install chrome
```

Or add to `package.json` scripts:
```json
{
  "scripts": {
    "postinstall": "npx puppeteer browsers install chrome"
  }
}
```

### Alternative: Use Different PDF Generation
Consider switching to:
- `html-pdf` (uses PhantomJS)
- `puppeteer-core` with external Chrome
- Server-side templates with PDF libraries

## Current Client Handling
✅ App already handles this error gracefully
✅ Shows user-friendly message
✅ Falls back to direct PDF URLs when available