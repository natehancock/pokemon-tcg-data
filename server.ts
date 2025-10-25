// server.ts
import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { glob } from "glob";
import { PokemonCard, PokemonSet, CardsResponse, SetsResponse, FilterResponse } from "./types";

const DATA_DIR = __dirname;
const app = express();

// Load all cards into memory (adjust paths if you move things)
const cardFiles = glob.sync(path.join(DATA_DIR, "cards/en/**/*.json"));
const cards: PokemonCard[] = cardFiles.flatMap(f => JSON.parse(fs.readFileSync(f, "utf8")));

const setFiles = glob.sync(path.join(DATA_DIR, "sets/*.json"));
const sets: PokemonSet[] = setFiles.flatMap(f => JSON.parse(fs.readFileSync(f, "utf8")));

/// Get All Cards
app.get("/v2/cards", (req: Request, res: Response) => {
  console.log(`[REQUEST] GET /v2/cards - Query: ${JSON.stringify(req.query)}`);

  // Create a dictionary of sets by ID for quick lookup
  const setsById: Record<string, PokemonSet> = {};
  sets.forEach(set => {
    setsById[set.id] = set;
  });

  // Enrich each card with full set information
  const enrichedCards = cards.map(card => {
    // Extract set ID from card (either from card.set.id or parse from card.id)
    let setId = card.set?.id;
    if (!setId && card.id) {
      // Extract set ID from card ID (format: "setId-cardNumber")
      setId = card.id.split("-")[0];
    }

    // Find the full set data
    const fullSet = setsById[setId];

    // Return card with enriched set data
    return {
      ...card,
      set: fullSet || card.set // Use full set if found, otherwise keep original
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
    const fullSet = setsById[setId];

    // Return card with enriched set data
    return {
      ...card,
      set: fullSet || card.set
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
      const setYear = card.set?.year;
      if (!setYear) {
        // Try to extract year from releaseDate if year is not present
        const releaseDate = card.set?.releaseDate;
        if (releaseDate) {
          const year = releaseDate.split("/")[0];
          return selectedYears.includes(year);
        }
        return false;
      }
      return selectedYears.includes(setYear);
    });
  }

  // Apply set filter
  if (selectedSets.length > 0) {
    filteredCards = filteredCards.filter(card => {
      return selectedSets.includes(card.set?.id);
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
  const response: SetsResponse = { sets: sets };
  console.log(`[RESPONSE] GET /v2/sets - Returned ${response.sets.length} sets`);
  res.json(response);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Local Pokémon TCG API on http://localhost:${PORT}`));
