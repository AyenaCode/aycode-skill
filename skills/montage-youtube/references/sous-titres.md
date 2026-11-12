# Sous-titres

```
montage-youtube subs
```

Écrit `exports/<nom>.srt` à partir des mots gardés, calé sur l'export final. Le texte vient de la transcription : il faut le relire.

## Relire

Ouvre le `.srt` et corrige le texte de chaque sous-titre, sans toucher aux numéros ni aux lignes de temps :

- **Orthographe et grammaire** : accords, accents, mots mal entendus. Le sens de la phrase et le sujet de la vidéo disent quel mot était prononcé.
- **Noms propres, marques, termes techniques** : écris-les comme dans la section « Noms et termes » de `brief.md`. Un nom que tu ne peux pas vérifier se demande à l'utilisateur, en une seule question qui les liste tous ; note ses réponses dans `brief.md`.
- **Ponctuation** : une majuscule en début de phrase, un point à la fin. Typographie de la langue : en français, une espace avant `?`, `!`, `:` et `;`, et les guillemets « ».
- **Lignes** : deux au plus par sous-titre, 42 signes par ligne ; coupe la ligne entre deux groupes de sens, jamais entre un article et son nom.

Le texte suit la parole : il se corrige, il ne se réécrit pas. Un sous-titre trop rapide à lire reste fidèle à ce qui est dit.

## Contrôler

```
montage-youtube subs check
```

Une erreur (numérotation, temps, chevauchement, plus de deux lignes) se corrige toujours. Un avertissement (ligne longue, lecture rapide) se corrige quand une coupe de ligne mieux placée suffit.

Si `subs` refuse d'écraser un `.srt` déjà relu après un nouveau montage, refais-le avec `--force` puis relis-le de nouveau : les temps ont changé.

## Critère de fin

Chaque sous-titre est relu, chaque nom est vérifié ou confirmé par l'utilisateur, et `subs check` sort sans erreur.
