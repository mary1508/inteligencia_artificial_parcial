"""
Flask backend — serves the web app and streams GA progress via SSE.
"""
import json
import queue
import threading
import time

from flask import Flask, Response, jsonify, render_template, request

from genetic_algorithm import (
    OBSTACLES,
    genetic_algorithm,
    simulate,
    CHROMOSOME_LEN,
    N_ACTIONS,
    WORLD_WIDTH,
    FLOOR_Y,
)

app = Flask(
    __name__,
    template_folder='.',
    static_folder='.',
    static_url_path='/static',
)

# Global state
_run_queue: queue.Queue = queue.Queue()
_best_chromosome = None
_best_result     = None
_ga_running      = False
_history         = []


# ─────────────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/obstacles")
def get_obstacles():
    return jsonify({"obstacles": OBSTACLES, "world_width": WORLD_WIDTH, "floor_y": FLOOR_Y})


@app.route("/run", methods=["POST"])
def run_ga():
    global _ga_running, _best_chromosome, _best_result, _history
    if _ga_running:
        return jsonify({"error": "GA already running"}), 409

    data = request.json or {}
    params = {
        "mutation_rate": float(data.get("mutation_rate", 0.15)),
        "generations":   int(data.get("generations",   1000)),
        "pop_size":      int(data.get("pop_size",       60)),
        "elite_size":    float(data.get("elite_size",  0.15)),
        # Tier 1 improvements
        "init_strategy": data.get("init_strategy", "hybrid"),  # 'hybrid', 'biased', 'random'
        "adaptive_mutation": data.get("adaptive_mutation", True),  # True/False
        "crossover_points": int(data.get("crossover_points", 3)),  # 2, 3, 5, etc.
    }

    _ga_running = True
    _history    = []

    def run():
        global _ga_running, _best_chromosome, _best_result, _history

        def cb(entry, best_chrom, pop=None):
            _run_queue.put({"type": "progress", "data": entry, "chrom": best_chrom, "pop": pop})
            

        chrom, fit, hist, result = genetic_algorithm(progress_cb=cb, **params)
        _best_chromosome = chrom
        _best_result     = result
        _history         = hist
        _ga_running      = False
        _run_queue.put({"type": "done", "fitness": fit, "chrom": chrom, "result": result})

    t = threading.Thread(target=run, daemon=True)
    t.start()
    return jsonify({"status": "started"})


@app.route("/stream")
def stream():
    """SSE endpoint — sends GA progress events."""
    def generate():
        yield "data: {\"type\": \"connected\"}\n\n"
        while True:
            try:
                msg = _run_queue.get(timeout=30)
                # Don't send full chromosome in progress events (too large)
                out = {k: v for k, v in msg.items() if k != "chrom"}
                yield f"data: {json.dumps(out)}\n\n"
                if msg["type"] == "done":
                    break
            except queue.Empty:
                yield "data: {\"type\": \"ping\"}\n\n"

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/best")
def get_best():
    if _best_chromosome is None:
        return jsonify({"error": "No solution yet"}), 404
    return jsonify({
        "chromosome": _best_chromosome,
        "result": _best_result,
        "history": _history,
    })


@app.route("/simulate", methods=["POST"])
def run_simulate():
    """Simulate a custom chromosome sent from the frontend."""
    data  = request.json or {}
    chrom = data.get("chromosome", [])
    if not chrom:
        return jsonify({"error": "No chromosome provided"}), 400
    result = simulate(chrom)
    return jsonify(result)


@app.route("/status")
def status():
    return jsonify({"running": _ga_running, "has_best": _best_chromosome is not None})


if __name__ == "__main__":
    app.run(debug=True, threaded=True, port=5000)