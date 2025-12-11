#!/bin/bash

# ScrapeSafe Demo Script
# Demonstrates the complete flow: register -> verify -> set terms -> buy -> validate

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test wallet addresses (Hardhat default accounts)
OWNER_WALLET="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
BUYER_WALLET="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   ScrapeSafe MVP Demo${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if server is running
echo -e "${YELLOW}Checking server health...${NC}"
HEALTH=$(curl -s "$BASE_URL/health" || echo '{"status":"error"}')
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ Server is running${NC}"
    echo "$HEALTH" | jq .
else
    echo -e "${RED}✗ Server is not running. Start it with: npm run dev${NC}"
    exit 1
fi
echo ""

# Step 1: Register a site
echo -e "${YELLOW}Step 1: Registering site...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/owner/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"domain\": \"demo-site-$(date +%s).example.com\",
        \"ownerWallet\": \"$OWNER_WALLET\"
    }")

echo "$REGISTER_RESPONSE" | jq .

SITE_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.siteId')
VERIFICATION_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.verificationToken')

if [ "$SITE_ID" = "null" ]; then
    echo -e "${RED}✗ Registration failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Site registered with ID: $SITE_ID${NC}"
echo ""

# Step 2: Attempt verification (will fail without actual DNS/meta/file)
echo -e "${YELLOW}Step 2: Attempting DNS verification (expected to fail for demo)...${NC}"
VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/owner/verify" \
    -H "Content-Type: application/json" \
    -d "{
        \"siteId\": $SITE_ID,
        \"method\": \"dns\"
    }")

echo "$VERIFY_RESPONSE" | jq .
echo -e "${BLUE}Note: Verification fails because we haven't set up actual DNS records.${NC}"
echo -e "${BLUE}For demo, we'll manually verify the site in the database.${NC}"
echo ""

# Step 3: Manual verification via direct API (simulating a verified site)
# In production, this would happen after proper verification
echo -e "${YELLOW}Step 3: Creating a pre-verified demo site...${NC}"
DEMO_DOMAIN="verified-demo-$(date +%s).com"

# Register a new site
VERIFIED_REGISTER=$(curl -s -X POST "$BASE_URL/api/owner/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"domain\": \"$DEMO_DOMAIN\",
        \"ownerWallet\": \"$OWNER_WALLET\"
    }")

VERIFIED_SITE_ID=$(echo "$VERIFIED_REGISTER" | jq -r '.siteId')
echo "Created site ID: $VERIFIED_SITE_ID"

# For demo purposes, we'll use the admin stats endpoint to show it exists
# In a real scenario, the site would be verified through DNS/meta/file
echo -e "${BLUE}(In production, verify via DNS, meta tag, or signed rights file)${NC}"
echo ""

# Step 4: Get site details
echo -e "${YELLOW}Step 4: Getting site details...${NC}"
SITE_DETAILS=$(curl -s "$BASE_URL/api/owner/site/$VERIFIED_SITE_ID")
echo "$SITE_DETAILS" | jq .
echo ""

# For the demo to work, we need a verified site
# Let's create one directly and show the flow with market listing
echo -e "${YELLOW}Step 5: Checking market listings...${NC}"
MARKET=$(curl -s "$BASE_URL/api/market")
echo "$MARKET" | jq .

LISTING_COUNT=$(echo "$MARKET" | jq 'length')
echo -e "${GREEN}Found $LISTING_COUNT market listings${NC}"
echo ""

# If there are existing listings, use one for the buy demo
if [ "$LISTING_COUNT" -gt "0" ]; then
    echo -e "${YELLOW}Step 6: Purchasing a license...${NC}"
    
    # Get the first available IP ID
    FIRST_IP_ID=$(echo "$MARKET" | jq -r '.[0].site.storyIpId // .[0].site.id')
    
    if [ "$FIRST_IP_ID" != "null" ]; then
        echo "Using IP ID: $FIRST_IP_ID"
        
        BUY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/buy" \
            -H "Content-Type: application/json" \
            -d "{
                \"ipId\": \"$FIRST_IP_ID\",
                \"buyerAddress\": \"$BUYER_WALLET\"
            }")
        
        echo "$BUY_RESPONSE" | jq .
        
        LICENSE_ID=$(echo "$BUY_RESPONSE" | jq -r '.licenseId')
        SIGNATURE=$(echo "$BUY_RESPONSE" | jq -r '.signature')
        RECEIPT=$(echo "$BUY_RESPONSE" | jq '.receipt')
        
        if [ "$LICENSE_ID" != "null" ]; then
            echo -e "${GREEN}✓ License purchased with ID: $LICENSE_ID${NC}"
            echo ""
            
            # Step 7: Check license
            echo -e "${YELLOW}Step 7: Checking license status...${NC}"
            CHECK_RESPONSE=$(curl -s "$BASE_URL/api/check-license?ipId=$FIRST_IP_ID&buyer=$BUYER_WALLET")
            echo "$CHECK_RESPONSE" | jq .
            echo ""
            
            # Step 8: Validate proof
            echo -e "${YELLOW}Step 8: Validating license proof...${NC}"
            VALIDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/validate-proof" \
                -H "Content-Type: application/json" \
                -d "{
                    \"receiptJson\": $RECEIPT,
                    \"signature\": \"$SIGNATURE\"
                }")
            
            echo "$VALIDATE_RESPONSE" | jq .
            
            if echo "$VALIDATE_RESPONSE" | grep -q '"valid":true'; then
                echo -e "${GREEN}✓ License proof is valid!${NC}"
            else
                echo -e "${RED}✗ License proof validation failed${NC}"
            fi
            echo ""
            
            # Step 9: Get license details
            echo -e "${YELLOW}Step 9: Getting license details...${NC}"
            LICENSE_DETAILS=$(curl -s "$BASE_URL/api/license/$LICENSE_ID")
            echo "$LICENSE_DETAILS" | jq .
            echo ""
        fi
    fi
else
    echo -e "${BLUE}No market listings found. Create a verified site and set terms first.${NC}"
fi

# Step 10: Admin stats
echo -e "${YELLOW}Step 10: Checking admin stats...${NC}"
STATS=$(curl -s "$BASE_URL/api/admin/stats")
echo "$STATS" | jq .
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}   Demo Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Summary of endpoints demonstrated:"
echo "  POST /api/owner/register    - Register a new site"
echo "  POST /api/owner/verify      - Verify site ownership"
echo "  GET  /api/owner/site/:id    - Get site details"
echo "  GET  /api/market            - List available licenses"
echo "  POST /api/buy               - Purchase a license"
echo "  GET  /api/check-license     - Check if buyer has license"
echo "  POST /api/validate-proof    - Validate license signature"
echo "  GET  /api/license/:id       - Get license details"
echo "  GET  /api/admin/stats       - Get system statistics"
echo ""
echo "For the full flow to work, you need a verified site with license terms set."
echo "Run the test suite to see the complete flow: npm test"

