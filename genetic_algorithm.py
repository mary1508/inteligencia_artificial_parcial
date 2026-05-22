"""
Genetic Algorithm for Avatar Walking/Jumping
Chromosome: sequence of actions [move_right, jump, move_left, idle]
Each gene encodes a discrete action the avatar will take at each timestep.
"""

import random
import numpy as np
import json

history = []

# ── Action space ──────────────────────────────────────────────────────────────
ACTIONS = {
    0: "idle",
    1: "move_right",
    2: "move_left",
    3: "jump",
    4: "jump_right",
    5: "jump_left",
}
N_ACTIONS = len(ACTIONS)

# ── World constants ───────────────────────────────────────────────────────────
WORLD_WIDTH   = 1200   # px
AVATAR_X_START = 60
GRAVITY       = 1.2
JUMP_FORCE    = -16
MOVE_SPEED    = 6
FLOOR_Y       = 340
CHROMOSOME_LEN = 120   # timesteps per individual


# ── Obstacle generator (deterministic by seed) ───────────────────────────────
def generate_obstacles(seed: int = 42):
    rng = random.Random(seed)
    obstacles = []
    x = 200
    while x < WORLD_WIDTH - 100:
        w = rng.randint(30, 70)
        h = rng.randint(20, 55)
        obstacles.append({"x": x, "y": FLOOR_Y - h, "w": w, "h": h})
        x += rng.randint(90, 180)
    return obstacles


OBSTACLES = generate_obstacles(seed=42)


# ── Physics simulation ────────────────────────────────────────────────────────
def simulate(chromosome: list[int]) -> dict:
    """
    Simulate the avatar following the chromosome actions.
    Returns a dict with trajectory, fitness components, and events.
    """
    x, y      = float(AVATAR_X_START), float(FLOOR_Y)
    vx, vy    = 0.0, 0.0
    on_ground = True
    collisions = 0
    max_x     = x
    trajectory = []
    jump_count = 0
    steps_survived = 0

    for t, action in enumerate(chromosome):
        # Apply action
        if action == 1:   # move right
            vx = MOVE_SPEED
        elif action == 2:  # move left
            vx = -MOVE_SPEED
        elif action == 3 and on_ground:  # jump
            vy = JUMP_FORCE; on_ground = False; jump_count += 1
        elif action == 4:  # jump right
            vx = MOVE_SPEED
            if on_ground:
                vy = JUMP_FORCE; on_ground = False; jump_count += 1
        elif action == 5:  # jump left
            vx = -MOVE_SPEED
            if on_ground:
                vy = JUMP_FORCE; on_ground = False; jump_count += 1
        else:             # idle
            vx *= 0.7     # friction

        # Gravity
        vy += GRAVITY
        x  += vx
        y  += vy

        # Floor collision
        if y >= FLOOR_Y:
            y = FLOOR_Y; vy = 0; on_ground = True

        # Clamp to world
        x = max(0, min(WORLD_WIDTH - 30, x))

        # Obstacle collision
        hit = False
        for obs in OBSTACLES:
            if (obs["x"] < x + 28 < obs["x"] + obs["w"] or
                obs["x"] < x      < obs["x"] + obs["w"]):
                if (obs["y"] < y + 10 and y + 10 < obs["y"] + obs["h"] + 5):
                    hit = True
                    break
        if hit:
            collisions += 1
            vx = -vx * 0.5   # bounce back

        max_x = max(max_x, x)
        steps_survived += 1

        trajectory.append({
            "t": t, "x": round(x, 1), "y": round(y, 1),
            "action": ACTIONS[action], "hit": hit
        })

    # ── Post-simulation analysis: clearances, motion stats ───────────────────
    cleared = 0
    for obs in OBSTACLES:
        passed = any(f['x'] > (obs['x'] + obs['w']) for f in trajectory)
        hit_during = any((obs['x'] < f['x'] < obs['x'] + obs['w']) and f['hit'] for f in trajectory)
        if passed and not hit_during:
            cleared += 1

    left_moves = sum(1 for a in chromosome if a == 2)
    # direction changes between left/right movement
    dir_changes = 0
    prev = None
    for a in chromosome:
        if a in (1, 2):
            if prev is None:
                prev = a
            else:
                if a != prev:
                    dir_changes += 1
                    prev = a

    # ── Fitness function (weighted, normalized) ──────────────────────────────
    distance_score      = (max_x - AVATAR_X_START) / WORLD_WIDTH * 100
    collision_penalty   = collisions * 12.0
    clearance_bonus     = cleared * 8.0
    efficiency_bonus    = (steps_survived / CHROMOSOME_LEN) * 10.0
    left_penalty        = left_moves * 0.25
    wasted_jump_penalty = max(0, (jump_count - cleared)) * 0.6
    smoothness_penalty  = dir_changes * 0.35

    fitness = (
        distance_score
        - collision_penalty
        + clearance_bonus
        + efficiency_bonus
        - left_penalty
        - wasted_jump_penalty
        - smoothness_penalty
    )

    fitness = max(0.0, round(fitness, 4))

    return {
        "trajectory": trajectory,
        "fitness": fitness,
        "max_x": round(max_x, 1),
        "collisions": collisions,
        "jumps": jump_count,
        "cleared": cleared,
        "left_moves": left_moves,
        "dir_changes": dir_changes,
    }


