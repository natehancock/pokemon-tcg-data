// database.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { PokemonCard, SetInfo } from './types';

const DATA_DIR = process.env.NODE_ENV === 'production' ? path.join(__dirname, '..') : __dirname;
const DB_PATH = path.join(DATA_DIR, 'pokemon_tcg.db');

export class PokemonDatabase {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  // Initialize database schema
  initializeSchema() {
    console.log('Creating database schema...');
    
    // Create types table (Pokemon types from dataset)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pokemon_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        isCanonical BOOLEAN
      );
    `);

    // Create moves table (Pokemon moves from dataset)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pokemon_moves (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        psName TEXT,
        generation INTEGER,
        description TEXT,
        shortDesc TEXT,
        type TEXT,
        power INTEGER,
        accuracy INTEGER,
        pp INTEGER,
        category TEXT,
        priority INTEGER,
        isZ BOOLEAN,
        isGmax BOOLEAN
      );
    `);

    // Create abilities table (Pokemon abilities from dataset)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pokemon_abilities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        shortDesc TEXT,
        generation INTEGER
      );
    `);

    // Create Pokemon species table (Pokemon species data from dataset)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pokemon_species (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        types TEXT, -- JSON array
        abilities TEXT, -- JSON array
        hiddenAbilities TEXT, -- JSON array
        baseStats TEXT, -- JSON object
        height REAL,
        weight REAL,
        generation INTEGER,
        evolutionChain TEXT -- JSON object
      );
    `);

    // Create pokedexes table (Different Pokedex types - National, Regional, etc.)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pokedexes (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        descriptions TEXT, -- JSON array of descriptions in different languages
        names TEXT, -- JSON array of names in different languages
        isMainSeries BOOLEAN,
        region TEXT
      );
    `);

    // Create pokedex_entries table (Pokemon entries in each Pokedex)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pokedex_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pokedexId INTEGER,
        entryNumber INTEGER,
        pokemonSpeciesId INTEGER,
        pokemonSpeciesName TEXT,
        FOREIGN KEY (pokedexId) REFERENCES pokedexes(id)
      );
    `);
    
    // Create sets table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        series TEXT,
        printedTotal INTEGER,
        total INTEGER,
        legalities TEXT, -- JSON
        ptcgoCode TEXT,
        releaseDate TEXT,
        updatedAt TEXT,
        images TEXT, -- JSON
        year TEXT
      );
    `);

    // Create cards table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        supertype TEXT,
        subtypes TEXT, -- JSON array
        level TEXT,
        hp TEXT,
        types TEXT, -- JSON array
        evolvesFrom TEXT,
        evolvesTo TEXT, -- JSON array
        abilities TEXT, -- JSON array
        attacks TEXT, -- JSON array
        weaknesses TEXT, -- JSON array
        resistances TEXT, -- JSON array
        retreatCost TEXT, -- JSON array
        convertedRetreatCost INTEGER,
        number TEXT,
        artist TEXT,
        rarity TEXT,
        flavorText TEXT,
        nationalPokedexNumbers TEXT, -- JSON array
        legalities TEXT, -- JSON
        images TEXT, -- JSON
        rules TEXT, -- JSON array for trainer cards
        setId TEXT,
        FOREIGN KEY (setId) REFERENCES sets(id)
      );
    `);

    // Create decks table (we'll add this later if needed)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        setId TEXT,
        cards TEXT, -- JSON array of card objects
        FOREIGN KEY (setId) REFERENCES sets(id)
      );
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cards_setId ON cards(setId);
      CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
      CREATE INDEX IF NOT EXISTS idx_cards_supertype ON cards(supertype);
      CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity);
      CREATE INDEX IF NOT EXISTS idx_cards_number ON cards(number);
      CREATE INDEX IF NOT EXISTS idx_sets_series ON sets(series);
      CREATE INDEX IF NOT EXISTS idx_sets_year ON sets(year);
    `);

    console.log('Database schema created successfully!');
  }

  // Migrate sets data
  migrateSets() {
    console.log('Migrating sets data...');
    
    const setFiles = glob.sync(path.join(DATA_DIR, "sets/*.json"));
    const sets: SetInfo[] = setFiles.flatMap(f => JSON.parse(fs.readFileSync(f, "utf8")));

    const insertSet = this.db.prepare(`
      INSERT OR REPLACE INTO sets (
        id, name, series, printedTotal, total, legalities, 
        ptcgoCode, releaseDate, updatedAt, images, year
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSets = this.db.transaction((sets: SetInfo[]) => {
      for (const set of sets) {
        const year = set.releaseDate ? set.releaseDate.split("/")[0] : null;
        
        insertSet.run(
          set.id,
          set.name,
          set.series,
          set.printedTotal,
          set.total,
          JSON.stringify(set.legalities),
          set.ptcgoCode,
          set.releaseDate,
          set.updatedAt,
          JSON.stringify(set.images),
          year
        );
      }
    });

    insertSets(sets);
    console.log(`Migrated ${sets.length} sets successfully!`);
  }

  // Migrate cards data
  migrateCards() {
    console.log('Migrating cards data...');
    
    const cardFiles = glob.sync(path.join(DATA_DIR, "cards/en/**/*.json"));
    const cards: PokemonCard[] = cardFiles.flatMap(f => JSON.parse(fs.readFileSync(f, "utf8")));

    const insertCard = this.db.prepare(`
      INSERT OR REPLACE INTO cards (
        id, name, supertype, subtypes, level, hp, types, evolvesFrom, 
        evolvesTo, abilities, attacks, weaknesses, resistances, 
        retreatCost, convertedRetreatCost, number, artist, rarity, 
        flavorText, nationalPokedexNumbers, legalities, images, rules, setId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCards = this.db.transaction((cards: PokemonCard[]) => {
      for (const card of cards) {
        // Extract setId from card ID if not present in set object
        let setId = card.set?.id;
        if (!setId && card.id) {
          setId = card.id.split("-")[0];
        }

        insertCard.run(
          card.id,
          card.name,
          card.supertype,
          JSON.stringify(card.subtypes || []),
          card.level,
          card.hp,
          JSON.stringify(card.types || []),
          card.evolvesFrom,
          JSON.stringify(card.evolvesTo || []),
          JSON.stringify(card.abilities || []),
          JSON.stringify(card.attacks || []),
          JSON.stringify(card.weaknesses || []),
          JSON.stringify(card.resistances || []),
          JSON.stringify(card.retreatCost || []),
          card.convertedRetreatCost,
          card.number,
          card.artist,
          card.rarity,
          card.flavorText,
          JSON.stringify(card.nationalPokedexNumbers || []),
          JSON.stringify(card.legalities),
          JSON.stringify(card.images),
          JSON.stringify(card.rules || []),
          setId
        );
      }
    });

    insertCards(cards);
    console.log(`Migrated ${cards.length} cards successfully!`);
  }

  // Migrate decks data (if deck files exist)
  migrateDecks() {
    console.log('Checking for decks data...');
    
    try {
      const deckFiles = glob.sync(path.join(DATA_DIR, "decks/en/**/*.json"));
      if (deckFiles.length === 0) {
        console.log('No deck files found, skipping deck migration.');
        return;
      }

      console.log('Migrating decks data...');
      
      const insertDeck = this.db.prepare(`
        INSERT OR REPLACE INTO decks (id, name, setId, cards) VALUES (?, ?, ?, ?)
      `);

      const insertDecks = this.db.transaction((deckData: any[]) => {
        for (const deck of deckData) {
          insertDeck.run(
            deck.id || `${deck.setId}-deck`,
            deck.name || 'Unknown Deck',
            deck.setId,
            JSON.stringify(deck.cards || [])
          );
        }
      });

      // Process each deck file
      let totalDecks = 0;
      for (const deckFile of deckFiles) {
        const decks = JSON.parse(fs.readFileSync(deckFile, "utf8"));
        const setId = path.basename(deckFile, '.json');
        
        // Normalize deck structure
        const normalizedDecks = Array.isArray(decks) ? 
          decks.map((deck, index) => ({
            id: deck.id || `${setId}-deck-${index}`,
            name: deck.name || `${setId} Deck ${index + 1}`,
            setId: setId,
            cards: deck.cards || deck
          })) : 
          [{
            id: `${setId}-deck`,
            name: `${setId} Deck`,
            setId: setId,
            cards: decks
          }];

        insertDecks(normalizedDecks);
        totalDecks += normalizedDecks.length;
      }
      
      console.log(`Migrated ${totalDecks} decks successfully!`);
    } catch (error) {
      console.log('Error migrating decks:', error);
      console.log('Continuing without deck data...');
    }
  }

  // Migrate Pokemon types data from external dataset
  async migratePokemonTypes() {
    console.log('Migrating Pokemon types data...');
    
    try {
      const response = await fetch('https://raw.githubusercontent.com/MerelSollie/pkmn-dataset/main/data/types.json');
      const types = await response.json() as any[];

      const insertType = this.db.prepare(`
        INSERT OR REPLACE INTO pokemon_types (id, name, color, isCanonical) 
        VALUES (?, ?, ?, ?)
      `);

      const insertTypes = this.db.transaction((types: any[]) => {
        for (const type of types) {
          insertType.run(
            type.id, 
            type.name, 
            type.color, 
            type.isCanonical ? 1 : 0
          );
        }
      });

      insertTypes(types);
      console.log(`Migrated ${types.length} Pokemon types successfully!`);
    } catch (error) {
      console.log('Error migrating Pokemon types:', error);
      console.log('Continuing without Pokemon types data...');
    }
  }

  // Migrate Pokemon moves data from external dataset
  async migratePokemonMoves() {
    console.log('Migrating Pokemon moves data...');
    
    try {
      const response = await fetch('https://raw.githubusercontent.com/MerelSollie/pkmn-dataset/main/data/moves.json');
      const moves = await response.json() as any[];

      const insertMove = this.db.prepare(`
        INSERT OR REPLACE INTO pokemon_moves (
          id, name, psName, generation, description, shortDesc, 
          type, power, accuracy, pp, category, priority, isZ, isGmax
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMoves = this.db.transaction((moves: any[]) => {
        for (const move of moves) {
          insertMove.run(
            move.id, move.name, move.psName, move.generation,
            move.desc, move.shortDesc, move.type, move.power,
            move.accuracy, move.pp, move.category, move.priority,
            move.isZ ? 1 : 0, move.isGmax ? 1 : 0
          );
        }
      });

      insertMoves(moves);
      console.log(`Migrated ${moves.length} Pokemon moves successfully!`);
    } catch (error) {
      console.log('Error migrating Pokemon moves:', error);
      console.log('Continuing without Pokemon moves data...');
    }
  }

  // Migrate Pokemon abilities data from external dataset
  async migratePokemonAbilities() {
    console.log('Migrating Pokemon abilities data...');
    
    try {
      const response = await fetch('https://raw.githubusercontent.com/MerelSollie/pkmn-dataset/main/data/abilities.json');
      const abilities = await response.json() as any[];

      const insertAbility = this.db.prepare(`
        INSERT OR REPLACE INTO pokemon_abilities (id, name, description, shortDesc, generation) 
        VALUES (?, ?, ?, ?, ?)
      `);

      const insertAbilities = this.db.transaction((abilities: any[]) => {
        for (const ability of abilities) {
          insertAbility.run(
            ability.id, ability.name, ability.desc, ability.shortDesc, ability.generation
          );
        }
      });

      insertAbilities(abilities);
      console.log(`Migrated ${abilities.length} Pokemon abilities successfully!`);
    } catch (error) {
      console.log('Error migrating Pokemon abilities:', error);
      console.log('Continuing without Pokemon abilities data...');
    }
  }

  // Migrate Pokemon species data from external dataset
  async migratePokemonSpecies() {
    console.log('Migrating Pokemon species data...');
    
    try {
      const response = await fetch('https://raw.githubusercontent.com/MerelSollie/pkmn-dataset/main/data/pokemon.json');
      const pokemonList = await response.json() as any[];

      const insertSpecies = this.db.prepare(`
        INSERT OR REPLACE INTO pokemon_species (
          id, name, types, abilities, hiddenAbilities, baseStats, 
          height, weight, generation, evolutionChain
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertSpeciesBatch = this.db.transaction((pokemon: any[]) => {
        for (const pkmn of pokemon) {
          insertSpecies.run(
            pkmn.nationalDexNumber || pkmn.id,
            pkmn.name,
            JSON.stringify(pkmn.types || []),
            JSON.stringify(pkmn.abilities || []),
            JSON.stringify(pkmn.hiddenAbilities || []),
            JSON.stringify(pkmn.baseStats || {}),
            pkmn.height,
            pkmn.weight,
            pkmn.generation,
            JSON.stringify(pkmn.evolutionChain || {})
          );
        }
      });

      insertSpeciesBatch(pokemonList);
      console.log(`Migrated ${pokemonList.length} Pokemon species successfully!`);
    } catch (error) {
      console.log('Error migrating Pokemon species:', error);
      console.log('Continuing without Pokemon species data...');
    }
  }

  // Migrate all Pokedexes from PokeAPI
  async migratePokedexes() {
    console.log('Migrating Pokedexes data...');
    
    try {
      // First get list of all pokedexes
      const listResponse = await fetch('https://pokeapi.co/api/v2/pokedex?limit=50');
      const pokedexList = await listResponse.json() as any;

      const insertPokedex = this.db.prepare(`
        INSERT OR REPLACE INTO pokedexes (id, name, descriptions, names, isMainSeries, region) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertEntry = this.db.prepare(`
        INSERT OR REPLACE INTO pokedex_entries (pokedexId, entryNumber, pokemonSpeciesId, pokemonSpeciesName) 
        VALUES (?, ?, ?, ?)
      `);

      let totalPokedexes = 0;
      let totalEntries = 0;

      // Process each pokedex
      for (const pokedexRef of pokedexList.results) {
        try {
          console.log(`Fetching ${pokedexRef.name} pokedex...`);
          const response = await fetch(pokedexRef.url);
          const pokedexData = await response.json() as any;

          // Insert pokedex
          insertPokedex.run(
            pokedexData.id,
            pokedexData.name,
            JSON.stringify(pokedexData.descriptions || []),
            JSON.stringify(pokedexData.names || []),
            pokedexData.is_main_series ? 1 : 0,
            pokedexData.region?.name || null
          );

          // Insert all Pokemon entries for this pokedex
          if (pokedexData.pokemon_entries && pokedexData.pokemon_entries.length > 0) {
            const insertEntriesTransaction = this.db.transaction((entries: any[]) => {
              for (const entry of entries) {
                insertEntry.run(
                  pokedexData.id,
                  entry.entry_number,
                  parseInt(entry.pokemon_species.url.split('/').slice(-2, -1)[0]), // Extract ID from URL
                  entry.pokemon_species.name
                );
              }
            });

            insertEntriesTransaction(pokedexData.pokemon_entries);
            totalEntries += pokedexData.pokemon_entries.length;
          }

          totalPokedexes++;

          // Add small delay to be respectful to the API
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.log(`Error fetching ${pokedexRef.name}:`, error);
          continue;
        }
      }

      console.log(`Migrated ${totalPokedexes} Pokedexes with ${totalEntries} total entries successfully!`);
    } catch (error) {
      console.log('Error migrating Pokedexes:', error);
      console.log('Continuing without Pokedex data...');
    }
  }

  // Run full migration
  async migrate() {
    console.log('Starting full database migration...');
    this.initializeSchema();
    
    // Migrate TCG data
    this.migrateSets();
    this.migrateCards();
    this.migrateDecks();
    
    // Migrate Pokemon reference data
    await this.migratePokemonTypes();
    await this.migratePokemonMoves();
    await this.migratePokemonAbilities();
    await this.migratePokemonSpecies();
    await this.migratePokedexes();
    
    console.log('Database migration completed!');
  }

  // Get database instance for queries
  getDb() {
    return this.db;
  }

  // Close database connection
  close() {
    this.db.close();
  }

  // Query methods for the API
  getAllCards(filters?: {
    types?: string[];
    subtypes?: string[];
    years?: string[];
    sets?: string[];
    rarities?: string[];
  }) {
    let query = `
      SELECT c.*, s.name as setName, s.series, s.releaseDate, s.images as setImages, s.year
      FROM cards c
      LEFT JOIN sets s ON c.setId = s.id
    `;
    
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.types?.length) {
      conditions.push(`EXISTS (
        SELECT 1 FROM json_each(c.types) 
        WHERE value IN (${filters.types.map(() => '?').join(',')})
      )`);
      params.push(...filters.types);
    }

    if (filters?.subtypes?.length) {
      conditions.push(`EXISTS (
        SELECT 1 FROM json_each(c.subtypes) 
        WHERE value IN (${filters.subtypes.map(() => '?').join(',')})
      )`);
      params.push(...filters.subtypes);
    }

    if (filters?.years?.length) {
      conditions.push(`s.year IN (${filters.years.map(() => '?').join(',')})`);
      params.push(...filters.years);
    }

    if (filters?.sets?.length) {
      conditions.push(`c.setId IN (${filters.sets.map(() => '?').join(',')})`);
      params.push(...filters.sets);
    }

    if (filters?.rarities?.length) {
      conditions.push(`c.rarity IN (${filters.rarities.map(() => '?').join(',')})`);
      params.push(...filters.rarities);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);
    
    return rows.map(this.transformCardRow);
  }

  getAllSets() {
    const stmt = this.db.prepare(`
      SELECT * FROM sets ORDER BY releaseDate
    `);
    const rows = stmt.all();
    
    return rows.map(this.transformSetRow);
  }

  getPokemonGrouped() {
    const stmt = this.db.prepare(`
      SELECT c.*, s.name as setName, s.series, s.releaseDate, s.images as setImages, s.year
      FROM cards c
      LEFT JOIN sets s ON c.setId = s.id
      WHERE c.nationalPokedexNumbers != '[]' AND c.nationalPokedexNumbers IS NOT NULL
      ORDER BY c.nationalPokedexNumbers
    `);
    const rows = stmt.all();
    
    const pokemonByPokedex: Record<number, any> = {};
    
    for (const row of rows) {
      const card = this.transformCardRow(row);
      const pokedexNumbers = Array.isArray(card.nationalPokedexNumbers) 
        ? card.nationalPokedexNumbers 
        : JSON.parse(card.nationalPokedexNumbers || '[]');
      
      for (const pokedexNum of pokedexNumbers) {
        if (!pokemonByPokedex[pokedexNum]) {
          pokemonByPokedex[pokedexNum] = {
            nationalPokedexNumber: pokedexNum,
            name: card.name,
            cards: []
          };
        }
        pokemonByPokedex[pokedexNum].cards.push(card);
      }
    }
    
    return Object.values(pokemonByPokedex).sort((a: any, b: any) => 
      a.nationalPokedexNumber - b.nationalPokedexNumber
    );
  }

  private transformCardRow(row: any): PokemonCard {
    return {
      id: row.id,
      name: row.name,
      supertype: row.supertype,
      subtypes: JSON.parse(row.subtypes || '[]'),
      level: row.level,
      hp: row.hp,
      types: JSON.parse(row.types || '[]'),
      evolvesFrom: row.evolvesFrom,
      evolvesTo: JSON.parse(row.evolvesTo || '[]'),
      abilities: JSON.parse(row.abilities || '[]'),
      attacks: JSON.parse(row.attacks || '[]'),
      weaknesses: JSON.parse(row.weaknesses || '[]'),
      resistances: JSON.parse(row.resistances || '[]'),
      retreatCost: JSON.parse(row.retreatCost || '[]'),
      convertedRetreatCost: row.convertedRetreatCost,
      number: row.number,
      artist: row.artist,
      rarity: row.rarity,
      flavorText: row.flavorText,
      nationalPokedexNumbers: JSON.parse(row.nationalPokedexNumbers || '[]'),
      legalities: JSON.parse(row.legalities || '{}'),
      images: JSON.parse(row.images || '{}'),
      rules: JSON.parse(row.rules || '[]'),
      set: {
        id: row.setId,
        name: row.setName,
        series: row.series,
        total: 0, // Will be populated from actual set data
        releaseDate: row.releaseDate,
        images: JSON.parse(row.setImages || '{}'),
        year: row.year
      }
    };
  }

  private transformSetRow(row: any): SetInfo {
    return {
      id: row.id,
      name: row.name,
      series: row.series,
      printedTotal: row.printedTotal,
      total: row.total,
      legalities: JSON.parse(row.legalities || '{}'),
      ptcgoCode: row.ptcgoCode,
      releaseDate: row.releaseDate,
      updatedAt: row.updatedAt,
      images: JSON.parse(row.images || '{}'),
      year: row.year
    };
  }
}
