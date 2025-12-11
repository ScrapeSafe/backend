# ScrapeSafe Backend MVP

A Node.js (Express) API that lets website owners register their site as a Story IP asset, verify ownership, publish rights.json, set scrape/training license terms, and sell licenses.

## 🎯 Features

### Priority 1-4 (Core MVP) ✅
- **Site Registration**: Register domains with wallet ownership
- **Ownership Verification**: DNS TXT, meta tag, or signed rights file verification
- **License Terms**: Set pricing models (PER_SCRAPE, SUBSCRIPTION, FLAT)
- **License Purchase**: Buy licenses with server-signed receipts
- **License Validation**: Cryptographic proof verification

### Priority 5-8 (Stretch) 🚧
- **IPFS Integration**: Pin receipts to IPFS via web3.storage (mocked if no token)
- **Story Protocol**: Simulated IP registration (real SDK integration TODO)
- **Admin Routes**: License revocation and statistics
- **Redis Cache**: Using in-memory cache for MVP

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- npm or yarn

### Installation

```bash
# Clone and install dependencies
npm install

# Copy environment file
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Start development server
npm run dev
```

The server will start at `http://localhost:3000`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `DATABASE_URL` | Yes | SQLite database path |
| `SERVER_SIGNER_PRIVATE_KEY` | Yes | Private key for signing license receipts |
| `WEB3_STORAGE_TOKEN` | No | IPFS pinning (mocked if not set) |
| `CHAIN_RPC_URL` | No | Blockchain RPC URL |
| `STORY_SDK_KEY` | No | Story Protocol SDK key (simulated if not set) |

## 📚 API Endpoints

### Owner Routes

#### POST /api/owner/register
Register a new site for verification.

```bash
curl -X POST http://localhost:3000/api/owner/register \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "ownerWallet": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  }'
```

Response:
```json
{
  "siteId": 1,
  "verificationToken": "scrapesafe-abc123...",
  "instructions": {
    "dns": "Add a TXT record at _scrapesafe.example.com with value: scrapesafe-abc123...",
    "meta": "Add to your HTML <head>: <meta name=\"scrapesafe\" content=\"scrapesafe-abc123...\">",
    "file": "Place a signed JSON file at https://example.com/.well-known/scrapesafe.json"
  }
}
```

#### POST /api/owner/verify
Verify site ownership.

```bash
curl -X POST http://localhost:3000/api/owner/verify \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": 1,
    "method": "dns"
  }'
```

Methods: `dns`, `meta`, `file`

#### POST /api/owner/set-terms
Set license terms for a verified site.

```bash
curl -X POST http://localhost:3000/api/owner/set-terms \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": 1,
    "allowedActions": ["SCRAPE", "TRAIN"],
    "priceModel": "FLAT",
    "pricePerUnit": 100,
    "priceToken": "USDC",
    "termsUri": "https://example.com/terms"
  }'
```

Price models: `PER_SCRAPE`, `SUBSCRIPTION`, `FLAT`

#### GET /api/owner/site/:siteId
Get site details with terms and licenses.

```bash
curl http://localhost:3000/api/owner/site/1
```

### Market Routes

#### GET /api/market
List all available licenses.

```bash
curl http://localhost:3000/api/market
```

#### GET /api/asset/:ipId
Get asset details by Story IP ID or site ID.

```bash
curl http://localhost:3000/api/asset/story:local:1
# or
curl http://localhost:3000/api/asset/1
```

### License Routes

#### POST /api/buy
Purchase a license.

```bash
curl -X POST http://localhost:3000/api/buy \
  -H "Content-Type: application/json" \
  -d '{
    "ipId": "story:local:1",
    "buyerAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  }'
```

Response:
```json
{
  "licenseId": 1,
  "receipt": {
    "licenseId": 1,
    "ipId": "story:local:1",
    "buyerAddress": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "issuer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "issuedAt": "2024-01-01T00:00:00.000Z",
    ...
  },
  "signature": "0x...",
  "proofUri": "ipfs://bafymock..."
}
```

