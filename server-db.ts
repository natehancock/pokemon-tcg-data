// server-db.ts - Updated server using SQLite database
import express, { Request, Response } from "express";
import { PokemonDatabase } from "./database";
import { CardsResponse, SetsResponse, FilterResponse, PokemonByPokedex, PokedexResponse } from "./types";

const app = express();

// Initialize database connection
const db = new PokemonDatabase();

// Enable CORS for iOS app
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

/// Get All Cards
app.get("/v2/cards", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/cards - Query: ${JSON.stringify(req.query)}`);

  try {
    const cards = db.getAllCards();
    const response: CardsResponse = { cards };

    console.log(`[RESPONSE] GET /v2/cards - Returned ${response.cards.length} cards from database`);
    res.json(response);
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

app.get("/v2/cards/filter", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/cards/filter - Query: ${JSON.stringify(req.query)}`);

  try {
    // Parse filter parameters from query string
    const typesParam = (req.query.types as string) || "";
    const subtypesParam = (req.query.subtypes as string) || "";
    const yearsParam = (req.query.years as string) || "";
    const setsParam = (req.query.sets as string) || "";
    const raritiesParam = (req.query.rarities as string) || "";

    const selectedTypes = typesParam ? typesParam.split(",").map(t => t.trim()).filter(Boolean) : [];
    const selectedSubtypes = subtypesParam ? subtypesParam.split(",").map(s => s.trim()).filter(Boolean) : [];
    const selectedYears = yearsParam ? yearsParam.split(",").map(y => y.trim()).filter(Boolean) : [];
    const selectedSets = setsParam ? setsParam.split(",").map(s => s.trim()).filter(Boolean) : [];
    const selectedRarities = raritiesParam ? raritiesParam.split(",").map(r => r.trim()).filter(Boolean) : [];

    console.log(`[FILTER] Types: ${selectedTypes.length > 0 ? selectedTypes.join(", ") : "none"}`);
    console.log(`[FILTER] Subtypes: ${selectedSubtypes.length > 0 ? selectedSubtypes.join(", ") : "none"}`);
    console.log(`[FILTER] Years: ${selectedYears.length > 0 ? selectedYears.join(", ") : "none"}`);
    console.log(`[FILTER] Sets: ${selectedSets.length > 0 ? selectedSets.join(", ") : "none"}`);
    console.log(`[FILTER] Rarities: ${selectedRarities.length > 0 ? selectedRarities.join(", ") : "none"}`);

    // Build filters object
    const filters = {
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      subtypes: selectedSubtypes.length > 0 ? selectedSubtypes : undefined,
      years: selectedYears.length > 0 ? selectedYears : undefined,
      sets: selectedSets.length > 0 ? selectedSets : undefined,
      rarities: selectedRarities.length > 0 ? selectedRarities : undefined,
    };

    // Remove undefined filters
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined)
    );

    const filteredCards = db.getAllCards(cleanFilters);

    const response: FilterResponse = {
      cards: filteredCards,
      count: filteredCards.length,
      filters: {
        types: selectedTypes,
        subtypes: selectedSubtypes,
        years: selectedYears,
        sets: selectedSets,
        rarities: selectedRarities
      }
    };

    console.log(`[RESPONSE] GET /v2/cards/filter - Returned ${response.cards.length} cards from database`);
    res.json(response);
  } catch (error) {
    console.error('Error filtering cards:', error);
    res.status(500).json({ error: 'Failed to filter cards' });
  }
});

app.get("/v2/sets", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/sets - Query: ${JSON.stringify(req.query)}`);
  
  try {
    const sets = db.getAllSets();
    const response: SetsResponse = { sets };
    
    console.log(`[RESPONSE] GET /v2/sets - Returned ${response.sets.length} sets from database`);
    res.json(response);
  } catch (error) {
    console.error('Error fetching sets:', error);
    res.status(500).json({ error: 'Failed to fetch sets' });
  }
});

app.get("/v2/pokemon", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/pokemon - Query: ${JSON.stringify(req.query)}`);

  try {
    const pokemonArray = db.getPokemonGrouped();

    const response: PokedexResponse = {
      pokemon: pokemonArray as PokemonByPokedex[],
      count: pokemonArray.length
    };

    console.log(`[RESPONSE] GET /v2/pokemon - Returned ${response.count} unique Pokémon from database`);
    res.json(response);
  } catch (error) {
    console.error('Error fetching pokemon:', error);
    res.status(500).json({ error: 'Failed to fetch pokemon' });
  }
});

