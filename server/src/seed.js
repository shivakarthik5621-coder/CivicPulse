const bcrypt = require('bcryptjs');
const { db } = require('./services/supabase');

const seedAdmins = [
  { email: 'shivakarthik5621@gmail.com', name: 'Super Admin', role: 'super_admin', city: null, ward: null, category: null, password: 'aircrash123' },
  { email: 'shivakarthik5622@gmail.com', name: 'Hyderabad Road Safety Admin', role: 'city_potholes', city: 'Hyderabad', ward: null, category: 'pothole', password: 'aircrash@123' },
  { email: 'shivakarthik565@gmail.com', name: 'Hyderabad Sanitation Admin', role: 'city_garbage', city: 'Hyderabad', ward: null, category: 'garbage_dump', password: 'aircrash@123' },
  { email: 'shivakarthik8780@gmail.com', name: 'Mangalagiri Sanitation Admin', role: 'city_garbage', city: 'Mangalagiri', ward: null, category: 'garbage_dump', password: 'aircrash@123' },
  { email: 'hrishikeshharnoor@gmail.com', name: 'Mangalagiri Water Admin', role: 'city_water', city: 'Mangalagiri', ward: null, category: 'water_leakage', password: 'aircrash@123' },
  { email: 'nikkisai7379@gmail.com', name: 'Mangalagiri Electricity Admin', role: 'city_streetlight', city: 'Mangalagiri', ward: null, category: 'broken_streetlight', password: 'aircrash@123' },
];

async function seedOnStartup() {
  try {
    console.log('Seeding admin accounts...');
    let count = 0;
    for (const admin of seedAdmins) {
      try {
        const passwordHash = await bcrypt.hash(admin.password, 10);
        await db.seedAdmin({ email: admin.email, name: admin.name, role: admin.role, city: admin.city, ward: admin.ward, category: admin.category || null, password_hash: passwordHash });
        count++;
      } catch (err) {
        // Already exists — skip
      }
    }
    console.log(`  Seeded ${count} admin accounts`);
  } catch (err) {
    console.error('  Seed error (non-fatal):', err.message);
  }
}

module.exports = { seedOnStartup };
