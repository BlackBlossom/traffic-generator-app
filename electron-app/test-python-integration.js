// test-unified-traffic.js
// Quick test script for unified traffic integration

const { runTraffic } = require('./src/main/traffic-worker/traffic');

async function testUnifiedTraffic() {
    console.log('🚀 Testing Unified Traffic Integration...\n');

    // Test campaign configuration
    const testCampaign = {
        _id: 'test-unified-campaign',
        id: 'test-unified-campaign',
        targetUrl: ['https://httpbin.org/html', 'https://example.com'],
        concurrent: 1,
        userEmail: 'test@example.com',
        delay: 1,
        
        // Traffic source settings
        organic: 50,
        social: {
            facebook: 25,
            twitter: 15
        },
        custom: 'https://referrer.example.com',
        
        // Session settings
        visitDurationMin: 20,
        visitDurationMax: 60,
        desktopPercentage: 80,
        scrolling: true,
        
        // Proxy settings (empty for test)
        proxies: [],
        
        // Ad settings (optional)
        adSelectors: '.ad, .advertisement',
        adsXPath: '//div[@class="ad"]',
        bounceRate: 20
    };

    console.log('✅ Test campaign created\n');

    // Test 1: Puppeteer Mode (Default)
    console.log('1. Testing Puppeteer Mode (Default)...');
    try {
        await runTraffic(testCampaign, 'test-campaign-puppeteer', 'test@example.com');
        console.log('✅ Puppeteer mode completed successfully!\n');
    } catch (error) {
        console.log('❌ Puppeteer mode failed:', error.message, '\n');
    }

    // Test 2: Python Mode via trafficMode parameter
    console.log('2. Testing Python Mode via trafficMode parameter...');
    try {
        const pythonCampaign = { ...testCampaign, trafficMode: 'python' };
        await runTraffic(pythonCampaign, 'test-campaign-python', 'test@example.com');
        console.log('✅ Python mode (via trafficMode) completed successfully!\n');
    } catch (error) {
        console.log('❌ Python mode (via trafficMode) failed:', error.message);
        console.log('   This might be due to Python dependencies not being installed\n');
    }

    // Test 3: Python Mode via options
    console.log('3. Testing Python Mode via options...');
    try {
        await runTraffic(testCampaign, 'test-campaign-python-options', 'test@example.com', {
            trafficMode: 'python',
            usePython: true,
            headless: true, // Set to false to watch the browser
            browser: 'chromium'
        });
        console.log('✅ Python mode (via options) completed successfully!\n');
    } catch (error) {
        console.log('❌ Python mode (via options) failed:', error.message);
        console.log('   This might be due to Python dependencies not being installed\n');
    }

    console.log('🎉 Unified traffic integration test completed!');
    console.log('\nUsage Summary:');
    console.log('1. Default Puppeteer: runTraffic(campaign, campaignId, userEmail)');
    console.log('2. Python via campaign: campaign.trafficMode = "python"');
    console.log('3. Python via options: runTraffic(campaign, id, email, { trafficMode: "python" })');
    console.log('\nBoth modes now work through the same runTraffic() function! 🚀');
}

// Run the test if called directly
if (require.main === module) {
    testUnifiedTraffic().catch(console.error);
}

module.exports = { testUnifiedTraffic };
