require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { KnownDevices } = require('puppeteer');
const UserAgent = require('user-agents');
const crypto = require('crypto');
const redisLogger = require('../services/redisLogger');
const campaignAnalytics = require('../services/campaignAnalytics');
const url = require('url');

puppeteer.use(StealthPlugin());

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function logToWebsocket(ws, sessionId, level, message, campaignId = null, userEmail = null) {
  const logEntry = {
    sessionId,
    level,
    message,
    timestamp: new Date().toISOString()
  };
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(logEntry));
  }
  if (campaignId && userEmail) {
    redisLogger.pushLog(campaignId, userEmail, logEntry);
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
        logToWebsocket(null, null, 'warn', 'Scroll aborted: Execution context destroyed, likely due to navigation.');
        break;
      }
      throw err;
    }
    await delay(scrollDelay);
  }
}

// Perform clicks with mixed XPath, CSS, and random elements, shuffled for realism, with robust redirection logic
async function performClicks(
  page, minClicks, maxClicks, visitDurationMs, sessionId, ws, campaignId = null,
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
    logToWebsocket(ws, sessionId, 'debug', `Custom ad selectors: ${adSelectors.join(', ')}`, campaignId, userEmail);
  } else {
    adSelectors = ['.GoogleActiveViewElement', '.ad-class', '#ad-iframe', '.rgtAdSection'];
    logToWebsocket(ws, sessionId, 'debug', `Default ad selectors: ${adSelectors.join(', ')}`, campaignId, userEmail);
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
    logToWebsocket(ws, sessionId, 'debug', `Custom XPath expressions: ${adsXPaths.join(' | ')}`, campaignId, userEmail);
  }

  // 3. Gather all matching elements: XPath, CSS, then random, tagging each for log/analysis
  let clickCandidates = [];

  // Gather XPath elements with robust error handling
  if (adsXPaths.length > 0) {
    for (const xpath of adsXPaths) {
      try {
        if (page.isClosed()) {
          logToWebsocket(ws, sessionId, 'warn', 'Page closed during XPath element gathering', campaignId, userEmail);
          break;
        }
        const elements = await page.$$(`::-p-xpath(${xpath})`);
        elements.forEach(el => clickCandidates.push({ el, type: 'xpath', selector: xpath }));
        if (elements.length)
          logToWebsocket(ws, sessionId, 'debug', `✓ XPath found ${elements.length} elements for ${xpath}`, campaignId, userEmail);
        else
          logToWebsocket(ws, sessionId, 'debug', `✗ XPath found no elements: ${xpath}`, campaignId, userEmail);
      } catch (err) {
        if (err.message && (err.message.includes('context') || err.message.includes('Node with given id'))) {
          logToWebsocket(ws, sessionId, 'warn', `✗ XPath context lost (${xpath}): Navigation likely occurred`, campaignId, userEmail);
          break; // Stop gathering if context is lost
        }
        logToWebsocket(ws, sessionId, 'error', `✗ XPath error (${xpath}): ${err.message}`, campaignId, userEmail);
      }
    }
  }

  // Gather CSS selector elements with robust error handling
  if (adSelectors.length > 0 && !page.isClosed()) {
    for (const sel of adSelectors) {
      try {
        if (page.isClosed()) {
          logToWebsocket(ws, sessionId, 'warn', 'Page closed during CSS element gathering', campaignId, userEmail);
          break;
        }
        const elements = await page.$$(sel);
        elements.forEach(el => clickCandidates.push({ el, type: 'css', selector: sel }));
        if (elements.length)
          logToWebsocket(ws, sessionId, 'debug', `✓ CSS selector ${sel} found ${elements.length} elements`, campaignId, userEmail);
      } catch (error) {
        if (error.message && (error.message.includes('context') || error.message.includes('Node with given id'))) {
          logToWebsocket(ws, sessionId, 'warn', `✗ CSS context lost (${sel}): Navigation likely occurred`, campaignId, userEmail);
          break;
        }
        logToWebsocket(ws, sessionId, 'error', `✗ CSS ad selector error (${sel}): ${error.message}`, campaignId, userEmail);
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
        logToWebsocket(ws, sessionId, 'debug', `Added ${toAdd.length} random clickable elements for fallback`, campaignId, userEmail);
    } catch (error) {
      logToWebsocket(ws, sessionId, 'error', `Error gathering random elements: ${error.message}`, campaignId, userEmail);
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
        logToWebsocket(ws, sessionId, 'warn', `Skipping click #${i + 1}: Page closed or element invalid`, campaignId, userEmail);
        continue;
      }

      const box = await el.boundingBox();
      if (!box) {
        logToWebsocket(ws, sessionId, 'debug', `Skipping click #${i + 1}: Element not visible or removed`, campaignId, userEmail);
        continue;
      }

      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      logToWebsocket(ws, sessionId, 'debug', `Moving mouse to (${x}, ${y}) for click #${i + 1} [${type}]`, campaignId, userEmail);
      
      await page.mouse.move(x, y, { steps: getRandomInt(5, 15) });
      await delay(getRandomInt(200, 800));
      
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => null),
        page.mouse.click(x, y, { delay: getRandomInt(30, 120) })
      ]);
      
      logToWebsocket(
        ws,
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
          logToWebsocket(
            ws, sessionId, 'debug',
            `Redirect path changed from '${origPath}' to '${currPath}' after click #${i + 1}. Returning to original URL.`,
            campaignId, userEmail
          );
          
          await page.goto(originalUrl, { waitUntil: 'networkidle2' }).catch(err => {
            logToWebsocket(ws, sessionId, 'error', `Failed to return to original URL: ${err.message}`, campaignId, userEmail);
          });
          
          logToWebsocket(ws, sessionId, 'info', `Returned to original URL after redirect.`, campaignId, userEmail);
        }
      } catch (redirectError) {
        logToWebsocket(ws, sessionId, 'error', `Redirect handling error: ${redirectError.message}`, campaignId, userEmail);
      }

    } catch (clickError) {
      if (clickError.message && (clickError.message.includes('context') || clickError.message.includes('Node with given id'))) {
        logToWebsocket(ws, sessionId, 'warn', `Click #${i + 1} failed: Element context lost, likely due to navigation`, campaignId, userEmail);
        break; // Stop clicking if context is consistently lost
      }
      logToWebsocket(ws, sessionId, 'error', `Click #${i + 1} failed: ${clickError.message}`, campaignId, userEmail);
      continue; // Try next click
    }

    // Wait until it's time for the next click
    const now = Date.now();
    if (scheduledTime > now) await delay(scheduledTime - now);
  }

  // Log click summary
  if (adTargetingStats.totalClicks > 0) {
    logToWebsocket(
      ws, sessionId, 'info',
      `Ad Clicks Summary: Total: ${adTargetingStats.totalClicks}, XPath: ${adTargetingStats.xpathClicks}, CSS: ${adTargetingStats.cssClicks}, Random: ${adTargetingStats.randomClicks}`,
      campaignId, userEmail
    );
  }
}

