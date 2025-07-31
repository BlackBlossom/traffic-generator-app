require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { KnownDevices } = require('puppeteer');
const UserAgent = require('user-agents');
const crypto = require('crypto');
const sqliteLogger = require('../services/sqliteLogger');
const logEventHub = require('../services/logEventHub');
const campaignAnalytics = require('../services/campaignAnalytics');
const url = require('url');

// Python integration imports
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

puppeteer.use(StealthPlugin());

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Python Traffic Orchestrator - Integrated directly into traffic.js
class PythonTrafficOrchestrator {
  constructor() {
    this.activeSessions = new Map();
    this.pythonPath = this.findPythonPath();
    this.scriptPath = path.join(__dirname, 'traffic_agent.py');
  }

  findPythonPath() {
    const possiblePaths = ['python', 'python3', 'py'];
    for (const pythonPath of possiblePaths) {
      try {
        const { execSync } = require('child_process');
        execSync(`${pythonPath} --version`, { stdio: 'ignore' });
        return pythonPath;
      } catch (error) {
        continue;
      }
    }
    throw new Error('Python not found. Please install Python 3.8+ and ensure it\'s in your PATH.');
  }

  // Proxy selection function matching Node.js version
  selectProxy(campaignProxies) {
    const PROXY_HOST = process.env.PROXY_HOST || 'gw.dataimpulse.com';
    const PROXY_PORT = process.env.PROXY_PORT || '823';
    const PROXY_USER = process.env.PROXY_USER || 'b0ac12156e5e63a82bbe__cr.au';
    const PROXY_PASS = process.env.PROXY_PASS || 'c16003108e64d017';
    const DEFAULT_PROXY = `${PROXY_HOST}:${PROXY_PORT}`;

    if (!campaignProxies || !Array.isArray(campaignProxies) || campaignProxies.length === 0) {
      return {
        host: PROXY_HOST,
        port: PROXY_PORT,
        username: PROXY_USER,
        password: PROXY_PASS,
        proxyString: DEFAULT_PROXY
      };
    }
    
    // Select random proxy from campaign proxies
    const randomProxy = campaignProxies[Math.floor(Math.random() * campaignProxies.length)];
    return {
      host: randomProxy.host,
      port: randomProxy.port,
      username: randomProxy.username || '',
      password: randomProxy.password || '',
      proxyString: `${randomProxy.host}:${randomProxy.port}`
    };
  }

  generateTrafficSource(campaign) {
    const random = Math.random() * 100;
    let cumulativePercentage = 0;
    
    if (campaign.organic && campaign.organic > 0) {
      cumulativePercentage += campaign.organic;
      if (random <= cumulativePercentage) {
        return { source: 'Organic Search', specificReferrer: 'https://www.google.com/' };
      }
    }

    if (campaign.social && Object.keys(campaign.social).length > 0) {
      for (const [platform, percentage] of Object.entries(campaign.social)) {
        if (percentage > 0) {
          cumulativePercentage += percentage;
          if (random <= cumulativePercentage) {
            const socialUrls = {
              facebook: 'https://www.facebook.com/',
              twitter: 'https://twitter.com/',
              instagram: 'https://www.instagram.com/'
            };
            return { source: 'Social Media', specificReferrer: socialUrls[platform.toLowerCase()] || 'https://www.facebook.com/' };
          }
        }
      }
    }

    if (campaign.custom) {
      return { source: 'Referral', specificReferrer: campaign.custom };
    }

    return { source: 'Direct', specificReferrer: null };
  }

  async createPythonConfig(sessionId, campaign, sessionConfig) {
    const configPath = path.join(os.tmpdir(), `traffic_config_${sessionId}.json`);
    
    const selectedProxy = this.selectProxy(campaign.proxies);
    const trafficSource = this.generateTrafficSource(campaign);
    
    const visitDurationMin = campaign.visitDurationMin || 30;
    const visitDurationMax = campaign.visitDurationMax || 120;
    const duration = Math.floor(Math.random() * (visitDurationMax - visitDurationMin + 1)) + visitDurationMin;

    // Implement headful percentage logic (same as Puppeteer)
    const headfulPercentage = campaign.headfulPercentage || 0;
    const shouldBeHeadful = Math.random() * 100 < headfulPercentage;

    const config = {
      sessionId,
      campaignId: campaign.id || campaign._id,
      userEmail: campaign.userEmail || sessionConfig.userEmail,
      urls: Array.isArray(campaign.targetUrl) ? campaign.targetUrl : [campaign.targetUrl || campaign.url],
      duration_seconds: duration,
      proxy: selectedProxy, // Pass the proxy object directly without formatting
      cookies: campaign.cookies || [],
      headless: !shouldBeHeadful, // Use headful percentage logic
      browser: sessionConfig.browser || 'chromium',
      adSelectors: campaign.adSelectors || '',
      adsXPath: campaign.adsXPath || '',
      bounceRate: campaign.bounceRate || 0,
      organic: campaign.organic || 0,
      social: campaign.social || {},
      custom: campaign.custom || '',
      desktopPercentage: campaign.desktopPercentage || 70,
      scrolling: campaign.scrolling !== false,
      visitDurationMin,
      visitDurationMax,
      device: Math.random() * 100 < (campaign.desktopPercentage || 70) ? 'desktop' : 'mobile',
      source: trafficSource.source,
      specificReferrer: trafficSource.specificReferrer,
      startTime: new Date().toISOString(),
      proxyUsed: selectedProxy || null,
      headfulPercentage: headfulPercentage,
      shouldBeHeadful: shouldBeHeadful,
      geo: campaign.geo || '',
      notes: campaign.notes || ''
    };

    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
    return { configPath, config };
  }

