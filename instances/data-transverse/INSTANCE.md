# nao-data-transverse

| | |
|---|---|
| **App Scalingo** | `nao-data-transverse` (région `osc-secnum-fr1`) |
| **URL** | https://nao-data-transverse.osc-secnum-fr1.scalingo.io |
| **Contexte** | [`nao-context-pole-data-ia`](https://github.com/incubateur-territoires/nao-context-pole-data-ia) |
| **Base interne** | addon PostgreSQL Scalingo (`SCALINGO_POSTGRESQL_URL`) |
| **Base source** | datalake joignable en direct (`DATALAKE_DB_HOST` / `_PORT` / `_NAME` / `_USER` / `_PASSWORD`) |
| **Overlay** | **non** — `Procfile` et `.buildpacks` de la racine |

Ce dossier n'existe que pour tenir l'inventaire : il ne contient **aucun** fichier qui surcharge la
base. Y déposer un `Procfile`, un `Aptfile` ou un `bin/` le ferait écraser celui de la racine.
