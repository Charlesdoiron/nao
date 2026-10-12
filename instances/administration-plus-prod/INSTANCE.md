# nao-administration-plus-prod

| | |
|---|---|
| **App Scalingo** | `nao-administration-plus-prod` (région `osc-secnum-fr1`) |
| **URL** | https://nao-administration-plus-prod.osc-secnum-fr1.scalingo.io |
| **Contexte** | [`nao-aplus-context`](https://github.com/incubateur-territoires/nao-aplus-context) — **privé**, cloné avec `NAO_CONTEXT_GIT_TOKEN` |
| **Base interne** | addon PostgreSQL Scalingo (`SCALINGO_POSTGRESQL_URL`) |
| **Base source** | PostgreSQL joignable en direct (`NAO_DB_URL`, `DB_SSL`) |
| **Overlay** | **non** — `Procfile` et `.buildpacks` de la racine |
| **Particularités** | connexion GitHub (`GITHUB_CLIENT_ID`/`_SECRET`), `NOTION_API_KEY`, et deux drapeaux bêta : `BETA_CONTEXT_RECOMMENDATIONS_ENABLED`, `BETA_CUSTOM_STORIES_ENABLED` |

Ce dossier n'existe que pour tenir l'inventaire : il ne contient **aucun** fichier qui surcharge la
base. Y déposer un `Procfile`, un `Aptfile` ou un `bin/` le ferait écraser celui de la racine.

> `nao-test-aplus` (région `osc-fr1`, remote git `scalingo` de ce dépôt) est une **ancienne instance
> de test** d'avant cette app, dans une autre région — hors de portée du blob FGP, qui cible
> `osc-secnum-fr1`. Ne pas la confondre avec cette instance de production.
