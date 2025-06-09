// twitter-bot-2fa.js - Complete Fixed Version with Real Comment Scraping
const { chromium } = require('playwright');

class TwitterBot2FA {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.username = null; // Store username for profile navigation
    }

    async init() {
        console.log('🚀 Initializing browser...');
        
        this.browser = await chromium.launch({ 
            headless: false, // Keep visible for 2FA
            slowMo: 300
        });
        
        const context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 }
        });
        
        this.page = await context.newPage();
        console.log('✅ Browser initialized');
    }

    async close() {
        if (this.browser) {
            console.log('🔒 Closing browser...');
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.isLoggedIn = false;
            console.log('✅ Browser closed');
        }
    }

    async loginWith2FA(username, password) {
        try {
            console.log('🔐 Starting login process...');
            
            // Check if already logged in
            await this.page.goto('https://twitter.com/home');
            await this.page.waitForTimeout(2000);
            
            if (await this.checkIfLoggedIn()) {
                console.log('✅ Already logged in!');
                return true;
            }

            // Go to login page
            console.log('🔐 Going to login page...');
            await this.page.goto('https://twitter.com/i/flow/login');
            await this.page.waitForTimeout(3000);

            // Step 1: Enter username
            console.log('📝 Step 1: Entering username...');
            await this.enterUsername(username);

            // Step 2: Check for unusual activity / phone verification
            await this.page.waitForTimeout(3000);
            if (await this.handlePhoneVerification()) {
                console.log('📱 Phone verification handled, continuing...');
            }

            // Step 3: Enter password
            console.log('🔑 Step 2: Entering password...');
            await this.enterPassword(password);

            // Step 4: Handle 2FA if required
            await this.page.waitForTimeout(3000);
            const requires2FA = await this.detect2FA();
            
            if (requires2FA) {
                console.log('🔐 Step 3: 2FA detected!');
                console.log('📱 Please open your authenticator app and enter the 6-digit code in the browser');
                console.log('⏳ I will wait for you to complete this...');
                
                await this.waitFor2FACompletion();
                console.log('✅ 2FA completed successfully!');
            }

            // Step 5: Verify login
            console.log('🔍 Verifying login...');
            await this.page.waitForTimeout(3000);
            
            if (await this.checkIfLoggedIn()) {
                console.log('🎉 Login successful!');
                this.isLoggedIn = true;
                return true;
            } else {
                console.log('❌ Login verification failed');
                return false;
            }

        } catch (error) {
            console.error('❌ Login error:', error.message);
            return false;
        }
    }

    async checkIfLoggedIn() {
        const indicators = [
            '[data-testid="SideNav_AccountSwitcher_Button"]',
            '[data-testid="AppTabBar_Home_Link"]',
            '[aria-label="Home timeline"]'
        ];
        
        for (const indicator of indicators) {
            if (await this.page.locator(indicator).isVisible().catch(() => false)) {
                return true;
            }
        }
        
        const url = this.page.url();
        return url.includes('/home') || url.includes('/timeline');
    }

    async enterUsername(username) {
        const selectors = [
            'input[autocomplete="username"]',
            'input[name="text"]',
            'input[data-testid="ocfEnterTextTextInput"]'
        ];
        
        for (const selector of selectors) {
            try {
                const input = await this.page.waitForSelector(selector, { timeout: 3000 });
                await input.fill(username);
                console.log(`✅ Username entered with: ${selector}`);
                
                // Click Next or press Enter
                try {
                    await this.page.click('text=Next', { timeout: 2000 });
                } catch {
                    await input.press('Enter');
                }
                
                return true;
            } catch (e) {
                console.log(`⚠️ Username selector ${selector} failed, trying next...`);
            }
        }
        
        throw new Error('Could not find username input');
    }

    async handlePhoneVerification() {
        // Sometimes Twitter asks for phone verification before password
        const phoneSelectors = [
            'input[name="text"]',
            'input[placeholder*="phone"]',
            'text="Enter your phone number"'
        ];
        
        for (const selector of phoneSelectors) {
            if (await this.page.locator(selector).isVisible().catch(() => false)) {
                console.log('📱 Phone verification detected!');
                console.log('⚠️ Please handle this manually in the browser - enter your phone number');
                console.log('⏳ Waiting for you to continue...');
                
                // Wait for phone verification to be completed
                let completed = false;
                let attempts = 0;
                
                while (!completed && attempts < 60) { // 5 minutes
                    await this.page.waitForTimeout(5000);
                    
                    // Check if we moved past phone verification
                    const stillOnPhone = await this.page.locator(selector).isVisible().catch(() => false);
                    if (!stillOnPhone) {
                        completed = true;
                        break;
                    }
                    
                    attempts++;
                    if (attempts % 12 === 0) {
                        console.log(`⏳ Still waiting for phone verification... (${Math.floor(attempts / 12)} minutes)`);
                    }
                }
                
                return completed;
            }
        }
        
        return false; // No phone verification needed
    }

    async enterPassword(password) {
        const selectors = [
            'input[type="password"]',
            'input[name="password"]',
            'input[autocomplete="current-password"]'
        ];
        
        for (const selector of selectors) {
            try {
                const input = await this.page.waitForSelector(selector, { timeout: 5000 });
                await input.fill(password);
                console.log(`✅ Password entered with: ${selector}`);
                
                // Click Log in or press Enter
                try {
                    await this.page.click('text=Log in', { timeout: 2000 });
                } catch {
                    await input.press('Enter');
                }
                
                return true;
            } catch (e) {
                console.log(`⚠️ Password selector ${selector} failed, trying next...`);
            }
        }
        
        throw new Error('Could not find password input');
    }

    async detect2FA() {
        const twoFASelectors = [
            'input[data-testid="ocfEnterTextTextInput"]',
            'input[placeholder*="verification"]',
            'input[placeholder*="code"]',
            'text="Enter your verification code"',
            'text="We sent you a code"',
            'text="Check your authenticator app"'
        ];
        
        for (const selector of twoFASelectors) {
            if (await this.page.locator(selector).isVisible().catch(() => false)) {
                console.log(`✅ 2FA detected with: ${selector}`);
                return true;
            }
        }
        
        return false;
    }

    async waitFor2FACompletion() {
        console.log('⏳ Waiting for 2FA completion...');
        console.log('💡 INSTRUCTIONS:');
        console.log('   1. Open your authenticator app (Google Authenticator, Authy, etc.)');
        console.log('   2. Find the 6-digit code for Twitter');
        console.log('   3. Enter it in the browser window');
        console.log('   4. Click "Next" or press Enter');
        console.log('');
        
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes
        
        while (attempts < maxAttempts) {
            await this.page.waitForTimeout(5000);
            
            // Check if we're past 2FA
            if (await this.checkIfLoggedIn()) {
                console.log('✅ 2FA completed - logged in successfully!');
                return true;
            }
            
            // Check if still on 2FA page
            const still2FA = await this.detect2FA();
            if (!still2FA) {
                console.log('✅ 2FA page passed!');
                return true;
            }
            
            attempts++;
            if (attempts % 6 === 0) { // Every 30 seconds
                const minutes = Math.floor(attempts / 12);
                console.log(`⏳ Still waiting for 2FA... (${minutes} minutes elapsed)`);
                console.log('💡 Please enter your 6-digit authenticator code in the browser');
            }
        }
        
        throw new Error('2FA timeout - please complete within 5 minutes');
    }

    async storeUsername(username) {
        this.username = username; // Store username for later use
        console.log(`💾 Username stored: ${username}`);
    }

    // Alternative method if you want to get username from the current page
    async getCurrentUsername() {
        try {
            // Try to get username from profile page or navigation
            const username = await this.page.evaluate(() => {
                // Look for username in profile URL or page elements
                const profileLink = document.querySelector('a[href^="/"][href$=""]') ||
                                  document.querySelector('[data-testid="UserName"]');
                
                if (profileLink) {
                    const href = profileLink.getAttribute('href');
                    return href ? href.replace('/', '') : null;
                }
                
                // Alternative: get from URL if currently on profile
                const currentUrl = window.location.href;
                const match = currentUrl.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
                return match ? match[1] : null;
            });
            
            if (username) {
                this.username = username;
                return username;
            }
        } catch (error) {
            console.log('Could not determine username:', error);
        }
        return null;
    }

