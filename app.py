from flask import Flask, render_template, request, jsonify
import time

app = Flask(__name__, static_folder='static', template_folder='templates')


def naive_search(text: str, pattern: str):
    n, m = len(text), len(pattern)
    matches = []
    comparisons = 0
    steps = []  # descriptive step-by-step for UI
    if m == 0:
        return matches, comparisons, steps

    for i in range(0, n - m + 1):
        matched = True
        step_desc = {"window": i, "verifications": []}
        for j in range(m):
            comparisons += 1
            char_ok = (text[i + j] == pattern[j])
            step_desc["verifications"].append({
                "t_index": i + j,
                "t_char": text[i + j],
                "p_index": j,
                "p_char": pattern[j],
                "equal": char_ok
            })
            if not char_ok:
                matched = False
                break
        if matched:
            matches.append(i)
        steps.append(step_desc)
    return matches, comparisons, steps


def rabin_karp_search(text: str, pattern: str, d: int = 256, q: int = 101):
    n, m = len(text), len(pattern)
    matches = []
    hash_comparisons = 0
    char_comparisons = 0
    steps = []

    if m == 0:
        return matches, hash_comparisons, char_comparisons, steps
    if m > n:
        return matches, hash_comparisons, char_comparisons, steps

    h = pow(d, m - 1) % q
    p = 0
    t = 0
    # initial hash
    for i in range(m):
        p = (d * p + ord(pattern[i])) % q
        t = (d * t + ord(text[i])) % q

    for i in range(0, n - m + 1):
        hash_comparisons += 1
        step_desc = {"window": i, "t_hash": t, "p_hash": p, "verified": None, "verifications": []}
        if p == t:
            # verify characters
            verified = True
            for j in range(m):
                char_comparisons += 1
                equal = (text[i + j] == pattern[j])
                step_desc["verifications"].append({
                    "t_index": i + j,
                    "t_char": text[i + j],
                    "p_index": j,
                    "p_char": pattern[j],
                    "equal": equal
                })
                if not equal:
                    verified = False
                    break
            step_desc["verified"] = verified
            if verified:
                matches.append(i)
        else:
            # no verification, but indicate skip
            step_desc["verifications"].append({
                "note": "hash_mismatch"
            })

        if i < n - m:
            t = (d * (t - ord(text[i]) * h) + ord(text[i + m])) % q
            if t < 0:
                t += q
        steps.append(step_desc)

    return matches, hash_comparisons, char_comparisons, steps


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/match', methods=['POST'])
def match():
    payload = request.json or {}
    text = payload.get('text', '')
    pattern = payload.get('pattern', '')

    # naive
    t0 = time.perf_counter()
    naive_matches, naive_comps, naive_steps = naive_search(text, pattern)
    t1 = time.perf_counter()

    # rabin karp
    t2 = time.perf_counter()
    rk_matches, rk_hashes, rk_char_comps, rk_steps = rabin_karp_search(text, pattern)
    t3 = time.perf_counter()

    result = {
        "text": text,
        "pattern": pattern,
        "naive": {
            "matches": naive_matches,
            "comparisons": naive_comps,
            "time_ms": round((t1 - t0) * 1000, 6),
            "steps": naive_steps
        },
        "rabin_karp": {
            "matches": rk_matches,
            "hash_comparisons": rk_hashes,
            "char_comparisons": rk_char_comps,
            "time_ms": round((t3 - t2) * 1000, 6),
            "steps": rk_steps
        }
    }
    return jsonify(result)


if __name__ == '__main__':
    app.run(debug=True)

