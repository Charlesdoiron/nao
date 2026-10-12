# nao-inclusion-numerique-prod

| | |
|---|---|
| **App Scalingo** | `nao-inclusion-numerique-prod` (région `osc-secnum-fr1`) |
| **URL** | https://nao-inclusion-numerique-prod.osc-secnum-fr1.scalingo.io |
| **Contexte** | [`nao-context-inclusion-numerique`](https://github.com/incubateur-territoires/nao-context-inclusion-numerique) |
| **Base interne** | addon PostgreSQL Scalingo (`SCALINGO_POSTGRESQL_URL`) |
| **Base source** | PostgreSQL externe **derrière un bastion SSH** (`NAO_DB_URL` sur `127.0.0.1`, via le tunnel) |
| **Overlay** | **oui** — `.buildpacks` (+ ssh-private-key-buildpack) et `Procfile` (tunnel avant le serveur) |

C'est la seule instance qui surcharge réellement la base. Voir
`DEPLOY-SCALINGO.md` § « Customiser une instance (overlay) » pour le détail du tunnel et des
variables `SSH_KEY` / `SSH_HOSTS` / `DS_*`.
