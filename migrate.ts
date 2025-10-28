#!/usr/bin/env tsx
// migrate.ts - Script to migrate JSON data to SQLite database

import { PokemonDatabase } from './database';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.NODE_ENV === 'production' ? path.join(__dirname, '..') : __dirname;

async function main() {
  console.log('🚀 Starting Pokemon TCG Data Migration...\n');
  
  // Check if database already exists
  const dbPath = path.join(DATA_DIR, 'pokemon_tcg.db');
  if (fs.existsSync(dbPath)) {
    console.log('⚠️  Database already exists. Removing old database...');
    fs.unlinkSync(dbPath);
  }

  try {
    // Initialize database
    const db = new PokemonDatabase();
    
    console.log('📊 Starting migration process...\n');
    
    // Run migration
    await db.migrate();
    
    console.log('\n✅ Migration completed successfully!');
    
    // Show some stats
    console.log('\n📈 Database Statistics:');
    
    const setsCount = db.getDb().prepare('SELECT COUNT(*) as count FROM sets').get() as { count: number };
    console.log(`   Sets: ${setsCount.count}`);
    
    const cardsCount = db.getDb().prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number };
    console.log(`   Cards: ${cardsCount.count}`);
    
    const decksCount = db.getDb().prepare('SELECT COUNT(*) as count FROM decks').get() as { count: number };
    console.log(`   Decks: ${decksCount.count}`);
    
    // Show Pokemon reference data stats
    const typesCount = db.getDb().prepare('SELECT COUNT(*) as count FROM pokemon_types').get() as { count: number };
    console.log(`   Pokemon Types: ${typesCount.count}`);
    
    const movesCount = db.getDb().prepare('SELECT COUNT(*) as count FROM pokemon_moves').get() as { count: number };
    console.log(`   Pokemon Moves: ${movesCount.count}`);
    
    const abilitiesCount = db.getDb().prepare('SELECT COUNT(*) as count FROM pokemon_abilities').get() as { count: number };
    console.log(`   Pokemon Abilities: ${abilitiesCount.count}`);
    
    const speciesCount = db.getDb().prepare('SELECT COUNT(*) as count FROM pokemon_species').get() as { count: number };
    console.log(`   Pokemon Species: ${speciesCount.count}`);
    
    const pokedexCount = db.getDb().prepare('SELECT COUNT(*) as count FROM pokedexes').get() as { count: number };
    console.log(`   Pokedexes: ${pokedexCount.count}`);
    
    const entriesCount = db.getDb().prepare('SELECT COUNT(*) as count FROM pokedex_entries').get() as { count: number };
    console.log(`   Pokedex Entries: ${entriesCount.count}`);
    
    // Test some queries
    console.log('\n🔍 Testing database queries...');
    
    const firstCard = db.getAllCards().slice(0, 1)[0];
    if (firstCard) {
      console.log(`   First card: ${firstCard.name} (${firstCard.set?.name})`);
    }
    
    const firstSet = db.getAllSets().slice(0, 1)[0];
    if (firstSet) {
      console.log(`   First set: ${firstSet.name} (${firstSet.series})`);
    }
    
    const pokemonCount = db.getPokemonGrouped().length;
    console.log(`   Unique Pokémon: ${pokemonCount}`);
    
    // Close database connection
    db.close();
    
    console.log('\n🎉 Migration and testing completed successfully!');
    console.log(`💾 Database saved to: ${dbPath}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error);
