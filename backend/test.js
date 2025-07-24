// require('dotenv').config();
// const { Resend } = require('resend');

// const resend = new Resend(process.env.RESEND_API_KEY);
// const email = 'iron.avenger464@gmail.com';

// async function sendTestEmail() {
//   try {
//     const result = await resend.emails.send({
//       from: process.env.RESEND_FROM,
//       to: email,
//       subject: 'Resend Test Email',
//       text: 'Hello from Resend! This is a test email.',
//     });
//     console.log('Email sent! Result:', result);
//   } catch (error) {
//     console.error('Error sending email:', error);
//   }
// }

// sendTestEmail();


// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// const UserAgent = require('user-agents');
// const winston = require('winston');

// // === Proxy from your image ===
// const PROXY_HOST = '216.180.253.84';
// const PROXY_PORT = '50100';
// const PROXY_PROTOCOL = 'http'; // Only use 'http' for Puppeteer proxy
// const PROXY_USER = 'bnlhmf8t';
// const PROXY_PASS = '7QsTLO9Xvc';
// const PROXY = `${PROXY_PROTOCOL}://${PROXY_HOST}:${PROXY_PORT}`;

// const TARGET_URL = 'https://movie-seach-website.vercel.app/';
// const SESSION_ID = 1;

// const logger = winston.createLogger({
//   level: 'debug',
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
//   ),
//   transports: [new winston.transports.Console()]
// });

// puppeteer.use(StealthPlugin());

// const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// async function testProxySession() {
//   let browser;
//   try {
//     logger.info(`Launching browser with proxy: ${PROXY}`);
//     const launchArgs = ['--no-sandbox', `--proxy-server=${PROXY}`];
//     browser = await puppeteer.launch({ headless: false, args: launchArgs });

//     const page = await browser.newPage();

//     // Set proxy authentication before any navigation
//     await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });

//     // Rotate user-agent (optional)
//     const userAgent = new UserAgent().toString();
//     await page.setUserAgent(userAgent);
//     logger.info(`Session ${SESSION_ID}: User Agent set: ${userAgent}`);

//     await page.setExtraHTTPHeaders({ referer: 'https://google.com/' });
//     logger.info(`Session ${SESSION_ID}: Navigating to: ${TARGET_URL}`);

//     const navResponse = await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
//     if (!navResponse || !navResponse.ok()) {
//       logger.error(`Session ${SESSION_ID}: FAILED to load target page`);
//       return;
//     }
//     logger.info(`Session ${SESSION_ID}: Successfully loaded target page.`);

//     // Simulate scrolling
//     await page.evaluate(() => {
//       window.scrollBy(0, window.innerHeight * 0.7);
//     });
//     logger.info(`Session ${SESSION_ID}: Simulated scroll.`);

//     // Random clickable element
//     const clickable = await page.$('a,button,input[type="button"],input[type="submit"]');
//     if (clickable) {
//       await clickable.click();
//       logger.info(`Session ${SESSION_ID}: Clicked a random clickable element.`);
//       await delay(2000);
//     } else {
//       logger.warn(`Session ${SESSION_ID}: No clickable element found.`);
//     }

//     // Wait for Google Analytics scripts, etc. to fire
//     logger.info(`Session ${SESSION_ID}: Waiting for 10 seconds.`);
//     await delay(10000);

//     logger.info(`Session ${SESSION_ID}: Test complete. Check Google Analytics for visit.`);
//   } catch (err) {
//     logger.error(`Session ${SESSION_ID}: ERROR - ${err.stack || err.message}`);
//   } finally {
//     if (browser) await browser.close();
//     logger.info(`Session ${SESSION_ID}: Browser closed.`);
//   }
// }

// testProxySession();


// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
// const axios = require('axios');
// const { HttpsProxyAgent } = require('https-proxy-agent');

// const url = 'https://geo.brdtest.com/mygeo.json';
// const proxy = 'http://brd-customer-hl_e7ac5487-zone-residential_proxy1:enqlhhda999d@brd.superproxy.io:33335';

// (async()=>{
//   try {
//     const response = await axios.get(url, {
//       httpsAgent: new HttpsProxyAgent(proxy)
//     });
//     console.log(JSON.stringify(response.data, null, 2));
//   } catch(error){
//     console.error('Error:', error.message);
//   }
// })();

