# Connaître le produit

But : savoir ce que le produit fait, pour qui, avec quels mots et quelle allure, et rapporter de quoi le montrer. Tout part d'une URL de production, d'un code source, ou des deux.

## Quelle voie

| Tu as | Fais |
|---|---|
| Une URL de production | « Par le site », puis cherche le code si l'utilisateur en a parlé |
| Un dépôt ou un dossier de code | « Par le code », qui te donne souvent l'URL : fais alors aussi « Par le site » |
| Du code sans aucune URL en ligne | « Par le code », puis « Écrans reconstruits » |
| Un outil sans écran (ligne de commande, API, bibliothèque) | « Par le code », puis « Produit sans écran » |

Le site montre ce que le client voit ; le code dit ce qui est vrai (prix, règles, durées). Avec les deux, tu captures le site et tu vérifies les faits dans le code.

## Par le site

```
pub-video capture https://produit.com --crawl 8          # accueil + 8 pages internes, vue téléphone
pub-video capture https://produit.com/tarifs https://produit.com/une-fiche   # pages précises
pub-video capture https://produit.com --device both --images   # + vue ordinateur, + photos du site
```

La commande ouvre et fait défiler les pages ; elle ne clique sur rien et n'envoie aucun formulaire. Elle écrit dans `captures/` :

