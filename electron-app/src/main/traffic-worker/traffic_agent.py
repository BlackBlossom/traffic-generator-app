import asyncio
import random
import time
import os
import logging
import json
import sys
import argparse
import warnings
import secrets
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple

# --- Begin automation harness (add-on) ---
import nest_asyncio
nest_asyncio.apply()

def parse_config():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, help="Path to config JSON file")
    args, _ = parser.parse_known_args()
    config = {}
    if args.config and os.path.exists(args.config):
        with open(args.config, 'r') as f:
            config = json.load(f)
    return config

NODE_AUTOMATION_CONFIG = parse_config()

# Node.js compatible logging function
def log_to_node(session_id, level, message, campaign_id=None, user_email=None):
    """Log messages in Node.js compatible format matching logToIPC function exactly"""
    if NODE_AUTOMATION_CONFIG:
        # Extract campaign and user info from config if not provided
        if not campaign_id:
            campaign_id = NODE_AUTOMATION_CONFIG.get('campaignId')
        if not user_email:
            user_email = NODE_AUTOMATION_CONFIG.get('userEmail')
    
    # Log to console for main process debugging - EXACT format match with Puppeteer
    timestamp = datetime.now().isoformat()
    session_display = session_id or 'python-worker'
    try:
        print(f"[{timestamp}] [{session_display}] [{level.upper()}] {message}", flush=True)
    except UnicodeEncodeError:
        # Fallback for encoding issues - replace problematic characters
        safe_message = message.encode('ascii', 'replace').decode('ascii')
        print(f"[{timestamp}] [{session_display}] [{level.upper()}] {safe_message}", flush=True)
    
    # Create log entry structure exactly like Puppeteer logToIPC
    log_entry = {
        "level": level,
        "message": message,
        "sessionId": session_id or 'python-worker',
        "timestamp": timestamp
    }
    
    # Output structured log for Node.js processing (matches logEventHub behavior)
    if campaign_id and user_email:
        structured_log = {
            "type": "python_log",
            "campaignId": campaign_id,
            "userEmail": user_email,
            "logEntry": log_entry
        }
        print(f"PYTHON_STRUCTURED_LOG: {json.dumps(structured_log)}", flush=True)
    
    return log_entry

# --- End automation harness (add-on) ---

import aiohttp
from bs4 import BeautifulSoup
import google.generativeai as genai
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
from urllib.parse import urlparse, urljoin, quote_plus
import traceback

# Search engine URL templates
SEARCH_ENGINES = {
    'Google': 'https://www.google.com/search?q={query}',
    'Yahoo': 'https://search.yahoo.com/search?p={query}',
    'Bing': 'https://www.bing.com/search?q={query}',
    'DuckDuckGo': 'https://duckduckgo.com/?q={query}',
    'Baidu': 'https://www.baidu.com/s?wd={query}',
    'Yandex': 'https://yandex.com/search/?text={query}',
    'Ask': 'https://www.ask.com/web?q={query}',
    'Ecosia': 'https://www.ecosia.org/search?q={query}'
}

def get_search_url(engine: str, keywords: str) -> str:
    """Generate search URL for given engine and keywords"""
    if not keywords or not engine:
        return None
    
    # Clean and encode keywords
    encoded_keywords = quote_plus(keywords.strip())
    
    # Get search engine template
    template = SEARCH_ENGINES.get(engine, SEARCH_ENGINES['Google'])
    
    return template.format(query=encoded_keywords)

def should_use_direct_traffic() -> bool:
    """Determine if this session should use direct traffic based on directTraffic percentage"""
    if not hasattr(Config, 'DIRECT_TRAFFIC') or Config.DIRECT_TRAFFIC <= 0:
        return False
    
    import random
    return random.randint(1, 100) <= Config.DIRECT_TRAFFIC

# Suppress asyncio warnings on Windows
warnings.filterwarnings("ignore", category=ResourceWarning)
import signal
import atexit

def cleanup_handler():
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.stop()
    except:
        pass
