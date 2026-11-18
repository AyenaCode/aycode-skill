# Voix off manuelle

La vidéo est prête sans voix. L'utilisateur fournit la voix off, enregistrée ou générée dans un outil comme ElevenLabs, puis te dit `finir`.

## Donner les textes

Écris-les dans « Voix off » de `publish/<date>.md`, puis dans ta réponse :

1. Le sujet, et le guide d'enregistrement : `exports/<vidéo>_guide-voix.mp4` du projet motion, chemin complet.
2. Un bloc prêt à coller, tiré de `audio/voix/<vidéo>.txt` : une réplique par ligne, numérotée, avec sa durée visée. Les nombres, sigles et noms étrangers s'écrivent comme ils se disent.
3. Où déposer les fichiers : `projets/<date>-<sujet>-motion/audio/voix/prises/`, chemin complet. Un fichier par réplique nommé `01`, `02`… dans l'ordre, ou un seul fichier de tout le texte avec une seconde de pause entre deux répliques. Tout format audio convient.
4. La même voix et les mêmes réglages pour toutes les répliques, un débit vif et régulier ; avec une voix générée, un forfait qui autorise la publication.
5. Quand tout est déposé : relancer le skill avec `finir` (`/aycode:publish finir` avec le plugin, `/publish finir` sinon).

Mets le statut « attend la voix » dans le journal et dans le tableau « Vidéo », et arrête-toi là.

## Finir

À `finir`, liste `audio/voix/prises/` du projet motion :

- autant de fichiers que de répliques, ou un seul fichier : la vidéo part chez un sous-agent avec le brief de finition de [`fabrication.md`](fabrication.md) ;
- sinon : dis à l'utilisateur quel fichier manque.

## Critère de fin

La vidéo a son export avec voix et sa couverture, ou l'utilisateur sait exactement quel fichier manque.