  selectProxy(proxies) {
    const PROXY_HOST = process.env.PROXY_HOST || 'gw.dataimpulse.com';
    const PROXY_PORT = process.env.PROXY_PORT || '823';
    const PROXY_USER = process.env.PROXY_USER || 'b0ac12156e5e63a82bbe__cr.au';
    const PROXY_PASS = process.env.PROXY_PASS || 'c16003108e64d017';
    const DEFAULT_PROXY = `${PROXY_HOST}:${PROXY_PORT}`;

    if (!proxies || !Array.isArray(proxies) || proxies.length === 0) {
      return {
        host: PROXY_HOST,
        port: PROXY_PORT,
        username: PROXY_USER,
        password: PROXY_PASS,
        proxyString: DEFAULT_PROXY
      };
    }
    
    // Select random proxy from campaign proxies
    const randomProxy = proxies[Math.floor(Math.random() * proxies.length)];
    return {
      host: randomProxy.host,
      port: randomProxy.port,
      username: randomProxy.username || '',
      password: randomProxy.password || '',
      proxyString: `${randomProxy.host}:${randomProxy.port}`
    };
  }

  async spawnPythonWorker(sessionId, configPath) {
    return new Promise((resolve, reject) => {
      const worker = spawn(this.pythonPath, [this.scriptPath, '--config', configPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1', NODE_AUTOMATION_CONFIG_PATH: configPath }
      });

      let stdout = '';
      let stderr = '';
      let result = null;

      worker.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // Process each line to forward Python logs to Node.js logging system
        const lines = chunk.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            // Check if it's the final JSON result
            if (line.startsWith('{') && line.includes('"sessionId"')) {
              try {
                result = JSON.parse(line);
              } catch (parseError) {
                // Not valid JSON, continue processing
              }
            } else {
              // Check for PYTHON_STRUCTURED_LOG format
              if (line.includes('PYTHON_STRUCTURED_LOG:')) {
                console.log(`🔍 Found PYTHON_STRUCTURED_LOG: ${line}`);
                try {
                  const jsonStart = line.indexOf('PYTHON_STRUCTURED_LOG:') + 'PYTHON_STRUCTURED_LOG:'.length;
                  const jsonStr = line.substring(jsonStart).trim();
                  const structuredLog = JSON.parse(jsonStr);
                  
                  console.log(`📋 Parsed structured log:`, structuredLog);
                  
                  if (structuredLog.type === 'python_log' && structuredLog.logEntry) {
                    const { logEntry, campaignId, userEmail } = structuredLog;
                    console.log(`✅ Processing structured log - campaignId: ${campaignId}, userEmail: ${userEmail}, level: ${logEntry.level}`);
                    // Store the structured log with campaign information
                    logToIPC(logEntry.sessionId, logEntry.level, logEntry.message, campaignId, userEmail);
                  } else {
                    console.log(`⚠️ Structured log missing required fields`);
                  }
                } catch (parseError) {
                  console.log(`❌ Failed to parse structured log: ${parseError.message}`);
                  // If parsing fails, treat as regular Python output
                  logToIPC(sessionId, 'info', `Python: ${line}`, null, null);
                }
              } else if (line.trim() && !line.startsWith('{')) {
                // Extract session ID and level if it's a formatted log
                const logMatch = line.match(/\[([\d\-T:.]+)\] \[([^\]]+)\] \[([^\]]+)\] (.+)/);
                if (logMatch) {
                  const [, timestamp, pythonSessionId, level, message] = logMatch;
                  logToIPC(pythonSessionId, level.toLowerCase(), message, null, null);
                } else {
                  // Forward as-is if not formatted
                  logToIPC(sessionId, 'info', `Python: ${line}`, null, null);
                }
              }
            }
          } catch (e) {
            // Continue processing other lines
          }
        }
      });

      worker.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        
        // Forward stderr as error logs
        const lines = chunk.split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.trim()) {
            logToIPC(sessionId, 'error', `Python stderr: ${line}`, null, null);
          }
        }
      });

      worker.on('close', (code) => {
        fs.unlink(configPath, () => {});
        if (code === 0 && result) {
          resolve(result);
        } else {
          reject(new Error(`Python worker failed with code ${code}. Stderr: ${stderr}`));
        }
      });

      worker.on('error', (error) => {
        fs.unlink(configPath, () => {});
        reject(new Error(`Failed to spawn Python worker: ${error.message}`));
      });

      this.activeSessions.set(sessionId, { worker, startTime: Date.now(), configPath });

      setTimeout(() => {
        if (this.activeSessions.has(sessionId)) {
          worker.kill('SIGTERM');
          this.activeSessions.delete(sessionId);
          reject(new Error('Python worker timed out'));
        }
      }, 10 * 60 * 1000);
    });
  }

  async runPythonSession(campaign, sessionConfig = {}) {
    // Use provided sessionId or generate a new one
    const sessionId = sessionConfig.sessionId || uuidv4();
    const startTime = Date.now();
    
    try {
      const { configPath } = await this.createPythonConfig(sessionId, campaign, sessionConfig);
      const result = await this.spawnPythonWorker(sessionId, configPath);
      
      this.activeSessions.delete(sessionId);
      
      return {
        ...result,
        sessionId: sessionId,  // Ensure sessionId is consistent
        campaignId: campaign.id || campaign._id,
        userEmail: campaign.userEmail || sessionConfig.userEmail,
        executionTime: Date.now() - startTime,
        pythonWorker: true,
        humanized: true
      };

    } catch (error) {
      this.activeSessions.delete(sessionId);
      throw error;
    }
  }
}

