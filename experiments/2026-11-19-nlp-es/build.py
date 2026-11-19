import sys, json, gzip, time
t0 = time.time()
n = 0; lemma_entries = 0; formof_entries = 0
lemmas = {}      # word -> list of [pos, ipa, [glosses]]
forms = {}       # surface -> set(lemma)
def add_form(f, l):
    if f == l: return
    forms.setdefault(f, set()).add(l)
for line in sys.stdin:
    n += 1
    d = json.loads(line)
    w = d.get("word"); pos = d.get("pos")
    senses = d.get("senses") or []
    fo = [s for s in senses if s.get("form_of")]
    if senses and len(fo) == len(senses):
        formof_entries += 1
        for s in fo:
            for t in s["form_of"]:
                if t.get("word"): add_form(w, t["word"])
        continue
    lemma_entries += 1
    ipa = ""
    for s in d.get("sounds") or []:
        if s.get("ipa"): ipa = s["ipa"]; break
    gl = []
    for s in senses:
        g = (s.get("glosses") or [""])[0]
        if g and len(gl) < 3: gl.append(g[:100])
    lemmas.setdefault(w, []).append([pos, ipa, gl])
    for f in d.get("forms") or []:
        fw = f.get("form")
        if fw and " " not in fw and fw not in ("-", "no-table-tags", "inflection-template"):
            add_form(fw, w)
out = {"lemmas": lemmas, "forms": {k: sorted(v) for k, v in forms.items()}}
raw = json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode()
gz = gzip.compress(raw, 9)
fo_only = json.dumps(out["forms"], ensure_ascii=False, separators=(",", ":")).encode()
lm_only = json.dumps(out["lemmas"], ensure_ascii=False, separators=(",", ":")).encode()
json.dump({"lines": n, "lemma_entries": lemma_entries, "formof_entries": formof_entries,
           "distinct_lemma_words": len(lemmas), "distinct_forms": len(forms),
           "pack_json_bytes": len(raw), "pack_gzip_bytes": len(gz),
           "lemmas_json_bytes": len(lm_only), "lemmas_gzip_bytes": len(gzip.compress(lm_only, 9)),
           "forms_json_bytes": len(fo_only), "forms_gzip_bytes": len(gzip.compress(fo_only, 9)),
           "seconds": round(time.time() - t0, 1)}, open(sys.argv[1], "w"), indent=1)
probe = ["dámelo","decírselo","dijo","vivía","dándoselo","fue","vas","hubiéramos","niñas","salía","dame","pensaba","corriendo"]
res = {p: out["forms"].get(p) or ("(lemma)" if p in lemmas else None) for p in probe}
json.dump(res, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
