const mongoose = require('mongoose');
require('dotenv').config();

async function fixCookieIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get the campaigns collection
    const db = mongoose.connection.db;
    const collection = db.collection('campaigns');

    // List all indexes to see what exists
    console.log('📋 Current indexes on campaigns collection:');
    const indexes = await collection.indexes();
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${JSON.stringify(index)}`);
    });

    // Check if the problematic index exists
    const problematicIndex = indexes.find(index => 
      index.key && index.key['cookies.name']
    );

    if (problematicIndex) {
      console.log('\n🔍 Found problematic index:', JSON.stringify(problematicIndex));
      
      // Drop the problematic index
      const indexName = problematicIndex.name;
      console.log(`🗑️  Dropping index: ${indexName}`);
      await collection.dropIndex(indexName);
      console.log('✅ Successfully dropped the problematic index');
    } else {
      console.log('\n✅ No problematic cookie index found');
    }

    // List indexes again to confirm
    console.log('\n📋 Indexes after cleanup:');
    const updatedIndexes = await collection.indexes();
    updatedIndexes.forEach((index, i) => {
      console.log(`${i + 1}. ${JSON.stringify(index)}`);
    });

    console.log('\n🎉 Index cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing cookie index:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixCookieIndex();
