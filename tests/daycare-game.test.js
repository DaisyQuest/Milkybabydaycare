import { describe, expect, it, vi } from 'vitest';
import {
  applyNeedTick,
  applyToolToBaby,
  completeCleanup,
  createBaby,
  createDaycareGameApp,
  createInitialDaycareState,
  getSafeBoardPosition,
  getNeedEmoji,
  initDaycareGame,
  resolveFailurePenalty,
  selectTool,
  spawnBabyIfNeeded,
  tickDaycareState
} from '../src/daycare-game.js';

function buildDom() {
  document.body.innerHTML = `
    <main class="daycare-page" data-daycare-root>
      <section class="daycare-status">
        <div class="health-track"><div class="health-fill" data-daycare-health-fill></div></div>
        <p data-daycare-health-label></p>
        <p data-daycare-stats></p>
      </section>
      <section class="daycare-toolbar">
        <button type="button" data-daycare-tool="milk">Milk</button>
        <button type="button" data-daycare-tool="caress">Caress</button>
        <button type="button" data-daycare-tool="cleanup">Cleanup</button>
        <button type="button" data-daycare-reset>Reset</button>
      </section>
      <section data-daycare-board></section>
      <div data-daycare-trash></div>
      <p data-daycare-message></p>
    </main>
  `;
}

describe('createBaby', () => {
  it('creates deterministic baby shape with baseline need state', () => {
    const baby = createBaby(7, () => 0);
    expect(baby).toEqual({
      id: 7,
      x: 10,
      y: 22,
      needs: { milk: 0, caress: 0, cleanup: 0 },
      cleanupPending: false,
      enraged: false,
      rageLevel: 0,
      attackDamagePerSecond: 0
    });
  });
});

describe('getSafeBoardPosition', () => {
  it('clamps babies within board-safe boundaries, including rage growth and fallback dimensions', () => {
    const rageBaby = { x: 1, y: 2, rageLevel: 1 };
    const clamped = getSafeBoardPosition(rageBaby, 400, 460);
    expect(clamped.x).toBeGreaterThan(10);
    expect(clamped.y).toBeGreaterThan(20);

    const farEdgeBaby = { x: 99, y: 99, rageLevel: 0 };
    const maxClamped = getSafeBoardPosition(farEdgeBaby, 400, 460);
    expect(maxClamped.x).toBeLessThan(95);
    expect(maxClamped.y).toBeLessThan(95);

    const fallback = getSafeBoardPosition({ x: 0, y: 0, rageLevel: Number.NaN }, 0, 0);
    expect(fallback.x).toBe(50);
    expect(fallback.y).toBe(50);

    const centeredX = getSafeBoardPosition({ x: 80, y: 40, rageLevel: 1 }, 50, 600);
    expect(centeredX.x).toBe(50);

    const centeredY = getSafeBoardPosition({ x: 40, y: 80, rageLevel: 1 }, 600, 120);
    expect(centeredY.y).toBe(50);
  });
});

describe('createInitialDaycareState', () => {
  it('starts with two babies and defaults', () => {
    const state = createInitialDaycareState(() => 0);
    expect(state.babies).toHaveLength(2);
    expect(state.health).toBe(100);
    expect(state.selectedTool).toBe('milk');
    expect(state.pendingCleanupBabyId).toBeNull();
  });
});

describe('getNeedEmoji', () => {
  it('covers empty, calm, and multiple-needs emoji states', () => {
    expect(getNeedEmoji()).toBe('😴');
    expect(getNeedEmoji({ milk: 4, caress: 7, cleanup: 10 })).toBe('😌');
    expect(getNeedEmoji({ milk: 85, caress: 90, cleanup: 10 })).toBe('🤲🍼');
    expect(getNeedEmoji({ milk: 90, caress: 10, cleanup: 86 })).toBe('🍼💩');
  });
});

describe('applyNeedTick', () => {
  it('increases needs and transitions into rage mode above threshold', () => {
    const baby = {
      ...createBaby(1, () => 0),
      needs: { milk: 58, caress: 58, cleanup: 58 }
    };

    const calm = applyNeedTick(baby, 100);
    expect(calm.enraged).toBe(false);

    const enraged = applyNeedTick(baby, 2_000);
    expect(enraged.enraged).toBe(true);
    expect(enraged.rageLevel).toBeGreaterThan(0);
    expect(enraged.attackDamagePerSecond).toBeGreaterThan(0);
  });

  it('caps needs at 100 and saturates rage level at 1', () => {
    const baby = {
      ...createBaby(1, () => 0),
      needs: { milk: 100, caress: 99, cleanup: 98 }
    };
    const next = applyNeedTick(baby, 4_000);
    expect(next.needs).toEqual({ milk: 100, caress: 100, cleanup: 100 });
    expect(next.rageLevel).toBe(1);
    expect(next.attackDamagePerSecond).toBeCloseTo(6, 6);
  });
});

