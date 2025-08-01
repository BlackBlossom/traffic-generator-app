import os
import asyncio
from playwright.async_api import async_playwright

# Load proxy config from environment, or use defaults
PROXY_HOST = os.getenv('PROXY_HOST', 'gw.dataimpulse.com')
PROXY_PORT = os.getenv('PROXY_PORT', '823')
PROXY_USER = os.getenv('PROXY_USER', 'b0ac12156e5e63a82bbe__cr.ca')
PROXY_PASS = os.getenv('PROXY_PASS', 'c16003108e64d017')

TARGET_URL = 'https://ip.decodo.com/json'  # Shows public IP

async def test_proxy_session():
    print(f"Launching Chromium with proxy: {PROXY_HOST}:{PROXY_PORT}")
    proxy_settings = {
        "server": f"http://{PROXY_HOST}:{PROXY_PORT}",
        "username": PROXY_USER,
        "password": PROXY_PASS
    }
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, proxy=proxy_settings)
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        # Optionally set referer
        await page.set_extra_http_headers({'referer': 'https://google.com/'})
        await page.goto(TARGET_URL, wait_until='networkidle')
        # Print the IP shown in httpbin
        content = await page.text_content('body')
        print('Proxy IP response:', content)
        await browser.close()

if __name__ == '__main__':
    asyncio.run(test_proxy_session())
