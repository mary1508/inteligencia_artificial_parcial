# GA Walker — Aprendizaje de Avatar con Algoritmo Genético

Este proyecto implementa una aplicación web donde un avatar aprende a caminar y saltar obstáculos usando un Algoritmo Genético.

## Qué hace

- Genera poblaciones de secuencias de acciones (idle, move_right, move_left, jump, jump_right, jump_left).
- Simula cada individuo en un mundo con obstáculos.
- Evalúa su fitness según distancia recorrida, penalización por colisiones y eficiencia.
- Emplea elitismo, selección por torneo, crossover de dos puntos y mutación.
- Visualiza la evolución en una interfaz web con gráficas y animación del avatar.

## Archivos principales

- `app.py`: servidor Flask y endpoints para inicio de GA, streaming SSE y simulación.
- `genetic_algorithm.py`: simulación física, definición de acciones, GA y función `genetic_algorithm()`.
- `index.html`: interfaz web del proyecto.
- `app.js`: controla la interacción y muestra los datos de la evolución.
- `world.js`: renderizado Canvas del avatar y el mundo.

## Requisitos

- Python 3.10+ (se usó Python 3.13)
- Paquetes: `flask`, `numpy`

Instalar dependencias:

```bash
python -m pip install -r requirements.txt
```

## Ejecución

```bash
python app.py
```

Luego abre en el navegador:

```text
http://127.0.0.1:5000
```

## Cómo funciona el GA

- Inicialización: población aleatoria con sesgo hacia acciones de avance y salto hacia la derecha.
- Selección: torneo de 4 individuos para elegir padres.
- Crossover: cruces de dos puntos.
- Mutación: reemplazo aleatorio de genes con tasa de mutación.
- Elitismo: conserva el mejor porcentaje de la población en cada generación.

## Qué representa la solución

- Cromosoma: lista de 120 acciones discretas.
- Fitness: `distancia - colisiones*5 + bonus_eficiencia`.
- Objetivo: alcanzar el mayor desplazamiento posible hacia la derecha evitando obstáculos.

## Subir a GitHub

1. Inicializa el repositorio:

```bash
git init
```

2. Añade archivos:

```bash
git add .
```

3. Haz commit:

```bash
git commit -m "Implement GA Walker con Flask y visualización web"
```

4. Crea un repositorio en GitHub (por ejemplo `ga-walker`).

5. Conecta tu repositorio local al remoto:

```bash
git remote add origin https://github.com/TU_USUARIO/ga-walker.git
```

6. Envía los cambios:

```bash
git branch -M main
 git push -u origin main
```

## Nota

El servidor está listo y funcionando. Si deseas, puedo crear también un `.gitignore` para excluir `__pycache__/` y entornos virtuales.
