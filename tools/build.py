"""Baut aus src/ eine einzelne HTML-Datei (dist/finanzplan.html), die ohne Server offline läuft."""
import os, re
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
src = lambda n: open(os.path.join(root, "src", n), encoding="utf-8").read()
html = src("index.html")
for name in ("data.js", "model.js", "app.js"):
    html = html.replace(f'<script src="{name}"></script>', "<script>\n" + src(name).replace("</script", "<\\/script") + "\n</script>")
os.makedirs(os.path.join(root, "dist"), exist_ok=True)
out = os.path.join(root, "dist", "finanzplan.html")
open(out, "w", encoding="utf-8").write(html)
print("geschrieben:", out, len(html)//1024, "KB")