describe('spawnBabyIfNeeded', () => {
  it('does nothing before timer and spawns baby at timer', () => {
    const state = createInitialDaycareState(() => 0);
    const noSpawn = spawnBabyIfNeeded({ ...state, elapsedMs: 10_000 }, () => 0);
    expect(noSpawn.babies).toHaveLength(2);

    const spawned = spawnBabyIfNeeded({ ...state, elapsedMs: 12_000 }, () => 0);
    expect(spawned.babies).toHaveLength(3);
    expect(spawned.spawnedBabies).toBe(3);
    expect(spawned.message).toContain('new baby');

    const lateGame = spawnBabyIfNeeded({
      ...state,
      elapsedMs: 12_000,
      spawnedBabies: 40,
      nextBabyAtMs: 12_000
    }, () => 0);
    expect(lateGame.nextBabyAtMs - 12_000).toBe(6_000);
  });
});

describe('resolveFailurePenalty', () => {
  it('charges penalties when babies newly enrage', () => {
    const base = createInitialDaycareState(() => 0);
    const prev = [{ enraged: false }, { enraged: true }];
    const next = [{ enraged: true }, { enraged: true }];
    const resolved = resolveFailurePenalty(base, prev, next);

    expect(resolved.failures).toBe(1);
    expect(resolved.health).toBe(90);
    expect(resolved.failureCost).toBe(13);
  });
});

describe('tickDaycareState', () => {
  it('does not advance when game is already over', () => {
    const state = { ...createInitialDaycareState(() => 0), gameOver: true, elapsedMs: 400 };
    expect(tickDaycareState(state, 500, () => 0)).toBe(state);
  });

  it('applies attack damage and sets game over at zero health', () => {
    const ragingBaby = {
      ...createBaby(1, () => 0),
      needs: { milk: 100, caress: 100, cleanup: 100 },
      enraged: true,
      rageLevel: 1,
      attackDamagePerSecond: 100
    };
    const state = {
      ...createInitialDaycareState(() => 0),
      babies: [ragingBaby],
      health: 1,
      elapsedMs: 0,
      nextBabyAtMs: 99_000
    };

    const next = tickDaycareState(state, 500, () => 0);
    expect(next.health).toBe(0);
    expect(next.gameOver).toBe(true);
    expect(next.message).toContain('Game over');
  });

  it('spawns babies when timer is reached, even under pressure', () => {
    const state = {
      ...createInitialDaycareState(() => 0),
      babies: [{
        ...createBaby(1, () => 0),
        needs: { milk: 100, caress: 100, cleanup: 100 },
        enraged: true,
        rageLevel: 1,
        attackDamagePerSecond: 6
      }],
      elapsedMs: 11_900,
      nextBabyAtMs: 12_000
    };
    const next = tickDaycareState(state, 250, () => 0);
    expect(next.babies.length).toBe(2);
    expect(next.message).toContain('new baby');
    expect(next.health).toBeLessThan(100);
  });

  it('surfaces attack warning when damage arrives without a spawn event', () => {
    const state = {
      ...createInitialDaycareState(() => 0),
      babies: [{
        ...createBaby(1, () => 0),
        needs: { milk: 100, caress: 100, cleanup: 100 },
        enraged: true,
        rageLevel: 1,
        attackDamagePerSecond: 6
      }],
      elapsedMs: 100,
      nextBabyAtMs: 12_000
    };
    const next = tickDaycareState(state, 250, () => 0);
    expect(next.message).toContain('attacking');
    expect(next.health).toBeLessThan(100);
  });
});

