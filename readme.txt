== FAIRPAY — README ==

--- FICHIER DE CONFIGURATION ---
Fichier : api/config/db_access.php
Contient les accès à la base de données (hôte, nom de la base, utilisateur, mot de passe).

--- POINT D'ENTRÉE ---
Fichier : index.html
URL : https://fairpay.hepl-e-business.be/

--- RESTAURATION DE LA BASE DE DONNÉES ---
Pour restaurer la sauvegarde :
  mysql -u ar62yy13raif -p ebus2_projet03_aarr19 < sauvegarde_fairpay.sql

Pour recréer une sauvegarde :
  mysqldump -u ar62yy13raif -p ebus2_projet03_aarr19 > sauvegarde_fairpay.sql
