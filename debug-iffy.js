#!/usr/bin/env node

/**
 * Debug script to check Iffy content moderation configuration
 * Run this from the project root: node debug-iffy.js
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import after env is loaded
const { initDb } = await import('./packages/backend/src/db/postgre.js');
const { fetchMeta } = await import('./packages/backend/src/misc/fetch-meta.js');
const { contentAutoModerator } = await import('./packages/backend/src/services/content-auto-moderator.js');

async function debugIffy() {
    console.log('🔍 Debugging Iffy Content Moderation Setup...\n');
    
    try {
        // Initialize database
        console.log('📊 Initializing database connection...');
        await initDb();
        console.log('✅ Database connected\n');
        
        // Check meta configuration
        console.log('⚙️  Checking instance configuration...');
        const meta = await fetchMeta();
        
        const config = {
            enableContentModeration: meta.enableContentModeration,
            hasIffyApiKey: !!meta.iffyApiKey,
            iffyApiUrl: meta.iffyApiUrl || 'not set',
            hasIffyWebhookSecret: !!meta.iffyWebhookSecret,
            iffyConfidenceThreshold: meta.iffyConfidenceThreshold || 'not set',
            autoHideInappropriateContent: meta.autoHideInappropriateContent,
            enableSchoolContentModeration: meta.enableSchoolContentModeration,
        };
        
        console.log('Configuration Status:');
        console.log('├─ Content Moderation Enabled:', config.enableContentModeration ? '✅' : '❌');
        console.log('├─ Iffy API Key Configured:', config.hasIffyApiKey ? '✅' : '❌');
        console.log('├─ Iffy API URL:', config.iffyApiUrl);
        console.log('├─ Webhook Secret Configured:', config.hasIffyWebhookSecret ? '✅' : '❌');
        console.log('├─ Confidence Threshold:', config.iffyConfidenceThreshold);
        console.log('├─ Auto-hide Content:', config.autoHideInappropriateContent ? '✅' : '❌');
        console.log('└─ School Content Moderation:', config.enableSchoolContentModeration ? '✅' : '❌');
        console.log();
        
        // Check if content auto moderator is available
        console.log('🤖 Checking content auto moderator status...');
        const isAvailable = contentAutoModerator.isAvailable();
        console.log('Content Auto Moderator Available:', isAvailable ? '✅' : '❌');
        
        if (!isAvailable) {
            console.log('⚠️  Content auto moderator is not available. Attempting to initialize...');
            try {
                await contentAutoModerator.initialize();
                const isNowAvailable = contentAutoModerator.isAvailable();
                console.log('After initialization:', isNowAvailable ? '✅' : '❌');
            } catch (error) {
                console.log('❌ Initialization failed:', error.message);
            }
        }
        console.log();
        
        // Test with sample content if everything is configured
        if (config.enableContentModeration && config.hasIffyApiKey && contentAutoModerator.isAvailable()) {
            console.log('🧪 Testing content submission to Iffy...');
            try {
                const testResult = await contentAutoModerator.moderatePost(
                    'test-post-' + Date.now(),
                    'This is a test message to verify Iffy is working correctly.',
                    'test-user-id'
                );
                console.log('Test Result:', testResult ? '✅ Content submitted to Iffy successfully' : '⚠️  Content submission failed');
                console.log('Note: Since Iffy uses async processing, actual moderation results come via webhook');
            } catch (error) {
                console.log('❌ Test failed:', error.message);
            }
        } else {
            console.log('⚠️  Cannot test - missing configuration or moderator not available');
        }
        
        console.log('\n📋 Summary and Next Steps:');
        
        if (!config.enableContentModeration) {
            console.log('❌ Content moderation is disabled in admin settings');
            console.log('   → Go to Admin > Settings and enable "Enable Content Moderation"');
        }
        
        if (!config.hasIffyApiKey) {
            console.log('❌ Iffy API key is not configured');
            console.log('   → Go to Admin > Settings and add your Iffy API key');
        }
        
        if (!config.hasIffyWebhookSecret) {
            console.log('⚠️  Iffy webhook secret is not configured');
            console.log('   → Go to Admin > Settings and add your Iffy webhook secret');
            console.log('   → This is needed for webhook signature verification');
        }
        
        if (!contentAutoModerator.isAvailable()) {
            console.log('❌ Content auto moderator failed to initialize');
            console.log('   → Check the above configuration issues');
            console.log('   → Restart the server after fixing configuration');
        }
        
        if (config.enableContentModeration && config.hasIffyApiKey && contentAutoModerator.isAvailable()) {
            console.log('✅ Iffy content moderation is configured and running!');
            console.log('\n🔄 How it works:');
            console.log('1. When users post content or upload images, it gets submitted to Iffy');
            console.log('2. Iffy processes the content asynchronously');
            console.log('3. Iffy sends results back via webhook to /api/iffy/webhook');
            console.log('4. Flagged content gets automatically hidden/marked sensitive');
            console.log('5. School admins and moderators get notified');
            
            console.log('\n🔧 Webhook Setup:');
            console.log('Make sure your Iffy webhook is configured to send events to:');
            console.log(`   ${process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:3000'}/api/iffy/webhook`);
        }
        
        console.log('\n🚀 To test the full flow:');
        console.log('1. Make sure all configuration is correct');
        console.log('2. Restart your server');
        console.log('3. Create a post with potentially inappropriate content');
        console.log('4. Check server logs for Iffy submission');
        console.log('5. Wait for webhook response from Iffy');
        console.log('6. Check if content gets hidden/flagged appropriately');
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        process.exit(0);
    }
}

debugIffy();