import prisma from './config/prisma';

async function main() {
  console.log('🌱 Seeding database...');

  // Clean old data in order (due to FK constraints)
  await prisma.matchStat.deleteMany({});
  await prisma.matchLineup.deleteMany({});
  await prisma.match.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.club.deleteMany({});
  await prisma.stadium.deleteMany({});
  await prisma.tournament.deleteMany({});

  // 1. Create Tournament
  const tournament = await prisma.tournament.create({
    data: { name: 'Super Liga 2026' }
  });
  console.log(`Tournament created: ${tournament.name} (${tournament.id})`);

  // 2. Create Stadiums
  const stadiumA = await prisma.stadium.create({
    data: { name: 'Estadio Nacional' }
  });
  const stadiumB = await prisma.stadium.create({
    data: { name: 'Estadio Monumental' }
  });
  console.log(`Stadiums created: ${stadiumA.name}, ${stadiumB.name}`);

  // 3. Create Clubs
  const clubHome = await prisma.club.create({
    data: {
      name: 'Real Madrid F.C.',
      tacticalSystem: '4-3-3',
      stadiumId: stadiumA.id
    }
  });
  const clubAway = await prisma.club.create({
    data: {
      name: 'Barcelona F.C.',
      tacticalSystem: '3-5-2',
      stadiumId: stadiumB.id
    }
  });
  console.log(`Clubs created: ${clubHome.name}, ${clubAway.name}`);

  // 4. Create Players for Home Club
  const playersHome = [
    { name: 'Karim Benzema', currentClubId: clubHome.id },
    { name: 'Luka Modric', currentClubId: clubHome.id },
    { name: 'Vinicius Jr', currentClubId: clubHome.id },
    { name: 'Rodrygo Silva', currentClubId: clubHome.id } // Suplente
  ];

  const createdPlayersHome = [];
  for (const p of playersHome) {
    const player = await prisma.player.create({ data: p });
    createdPlayersHome.push(player);
  }

  // 5. Create Players for Away Club
  const playersAway = [
    { name: 'Robert Lewandowski', currentClubId: clubAway.id },
    { name: 'Pedri Gonzalez', currentClubId: clubAway.id },
    { name: 'Gavi Paez', currentClubId: clubAway.id },
    { name: 'Raphinha Dias', currentClubId: clubAway.id } // Suplente
  ];

  const createdPlayersAway = [];
  for (const p of playersAway) {
    const player = await prisma.player.create({ data: p });
    createdPlayersAway.push(player);
  }

  console.log('Seeded players:');
  console.log('Home Players:', createdPlayersHome.map(p => `${p.name} (${p.id})`));
  console.log('Away Players:', createdPlayersAway.map(p => `${p.name} (${p.id})`));

  console.log('🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