const PROXY_HOST = process.env.PROXY_HOST || 'gw.dataimpulse.com';
const PROXY_PORT = process.env.PROXY_PORT || '823';
const PROXY_USER = process.env.PROXY_USER || 'b0ac12156e5e63a82bbe';
const PROXY_PASS = process.env.PROXY_PASS || 'c16003108e64d017';
const PROXY = `${PROXY_HOST}:${PROXY_PORT}`;

async function launchSession(params, sessionId, ws, campaignId = null, userEmail = null) {
  let browser = null;
  const desktopPercentage = params.desktopPercentage !== undefined ? params.desktopPercentage : 70;
  const shouldBeDesktop = Math.random() * 100 < desktopPercentage;
  const deviceType = shouldBeDesktop ? 'Desktop' : 'Mobile';

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
    proxy: PROXY,
    headful: false
  };

  try {
    // Track session start for active session counting
    if (campaignId) {
      try {
        await campaignAnalytics.recordSessionStart(campaignId, sessionId);
        logToWebsocket(ws, sessionId, 'debug', `Session start recorded for campaign ${campaignId}`, campaignId, userEmail);
      } catch (startError) {
        logToWebsocket(ws, sessionId, 'error', `Failed to record session start: ${startError.message}`, campaignId, userEmail);
      }
    }

    const headfulPercentage = params.headfulPercentage || 0;
    const shouldBeHeadful = Math.random() * 100 < headfulPercentage;
    sessionData.headful = shouldBeHeadful;
    const browserMode = shouldBeHeadful ? 'headful' : 'headless';
    logToWebsocket(ws, sessionId, 'info', `Launching ${browserMode} browser with proxy: ${PROXY}`, campaignId, userEmail);

    const launchArgs = ['--no-sandbox', `--proxy-server=${PROXY}`];
    browser = await puppeteer.launch({
      headless: !shouldBeHeadful,
      args: launchArgs,
      timeout: 60000 // 60 seconds
    });

    const page = await browser.newPage();
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });

    // Robust device emulation (handles unavailable descriptors)
    if (deviceType === 'Mobile') {
      const device =
        KnownDevices['iPhone 15 Pro'] ||
        KnownDevices['iPhone X'] ||
        KnownDevices['iPhone 12 Pro'] ||
        KnownDevices['iPhone 8'];
      if (device) {
        await page.emulate(device);
        logToWebsocket(ws, sessionId, 'debug', `Mobile emulation: ${device.name || 'device descriptor'}`, campaignId, userEmail);
      } else {
        await page.setViewport({ width: 375, height: 812 });
        logToWebsocket(ws, sessionId, 'debug', 'Mobile emulation: Manual fallback', campaignId, userEmail);
      }
    } else {
      await page.setViewport({ width: 1366, height: 768 });
      logToWebsocket(ws, sessionId, 'debug', 'Desktop viewport 1366x768', campaignId, userEmail);
      const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
      await page.setUserAgent(userAgent);
      logToWebsocket(ws, sessionId, 'debug', `User Agent set: ${userAgent} (Desktop)`, campaignId, userEmail);
    }

    let referer = '';
    const rand = Math.random() * 100;
    if (rand < params.organic) {
      referer = 'https://www.google.com/';
      sessionData.source = 'Organic';
      sessionData.specificReferrer = referer;
      logToWebsocket(ws, sessionId, 'debug', `Using Google as referer.`, campaignId, userEmail);
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
      logToWebsocket(ws, sessionId, 'debug', `Using custom referer: ${referer}`, campaignId, userEmail);
    } else if (params.social && Object.values(params.social).some(Boolean)) {
      const socialRefs = [];
      if (params.social.Facebook) socialRefs.push('https://facebook.com/');
      if (params.social.Twitter) socialRefs.push('https://twitter.com/');
      if (params.social.Instagram) socialRefs.push('https://instagram.com/');
      if (params.social.LinkedIn) socialRefs.push('https://linkedin.com/');
      referer = socialRefs[getRandomInt(0, socialRefs.length - 1)];
      sessionData.source = 'Social';
      sessionData.specificReferrer = referer;
      logToWebsocket(ws, sessionId, 'debug', `Using social referer: ${referer}`, campaignId, userEmail);
    }
    if (referer) await page.setExtraHTTPHeaders({ referer });
    logToWebsocket(ws, sessionId, 'debug', `Navigating to: ${params.url}`, campaignId, userEmail);

    try {
      logToWebsocket(ws, sessionId, 'debug', `Navigating to: ${params.url}`, campaignId, userEmail);
      await page.goto(params.url, {
        waitUntil: 'networkidle2',
        timeout: 60000 // increased timeout to 60 seconds
      });
      sessionData.visited = true;
    } catch (navErr) {
      sessionData.bounced = true;
      logToWebsocket(ws, sessionId, 'error', `Navigation to ${params.url} failed: ${navErr.message}`, campaignId, userEmail);
      throw navErr; // stop the session early
    }
    logToWebsocket(ws, sessionId, 'info', `Page loaded: ${params.url}`, campaignId, userEmail);
    const originalUrl = page.url();


    // Calculate session duration (ms)
    const minDuration = (params.visitDurationMin || params.visitDuration || 30) * 1000;
    const maxDuration = (params.visitDurationMax || params.visitDuration || 30) * 1000;
    let duration = Math.floor(Math.random() * (maxDuration - minDuration) + minDuration);

    if (Math.random() * 100 < params.bounceRate) {
      duration = Math.floor(Math.random() * minDuration * 0.3 + minDuration * 0.2);
      sessionData.bounced = true;
      logToWebsocket(ws, sessionId, 'info', `Bounce triggered, will leave early.`, campaignId, userEmail);
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
      duration, sessionId, ws, campaignId, browserMode, userEmail, originalUrl, adConfig
    );
    const scrollPromise = params.scrolling ? scrollPageLoop(page, duration) : Promise.resolve();

    logToWebsocket(ws, sessionId, 'debug', `Session interaction will run for ${Math.round(duration / 1000)}s`, campaignId, userEmail);
    await Promise.all([clickPromise, scrollPromise]);

    const elapsed = Date.now() - sessionData.startTime.getTime();
    if (elapsed < duration) await delay(duration - elapsed);

    sessionData.completed = true;
    logToWebsocket(ws, sessionId, 'info', `Session completed successfully.`, campaignId);
  } catch (err) {
    sessionData.bounced = true;
    logToWebsocket(ws, sessionId, 'error', `Error - ${err.stack || err.message}`, campaignId, userEmail);
  } finally {
    sessionData.endTime = new Date();
    sessionData.duration = Math.floor((sessionData.endTime - sessionData.startTime) / 1000);
    
    if (campaignId) {
      try {
        // Record session completion analytics
        await campaignAnalytics.recordSession(campaignId, sessionData);
        logToWebsocket(ws, sessionId, 'debug', `Session analytics recorded for campaign ${campaignId}.`, campaignId, userEmail);
        
        // Record session end for active session counting
        await campaignAnalytics.recordSessionEnd(campaignId, sessionId);
        logToWebsocket(ws, sessionId, 'debug', `Session end recorded for campaign ${campaignId}`, campaignId, userEmail);
      } catch (analyticsError) {
        logToWebsocket(ws, sessionId, 'error', `Failed to record session analytics: ${analyticsError.message}`, campaignId, userEmail);
      }
    }
    if (browser) await browser.close();
    logToWebsocket(ws, sessionId, 'info', `Browser closed.`, campaignId, userEmail);
  }
}

