// server.ts
import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { glob } from "glob";
import swaggerUi from "swagger-ui-express";
import * as yaml from "yaml";
import { PokemonCard, PokemonSet, CardsResponse, SetsResponse, FilterResponse, PokemonByPokedex, PokedexResponse } from "./types";

// When compiled, __dirname will be 'dist/', so we need to go up one level to find data files
const DATA_DIR = process.env.NODE_ENV === 'production' ? path.join(__dirname, '..') : __dirname;
const app = express();

// Enable CORS for iOS app
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Load all cards into memory (adjust paths if you move things)
const cardFiles = glob.sync(path.join(DATA_DIR, "cards/en/**/*.json"));
const cards: PokemonCard[] = cardFiles.flatMap(f => JSON.parse(fs.readFileSync(f, "utf8")));

const setFiles = glob.sync(path.join(DATA_DIR, "sets/*.json"));
const sets: PokemonSet[] = setFiles.flatMap(f => JSON.parse(fs.readFileSync(f, "utf8")));

// Load and parse OpenAPI specification
const openApiSpecPath = path.join(DATA_DIR, "openapi.yaml");
const openApiSpec = yaml.parse(fs.readFileSync(openApiSpecPath, "utf8"));

// Serve Swagger UI at /docs
app.use("/docs", swaggerUi.serve);
app.get("/docs", swaggerUi.setup(openApiSpec, {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "Pokemon TCG Data API Documentation"
}));

// Redirect root path to docs
app.get("/", (req: Request, res: Response) => {
  res.redirect("/docs");
});

// Serve the raw OpenAPI spec at /openapi.yaml
app.get("/openapi.yaml", (req: Request, res: Response) => {
  res.type("text/yaml");
  res.send(fs.readFileSync(openApiSpecPath, "utf8"));
});

/// Get All Cards
app.get("/v2/cards", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/cards - Query: ${JSON.stringify(req.query)}`);

  // Create a dictionary of sets by ID for quick lookup
  const setsById: Record<string, PokemonSet> = {};
  sets.forEach(set => {
    setsById[set.id] = set;
  });
  console.log(sets)
  // Enrich each card with full set information
  const enrichedCards = cards.map(card => {
    // Extract set ID from card (either from card.set.id or parse from card.id)
    let setId = card.set?.id;
    if (!setId && card.id) {
      // Extract set ID from card ID (format: "setId-cardNumber")
      setId = card.id.split("-")[0];
    }

    // Find the full set data
    const fullSet = setId ? setsById[setId] : undefined;

    // Add year field to set data
    let enrichedSet = fullSet || card.set;
    if (enrichedSet && enrichedSet.releaseDate && !enrichedSet.year) {
      const year = enrichedSet.releaseDate.split("/")[0];
      enrichedSet = { ...enrichedSet, year };
    }

    // Return card with enriched set data
    return {
      ...card,
      set: enrichedSet
    };
  });

  const response: CardsResponse = {
    // cards: enrichedCards.sort((a, b) => (a.nationalPokedexNumbers?.at(0) ?? 0) + (b.nationalPokedexNumbers?.at(0) ?? 0))
    cards: enrichedCards
  };

  console.log(`[RESPONSE] GET /v2/cards - Returned ${response.cards.length} cards with enriched set data`);
  res.json(response);
});


app.get("/v2/cards/filter", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/cards/filter - Query: ${JSON.stringify(req.query)}`);

  // Parse filter parameters from query string
  // Expected format: ?types=Fire,Water&subtypes=Stage 1,EX&years=2024,2023&sets=base1,base2&rarities=Rare,Common
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

  // Create a dictionary of sets by ID for quick lookup
  const setsById: Record<string, PokemonSet> = {};
  sets.forEach(set => {
    setsById[set.id] = set;
  });

  // Enrich and filter cards
  let filteredCards: PokemonCard[] = cards.map(card => {
    // Extract set ID from card
    let setId = card.set?.id;
    if (!setId && card.id) {
      setId = card.id.split("-")[0];
    }

    // Find the full set data
    const fullSet = setId ? setsById[setId] : undefined;

    // Add year field to set data
    let enrichedSet = fullSet || card.set;
    if (enrichedSet && enrichedSet.releaseDate && !enrichedSet.year) {
      const year = enrichedSet.releaseDate.split("/")[0];
      enrichedSet = { ...enrichedSet, year };
    }

    // Return card with enriched set data
    return {
      ...card,
      set: enrichedSet
    };
  });

  // Apply type filter
  if (selectedTypes.length > 0) {
    filteredCards = filteredCards.filter(card => {
      const cardTypes = card.types || [];
      return cardTypes.some(type => selectedTypes.includes(type));
    });
  }

  // Apply subtype filter
  if (selectedSubtypes.length > 0) {
    filteredCards = filteredCards.filter(card => {
      const cardSubtypes = card.subtypes || [];
      return cardSubtypes.some(subtype => selectedSubtypes.includes(subtype));
    });
  }

  // Apply year filter
  if (selectedYears.length > 0) {
    filteredCards = filteredCards.filter(card => {
      // Extract year from releaseDate (format: yyyy/MM/dd)
      const releaseDate = card.set?.releaseDate;
      if (releaseDate) {
        const year = releaseDate.split("/")[0];
        return selectedYears.includes(year);
      }
      return false;
    });
  }

  // Apply set filter
  if (selectedSets.length > 0) {
    filteredCards = filteredCards.filter(card => {
      return card.set?.id && selectedSets.includes(card.set.id);
    });
  }

  // Apply rarity filter
  if (selectedRarities.length > 0) {
    filteredCards = filteredCards.filter(card => {
      return card.rarity && selectedRarities.includes(card.rarity);
    });
  }

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

  console.log(`[RESPONSE] GET /v2/cards/filter - Returned ${response.cards.length} cards`);
  res.json(response);
});

