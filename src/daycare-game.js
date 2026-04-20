const NEEDS = ['milk', 'caress', 'cleanup'];
const NEED_EMOJI = {
  milk: '🍼',
  caress: '🤲',
  cleanup: '💩'
};

export function createBaby(id, rng = Math.random) {
  const x = 10 + Math.floor(rng() * 80);
  const y = 10 + Math.floor(rng() * 70);

  return {
    id,
    x,
    y,
    needs: { milk: 0, caress: 0, cleanup: 0 },
    cleanupPending: false,
    enraged: false,
    rageLevel: 0,
    attackDamagePerSecond: 0
  };
}

export function createInitialDaycareState(rng = Math.random) {
  return {
    babies: [createBaby(1, rng), createBaby(2, rng)],
    selectedTool: 'milk',
    health: 100,
    elapsedMs: 0,
    nextBabyAtMs: 12_000,
    spawnedBabies: 2,
    failures: 0,
    failureCost: 10,
    score: 0,
    message: 'Keep the babies content. They become dangerous if ignored.',
    gameOver: false,
    pendingCleanupBabyId: null
  };
}

export function getNeedEmoji(needs) {
  if (!needs) {
    return '😴';
  }

  const entries = Object.entries(needs)
    .sort((a, b) => b[1] - a[1])
    .filter(([, value]) => value >= 35)
    .slice(0, 2);

  if (entries.length === 0) {
    return '😌';
  }

  return entries.map(([need]) => NEED_EMOJI[need] ?? '❔').join('');
}

export function applyNeedTick(baby, deltaMs) {
  const deltaSeconds = deltaMs / 1000;
  const updatedNeeds = {};

  NEEDS.forEach((need) => {
    updatedNeeds[need] = Math.min(100, baby.needs[need] + deltaSeconds * 6.5);
  });

  const highestNeed = Math.max(...Object.values(updatedNeeds));
  const rageLevel = highestNeed <= 60 ? 0 : Math.min(1, (highestNeed - 60) / 40);
  const enraged = rageLevel > 0;
  const attackDamagePerSecond = enraged ? 1.2 + rageLevel * 4.8 : 0;

  return {
    ...baby,
    needs: updatedNeeds,
    enraged,
    rageLevel,
    attackDamagePerSecond
  };
}

export function spawnBabyIfNeeded(state, rng = Math.random) {
  if (state.elapsedMs < state.nextBabyAtMs) {
    return state;
  }

  const newId = state.spawnedBabies + 1;
  return {
    ...state,
    babies: [...state.babies, createBaby(newId, rng)],
    spawnedBabies: newId,
    nextBabyAtMs: state.nextBabyAtMs + Math.max(6_000, 12_000 - newId * 300),
    message: `A new baby arrived! Total babies: ${newId}.`
  };
}

export function resolveFailurePenalty(state, previousBabies, updatedBabies) {
  let failures = state.failures;
  let health = state.health;
  let failureCost = state.failureCost;

  updatedBabies.forEach((baby, index) => {
    const previouslyEnraged = previousBabies[index]?.enraged ?? false;

    if (baby.enraged && !previouslyEnraged) {
      failures += 1;
      health = Math.max(0, health - failureCost);
      failureCost += 3;
    }
  });

  return { failures, health, failureCost };
}

export function tickDaycareState(state, deltaMs, rng = Math.random) {
  if (state.gameOver) {
    return state;
  }

  const elapsedMs = state.elapsedMs + deltaMs;
  const babiesAfterNeeds = state.babies.map((baby) => applyNeedTick(baby, deltaMs));
  const penalty = resolveFailurePenalty(state, state.babies, babiesAfterNeeds);
  const incomingDamage = babiesAfterNeeds.reduce((total, baby) => total + baby.attackDamagePerSecond * (deltaMs / 1000), 0);
  const health = Math.max(0, penalty.health - incomingDamage);

  const baseState = {
    ...state,
    elapsedMs,
    babies: babiesAfterNeeds,
    health,
    failures: penalty.failures,
    failureCost: penalty.failureCost,
    message: incomingDamage > 0 ? 'Enraged babies are attacking! Calm them quickly.' : state.message
  };

  const withSpawn = spawnBabyIfNeeded(baseState, rng);

  if (withSpawn.health <= 0) {
    return {
      ...withSpawn,
      gameOver: true,
      message: 'Game over. The nursery coup has begun. Hit reset to try again.'
    };
  }

  return withSpawn;
}

export function applyToolToBaby(state, babyId) {
  const baby = state.babies.find((item) => item.id === babyId);

  if (!baby || state.gameOver) {
    return state;
  }

  if (state.selectedTool === 'cleanup') {
    return {
      ...state,
      pendingCleanupBabyId: babyId,
      babies: state.babies.map((item) => (
        item.id === babyId
          ? { ...item, cleanupPending: true }
          : item
      )),
      message: 'Drag the diaper to the trashcan to complete cleanup.'
    };
  }

  const targetNeed = state.selectedTool;
  const updatedBabies = state.babies.map((item) => {
    if (item.id !== babyId) {
      return item;
    }

    const adjustedNeeds = {
      ...item.needs,
      [targetNeed]: Math.max(0, item.needs[targetNeed] - 70)
    };
    const highestNeed = Math.max(...Object.values(adjustedNeeds));
    const rageLevel = highestNeed <= 60 ? 0 : Math.min(1, (highestNeed - 60) / 40);

    return {
      ...item,
      needs: adjustedNeeds,
      enraged: rageLevel > 0,
      rageLevel,
      attackDamagePerSecond: rageLevel > 0 ? 1.2 + rageLevel * 4.8 : 0,
      cleanupPending: false
    };
  });

  return {
    ...state,
    babies: updatedBabies,
    score: state.score + 1,
    message: targetNeed === 'milk' ? 'Milk delivered. Tiny crisis downgraded.' : 'Caress delivered. Emotional stability improved.'
  };
}

