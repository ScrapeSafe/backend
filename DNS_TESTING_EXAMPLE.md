# DNS Configuration Example for Testing

This guide shows you how to add the required DNS TXT record to test domain verification with ScrapeSafe.

## Overview

ScrapeSafe checks for a TXT record at `_scrapesafe.{your-domain}` containing your verification token.

## Step 1: Register Your Domain

First, register your domain with the API to get a verification token:

```bash
curl -X POST http://localhost:3000/api/owner/register \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "mezopay.xyz",
    "ownerWallet": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  }'
```

The response will include a `verificationToken` like:
```
scrapesafe-550e8400-e29b-41d4-a716-446655440000
```

## Step 2: Add DNS TXT Record

Add a TXT record with the following details:

### Record Details:
- **Type**: `TXT`
- **Name/Host**: `_scrapesafe` (or `_scrapesafe.example.com` depending on your DNS provider)
- **Value/Content**: Your verification token (e.g., `scrapesafe-550e8400-e29b-41d4-a716-446655440000`)
- **TTL**: Any value (default is fine, e.g., 3600)

### Examples by DNS Provider:

#### Cloudflare
1. Go to your domain's DNS settings
2. Click "Add record"
3. Select **Type**: `TXT`
4. **Name**: `_scrapesafe`
5. **Content**: `scrapesafe-550e8400-e29b-41d4-a716-446655440000`
6. **TTL**: Auto (or 3600)
7. Click "Save"

#### AWS Route 53
1. Go to Route 53 → Hosted zones → Select your domain
2. Click "Create record"
3. **Record name**: `_scrapesafe`
4. **Record type**: `TXT`
5. **Value**: `scrapesafe-550e8400-e29b-41d4-a716-446655440000`
6. Click "Create records"

#### Google Domains / Google Cloud DNS
1. Go to DNS settings
2. Click "Custom records" → "Manage custom records"
3. Click "Create new record"
4. **Name**: `_scrapesafe`
5. **Type**: `TXT`
6. **Data**: `scrapesafe-550e8400-e29b-41d4-a716-446655440000`
7. **TTL**: 3600
8. Click "Add"

#### Namecheap
1. Go to Domain List → Manage → Advanced DNS
2. Click "Add New Record"
3. **Type**: `TXT Record`
4. **Host**: `_scrapesafe`
5. **Value**: `scrapesafe-550e8400-e29b-41d4-a716-446655440000`
6. **TTL**: Automatic (or 3600)
7. Click the checkmark to save

#### GoDaddy
1. Go to DNS Management
2. Click "Add" in the Records section
3. **Type**: `TXT`
4. **Name**: `_scrapesafe`
5. **Value**: `scrapesafe-550e8400-e29b-41d4-a716-446655440000`
6. **TTL**: 1 hour
7. Click "Save"

#### DigitalOcean
1. Go to Networking → Domains → Select your domain
2. Click "Add record"
3. **Type**: `TXT`
4. **Hostname**: `_scrapesafe`
5. **Value**: `scrapesafe-550e8400-e29b-41d4-a716-446655440000`
6. **TTL**: 3600
7. Click "Create Record"

## Step 3: Verify DNS Propagation

Wait a few minutes for DNS propagation (usually 1-5 minutes, can take up to 48 hours in rare cases).

You can check if the record is live using:

```bash
# Using dig
dig TXT _scrapesafe.example.com

# Using nslookup
nslookup -type=TXT _scrapesafe.example.com

# Using host
host -t TXT _scrapesafe.example.com
```

Expected output should include your verification token:
```
_scrapesafe.example.com. 3600 IN TXT "scrapesafe-550e8400-e29b-41d4-a716-446655440000"
```

## Step 4: Verify with API

Once the DNS record is propagated, verify your domain:

```bash
curl -X POST http://localhost:3000/api/owner/verify \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": 1,
    "method": "dns"
  }'
```

Expected successful response:
```json
{
  "ok": true,
  "details": "Found valid token in TXT record at _scrapesafe.example.com",
  "storyIpId": "story:local:1",
  "storySimulated": true
}
```

## Testing Locally (Without Real DNS)

If you want to test without setting up real DNS records, you can:

### Option 1: Use a Local DNS Server
Set up a local DNS server (like `dnsmasq`) and configure it to return your test TXT record.

### Option 2: Use /etc/hosts (Limited)
Note: `/etc/hosts` only works for A/AAAA records, not TXT records. You'll need a local DNS server.

### Option 3: Use a Test Domain Service
Use a service like:
- `nip.io` (but this won't work for TXT records)
- A free subdomain from a DNS provider that supports TXT records
- A test domain you own

### Option 4: Mock DNS in Tests
For automated testing, you can mock the DNS lookup in your test files (see `tests/api.test.ts`).

## Example Complete Flow

```bash
# 1. Register domain
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/owner/register \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "ownerWallet": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  }')

# Extract siteId and token
SITE_ID=$(echo $REGISTER_RESPONSE | jq -r '.siteId')
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.verificationToken')

echo "Site ID: $SITE_ID"
echo "Token: $TOKEN"
echo "Add this TXT record: _scrapesafe.example.com -> $TOKEN"

# 2. Wait for DNS propagation (you add the record manually)
echo "Waiting 60 seconds for DNS propagation..."
sleep 60

# 3. Verify
curl -X POST http://localhost:3000/api/owner/verify \
  -H "Content-Type: application/json" \
  -d "{
    \"siteId\": $SITE_ID,
    \"method\": \"dns\"
  }"
```

## Troubleshooting

### "No TXT record found"
- Wait longer for DNS propagation (can take up to 48 hours)
- Double-check the record name is exactly `_scrapesafe` (with underscore)
- Verify the record type is `TXT`, not `A` or `CNAME`
- Check for typos in the token value

### "Token not found"
- Ensure the TXT record value exactly matches the verification token
- Some DNS providers add quotes automatically - that's fine
- Check if there are multiple TXT records and the token is in one of them

### DNS Lookup Failed
- Verify your domain's nameservers are configured correctly
- Check if the domain is accessible from the server running the backend
- Ensure the backend server can resolve DNS (check network connectivity)

## Alternative Verification Methods

If DNS doesn't work for you, you can also verify using:

1. **Meta Tag**: Add `<meta name="scrapesafe" content="YOUR_TOKEN">` to your HTML `<head>`
2. **File**: Place a signed JSON file at `https://yourdomain.com/.well-known/scrapesafe.json`

See the API response from `/api/owner/register` for detailed instructions on these methods.

