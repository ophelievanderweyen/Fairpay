<?php
// Fichier : api/config/db_access.php
// Ce fichier contient les accès sécurisés à la base de données Fairpay

define('USER', 'ar62yy13raif');                   // L'utilisateur de ton groupe
define('PASSWD', 'a0~p6a?2pa');                   // Le mot de passe secret
define('BASE', 'ebus2_projet03_aarr19');          // Le nom de ta base de données
define('SERVER', 'localhost');                    // Le serveur

// =========================================================================
// CONNEXION PDO (NE PAS TOUCHER)
// =========================================================================
$dsn = 'mysql:host=' . SERVER . ';dbname=' . BASE . ';charset=utf8mb4'; // utf8mb4 pour bien gérer les accents et emojis 🇮🇹

try {
  // On tente de se connecter à la base de données
  $connexion = new PDO($dsn, USER, PASSWD);
  
  // On configure PDO pour qu'il affiche les vraies erreurs SQL si on se trompe
  $connexion->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

} catch(PDOException $e) {
  // S'il y a une erreur (ex: mauvais mot de passe), on l'affiche et on arrête tout
  echo 'Échec de la connexion à la base de données : ' . $e->getMessage();
  exit();
}
// Si on arrive ici, la connexion a réussi. 
// La variable $connexion est prête à être utilisée par le fichier add_depense.php !
?>