- `<page>.png` (l'écran) et `<page>_full.png` (la page entière) à 1170 px de large,
- `<page>.txt` : le texte visible, c'est-à-dire les mots du produit,
- `site.json` et un résumé : couleurs dominantes, variables CSS de couleur, polices, arrondis, logo, titres, boutons,
- `fonts/` : les fichiers de police que le site charge, et `fonts/polices.css` qui dit quelle famille et quelle graisse est chaque fichier.

Ensuite :

1. **Lis les `.txt`** de l'accueil et des pages clés : la promesse, les fonctions, les prix, le ton (tutoiement, vouvoiement, registre).
2. **Regarde chaque `.png`** avec l'outil de lecture d'image. Choisis les 3 à 6 écrans qui racontent le produit : ce qu'on voit en arrivant, l'action principale, le résultat. Un produit pour téléphone se capture en vue téléphone ; un outil de bureau avec `--device both`.
3. **Capture les pages profondes** qui manquent (une fiche, un panier, une page de tarifs) en donnant leur adresse.
4. **Repère ce qu'il faudra masquer** : téléphones, e-mails, adresses, noms et photos de personnes, noms d'entreprises tierces.

Un écran derrière une connexion : demande à l'utilisateur un compte de test et un fichier de session (`--state session.json`), ou reconstruis l'écran d'après le code.

## Par le code

Si c'est une adresse de dépôt : `git clone --depth 1 <url> source/` dans le projet. Le code d'un tiers se lit seulement.

Lis, dans cet ordre, en t'arrêtant quand la table des faits est pleine :

| Où | Ce que tu y trouves |
|---|---|
| `README`, `docs/`, textes de la page d'accueil | la promesse, le public, les fonctions, l'adresse en ligne |
| `package.json` (`homepage`), config de déploiement, `CNAME` | l'URL de production |
| Routes ou pages (`src/routes`, `app/`, `pages/`) | la liste des écrans qui existent |
| Fichiers de langue (`messages`, `locales`, `i18n`) | les mots exacts du produit |
| Constantes de prix, de formules, de limites | les chiffres vrais : prix, durée d'essai, quotas |
| Thème (`tailwind.config`, variables CSS, tokens) | couleurs, polices, arrondis |
| `static/`, `public/`, `assets/` | logo en grand, icônes, polices, images |
| Composants des écrans clés | textes, disposition, états, pour un écran à reconstruire |

Les fichiers de secrets (`.env`, clés) restent fermés.

## Écrans reconstruits

Quand un écran ne peut pas être capturé, redessine-le en HTML dans la vidéo (`K.phone(el, { html: … })`), fidèle au composant du code : mêmes textes, mêmes couleurs, même ordre, mêmes arrondis. Un écran reconstruit montre l'interface à l'identique ; il n'invente ni fonction ni donnée. Inscris-le « reconstruit » dans la table Écrans de `brief.md`.

Les données montrées dans un écran (nom de boutique, produit, montant) viennent du produit réel quand elles sont publiques, sinon ce sont des exemples plausibles et neutres, notés comme exemples.

## Produit sans écran

Un outil en ligne de commande, une API ou une bibliothèque n'a ni page d'accueil ni captures. Le README tient leur place :

- **Public, promesse, ton** : ceux du README et de la documentation.
- **Écrans** : son terminal, reconstruit avec `K.terminal` (voir [`moteur.md`](moteur.md)). Les commandes, les messages et les formats de sortie sont ceux du code, mot pour mot ; les valeurs affichées (nombres, noms, lignes de résultat) sont des exemples cohérents entre eux, notés comme exemples. Les écrans se regardent sur une planche, comme des captures.
- **Marque** : couleurs, police et logo du README, du site de documentation ou du dépôt. Sans charte, choisis une palette sobre (terminal sombre, une couleur d'accent) et une police libre, et écris dans `brief.md` que c'est un choix de réalisation.
- **Police de code** : celle du produit si elle existe, sinon `pub-video font "JetBrains Mono"`, déclarée dans `--font-mono` de `theme.css`.
- **Action demandée** : la commande d'installation ou de lancement, telle que le README l'écrit.

## Les faits

Remplis la table « Faits vérifiés » de `brief.md`. Un fait = une affirmation que la pub fera, avec l'endroit où tu l'as lue :

| Fait | Source | Relevé le |
|---|---|---|
| Essai gratuit de 30 jours | `src/lib/pricing.ts:12` et https://produit.com/tarifs | 2026-11-11 |
| 2 000 F pour 30 jours ensuite | `src/lib/pricing.ts:14` | 2026-11-11 |

- Prix, durées, quotas : la valeur exacte, avec sa devise et son unité telles que le produit les écrit.
- Fonctions : seulement celles qui existent aujourd'hui dans le produit en ligne.
- Chiffres d'usage (« 12 000 utilisateurs »), avis, récompenses, logos de clients : seulement s'ils figurent sur le site du produit ou si l'utilisateur les donne.
- Quand le site et le code se contredisent, note les deux et demande à l'utilisateur lequel est juste.

## La marque dans `theme.css`

Reporte les valeurs relevées, dans cet ordre de confiance : variables CSS du site ou du code, puis couleurs dominantes de la capture.

| Variable | D'où |
|---|---|
| `--bg`, `--surface`, `--line` | fonds et bordures du site |
| `--ink`, `--ink-2`, `--ink-3` | couleurs de texte |
| `--brand`, `--brand-ink` | couleur du bouton principal et de son texte |
| `--accent` | seconde couleur de la marque (surlignages) ; à défaut, une teinte de `--brand` |
| `--ok`, `--warn` | couleurs de succès et d'erreur du produit |
| `--r` | arrondi des cartes du produit, à l'échelle de la vidéo (arrondi du site × 2,5) |
| `--font-display`, `--font-text`, `--display-weight`, `--tracking` | polices et graisses des titres et du texte |

**Polices.** Dans l'ordre : les fichiers du site (`cp captures/fonts/* assets/fonts/`, puis `@import url('assets/fonts/polices.css');` en tête de `theme.css`) ou ceux du code ; sinon la même famille sur Google Fonts (`pub-video font "Nom"`) ; si le produit n'utilise que des polices du système, choisis une famille libre proche de son caractère (`pub-video font "Inter"`, `"Manrope"`, `"DM Sans"`…) et note-le.

**Logo.** La plus grande version nette : SVG ou PNG d'au moins 512 px, dans le code (`static/`, `public/`) avant les `logo-*` de la capture. Copie-le dans `assets/img/`.

**Ton.** Relève dans les textes : tutoiement ou vouvoiement, phrases courtes ou longues, mots propres au produit. La pub parle comme le produit.

## Critère de fin

- `brief.md` : Produit, Faits vérifiés (source sur chaque ligne), Marque, Écrans.
- `theme.css` : les vraies valeurs, les polices en fichiers locaux.
- Les écrans à montrer sont dans `captures/`, regardés un par un, et ce qu'il faut y masquer est noté.
