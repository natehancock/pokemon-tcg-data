// types.ts
// Re-export generated types from OpenAPI specification
import { components } from './generated/types';

// Export schema types
export type PokemonCard = components['schemas']['PokemonCard'];
export type SetInfo = components['schemas']['SetInfo'];
export type Attack = components['schemas']['Attack'];
export type Ability = components['schemas']['Ability'];
export type TypeEffect = components['schemas']['TypeEffect'];
export type CardImages = components['schemas']['CardImages'];
export type SetImages = components['schemas']['SetImages'];
export type TCGPlayer = components['schemas']['TCGPlayer'];
export type TCGPlayerPrices = components['schemas']['TCGPlayerPrices'];
export type CardMarket = components['schemas']['CardMarket'];
export type CardMarketPrices = components['schemas']['CardMarketPrices'];
export type PriceInfo = components['schemas']['PriceInfo'];

// Export response types
export type CardsResponse = components['schemas']['CardsResponse'];
export type FilterResponse = components['schemas']['FilterResponse'];
export type SetsResponse = components['schemas']['SetsResponse'];
export type PokemonByPokedex = components['schemas']['PokemonByPokedex'];
export type PokedexResponse = components['schemas']['PokedexResponse'];
export type ErrorResponse = components['schemas']['Error'];

// Maintain backward compatibility with old naming
export type PokemonSet = SetInfo;