// Initialize Python orchestrator
const pythonOrchestrator = new PythonTrafficOrchestrator();

// Updated logging function to use SQLite Logger and Event Hub
function logToIPC(sessionId, level, message, campaignId = null, userEmail = null) {
  // Log to console for main process debugging
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${sessionId || 'system'}] [${level.toUpperCase()}] ${message}`);

  console.log(`🔍 logToIPC called - campaignId: ${campaignId}, userEmail: ${userEmail}, sessionId: ${sessionId}`);

  // Use SQLite logger and event hub for broadcasting and storage
  if (campaignId && userEmail && sessionId) {
    console.log(`✅ Storing log with campaign info - campaignId: ${campaignId}, userEmail: ${userEmail}`);
    // Create log entry for campaign with session ID - STORE IN DATABASE
    const logEntry = {
      level,
      message,
      sessionId,
      timestamp: new Date().toISOString()
    };
    logEventHub.logAndBroadcast(campaignId, userEmail, logEntry);
  } else if (campaignId && userEmail) {
    console.log(`✅ Storing log without session ID - campaignId: ${campaignId}, userEmail: ${userEmail}`);
    // Create log entry for campaign without specific session - STORE IN DATABASE
    const logEntry = {
      level,
      message,
      sessionId: sessionId || 'traffic-worker',
      timestamp: new Date().toISOString()
    };
    logEventHub.logAndBroadcast(campaignId, userEmail, logEntry);
  } else {
    console.log(`⚠️ Broadcasting live log only - no campaign info provided`);
    // Broadcast live log only (no storage)
    logEventHub.broadcastLiveLog(`[${sessionId || 'traffic-worker'}] ${message}`, level);
  }
}

function generateSessionId(length = 7) {
  return crypto.randomBytes(Math.ceil(length * 3 / 4)).toString('base64url').slice(0, length);
}

// Bidirectional scrolling with robust error handling
async function scrollPageLoop(page, visitDurationMs) {
  const scrollStep = 120 + getRandomInt(-20, 20);
  const scrollDelay = 500 + getRandomInt(-100, 150);
  const start = Date.now();
  let scrollingDown = true;

  while ((Date.now() - start) < visitDurationMs && !page.isClosed()) {
    try {
      await page.evaluate((scrollStep, scrollingDown) => {
        window.scrollBy(0, scrollingDown ? scrollStep : -scrollStep);
      }, scrollStep, scrollingDown);

      const { atBottom, atTop } = await page.evaluate(() => ({
        atBottom: (window.innerHeight + window.pageYOffset) >= document.body.scrollHeight,
        atTop: window.pageYOffset === 0
      }));
      if (scrollingDown && atBottom) scrollingDown = false;
      else if (!scrollingDown && atTop) scrollingDown = true;
    } catch (err) {
      if (err.message && err.message.includes('Execution context was destroyed')) {
        logToIPC(null, 'warn', 'Scroll aborted: Execution context destroyed, likely due to navigation.');
        break;
      }
      throw err;
    }
    await delay(scrollDelay);
  }
}

// Perform clicks with mixed XPath, CSS, and random elements, shuffled for realism, with robust redirection logic
async function performClicks(
  page, minClicks, maxClicks, visitDurationMs, sessionId, campaignId = null,
  browserMode, userEmail = null, originalUrl, adConfig = {}
) {
  const numClicks = getRandomInt(minClicks, maxClicks);
  if (numClicks === 0) return;
  const clickInterval = visitDurationMs / numClicks;
  const parsedOriginal = url.parse(originalUrl);

  // 1. Parse ad selectors
  let adSelectors = [];
  if (adConfig.adSelectors && adConfig.adSelectors.trim()) {
    adSelectors = adConfig.adSelectors.split(',').map(s => s.trim()).filter(Boolean);
    logToIPC(sessionId, 'debug', `Custom ad selectors: ${adSelectors.join(', ')}`, campaignId, userEmail);
  } else {
    adSelectors = ['.GoogleActiveViewElement', '.ad-class', '#ad-iframe', '.rgtAdSection'];
    logToIPC(sessionId, 'debug', `Default ad selectors: ${adSelectors.join(', ')}`, campaignId, userEmail);
  }

  // 2. Parse XPath expressions
  let adsXPaths = [];
  if (adConfig.adsXPath && adConfig.adsXPath.trim()) {
    const xpathString = adConfig.adsXPath.trim();
    const xpaths = [];
    let currentXPath = '';
    let bracketDepth = 0;
    let inQuotes = false, quoteChar = '';
    for (let i = 0; i < xpathString.length; i++) {
      const char = xpathString[i];
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true; quoteChar = char; currentXPath += char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false; currentXPath += char;
      } else if (!inQuotes && char === '[') {
        bracketDepth++; currentXPath += char;
      } else if (!inQuotes && char === ']') {
        bracketDepth--; currentXPath += char;
      } else if (!inQuotes && bracketDepth === 0 && char === ',') {
        if (currentXPath.trim()) xpaths.push(currentXPath.trim());
        currentXPath = '';
      } else {
        currentXPath += char;
      }
    }
    if (currentXPath.trim()) xpaths.push(currentXPath.trim());
    adsXPaths = xpaths.filter(xpath => xpath);
    logToIPC(sessionId, 'debug', `Custom XPath expressions: ${adsXPaths.join(' | ')}`, campaignId, userEmail);
  }

  // 3. Gather all matching elements: XPath, CSS, then random, tagging each for log/analysis
  let clickCandidates = [];

  // Gather XPath elements with robust error handling
  if (adsXPaths.length > 0) {
    for (const xpath of adsXPaths) {
      try {
        if (page.isClosed()) {
          logToIPC(sessionId, 'warn', 'Page closed during XPath element gathering', campaignId, userEmail);
          break;
        }
        const elements = await page.$$(`::-p-xpath(${xpath})`);
        elements.forEach(el => clickCandidates.push({ el, type: 'xpath', selector: xpath }));
        if (elements.length)
          logToIPC(sessionId, 'debug', `✓ XPath found ${elements.length} elements for ${xpath}`, campaignId, userEmail);
        else
          logToIPC(sessionId, 'debug', `✗ XPath found no elements: ${xpath}`, campaignId, userEmail);
      } catch (err) {
        if (err.message && (err.message.includes('context') || err.message.includes('Node with given id'))) {
          logToIPC(sessionId, 'warn', `✗ XPath context lost (${xpath}): Navigation likely occurred`, campaignId, userEmail);
          break; // Stop gathering if context is lost
        }
        logToIPC(sessionId, 'error', `✗ XPath error (${xpath}): ${err.message}`, campaignId, userEmail);
      }
    }
  }

  // Gather CSS selector elements with robust error handling
  if (adSelectors.length > 0 && !page.isClosed()) {
    for (const sel of adSelectors) {
      try {
        if (page.isClosed()) {
          logToIPC(sessionId, 'warn', 'Page closed during CSS element gathering', campaignId, userEmail);
          break;
        }
        const elements = await page.$$(sel);
        elements.forEach(el => clickCandidates.push({ el, type: 'css', selector: sel }));
        if (elements.length)
          logToIPC(sessionId, 'debug', `✓ CSS selector ${sel} found ${elements.length} elements`, campaignId, userEmail);
      } catch (error) {
        if (error.message && (error.message.includes('context') || error.message.includes('Node with given id'))) {
          logToIPC(sessionId, 'warn', `✗ CSS context lost (${sel}): Navigation likely occurred`, campaignId, userEmail);
          break;
        }
        logToIPC(sessionId, 'error', `✗ CSS ad selector error (${sel}): ${error.message}`, campaignId, userEmail);
      }
    }
  }

  // Gather random clickable elements as fallback with error handling
  if (clickCandidates.length < numClicks && !page.isClosed()) {
    try {
      const clickableSelectors = ['a', 'button', 'input[type="button"]', 'input[type="submit"]'];
      const elements = await page.$$(clickableSelectors.join(','));
      const needed = numClicks - clickCandidates.length;
      const toAdd = elements.slice(0, needed);
      toAdd.forEach(el => clickCandidates.push({ el, type: 'random', selector: null }));
      if (elements.length)
        logToIPC(sessionId, 'debug', `Added ${toAdd.length} random clickable elements for fallback`, campaignId, userEmail);
    } catch (error) {
      logToIPC(sessionId, 'error', `Error gathering random elements: ${error.message}`, campaignId, userEmail);
    }
  }

  // 4. Randomize all pooled click candidates and pick up to numClicks
  clickCandidates = clickCandidates.sort(() => Math.random() - 0.5).slice(0, numClicks);

  // 5. Run the click actions with universal redirect checking and robust error handling
  let adTargetingStats = {
    totalClicks: clickCandidates.length,
    xpathClicks: clickCandidates.filter(c => c.type === 'xpath').length,
    cssClicks: clickCandidates.filter(c => c.type === 'css').length,
    randomClicks: clickCandidates.filter(c => c.type === 'random').length
  };

  for (let i = 0; i < clickCandidates.length; i++) {
    const scheduledTime = Date.now() + clickInterval;
    const { el, type, selector } = clickCandidates[i];
    
    try {
      if (!el || page.isClosed()) {
        logToIPC(sessionId, 'warn', `Skipping click #${i + 1}: Page closed or element invalid`, campaignId, userEmail);
        continue;
      }

      const box = await el.boundingBox();
      if (!box) {
        logToIPC(sessionId, 'debug', `Skipping click #${i + 1}: Element not visible or removed`, campaignId, userEmail);
        continue;
      }

      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      logToIPC(sessionId, 'debug', `Moving mouse to (${x}, ${y}) for click #${i + 1} [${type}]`, campaignId, userEmail);
      
      await page.mouse.move(x, y, { steps: getRandomInt(5, 15) });
      await delay(getRandomInt(200, 800));
      
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => null),
        page.mouse.click(x, y, { delay: getRandomInt(30, 120) })
      ]);
      
      logToIPC(
        sessionId,
        'info',
        `Mouse clicked at (${x}, ${y}) [${i + 1}/${clickCandidates.length}] (${type}${selector ? `: ${selector}` : ''})`,
        campaignId,
        userEmail
      );

      // Enhanced redirect detection - only return if main path changes
      try {
        const currUrl = page.url();
        const currPath = url.parse(currUrl).pathname;
        const origPath = parsedOriginal.pathname;
        
        if (currPath !== origPath) {
          logToIPC(
            sessionId, 'debug',
            `Redirect path changed from '${origPath}' to '${currPath}' after click #${i + 1}. Returning to original URL.`,
            campaignId, userEmail
          );
          
          await page.goto(originalUrl, { waitUntil: 'networkidle2' }).catch(err => {
            logToIPC(sessionId, 'error', `Failed to return to original URL: ${err.message}`, campaignId, userEmail);
          });
          
          logToIPC(sessionId, 'info', `Returned to original URL after redirect.`, campaignId, userEmail);
        }
      } catch (redirectError) {
        logToIPC(sessionId, 'error', `Redirect handling error: ${redirectError.message}`, campaignId, userEmail);
      }

    } catch (clickError) {
      if (clickError.message && (clickError.message.includes('context') || clickError.message.includes('Node with given id'))) {
        logToIPC(sessionId, 'warn', `Click #${i + 1} failed: Element context lost, likely due to navigation`, campaignId, userEmail);
        break; // Stop clicking if context is consistently lost
      }
      logToIPC(sessionId, 'error', `Click #${i + 1} failed: ${clickError.message}`, campaignId, userEmail);
      continue; // Try next click
    }

    // Wait until it's time for the next click
    const now = Date.now();
    if (scheduledTime > now) await delay(scheduledTime - now);
  }

  // Log click summary
  if (adTargetingStats.totalClicks > 0) {
    logToIPC(
      sessionId, 'info',
      `Ad Clicks Summary: Total: ${adTargetingStats.totalClicks}, XPath: ${adTargetingStats.xpathClicks}, CSS: ${adTargetingStats.cssClicks}, Random: ${adTargetingStats.randomClicks}`,
      campaignId, userEmail
    );
  }
}

