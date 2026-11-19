import sys, json, time, resource
engine = sys.argv[1]
CASES = [
 ("Dámelo ahora.", "dámelo", "dar"),
 ("Quiero decírselo mañana.", "decírselo", "decir"),
 ("Ella vivía en una casa pequeña.", "vivía", "vivir"),
 ("El lobo le dijo que se fuera.", "dijo", "decir"),
 ("Estaba corriendo por el camino.", "corriendo", "correr"),
 ("Estaba corriendo por el camino.", "estaba", "estar"),
 ("Si hubiéramos sabido, habríamos venido.", "hubiéramos", "haber"),
 ("Si hubiéramos sabido, habríamos venido.", "sabido", "saber"),
 ("Si hubiéramos sabido, habríamos venido.", "habríamos", "haber"),
 ("Si hubiéramos sabido, habríamos venido.", "venido", "venir"),
 ("Los niños pequeños salían temprano.", "niños", "niño"),
 ("Los niños pequeños salían temprano.", "pequeños", "pequeño"),
 ("Los niños pequeños salían temprano.", "salían", "salir"),
 ("Voy a dártelo cuando llegues.", "dártelo", "dar"),
 ("Voy a dártelo cuando llegues.", "llegues", "llegar"),
 ("Se lo dije ayer.", "dije", "decir"),
 ("Las mujeres quieren comprarlas.", "mujeres", "mujer"),
 ("Las mujeres quieren comprarlas.", "quieren", "querer"),
 ("Las mujeres quieren comprarlas.", "comprarlas", "comprar"),
 ("Dile la verdad.", "dile", "decir"),
 ("Pensaba llegar antes que ella.", "pensaba", "pensar"),
 ("¿Adónde vas tan temprano?", "vas", "ir"),
 ("Están hablándonos.", "hablándonos", "hablar"),
 ("Me lo estaba diciendo.", "diciendo", "decir"),
 ("Nos fuimos corriendo por el camino más corto.", "fuimos", "ir"),
 ("Tráemelo cuando puedas.", "tráemelo", "traer"),
]
if engine == "spacy_md" or engine == "spacy_trf":
    import spacy
    t0 = time.time()
    nlp = spacy.load("es_core_news_md" if engine == "spacy_md" else "es_dep_news_trf")
    load_s = time.time() - t0
    def run(text):
        return [(t.text, t.lemma_, t.pos_) for t in nlp(text)]
else:
    import stanza, os
    t0 = time.time()
    nlp = stanza.Pipeline("es", processors="tokenize,mwt,pos,lemma,depparse",
                          dir=os.environ["STANZA_RESOURCES_DIR"], verbose=False, download_method=None)
    load_s = time.time() - t0
    def run(text):
        doc = nlp(text)
        return [(w.text, w.lemma, w.upos) for s in doc.sentences for w in s.words]
ok = 0; rows = []
for sent, target, exp in CASES:
    toks = run(sent)
    tl = target.lower()
    cands = [(t, l) for t, l, p in toks if t.lower() == tl or (len(t) >= 2 and tl.startswith(t.lower()))]
    got = [l.lower() for t, l in cands]
    hit = exp in got
    ok += hit
    rows.append({"sent": sent, "target": target, "expected": exp, "got": [f"{t}→{l}" for t, l in cands], "ok": hit})
# speed on ~800 tokens
text = " ".join(c[0] for c in CASES) * 4
n_tok = len(run(text[:10]))  # warm-up
t1 = time.time(); toks = run(text); dt = time.time() - t1
res = {"engine": engine, "correct": ok, "total": len(CASES), "load_seconds": round(load_s, 1),
       "tokens_timed": len(toks), "seconds_for_tokens": round(dt, 2),
       "tokens_per_second": round(len(toks) / dt),
       "peak_rss_mb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6) , "rows": rows}
json.dump(res, open(f"golden_{engine}.json", "w"), ensure_ascii=False, indent=1)
print(engine, f"{ok}/{len(CASES)}", "load", res["load_seconds"], "s", res["tokens_per_second"], "tok/s", "peak", res["peak_rss_mb"], "MB")