app.get("/v2/sets", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/sets - Query: ${JSON.stringify(req.query)}`);
  
  // Add year field to all sets
  const enrichedSets = sets.map(set => {
    if (set.releaseDate && !set.year) {
      const year = set.releaseDate.split("/")[0];
      return { ...set, year };
    }
    return set;
  });
  
  const response: SetsResponse = { sets: enrichedSets };
  console.log(`[RESPONSE] GET /v2/sets - Returned ${response.sets.length} sets`);
  res.json(response);
});

app.get("/v2/pokemon", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/pokemon - Query: ${JSON.stringify(req.query)}`);

  // Create a dictionary of sets by ID for quick lookup
  const setsById: Record<string, PokemonSet> = {};
  sets.forEach(set => {
    setsById[set.id] = set;
  });

  // Group cards by Pokedex number
  const pokemonByPokedex: Record<number, PokemonByPokedex> = {};

  cards.forEach(card => {
    // Skip cards without Pokedex numbers (trainers, energy, etc.)
    if (!card.nationalPokedexNumbers || card.nationalPokedexNumbers.length === 0) {
      return;
    }

    // Enrich card with full set data
    let setId = card.set?.id;
    if (!setId && card.id) {
      setId = card.id.split("-")[0];
    }
    const fullSet = setId ? setsById[setId] : undefined;

    // Add year field to set data
    let enrichedSet = fullSet || card.set;
    if (enrichedSet && enrichedSet.releaseDate && !enrichedSet.year) {
      const year = enrichedSet.releaseDate.split("/")[0];
      enrichedSet = { ...enrichedSet, year };
    }

    const enrichedCard = {
      ...card,
      set: enrichedSet
    };

    // Add card to each Pokedex number it has (some cards have multiple)
    card.nationalPokedexNumbers.forEach(pokedexNum => {
      if (!pokemonByPokedex[pokedexNum]) {
        pokemonByPokedex[pokedexNum] = {
          nationalPokedexNumber: pokedexNum,
          name: card.name,
          cards: []
        };
      }
      pokemonByPokedex[pokedexNum].cards.push(enrichedCard);
    });
  });

  // Convert to array and sort by Pokedex number
  const pokemonArray = Object.values(pokemonByPokedex).sort((a, b) => a.nationalPokedexNumber - b.nationalPokedexNumber);

  const response: PokedexResponse = {
    pokemon: pokemonArray,
    count: pokemonArray.length
  };

  console.log(`[RESPONSE] GET /v2/pokemon - Returned ${response.count} unique Pokemon with ${cards.length} total cards`);
  res.json(response);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Pokémon TCG API running on port ${PORT}`));
