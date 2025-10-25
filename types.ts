// types.ts
export interface PokemonCard {
  id: string;
  name: string;
  types?: string[];
  subtypes?: string[];
  rarity?: string;
  set?: PokemonSet;
  nationalPokedexNumbers?: number[];
  [key: string]: any; // Allow other properties
}

export interface PokemonSet {
  id: string;
  name: string;
  series?: string;
  year?: string;
  releaseDate?: string;
  [key: string]: any; // Allow other properties
}

export interface CardsResponse {
  cards: PokemonCard[];
}

export interface SetsResponse {
  sets: PokemonSet[];
}

export interface FilterResponse {
  cards: PokemonCard[];
  count: number;
  filters: {
    types: string[];
    subtypes: string[];
    years: string[];
    sets: string[];
    rarities: string[];
  };
}
