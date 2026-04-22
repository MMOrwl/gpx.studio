# conciergeOS-Bridge-Patch

Dieser Fork hat einen Patch in `website/src/lib/components/export/utils.svelte.ts`,
der den GPX-Export-Flow erweitert: wenn die URL einen `save_url`-Query-
Parameter enthält, POSTet der Editor die bearbeitete GPX an diese URL
und navigiert danach zu `return_url`. Ohne diese Params verhält sich
der Fork exakt wie Upstream (lokaler Download via `file-saver`).

Das reicht als kompletter Roundtrip-Support, weil Upstream bereits den
`?files=[JSON-URL-Array]`-Loader hat (siehe
`website/src/routes/[[language]]/app/+page.svelte`).

## Roundtrip-Flow

```
conciergeOS edit_route_external.php
    ↓ redirect mit
    ?files=["https://conciergeos-host/gpx_edit_bridge.php?action=fetch&token=..."]
    &save_url=https://conciergeos-host/gpx_edit_bridge.php?action=save&token=...
    &return_url=https://conciergeos-host/edit_route.php?id=X&saved=1

Fork lädt (unveränderter Upstream-Code):
    fetch(files[0]) → blob → File → loadFiles()

User editiert, klickt Export (Patch greift hier):
    fetch(save_url, { method: 'POST', body: gpx-xml })
    → erfolgreich → window.location = return_url
    → fehlgeschlagen → Fallback auf lokalen Download + Warnung
```

## Deploy auf IONOS Webhosting Plus

gpx.studio nutzt `@sveltejs/adapter-static` → reiner Static-Export,
keine Node-SSR nötig. Das passt auf IONOS Webhosting Plus.

### Vorbereitung (einmalig lokal auf dem Mac)

```bash
# gpx-Library bauen
cd gpx
npm install
npm run build

# Website-Build vorbereiten
cd ../website
echo PUBLIC_MAPTILER_KEY={DEIN-MAPTILER-KEY} > .env
npm install
```

MapTiler Key holst du unter
<https://cloud.maptiler.com/auth/widget?next=https://cloud.maptiler.com/maps/>
(Free-Tier reicht).

### Build

```bash
cd website
npm run build
```

Ergebnis: Ordner `website/build/` mit statischen Dateien (HTML, JS, CSS,
Assets). Das ist dein Deploy-Artefakt.

### Auf IONOS hochladen

Subdomain `gpx-edit.deine-domain.de` im IONOS Control Center anlegen und
auf ein neues Verzeichnis zeigen lassen (z.B. `/gpx-edit/`).

Dann per FileZilla den **Inhalt** von `website/build/` (nicht den
Ordner selbst) in dieses Verzeichnis kopieren.

**Wichtig:** Auf diese Subdomain **keinen** `.htaccess`-Login setzen.
Der Fork läuft client-seitig, braucht keine Auth — der Schutz kommt
über die conciergeOS-Tokens. `GPX_EDIT_ORIGIN` in der conciergeOS-
config_secrets.php zeigt auf genau diese Subdomain.

### Updates vom Upstream holen

Bei neuen gpx.studio-Releases:

```bash
git fetch upstream
git checkout main
git merge upstream/main         # oder: git rebase upstream/main
git checkout conciergeos/save-url-bridge
git rebase main                 # Patch auf neuen Stand rebasen
# evtl. Merge-Konflikt in utils.svelte.ts loesen
cd website && npm run build
# build/ neu hochladen
```

Der Patch ist klein und berührt nur eine Datei — Rebase ist selten
schmerzhaft.