describe('tooling reducers', () => {
  it('selectTool ignores invalid tools and updates valid selection', () => {
    const state = createInitialDaycareState(() => 0);
    expect(selectTool(state, 'fake')).toBe(state);
    expect(selectTool(state, 'caress').selectedTool).toBe('caress');
  });

  it('applyToolToBaby handles missing baby/game over/cleanup flow', () => {
    const state = createInitialDaycareState(() => 0);
    expect(applyToolToBaby(state, 999)).toBe(state);
    const ended = { ...state, gameOver: true };
    expect(applyToolToBaby(ended, 1)).toEqual(ended);

    const cleanupState = applyToolToBaby({ ...state, selectedTool: 'cleanup' }, 1);
    expect(cleanupState.pendingCleanupBabyId).toBe(1);
    expect(cleanupState.babies[0].cleanupPending).toBe(true);
    expect(cleanupState.message).toContain('Drag the diaper');
  });

  it('applyToolToBaby clears milk/caress and increments score', () => {
    const state = {
      ...createInitialDaycareState(() => 0),
      babies: [{ ...createBaby(1, () => 0), needs: { milk: 80, caress: 12, cleanup: 22 } }],
      selectedTool: 'milk'
    };

    const milked = applyToolToBaby(state, 1);
    expect(milked.babies[0].needs.milk).toBe(10);
    expect(milked.score).toBe(1);
    expect(milked.message).toContain('Milk delivered');

    const caressed = applyToolToBaby({ ...state, selectedTool: 'caress' }, 1);
    expect(caressed.message).toContain('Caress delivered');
  });

  it('completeCleanup validates pending diaper and completes success path', () => {
    const state = createInitialDaycareState(() => 0);
    const invalid = completeCleanup(state, 1);
    expect(invalid.message).toContain('Select a baby');

    const cleanupReady = {
      ...state,
      pendingCleanupBabyId: 1,
      babies: [{ ...createBaby(1, () => 0), cleanupPending: true, needs: { milk: 90, caress: 10, cleanup: 100 } }]
    };

    const cleaned = completeCleanup(cleanupReady, 1);
    expect(cleaned.pendingCleanupBabyId).toBeNull();
    expect(cleaned.babies[0].needs.cleanup).toBe(0);
    expect(cleaned.score).toBe(1);
    expect(cleaned.message).toContain('Cleanup complete');
    expect(cleaned.babies[0].enraged).toBe(true);

    const fullyCalm = completeCleanup({
      ...cleanupReady,
      babies: [{
        ...createBaby(1, () => 0),
        cleanupPending: true,
        needs: { milk: 30, caress: 20, cleanup: 100 }
      }]
    }, 1);
    expect(fullyCalm.babies[0].enraged).toBe(false);
    expect(fullyCalm.babies[0].attackDamagePerSecond).toBe(0);
  });
});

describe('createDaycareGameApp / initDaycareGame', () => {
  it('returns null without required DOM/window', () => {
    expect(createDaycareGameApp()).toBeNull();

    document.body.innerHTML = '<main data-daycare-root><section data-daycare-board></section></main>';
    expect(createDaycareGameApp(document, window)).toBeNull();
  });

  it('wires controls, tick schedule, cleanup drag/drop, reset, and destroy', () => {
    buildDom();
    const board = document.querySelector('[data-daycare-board]');
    Object.defineProperty(board, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(board, 'clientHeight', { value: 460, configurable: true });
    const setIntervalMock = vi.fn((fn) => {
      setIntervalMock.cb = fn;
      return 15;
    });
    const clearIntervalMock = vi.fn();
    const app = createDaycareGameApp(document, {
      setInterval: setIntervalMock,
      clearInterval: clearIntervalMock
    }, {
      rng: () => 0,
      schedule: (fn) => {
        setIntervalMock.cb = fn;
        return 22;
      },
      cancelSchedule: clearIntervalMock,
      intervalMs: 250
    });

    expect(app).toBeTruthy();
    expect(document.querySelector('[data-daycare-health-label]').textContent).toContain('100');
    const initialBaby = document.querySelector('[data-baby-id="1"]');
    expect(initialBaby.style.left).not.toBe('10%');
    expect(initialBaby.querySelector('.daycare-baby__bubble')).toBeTruthy();

    document.querySelector('[data-daycare-tool="cleanup"]').click();
    document.querySelector('[data-baby-id="1"]').click();
    expect(document.querySelector('.daycare-diaper')).toBeTruthy();

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { getData: () => '1' } });
    document.querySelector('[data-daycare-trash]').dispatchEvent(dropEvent);
    expect(document.querySelector('[data-daycare-message]').textContent).toContain('Cleanup complete');

    document.querySelector('[data-daycare-reset]').click();
    expect(document.querySelector('[data-daycare-root]').classList.contains('daycare-reset-pulse')).toBe(true);

    setIntervalMock.cb();
    expect(app.getState().elapsedMs).toBeGreaterThan(0);
    expect(document.querySelector('[data-daycare-root]').dataset.gameOver).toBe('false');

    app.destroy();
    expect(clearIntervalMock).toHaveBeenCalledWith(22);
  });

  it('initDaycareGame delegates to createDaycareGameApp', () => {
    buildDom();
    const win = { setInterval: () => 1, clearInterval: () => {} };
    const app = initDaycareGame(document, win);
    expect(app).toBeTruthy();
    app.destroy();
  });
});
