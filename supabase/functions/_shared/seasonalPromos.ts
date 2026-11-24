/**
 * Live seasonal promo rows for server ingest (generated from src/lib/data/seasonalPromos.ts).
 * Regenerate: npx tsx scripts/export-seasonal-ingest.mjs
 */
export interface SeasonalIngestRow {
  id: string
  title: string
  url: string
  eligibility: 'CA' | 'US' | 'NA'
  tags: string[]
  requirements: string[]
  prizeValue?: number
  expiryDate?: string
  description?: string
}

export const SEASONAL_INGEST_ROWS: SeasonalIngestRow[] = [
  {
    "id": "timhortons-app-ongoing",
    "title": "Tim Hortons App — Offers & Contests Hub",
    "url": "https://www.timhortons.ca/tims-rewards",
    "eligibility": "CA",
    "tags": [
      "Daily",
      "⚡ Easy Entry"
    ],
    "requirements": [],
    "prizeValue": 500,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Year-round Tims Rewards / app hub — check for rotating digital dailies and co-promos (e.g. NHL Heritage Classic)."
  },
  {
    "id": "starbucks-ca-rewards",
    "title": "Starbucks Rewards Canada — Contests & Stars",
    "url": "https://www.starbucks.ca/rewards",
    "eligibility": "CA",
    "tags": [
      "Weekly",
      "⚡ Easy Entry"
    ],
    "requirements": [],
    "prizeValue": 1000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Starbucks Rewards hub; seasonal Stars challenges and partner giveaways appear here."
  },
  {
    "id": "aw-buddy-ca",
    "title": "A&W Canada Contests & Buddy Burger Promos",
    "url": "https://web.aw.ca/en/our-commitment",
    "eligibility": "CA",
    "tags": [
      "Weekly"
    ],
    "requirements": [],
    "prizeValue": 500,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "A&W Canada rotates regional contests; check site/app for live entry forms."
  },
  {
    "id": "pc-optimum-contests",
    "title": "PC Optimum — Contests & Offers",
    "url": "https://www.pcoptimum.ca/",
    "eligibility": "CA",
    "tags": [
      "Weekly",
      "⚡ Easy Entry"
    ],
    "requirements": [],
    "prizeValue": 2000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Loblaw / PC Optimum member contests and point sweeps (rotating)."
  },
  {
    "id": "scene-plus-contests",
    "title": "Scene+ Contests & Experiences",
    "url": "https://www.sceneplus.ca/en-ca/contests",
    "eligibility": "CA",
    "tags": [
      "Weekly",
      "⚡ Easy Entry"
    ],
    "requirements": [],
    "prizeValue": 5000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Scene+ member contests (movies, sports, travel). URL may redirect if path changes."
  },
  {
    "id": "shoppers-beauty-contests",
    "title": "Shoppers Drug Mart / Beauty Boutique Contests",
    "url": "https://www.shoppersdrugmart.ca/",
    "eligibility": "CA",
    "tags": [
      "Weekly"
    ],
    "requirements": [],
    "prizeValue": 1000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "SDM / Beauty Boutique rotating giveaways — often purchase or points related."
  },
  {
    "id": "stellantis-ram-sweeps",
    "title": "RAM / Stellantis Contests & Truck Giveaways",
    "url": "https://www.ramtrucks.com/",
    "eligibility": "NA",
    "tags": [
      "High Value",
      "🧾 Purchase",
      "Buy to Enter"
    ],
    "requirements": [
      "Purchase Required"
    ],
    "prizeValue": 80000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "OEM truck giveaways (RAM, Jeep, etc.) are episodic. Also watch RedFlagDeals Contests + Sweepstakes Lovers Daily for CA/US drops. No stable public RSS — curated hub only."
  },
  {
    "id": "ford-oem-hub",
    "title": "Ford Contests & Sweepstakes Hub",
    "url": "https://www.ford.com/support/how-tos/owner-services-and-features/owner-services/sweepstakes-and-contests/",
    "eligibility": "NA",
    "tags": [
      "High Value"
    ],
    "requirements": [],
    "prizeValue": 50000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Ford owner-services contests page. Live giveaways rotate; also check ford.ca for Canadian eligibility."
  },
  {
    "id": "gm-chevy-oem-hub",
    "title": "Chevrolet / GM Contests Hub",
    "url": "https://www.chevrolet.com/",
    "eligibility": "NA",
    "tags": [
      "High Value"
    ],
    "requirements": [],
    "prizeValue": 50000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "GM / Chevy brand hub — vehicle and experience sweeps are episodic. Confirm CA/US rules per promo."
  },
  {
    "id": "toyota-oem-hub",
    "title": "Toyota Contests & Owners Hub",
    "url": "https://www.toyota.com/",
    "eligibility": "NA",
    "tags": [
      "High Value"
    ],
    "requirements": [],
    "prizeValue": 45000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Toyota / Toyota.ca rotating owner and partner giveaways. No public RSS."
  },
  {
    "id": "honda-oem-hub",
    "title": "Honda Contests Hub",
    "url": "https://automobiles.honda.com/",
    "eligibility": "NA",
    "tags": [
      "High Value"
    ],
    "requirements": [],
    "prizeValue": 45000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Honda automobiles hub — episodic contests; check honda.ca for Canadian promos."
  },
  {
    "id": "hyundai-oem-hub",
    "title": "Hyundai Contests & Offers Hub",
    "url": "https://www.hyundaiusa.com/us/en",
    "eligibility": "NA",
    "tags": [
      "High Value"
    ],
    "requirements": [],
    "prizeValue": 40000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Hyundai USA / Hyundai Canada offer hubs — vehicle giveaways are short-window."
  },
  {
    "id": "nike-member-sweeps",
    "title": "Nike Membership Sweepstakes Hub",
    "url": "https://www.nike.com/help/a/nike-membership-sweepstakes",
    "eligibility": "NA",
    "tags": [
      "Weekly",
      "⚡ Easy Entry"
    ],
    "requirements": [],
    "prizeValue": 2000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Nike Member sweepstakes rules hub. Individual draws rotate; SNKRS drops are not contests."
  },
  {
    "id": "apple-beats-promo-hub",
    "title": "Apple / Beats Promotions Hub",
    "url": "https://www.beatsbydre.com/",
    "eligibility": "NA",
    "tags": [
      "Weekly"
    ],
    "requirements": [],
    "prizeValue": 1000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Beats / Apple giveaways are episodic and rarely RSS-listed. Newsroom RSS is product news only — use this hub + US aggregators."
  },
  {
    "id": "canadiantire-promos",
    "title": "Canadian Tire Promotions & Contests",
    "url": "https://www.canadiantire.ca/en/promotions.html",
    "eligibility": "CA",
    "tags": [
      "Weekly",
      "🧾 Purchase",
      "Buy to Enter"
    ],
    "requirements": [
      "Purchase Required"
    ],
    "prizeValue": 5000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Canadian Tire Triangle promotions hub — contests rotate seasonally."
  },
  {
    "id": "metro-ca-contests",
    "title": "Metro Canada Contests & Offers",
    "url": "https://www.metro.ca/",
    "eligibility": "CA",
    "tags": [
      "Weekly",
      "🧾 Purchase",
      "Buy to Enter"
    ],
    "requirements": [
      "Purchase Required"
    ],
    "prizeValue": 2000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Metro Quebec/Ontario grocery co-promos (often CPG). Also appears on RFD Contests."
  },
  {
    "id": "sobeys-contests",
    "title": "Sobeys Contests & Flyer Promos",
    "url": "https://www.sobeys.com/",
    "eligibility": "CA",
    "tags": [
      "Weekly",
      "🧾 Purchase",
      "Buy to Enter"
    ],
    "requirements": [
      "Purchase Required"
    ],
    "prizeValue": 2000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Sobeys / Safeway Canada rotating grocery contests."
  },
  {
    "id": "rogers-contests-hub",
    "title": "Rogers Contests Hub",
    "url": "https://www.rogers.com/",
    "eligibility": "CA",
    "tags": [
      "Weekly"
    ],
    "requirements": [],
    "prizeValue": 5000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Rogers member / public contests rotate; no stable contests URL — check homepage + RFD."
  },
  {
    "id": "bell-contests-hub",
    "title": "Bell Contests Hub",
    "url": "https://www.bell.ca/",
    "eligibility": "CA",
    "tags": [
      "Weekly"
    ],
    "requirements": [],
    "prizeValue": 5000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "Bell Canada episodic contests (TV/internet/mobile). Often posted to RFD Contests."
  },
  {
    "id": "telus-contests-hub",
    "title": "TELUS Contests Hub",
    "url": "https://www.telus.com/",
    "eligibility": "CA",
    "tags": [
      "Weekly"
    ],
    "requirements": [],
    "prizeValue": 5000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "TELUS rotating member giveaways — confirm live forms on telus.com."
  },
  {
    "id": "rbc-contests-hub",
    "title": "RBC Contests & Offers",
    "url": "https://www.rbcroyalbank.com/",
    "eligibility": "CA",
    "tags": [
      "Weekly"
    ],
    "requirements": [],
    "prizeValue": 10000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "RBC / Avion episodic contests for clients — no public RSS."
  },
  {
    "id": "td-contests-hub",
    "title": "TD Contests & Offers",
    "url": "https://www.td.com/ca/en/personal-banking",
    "eligibility": "CA",
    "tags": [
      "Weekly"
    ],
    "requirements": [],
    "prizeValue": 10000,
    "expiryDate": "2026-12-31T23:59:59-05:00",
    "description": "TD Canada Trust rotating contests and sports experiences."
  }
]
