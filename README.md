# GA Walker — Aprendizaje de Avatar con Algoritmo Genético

Este proyecto implementa una aplicación web donde un avatar aprende a caminar y saltar obstáculos usando un **Algoritmo Genético (GA)**.

---

## 📋 Descripción del Problema

**Objetivo:** Desarrollar una aplicación donde un avatar aprenda a realizar acciones como:

- Caminar
- Saltar para evitar obstáculos
- Maximizar distancia recorrida

**Restricciones:**

- Mundo 2D con gravedad
- Obstáculos aleatorios pero determinísticos
- Secuencia fija de 120 acciones por individuo

---

## 🧬 Componentes del Algoritmo Genético

### 1. Representación de la Solución

**Cromosoma:** Lista de 120 genes (acciones discretas)

```python
Alelos (acciones posibles):
0: Idle        (reposo, aplica fricción)
1: Move Right  (avance constante a la derecha)
2: Move Left   (retroceso a la izquierda)
3: Jump        (salto vertical si está en piso)
4: Jump Right  (salto + avance derecha)
5: Jump Left   (salto + retroceso izquierda)
```

**Espacio de búsqueda:** 6^120 ≈ 6.5 × 10^93 posibles soluciones

### 2. Función de Aptitud (Fitness)

Cada individuo se evalúa según una **función multi-componente**:

```
Fitness = distance_score - collision_penalty + clearance_bonus
          + efficiency_bonus - left_penalty - wasted_jump_penalty
          - smoothness_penalty
```

**Componentes:**

- **distance_score** (0-100): Distancia recorrida hacia la derecha
- **collision_penalty** (-∞): -12 puntos por cada colisión
- **clearance_bonus**: +8 por cada obstáculo saltado sin impacto
- **efficiency_bonus** (0-10): Supervivencia del individuo
- **left_penalty**: -0.25 por cada movimiento a la izquierda (desincentiva retroceso)
- **wasted_jump_penalty**: -0.6 por saltos no utilizados para obstáculos
- **smoothness_penalty**: -0.35 por cambio de dirección (penaliza comportamiento errático)

**Interpretación:** Mayor fitness = mejor desempeño. El GA **maximiza** esta puntuación.

---

## 🔬 Métodos Genéticos Implementados

### 2.1 Inicialización de Población

#### Método Actual: Inicialización Hybrid (Tier 1 ✓ Implementado)

```python
70% Biased + 30% Random
- 70% de individuos: sesgo hacia derecha/saltos (explotación inicial)
- 30% de individuos: completamente aleatorios (diversidad)
```

---

### 2.2 Selección de Padres

#### Método Actual: Tournament Selection

```python
k = 4 (tamaño del torneo)
Seleccionar 4 individuos aleatorios → devolver el mejor
```

---

### 2.3 Crossover (Recombinación)

#### Método Actual: Multi-Point Crossover (Tier 1 ✓ Implementado)

```python
num_points = 3  (default)
Seleccionar 3 puntos de cruce aleatorios
Intercambiar segmentos entre padres
```

**Ejemplo:**

```
Padre 1: [1 1 1 | 3 3 3 | 1 1 1 | 4 4 4]
Padre 2: [2 2 2 | 4 4 4 | 2 2 2 | 3 3 3]
                ↓       ↓       ↓
Hijo 1:  [1 1 1 | 4 4 4 | 1 1 1 | 4 4 4]
Hijo 2:  [2 2 2 | 3 3 3 | 2 2 2 | 3 3 3]
```

---

### 2.4 Mutación

#### Método Actual: Per-Gene Mutation Adaptativa (Tier 1 ✓ Implementado)

```python
rate_adaptativa = base_rate * (0.1 + 1.9 * (1 - gen / total_gens))
```

**Comportamiento:**

- **Inicio (gen=0):** rate ≈ 2.0 × base_rate (máxima exploración)
- **Final (gen=total):** rate ≈ 0.1 × base_rate (refinamiento)

---

### 2.5 Selección de Supervivientes (Replacement)

#### Método Actual: Elitismo

```python
n_elite = max(1, int(pop_size * elite_size))
Preservar los n_elite mejores individuos en la siguiente generación
```

