import { PrismaPg } from '@prisma/adapter-pg';
import { ListingType, Prisma, PrismaClient } from '@prisma/client';

const { resolveDatabaseUrl } = require('../scripts/database-url') as {
  resolveDatabaseUrl: () => string;
};

interface SeedAgent {
  name: string;
  email: string;
  phone: string;
}

interface SeedListing {
  title: string;
  description: string;
  price: string;
  type: ListingType;
  bedrooms: number;
  latitude: number;
  longitude: number;
  agentEmail: string;
}

const AGENTS: SeedAgent[] = [
  { name: 'Ada Obi', email: 'ada.obi@lagos-homes.example', phone: '+2348031234567' },
  { name: 'Tunde Bakare', email: 'tunde.bakare@lagos-homes.example', phone: '+2348059876543' },
  { name: 'Grace Mensah', email: 'grace.mensah@accra-listings.example', phone: '+233244123456' },
];

// Coordinates are real neighbourhoods: Lekki/Ikoyi/Yaba cluster around
// 6.43-6.52N 3.35-3.47E, Abuja (9.05N 7.49E) is ~600 km away so radius
// searches have something to exclude.
const LISTINGS: SeedListing[] = [
  {
    title: '3 bedroom flat in Ikoyi',
    description: 'Renovated flat with a private garden and 24/7 power.',
    price: '4500.00',
    type: 'RENT',
    bedrooms: 3,
    latitude: 6.4521,
    longitude: 3.4345,
    agentEmail: 'ada.obi@lagos-homes.example',
  },
  {
    title: '4 bedroom duplex in Lekki Phase 1',
    description: 'Duplex with a rooftop terrace close to the toll gate.',
    price: '85000000.00',
    type: 'SALE',
    bedrooms: 4,
    latitude: 6.4412,
    longitude: 3.4721,
    agentEmail: 'ada.obi@lagos-homes.example',
  },
  {
    title: 'Studio shortlet in Victoria Island',
    description: 'Fully serviced studio, nightly rate.',
    price: '120.00',
    type: 'SHORTLET',
    bedrooms: 0,
    latitude: 6.4281,
    longitude: 3.4219,
    agentEmail: 'tunde.bakare@lagos-homes.example',
  },
  {
    title: '2 bedroom flat in Yaba',
    description: 'Walking distance to the tech hub and metro line.',
    price: '1800.00',
    type: 'RENT',
    bedrooms: 2,
    latitude: 6.5095,
    longitude: 3.3711,
    agentEmail: 'tunde.bakare@lagos-homes.example',
  },
  {
    title: '5 bedroom detached house in Maitama',
    description: 'Large family house with a swimming pool.',
    price: '250000000.00',
    type: 'SALE',
    bedrooms: 5,
    latitude: 9.0765,
    longitude: 7.4896,
    agentEmail: 'grace.mensah@accra-listings.example',
  },
  {
    title: '1 bedroom apartment in Surulere',
    description: 'Compact apartment, freshly painted.',
    price: '950.00',
    type: 'RENT',
    bedrooms: 1,
    latitude: 6.5005,
    longitude: 3.3543,
    agentEmail: 'grace.mensah@accra-listings.example',
  },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: resolveDatabaseUrl(), max: 2 }),
  });

  try {
    const agentIds = new Map<string, string>();

    for (const agent of AGENTS) {
      const record = await prisma.agent.upsert({
        where: { email: agent.email },
        update: { name: agent.name, phone: agent.phone },
        create: agent,
      });
      agentIds.set(agent.email, record.id);
    }

    if ((await prisma.listing.count()) > 0) {
      console.log('Listings already present, skipping listing seed');
      return;
    }

    await prisma.listing.createMany({
      data: LISTINGS.map((listing) => ({
        title: listing.title,
        description: listing.description,
        price: new Prisma.Decimal(listing.price),
        type: listing.type,
        bedrooms: listing.bedrooms,
        latitude: listing.latitude,
        longitude: listing.longitude,
        agentId: agentIds.get(listing.agentEmail)!,
      })),
    });

    console.log(`Seeded ${AGENTS.length} agents and ${LISTINGS.length} listings`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