// const puppeteer = require('puppeteer');

// const PROXY_HOST = 'brd.superproxy.io';
// const PROXY_PORT = '33335';
// const PROXY_USER = 'brd-customer-hl_e7ac5487-zone-residential_proxy1';
// const PROXY_PASS = 'enqlhhda999d';
// const TARGET_URL = 'https://geo.brdtest.com/mygeo.json';

// (async () => {
//   const browser = await puppeteer.launch({
//     headless: false,
//     args: [
//       `--proxy-server=${PROXY_HOST}:${PROXY_PORT}`,  // only host:port here
//       '--no-sandbox'
//     ],
//     ignoreHTTPSErrors: true
//   });

//   const page = await browser.newPage();

//   // Authenticate *after* newPage(), before any navigation
//   await page.authenticate({
//     username: PROXY_USER,
//     password: PROXY_PASS
//   });

//   try {
//     // Use Response API to see exactly what comes back
//     const response = await page.goto(TARGET_URL, {
//       waitUntil: 'networkidle2',
//       timeout: 60000
//     });

//     console.log('HTTP status:', response.status(), response.statusText());

//     const data = await response.json();
//     console.log('Geo JSON:', data);
//   } catch (err) {
//     console.error('🔴 Puppeteer fetch error:', err);
//   } finally {
//     await browser.close();
//   }
// })();

// curl -x "http://b0ac12156e5e63a82bbe__cr.in:c16003108e64d017@gw.dataimpulse.com:823" https://api.ipify.org/ 
// b0ac12156e5e63a82bbe__cr.US:c16003108e64d017@gw.dataimpulse.com: 823

// const axios = require('axios');
// const { HttpsProxyAgent } = require('https-proxy-agent');

// const url = 'https://ip.decodo.com/json';
// const proxyAgent = new HttpsProxyAgent(
//   'http://b0ac12156e5e63a82bbe:c16003108e64d017@gw.dataimpulse.com:823');

// const apiUrl = 'https://gw.dataimpulse.com:777/api/stats';

// axios
//   .get(url, { httpsAgent: proxyAgent })
//   .then((response) => {
//     console.log(response.data);
//   });

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// const UserAgent = require('user-agents');
// const winston = require('winston');
// const { KnownDevices } = require('puppeteer');

// console.log(Object.keys(KnownDevices));
require('dotenv').config();

const PROXY_HOST = process.env.PROXY_HOST || 'gw.dataimpulse.com';
const PROXY_PORT = process.env.PROXY_PORT || '823';
const PROXY_USER = process.env.PROXY_USER || 'b0ac12156e5e63a82bbe';
const PROXY_PASS = process.env.PROXY_PASS || 'c16003108e64d017';
const PROXY = `${PROXY_HOST}:${PROXY_PORT}`;
console.log('Using proxy:', PROXY);

// === Proxy from your image ===
// Login : b0ac12156e5e63a82bbe
// Password : c16003108e64d017
// Proxy host : gw.dataimpulse.com
// Port : 823
// const PROXY_HOST = 'gw.dataimpulse.com';
// const PROXY_PORT = '823';
// const PROXY_USER = 'b0ac12156e5e63a82bbe__cr.in';
// const PROXY_PASS = 'c16003108e64d017';
// const PROXY = `${PROXY_HOST}:${PROXY_PORT}`;

// const TARGET_URL = 'https://movie-seach-website.vercel.app/';
// let SESSION_ID = 1;

// const logger = winston.createLogger({
//   level: 'debug',
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
//   ),
//   transports: [new winston.transports.Console()]
// });

// puppeteer.use(StealthPlugin());

// const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// async function testProxySession() {
//   if (SESSION_ID > 5) {
//     logger.info('Maximum session limit reached. Exiting.');
//     return;
//   }

//   let browser;
//   try {
//     logger.info(`Launching browser with proxy: ${PROXY}`);

//     // 🔥 Updated proxy args:
//     const launchArgs = [
//       '--no-sandbox',
//       `--proxy-server=${PROXY_HOST}:${PROXY_PORT}`    // host:port only
//     ];

