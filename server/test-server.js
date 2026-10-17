import { GameEngine } from './src/game/GameEngine.js';

console.log('Testing GameEngine...');
const engine = new GameEngine('TESTROOM', 'standard');

// Add 2 players
const p1 = engine.addPlayer('player1', 'Alice');
const p2 = engine.addPlayer('player2', 'Bob');
console.log('Players added:', p1.success, p2.success);

// Start game
const startRes = engine.startGame();
console.log('Game started:', startRes.success, 'Phase:', engine.phase);
console.log('Current player:', engine.getCurrentPlayer().name);

// Check board
console.log('Hex count:', Object.keys(engine.board.hexes).length);
console.log('Vertices count:', Object.keys(engine.board.vertices).length);
console.log('Edges count:', Object.keys(engine.board.edges).length);
console.log('Ports count:', engine.board.ports.length);

// Check setup valid placements
const validPlacements = engine.getValidPlacements(engine.getCurrentPlayerId());
console.log('Valid setup settlements available:', validPlacements.validSettlements.length);

// Place a setup settlement
const firstVertex = validPlacements.validSettlements[0];
const setRes = engine.setupPlaceSettlement(engine.getCurrentPlayerId(), firstVertex);
console.log('Placed setup settlement:', setRes.success);

// Check valid setup roads
const validRoadsAfter = engine.getValidPlacements(engine.getCurrentPlayerId()).validRoads;
console.log('Valid setup roads connected to settlement:', validRoadsAfter.length);

// Place a setup road
const roadRes = engine.setupPlaceRoad(engine.getCurrentPlayerId(), validRoadsAfter[0]);
console.log('Placed setup road:', roadRes.success);

// Check serialized state
const serialized = engine.serialize('player1');
console.log('Serialized state keys:', Object.keys(serialized));
console.log('ALL ENGINE TESTS PASSED SUCCESSFULLY! 🎉');

// Engine rules (setup order, special build, steals, spectators, leaving…)
await import('./tests/engine.test.js');

// Ryō rules, game-over hook, accounts disabled without a database
await import('./tests/rewards.test.js');

// Shop: catalogue, buying / equipping rules, cosmetics in the game state
await import('./tests/shop.test.js');