#### GET /api/license/:licenseId
Get license details.

```bash
curl http://localhost:3000/api/license/1
```

#### GET /api/check-license
Fast license check with caching.

```bash
curl "http://localhost:3000/api/check-license?ipId=story:local:1&buyer=0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
```

#### POST /api/validate-proof
Validate a license receipt signature.

```bash
curl -X POST http://localhost:3000/api/validate-proof \
  -H "Content-Type: application/json" \
  -d '{
    "receiptJson": {...},
    "signature": "0x..."
  }'
```

### Admin Routes (Stretch)

#### POST /api/admin/revoke-license
Revoke a license.

```bash
curl -X POST http://localhost:3000/api/admin/revoke-license \
  -H "Content-Type: application/json" \
  -d '{
    "licenseId": 1,
    "reason": "Violation of terms"
  }'
```

#### GET /api/admin/stats
Get system statistics.

```bash
curl http://localhost:3000/api/admin/stats
```

## 🔐 Signature Verification

### Owner Rights File (.well-known/scrapesafe.json)

Owners must sign a rights file with their wallet:

```json
{
  "domain": "example.com",
  "owner": "0x...",
  "token": "scrapesafe-abc123...",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "signature": "0x..."
}
```

The signature is created using `personal_sign` (EIP-191) on the canonicalized JSON (keys sorted alphabetically).

### Server-Issued License Receipts

License receipts are signed by the server using `SERVER_SIGNER_PRIVATE_KEY`. Verification:

```javascript
import { ethers } from 'ethers';

// Canonicalize the receipt (sort keys)
const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());

// Recover signer
const signer = ethers.verifyMessage(canonical, signature);

// Compare with server's public address
const isValid = signer === serverAddress;
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

## 📜 Demo Script

Run the demo script to see the full flow:

```bash
# Make sure the server is running
npm run dev

# In another terminal
npm run demo
# or
bash scripts/demo.sh
```

## 📁 Project Structure

```
scrapesafe-backend/
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── db/
│   │   └── prisma.ts      # Prisma client
│   ├── routes/
│   │   ├── owner.ts       # Owner registration & verification
│   │   ├── market.ts      # Market listings & asset lookup
│   │   ├── buy.ts         # License purchase
│   │   ├── verify.ts      # License validation
│   │   └── admin.ts       # Admin operations
│   ├── services/
│   │   ├── signer.ts      # Cryptographic signing
│   │   ├── dnsCheck.ts    # DNS TXT verification
│   │   ├── metaCheck.ts   # Meta tag verification
│   │   ├── rightsVerify.ts # Rights file verification
│   │   ├── ipfs.ts        # IPFS pinning
│   │   ├── story.ts       # Story Protocol integration
│   │   └── cache.ts       # In-memory cache
│   ├── utils/
│   │   └── stableStringify.ts  # Deterministic JSON
│   ├── workers/
│   │   └── pinWorker.ts   # Background IPFS pinning
│   └── index.ts           # Express app
├── tests/
│   ├── setup.ts           # Test configuration
│   ├── api.test.ts        # API integration tests
│   └── signer.test.ts     # Signer unit tests
├── scripts/
│   └── demo.sh            # Demo script
├── .env.example           # Environment template
├── jest.config.js         # Jest configuration
├── package.json
├── tsconfig.json
└── README.md
```

## 🗺️ Roadmap

### Completed (MVP)
- [x] Site registration and verification
- [x] License terms configuration
- [x] License purchase with signed receipts
- [x] Signature validation
- [x] In-memory caching
- [x] Admin statistics

### Stretch Goals
- [ ] Real IPFS integration (web3.storage)
- [ ] Story Protocol SDK integration
- [ ] On-chain license registration
- [ ] Token transfer integration
- [ ] Rate limiting
- [ ] Authentication middleware
- [ ] Dockerfile

## 📝 License

MIT