---

## 📊 Problemas Abordados: Intensificación vs Diversificación

### Problema 1: Convergencia Prematura

**Síntoma:** La población converge a un óptimo local débil temprano, sin mejorar después.

**Causas:**

- Tasa de mutación fija insuficiente en etapas finales
- Inicialización demasiado sesgada → población muy similar
- Tournament selection con k alto → excesiva presión selectiva

**Soluciones Implementadas (Tier 1):**

| Solución                           | Implementada | Beneficio                                       |
| ---------------------------------- | :----------: | ----------------------------------------------- |
| Inicialización Hybrid (70% + 30%)  |      ✅      | +Diversidad inicial sin sacrificar convergencia |
| Mutación Adaptativa (↓ con tiempo) |      ✅      | +Exploración temprana, +Refinamiento tardío     |
| Multi-point Crossover (3 puntos)   |      ✅      | +Mezcla de genes, +Preserva building blocks     |

**Resultado en Pruebas:**

```
Configuración clásica (biased + fixed rate + 2-point): fitness = 21.74
Tier 1 (hybrid + adaptive + 3-point):                 fitness = 58.81
Mejora: +170.5%
```

### Problema 2: Pérdida de Diversidad

**Síntoma:** Población converge a individuos muy similares; no hay exploración de nuevas regiones.

**Causas:**

- Elitismo fuerte → copia de elite en cada generación
- Inicialización sesgada → poco material genético diverso

**Soluciones NO Implementadas (Tier 2+):**

| Solución                   | Mejora Esperada | Complejidad |
| -------------------------- | :-------------: | :---------: |
| Niching (especiación)      |     +30-40%     |  Moderada   |
| Crowding determinístico    |     +20-30%     |    Baja     |
| Simulated Annealing hybrid |     +25-35%     |  Moderada   |
| Self-adaptive mutation     |     +30-50%     |    Alta     |

---

## 📈 Resultados Empíricos

### Configuración Actual (Tier 1)

```
Generaciones:      1000
Tamaño población:  80
Tasa mutación:     0.15 (adaptativa)
Crossover puntos:  3
Élite:             15%
Init strategy:     hybrid
```

**Comportamiento Esperado:**

- Generación 0-200: Mejora rápida (exploración + explotación inicial)
- Generación 200-600: Mejora gradual (balance dinámico)
- Generación 600-1000: Refinamiento fino (explotación dominante)

**Métrica de Convergencia:**

```
std_fitness (desviación estándar) disminuye con generaciones
→ Población se concentra alrededor del mejor individuo
```

---

## 🚀 Cómo Ejecutar

### Instalación

```bash
python -m pip install -r requirements.txt
```

### Servidor

```bash
python app.py
```

Abre en navegador:

```
http://127.0.0.1:5000
```

### Parámetros en UI

- **Generaciones:** 100-2000 (default 1000)
- **Población:** 20-200 (default 80)
- **Tasa Mutación:** 0.01-0.5 (default 0.15)
- **Élite:** 5%-40% (default 15%)
- **Velocidad reproducción:** 8-200ms (default 60ms)

## 📁 Estructura del Proyecto

```
trabajo-ia/
├── genetic_algorithm.py    # GA core, simulación física
├── app.py                  # Flask backend, SSE streaming
├── index.html              # Frontend HTML
├── app.js                  # Control GA, visualización charts
├── world.js                # Renderer Canvas, animación avatar
├── requirements.txt        # Dependencias Python
├── README.md               # Esta documentación
├── ANALISIS_GA.md          # Análisis detallado técnico
└── .gitignore              # Exclusiones git
```

---

## 📚 Referencias Teóricas

- **Building Block Hypothesis:** Goldberg, D. (1989) - Genetic Algorithms in Search
- **Premature Convergence:** Michalewicz, Z. (1996) - Genetic Algorithms + Data Structures
- **Multi-Point Crossover:** Spears, W.M. & De Jong, K.A. (1991)
- **Adaptive Mutation:** Bäck, T. (1996) - Evolutionary Algorithms in Theory and Practice
