# Unified Traffic Integration Guide

## Overview

Your traffic generator now supports two modes in **one unified method**:
1. **Puppeteer Mode** (Original): Fast, lightweight traffic generation with basic automation
2. **Python Mode** (New): Advanced humanized traffic with AI-driven interactions, ad detection, and comprehensive reporting

**All functionality is accessed through the same `runTraffic()` function!**

## Architecture

### Node.js Orchestrator (`traffic-python.js`)
- Spawns and manages Python worker processes
- Handles proxy selection and rotation
- Generates realistic traffic sources (organic, social, referral)
- Manages session configuration via JSON files
- Captures and processes Python worker results

### Python Worker (`humanized_traffic_bot_fixed.py`)
- Advanced Playwright-based browser automation
- Human-like interaction patterns (scrolling, hovering, clicking)
- AI-powered ad detection and interaction
- Overlay and popup handling
- Comprehensive session reporting

### Enhanced Campaign Controller (`campaignTrafficController.js`)
- Supports both Puppeteer and Python modes
- Batch processing with parallel sessions
- Real-time logging and analytics integration
- Session management and error handling

## Usage

### Option 1: Campaign Level Configuration

Add `trafficMode` to your campaign schema:

```javascript
// In campaign creation/update
const campaign = {
  // ... existing fields
  trafficMode: 'python', // or 'puppeteer'
  // ... other fields
}
```

### Option 2: Runtime Override

```javascript
// Start campaign with Python mode
await campaignTrafficController(campaign, ws, userEmail, {
  trafficMode: 'python',
  usePython: true,
  headless: false, // Set to false for debugging
  browser: 'chromium' // or 'firefox', 'webkit'
});
```

### Option 3: Direct Python Session

```javascript
const { runSinglePythonSession } = require('./controllers/campaignTrafficController');

const result = await runSinglePythonSession(campaign, {
  userEmail: 'user@example.com',
  headless: true,
  browser: 'chromium'
});

console.log('Session result:', result);
```

## Campaign Configuration

Campaigns now support additional Python-specific fields:

```javascript
const campaign = {
  // Required fields
  targetUrl: ['https://example.com', 'https://example.org'],
  concurrent: 3,
  
  // Traffic source configuration
  organic: 30, // 30% organic traffic
  social: {
    facebook: 20,
    twitter: 15,
    instagram: 10
  },
  custom: 'https://referrer.com', // Custom referrer
  
  // Device configuration
  desktopPercentage: 70, // 70% desktop, 30% mobile
  
  // Session configuration
  visitDurationMin: 30, // Minimum visit duration in seconds
  visitDurationMax: 180, // Maximum visit duration in seconds
  scrolling: true, // Enable scrolling behavior
  
  // Ad interaction (optional)
  adSelectors: '.ad-banner, .sponsored', // CSS selectors for ads
  adsXPath: '//div[@class="advertisement"]', // XPath for ads
  bounceRate: 25, // 25% of sessions will bounce quickly
  
  // Proxy configuration
  proxies: [
    'username:password@proxy1.com:8080',
    'proxy2.com:8080:user:pass',
    'proxy3.com:8080'
  ]
};
```

## Python Dependencies

The system automatically checks and installs required Python packages:
- `playwright` - Browser automation
- `nest-asyncio` - Nested async support
- `fake-useragent` - Realistic user agents
- `python-dateutil` - Date handling

Playwright browsers are automatically installed on first use.

## Logging and Analytics

### Python Mode Logging
Python sessions generate detailed logs including:
- Session start/completion with timing
- Ad detection and interaction statistics
- Human behavior simulation details
- Error tracking and debugging info

### Integration with Existing System
- All Python sessions integrate with existing campaign analytics
- Session data flows to the same dashboard and reports
- Proxy usage tracking works the same way
- User-specific logging maintained

## Testing Python Integration

### 1. Test Python Environment
```bash
cd electron-app/src/main/traffic-worker
python --version
python -c "import playwright; print('Playwright OK')"
```

### 2. Test Manual Python Mode
```bash
python humanized_traffic_bot_fixed.py
# Follow prompts to enter URLs and settings
```

### 3. Test Node.js Orchestration
```javascript
// In your campaign code
const testCampaign = {
  _id: 'test-campaign',
  targetUrl: ['https://example.com'],
  concurrent: 1,
  proxies: [],
  trafficMode: 'python'
};

await campaignTrafficController(testCampaign, null, 'test@example.com', {
  usePython: true,
  headless: false // Watch it work!
});
```

## Session Results

Python sessions return enhanced data:

```javascript
{
  sessionId: 'abc123',
  startTime: '2024-01-01T10:00:00Z',
  endTime: '2024-01-01T10:03:45Z',
  duration: 225, // seconds
  source: 'Organic Search',
  specificReferrer: 'https://www.google.com/',
  device: 'desktop',
  visited: true,
  completed: true,
  bounced: false,
  proxy: 'proxy1.com:8080',
  success: true,
  pages_created: 3,
  total_actions: 47,
  successful_actions: 44,
  ad_interactions: 5,
  errors: [],
  
  // Python-specific data
  pythonWorker: true,
  humanized: true,
  executionTime: 3450 // ms
}
```

## Switching Between Modes

### Default to Puppeteer (Existing Behavior)
```javascript
// No changes needed - existing campaigns continue working
await campaignTrafficController(campaign, ws, userEmail);
```

### Use Python for Specific Campaign
```javascript
await campaignTrafficController(campaign, ws, userEmail, {
  trafficMode: 'python'
});
```

### Global Python Mode Toggle
```javascript
// Set default mode in environment or config
process.env.DEFAULT_TRAFFIC_MODE = 'python';
```

## Troubleshooting

### Python Not Found
- Install Python 3.8+ and ensure it's in PATH
- On Windows, install from Microsoft Store or python.org
- Verify with `python --version`

### Playwright Issues
- Run `python -m playwright install`
- Check browser permissions
- Ensure sufficient disk space

### Performance Optimization
- Use `headless: true` for production
- Limit concurrent Python sessions (resource intensive)
- Monitor memory usage with multiple sessions

### Proxy Issues
- Ensure proxy format matches expected patterns
- Test proxy connectivity manually
- Check proxy authentication credentials

## Benefits of Python Mode

1. **Human-like Behavior**: Advanced scrolling, hovering, and interaction patterns
2. **Ad Detection**: AI-powered ad recognition and interaction
3. **Better Evasion**: More sophisticated bot detection avoidance
4. **Detailed Analytics**: Comprehensive session and interaction reporting
5. **Flexibility**: Easy to extend and customize behavior patterns

## Performance Considerations

- Python sessions use more resources than Puppeteer
- Recommended concurrent limit: 3-5 Python sessions vs 10+ Puppeteer
- Session duration is longer due to realistic human simulation
- Memory usage is higher but sessions are more effective

## Future Enhancements

The Python integration provides a foundation for:
- Custom interaction scripts per campaign
- Machine learning behavior optimization
- Advanced A/B testing capabilities
- Integration with external AI services
- Real-time behavior adaptation

---

This integration maintains full backward compatibility while adding powerful new capabilities for advanced traffic generation.