// Batched high concurrency runner
async function runTraffic(params, ws, campaignId = null, userEmail = null) {
  const headfulPercentage = params.headfulPercentage || 0;
  const sessionCount = params.concurrent;
  logToWebsocket(ws, null, 'info', `Running batch of ${sessionCount} sessions (${headfulPercentage}% headful)`, campaignId, userEmail);

  const chunkSize = 50;
  const sessionIds = Array.from({ length: sessionCount }, () => generateSessionId());

  for (let i = 0; i < sessionIds.length; i += chunkSize) {
    const batch = sessionIds.slice(i, i + chunkSize);
    const batchPromises = batch.map((sessionId, idx) => (
      (async () => {
        try {
          logToWebsocket(ws, sessionId, 'debug',
            `Session starting (delay: ${(i + idx) * params.delay}s)`, campaignId, userEmail);
          await delay((i + idx) * params.delay * 1000);
          await launchSession(params, sessionId, ws, campaignId, userEmail);
        } catch (err) {
          logToWebsocket(ws, sessionId, 'error', `Batch session error: ${err.message}`, campaignId, userEmail);
        }
      })()
    ));
    logToWebsocket(ws, null, 'debug', `Awaiting batch [${i + 1} – ${i + batch.length}] of ${sessionCount}.`, campaignId, userEmail);
    await Promise.allSettled(batchPromises);
    logToWebsocket(ws, null, 'info', `Batch [${i + 1} – ${i + batch.length}] complete.`, campaignId, userEmail);
  }

  logToWebsocket(ws, null, 'info', 'All session batches have completed.', campaignId, userEmail);
}

module.exports = { runTraffic };