// Replace the getMyTweets method in your twitter-bot-2fa.js with this improved version

async getMyTweets(count = 5) {
    try {
        console.log('🔍 Navigating to profile page to get posts...');
        
        if (!this.username) {
            throw new Error('Username not stored. Call storeUsername() first after login.');
        }
        
        // Navigate to your own profile instead of home timeline
        const profileUrl = `https://twitter.com/${this.username}`;
        console.log(`📍 Navigating to: ${profileUrl}`);
        
        // IMPROVED: Try multiple navigation strategies with different wait conditions
        let navigationSuccess = false;
        
        // Strategy 1: Try with load event (faster)
        try {
            console.log('🔄 Attempting navigation with "load" condition...');
            await this.page.goto(profileUrl, { 
                waitUntil: 'load',
                timeout: 20000 
            });
            navigationSuccess = true;
            console.log('✅ Navigation successful with "load"');
        } catch (error) {
            console.log('⚠️ Navigation with "load" failed, trying "domcontentloaded"...');
            
            // Strategy 2: Try with domcontentloaded (more lenient)
            try {
                await this.page.goto(profileUrl, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 30000 
                });
                navigationSuccess = true;
                console.log('✅ Navigation successful with "domcontentloaded"');
            } catch (error2) {
                console.log('⚠️ Navigation with "domcontentloaded" failed, trying basic navigation...');
                
                // Strategy 3: Basic navigation without wait conditions
                try {
                    await this.page.goto(profileUrl, { timeout: 15000 });
                    navigationSuccess = true;
                    console.log('✅ Navigation successful with basic goto');
                } catch (error3) {
                    console.error('❌ All navigation strategies failed');
                    throw new Error(`Failed to navigate to profile: ${error3.message}`);
                }
            }
        }
        
        if (!navigationSuccess) {
            throw new Error('Failed to navigate to profile page');
        }
        
        console.log('✅ Profile page loaded, waiting for content...');
        
        // Wait for page content with multiple fallback strategies
        let contentReady = false;
        
        // Strategy 1: Wait for tweet elements
        try {
            await this.page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 });
            contentReady = true;
            console.log('✅ Tweet elements found');
        } catch (error) {
            console.log('⚠️ Tweet elements not found, trying alternative selectors...');
            
            // Strategy 2: Wait for any content indicators
            try {
                await this.page.waitForSelector('article, [role="article"], [data-testid="cellInnerDiv"]', { timeout: 10000 });
                contentReady = true;
                console.log('✅ Alternative content elements found');
            } catch (error2) {
                console.log('⚠️ No specific elements found, proceeding with delay...');
                // Strategy 3: Just wait a bit and proceed
                await this.page.waitForTimeout(5000);
                contentReady = true;
                console.log('✅ Proceeding after timeout');
            }
        }
        
        // Scroll to load more content
        console.log('📜 Scrolling to load more tweets...');
        try {
            await this.page.evaluate(() => {
                window.scrollBy(0, 800);
            });
            
            // Wait for any new content to load
            await this.page.waitForTimeout(3000);
        } catch (error) {
            console.log('⚠️ Scrolling failed, but continuing...');
        }
        
        // Extract tweets with improved selectors
        console.log('🔍 Extracting tweets from profile...');
        const tweets = await this.page.evaluate((maxCount) => {
            console.log('Starting tweet extraction...');
            
            // Try multiple selectors for finding tweets
            const tweetSelectors = [
                '[data-testid="tweet"]',
                'article[role="article"]',
                '[data-testid="cellInnerDiv"]',
                'div[role="article"]'
            ];
            
            let tweetElements = [];
            
            // Try each selector until we find tweets
            for (const selector of tweetSelectors) {
                tweetElements = document.querySelectorAll(selector);
                console.log(`Selector "${selector}" found ${tweetElements.length} elements`);
                if (tweetElements.length > 0) break;
            }
            
            if (tweetElements.length === 0) {
                console.log('No tweet elements found with any selector');
                return [];
            }
            
            const tweets = [];
            console.log(`Processing ${tweetElements.length} potential tweet elements...`);
            
            for (let i = 0; i < Math.min(tweetElements.length, maxCount * 3); i++) { // Check more elements than needed
                const tweet = tweetElements[i];
                
                try {
                    // Try multiple methods to get tweet text
                    let text = '';
                    const textSelectors = [
                        '[data-testid="tweetText"]',
                        '[lang] span',
                        'span[dir="ltr"]',
                        'div[lang] span',
                        '.css-901oao'
                    ];
                    
                    for (const textSelector of textSelectors) {
                        const textElement = tweet.querySelector(textSelector);
                        if (textElement && textElement.innerText && textElement.innerText.trim()) {
                            text = textElement.innerText.trim();
                            break;
                        }
                    }
                    
                    // Skip if no text found or text is too short
                    if (!text || text.length < 5) continue;
                    
                    // Skip retweets and replies (they usually start with certain patterns)
                    if (text.startsWith('RT @') || text.startsWith('@')) continue;
                    
                    // Try to get tweet link and ID
                    let tweetId = '';
                    let tweetUrl = '';
                    
                    const linkSelectors = [
                        'a[href*="/status/"]',
                        'time[datetime] a',
                        'a[role="link"][href*="/status/"]'
                    ];
                    
                    for (const linkSelector of linkSelectors) {
                        const linkElement = tweet.querySelector(linkSelector);
                        if (linkElement) {
                            const href = linkElement.getAttribute('href');
                            if (href && href.includes('/status/')) {
                                const match = href.match(/\/status\/(\d+)/);
                                if (match) {
                                    tweetId = match[1];
                                    tweetUrl = href.startsWith('http') ? href : `https://twitter.com${href}`;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Get timestamp
                    let timestamp = new Date().toISOString();
                    const timeElement = tweet.querySelector('time[datetime]');
                    if (timeElement) {
                        timestamp = timeElement.getAttribute('datetime') || timestamp;
                    }
                    
                    // Only add if we have valid content
                    if (text && text.length > 10) {
                        tweets.push({
                            id: tweetId || `tweet_${Date.now()}_${i}`,
                            text: text,
                            time: timestamp,
                            url: tweetUrl || ''
                        });
                        
                        console.log(`Found tweet ${tweets.length}: ${text.substring(0, 50)}...`);
                        
                        // Stop when we have enough tweets
                        if (tweets.length >= maxCount) break;
                    }
                    
                } catch (error) {
                    console.log(`Error parsing tweet ${i}:`, error);
                }
            }
            
            console.log(`Extraction complete. Found ${tweets.length} valid tweets.`);
            return tweets;
        }, count);
        
        console.log(`✅ Successfully extracted ${tweets.length} tweets from profile`);
        
        // Filter out any invalid tweets
        const validTweets = tweets.filter(tweet => tweet.text && tweet.text.length > 5);
        
        if (validTweets.length === 0) {
            console.log('⚠️ No valid tweets found. This might be due to:');
            console.log('  - Profile has no recent tweets');
            console.log('  - Twitter changed their HTML structure');
            console.log('  - Page did not load properly');
            console.log('  - Content is behind login wall');
        }
        
        return validTweets;
        
    } catch (error) {
        console.error('❌ Error getting profile tweets:', error.message);
        
        // Provide helpful error context
        if (error.message.includes('Timeout')) {
            console.log('💡 TIMEOUT TROUBLESHOOTING:');
            console.log('  - Your internet connection might be slow');
            console.log('  - Twitter might be experiencing issues');
            console.log('  - Try again in a few minutes');
            console.log('  - Consider checking if you\'re still logged in');
        }
        
        throw error;
    }
}

    // FIXED: Method to get comments/replies for a specific tweet
async getCommentsForTweet(tweetUrl) {
    try {
        console.log('🔍 Getting comments for tweet:', tweetUrl);
        
        // Navigate to the specific tweet with improved timeout handling
        let navigationSuccess = false;
        
        // Strategy 1: Try with load event (faster)
        try {
            console.log('🔄 Navigating to tweet with "load" condition...');
            await this.page.goto(tweetUrl, { 
                waitUntil: 'load',
                timeout: 20000 
            });
            navigationSuccess = true;
            console.log('✅ Tweet navigation successful with "load"');
        } catch (error) {
            console.log('⚠️ Navigation with "load" failed, trying "domcontentloaded"...');
            
            // Strategy 2: Try with domcontentloaded
            try {
                await this.page.goto(tweetUrl, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 25000 
                });
                navigationSuccess = true;
                console.log('✅ Tweet navigation successful with "domcontentloaded"');
            } catch (error2) {
                console.log('⚠️ Navigation with "domcontentloaded" failed, trying basic navigation...');
                
                // Strategy 3: Basic navigation
                try {
                    await this.page.goto(tweetUrl, { timeout: 15000 });
                    navigationSuccess = true;
                    console.log('✅ Tweet navigation successful with basic goto');
                } catch (error3) {
                    throw new Error(`Failed to navigate to tweet: ${error3.message}`);
                }
            }
        }
        
        if (!navigationSuccess) {
            throw new Error('Failed to navigate to tweet page');
        }
        
        console.log('✅ Tweet page loaded');
        
        // Wait for content with multiple strategies
        let contentReady = false;
        
        try {
            await this.page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
            contentReady = true;
            console.log('✅ Tweet elements found');
        } catch (error) {
            console.log('⚠️ Tweet elements not found, trying alternative approach...');
            try {
                await this.page.waitForSelector('article, [role="article"]', { timeout: 8000 });
                contentReady = true;
                console.log('✅ Alternative tweet elements found');
            } catch (error2) {
                console.log('⚠️ No specific elements found, proceeding anyway...');
                await this.page.waitForTimeout(3000);
                contentReady = true;
            }
        }
        
        // Scroll down to load more replies
        console.log('📜 Scrolling to load replies...');
        try {
            await this.page.evaluate(() => {
                window.scrollBy(0, 1500);
            });
            
            // Wait for more content to load
            await this.page.waitForTimeout(3000);
        } catch (error) {
            console.log('⚠️ Scrolling failed, but continuing...');
        }
        
        // Extract replies with improved error handling
        const replies = await this.page.evaluate(() => {
            console.log('🔍 Starting comment extraction...');
            
            // Try multiple selectors for finding tweets/replies
            const tweetSelectors = [
                '[data-testid="tweet"]',
                'article[role="article"]',
                '[data-testid="cellInnerDiv"]',
                'div[role="article"]'
            ];
            
            let tweetElements = [];
            
            // Try each selector
            for (const selector of tweetSelectors) {
                tweetElements = document.querySelectorAll(selector);
                console.log(`Selector "${selector}" found ${tweetElements.length} elements`);
                if (tweetElements.length > 1) break; // Need at least 2 (original + replies)
            }
            
            if (tweetElements.length <= 1) {
                console.log('No reply elements found - tweet might have no replies');
                return [];
            }
            
            const replies = [];
            console.log(`Processing ${tweetElements.length} elements for replies...`);
            
            // Skip the first element (original tweet) and process replies
            for (let i = 1; i < tweetElements.length && replies.length < 20; i++) {
                const tweet = tweetElements[i];
                
                try {
                    // Get reply text with multiple approaches
                    let text = '';
                    const textSelectors = [
                        '[data-testid="tweetText"]',
                        '[lang] span',
                        'span[dir="ltr"]',
                        'div[lang]',
                        '.css-901oao'
                    ];
                    
                    for (const textSelector of textSelectors) {
                        const textElement = tweet.querySelector(textSelector);
                        if (textElement && textElement.innerText && textElement.innerText.trim()) {
                            text = textElement.innerText.trim();
                            break;
                        }
                    }
                    
                    // Skip if no text found or text is too short
                    if (!text || text.length < 3) continue;
                    
                    // Get username with multiple approaches
                    let username = '';
                    const usernameSelectors = [
                        '[data-testid="User-Name"] [href^="/"]',
                        '[data-testid="User-Names"] a',
                        'a[href^="/"][role="link"]',
                        '[dir="ltr"] a[href^="/"]',
                        'a[href^="/"]'
                    ];
                    
                    for (const selector of usernameSelectors) {
                        const usernameElements = tweet.querySelectorAll(selector);
                        for (const element of usernameElements) {
                            const href = element.getAttribute('href');
                            if (href && href !== '/' && !href.includes('/status/') && !href.includes('/photo/') && !href.includes('/hashtag/')) {
                                const match = href.match(/^\/([^\/\?]+)/);
                                if (match && match[1] && match[1].length > 0 && match[1].length < 20) {
                                    username = '@' + match[1];
                                    break;
                                }
                            }
                        }
                        if (username) break;
                    }
                    
                    // Fallback: use a generic username
                    if (!username) {
                        username = `@User${i}`;
                    }
                    
                    // Get timestamp
                    let timestamp = new Date().toISOString();
                    const timeElement = tweet.querySelector('time[datetime]');
                    if (timeElement) {
                        timestamp = timeElement.getAttribute('datetime') || timestamp;
                    }
                    
                    // Add the reply if we have valid text
                    if (text && text.length >= 3) {
                        replies.push({
                            id: `reply_${Date.now()}_${i}`,
                            author: username,
                            text: text,
                            timestamp: timestamp,
                            debug: {
                                elementIndex: i,
                                foundUsername: username !== `@User${i}`,
                                textLength: text.length
                            }
                        });
                        
                        console.log(`Found reply ${replies.length}: ${username} - ${text.substring(0, 50)}...`);
                    }
                    
                } catch (error) {
                    console.log(`Error parsing reply ${i}:`, error);
                }
            }
            
            console.log(`Comment extraction complete. Found ${replies.length} replies.`);
            return replies;
        });
        
        console.log(`✅ Found ${replies.length} replies using improved extraction`);
        
        // Log sample of what we found
        if (replies.length > 0) {
            console.log('📋 Sample replies:');
            replies.slice(0, 3).forEach((reply, i) => {
                console.log(`  ${i + 1}. ${reply.author}: ${reply.text.substring(0, 60)}...`);
            });
        } else {
            console.log('⚠️ No replies found. Possible reasons:');
            console.log('  - Tweet has no replies yet');
            console.log('  - Replies are restricted/private');
            console.log('  - Twitter structure changed');
            console.log('  - Page didn\'t load properly');
        }
        
        return replies;
        
    } catch (error) {
        console.error('❌ Error getting comments:', error.message);
        
        // Provide helpful context for different error types
        if (error.message.includes('Timeout') || error.message.includes('timeout')) {
            console.log('💡 TIMEOUT HELP:');
            console.log('  - Tweet page took too long to load');
            console.log('  - Try again with a different tweet');
            console.log('  - Check your internet connection');
        }
        
        return []; // Return empty array on error rather than throwing
    }
}

    // Alternative simple method for getting comments (backup)
    async getCommentsForTweetSimple(tweetUrl) {
        try {
            console.log('🔍 Getting comments (simple method):', tweetUrl);
            
            await this.page.goto(tweetUrl, { 
                waitUntil: 'networkidle',
                timeout: 60000 
            });
            
            // Wait for content
            await this.page.waitForTimeout(3000);
            
            // Just get all text that looks like replies
            const replies = await this.page.evaluate(() => {
                // Get all elements that might contain reply text
                const allElements = document.querySelectorAll('*');
                const replies = [];
                let replyCount = 0;
                
                for (const element of allElements) {
                    const text = element.innerText;
                    
                    // Skip if no text or text is too short/long
                    if (!text || text.length < 10 || text.length > 500) continue;
                    
                    // Skip if it's likely not a reply (contains certain patterns)
                    if (text.includes('Show this thread') || 
                        text.includes('Retweet') || 
                        text.includes('Like') ||
                        text.includes('Follow') ||
                        text.length < 20) continue;
                    
                    // If it looks like a substantial text, treat it as a potential reply
                    if (text.split(' ').length >= 5 && text.split(' ').length <= 50) {
                        replies.push({
                            id: `simple_reply_${Date.now()}_${replyCount}`,
                            author: `@TwitterUser${replyCount + 1}`,
                            text: text.trim(),
                            timestamp: new Date().toISOString()
                        });
                        
                        replyCount++;
                        if (replyCount >= 10) break; // Limit to 10 replies
                    }
                }
                
                return replies;
            });
            
            console.log(`✅ Simple method found ${replies.length} potential replies`);
            return replies;
            
        } catch (error) {
            console.error('❌ Simple method failed:', error);
            return [];
        }
    }

    // Method to post a reply to a tweet (placeholder for future implementation)
async replyToTweet(tweetUrl, replyText) {
    try {
        console.log('📤 Attempting to reply to tweet:', tweetUrl);
        console.log('📝 Reply text:', replyText);
        
        if (!tweetUrl || !replyText) {
            throw new Error('Tweet URL and reply text are required');
        }
        
        if (!this.page) {
            throw new Error('Browser page not available');
        }
        
        // Navigate to the tweet with multiple strategies
        console.log('🔄 Navigating to tweet...');
        let navigationSuccess = false;
        
        // Strategy 1: Try with load event (faster)
        try {
            await this.page.goto(tweetUrl, { 
                waitUntil: 'load',
                timeout: 30000 
            });
            navigationSuccess = true;
            console.log('✅ Tweet navigation successful with "load"');
        } catch (error) {
            console.log('⚠️ Navigation with "load" failed, trying "domcontentloaded"...');
            
            // Strategy 2: Try with domcontentloaded
            try {
                await this.page.goto(tweetUrl, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 25000 
                });
                navigationSuccess = true;
                console.log('✅ Tweet navigation successful with "domcontentloaded"');
            } catch (error2) {
                console.log('⚠️ Navigation with "domcontentloaded" failed, trying basic navigation...');
                
                // Strategy 3: Basic navigation
                try {
                    await this.page.goto(tweetUrl, { timeout: 20000 });
                    navigationSuccess = true;
                    console.log('✅ Tweet navigation successful with basic goto');
                } catch (error3) {
                    throw new Error(`Failed to navigate to tweet: ${error3.message}`);
                }
            }
        }
        
        if (!navigationSuccess) {
            throw new Error('Failed to navigate to tweet page');
        }
        
        // Wait for page content to load
        console.log('⏳ Waiting for page content...');
        try {
            await this.page.waitForSelector('[data-testid="tweet"], article[role="article"]', { timeout: 15000 });
            console.log('✅ Tweet content loaded');
        } catch (error) {
            console.log('⚠️ Tweet content selector failed, proceeding anyway...');
            await this.page.waitForTimeout(3000);
        }
        
        // Look for reply button with multiple selectors
        console.log('🔍 Looking for reply button...');
        const replySelectors = [
            '[data-testid="reply"]',
            '[aria-label*="Reply"]',
            '[role="button"][aria-label*="reply" i]',
            'div[role="button"]:has-text("Reply")',
            '[data-testid="reply"] div[role="button"]'
        ];
        
        let replyButton = null;
        let usedSelector = '';
        
        for (const selector of replySelectors) {
            try {
                const elements = await this.page.locator(selector).all();
                for (const element of elements) {
                    if (await element.isVisible()) {
                        replyButton = element;
                        usedSelector = selector;
                        break;
                    }
                }
                if (replyButton) break;
            } catch (error) {
                console.log(`⚠️ Reply selector ${selector} failed:`, error.message);
            }
        }
        
        if (!replyButton) {
            throw new Error('Could not find reply button. The tweet might not allow replies or Twitter changed their layout.');
        }
        
        console.log(`✅ Found reply button with selector: ${usedSelector}`);
        
        // Click the reply button
        console.log('👆 Clicking reply button...');
        try {
            await replyButton.click();
            console.log('✅ Reply button clicked');
        } catch (error) {
            throw new Error(`Failed to click reply button: ${error.message}`);
        }
        
        // Wait for reply modal/interface to appear
        console.log('⏳ Waiting for reply interface...');
        await this.page.waitForTimeout(2000);
        
        // Look for reply text area with multiple selectors
        console.log('🔍 Looking for reply text area...');
        const textAreaSelectors = [
            '[data-testid="tweetTextarea_0"]',
            '[data-testid="tweetTextarea_1"]',
            'div[contenteditable="true"][aria-label*="reply" i]',
            'div[contenteditable="true"][aria-label*="Tweet" i]',
            'div[contenteditable="true"][data-testid*="textInput"]',
            'div[role="textbox"][contenteditable="true"]',
            'textarea[placeholder*="reply" i]',
            'div[aria-label*="compose" i][contenteditable="true"]'
        ];
        
        let textArea = null;
        let usedTextSelector = '';
        
        for (const selector of textAreaSelectors) {
            try {
                const elements = await this.page.locator(selector).all();
                for (const element of elements) {
                    if (await element.isVisible()) {
                        textArea = element;
                        usedTextSelector = selector;
                        break;
                    }
                }
                if (textArea) break;
            } catch (error) {
                console.log(`⚠️ Text area selector ${selector} failed:`, error.message);
            }
        }
        
        if (!textArea) {
            throw new Error('Could not find reply text area. Reply interface may not have loaded properly.');
        }
        
        console.log(`✅ Found text area with selector: ${usedTextSelector}`);
        
        // Clear and fill the text area
        console.log('📝 Filling reply text...');
        try {
            // Clear any existing text
            await textArea.click();
            await this.page.waitForTimeout(500);
            await textArea.fill('');
            await this.page.waitForTimeout(500);
            
            // Type the reply text
            await textArea.fill(replyText);
            console.log('✅ Reply text filled');
            
            // Wait a moment for text to register
            await this.page.waitForTimeout(1000);
        } catch (error) {
            throw new Error(`Failed to fill reply text: ${error.message}`);
        }
        
        // Look for post/reply button
        console.log('🔍 Looking for post button...');
        const postButtonSelectors = [
            '[data-testid="tweetButtonInline"]',
            '[data-testid="tweetButton"]',
            'div[role="button"]:has-text("Reply")',
            'div[role="button"]:has-text("Post")',
            '[aria-label*="Reply" i][role="button"]',
            'button:has-text("Reply")',
            '[data-testid*="reply"][data-testid*="Button"]'
        ];
        
        let postButton = null;
        let usedPostSelector = '';
        
        for (const selector of postButtonSelectors) {
            try {
                const elements = await this.page.locator(selector).all();
                for (const element of elements) {
                    if (await element.isVisible() && !(await element.isDisabled())) {
                        postButton = element;
                        usedPostSelector = selector;
                        break;
                    }
                }
                if (postButton) break;
            } catch (error) {
                console.log(`⚠️ Post button selector ${selector} failed:`, error.message);
            }
        }
        
        if (!postButton) {
            throw new Error('Could not find enabled post/reply button. The reply may be too long or there may be an issue with the interface.');
        }
        
        console.log(`✅ Found post button with selector: ${usedPostSelector}`);
        
        // Click the post button
        console.log('📤 Posting reply...');
        try {
            await postButton.click();
            console.log('✅ Post button clicked');
        } catch (error) {
            throw new Error(`Failed to click post button: ${error.message}`);
        }
        
        // Wait for reply to be posted
        console.log('⏳ Waiting for reply confirmation...');
        await this.page.waitForTimeout(3000);
        
        // Check if reply was successful by looking for success indicators or checking if modal closed
        try {
            const modalStillExists = await this.page.locator('[role="dialog"], [data-testid*="modal"]').isVisible().catch(() => false);
            if (!modalStillExists) {
                console.log('✅ Reply modal closed - likely successful');
                return true;
            }
            
            // Look for error messages
            const errorExists = await this.page.locator('[role="alert"], [data-testid*="error"]').isVisible().catch(() => false);
            if (errorExists) {
                const errorText = await this.page.locator('[role="alert"], [data-testid*="error"]').textContent().catch(() => 'Unknown error');
                throw new Error(`Twitter error: ${errorText}`);
            }
            
            console.log('✅ Reply appears to have been posted successfully');
            return true;
            
        } catch (verificationError) {
            console.log('⚠️ Could not verify reply status, but post button was clicked:', verificationError.message);
            return true; // Assume success if we got this far
        }
        
    } catch (error) {
        console.error('❌ Error posting reply:', error.message);
        
        // Provide helpful error context
        if (error.message.includes('navigation') || error.message.includes('navigate')) {
            console.log('💡 NAVIGATION HELP:');
            console.log('  - Check if the tweet URL is valid');
            console.log('  - Ensure you have internet connection');
            console.log('  - Try refreshing the bot connection');
        } else if (error.message.includes('reply button')) {
            console.log('💡 REPLY BUTTON HELP:');
            console.log('  - This tweet might not allow replies');
            console.log('  - Account might be private or restricted');
            console.log('  - Twitter may have changed their interface');
        } else if (error.message.includes('text area')) {
            console.log('💡 TEXT AREA HELP:');
            console.log('  - Reply interface may not have loaded');
            console.log('  - Try again in a few seconds');
            console.log('  - Check if you\'re still logged in');
        }
        
        // Re-throw the error so it can be caught by the dashboard
        throw error;
    }
}
}

