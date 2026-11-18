# La voix off : voix clonée, ou enregistrement, puis mixage

Le script est déjà dans `audio/voix/<vidéo>.txt` (voir [`concept.md`](concept.md)). Le mode de voix est choisi à l'étape 0 :

- **voix clonée** (par défaut) : [voicebox](https://github.com/jamiepine/voicebox) dit le script avec le profil de l'utilisateur → section 1, puis 3 ;
- **manuel** (pas de voicebox, pas de profil, ou l'utilisateur enregistre lui-même) → section 2, puis 3 quand ses prises arrivent.

## 1. Voix clonée (voicebox)

```
pub-video voice synth <vidéo> --profil <nom>          # une prise par réplique → audio/voix/prises/
pub-video voice synth <vidéo> --profil <nom> --ligne 3 --seed 7   # refait une seule prise, avec une autre graine
```

- **Le profil** se crée une fois dans voicebox, par l'utilisateur, avec sa propre voix ou une voix qu'il a le droit d'utiliser.
- **Le ton et le débit viennent de l'échantillon** : la voix clonée reprend la hauteur, l'énergie et la vitesse de l'enregistrement du profil, et aucun moteur de clonage de voicebox ne suit de consigne de ton. Garde ce débit ; `--tempo` (par exemple 1.05) accélère ou ralentit toutes les prises sans changer la hauteur, seulement si l'utilisateur le demande. Pour une autre voix, il change l'échantillon du profil.
- **Tu n'entends pas les prises, tu les mesures, puis tu les relis** :
  - `synth` compare la durée parlée de chaque prise à celle attendue pour son texte et marque `SILENCE`, `TROP LONGUE ?` ou `TROP COURTE ?` : refais chaque prise marquée avec `--ligne <n> --seed <nombre>` ;
  - puis transcris chaque prise avec whisper.cpp (chemin donné par `pub-video doctor`) et compare-la à son texte : un mot avalé ou remplacé (« prompts » entendu « pompes ») se refait avec une autre graine. Un nom qui reste mal dit après deux graines s'écrit comme il se prononce dans `audio/voix/<vidéo>.txt` le temps de cette prise (« Djémini »), puis l'orthographe revient. Un mot que toutes les graines disent pareil reste, et va dans la liste des mots à écouter de la livraison.
- **Licence** : `synth` refuse OmniVoice, sous licence non commerciale. Note le moteur et le profil dans `brief.md`.
- **La livraison le dit** : la voix est de synthèse. L'utilisateur la signale comme contenu généré par IA là où la plateforme le demande.

Puis mixe avec la commande qu'affiche `synth` (section 3).

## 2. Mode manuel : préparer l'enregistrement

```
pub-video voice guide <vidéo>
```

Écrit dans `exports/` :

- `<vidéo>_guide-voix.mp4` : la pub en petit, précédée d'un décompte de 3 secondes ; chaque réplique s'affiche au moment de la dire, la suivante est annoncée dessous, la musique joue en fond.
- `<vidéo>_voix-off.srt` : les répliques horodatées, utilisables comme sous-titres sur les plateformes.

Donne à l'utilisateur, dans la livraison :

1. Le texte complet, réplique par réplique, avec la seconde de chacune.
2. Comment enregistrer :
   - une pièce calme et meublée (rideaux, tapis), téléphone à 15 cm de la bouche, légèrement de côté ;
   - regarder le guide **au casque** pour que la musique ne soit pas réenregistrée ;
   - dire tout le script d'une traite en laissant **une vraie pause d'une seconde entre deux répliques**, ou enregistrer un fichier par réplique ;
   - faire deux ou trois prises et garder la meilleure ; sourire en parlant, articuler les chiffres.
3. Où déposer le ou les fichiers : `audio/voix/` du projet (ou le dossier de prises habituel de l'utilisateur).

## 3. Mixer

```
pub-video voice mix <vidéo> <prise.m4a>                       # une prise de tout le script, pauses entre les répliques
pub-video voice mix <vidéo> <prise1.wav> <prise2.wav> …       # une prise par réplique, dans l'ordre du script
```

La commande découpe la prise aux silences, nettoie chaque réplique (coupe les blancs, retire le grave parasite, égalise le niveau), la pose au début de sa scène, puis refait le mixage : la musique baisse de 8 dB sous la voix et remonte dans les pauses. Elle exporte `exports/<vidéo>-<durée>s_avec-voix.mp4`.

Lis le tableau qu'elle affiche :

| Colonne | Lecture |
|---|---|
| `prise` | durée de la réplique enregistrée |
| `tempo` | accélération appliquée pour tenir avant la réplique suivante (jusqu'à ×1,12, inaudible) |
| `reste` | marge avant la réplique suivante ; **DÉBORDE** = la réplique empiète sur la suivante |

**Si le découpage ne trouve pas le bon nombre de répliques**, la commande liste les passages parlés qu'elle a trouvés. Trois issues :

- donner les coupes à la main : `--cuts 3.2,7.9,12.4` (les secondes, dans la prise, où commence chaque réplique à partir de la deuxième) ;
- demander une prise par réplique ;
- demander une nouvelle prise avec des pauses plus nettes.

**Si une réplique déborde** : raccourcis son texte et refais-la (voix clonée) ou demande de la redire, ou avance son départ dans le script (`scène+0` au lieu de `scène+0.5`), ou allonge la scène d'un temps si le storyboard le permet. Après un changement de durée de scène : `pub-video build <vidéo>` complet, pas seulement le son.

**Cale l'image sur la voix** : quand une réplique dure plus ou moins que prévu, ajuste la durée de sa scène, puis place chaque animation qui illustre un mot (un chiffre, un nom, une coche) sur l'instant où ce mot est dit, lu dans la transcription de la prise. Puis `pub-video build <vidéo>` complet.

**Réglages**

- La voix couvre trop la musique, ou l'inverse : `pub-video build <vidéo> --skip-video --duck 5` (la musique baisse moins) ou `--duck 11` (elle baisse plus).
- La voix part trop tôt ou trop tard sur les scènes : `--lead 0.15` dans `voice mix` (retard en secondes après le début de la scène).
- Revenir à la version sans voix : `pub-video build <vidéo> --skip-video --no-voice`.

## 4. Vérifier

- Le tableau ne montre aucun **DÉBORDE**.
- `build` affiche le niveau final autour de −14 LUFS.
- La voix est bien placée sur l'image : extrais le son d'une réplique (`ffmpeg -ss <début> -t 3 -i exports/<fichier> render/extrait.wav`) et vérifie avec `pub-video music scan` ou `ffmpeg -af volumedetect` qu'il y a du signal à la seconde attendue.
- Dis à l'utilisateur d'écouter : la voix est-elle claire, au bon niveau par rapport à la musique, calée sur les images ?

## Critère de fin

`exports/<vidéo>-<durée>s_avec-voix.mp4` existe, aucune réplique ne déborde, chaque prise de voix clonée a été relue par transcription, et l'utilisateur sait quoi écouter.