async function launchSession(params, sessionId, campaignId = null, userEmail = null) {
  let browser = null;
  const desktopPercentage = params.desktopPercentage !== undefined ? params.desktopPercentage : 70;
  const shouldBeDesktop = Math.random() * 100 < desktopPercentage;
  const deviceType = shouldBeDesktop ? 'Desktop' : 'Mobile';

  // Select proxy for this session
  const selectedProxy = selectProxy(params.proxies);

  const sessionData = {
    sessionId,
    startTime: new Date(),
    endTime: null,
    duration: 0,
    source: 'Direct',
    specificReferrer: null,
    device: deviceType,
    visited: false,
    completed: false,
    bounced: false,
    proxy: selectedProxy.proxyString,
    headful: false
  };

  try {
    // Track session start for active session counting
    if (campaignId) {
      try {
        await campaignAnalytics.recordSessionStart(campaignId, sessionId);
        logToIPC(sessionId, 'debug', `Session start recorded for campaign ${campaignId}`, campaignId, userEmail);
      } catch (startError) {
        logToIPC(sessionId, 'error', `Failed to record session start: ${startError.message}`, campaignId, userEmail);
      }
    }

    const headfulPercentage = params.headfulPercentage || 0;
    const shouldBeHeadful = Math.random() * 100 < headfulPercentage;
    sessionData.headful = shouldBeHeadful;
    const browserMode = shouldBeHeadful ? 'headful' : 'headless';
    logToIPC(sessionId, 'info', `Launching ${browserMode} browser with proxy: ${selectedProxy.proxyString}`, campaignId, userEmail);

    const launchArgs = ['--no-sandbox', `--proxy-server=${selectedProxy.proxyString}`];
    browser = await puppeteer.launch({
      headless: !shouldBeHeadful,
      args: launchArgs,
      timeout: 60000 // 60 seconds
    });

    const page = await browser.newPage();
    
    // Authenticate with proxy if credentials are available
    if (selectedProxy.username && selectedProxy.password) {
      await page.authenticate({ 
        username: selectedProxy.username, 
        password: selectedProxy.password 
      });
    }

    // INJECT COOKIES USING MODERN API
    if (Array.isArray(params.cookies) && params.cookies.length > 0) {
      try {
        // Convert cookies to Puppeteer format and set them
        const puppeteerCookies = params.cookies.map(cookie => {
          const puppeteerCookie = {
            name: cookie.name,
            value: cookie.value || '',
            domain: cookie.domain || new URL(params.url).hostname,
            path: cookie.path || '/',
            httpOnly: cookie.httpOnly || false,
            secure: cookie.secure || false,
            sameSite: cookie.sameSite || 'Lax'
          };
          
          // Add expires if provided (convert timestamp to seconds)
          if (cookie.expires && typeof cookie.expires === 'number') {
            puppeteerCookie.expires = Math.floor(cookie.expires / 1000);
          }
          
          return puppeteerCookie;
        });

        await page.setCookie(...puppeteerCookies);
        logToIPC(sessionId, 'debug',
          `✅ Injected ${params.cookies.length} cookies using page.setCookie()`, 
          campaignId, userEmail);
        
        // Log cookie details for debugging
        puppeteerCookies.forEach((cookie, index) => {
          logToIPC(sessionId, 'debug',
            `Cookie ${index + 1}: ${cookie.name}=${cookie.value} (domain: ${cookie.domain}, path: ${cookie.path})`, 
            campaignId, userEmail);
        });
      } catch (cookieError) {
        logToIPC(sessionId, 'error',
          `❌ Failed to inject cookies: ${cookieError.message}`, 
          campaignId, userEmail);
      }
    }

    // Robust device emulation (handles unavailable descriptors)
    if (deviceType === 'Mobile') {
      const device =
        KnownDevices['iPhone 15 Pro'] ||
        KnownDevices['iPhone X'] ||
        KnownDevices['iPhone 12 Pro'] ||
        KnownDevices['iPhone 8'];
      if (device) {
        await page.emulate(device);
        logToIPC(sessionId, 'debug', `Mobile emulation: ${device.name || 'device descriptor'}`, campaignId, userEmail);
      } else {
        await page.setViewport({ width: 375, height: 812 });
        logToIPC(sessionId, 'debug', 'Mobile emulation: Manual fallback', campaignId, userEmail);
      }
    } else {
      await page.setViewport({ width: 1366, height: 768 });
      logToIPC(sessionId, 'debug', 'Desktop viewport 1366x768', campaignId, userEmail);
      const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
      await page.setUserAgent(userAgent);
      logToIPC(sessionId, 'debug', `User Agent set: ${userAgent} (Desktop)`, campaignId, userEmail);
    }

    let referer = '';
    const rand = Math.random() * 100;
    if (rand < params.organic) {
      referer = 'https://www.google.com/';
      sessionData.source = 'Organic';
      sessionData.specificReferrer = referer;
      logToIPC(sessionId, 'debug', `Using Google as referer.`, campaignId, userEmail);
    } else if (params.custom) {
      referer = params.custom;
      sessionData.specificReferrer = referer;
      const customLower = referer.toLowerCase();
      if (customLower.includes('google') || customLower.includes('bing') || customLower.includes('yahoo')) {
        sessionData.source = 'Organic';
      } else if (customLower.includes('facebook') || customLower.includes('twitter') ||
                 customLower.includes('instagram') || customLower.includes('linkedin')) {
        sessionData.source = 'Social';
      } else {
        sessionData.source = 'Referral';
      }
      logToIPC(sessionId, 'debug', `Using custom referer: ${referer}`, campaignId, userEmail);
    } else if (params.social && Object.values(params.social).some(Boolean)) {
      const socialRefs = [];
      if (params.social.Facebook) socialRefs.push('https://facebook.com/');
      if (params.social.Twitter) socialRefs.push('https://twitter.com/');
      if (params.social.Instagram) socialRefs.push('https://instagram.com/');
      if (params.social.LinkedIn) socialRefs.push('https://linkedin.com/');
      referer = socialRefs[getRandomInt(0, socialRefs.length - 1)];
      sessionData.source = 'Social';
      sessionData.specificReferrer = referer;
      logToIPC(sessionId, 'debug', `Using social referer: ${referer}`, campaignId, userEmail);
    }
    if (referer) await page.setExtraHTTPHeaders({ referer });
    logToIPC(sessionId, 'debug', `Navigating to: ${params.url}`, campaignId, userEmail);

    try {
      logToIPC(sessionId, 'debug', `Navigating to: ${params.url}`, campaignId, userEmail);
      await page.goto(params.url, {
        waitUntil: 'networkidle2',
        timeout: 60000 // increased timeout to 60 seconds
      });
      sessionData.visited = true;
    } catch (navErr) {
      sessionData.bounced = true;
      logToIPC(sessionId, 'error', `Navigation to ${params.url} failed: ${navErr.message}`, campaignId, userEmail);
      throw navErr; // stop the session early
    }
    logToIPC(sessionId, 'info', `Page loaded: ${params.url}`, campaignId, userEmail);
    const originalUrl = page.url();


    // Calculate session duration (ms)
    const minDuration = (params.visitDurationMin || params.visitDuration || 30) * 1000;
    const maxDuration = (params.visitDurationMax || params.visitDuration || 30) * 1000;
    let duration = Math.floor(Math.random() * (maxDuration - minDuration) + minDuration);

    if (Math.random() * 100 < params.bounceRate) {
      duration = Math.floor(Math.random() * minDuration * 0.3 + minDuration * 0.2);
      sessionData.bounced = true;
      logToIPC(sessionId, 'info', `Bounce triggered, will leave early.`, campaignId, userEmail);
    }

    const adConfig = {
      adSelectors: params.adSelectors,
      adsXPath: params.adsXPath
    };
    const sessionSeconds = Math.round(duration / 1000);
    const minClicks = Math.max(1, Math.floor(sessionSeconds / 20));
    const maxClicks = Math.max(minClicks, Math.floor(sessionSeconds / 10));

    const clickPromise = performClicks(
      page,
      minClicks, maxClicks,
      duration, sessionId, campaignId, browserMode, userEmail, originalUrl, adConfig
    );
    const scrollPromise = params.scrolling ? scrollPageLoop(page, duration) : Promise.resolve();

    logToIPC(sessionId, 'debug', `Session interaction will run for ${Math.round(duration / 1000)}s`, campaignId, userEmail);
    await Promise.all([clickPromise, scrollPromise]);

    const elapsed = Date.now() - sessionData.startTime.getTime();
    if (elapsed < duration) await delay(duration - elapsed);

    sessionData.completed = true;
    logToIPC(sessionId, 'info', `Session completed successfully.`, campaignId);
  } catch (err) {
    sessionData.bounced = true;
    logToIPC(sessionId, 'error', `Error - ${err.stack || err.message}`, campaignId, userEmail);
  } finally {
    sessionData.endTime = new Date();
    sessionData.duration = Math.floor((sessionData.endTime - sessionData.startTime) / 1000);
    
    if (campaignId) {
      try {
        // Record session completion analytics
        await campaignAnalytics.recordSession(campaignId, sessionData);
        logToIPC(sessionId, 'debug', `Session analytics recorded for campaign ${campaignId}.`, campaignId, userEmail);
        
        // Record session end for active session counting
        await campaignAnalytics.recordSessionEnd(campaignId, sessionId);
        logToIPC(sessionId, 'debug', `Session end recorded for campaign ${campaignId}`, campaignId, userEmail);
      } catch (analyticsError) {
        logToIPC(sessionId, 'error', `Failed to record session analytics: ${analyticsError.message}`, campaignId, userEmail);
      }
    }
    if (browser) await browser.close();
    logToIPC(sessionId, 'info', `Browser closed.`, campaignId, userEmail);
  }
}