// Get Pokemon types
app.get("/v2/pokemon/types", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/pokemon/types`);

  try {
    const types = db.getDb().prepare('SELECT * FROM pokemon_types ORDER BY name').all();
    console.log(`[RESPONSE] GET /v2/pokemon/types - Returned ${types.length} types`);
    res.json({ types, count: types.length });
  } catch (error) {
    console.error('Error fetching Pokemon types:', error);
    res.status(500).json({ error: 'Failed to fetch Pokemon types' });
  }
});

// Get Pokemon moves
app.get("/v2/pokemon/moves", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/pokemon/moves`);

  try {
    const moves = db.getDb().prepare('SELECT * FROM pokemon_moves ORDER BY name').all();
    console.log(`[RESPONSE] GET /v2/pokemon/moves - Returned ${moves.length} moves`);
    res.json({ moves, count: moves.length });
  } catch (error) {
    console.error('Error fetching Pokemon moves:', error);
    res.status(500).json({ error: 'Failed to fetch Pokemon moves' });
  }
});

// Get Pokemon abilities
app.get("/v2/pokemon/abilities", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/pokemon/abilities`);

  try {
    const abilities = db.getDb().prepare('SELECT * FROM pokemon_abilities ORDER BY name').all();
    console.log(`[RESPONSE] GET /v2/pokemon/abilities - Returned ${abilities.length} abilities`);
    res.json({ abilities, count: abilities.length });
  } catch (error) {
    console.error('Error fetching Pokemon abilities:', error);
    res.status(500).json({ error: 'Failed to fetch Pokemon abilities' });
  }
});

// Get Pokemon species
app.get("/v2/pokemon/species", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/pokemon/species`);

  try {
    const species = db.getDb().prepare('SELECT * FROM pokemon_species ORDER BY id').all();
    console.log(`[RESPONSE] GET /v2/pokemon/species - Returned ${species.length} species`);
    res.json({ species, count: species.length });
  } catch (error) {
    console.error('Error fetching Pokemon species:', error);
    res.status(500).json({ error: 'Failed to fetch Pokemon species' });
  }
});

// Get all Pokedexes
app.get("/v2/pokedexes", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/pokedexes`);

  try {
    const pokedexes = db.getDb().prepare('SELECT * FROM pokedexes ORDER BY id').all();
    console.log(`[RESPONSE] GET /v2/pokedexes - Returned ${pokedexes.length} pokedexes`);
    res.json({ pokedexes, count: pokedexes.length });
  } catch (error) {
    console.error('Error fetching Pokedexes:', error);
    res.status(500).json({ error: 'Failed to fetch Pokedexes' });
  }
});

// Get specific Pokedex with its entries
app.get("/v2/pokedexes/:id", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/pokedexes/${req.params.id}`);

  try {
    const pokedexId = parseInt(req.params.id);
    
    // Get the pokedex info
    const pokedex = db.getDb().prepare('SELECT * FROM pokedexes WHERE id = ?').get(pokedexId) as any;
    
    if (!pokedex) {
      return res.status(404).json({ error: 'Pokedex not found' });
    }

    // Get all entries for this pokedex
    const entries = db.getDb().prepare(
      'SELECT * FROM pokedex_entries WHERE pokedexId = ? ORDER BY entryNumber'
    ).all(pokedexId);

    const response = {
      ...pokedex,
      descriptions: JSON.parse(pokedex.descriptions || '[]'),
      names: JSON.parse(pokedex.names || '[]'),
      entries,
      entryCount: entries.length
    };

    console.log(`[RESPONSE] GET /v2/pokedexes/${req.params.id} - Returned ${entries.length} entries`);
    res.json(response);
  } catch (error) {
    console.error('Error fetching Pokedex:', error);
    res.status(500).json({ error: 'Failed to fetch Pokedex' });
  }
});

// Get Pokemon entries by Pokedex
app.get("/v2/pokedexes/:id/entries", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/pokedexes/${req.params.id}/entries`);

  try {
    const pokedexId = parseInt(req.params.id);
    
    const entries = db.getDb().prepare(
      'SELECT * FROM pokedex_entries WHERE pokedexId = ? ORDER BY entryNumber'
    ).all(pokedexId);

    console.log(`[RESPONSE] GET /v2/pokedexes/${req.params.id}/entries - Returned ${entries.length} entries`);
    res.json({ entries, count: entries.length, pokedexId });
  } catch (error) {
    console.error('Error fetching Pokedex entries:', error);
    res.status(500).json({ error: 'Failed to fetch Pokedex entries' });
  }
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  try {
    // Test database connection with a simple query
    const testQuery = db.getDb().prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number };
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      cardsCount: testQuery.count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  db.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Pokémon TCG API running on port ${PORT}`);
  console.log(`📊 Using SQLite database`);
  
  // Log some startup stats
  try {
    const stats = {
      sets: db.getDb().prepare('SELECT COUNT(*) as count FROM sets').get() as { count: number },
      cards: db.getDb().prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number },
      decks: db.getDb().prepare('SELECT COUNT(*) as count FROM decks').get() as { count: number }
    };
    console.log(`📈 Database loaded: ${stats.cards.count} cards, ${stats.sets.count} sets, ${stats.decks.count} decks`);
  } catch (error) {
    console.error('Failed to load database stats:', error);
  }
});