//     browser = await puppeteer.launch({
//       headless: false,
//       args: launchArgs,
//       //ignoreHTTPSErrors: true    // skip HTTPS cert errors
//     });

//     const page = await browser.newPage();

//     // 🔑 Authenticate *after* newPage()
//     await page.authenticate({
//       username: PROXY_USER,
//       password: PROXY_PASS
//     });

//     // Rotate user-agent (optional)
//     const userAgent = new UserAgent().toString();
//     await page.setUserAgent(userAgent);
//     logger.info(`Session ${SESSION_ID}: User Agent set: ${userAgent}`);

//     await page.setExtraHTTPHeaders({ referer: 'https://google.com/' });
//     logger.info(`Session ${SESSION_ID}: Navigating to: ${TARGET_URL}`);

//     const navResponse = await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
//     // Ensure viewport looks real
//     await page.setViewport({ width: 1280, height: 720 });

//     // Wait for the GA call to fire (or 30s timeout)
//     try {
//       const req = await page.waitForRequest(req =>
//         req.url().includes('google-analytics.com') ||
//         req.url().includes('analytics.google.com'),
//         { timeout: 30000 }
//       );
//       console.log('✅ GA request fired:', req.url());
//     } catch (err) {
//       console.warn('⚠️ GA request never fired within 30s');
//     }

//     // Extra delay so GA can batch + send
//     await delay(10000);

//     if (!navResponse || !navResponse.ok()) {
//       logger.error(`Session ${SESSION_ID}: FAILED to load target page`);
//       return;
//     }
//     logger.info(`Session ${SESSION_ID}: Successfully loaded target page.`);

//     // Simulate scrolling
//     await page.evaluate(() => {
//       window.scrollBy(0, window.innerHeight * 0.7);
//     });
//     logger.info(`Session ${SESSION_ID}: Simulated scroll.`);

//     // Random clickable element
//     const clickable = await page.$('a,button,input[type="button"],input[type="submit"]');
//     if (clickable) {
//       await clickable.click();
//       logger.info(`Session ${SESSION_ID}: Clicked a random clickable element.`);
//       await delay(2000);
//     } else {
//       logger.warn(`Session ${SESSION_ID}: No clickable element found.`);
//     }
//     if (clickable) {
//       await clickable.click();
//       logger.info(`Session ${SESSION_ID}: Clicked a random clickable element.`);
//       await delay(2000);
//     } else {
//       logger.warn(`Session ${SESSION_ID}: No clickable element found.`);
//     }
//     if (clickable) {
//       await clickable.click();
//       logger.info(`Session ${SESSION_ID}: Clicked a random clickable element.`);
//       await delay(2000);
//     } else {
//       logger.warn(`Session ${SESSION_ID}: No clickable element found.`);
//     }
//     if (clickable) {
//       await clickable.click();
//       logger.info(`Session ${SESSION_ID}: Clicked a random clickable element.`);
//       await delay(2000);
//     } else {
//       logger.warn(`Session ${SESSION_ID}: No clickable element found.`);
//     }
//     if (clickable) {
//       await clickable.click();
//       logger.info(`Session ${SESSION_ID}: Clicked a random clickable element.`);
//       await delay(2000);
//     } else {
//       logger.warn(`Session ${SESSION_ID}: No clickable element found.`);
//     }
//     if (clickable) {
//       await clickable.click();
//       logger.info(`Session ${SESSION_ID}: Clicked a random clickable element.`);
//       await delay(2000);
//     } else {
//       logger.warn(`Session ${SESSION_ID}: No clickable element found.`);
//     }

//     // Wait for Google Analytics scripts, etc. to fire
//     logger.info(`Session ${SESSION_ID}: Waiting for 10 seconds.`);
//     await delay(10000);

//     logger.info(`Session ${SESSION_ID}: Test complete. Check Google Analytics for visit.`);
//   } catch (err) {
//     logger.error(`Session ${SESSION_ID}: ERROR - ${err.stack || err.message}`);
//   } finally {
//     if (browser) await browser.close();
//     logger.info(`Session ${SESSION_ID}: Browser closed.`);
//   }
//   SESSION_ID++;
//   testProxySession();
// }

// testProxySession();
// testProxySession();
// testProxySession();
// testProxySession();