# ── Population initialization (random) ───────────────────────────────────────
def build_population(pop_size: int) -> list[list[int]]:
    """Random initialization with bias toward move_right and jump_right."""
    weights = [0.05, 0.35, 0.05, 0.10, 0.40, 0.05]  # favor right movement
    return [
        random.choices(range(N_ACTIONS), weights=weights, k=CHROMOSOME_LEN)
        for _ in range(pop_size)
    ]


# ── Selection ─────────────────────────────────────────────────────────────────
def tournament_selection(population: list, fitnesses: list[float], k: int = 4) -> list[int]:
    """Tournament selection: pick k random, return best."""
    indices = random.sample(range(len(population)), k)
    best = max(indices, key=lambda i: fitnesses[i])
    return population[best][:]


def select_elite(population: list, fitnesses: list[float], n: int) -> tuple:
    """Return top-n individuals (elitism)."""
    sorted_idx = sorted(range(len(fitnesses)), key=lambda i: fitnesses[i], reverse=True)
    elite_idx  = sorted_idx[:n]
    return [population[i][:] for i in elite_idx], elite_idx


# ── Crossover ─────────────────────────────────────────────────────────────────
def crossover_two_points(p1: list[int], p2: list[int]) -> tuple[list[int], list[int]]:
    """Two-point crossover."""
    if len(p1) < 3:
        return p1[:], p2[:]
    a, b = sorted(random.sample(range(1, len(p1)), 2))
    c1 = p1[:a] + p2[a:b] + p1[b:]
    c2 = p2[:a] + p1[a:b] + p2[b:]
    return c1, c2


# ── Mutation ──────────────────────────────────────────────────────────────────
def mutate(chromosome: list[int], rate: float = 0.1) -> list[int]:
    """
    Per-gene mutation with adaptive strategy:
    - If near an obstacle → bias toward jump actions
    - Otherwise → random action
    """
    chrom = chromosome[:]
    for i in range(len(chrom)):
        if random.random() < rate:
            chrom[i] = random.randint(0, N_ACTIONS - 1)
    return chrom


# ── Main GA loop ──────────────────────────────────────────────────────────────
def genetic_algorithm(
    mutation_rate: float = 0.15,
    generations:   int   = 200,
    pop_size:      int   = 80,
    elite_size:    float = 0.15,
    progress_cb=None,
):
    """
    Run the GA. progress_cb(gen, best_fitness, avg_fitness, best_chrom) called every 10 gens.
    Returns (best_chromosome, best_fitness, history, best_result).
    """
    global history
    history = []
    population = build_population(pop_size)
    all_results  = [simulate(ind) for ind in population]
    all_fitness  = [r["fitness"] for r in all_results]

    n_elite = max(1, int(pop_size * elite_size))

    for generation in range(generations):
        new_population = []

        # 1. Elitism
        elite, _ = select_elite(population, all_fitness, n_elite)
        new_population.extend(elite)

        # 2. Crossover + Mutation
        while len(new_population) < pop_size:
            p1 = tournament_selection(population, all_fitness)
            p2 = tournament_selection(population, all_fitness)
            c1, c2 = crossover_two_points(p1, p2)

            if random.random() < mutation_rate:
                c1 = mutate(c1, rate=0.12)
            if random.random() < mutation_rate:
                c2 = mutate(c2, rate=0.12)

            new_population.extend([c1, c2])

        population    = new_population[:pop_size]
        all_results   = [simulate(ind) for ind in population]
        all_fitness   = [r["fitness"] for r in all_results]

        best_idx     = int(np.argmax(all_fitness))
        best_fitness = all_fitness[best_idx]
        avg_fitness  = float(np.mean(all_fitness))
        std_fitness  = float(np.std(all_fitness))
        med_fitness  = float(np.median(all_fitness))

        best_result = all_results[best_idx]

        entry = {
            "generation": generation,
            "best_fitness": round(best_fitness, 3),
            "avg_fitness":  round(avg_fitness, 3),
            "std_fitness":  round(std_fitness, 3),
            "med_fitness":  round(med_fitness, 3),
            "best_collisions": best_result.get("collisions", 0),
            "best_max_x": best_result.get("max_x", 0),
            "best_jumps": best_result.get("jumps", 0),
            "best_cleared": best_result.get("cleared", 0),
        }
        history.append(entry)
        if progress_cb:
            progress_cb(entry, population[best_idx])

    best_idx  = int(np.argmax(all_fitness))
    return population[best_idx], all_fitness[best_idx], history, all_results[best_idx]