// Enhanced runTraffic function with integrated Python support
async function runTraffic(params, campaignId = null, userEmail = null, options = {}) {
  // Determine traffic mode - check params for trafficMode or use options
  const trafficMode = params.trafficMode || options.trafficMode || 'puppeteer';
  const usePython = trafficMode === 'python' || options.usePython === true;

  if (usePython) {
    // Python mode - enhanced humanized traffic
    logToIPC(null, 'info', `Starting Python humanized traffic: ${params.concurrent} sessions`, campaignId, userEmail);
    
    if (params.proxies && params.proxies.length > 0) {
      logToIPC(null, 'info', `Using ${params.proxies.length} proxies for Python sessions.`, campaignId, userEmail);
    } else {
      logToIPC(null, 'info', `No proxies configured for Python sessions.`, campaignId, userEmail);
    }

    const sessionCount = params.concurrent;
    const pythonSessions = [];
    
    // Generate session IDs upfront (like Puppeteer mode)
    const sessionIds = Array.from({ length: sessionCount }, () => generateSessionId());
    
    // Create Python session promises
    for (let i = 0; i < sessionCount; i++) {
      const sessionId = sessionIds[i];
      const sessionPromise = (async () => {
        try {
          // Add staggered delay
          await delay(i * (params.delay || 1) * 1000);
          
          // Track session start for active session counting (like Puppeteer mode)
          if (campaignId && sessionId) {
            try {
              logToIPC(sessionId, 'debug', `🚀 Recording Python session start for campaign ${campaignId}`, campaignId, userEmail);
              await campaignAnalytics.recordSessionStart(campaignId, sessionId);
              logToIPC(sessionId, 'debug', `✅ Python session start recorded for campaign ${campaignId}`, campaignId, userEmail);
            } catch (startError) {
              logToIPC(sessionId, 'error', `❌ Failed to record Python session start: ${startError.message}`, campaignId, userEmail);
            }
          } else {
            logToIPC(sessionId, 'warn', `⚠️ Missing campaignId (${campaignId}) or sessionId (${sessionId}) for session start recording`, campaignId, userEmail);
          }
          
          const result = await pythonOrchestrator.runPythonSession(params, {
            userEmail: userEmail,
            headless: options.headless !== false,
            browser: options.browser || 'chromium',
            sessionId: sessionId  // Pass the pre-generated sessionId
          });
          
          logToIPC(result.sessionId || sessionId, 'debug', `Python result received: success=${result.success}, hasStartTime=${!!result.startTime}, hasEndTime=${!!result.endTime}, duration=${result.duration}s`, campaignId, userEmail);
          
          logToIPC(result.sessionId || sessionId, 'info', 
            `Python session completed: ${result.success ? 'Success' : 'Failed'} - ${result.total_actions || 0} actions, ${result.ad_interactions || 0} ad interactions`, 
            campaignId, userEmail);
          
          // Record session completion analytics (like Puppeteer mode)
          if (campaignId) {
            try {
              // Handle potential missing timestamp fields from failed Python sessions
              const now = new Date();
              const startTime = result.startTime ? new Date(result.startTime) : now;
              const endTime = result.endTime ? new Date(result.endTime) : now;
              
              const sessionData = {
                sessionId: result.sessionId || sessionId,
                startTime: startTime,
                endTime: endTime,
                duration: result.duration || 0,
                source: result.source || 'Direct',
                specificReferrer: result.specificReferrer,
                device: result.device || 'Desktop',
                visited: result.visited || false,
                completed: result.completed || false,
                bounced: result.bounced || false,
                proxy: result.proxyUsed || result.proxy || 'No Proxy',
                headful: !options.headless,
                error: !result.success,
                incomplete: !result.success
              };
              
              logToIPC(result.sessionId || sessionId, 'debug', `Recording Python session analytics: success=${result.success}, visited=${sessionData.visited}, completed=${sessionData.completed}, bounced=${sessionData.bounced}, duration=${sessionData.duration}s, startTime=${sessionData.startTime.toISOString()}`, campaignId, userEmail);
              
              await campaignAnalytics.recordSession(campaignId, sessionData);
              logToIPC(result.sessionId || sessionId, 'debug', `✅ Python session analytics recorded for campaign ${campaignId}`, campaignId, userEmail);
              
              // Record session end for active session counting (like Puppeteer mode)
              await campaignAnalytics.recordSessionEnd(campaignId, result.sessionId || sessionId);
              logToIPC(result.sessionId || sessionId, 'debug', `✅ Python session end recorded for campaign ${campaignId}`, campaignId, userEmail);
            } catch (analyticsError) {
              logToIPC(result.sessionId || sessionId, 'error', `❌ Failed to record Python session analytics: ${analyticsError.message}`, campaignId, userEmail);
            }
          } else {
            logToIPC(result.sessionId || sessionId, 'warn', `⚠️ No campaignId provided, skipping analytics recording`, campaignId, userEmail);
          }
          
          return result;
        } catch (error) {
          logToIPC(sessionId, 'error', `Python session ${i + 1} failed: ${error.message}`, campaignId, userEmail);
          
          // Record failed session analytics (like Puppeteer mode)
          if (campaignId && sessionId) {
            try {
              const now = new Date();
              const failedSessionData = {
                sessionId: sessionId,
                startTime: now,
                endTime: now,
                duration: 0,
                source: 'Direct',
                specificReferrer: null,
                device: 'Desktop',
                visited: false,
                completed: false,
                bounced: true,
                proxy: 'No Proxy',
                headful: !options.headless,
                error: true,
                incomplete: true
              };
              
              logToIPC(sessionId, 'debug', `Recording failed Python session analytics for campaign ${campaignId}`, campaignId, userEmail);
              await campaignAnalytics.recordSession(campaignId, failedSessionData);
              logToIPC(sessionId, 'debug', `✅ Failed Python session analytics recorded for campaign ${campaignId}`, campaignId, userEmail);
            } catch (analyticsError) {
              logToIPC(sessionId, 'error', `❌ Failed to record failed session analytics: ${analyticsError.message}`, campaignId, userEmail);
            }
            
            // Record session end for failed sessions (like Puppeteer mode)
            try {
              await campaignAnalytics.recordSessionEnd(campaignId, sessionId);
              logToIPC(sessionId, 'debug', `✅ Python session end recorded for failed session ${campaignId}`, campaignId, userEmail);
            } catch (endError) {
              logToIPC(sessionId, 'error', `❌ Failed to record Python session end: ${endError.message}`, campaignId, userEmail);
            }
          }
          
          return { success: false, error: error.message, sessionIndex: i + 1, sessionId: sessionId };
        }
      })();
      
      pythonSessions.push(sessionPromise);
    }

    // Wait for all Python sessions to complete
    const results = await Promise.allSettled(pythonSessions);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    logToIPC(null, 'info', `Python traffic batch completed: ${successful}/${sessionCount} successful (${(successful/sessionCount*100).toFixed(1)}% success rate)`, campaignId, userEmail);
    
    if (failed > 0) {
      logToIPC(null, 'warn', `${failed} Python sessions failed`, campaignId, userEmail);
    }

  } else {
    // Original Puppeteer mode
    if(params.proxies && params.proxies.length > 0) {
      logToIPC(null, 'info', `Using ${params.proxies.length} proxies for this batch.`, campaignId, userEmail);
    } else {
      logToIPC(null, 'info', `No proxies configured for this batch, using default proxy.`, campaignId, userEmail);
    }
    const headfulPercentage = params.headfulPercentage || 0;
    const sessionCount = params.concurrent;
    logToIPC(null, 'info', `Running batch of ${sessionCount} Puppeteer sessions (${headfulPercentage}% headful)`, campaignId, userEmail);

    const chunkSize = 50;
    const sessionIds = Array.from({ length: sessionCount }, () => generateSessionId());

    for (let i = 0; i < sessionIds.length; i += chunkSize) {
      const batch = sessionIds.slice(i, i + chunkSize);
      const batchPromises = batch.map((sessionId, idx) => (
        (async () => {
          try {
            logToIPC(sessionId, 'debug',
              `Session starting (delay: ${(i + idx) * params.delay}s)`, campaignId, userEmail);
            await delay((i + idx) * params.delay * 1000);
            await launchSession(params, sessionId, campaignId, userEmail);
          } catch (err) {
            logToIPC(sessionId, 'error', `Batch session error: ${err.message}`, campaignId, userEmail);
          }
        })()
      ));
      logToIPC(null, 'debug', `Awaiting batch [${i + 1} – ${i + batch.length}] of ${sessionCount}.`, campaignId, userEmail);
      await Promise.allSettled(batchPromises);
      logToIPC(null, 'info', `Batch [${i + 1} – ${i + batch.length}] complete.`, campaignId, userEmail);
    }

    logToIPC(null, 'info', 'All Puppeteer session batches have completed.', campaignId, userEmail);
  }
}

module.exports = { runTraffic };