atexit.register(cleanup_handler)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('traffic_agent.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# -- Your original Config class, unchanged except HEADLESS for automation --
class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyBqBM6IWqYWO7jC5HUZIAfq8xinavSoDbg")
    CHROME_PATH = os.getenv("CHROME_PATH", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
    MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
    MIN_DELAY = float(os.getenv("MIN_DELAY", "1.0"))
    MAX_DELAY = float(os.getenv("MAX_DELAY", "5.0"))
    # These will be updated by config below!
    HEADLESS = os.getenv("HEADLESS", "false").lower() == "true"
    MAX_ADS_PER_SESSION = int(os.getenv("MAX_ADS_PER_SESSION", "2"))
    MIN_SESSION_PERCENT_FOR_ADS = float(os.getenv("MIN_SESSION_PERCENT_FOR_ADS", "0.5"))
    SCROLL_BEHAVIOR = os.getenv("SCROLL_BEHAVIOR", "natural")
    INTERACTION_DELAY_MIN = float(os.getenv("INTERACTION_DELAY_MIN", "0.5"))
    INTERACTION_DELAY_MAX = float(os.getenv("INTERACTION_DELAY_MAX", "3.0"))
    AD_DETECTION_THRESHOLD = float(os.getenv("AD_DETECTION_THRESHOLD", "0.8"))
    # Resource loading configuration
    LOAD_CSS = os.getenv("LOAD_CSS", "true").lower() == "true"
    LOAD_FONTS = os.getenv("LOAD_FONTS", "false").lower() == "true"
    LOAD_MEDIA = os.getenv("LOAD_MEDIA", "false").lower() == "true"

# -- Update config from Node orchestrator, if set --
if NODE_AUTOMATION_CONFIG:
    Config.HEADLESS = bool(NODE_AUTOMATION_CONFIG.get('headless', Config.HEADLESS))
    Config.BROWSER = NODE_AUTOMATION_CONFIG.get('browser', 'chromium')
    Config.DURATION = NODE_AUTOMATION_CONFIG.get('duration_seconds', 60)
    Config.PROXY = NODE_AUTOMATION_CONFIG.get('proxy', None)
    
    # Resource loading configuration from Node.js
    Config.LOAD_CSS = bool(NODE_AUTOMATION_CONFIG.get('loadCSS', Config.LOAD_CSS))
    Config.LOAD_FONTS = bool(NODE_AUTOMATION_CONFIG.get('loadFonts', Config.LOAD_FONTS))
    Config.LOAD_MEDIA = bool(NODE_AUTOMATION_CONFIG.get('loadMedia', Config.LOAD_MEDIA))
    
    # Format proxy for Playwright if needed
    if Config.PROXY and isinstance(Config.PROXY, dict):
        if Config.PROXY.get('host') and Config.PROXY.get('port'):
            # Convert proxy object to Playwright format
            Config.PROXY = {
                'server': f"http://{Config.PROXY['host']}:{Config.PROXY['port']}",
                'username': Config.PROXY.get('username', ''),
                'password': Config.PROXY.get('password', '')
            }
        elif Config.PROXY.get('proxyString'):
            # Handle existing proxyString format
            proxy_parts = Config.PROXY['proxyString'].split(':')
            if len(proxy_parts) >= 2:
                Config.PROXY = {
                    'server': f"http://{proxy_parts[0]}:{proxy_parts[1]}",
                    'username': Config.PROXY.get('username', ''),
                    'password': Config.PROXY.get('password', '')
                }
    Config.COOKIES = NODE_AUTOMATION_CONFIG.get('cookies', [])
    Config.SESSION_ID = NODE_AUTOMATION_CONFIG.get('sessionId', secrets.token_urlsafe(7)[:7])
    Config.CAMPAIGN_ID = NODE_AUTOMATION_CONFIG.get('campaignId', None)
    Config.USER_EMAIL = NODE_AUTOMATION_CONFIG.get('userEmail', None)
    Config.BOUNCE_RATE = NODE_AUTOMATION_CONFIG.get('bounceRate', 0)
    Config.ORGANIC = NODE_AUTOMATION_CONFIG.get('organic', 0)
    Config.DIRECT_TRAFFIC = NODE_AUTOMATION_CONFIG.get('directTraffic', 30)
    Config.SEARCH_ENGINE = NODE_AUTOMATION_CONFIG.get('searchEngine', 'Google')
    Config.SEARCH_KEYWORDS = NODE_AUTOMATION_CONFIG.get('searchKeywords', '')
    Config.SOCIAL = NODE_AUTOMATION_CONFIG.get('social', {})
    Config.CUSTOM = NODE_AUTOMATION_CONFIG.get('custom', '')
    Config.DESKTOP_PERCENTAGE = NODE_AUTOMATION_CONFIG.get('desktopPercentage', 70)
    Config.SCROLLING = NODE_AUTOMATION_CONFIG.get('scrolling', True)
    Config.VISIT_DURATION_MIN = NODE_AUTOMATION_CONFIG.get('visitDurationMin', 30)
    Config.VISIT_DURATION_MAX = NODE_AUTOMATION_CONFIG.get('visitDurationMax', 120)
    Config.DEVICE = NODE_AUTOMATION_CONFIG.get('device', 'desktop')
    Config.SOURCE = NODE_AUTOMATION_CONFIG.get('source', 'Direct')
    Config.SPECIFIC_REFERRER = NODE_AUTOMATION_CONFIG.get('specificReferrer', None)
    Config.HEADFUL_PERCENTAGE = NODE_AUTOMATION_CONFIG.get('headfulPercentage', 0)
    Config.SHOULD_BE_HEADFUL = NODE_AUTOMATION_CONFIG.get('shouldBeHeadful', False)
    Config.GEO = NODE_AUTOMATION_CONFIG.get('geo', '')
    Config.NOTES = NODE_AUTOMATION_CONFIG.get('notes', '')
    
    # Log configuration details similar to Puppeteer mode
    session_id = Config.SESSION_ID
    browser_mode = 'headful' if not Config.HEADLESS else 'headless'
    
    if Config.PROXY and Config.PROXY.get('server'):
        log_to_node(session_id, 'info', f'Launching {browser_mode} {Config.BROWSER} browser with proxy: {Config.PROXY["server"]}', 
                   Config.CAMPAIGN_ID, Config.USER_EMAIL)
    else:
        log_to_node(session_id, 'info', f'Launching {browser_mode} {Config.BROWSER} browser', 
                   Config.CAMPAIGN_ID, Config.USER_EMAIL)
    
    log_to_node(session_id, 'debug', f'Device type selected: {Config.DEVICE.capitalize()}', 
               Config.CAMPAIGN_ID, Config.USER_EMAIL)
    log_to_node(session_id, 'debug', f'Visit duration: {Config.VISIT_DURATION_MIN}-{Config.VISIT_DURATION_MAX}s', 
               Config.CAMPAIGN_ID, Config.USER_EMAIL)
    log_to_node(session_id, 'debug', f'Traffic source: {Config.SOURCE}', 
               Config.CAMPAIGN_ID, Config.USER_EMAIL)
    
    if Config.SPECIFIC_REFERRER:
        log_to_node(session_id, 'debug', f'Specific referrer: {Config.SPECIFIC_REFERRER}', 
                   Config.CAMPAIGN_ID, Config.USER_EMAIL)
    
    if Config.BOUNCE_RATE > 0:
        log_to_node(session_id, 'debug', f'Bounce rate: {Config.BOUNCE_RATE}%', 
                   Config.CAMPAIGN_ID, Config.USER_EMAIL)
    
    if Config.ORGANIC > 0:
        log_to_node(session_id, 'debug', f'Organic traffic: {Config.ORGANIC}%', 
                   Config.CAMPAIGN_ID, Config.USER_EMAIL)
        if Config.SEARCH_KEYWORDS:
            log_to_node(session_id, 'debug', f'Search engine: {Config.SEARCH_ENGINE}', 
                       Config.CAMPAIGN_ID, Config.USER_EMAIL)
            log_to_node(session_id, 'debug', f'Search keywords: {Config.SEARCH_KEYWORDS}', 
                       Config.CAMPAIGN_ID, Config.USER_EMAIL)
        log_to_node(session_id, 'debug', f'Direct traffic percentage: {Config.DIRECT_TRAFFIC}%', 
                   Config.CAMPAIGN_ID, Config.USER_EMAIL)

try:
    genai.configure(api_key=Config.GEMINI_API_KEY)
    log_to_node('config', 'info', "Gemini AI configured successfully")
except Exception as e:
    log_to_node('config', 'error', f"Failed to configure Gemini AI: {e}")


# Enhanced constants with comprehensive selectors
AD_IFRAME_SELECTORS = [
    "iframe[src*='ads']", "iframe[src*='googleads']", "iframe[src*='googlesyndication']",
    "iframe[id*='google_ads']", "iframe[data-google-container-id]", "iframe[class*='ad']",
    "iframe[src*='doubleclick']", "iframe[src*='adsystem']", "iframe[src*='amazon-adsystem']",
    "iframe[src*='facebook.com/tr']", "iframe[class*='adframe']", "iframe[id*='aswift']",
    "div[class*='ad-frame'] iframe", "div[id*='ad'] iframe"
]

DISPLAY_AD_SELECTORS = [
    "div[class*='ad']", "div[id*='ad']", "div[class*='banner']", "div[class*='sponsored']",
    "div[class*='advertisement']", "ins.adsbygoogle", "div.google-ad", "div.ad-container",
    "div[data-ad]", "div[data-ad-unit]", "div[data-ad-client]", "div[class*='promo']",
    "aside[class*='ad']", "section[class*='ad']", "[data-testid*='ad']", "div[class*='widget-ad']",
    "div[class*='sidebar-ad']", "div[class*='header-ad']", "div[class*='footer-ad']",
    "div[class*='content-ad']", "div[class*='native-ad']", "div[class*='text-ad']"
]

VIDEO_AD_SELECTORS = [
    "div[class*='video-ad']", "div[id*='video-ad']", "div[class*='preroll']", 
    "div[class*='midroll']", "video[class*='ad']", "div[data-video-ad]",
    "div[class*='youtube-ad']", "div[class*='vmap']", "div[class*='vast']"
]

SOCIAL_AD_SELECTORS = [
    "div[data-testid='fbfeed_story']", "article[data-testid='tweet']", 
    "div[class*='promoted']", "div[class*='sponsored-content']", 
    "div[aria-label*='Sponsored']", "div[aria-label*='Promoted']"
]

POPUP_AD_SELECTORS = [
    "div[class*='popup']", "div[class*='modal']", "div[class*='overlay']",
    "div[class*='interstitial']", "div[class*='lightbox']", "div[class*='dialog']",
    "div[role='dialog']", "div[aria-modal='true']", "div[class*='ad-popup']"
]

NATIVE_AD_SELECTORS = [
    "article[class*='sponsored']", "section[class*='promoted']", "div[class*='recommended']",
    "div[class*='suggested']", "div[data-native-ad]", "div[class*='partner']",
    "div[class*='content-recommendation']", "div[class*='related-content']"
]

ALL_AD_SELECTORS = (AD_IFRAME_SELECTORS + DISPLAY_AD_SELECTORS + VIDEO_AD_SELECTORS + 
                   SOCIAL_AD_SELECTORS + POPUP_AD_SELECTORS + NATIVE_AD_SELECTORS)

OVERLAY_SELECTORS = [
    "div[class*='overlay']", "div[class*='modal']", "div[class*='popup']",
    "div[id*='overlay']", "div[id*='modal']", "div[id*='popup']",
    "div[class*='lightbox']", "div[class*='dialog']", "div[class*='banner']",
    "div[role='dialog']", "div[aria-modal='true']", "[data-testid*='modal']",
    ".modal", ".popup", ".overlay", ".lightbox", ".banner-ad"
]

CLOSE_BUTTON_SELECTORS = [
    "button[class*='close']", "button[class*='dismiss']", "button[aria-label*='close']",
    "span[class*='close']", "svg[class*='close']", "[aria-label*='close']",
    "[title*='close']", "[data-dismiss]", ".close", ".dismiss", 
    "button[type='button'][aria-label*='Close']", "i[class*='close']"
]

USER_AGENTS = {
    "desktop": [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0"
    ],
    "mobile": [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 14; Samsung SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36"
    ]
}

MOBILE_VIEWPORTS = [
    {"width": 375, "height": 812},  # iPhone X/11/12/13 Pro
    {"width": 414, "height": 896},  # iPhone 11/XR
    {"width": 390, "height": 844},  # iPhone 12/13
    {"width": 393, "height": 851},  # Pixel 7
    {"width": 360, "height": 740},  # Samsung Galaxy S20
    {"width": 412, "height": 915}   # Samsung Galaxy S21
]

DESKTOP_VIEWPORTS = [
    {"width": 1366, "height": 768},  # Most common
    {"width": 1920, "height": 1080}, # Full HD
    {"width": 1440, "height": 900},  # MacBook Pro 15"
    {"width": 1536, "height": 864},  # 1.5x scaling
    {"width": 1280, "height": 720},  # HD
    {"width": 1600, "height": 900}   # 16:9 widescreen
]

def get_device_config(device_type: str) -> dict:
    """Get device-specific configuration"""
    if device_type.lower() == 'mobile':
        viewport = random.choice(MOBILE_VIEWPORTS)
        user_agent = random.choice(USER_AGENTS["mobile"])
        return {
            "viewport": viewport,
            "screen": {"width": viewport["width"], "height": viewport["height"]},
            "user_agent": user_agent,
            "is_mobile": True,
            "has_touch": True,
            "device_scale_factor": random.choice([1, 2, 3])
        }
    else:
        viewport = random.choice(DESKTOP_VIEWPORTS)
        user_agent = random.choice(USER_AGENTS["desktop"])
        return {
            "viewport": viewport,
            "screen": {"width": viewport["width"], "height": viewport["height"]},
            "user_agent": user_agent,
            "is_mobile": False,
            "has_touch": False,
            "device_scale_factor": 1
        }

class RetryHandler:
    """Handles retry logic with exponential backoff"""
    
    @staticmethod
    async def retry_with_backoff(func, max_retries=Config.MAX_RETRIES, base_delay=1.0, session_id='retry-handler'):
        for attempt in range(max_retries):
            try:
                return await func()
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e
                delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                log_to_node(session_id, 'warn', f"Attempt {attempt + 1} failed: {e}. Retrying in {delay:.2f}s")
                await asyncio.sleep(delay)

class HealthChecker:
    """Monitors page and browser health"""
    
    def __init__(self, page: Page):
        self.page = page
        
    async def is_page_responsive(self) -> bool:
        """Check if page is responsive"""
        try:
            # Try multiple checks with shorter timeouts
            try:
                await self.page.evaluate("document.readyState", timeout=2000)
                return True
            except:
                # Fallback: check if page is connected
                try:
                    await self.page.evaluate("1 + 1", timeout=1000)
                    return True
                except:
                    # Final fallback: check page URL
                    try:
                        url = self.page.url
                        return bool(url and url != "about:blank")
                    except:
                        return False
        except:
            return False
            
    async def check_memory_usage(self) -> Dict:
        """Monitor memory usage"""
        try:
            memory_info = await self.page.evaluate("""
                () => {
                    if (performance.memory) {
                        return {
                            used: performance.memory.usedJSHeapSize,
                            total: performance.memory.totalJSHeapSize,
                            limit: performance.memory.jsHeapSizeLimit
                        };
                    }
                    return null;
                }
            """)
            return memory_info or {}
        except:
            return {}

class EnhancedOverlayHandler:
    """Enhanced overlay detection and handling"""
    
    def __init__(self, page: Page, session_id):
        self.page = page
        self.session_id = session_id
        self.closed_overlays = set()
        
    async def detect_overlays(self) -> List[str]: #detects overlays on the page by checking for specific selectors like overlay, modal, etc. and returns a list of overlay names by their class names and indices
        """Detect all possible overlays on the page"""
        overlays = []
        for selector in OVERLAY_SELECTORS:
            try:
                elements = await self.page.query_selector_all(selector)
                for i, element in enumerate(elements):
                    is_visible = await element.is_visible()
                    if is_visible:
                        overlay_id = f"{selector}[{i}]"
                        overlays.append(overlay_id)
            except:
                continue
        return overlays
    
    async def close_overlay(self, overlay_selector: str) -> bool:
        """Close a specific overlay"""
        try:
            # Extract base selector from overlay_id
            base_selector = overlay_selector.split('[')[0]
            elements = await self.page.query_selector_all(base_selector)
            
            if not elements:
                return False
                
            element = elements[0]  # Take first element
                
            # Try multiple close strategies
            strategies = [
                self._try_close_button,
                self._try_escape_key,
                self._try_click_outside,
                self._try_direct_click
            ]
            
            for strategy in strategies:
                if await strategy(element):
                    self.closed_overlays.add(overlay_selector)
                    await asyncio.sleep(random.uniform(0.5, 1.5))
                    return True
                    
        except Exception as e:
            log_to_node(self.session_id, 'debug', f"Error closing overlay {overlay_selector}: {e}")
            
        return False
    
    async def _try_close_button(self, element) -> bool:
        """Try to find and click close button"""
        try:
            for selector in CLOSE_BUTTON_SELECTORS:
                close_btn = await element.query_selector(selector)
                if close_btn and await close_btn.is_visible():
                    await close_btn.scroll_into_view_if_needed()
                    await close_btn.click(timeout=3000)
                    log_to_node(self.session_id, 'info', f"Closed overlay using close button: {selector}")
                    return True
        except:
            pass
        return False
    
    async def _try_escape_key(self, element) -> bool:
        """Try pressing Escape key"""
        try:
            await self.page.keyboard.press('Escape')
            await asyncio.sleep(0.5)
            is_visible = await element.is_visible()
            if not is_visible:
                log_to_node(self.session_id, 'info', "Closed overlay using Escape key")
                return True
        except:
            pass
        return False
    
    async def _try_click_outside(self, element) -> bool:
        """Try clicking outside the overlay"""
        try:
            viewport = self.page.viewport_size
            if viewport:
                # Click in corners
                corners = [
                    (10, 10), (viewport['width']-10, 10),
                    (10, viewport['height']-10), (viewport['width']-10, viewport['height']-10)
                ]
                for x, y in corners:
                    await self.page.mouse.click(x, y)
                    await asyncio.sleep(0.2)
                    if not await element.is_visible():
                        log_to_node(self.session_id, 'info', "Closed overlay by clicking outside")
                        return True
        except:
            pass
        return False
    
    async def _try_direct_click(self, element) -> bool:
        """Try clicking the overlay directly"""
        try:
            await element.click(timeout=2000)
            await asyncio.sleep(0.5)
            if not await element.is_visible():
                log_to_node(self.session_id, 'info', "Closed overlay with direct click")
                return True
        except:
            pass
        return False
    
    async def handle_all_overlays(self) -> int:
        """Handle all detected overlays"""
        overlays = await self.detect_overlays()
        closed_count = 0
        
        for overlay in overlays:
            if overlay not in self.closed_overlays:
                if await self.close_overlay(overlay):
                    closed_count += 1
                    
        return closed_count

class AdInteractionReporter:
    """Comprehensive ad interaction tracking and reporting system"""
    
    def __init__(self):
        self.interactions = {
            'clicked_ads': [],
            'detected_ads': [],
            'ignored_ads': [],
            'failed_interactions': [],
            'popup_closures': [],
            'iframe_interactions': [],
            'native_ad_clicks': [],
            'video_ad_interactions': []
        }
        self.stats = {
            'total_ads_detected': 0,
            'total_ads_clicked': 0,
            'click_success_rate': 0.0,
            'ad_types_found': set(),
            'domains_with_ads': set()
        }
        
    def log_ad_detection(self, ad_type: str, selector: str, element_info: dict, url: str):
        """Log detected ad element"""
        detection = {
            'timestamp': datetime.now().isoformat(),
            'ad_type': ad_type,
            'selector': selector,
            'element_info': element_info,
            'url': url,
            'domain': self._extract_domain(url)
        }
        self.interactions['detected_ads'].append(detection)
        self.stats['total_ads_detected'] += 1
        self.stats['ad_types_found'].add(ad_type)
        self.stats['domains_with_ads'].add(self._extract_domain(url))
        
    def log_ad_click(self, ad_type: str, element_info: dict, success: bool, url: str, reason: str = ""):
        """Log ad click attempt"""
        click_data = {
            'timestamp': datetime.now().isoformat(),
            'ad_type': ad_type,
            'element_info': element_info,
            'success': success,
            'url': url,
            'domain': self._extract_domain(url),
            'reason': reason
        }
        
        if success:
            self.interactions['clicked_ads'].append(click_data)
            self.stats['total_ads_clicked'] += 1
        else:
            self.interactions['failed_interactions'].append(click_data)
            
    def log_ignored_ad(self, ad_type: str, element_info: dict, reason: str, url: str):
        """Log why an ad was ignored"""
        ignored = {
            'timestamp': datetime.now().isoformat(),
            'ad_type': ad_type,
            'element_info': element_info,
            'reason': reason,
            'url': url,
            'domain': self._extract_domain(url)
        }
        self.interactions['ignored_ads'].append(ignored)
        
    def log_popup_closure(self, popup_info: dict, url: str):
        """Log popup ad closure"""
        closure = {
            'timestamp': datetime.now().isoformat(),
            'popup_info': popup_info,
            'url': url,
            'domain': self._extract_domain(url)
        }
        self.interactions['popup_closures'].append(closure)
        
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            from urllib.parse import urlparse
            return urlparse(url).netloc
        except:
            return "unknown"
            
    def calculate_stats(self):
        """Calculate interaction statistics"""
        total_attempts = self.stats['total_ads_clicked'] + len(self.interactions['failed_interactions'])
        if total_attempts > 0:
            self.stats['click_success_rate'] = (self.stats['total_ads_clicked'] / total_attempts) * 100
        else:
            self.stats['click_success_rate'] = 0.0
            
    def generate_report(self) -> dict:
        """Generate comprehensive interaction report"""
        self.calculate_stats()
        
        # Extract detailed ad information
        clicked_ad_details = self._extract_clicked_ad_details()
        ignored_ad_details = self._extract_ignored_ad_details()
        ad_type_breakdown = self._get_ad_type_breakdown()
        
        report = {
            'session_summary': {
                'total_ads_detected': self.stats['total_ads_detected'],
                'total_ads_clicked': self.stats['total_ads_clicked'],
                'total_ads_ignored': len(self.interactions['ignored_ads']),
                'total_failed_clicks': len(self.interactions['failed_interactions']),
                'click_success_rate': f"{self.stats['click_success_rate']:.1f}%",
                'ad_types_encountered': list(self.stats['ad_types_found']),
                'domains_with_ads': list(self.stats['domains_with_ads']),
                'popup_closures': len(self.interactions['popup_closures']),
                'clicked_ads_details': clicked_ad_details,
                'ignored_ads_summary': ignored_ad_details,
                'ad_type_breakdown': ad_type_breakdown
            },
            'detailed_interactions': self.interactions,
            'recommendations': self._generate_recommendations()
        }
        
        return report
    
    def _extract_clicked_ad_details(self) -> list:
        """Extract detailed information about clicked ads"""
        clicked_details = []
        
        for ad in self.interactions['clicked_ads']:
            element_info = ad.get('element_info', {})
            detail = {
                'ad_name': self._extract_ad_name(element_info),
                'ad_type': ad.get('ad_type', 'unknown'),
                'click_time': ad.get('timestamp', ''),
                'domain': ad.get('domain', 'unknown'),
                'ad_text': element_info.get('text_content', '')[:50],
                'ad_position': element_info.get('position', {}),
                'selector_used': self._find_selector_from_element_info(element_info)
            }
            clicked_details.append(detail)
            
        return clicked_details
    
    def _extract_ignored_ad_details(self) -> dict:
        """Extract summary of ignored ads with reasons"""
        ignored_summary = {}
        
        for ad in self.interactions['ignored_ads']:
            reason = ad.get('reason', 'unknown')
            if reason not in ignored_summary:
                ignored_summary[reason] = {
                    'count': 0,
                    'ad_types': set(),
                    'examples': []
                }
            
            ignored_summary[reason]['count'] += 1
            ignored_summary[reason]['ad_types'].add(ad.get('ad_type', 'unknown'))
            
            if len(ignored_summary[reason]['examples']) < 3:  # Keep up to 3 examples
                element_info = ad.get('element_info', {})
                ignored_summary[reason]['examples'].append({
                    'ad_name': self._extract_ad_name(element_info),
                    'ad_text': element_info.get('text_content', '')[:30]
                })
        
        # Convert sets to lists for JSON serialization
        for reason_data in ignored_summary.values():
            reason_data['ad_types'] = list(reason_data['ad_types'])
            
        return ignored_summary
    
    def _get_ad_type_breakdown(self) -> dict:
        """Get breakdown of ads by type"""
        breakdown = {}
        
        # Count detected ads by type
        for ad in self.interactions['detected_ads']:
            ad_type = ad.get('ad_type', 'unknown')
            if ad_type not in breakdown:
                breakdown[ad_type] = {
                    'detected': 0,
                    'clicked': 0,
                    'ignored': 0,
                    'failed': 0
                }
            breakdown[ad_type]['detected'] += 1
        
        # Count clicked ads by type
        for ad in self.interactions['clicked_ads']:
            ad_type = ad.get('ad_type', 'unknown')
            if ad_type in breakdown:
                breakdown[ad_type]['clicked'] += 1
        
        # Count ignored ads by type
        for ad in self.interactions['ignored_ads']:
            ad_type = ad.get('ad_type', 'unknown')
            if ad_type in breakdown:
                breakdown[ad_type]['ignored'] += 1
        
        # Count failed ads by type
        for ad in self.interactions['failed_interactions']:
            ad_type = ad.get('ad_type', 'unknown')
            if ad_type in breakdown:
                breakdown[ad_type]['failed'] += 1
        
        return breakdown
    
    def _extract_ad_name(self, element_info: dict) -> str:
        """Extract a meaningful name for the ad"""
        # Try to get ad name from various sources
        ad_name = "Unknown Ad"
        
        # Check text content first
        text_content = element_info.get('text_content', '').strip()
        if text_content and len(text_content) > 3:
            ad_name = text_content[:50]  # First 50 characters
        
        # Check class name for brand/company names
        elif element_info.get('class_name'):
            class_name = element_info.get('class_name', '')
            # Extract meaningful parts from class names
            class_parts = class_name.replace('-', ' ').replace('_', ' ').split()
            meaningful_parts = [part for part in class_parts if len(part) > 3 and not part.isdigit()]
            if meaningful_parts:
                ad_name = ' '.join(meaningful_parts[:3]).title()
        
        # Check ID
        elif element_info.get('id'):
            ad_id = element_info.get('id', '')
            ad_name = ad_id.replace('-', ' ').replace('_', ' ').title()
        
        # Check href for link ads
        elif element_info.get('href'):
            href = element_info.get('href', '')
            try:
                from urllib.parse import urlparse
                parsed = urlparse(href)
                if parsed.netloc:
                    ad_name = f"Link to {parsed.netloc}"
            except:
                pass
        
        # Fallback to ad type and position
        if ad_name == "Unknown Ad":
            ad_type = element_info.get('ad_type', 'unknown')
            position = element_info.get('position', {})
            if position:
                ad_name = f"{ad_type.title()} Ad at ({int(position.get('x', 0))}, {int(position.get('y', 0))})"
            else:
                ad_name = f"{ad_type.title()} Ad"
        
        return ad_name
    
    def _find_selector_from_element_info(self, element_info: dict) -> str:
        """Find the selector that was likely used to find this element"""
        # This is a best guess based on element info
        if element_info.get('id'):
            return f"#{element_info['id']}"
        elif element_info.get('class_name'):
            classes = element_info['class_name'].split()
            if classes:
                return f".{classes[0]}"
        elif element_info.get('tag_name'):
            return element_info['tag_name'].lower()
        else:
            return "unknown selector"
        
    def _generate_recommendations(self) -> list:
        """Generate recommendations based on interaction data"""
        recommendations = []
        
        if self.stats['click_success_rate'] < 50:
            recommendations.append("Low click success rate - consider updating selectors")
            
        if len(self.interactions['ignored_ads']) > self.stats['total_ads_clicked']:
            recommendations.append("Many ads ignored - review ignore criteria")
            
        if 'iframe' in self.stats['ad_types_found'] and len(self.interactions['iframe_interactions']) == 0:
            recommendations.append("Iframe ads detected but not interacted with")
            
        return recommendations

class SmartDOMObserver:
    """Enhanced DOM analysis with caching and error handling"""
    
    def __init__(self, page: Page, session_id):
        self.page = page
        self.session_id = session_id
        self.overlay_handler = EnhancedOverlayHandler(page, session_id)
        self.cache = {}
        self.cache_timeout = 30
        
    async def analyze_page(self) -> Dict:
        """Comprehensive page analysis with fallbacks"""
        try:
            # Handle overlays first
            await self.overlay_handler.handle_all_overlays()
            
            # Wait for page stability
            await self._wait_for_stability()
            
            # Parallel analysis for better performance
            tasks = [
                self._analyze_links(),
                self._analyze_buttons(),
                self._analyze_inputs(),
                self._analyze_forms(),
                self._analyze_media(),
                self._analyze_navigation()
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            analysis = {
                "links": results[0] if not isinstance(results[0], Exception) else [],
                "buttons": results[1] if not isinstance(results[1], Exception) else [],
                "inputs": results[2] if not isinstance(results[2], Exception) else [],
                "forms": results[3] if not isinstance(results[3], Exception) else [],
                "media": results[4] if not isinstance(results[4], Exception) else [],
                "navigation": results[5] if not isinstance(results[5], Exception) else [],
                "timestamp": time.time(),
                "url": self.page.url
            }
            
            log_to_node(self.session_id, 'info', f"Page analysis complete: {len(analysis['links'])} links, "
                       f"{len(analysis['buttons'])} buttons, {len(analysis['inputs'])} inputs")
            
            return analysis
            
        except Exception as e:
            log_to_node(self.session_id, 'error', f"Page analysis failed: {e}")
            return self._get_fallback_analysis()
    
    async def _wait_for_stability(self):
        """Wait for page to stabilize"""
        try:
            await self.page.wait_for_load_state('domcontentloaded', timeout=10000)
            await self.page.wait_for_load_state('networkidle', timeout=5000)
        except:
            # Fallback: just wait a bit
            await asyncio.sleep(2)
    
    async def _analyze_links(self) -> List[str]:
        """Analyze all links on the page"""
        try:
            return await self.page.eval_on_selector_all(
                "a[href]:not([href^='javascript:']):not([href^='#'])",
                "els => els.map(el => ({ href: el.href, text: el.innerText.trim().substring(0, 50) }))"
            )
        except:
            return []
    
    async def _analyze_buttons(self) -> List[Dict]:
        """Analyze interactive buttons"""
        try:
            return await self.page.eval_on_selector_all(
                "button:not([disabled]), input[type=submit]:not([disabled]), input[type=button]:not([disabled])",
                """els => els.map(el => ({ 
                    text: el.innerText || el.value || '', 
                    tag: el.tagName,
                    type: el.type || '',
                    visible: el.offsetParent !== null
                }))"""
            )
        except:
            return []
    
    async def _analyze_inputs(self) -> List[Dict]:
        """Analyze form inputs"""
        try:
            return await self.page.eval_on_selector_all(
                "input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
                """els => els.map(el => ({ 
                    name: el.name || '', 
                    type: el.type || '', 
                    placeholder: el.placeholder || '',
                    required: el.required || false,
                    visible: el.offsetParent !== null
                }))"""
            )
        except:
            return []
    
    async def _analyze_forms(self) -> List[Dict]:
        """Analyze forms"""
        try:
            return await self.page.eval_on_selector_all(
                "form",
                "els => els.map(el => ({ action: el.action, method: el.method, id: el.id }))"
            )
        except:
            return []
            
    async def _analyze_media(self) -> List[Dict]:
        """Analyze media elements"""
        try:
            return await self.page.eval_on_selector_all(
                "img, video, audio",
                "els => els.map(el => ({ tag: el.tagName, src: el.src, alt: el.alt || '' }))"
            )
        except:
            return []
            
    async def _analyze_navigation(self) -> List[Dict]:
        """Analyze navigation elements"""
        try:
            return await self.page.eval_on_selector_all(
                "nav a, [role='navigation'] a, .nav a, .menu a",
                "els => els.map(el => ({ href: el.href, text: el.innerText.trim() }))"
            )
        except:
            return []
    
    def _get_fallback_analysis(self) -> Dict:
        """Fallback analysis when main analysis fails"""
        return {
            "links": [],
            "buttons": [],
            "inputs": [],
            "forms": [],
            "media": [],
            "navigation": [],
            "timestamp": time.time(),
            "url": self.page.url,
            "fallback": True
        }

class ComprehensiveAdHandler:
    def __init__(self, page: Page, reporter: AdInteractionReporter, session_id):
        self.page = page
        self.session_id = session_id
        self.reporter = reporter
        self.clicked_ad_hashes = set()
        self.ad_click_count = 0
        self.ads_opened = 0  # Add this line to track opened ads
        self.session_start_time = time.time()
        self.session_duration = 0 
        # Will be set when session starts
        
        # Enhanced interaction delays
        self.interaction_delays = {
            'iframe': (1.0, 3.0),
            'display': (0.5, 2.0),
            'video': (2.0, 4.0),
            'popup': (0.3, 1.0),
            'native': (1.0, 2.5),
            'social': (0.8, 2.2)
        }        
    async def detect_and_interact_with_all_ads(self) -> dict:
        """Comprehensive ad detection and interaction"""
        log_to_node(self.session_id, 'info', "Starting comprehensive ad detection and interaction...")
        
        # Wait for page to stabilize
        try:
            await self.page.wait_for_load_state('domcontentloaded', timeout=10000)
            await asyncio.sleep(2)  # Additional stability wait
        except:
            pass
            
        # Detect all ad types
        ad_detection_tasks = [
            self._detect_iframe_ads(),
            self._detect_display_ads(),
            self._detect_video_ads(),
            self._detect_popup_ads(),
            self._detect_native_ads(),
            self._detect_social_ads()
        ]
        
        results = await asyncio.gather(*ad_detection_tasks, return_exceptions=True)
        
        # Process detected ads
        all_detected_ads = []
        for i, result in enumerate(results):
            if not isinstance(result, Exception) and result:
                all_detected_ads.extend(result)
                
        log_to_node(self.session_id, 'info', f"Total ads detected: {len(all_detected_ads)}")
        
        # Interact with detected ads
        interaction_results = []
        for ad_info in all_detected_ads:
            try:
                result = await self._interact_with_ad(ad_info)
                interaction_results.append(result)
                
                # Random delay between interactions
                delay = random.uniform(1.0, 3.0)
                await asyncio.sleep(delay)
                
            except Exception as e:
                log_to_node(self.session_id, 'error', f"Failed to interact with ad: {e}")
                self.reporter.log_ad_click(
                    ad_info.get('type', 'unknown'),
                    ad_info,
                    False,
                    self.page.url,
                    f"Interaction error: {str(e)}"
                )
                
        return {
            'total_detected': len(all_detected_ads),
            'total_interacted': len([r for r in interaction_results if r.get('success', False)]),
            'detection_results': all_detected_ads,
            'interaction_results': interaction_results
        }
    
    async def _detect_iframe_ads(self) -> list:
        """Detect iframe-based advertisements"""
        detected_ads = []
        
        for selector in AD_IFRAME_SELECTORS:
            try:
                elements = await self.page.query_selector_all(selector)
                for i, element in enumerate(elements):
                    if await element.is_visible():
                        element_info = await self._get_element_info(element, 'iframe')
                        ad_info = {
                            'type': 'iframe',
                            'selector': selector,
                            'index': i,
                            'element': element,
                            'info': element_info
                        }
                        detected_ads.append(ad_info)
                        self.reporter.log_ad_detection('iframe', selector, element_info, self.page.url)
                        
            except Exception as e:
                log_to_node(self.session_id, 'debug', f"Error detecting iframe ads with selector {selector}: {e}")
                
        return detected_ads
    
    async def _detect_display_ads(self) -> list:
        """Detect display advertisements"""
        detected_ads = []
        
        for selector in DISPLAY_AD_SELECTORS:
            try:
                elements = await self.page.query_selector_all(selector)
                for i, element in enumerate(elements):
                    if await element.is_visible() and await self._is_likely_ad(element):
                        element_info = await self._get_element_info(element, 'display')
                        ad_info = {
                            'type': 'display',
                            'selector': selector,
                            'index': i,
                            'element': element,
                            'info': element_info
                        }
                        detected_ads.append(ad_info)
                        self.reporter.log_ad_detection('display', selector, element_info, self.page.url)
                        
            except Exception as e:
                log_to_node(self.session_id, 'debug', f"Error detecting display ads with selector {selector}: {e}")
                
        return detected_ads
    
    async def _detect_video_ads(self) -> list:
        """Detect video advertisements"""
        detected_ads = []
        
        for selector in VIDEO_AD_SELECTORS:
            try:
                elements = await self.page.query_selector_all(selector)
                for i, element in enumerate(elements):
                    if await element.is_visible():
                        element_info = await self._get_element_info(element, 'video')
                        ad_info = {
                            'type': 'video',
                            'selector': selector,
                            'index': i,
                            'element': element,
                            'info': element_info
                        }
                        detected_ads.append(ad_info)
                        self.reporter.log_ad_detection('video', selector, element_info, self.page.url)
                        
            except Exception as e:
                log_to_node(self.session_id, 'debug', f"Error detecting video ads with selector {selector}: {e}")
                
        return detected_ads
    
    async def _detect_popup_ads(self) -> list:
        """Detect popup advertisements"""
        detected_ads = []
        
        for selector in POPUP_AD_SELECTORS:
            try:
                elements = await self.page.query_selector_all(selector)
                for i, element in enumerate(elements):
                    if await element.is_visible():
                        element_info = await self._get_element_info(element, 'popup')
                        ad_info = {
                            'type': 'popup',
                            'selector': selector,
                            'index': i,
                            'element': element,
                            'info': element_info
                        }
                        detected_ads.append(ad_info)
                        self.reporter.log_ad_detection('popup', selector, element_info, self.page.url)
                        
            except Exception as e:
                log_to_node(self.session_id, 'debug', f"Error detecting popup ads with selector {selector}: {e}")
                
        return detected_ads
    
    async def _detect_native_ads(self) -> list:
        """Detect native advertisements"""
        detected_ads = []
        
        for selector in NATIVE_AD_SELECTORS:
            try:
                elements = await self.page.query_selector_all(selector)
                for i, element in enumerate(elements):
                    if await element.is_visible() and await self._is_likely_ad(element):
                        element_info = await self._get_element_info(element, 'native')
                        ad_info = {
                            'type': 'native',
                            'selector': selector,
                            'index': i,
                            'element': element,
                            'info': element_info
                        }
                        detected_ads.append(ad_info)
                        self.reporter.log_ad_detection('native', selector, element_info, self.page.url)
                        
            except Exception as e:
                log_to_node(self.session_id, 'debug', f"Error detecting native ads with selector {selector}: {e}")
                
        return detected_ads
    
    async def _detect_social_ads(self) -> list:
        """Detect social media advertisements"""
        detected_ads = []
        
        for selector in SOCIAL_AD_SELECTORS:
            try:
                elements = await self.page.query_selector_all(selector)
                for i, element in enumerate(elements):
                    if await element.is_visible():
                        element_info = await self._get_element_info(element, 'social')
                        ad_info = {
                            'type': 'social',
                            'selector': selector,
                            'index': i,
                            'element': element,
                            'info': element_info
                        }
                        detected_ads.append(ad_info)
                        self.reporter.log_ad_detection('social', selector, element_info, self.page.url)
                        
            except Exception as e:
                log_to_node(self.session_id, 'debug', f"Error detecting social ads with selector {selector}: {e}")
                
        return detected_ads
    
    async def _is_likely_ad(self, element) -> bool:
        """Check if element is likely an advertisement"""
        try:
            # Check element text content
            text_content = await element.inner_text()
            ad_keywords = ['ad', 'advertisement', 'sponsored', 'promo', 'offer', 'deal', 'buy now', 'shop', 'click here']
            
            if any(keyword in text_content.lower() for keyword in ad_keywords):
                return True
                
            # Check element attributes
            outer_html = await element.get_attribute('outerHTML')
            if outer_html and any(keyword in outer_html.lower() for keyword in ad_keywords):
                return True
                
            # Check element dimensions (ads are often specific sizes)
            bounding_box = await element.bounding_box()
            if bounding_box:
                width, height = bounding_box['width'], bounding_box['height']
                # Common ad sizes
                common_ad_sizes = [(728, 90), (300, 250), (336, 280), (320, 50), (970, 250)]
                for ad_width, ad_height in common_ad_sizes:
                    if abs(width - ad_width) < 10 and abs(height - ad_height) < 10:
                        return True
                        
            return False
            
        except:
            return False
    
    async def _get_element_info(self, element, ad_type: str) -> dict:
        """Extract comprehensive element information"""
        try:
            info = {
                'ad_type': ad_type,
                'visible': await element.is_visible(),
                'enabled': await element.is_enabled(),
                'tag_name': await element.evaluate('el => el.tagName'),
                'class_name': await element.get_attribute('class') or '',
                'id': await element.get_attribute('id') or '',
                'text_content': (await element.inner_text())[:100],  # Truncate
                'href': await element.get_attribute('href') or '',
            }
            
            # Get bounding box
            bounding_box = await element.bounding_box()
            if bounding_box:
                info['position'] = {
                    'x': bounding_box['x'],
                    'y': bounding_box['y'],
                    'width': bounding_box['width'],
                    'height': bounding_box['height']
                }
            
            return info
            
        except Exception as e:
            return {'error': str(e), 'ad_type': ad_type}
    
    async def _interact_with_ad(self, ad_info: dict) -> dict:
        """Interact with a detected advertisement"""
        ad_type = ad_info.get('type', 'unknown')
        element = ad_info.get('element')
        
        if not element:
            self.reporter.log_ignored_ad(ad_type, ad_info.get('info', {}), "No element available", self.page.url)
            return {'success': False, 'reason': 'No element available'}
        
        # Check if we've reached the ad limit
        if self.ads_opened >= 2:
            self.reporter.log_ignored_ad(ad_type, ad_info.get('info', {}), "Ad limit reached", self.page.url)
            return {'success': False, 'reason': 'Ad limit reached'}
        
            
        try:
        # Check if element is still valid and visible
            if not await element.is_visible():
                self.reporter.log_ignored_ad(ad_type, ad_info.get('info', {}), "Element not visible", self.page.url)
                return {'success': False, 'reason': 'Element not visible'}
            
            # Get interaction delay for this ad type
            min_delay, max_delay = self.interaction_delays.get(ad_type, (1.0, 2.0))
            
            # Scroll element into view
            await element.scroll_into_view_if_needed()
            await asyncio.sleep(random.uniform(0.3, 0.8))
            
            # Handle different ad types differently
            if ad_type == 'iframe':
                success = await self._interact_with_iframe_ad(element, ad_info)
            elif ad_type == 'popup':
                success = await self._interact_with_popup_ad(element, ad_info)
            elif ad_type == 'video':
                success = await self._interact_with_video_ad(element, ad_info)
            else:
                # Standard click interaction
                success = await self._perform_click_interaction(element, ad_info)
            
            # Post-interaction delay
            await asyncio.sleep(random.uniform(min_delay, max_delay))
            
            self.reporter.log_ad_click(ad_type, ad_info.get('info', {}), success, self.page.url,
                                     "Successful interaction" if success else "Click failed")
            
            self.ad_click_count += 1
            ad_hash = self._generate_ad_hash(ad_info.get('info', {}))
            self.clicked_ad_hashes.add(ad_hash)
            
            if success:
                self.ads_opened += 1  # Increment the counter only on successful ad opening
                self.ad_click_count += 1
                ad_hash = self._generate_ad_hash(ad_info.get('info', {}))
                self.clicked_ad_hashes.add(ad_hash)
                
            return {'success': True, 'ad_type': ad_type}
        
        except Exception as e:
            error_msg = f"Interaction error: {str(e)}"
            self.reporter.log_ad_click(ad_type, ad_info.get('info', {}), False, self.page.url, error_msg)
            return {'success': False, 'reason': error_msg}
                
     
    
    async def _perform_click_interaction(self, element, ad_info: dict) -> bool:
        """Perform standard click interaction"""
        try:
            # Try different click methods
            await element.click(timeout=3000)
            log_to_node(self.session_id, 'info', f"Successfully clicked {ad_info.get('type', 'unknown')} ad")
            return True
            
        except Exception as e:
            log_to_node(self.session_id, 'debug', f"Standard click failed: {e}")
            try:
                # Try force click
                await element.click(force=True, timeout=2000)
                log_to_node(self.session_id, 'info', f"Successfully force-clicked {ad_info.get('type', 'unknown')} ad")
                return True
            except:
                log_to_node(self.session_id, 'debug', f"Force click also failed for {ad_info.get('type', 'unknown')} ad")
                return False
    
    async def _interact_with_iframe_ad(self, element, ad_info: dict) -> bool:
        """Special handling for iframe ads"""
        try:
            # Try to click on the iframe
            await element.click(timeout=3000)
            
            # Wait and check if new tab/window opened
            await asyncio.sleep(1)
            
            # Log iframe interaction
            self.reporter.interactions['iframe_interactions'].append({
                'timestamp': datetime.now().isoformat(),
                'ad_info': ad_info.get('info', {}),
                'url': self.page.url
            })
            
            log_to_node(self.session_id, 'info', "Successfully interacted with iframe ad")
            return True
            
        except Exception as e:
            log_to_node(self.session_id, 'debug', f"Iframe ad interaction failed: {e}")
            return False
    
    async def _interact_with_popup_ad(self, element, ad_info: dict) -> bool:
        """Special handling for popup ads"""
        try:
            # For popups, we might want to close them instead of clicking
            # Look for close buttons first
            close_selectors = ['[aria-label*="close"]', '.close', '[title*="close"]', 'button[type="button"]']
            
            for selector in close_selectors:
                try:
                    close_btn = await element.query_selector(selector)
                    if close_btn and await close_btn.is_visible():
                        await close_btn.click(timeout=2000)
                        self.reporter.log_popup_closure(ad_info.get('info', {}), self.page.url)
                        log_to_node(self.session_id, 'info', "Closed popup ad")
                        return True
                except:
                    continue
            
            # If no close button found, try clicking the popup itself
            await element.click(timeout=2000)
            log_to_node(self.session_id, 'info', "Clicked popup ad")
            return True
            
        except Exception as e:
            log_to_node(self.session_id, 'debug', f"Popup ad interaction failed: {e}")
            return False
    
    async def _interact_with_video_ad(self, element, ad_info: dict) -> bool:
        """Special handling for video ads"""
        try:
            # Log video ad interaction
            self.reporter.interactions['video_ad_interactions'].append({
                'timestamp': datetime.now().isoformat(),
                'ad_info': ad_info.get('info', {}),
                'url': self.page.url
            })
            
            # Click on the video ad
            await element.click(timeout=3000)
            log_to_node(self.session_id, 'info', "Successfully interacted with video ad")
            return True
            
        except Exception as e:
            log_to_node(self.session_id, 'debug', f"Video ad interaction failed: {e}")
            return False

class IntelligentActionPlanner:
    """AI-powered action planning with context awareness"""
    
    def __init__(self, session_id=None):
        self.action_history = []
        self.successful_actions = {}
        self.failed_actions = {}
        self.session_id = session_id or 'action-planner'
        
    def decide_action(self, dom_info: Dict, page_context: Dict = None) -> Dict:
        """Decide next action based on page content and history"""
        try:
            # Weight actions based on success history
            action_weights = self._calculate_action_weights(dom_info)
            
            # Choose action based on weighted probability
            action_type = self._weighted_choice(action_weights)
            
            # Generate specific action
            action = self._generate_action(action_type, dom_info, page_context)
            
            # Record action for learning
            self.action_history.append({
                "type": action_type,
                "timestamp": time.time(),
                "dom_summary": self._summarize_dom(dom_info)
            })
            
            return action
            
        except Exception as e:
            log_to_node(self.session_id, 'error', f"Action planning failed: {e}")
            return {"type": "idle", "duration": random.uniform(1, 3)}
    
    def _calculate_action_weights(self, dom_info: Dict) -> Dict[str, float]:
        """Calculate weights for different actions"""
        weights = {
            "click_button": 0.3 if dom_info.get("buttons") else 0.0,
            "click_link": 0.2 if dom_info.get("links") else 0.0,
            "fill_form": 0.25 if dom_info.get("inputs") else 0.0,
            "scroll": 0.6,  # Increased weight for more frequent discrete scrolling
            "hover": 0.15,
            "navigate_back": 0.1,
            "idle": 0.2,
            "click_random": 0.3
        }
        
        # Adjust based on success history
        for action_type, base_weight in weights.items():
            success_rate = self.successful_actions.get(action_type, 0)
            failure_rate = self.failed_actions.get(action_type, 0)
            
            if success_rate + failure_rate > 0:
                success_ratio = success_rate / (success_rate + failure_rate)
                weights[action_type] = base_weight * (0.5 + success_ratio)
        
        return weights
    
    def _weighted_choice(self, weights: Dict[str, float]) -> str:
        """Choose action based on weights"""
        total_weight = sum(weights.values())
        if total_weight == 0:
            return "idle"
            
        r = random.uniform(0, total_weight)
        current_weight = 0
        
        for action, weight in weights.items():
            current_weight += weight
            if r <= current_weight:
                return action
                
        return "idle"
    
    def _generate_action(self, action_type: str, dom_info: Dict, page_context: Dict = None) -> Dict:
        """Generate specific action configuration"""
        
        if action_type == "click_button" and dom_info.get("buttons"):
            visible_buttons = [b for b in dom_info["buttons"] if b.get("visible", True)]
            if visible_buttons:
                return {
                    "type": "click_button",
                    "target": random.choice(visible_buttons),
                    "wait_after": random.uniform(1, 3)
                }
        
        elif action_type == "click_link" and dom_info.get("links"):
            return {
                "type": "click_link",
                "target": random.choice(dom_info["links"]),
                "new_tab": random.choice([True, False]),
                "wait_after": random.uniform(2, 4)
            }
        
        elif action_type == "fill_form" and dom_info.get("inputs"):
            visible_inputs = [i for i in dom_info["inputs"] if i.get("visible", True)]
            if visible_inputs:
                return {
                    "type": "fill_form",
                    "targets": visible_inputs[:3],  # Limit to first 3 inputs
                    "data": self._generate_form_data(visible_inputs),
                    "submit": random.choice([True, False])
                }
        
        elif action_type == "scroll":
            # More realistic scroll behavior with varied patterns
            scroll_patterns = [
                {
                    "direction": "down",
                    "distance": random.randint(150, 400),
                    "smooth": True,
                    "pause_probability": 0.2
                },
                {
                    "direction": "down", 
                    "distance": random.randint(400, 800),
                    "smooth": True,
                    "pause_probability": 0.4
                },
                {
                    "direction": "up",
                    "distance": random.randint(100, 300),
                    "smooth": True,
                    "pause_probability": 0.3
                },
                {
                    "direction": random.choice(["up", "down"]),
                    "distance": random.randint(200, 600),
                    "smooth": False,  # Quick scroll
                    "pause_probability": 0.1
                }
            ]
            
            # Weight scroll patterns - favor downward scrolling
            pattern_weights = [0.4, 0.3, 0.2, 0.1]
            chosen_pattern = random.choices(scroll_patterns, weights=pattern_weights)[0]
            
            return {
                "type": "scroll",
                **chosen_pattern
            }
        
        elif action_type == "hover":
            if dom_info.get("links") or dom_info.get("buttons"):
                targets = (dom_info.get("links", []) + dom_info.get("buttons", []))
                return {
                    "type": "hover",
                    "target": random.choice(targets),
                    "duration": random.uniform(0.5, 2.0)
                }
        
        elif action_type == "navigate_back":
            return {
                "type": "navigate_back",
                "wait_after": random.uniform(1, 2)
            }
        
        elif action_type == "click_random":
            return {
                "type": "click_random",
                "count": random.randint(1, 3),
                "delay_between": random.uniform(0.5, 2.0)
            }
        
        # Default to idle
        return {
            "type": "idle",
            "duration": random.uniform(1, 4)
        }
    
    def _generate_form_data(self, inputs: List[Dict]) -> Dict[str, str]:
        """Generate realistic form data"""
        data = {}
        fake_data = {
            "text": ["John Doe", "Test User", "Sample Text", "Hello World"],
            "email": ["test@example.com", "user@test.com", "sample@domain.com"],
            "password": ["TestPass123", "SecurePass456", "MyPassword789"],
            "search": ["test query", "sample search", "example term"],
            "tel": ["+1234567890", "555-0123", "123-456-7890"],
            "url": ["https://example.com", "https://test.com", "https://sample.org"]
        }
        
        for input_field in inputs:
            field_type = input_field.get("type", "text").lower()
            field_name = input_field.get("name", "")
            
            if field_type in fake_data:
                data[field_name] = random.choice(fake_data[field_type])
            else:
                data[field_name] = random.choice(fake_data["text"])
                
        return data
    
    def _summarize_dom(self, dom_info: Dict) -> Dict:
        """Create summary of DOM for history tracking"""
        return {
            "link_count": len(dom_info.get("links", [])),
            "button_count": len(dom_info.get("buttons", [])),
            "input_count": len(dom_info.get("inputs", [])),
            "form_count": len(dom_info.get("forms", []))
        }
    
    def record_action_result(self, action_type: str, success: bool):
        """Record action success/failure for learning"""
        if success:
            self.successful_actions[action_type] = self.successful_actions.get(action_type, 0) + 1
        else:
            self.failed_actions[action_type] = self.failed_actions.get(action_type, 0) + 1

class RobustActionExecutor:
    def __init__(self, page, session_id):
        self.page = page  # ✅ store the Playwright page instance
        self.session_id = session_id
        self.overlay_handler = EnhancedOverlayHandler(page, session_id)

    async def _handle_scroll(self, action: Dict) -> Tuple[bool, str]:
        """Enhanced human-like scrolling with variable patterns"""
        try:
            direction = action.get("direction", "down")
            distance = action.get("distance", random.randint(300, 800))
            
            if Config.SCROLL_BEHAVIOR == "natural":
                # Natural scrolling with variable speed and occasional corrections
                scroll_steps = random.randint(5, 15)
                base_step = distance / scroll_steps
                current_pos = await self.page.evaluate("window.scrollY")
                target_pos = current_pos + (distance if direction == "down" else -distance)
                
                for i in range(scroll_steps):
                    # Vary step size
                    variance = random.uniform(0.7, 1.3)
                    step = base_step * variance
                    
                    # Occasionally reverse direction slightly
                    if random.random() < 0.1:
                        step *= -0.5
                    
                    await self.page.evaluate(f"window.scrollBy(0, {step})")
                    
                    # Random pauses
                    if random.random() < 0.3:
                        pause_time = random.uniform(0.1, 0.8)
                        await asyncio.sleep(pause_time)
                    else:
                        await asyncio.sleep(random.uniform(0.05, 0.2))
                        
                # Final adjustment to ensure we reach target
                await self.page.evaluate(f"window.scrollTo(0, {target_pos})")
            else:
                scroll_y = distance if direction == "down" else -distance
                await self.page.evaluate(f"window.scrollBy(0, {scroll_y})")
            
            return True, f"Scrolled {direction} by {distance}px"
        
        except Exception as e:
            return False, f"Scroll failed: {e}"

    async def _handle_click_button(self, action: Dict) -> Tuple[bool, str]:
        """Handle button clicking"""
        try:
            target = action.get("target", {})
            button_text = target.get("text", "")
            
            # Try multiple selectors
            selectors = [
                f"button:has-text('{button_text}')",
                "button[type='submit']",
                "input[type='submit']",
                "button",
                "input[type='button']"
            ]
            
            for selector in selectors:
                try:
                    element = await self.page.query_selector(selector)
                    if element and await element.is_visible():
                        await element.scroll_into_view_if_needed()
                        await element.click(timeout=5000)
                        return True, f"Clicked button: {selector}"
                except:
                    continue
                    
            return False, "No clickable button found"
            
        except Exception as e:
            return False, f"Button click failed: {e}"
    
    async def _handle_click_link(self, action: Dict) -> Tuple[bool, str]:
        """Handle link clicking"""
        try:
            target = action.get("target", {})
            href = target.get("href", "")
            
            if href:
                # Validate URL
                parsed = urlparse(href)
                if not parsed.scheme:
                    return False, "Invalid URL"
                
                link_element = await self.page.query_selector(f"a[href='{href}']")
                if link_element:
                    await link_element.scroll_into_view_if_needed()
                    
                    if action.get("new_tab", False):
                        # Open in new tab
                        async with self.page.context.expect_page() as new_page_info:
                            await link_element.click(modifiers=["Control"])
                        new_page = await new_page_info.value
                        await new_page.close()  # Close new tab for this demo
                    else:
                        await link_element.click(timeout=5000)
                    
                    return True, f"Clicked link: {href}"
            
            return False, "No valid link found"
            
        except Exception as e:
            return False, f"Link click failed: {e}"
    
    async def _handle_fill_form(self, action: Dict) -> Tuple[bool, str]:
        """Handle form filling"""
        try:
            targets = action.get("targets", [])
            form_data = action.get("data", {})
            filled_count = 0
            
            for target in targets:
                field_name = target.get("name", "")
                field_type = target.get("type", "text")
                
                if field_name in form_data:
                    try:
                        selector = f"input[name='{field_name}'], textarea[name='{field_name}'], select[name='{field_name}']"
                        element = await self.page.query_selector(selector)
                        
                        if element:
                            await element.scroll_into_view_if_needed()
                            await element.clear()
                            await element.fill(form_data[field_name])
                            filled_count += 1
                            await asyncio.sleep(random.uniform(0.2, 0.8))
                            
                    except Exception as e:
                        log_to_node(self.session_id, 'debug', f"Failed to fill field {field_name}: {e}")
                        continue
            
            # Optionally submit form
            if action.get("submit", False) and filled_count > 0:
                try:
                    submit_btn = await self.page.query_selector("input[type='submit'], button[type='submit']")
                    if submit_btn:
                        await submit_btn.click()
                        return True, f"Filled {filled_count} fields and submitted form"
                except:
                    pass
            
            return filled_count > 0, f"Filled {filled_count} form fields"
            
        except Exception as e:
            return False, f"Form filling failed: {e}"
    
    async def _handle_scroll(self, action: Dict) -> Tuple[bool, str]:
        """Handle scrolling with smooth animation"""
        try:
            direction = action.get("direction", "down")
            distance = action.get("distance", 300)
            smooth = action.get("smooth", True)
            pause_probability = action.get("pause_probability", 0.0)
            
            if smooth:
                # Smooth scrolling in steps
                steps = random.randint(5, 12)
                step_size = distance / steps
                
                for i in range(steps):
                    scroll_y = step_size if direction == "down" else -step_size
                    await self.page.evaluate(f"window.scrollBy(0, {scroll_y})")
                    
                    # Random pause during scrolling
                    if random.random() < pause_probability:
                        await asyncio.sleep(random.uniform(0.5, 1.5))
                    else:
                        await asyncio.sleep(random.uniform(0.05, 0.2))
            else:
                scroll_y = distance if direction == "down" else -distance
                await self.page.evaluate(f"window.scrollBy(0, {scroll_y})")
            
            return True, f"Scrolled {direction} by {distance}px"
            
        except Exception as e:
            return False, f"Scroll failed: {e}"
    
    async def _handle_hover(self, action: Dict) -> Tuple[bool, str]:
        """Handle hovering over elements"""
        try:
            target = action.get("target", {})
            duration = action.get("duration", 1.0)
            
            # Find element to hover
            if "href" in target:
                element = await self.page.query_selector(f"a[href='{target['href']}']")
            elif "text" in target:
                element = await self.page.query_selector(f"button:has-text('{target['text']}')")
            else:
                elements = await self.page.query_selector_all("a, button")
                element = random.choice(elements) if elements else None
            
            if element:
                await element.scroll_into_view_if_needed()
                await element.hover()
                await asyncio.sleep(duration)
                return True, "Hovered over element"
            
            return False, "No element to hover"
            
        except Exception as e:
            return False, f"Hover failed: {e}"
    
    async def _handle_navigate_back(self, action: Dict) -> Tuple[bool, str]:
        """Handle browser back navigation"""
        try:
            await self.page.go_back(timeout=10000)
            return True, "Navigated back"
        except Exception as e:
            return False, f"Back navigation failed: {e}"
    
    async def _handle_click_random(self, action: Dict) -> Tuple[bool, str]:
        """Handle random element clicking"""
        try:
            count = action.get("count", 1)
            delay_between = action.get("delay_between", 1.0)
            clicked_count = 0
            
            # Get all clickable elements
            clickable_selectors = [
                "a:not([href^='javascript:']):not([href^='#'])",
                "button:not([disabled])",
                "input[type='button']:not([disabled])",
                "input[type='submit']:not([disabled])",
                "[role='button']",
                "[onclick]"
            ]
            
            all_clickables = []
            for selector in clickable_selectors:
                try:
                    elements = await self.page.query_selector_all(selector)
                    all_clickables.extend(elements)
                except:
                    continue
            
            if not all_clickables:
                return False, "No clickable elements found"
            
            # Shuffle and click random elements
            random.shuffle(all_clickables)
            for element in all_clickables[:count]:
                try:
                    if await element.is_visible():
                        await element.scroll_into_view_if_needed()
                        await element.click(timeout=3000)
                        clicked_count += 1
                        
                        # Handle any overlays that might appear
                        await self.overlay_handler.handle_all_overlays()
                        
                        if clicked_count < count:
                            await asyncio.sleep(delay_between)
                except Exception as e:
                    log_to_node(self.session_id, 'debug', f"Failed to click random element: {e}")
                    continue
            
            return clicked_count > 0, f"Clicked {clicked_count} random elements"
            
        except Exception as e:
            return False, f"Random click failed: {e}"
    
    async def _handle_idle(self, action: Dict) -> Tuple[bool, str]:
        """Handle idle waiting"""
        try:
            duration = action.get("duration", random.uniform(1, 3))
            await asyncio.sleep(duration)
            return True, f"Idled for {duration:.2f} seconds"
        except Exception as e:
            return False, f"Idle failed: {e}"

    async def execute_action(self, action: Dict) -> Tuple[bool, str]:
        """Main entry point for executing actions"""
        try:
            action_type = action.get("type", "")
            
            log_to_node(self.session_id, 'debug', f"Executing action: {action_type}")
            
            # Map action types to handler methods
            action_handlers = {
                "scroll": self._handle_scroll,
                "click_button": self._handle_click_button,
                "click_link": self._handle_click_link,
                "fill_form": self._handle_fill_form,
                "hover": self._handle_hover,
                "navigate_back": self._handle_navigate_back,
                "click_random": self._handle_click_random,
                "random_click": self._handle_click_random,
                "idle": self._handle_idle
            }
            
            # Get the appropriate handler
            handler = action_handlers.get(action_type)
            if not handler:
                return False, f"Unknown action type: {action_type}"
            
            # Execute the action with retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    success, message = await handler(action)
                    if success:
                        log_to_node(self.session_id, 'info', f"Action {action_type} successful: {message}")
                        return True, message
                    else:
                        log_to_node(self.session_id, 'warn', f"Action {action_type} failed (attempt {attempt + 1}): {message}")
                        if attempt < max_retries - 1:
                            await asyncio.sleep(random.uniform(0.5, 1.5))
                except Exception as e:
                    log_to_node(self.session_id, 'error', f"Action {action_type} error (attempt {attempt + 1}): {e}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(random.uniform(1, 2))
            
            return False, f"Action {action_type} failed after {max_retries} attempts"
            
        except Exception as e:
            log_to_node(self.session_id, 'error', f"Critical error in execute_action: {e}")
            return False, f"Critical error: {e}"

# --- Begin the ONLY changed definition: BrowserManager ---
class BrowserManager:
    """Enhanced browser management with health monitoring and IPC config"""

    def __init__(self, proxy=None, cookies=None, browser_name="chromium", headless=True, session_id=None):
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.pages: List[Page] = []
        self.proxy = proxy
        self.cookies = cookies or []
        self.browser_name = browser_name
        self.headless = headless
        self.session_id = session_id or 'python-worker'

    async def initialize_browser(self) -> bool:
        """Initialize browser with optimal settings, now supports multi-browser & proxy"""
        try:
            playwright = await async_playwright().start()
            launch_args = [
                "--disable-blink-features=AutomationControlled",
                "--disable-extensions",
                "--disable-plugins-discovery",
                "--disable-web-security",
                "--disable-features=VizDisplayCompositor",
                "--no-first-run",
                "--no-service-autorun",
                "--password-store=basic",
                "--use-mock-keychain",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                "--disable-field-trial-config",
                "--disable-ipc-flooding-protection"
            ]
            if not self.headless:
                launch_args.extend([
                    "--disable-infobars",
                    "--disable-dev-shm-usage",
                    "--no-sandbox"
                ])

            # Force use of Playwright's built-in browsers (no custom executable paths)
            browser_type = playwright.chromium
            name = (self.browser_name or "chromium").lower()
            if name == "firefox":
                browser_type = playwright.firefox
            elif name == "webkit":
                browser_type = playwright.webkit
            elif name in ("chrome", "google-chrome", "chromium"):
                browser_type = playwright.chromium

            proxy_settings = None
            if self.proxy and isinstance(self.proxy, dict):
                if self.proxy.get('server'):
                    # Proxy is already in Playwright format
                    proxy_settings = {"server": self.proxy["server"]}
                    if self.proxy.get("username"):
                        proxy_settings["username"] = self.proxy["username"]
                    if self.proxy.get("password"):
                        proxy_settings["password"] = self.proxy["password"]
                    log_to_node(self.session_id, 'debug', f'Browser launching with proxy: {self.proxy["server"]}')
                elif self.proxy.get('host') and self.proxy.get('port'):
                    # Convert from host/port format to Playwright format
                    proxy_settings = {"server": f"http://{self.proxy['host']}:{self.proxy['port']}"}
                    if self.proxy.get("username"):
                        proxy_settings["username"] = self.proxy["username"]
                    if self.proxy.get("password"):
                        proxy_settings["password"] = self.proxy["password"]
                    log_to_node(self.session_id, 'debug', f'Browser launching with proxy: {proxy_settings["server"]}')
                elif self.proxy.get('proxyString'):
                    # Handle proxyString format
                    proxy_parts = self.proxy['proxyString'].split(':')
                    if len(proxy_parts) >= 2:
                        proxy_settings = {"server": f"http://{proxy_parts[0]}:{proxy_parts[1]}"}
                        if self.proxy.get("username"):
                            proxy_settings["username"] = self.proxy["username"]
                        if self.proxy.get("password"):
                            proxy_settings["password"] = self.proxy["password"]
                        log_to_node(self.session_id, 'debug', f'Browser launching with proxy: {proxy_settings["server"]}')
            
            if not proxy_settings:
                log_to_node(self.session_id, 'debug', 'Browser launching without proxy')

            browser_mode = 'headful' if not self.headless else 'headless'
            log_to_node(self.session_id, 'info', f'Launching {browser_mode} {name} browser with Playwright built-in')
            
            # Log resource loading configuration
            log_to_node(self.session_id, 'debug', f'Resource loading: CSS={Config.LOAD_CSS}, Fonts={Config.LOAD_FONTS}, Media={Config.LOAD_MEDIA}')

            # Launch browser WITHOUT executable_path to use Playwright's built-in browsers
            self.browser = await browser_type.launch(
                headless=self.headless,
                args=launch_args,
                proxy=proxy_settings,
                slow_mo=random.randint(50, 150) if not self.headless else 0
            )

            # Get device-specific configuration
            device_config = get_device_config(Config.DEVICE)
            
            # Context with device-specific user agent, viewport, etc.
            context_options = {
                "user_agent": device_config["user_agent"],
                "viewport": device_config["viewport"],
                "screen": device_config["screen"],
                "locale": "en-US",
                "timezone_id": "America/New_York",
                "geolocation": {"latitude": 40.7128, "longitude": -74.0060},
                "permissions": ["geolocation"],
                "ignore_https_errors": True,
                "java_script_enabled": True,
                "accept_downloads": False,
                "is_mobile": device_config["is_mobile"],
                "has_touch": device_config["has_touch"],
                "device_scale_factor": device_config["device_scale_factor"]
            }
            
            self.context = await self.browser.new_context(**context_options)
            
            log_to_node(self.session_id, 'debug', 
                       f'Device emulation: {Config.DEVICE} - {device_config["viewport"]["width"]}x{device_config["viewport"]["height"]}', 
                       Config.CAMPAIGN_ID, Config.USER_EMAIL)
            log_to_node(self.session_id, 'debug', 
                       f'User Agent: {device_config["user_agent"][:80]}...', 
                       Config.CAMPAIGN_ID, Config.USER_EMAIL)
            
            # Inject cookies if provided
            if self.cookies:
                try:
                    await self.context.add_cookies(self.cookies)
                    log_to_node(self.session_id, 'debug', f'[SUCCESS] Injected {len(self.cookies)} cookies')
                    
                    # Log cookie details for debugging
                    for i, cookie in enumerate(self.cookies):
                        log_to_node(self.session_id, 'debug', f'Cookie {i + 1}: {cookie.get("name")}={cookie.get("value")} (domain: {cookie.get("domain")}, path: {cookie.get("path", "/")})')
                except Exception as e:
                    log_to_node(self.session_id, 'error', f'[ERROR] Failed to inject cookies: {e}')
            
            log_to_node(self.session_id, 'info', 'Browser initialized successfully')
            log_to_node(self.session_id, 'info', f'Resource filtering applied: CSS loading {"enabled" if Config.LOAD_CSS else "disabled"}, Font loading {"enabled" if Config.LOAD_FONTS else "disabled"}, Media loading {"enabled" if Config.LOAD_MEDIA else "disabled"}')
            return True
        except Exception as e:
            log_to_node(self.session_id, 'error', f"Browser initialization failed: {e}")
            return False

    # [Your create_page, _add_evasion_scripts, _setup_monitoring, cleanup methods unchanged]
    
    async def create_page(self, url: str) -> Optional[Page]:
        """Create and configure a new page"""
        try:
            page = await self.context.new_page()
            
            # Add detection evasion scripts
            await self._add_evasion_scripts(page)
            
            # Set up request/response monitoring
            await self._setup_monitoring(page)
            
            # Navigate to URL with retries
            await RetryHandler.retry_with_backoff(
                lambda: page.goto(url, wait_until="domcontentloaded", timeout=30000)
            )
            
            self.pages.append(page)
            log_to_node(self.session_id, 'info', f"Page created successfully for: {url}")
            return page
            
        except Exception as e:
            log_to_node(self.session_id, 'error', f"Page creation failed for {url}: {e}")
            return None
    
    async def _add_evasion_scripts(self, page: Page):
        """Add scripts to evade detection"""
        evasion_script = """
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
        
        // Mock chrome runtime
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };
        
        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });
        
        // Mock languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });
        
        // Mock platform
        Object.defineProperty(navigator, 'platform', {
            get: () => 'Win32',
        });
        
        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
        
        // Override image loading
        const originalImageSrc = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
        delete Image.prototype.src;
        Object.defineProperty(Image.prototype, 'src', {
            get: originalImageSrc.get,
            set: function(value) {
                if (value.includes('webdriver') || value.includes('automation')) {
                    return;
                }
                originalImageSrc.set.call(this, value);
            }
        });
        """
        
        await page.add_init_script(evasion_script)
    
    async def _setup_monitoring(self, page: Page):
        """Set up request/response monitoring"""
        async def handle_request(route):
            # Block unnecessary requests to improve performance based on configuration
            request = route.request
            resource_type = request.resource_type
            
            # Determine which resources to block based on Config settings
            blocked_types = []
            if not Config.LOAD_FONTS:
                blocked_types.append("font")
            if not Config.LOAD_CSS:
                blocked_types.append("stylesheet")
            if not Config.LOAD_MEDIA:
                blocked_types.append("media")
            
            if resource_type in blocked_types:
                await route.abort()
                log_to_node(self.session_id, 'debug', f"Blocked {resource_type}: {request.url}")
            else:
                await route.continue_()
        
        async def handle_response(response):
            if response.status >= 400:
                log_to_node(self.session_id, 'debug', f"HTTP error {response.status}: {response.url}")
        
        await page.route("**/*", handle_request)
        page.on("response", handle_response)
    
    async def cleanup(self):
        """Clean up browser resources"""
        try:
            if self.pages:
                for page in self.pages:
                    await page.close()
                self.pages.clear()
            
            if self.context:
                await self.context.close()
                
            if self.browser:
                await self.browser.close()
                
            # Log browser closure in Puppeteer style
            log_to_node(self.session_id, 'info', 'Browser closed.')
            
        except Exception as e:
            log_to_node(self.session_id, 'error', f"Browser cleanup failed: {e}")

async def run_enhanced_traffic_agent(
    urls: List[str], 
    duration_seconds: int, 
    proxy=None, 
    cookies=None, 
    browser_name="chromium", 
    headless=True,
    session_id=None,
    bounce_rate=0,
    organic_percentage=0,
    social_settings=None,
    custom_referer=None,
    desktop_percentage=70,
    scroll_enabled=True,
    visit_duration_min=None,
    visit_duration_max=None
) -> Dict:
    """Main function to run the enhanced traffic agent with Node.js compatibility"""
    
    # Generate session ID if not provided
    if not session_id:
        import secrets
        session_id = secrets.token_urlsafe(7)[:7]
    
    # Log session start with detailed information
    log_to_node(session_id, 'info', f'Starting Python traffic agent session', NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
    log_to_node(session_id, 'debug', f'Session configuration: {len(urls)} URLs, {duration_seconds}s duration', NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
    
    # Validate inputs
    if not urls:
        raise ValueError("No URLs provided")
    
    if duration_seconds <= 0:
        raise ValueError("Duration must be positive")
    
    # Validate URLs
    valid_urls = []
    for url in urls:
        try:
            parsed = urlparse(url)
            if parsed.scheme and parsed.netloc:
                valid_urls.append(url)
                log_to_node(session_id, 'debug', f'Valid URL added: {url}', NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
            else:
                log_to_node(session_id, 'warn', f'Invalid URL skipped: {url}', NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
        except:
            log_to_node(session_id, 'warn', f'Failed to parse URL: {url}', NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
    
    if not valid_urls:
        raise ValueError("No valid URLs provided")

    # Determine device type and headless mode (using campaign configuration)
    device_type = 'Desktop' if random.random() * 100 < desktop_percentage else 'Mobile'
    
    # Use headful percentage from campaign settings (same logic as Puppeteer)
    headful_percentage = 0
    should_be_headful = False
    if NODE_AUTOMATION_CONFIG:
        headful_percentage = NODE_AUTOMATION_CONFIG.get('headfulPercentage', 0)
        should_be_headful = NODE_AUTOMATION_CONFIG.get('shouldBeHeadful', False)
        # Override headless parameter if campaign specifies headful mode
        if should_be_headful:
            headless = False
    
    browser_mode = 'headful' if not headless else 'headless'
    
    # Log browser launch with proxy info (exact Puppeteer format)
    if proxy and isinstance(proxy, dict):
        proxy_string = None
        if proxy.get('server'):
            proxy_string = proxy.get('server')
        elif proxy.get('host') and proxy.get('port'):
            proxy_string = f"http://{proxy['host']}:{proxy['port']}"
        elif proxy.get('proxyString'):
            proxy_string = f"http://{proxy['proxyString']}"
        
        if proxy_string:
            log_to_node(session_id, 'info', f'Launching {browser_mode} browser with proxy: {proxy_string}', 
                       NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
        else:
            log_to_node(session_id, 'info', f'Launching {browser_mode} browser', 
                       NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
    else:
        log_to_node(session_id, 'info', f'Launching {browser_mode} browser', 
                   NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
    
    # Log device and session details
    log_to_node(session_id, 'debug', f'Device type selected: {device_type}', NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
    log_to_node(session_id, 'debug', f'Browser: {browser_name}, Headful: {headful_percentage}%', NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))

    browser_manager = BrowserManager(
        proxy=proxy, 
        cookies=cookies, 
        browser_name=browser_name, 
        headless=headless,
        session_id=session_id
    )
    
    session_stats = {
        "sessionId": session_id,
        "startTime": datetime.now(),
        "endTime": None,
        "duration": 0,
        "urls": valid_urls,
        "duration_seconds": duration_seconds,
        "pages_created": 0,
        "total_actions": 0,
        "successful_actions": 0,
        "ad_interactions": 0,
        "errors": [],
        "device": device_type,
        "visited": False,
        "completed": False,
        "bounced": False,
        "proxy": proxy.get('server') if proxy else None,
        "headful": not headless,
        "source": 'Direct',
        "specificReferrer": None
    }
    
    # Implement bounce rate logic (similar to Puppeteer)
    original_duration = duration_seconds
    if Config.BOUNCE_RATE > 0 and random.random() * 100 < Config.BOUNCE_RATE:
        # Reduce duration for bounce (similar to Puppeteer: 20-50% of min duration)
        min_duration = Config.VISIT_DURATION_MIN
        duration_seconds = int(random.uniform(min_duration * 0.2, min_duration * 0.5))
        session_stats["bounced"] = True
        log_to_node(session_id, 'info', f'Bounce triggered, reducing session duration from {original_duration}s to {duration_seconds}s', 
                   NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
        session_stats["duration_seconds"] = duration_seconds
    
    log_to_node(session_id, 'debug', f'Final session duration: {duration_seconds}s (bounced: {session_stats["bounced"]})', 
               NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
    
    try:
        # Initialize browser
        if not await browser_manager.initialize_browser():
            raise Exception("Failed to initialize browser")
        
        # Create pages for all URLs
        pages_info = []
        ad_reporter = AdInteractionReporter()
        
        log_to_node(session_id, 'info', f'Creating pages for {len(valid_urls)} URLs...', 
                   NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
        
        for url in valid_urls:
            try:
                # Generate traffic source and referrer (similar to Puppeteer logic)
                referrer = ''
                source = 'Direct'
                specific_referrer = None
                
                rand = random.random() * 100
                if rand < Config.ORGANIC:
                    # Determine if this session should use search engine navigation
                    use_search_engine = (
                        Config.SEARCH_KEYWORDS and 
                        Config.SEARCH_ENGINE and 
                        not should_use_direct_traffic()
                    )
                    
                    if use_search_engine:
                        # First navigate to search engine
                        search_url = get_search_url(Config.SEARCH_ENGINE, Config.SEARCH_KEYWORDS)
                        if search_url:
                            log_to_node(session_id, 'debug', f'Searching on {Config.SEARCH_ENGINE}: {Config.SEARCH_KEYWORDS}', 
                                       NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
                            
                            # Create page and navigate to search engine first
                            page = await browser_manager.create_page(search_url)
                            if page:
                                # Wait for search results to load
                                await asyncio.sleep(random.uniform(2, 4))
                                
                                # Set referrer for the target navigation
                                referrer = search_url
                                source = 'Organic'
                                specific_referrer = search_url
                                
                                # Now navigate to the target URL (simulating clicking a search result)
                                log_to_node(session_id, 'debug', f'Navigating from search to target: {url}', 
                                           NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
                                await page.set_extra_http_headers({"referer": referrer})
                                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        else:
                            # Fall back to Google referrer if search URL generation fails
                            referrer = 'https://www.google.com/'
                            source = 'Organic'
                            specific_referrer = referrer
                            log_to_node(session_id, 'debug', f'Using Google as referrer', 
                                       NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
                            page = await browser_manager.create_page(url)
                            if page:
                                await page.set_extra_http_headers({"referer": referrer})
                    else:
                        # Use Google as referrer for organic traffic without search keywords
                        referrer = 'https://www.google.com/'
                        source = 'Organic'
                        specific_referrer = referrer
                        log_to_node(session_id, 'debug', f'Using Google as referrer', 
                                   NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
                        page = await browser_manager.create_page(url)
                        if page:
                            await page.set_extra_http_headers({"referer": referrer})
                            
                elif Config.CUSTOM:
                    # Custom referrer
                    referrer = Config.CUSTOM
                    specific_referrer = referrer
                    custom_lower = referrer.lower()
                    if any(engine in custom_lower for engine in ['google', 'bing', 'yahoo']):
                        source = 'Organic'
                    elif any(social in custom_lower for social in ['facebook', 'twitter', 'instagram', 'linkedin']):
                        source = 'Social'
                    else:
                        source = 'Referral'
                    log_to_node(session_id, 'debug', f'Using custom referrer: {referrer}', 
                               NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
                    page = await browser_manager.create_page(url)
                    if page:
                        await page.set_extra_http_headers({"referer": referrer})
                        
                elif Config.SOCIAL and any(Config.SOCIAL.values()):
                    # Social media referrer
                    social_refs = []
                    if Config.SOCIAL.get('Facebook'): social_refs.append('https://facebook.com/')
                    if Config.SOCIAL.get('Twitter'): social_refs.append('https://twitter.com/')
                    if Config.SOCIAL.get('Instagram'): social_refs.append('https://instagram.com/')
                    if Config.SOCIAL.get('LinkedIn'): social_refs.append('https://linkedin.com/')
                    
                    if social_refs:
                        referrer = random.choice(social_refs)
                        source = 'Social'
                        specific_referrer = referrer
                        log_to_node(session_id, 'debug', f'Using social referrer: {referrer}', 
                                   NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
                        page = await browser_manager.create_page(url)
                        if page:
                            await page.set_extra_http_headers({"referer": referrer})
                    else:
                        # Direct navigation if no social refs available
                        log_to_node(session_id, 'debug', f'Direct navigation to: {url}', 
                                   NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
                        page = await browser_manager.create_page(url)
                else:
                    # Direct navigation (no referrer)
                    log_to_node(session_id, 'debug', f'Direct navigation to: {url}', 
                               NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
                    page = await browser_manager.create_page(url)
                
                # Update session stats with source information
                session_stats["source"] = source
                session_stats["specificReferrer"] = specific_referrer
                if page:
                    log_to_node(session_id, 'info', f'Page loaded: {url}', 
                               NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
                    session_stats["visited"] = True
                    
                    ad_handler = ComprehensiveAdHandler(page, ad_reporter, session_id)
                    ad_handler.session_duration = duration_seconds  # Set session duration
                    
                    pages_info.append({
                        "page": page,
                        "url": url,
                        "observer": SmartDOMObserver(page, session_id),
                        "planner": IntelligentActionPlanner(session_id),
                        "executor": RobustActionExecutor(page, session_id),
                        "ad_handler": ad_handler
                    })
                    session_stats["pages_created"] += 1
    
                
            except Exception as e:
                error_msg = f"Navigation to {url} failed: {str(e)}"
                log_to_node(session_id, 'error', error_msg, 
                           NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
                session_stats["errors"].append(error_msg)
        
        if not pages_info:
            raise Exception("No pages were created successfully")
        
        log_to_node(session_id, 'info', f'Successfully created {len(pages_info)} pages. Starting interaction phase...', 
                   NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
        
        # Main interaction loop
        start_time = time.time()
        current_page_index = 0
        
        log_to_node(session_id, 'debug', f'Starting main interaction loop for {duration_seconds}s', 
                   NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
        
        while time.time() - start_time < duration_seconds:
            try:
                # Select current page
                page_info = pages_info[current_page_index % len(pages_info)]
                page = page_info["page"]
                url = page_info["url"]
                
                # Bring page to front
                await page.bring_to_front()
                
                # Analyze page
                dom_info = await page_info["observer"].analyze_page()
                
                # Comprehensive ad detection and interaction
                ad_results = await page_info["ad_handler"].detect_and_interact_with_all_ads()
                session_stats["ad_interactions"] += ad_results.get("total_interacted", 0)
                
                # Log ad interactions in Puppeteer style
                if ad_results.get("total_interacted", 0) > 0:
                    log_to_node(session_id, 'info', f'Ad interactions: {ad_results.get("total_interacted", 0)}', 
                               NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
                
                # Plan action
                action = page_info["planner"].decide_action(dom_info)
                
                # Execute action
                success, message = await page_info["executor"].execute_action(action)
                
                # Record results
                session_stats["total_actions"] += 1
                if success:
                    session_stats["successful_actions"] += 1
                    page_info["planner"].record_action_result(action.get("type"), True)
                else:
                    page_info["planner"].record_action_result(action.get("type"), False)
                
                log_to_node(session_id, 'info', f"[{url}] Action: {action.get('type')} - {'Success' if success else 'Failed'}: {message}")
                
                # Random additional interactions
                for _ in range(random.randint(1, 3)):
                    try:
                        extra_action = {"type": "click_random", "count": 1}
                        await page_info["executor"].execute_action(extra_action)
                        session_stats["total_actions"] += 1
                        await asyncio.sleep(random.uniform(1.0, 3.0))
                    except:
                        pass
                
                # Move to next page
                current_page_index += 1
                
                # Inter-action delay
                await asyncio.sleep(random.uniform(2.0, 5.0))
                
            except Exception as e:
                error_msg = f"Interaction loop error: {str(e)}"
                log_to_node(session_id, 'error', error_msg)
                session_stats["errors"].append(error_msg)
                await asyncio.sleep(1.0)  # Brief pause before continuing
        
        log_to_node(session_id, 'debug', f'Session interaction completed after {time.time() - start_time:.1f}s', 
                   NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
        
        # Mark session as completed if we reached this point without major errors
        if session_stats["visited"] and not session_stats["bounced"]:
            session_stats["completed"] = True
        
        # Final stats
        session_stats["endTime"] = datetime.now()
        
        # Calculate actual session duration in seconds
        if session_stats["startTime"] and session_stats["endTime"]:
            duration_delta = session_stats["endTime"] - session_stats["startTime"]
            session_stats["duration"] = int(duration_delta.total_seconds())
            log_to_node(session_id, 'debug', f'[SUCCESS] Calculated session duration: {session_stats["duration"]}s (from {session_stats["startTime"].strftime("%H:%M:%S")} to {session_stats["endTime"].strftime("%H:%M:%S")})', 
                       NODE_AUTOMATION_CONFIG.get('campaignId') if NODE_AUTOMATION_CONFIG else None, 
                       NODE_AUTOMATION_CONFIG.get('userEmail') if NODE_AUTOMATION_CONFIG else None)
        else:
            session_stats["duration"] = 0
            log_to_node(session_id, 'warn', f'[WARNING] Could not calculate session duration - missing timestamps', 
                       NODE_AUTOMATION_CONFIG.get('campaignId') if NODE_AUTOMATION_CONFIG else None, 
                       NODE_AUTOMATION_CONFIG.get('userEmail') if NODE_AUTOMATION_CONFIG else None)
        
        session_stats["success_rate"] = (
            session_stats["successful_actions"] / session_stats["total_actions"] 
            if session_stats["total_actions"] > 0 else 0
        )
        
        # Generate comprehensive ad interaction report
        ad_report = ad_reporter.generate_report()
        session_stats["ad_report"] = ad_report
        
        # Log completion to Node.js if orchestrated
        if NODE_AUTOMATION_CONFIG:
            log_to_node(session_id, 'info', f'Session completed: {session_stats["total_actions"]} actions, {session_stats["success_rate"]:.2%} success rate, {session_stats["ad_interactions"]} ad interactions', 
                       NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
            
            # Log detailed stats in Puppeteer-compatible format
            log_to_node(session_id, 'info', f'Pages created: {session_stats.get("pages_created", 0)}', 
                       NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
            log_to_node(session_id, 'info', f'Successful actions: {session_stats["successful_actions"]}', 
                       NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
            # Calculate duration safely
            if session_stats["endTime"] and session_stats["startTime"]:
                duration = (session_stats["endTime"] - session_stats["startTime"]).total_seconds()
                log_to_node(session_id, 'info', f'Session duration: {duration:.1f}s', 
                           NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
            else:
                log_to_node(session_id, 'info', 'Session duration: Unable to calculate (missing timestamps)', 
                           NODE_AUTOMATION_CONFIG.get('campaignId'), NODE_AUTOMATION_CONFIG.get('userEmail'))
        else:
            # Standard logging for manual mode
            log_to_node(session_id, 'info', f"Session completed: {session_stats['total_actions']} actions, "
                       f"{session_stats['success_rate']:.2%} success rate, "
                       f"{session_stats['ad_interactions']} ad interactions")
            
            # Print detailed ad report
            log_to_node(session_id, 'info', "=== AD INTERACTION REPORT ===")
            summary = ad_report["session_summary"]
            log_to_node(session_id, 'info', f"Total ads detected: {summary['total_ads_detected']}")
            log_to_node(session_id, 'info', f"Total ads clicked: {summary['total_ads_clicked']}")
            log_to_node(session_id, 'info', f"Total ads ignored: {summary['total_ads_ignored']}")
            log_to_node(session_id, 'info', f"Click success rate: {summary['click_success_rate']}")
            log_to_node(session_id, 'info', f"Ad types encountered: {', '.join(summary['ad_types_encountered'])}")
            log_to_node(session_id, 'info', f"Domains with ads: {', '.join(summary['domains_with_ads'])}")
            log_to_node(session_id, 'info', f"Popups closed: {summary['popup_closures']}")
            
            # Show detailed clicked ads
            clicked_ads = summary.get('clicked_ads_details', [])
            if clicked_ads:
                log_to_node(session_id, 'info', "")
                log_to_node(session_id, 'info', "=== CLICKED ADS DETAILS ===")
                for i, ad in enumerate(clicked_ads, 1):
                    log_to_node(session_id, 'info', f"{i}. {ad['ad_name']} ({ad['ad_type']})")
                    log_to_node(session_id, 'info', f"   Domain: {ad['domain']}")
                    if ad['ad_text']:
                        log_to_node(session_id, 'info', f"   Text: {ad['ad_text']}")
                    log_to_node(session_id, 'info', f"   Clicked at: {ad['click_time']}")
                    if ad['ad_position']:
                        pos = ad['ad_position']
                        log_to_node(session_id, 'info', f"   Position: ({int(pos.get('x', 0))}, {int(pos.get('y', 0))}) Size: {int(pos.get('width', 0))}x{int(pos.get('height', 0))}")
            
            # Show ad type breakdown
            ad_breakdown = summary.get('ad_type_breakdown', {})
            if ad_breakdown:
                log_to_node(session_id, 'info', "")
                log_to_node(session_id, 'info', "=== AD TYPE BREAKDOWN ===")
                for ad_type, stats in ad_breakdown.items():
                    log_to_node(session_id, 'info', f"{ad_type.title()} Ads:")
                    log_to_node(session_id, 'info', f"  Detected: {stats['detected']}, Clicked: {stats['clicked']}, "
                               f"Ignored: {stats['ignored']}, Failed: {stats['failed']}")
            
            # Show ignored ads summary
            ignored_summary = summary.get('ignored_ads_summary', {})
            if ignored_summary:
                log_to_node(session_id, 'info', "")
                log_to_node(session_id, 'info', "=== IGNORED ADS SUMMARY ===")
                for reason, data in ignored_summary.items():
                    log_to_node(session_id, 'info', f"Reason: {reason} (Count: {data['count']})")
                    log_to_node(session_id, 'info', f"  Ad types: {', '.join(data['ad_types'])}")
                    if data['examples']:
                        examples = [ex['ad_name'] for ex in data['examples'][:2]]
                        log_to_node(session_id, 'info', f"  Examples: {', '.join(examples)}")
            
            if ad_report["recommendations"]:
                log_to_node(session_id, 'info', "")
                log_to_node(session_id, 'info', "=== RECOMMENDATIONS ===")
                for rec in ad_report["recommendations"]:
                    log_to_node(session_id, 'info', f"  - {rec}")
        
        return session_stats
        
    except Exception as e:
        error_msg = f"Traffic agent failed: {str(e)}"
        log_to_node(session_id, 'error', error_msg)
        session_stats["errors"].append(error_msg)
        session_stats["end_time"] = datetime.now().isoformat()
        return session_stats
        
    finally:
        await browser_manager.cleanup()


async def main():
    """Main entry point for the traffic agent"""
    
    # Get URLs from user input
    print("\n=== Humanized Traffic Bot ===")
    print("Enter the URLs you want to visit (separated by commas):")
    user_input = input("> ").strip()
    
    # Parse URLs
    raw_urls = [url.strip() for url in user_input.split(",") if url.strip()]
    valid_urls = []
    
    for url in raw_urls:
        # Add https:// if missing
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        # Validate URL format
        try:
            parsed = urlparse(url)
            if not all([parsed.scheme, parsed.netloc]):
                log_to_node(session_id, 'warn', f"Invalid URL skipped: {url}")
                continue
            valid_urls.append(url)
        except:
            log_to_node(session_id, 'warn', f"Failed to parse URL: {url}")
    
    if not valid_urls:
        print("Error: No valid URLs provided. Please enter at least one valid URL.")
        return
    
    # Get duration from user
    print("\nEnter duration in seconds (default: 60):")
    duration_input = input("> ").strip()
    try:
        duration_seconds = int(duration_input) if duration_input else 60
    except ValueError:
        print("Invalid duration. Using default 60 seconds.")
        duration_seconds = 60
    
    # Set headless mode
    print("\nRun in headless mode? (y/n, default: n):")
    headless_input = input("> ").strip().lower()
    Config.HEADLESS = headless_input == 'y'
    
    log_to_node('main', 'info', f"Starting traffic agent for {len(valid_urls)} URLs, duration: {duration_seconds}s")
    log_to_node('main', 'info', f"Target URLs: {valid_urls}")
    
    try:
        result = await run_enhanced_traffic_agent(valid_urls, duration_seconds)
        
        log_to_node('main', 'info', "=== SESSION SUMMARY ===")
        log_to_node('main', 'info', f"URLs: {result['urls']}")
        log_to_node('main', 'info', f"Pages created: {result['pages_created']}")
        log_to_node('main', 'info', f"Total actions: {result['total_actions']}")
        log_to_node('main', 'info', f"Successful actions: {result['successful_actions']}")
        log_to_node('main', 'info', f"Success rate: {result.get('success_rate', 0):.2%}")
        log_to_node('main', 'info', f"Ad interactions: {result.get('ad_interactions', 0)}")
        log_to_node('main', 'info', f"Errors: {len(result['errors'])}")
        
        # Show ad report summary if available
        if 'ad_report' in result:
            ad_summary = result['ad_report']['session_summary']
            log_to_node('main', 'info', "")
            log_to_node('main', 'info', "=== FINAL AD INTERACTION SUMMARY ===")
            log_to_node('main', 'info', f"Ads detected: {ad_summary['total_ads_detected']}")
            log_to_node('main', 'info', f"Ads clicked: {ad_summary['total_ads_clicked']}")
            log_to_node('main', 'info', f"Ad click success rate: {ad_summary['click_success_rate']}")
            
            # Show top clicked ads
            clicked_ads = ad_summary.get('clicked_ads_details', [])
            if clicked_ads:
                log_to_node('main', 'info', "")
                log_to_node('main', 'info', "Top Clicked Ads:")
                for i, ad in enumerate(clicked_ads[:5], 1):
                    log_to_node('main', 'info', f"  {i}. {ad['ad_name']} ({ad['ad_type']}) on {ad['domain']}")
            
            # Show ad type performance
            ad_breakdown = ad_summary.get('ad_type_breakdown', {})
            if ad_breakdown:
                log_to_node('main', 'info', "")
                log_to_node('main', 'info', "Ad Type Performance:")
                for ad_type, stats in ad_breakdown.items():
                    click_rate = (stats['clicked'] / stats['detected'] * 100) if stats['detected'] > 0 else 0
                    log_to_node('main', 'info', f"  {ad_type.title()}: {stats['clicked']}/{stats['detected']} clicked ({click_rate:.1f}%)")
        
        if result['errors']:
            log_to_node('main', 'info', "")
            log_to_node('main', 'info', "Error details:")
            for i, error in enumerate(result['errors'][:5], 1):
                log_to_node('main', 'info', f"  {i}. {error}")
        
    except Exception as e:
        log_to_node('main', 'error', f"Main execution failed: {e}")
        log_to_node('main', 'error', traceback.format_exc())
# --- Modern pipeline main entry ---
if __name__ == "__main__":
    config = NODE_AUTOMATION_CONFIG
    if config:
        # Extract all parameters from Node.js config
        urls = config.get("urls", [])
        duration = int(config.get("duration_seconds", 60))
        proxy = config.get("proxy")
        cookies = config.get("cookies", [])
        headless = bool(config.get("headless", Config.HEADLESS))
        browser_name = config.get("browser", "chromium")
        session_id = config.get("sessionId")
        
        # Additional campaign parameters
        bounce_rate = config.get("bounceRate", 0)
        organic_percentage = config.get("organic", 0)
        social_settings = config.get("social", {})
        custom_referer = config.get("custom", "")
        desktop_percentage = config.get("desktopPercentage", 70)
        scroll_enabled = config.get("scrolling", True)
        visit_duration_min = config.get("visitDurationMin")
        visit_duration_max = config.get("visitDurationMax")
        
        # Set campaign and user info for logging
        campaign_id = config.get("campaignId")
        user_email = config.get("userEmail")
        
        try:
            # Run the enhanced traffic agent with all parameters
            result = asyncio.run(
                run_enhanced_traffic_agent(
                    urls=urls,
                    duration_seconds=duration,
                    proxy=proxy,
                    cookies=cookies,
                    browser_name=browser_name,
                    headless=headless,
                    session_id=session_id,
                    bounce_rate=bounce_rate,
                    organic_percentage=organic_percentage,
                    social_settings=social_settings,
                    custom_referer=custom_referer,
                    desktop_percentage=desktop_percentage,
                    scroll_enabled=scroll_enabled,
                    visit_duration_min=visit_duration_min,
                    visit_duration_max=visit_duration_max
                )
            )
            
            # Convert result to Node.js compatible format
            node_result = {
                "sessionId": result.get("sessionId"),
                "startTime": result.get("startTime").isoformat() if result.get("startTime") else None,
                "endTime": result.get("endTime").isoformat() if result.get("endTime") else None,
                "duration": result.get("duration", 0),
                "source": result.get("source", "Direct"),
                "specificReferrer": result.get("specificReferrer"),
                "device": result.get("device"),
                "visited": result.get("visited", False),
                "completed": result.get("completed", False),
                "bounced": result.get("bounced", False),
                "proxy": result.get("proxy"),
                "headful": result.get("headful", False),
                "success": True,
                "pages_created": result.get("pages_created", 0),
                "total_actions": result.get("total_actions", 0),
                "successful_actions": result.get("successful_actions", 0),
                "ad_interactions": result.get("ad_interactions", 0),
                "errors": result.get("errors", [])
            }
            
            # Output result for Node orchestrator in JSON
            print(json.dumps(node_result, default=str), flush=True)
            
        except Exception as e:
            # Output error result with proper timestamp fields for analytics
            now = datetime.now()
            error_result = {
                "sessionId": session_id,
                "success": False,
                "error": str(e),
                "visited": False,
                "completed": False,
                "bounced": True,
                "startTime": now.isoformat(),  # Add missing timestamp fields
                "endTime": now.isoformat(),
                "duration": 0,
                "source": "Direct",
                "device": "Desktop"
            }
            print(json.dumps(error_result, default=str), flush=True)
            sys.exit(1)
    else:
        # Run interactive mode
        asyncio.run(main())
