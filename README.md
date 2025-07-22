# TemplateParamScanner.js
(function () {
  if (mw.config.get("wgAction") !== "view" || mw.config.get("wgNamespaceNumber") < 0) return;

  function findDuplicates(wikitext) {
    const templateRegex = /\{\{([^{}]*?\|[^{}]*?)\}\}/gs;
    const ignoreTemplates = ["cite web", "cite news", "cite book", "citation"];
    const result = [];

    let match;
    while ((match = templateRegex.exec(wikitext)) !== null) {
      const full = match[1];
      const parts = full.split("|");
      const name = parts.shift().trim().toLowerCase();

      if (ignoreTemplates.includes(name)) continue;

      const seen = {};
      const duplicates = [];
      for (const param of parts) {
        const key = param.split("=")[0].trim();
        if (key === "") continue;
        if (seen[key]) {
          duplicates.push(key);
        } else {
          seen[key] = true;
        }
      }

      if (duplicates.length) {
        result.push({ name, duplicates });
      }
    }

    return result;
  }

  function showPopup(dupes) {
    const div = document.createElement("div");
    div.style.cssText = "position:fixed;top:20%;left:50%;transform:translateX(-50%);background:white;padding:20px;max-height:60%;overflow:auto;border:2px solid #888;box-shadow:0 0 10px rgba(0,0,0,0.5);z-index:9999;border-radius:8px;";
    const title = document.createElement("h3");
    title.textContent = "డూప్లికేట్ మూస పేరామితులు";
    div.appendChild(title);

    if (!dupes.length) {
      div.appendChild(document.createTextNode("డూప్లికేట్ మూస పేరామితులు ఏవీ కనిపించలేదు."));
    } else {
      dupes.forEach((tpl, i) => {
        const p = document.createElement("p");
        p.innerHTML = `<b>${i + 1}) ${tpl.name}</b>: ${tpl.duplicates.join(", ")}`;
        p.style.color = "red";
        div.appendChild(p);
      });
      const note = document.createElement("p");
      note.style.fontSize = "smaller";
      note.style.marginTop = "10px";
      note.innerHTML = "ఈ డూప్లికేట్ పేరామితులు వ్యాసంలో చివర భాగంలోని మూసలలో ఉండవచ్చు, కనుక వాటిని సోర్స్ ఎడిట్ మోడ్‌లో పరిశీలించండి.";
      div.appendChild(note);
    }

    const ok = document.createElement("button");
    ok.textContent = "OK";
    ok.onclick = () => div.remove();
    ok.style.marginTop = "10px";
    div.appendChild(ok);

    document.body.appendChild(div);
  }

  function addButton() {
    const toolbar = document.getElementById("wpTextbox1");
    if (!toolbar) return;

    const btn = document.createElement("button");
    btn.textContent = "Check duplicate parameters";
    btn.type = "button";
    btn.style.marginLeft = "8px";
    btn.onclick = () => {
      const text = document.getElementById("wpTextbox1").value;
      const dupes = findDuplicates(text);
      showPopup(dupes);
    };

    toolbar.parentNode.insertBefore(btn, toolbar.nextSibling);
  }

  mw.loader.using("mediawiki.util", addButton);
})();
