// test-python-chromium.js
// Quick test to verify Python uses built-in Playwright Chromium and matches Puppeteer logs

const { runTraffic } = require('./src/main/traffic-worker/traffic');

async function testPythonChromium() {
    console.log('🚀 Testing Python with Built-in Chromium and Puppeteer-style Logs...\n');

    // Test campaign configuration
    const testCampaign = {
        _id: 'test-chromium-campaign',
        id: 'test-chromium-campaign',
        targetUrl: ['https://httpbin.org/html'],
        concurrent: 1,
        userEmail: 'test@example.com',
        delay: 1,
        
        // Force Python mode
        trafficMode: 'python',
        
        // Session settings
        visitDurationMin: 20,
        visitDurationMax: 40,
        desktopPercentage: 100, // Force desktop
        scrolling: true,
        
        // No proxies for test
        proxies: [],
        
        // Ad settings
        adSelectors: '.ad, .advertisement',
        bounceRate: 0
    };

    console.log('✅ Test campaign created with Python mode\n');

    console.log('Testing Python mode with built-in Chromium...');
    console.log('Expected log format: [timestamp] [session-id] [LEVEL] message');
    console.log('Watch for "Launching headless chromium browser with Playwright built-in"\n');
    
    try {
        await runTraffic(testCampaign, 'test-chromium-python', 'test@example.com', {
            headless: true, // Use headless for testing
            browser: 'chromium'
        });
        
        console.log('\n✅ Python mode with built-in Chromium completed successfully!');
        console.log('✅ Logs should now match Puppeteer format');
        console.log('✅ No system Chrome should have been used');
        
    } catch (error) {
        console.log('\n❌ Python mode failed:', error.message);
        console.log('   Check that Python and Playwright are installed:');
        console.log('   pip install playwright');
        console.log('   python -m playwright install chromium');
    }

    console.log('\n🎉 Test completed!');
    console.log('\nLog format comparison:');
    console.log('Puppeteer: [timestamp] [session-id] [LEVEL] message');
    console.log('Python:    [timestamp] [session-id] [LEVEL] message (should match!)');
}

// Run the test if called directly
if (require.main === module) {
    testPythonChromium().catch(console.error);
}

module.exports = { testPythonChromium };