// Test function
async function test2FALogin() {
    // ⚠️ REPLACE WITH YOUR CREDENTIALS
    const TWITTER_USERNAME = process.env.TWITTER_USERNAME || 'your-username';
    const TWITTER_PASSWORD = process.env.TWITTER_PASSWORD || 'your-password';
    
    const bot = new TwitterBot2FA();
    
    try {
        console.log('🤖 Starting Twitter Bot with 2FA support...');
        console.log('⚠️ Make sure to update your credentials above!\n');
        
        await bot.init();
        
        console.log('🔐 Attempting login with 2FA support...');
        const loginSuccess = await bot.loginWith2FA(TWITTER_USERNAME, TWITTER_PASSWORD);
        
        if (loginSuccess) {
            // Store username for profile navigation
            await bot.storeUsername(TWITTER_USERNAME);
            
            console.log('\n🎉 Login successful! Testing tweet retrieval...');
            
            const tweets = await bot.getMyTweets(3);
            
            if (tweets.length > 0) {
                console.log('\n📝 Your recent tweets:');
                tweets.forEach((tweet, i) => {
                    console.log(`${i + 1}. ${tweet.text}`);
                    console.log(`   Time: ${tweet.time}`);
                    console.log(`   URL: ${tweet.url}\n`);
                });
                
                console.log('✅ Bot is working perfectly with 2FA!');
                
                // Test comment retrieval on first tweet
                if (tweets[0] && tweets[0].url) {
                    console.log('\n🔍 Testing comment retrieval...');
                    const comments = await bot.getCommentsForTweet(tweets[0].url);
                    console.log(`📋 Found ${comments.length} comments on first tweet`);
                }
            }
        } else {
            console.log('❌ Login failed');
        }
        
        // Keep browser open for 30 seconds
        setTimeout(async () => {
            await bot.close();
        }, 60000);
        
    } catch (error) {
        console.error('❌ Error:', error);
        await bot.close();
    }
}

module.exports = { TwitterBot2FA };

// Run if this file is executed directly
if (require.main === module) {
    test2FALogin().catch(console.error);
}