export function completeCleanup(state, babyId) {
  if (state.pendingCleanupBabyId !== babyId) {
    return {
      ...state,
      message: 'Select a baby for cleanup first, then drag diaper to trash.'
    };
  }

  return {
    ...state,
    pendingCleanupBabyId: null,
    score: state.score + 1,
    babies: state.babies.map((baby) => (
      baby.id === babyId
        ? {
          ...baby,
          cleanupPending: false,
          needs: { ...baby.needs, cleanup: 0 },
          enraged: Math.max(baby.needs.milk, baby.needs.caress) > 60,
          rageLevel: Math.max(0, (Math.max(baby.needs.milk, baby.needs.caress) - 60) / 40),
          attackDamagePerSecond: Math.max(baby.needs.milk, baby.needs.caress) > 60
            ? 1.2 + (Math.max(baby.needs.milk, baby.needs.caress) - 60) / 40 * 4.8
            : 0
        }
        : baby
    )),
    message: 'Cleanup complete. Air quality restored.'
  };
}

export function selectTool(state, tool) {
  if (!NEEDS.includes(tool)) {
    return state;
  }

  return {
    ...state,
    selectedTool: tool,
    message: `Tool selected: ${tool}.`
  };
}

export function createDaycareGameApp(doc, win, {
  rng = Math.random,
  intervalMs = 250,
  schedule = (fn) => win.setInterval(fn, intervalMs),
  cancelSchedule = (id) => win.clearInterval(id)
} = {}) {
  const root = doc?.querySelector('[data-daycare-root]');
  if (!doc || !win || !root) {
    return null;
  }

  const board = root.querySelector('[data-daycare-board]');
  const healthFill = root.querySelector('[data-daycare-health-fill]');
  const healthLabel = root.querySelector('[data-daycare-health-label]');
  const stats = root.querySelector('[data-daycare-stats]');
  const message = root.querySelector('[data-daycare-message]');
  const trash = root.querySelector('[data-daycare-trash]');
  const toolButtons = [...root.querySelectorAll('[data-daycare-tool]')];
  const resetButton = root.querySelector('[data-daycare-reset]');

  let state = createInitialDaycareState(rng);

  function render() {
    healthFill.style.width = `${state.health}%`;
    healthLabel.textContent = `${Math.round(state.health)} / 100 HP`;
    stats.textContent = `Babies: ${state.babies.length} | Score: ${state.score} | Failures: ${state.failures} | Failure cost: ${state.failureCost}`;
    message.textContent = state.message;

    toolButtons.forEach((button) => {
      const isSelected = button.dataset.daycareTool === state.selectedTool;
      button.setAttribute('aria-pressed', String(isSelected));
    });

    board.innerHTML = '';

    state.babies.forEach((baby) => {
      const babyEl = doc.createElement('button');
      babyEl.type = 'button';
      babyEl.className = 'daycare-baby';
      babyEl.style.left = `${baby.x}%`;
      babyEl.style.top = `${baby.y}%`;
      babyEl.style.setProperty('--rage-level', String(baby.rageLevel));
      babyEl.dataset.enraged = String(baby.enraged);
      babyEl.dataset.babyId = String(baby.id);
      babyEl.innerHTML = `
        <span class="daycare-baby__bubble">${getNeedEmoji(baby.needs)}</span>
        <span class="daycare-baby__head"></span>
        <span class="daycare-baby__body"></span>
      `;

      babyEl.addEventListener('click', () => {
        state = applyToolToBaby(state, baby.id);
        render();
      });

      if (baby.cleanupPending) {
        const diaper = doc.createElement('span');
        diaper.className = 'daycare-diaper';
        diaper.textContent = '🧷';
        diaper.draggable = true;
        diaper.dataset.babyId = String(baby.id);
        diaper.addEventListener('dragstart', (event) => {
          event.dataTransfer?.setData('text/plain', String(baby.id));
        });
        babyEl.appendChild(diaper);
      }

      board.appendChild(babyEl);
    });

    root.dataset.gameOver = String(state.gameOver);
  }

  toolButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state = selectTool(state, button.dataset.daycareTool);
      render();
    });
  });

  trash.addEventListener('dragover', (event) => {
    event.preventDefault();
  });

  trash.addEventListener('drop', (event) => {
    event.preventDefault();
    const rawId = event.dataTransfer?.getData('text/plain');
    const babyId = Number.parseInt(rawId ?? '', 10);
    state = completeCleanup(state, babyId);
    render();
  });

  resetButton?.addEventListener('click', () => {
    root.classList.remove('daycare-reset-pulse');
    void root.offsetWidth;
    root.classList.add('daycare-reset-pulse');
    state = createInitialDaycareState(rng);
    render();
  });

  const timerId = schedule(() => {
    state = tickDaycareState(state, intervalMs, rng);
    render();
  });

  render();

  return {
    getState: () => state,
    destroy() {
      cancelSchedule(timerId);
    }
  };
}

export function initDaycareGame(doc = document, win = window) {
  return createDaycareGameApp(doc, win);
}
