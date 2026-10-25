/**
 * The core views WP7 screens read, through WP6's engine seam (useEngine):
 * production gets the real core; dev builds and tests can provide another
 * engine. The market also needs economy views the seam does not list yet
 * (ask, checkOffer, marketWage); an engine may provide them (tests, the
 * preview), otherwise the real core/economy functions are used.
 * CHANGE REQUEST (WP6): add ask, checkOffer and marketWage to GameEngine.
 */
import * as economy from '../../../../core/economy';
import { useEngine, type GameEngine } from '../../../store';

export interface MarketViews {
  ask: typeof economy.ask;
  checkOffer: typeof economy.checkOffer;
  marketWage: typeof economy.marketWage;
}

export type Wp7Engine = GameEngine & MarketViews;

export function withMarketViews(engine: GameEngine & Partial<MarketViews>): Wp7Engine {
  return {
    ...engine,
    ask: engine.ask ?? economy.ask,
    checkOffer: engine.checkOffer ?? economy.checkOffer,
    marketWage: engine.marketWage ?? economy.marketWage,
  };
}

export function useWp7Engine(): Wp7Engine {
  return withMarketViews(useEngine() as GameEngine & Partial<MarketViews>);
}
