// Test script to verify campaign log storage
// Run this in the main process to check if logs are being stored

const sqliteLogger = require('./src/main/services/sqliteLogger');

async function testCampaignLogStorage() {
  console.log('=== Testing Campaign Log Storage ===');
  
  const campaignId = '688b6940c3aeb4951f2993f8';
  const userEmail = 'iron.avenger464@gmail.com';
  
  try {
    // Test 1: Store a test log entry
    console.log('\n1. Storing test log entry...');
    const testLogEntry = {
      level: 'info',
      message: 'Test log entry for campaign storage verification',
      sessionId: 'test-storage-verification',
      timestamp: new Date().toISOString()
    };
    
    await sqliteLogger.pushLog(campaignId, userEmail, testLogEntry);
    console.log('✅ Test log entry stored');
    
    // Test 2: Fetch logs for the campaign
    console.log('\n2. Fetching logs for campaign...');
    const logs = await sqliteLogger.fetchLogs(campaignId, userEmail, 10);
    console.log(`📋 Found ${logs.length} logs for campaign ${campaignId}`);
    
    if (logs.length > 0) {
      console.log('\n📝 Recent logs:');
      logs.slice(0, 5).forEach((log, index) => {
        console.log(`  ${index + 1}. ${log}`);
      });
    }
    
    // Test 3: Get log count
    console.log('\n3. Getting log count...');
    const count = await sqliteLogger.getLogCount(campaignId, userEmail);
    console.log(`📊 Total log count: ${count}`);
    
    // Test 4: Check if database connection is healthy
    console.log('\n4. Checking database health...');
    const health = await sqliteLogger.checkHealth();
    console.log(`🏥 Database health:`, health);
    
    console.log('\n✅ Campaign log storage test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCampaignLogStorage();
