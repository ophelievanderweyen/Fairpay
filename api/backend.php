<?php
/* =========================================================================
   BACKEND.PHP — API REST Fairpay

   TABLE DES MATIÈRES
   ──────────────────────────────────────────────────────────────────────
    1.  Configuration  .  Sessions sécurisées · HSTS · CORS · Connexion BDD · Routeur
    2.  Flux 1  ........  register          — Inscription (hash mdp + unicité email/pseudo)
    3.  Flux 2  ........  login             — Connexion (password_verify + session PHP)
    4.  Flux 3  ........  get_groups        — Liste de tous les groupes
                          get_users         — Liste de tous les utilisateurs
    5.  Flux 4  ........  add_group         — Créer un groupe + ajouter le créateur
    6.  Flux 5  ........  add_depense       — Ajouter une dépense
    7.  Flux 8  ........  get_dashboard     — Tableau de bord (soldes + groupes + dépenses récentes)
    8.  Flux 9  ........  get_group_expenses_named  — Dépenses avec noms (JOIN users)
                          get_group_members         — Membres du groupe (id + name + email)
    9.  Flux 10  .......  get_group_balances — Soldes nets par membre (Qui doit quoi ?)
   10.  Default  .......  Action inconnue → 400

   ──────────────────────────────────────────────────────────────────────
========================================================================= */

/* =========================================================================
   AUCUN FLUX — CONFIGURATION DE LA SÉCURITÉ ET DES SESSIONS
   =========================================================================
   Ces premières lignes s'assurent que les "cookies de session" (qui
   maintiennent l'utilisateur connecté) sont sécurisés et ne peuvent pas
   être volés par des scripts malveillants.
*/

// Ces réglages ini_set() contrôlent comment PHP envoie et sécurise le cookie qui contient l'identifiant de session.
ini_set('session.cookie_httponly', 1); // empêche JavaScript d'accéder au cookie (injection JS= Les injections JS désignent le fait d'insérer du code JavaScript malveillant dans une page web pour qu'il s'exécute dans le navigateur d'une victime)
ini_set('session.cookie_secure', 1);   // le cookie n'est envoyé que via HTTPS
ini_set('session.cookie_samesite', 'Strict'); // aide à réduire les attaques CSRF, avec des valeurs comme Strict
ini_set('session.cookie_lifetime', 60*60*10); // 10 heures : durée raisonnable pour une session utilisateur
ini_set('session.gc_maxlifetime',  60*60*10); // Garde les données de session côté serveur aussi longtemps
session_start(); // On démarre la session pour pouvoir stocker les infos de l'utilisateur

// Elle dit au navigateur "à partir de maintenant, utilise HTTPS pour ce site"
if (!empty($_SERVER['HTTPS'])) { // vérifie si la connexion actuelle est en HTTPS
    header("Strict-Transport-Security: max-age=31536000"); // envoie un en-tête HTTP au navigateur pour lui dire de mémoriser cette règle pendant 31536000 secondes, soit environ 1 an.
}

/* =========================================================================
   AUCUN FLUX — CORS ET HEADERS DE SÉCURITÉ SUPPLÉMENTAIRES
   =========================================================================
   cors-api.php est un fichier utilitaire fourni par le prof.
   Il contient la fonction add_headers_origin() qui :
   - autorise les domaines connus (le serveur + localhost pour le dev)
   - envoie les en-têtes CORS au navigateur (Access-Control-Allow-Origin, etc.)
   - ajoute les en-têtes de sécurité (cache, anti-XSS, anti-clickjacking)
*/
// require_once est utilisé pour les fichiers essentiels car il arrête le script en cas d'erreur
require_once 'cors-api.php'; // charge le fichier cors
// On appelle la fonction de configuration CORS du prof (dev mode à true, refuse les autres origines par défaut, pas de debug)
$hote = 'https://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
add_headers_origin($hote, true, false, false); // autorise cette origine précise, avec des options de sécurité activées selon les paramètres passés

// Si c'est juste une requête OPTIONS (Preflight CORS), on répond 200 et on s'arrête
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { // Qu'est-ce que j'ai le droit de faire ici ?
    http_response_code(200); // Oui, c'est bon, tu peux continuer
    exit;
}

// => qd un navigateur envoie une requete il utilise GET (ex: afficher une page) pour recuperer des données
//    ou POST pour envoyer des données (ex: formulaire)


/* =========================================================================
   AUCUN FLUX — CONNEXION À LA BASE DE DONNÉES
   =========================================================================
   On inclut le fichier qui contient la variable $connexion (accès à la BDD).
*/
include_once 'config/db_access.php'; // include_once permet de continuer l'exécution même si le fichier est absent.


/* =========================================================================
   AUCUN FLUX — ROUTEUR (AIGUILLAGE DES ACTIONS)
   =========================================================================
   Le frontend envoie ses requêtes vers "backend.php?action=quelqueChose".
   Ici, on regarde quelle "action" a été demandée.
*/
$action = $_GET['action'] ?? '';
// le get récupère les données, le [action] veut dire que on prend la valeur de action et ?? '' -> opérateur "si ça n'existe pas, mets une valeur par défaut"

// Si aucune action n'est dans l'URL mais qu'on reçoit des données JSON (POST),
// on essaie de deviner si c'est une connexion (login) ou une inscription (register).
if ($action === '' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw_input = file_get_contents("php://input"); // On lit les données envoyées
    $donnees = json_decode($raw_input, true);      // On les transforme en tableau PHP
    if (is_array($donnees)) { // On vérifie que les données sont valides (bien converties en tableau)
        if (isset($donnees['username'])) {
            $action = 'register'; // S'il y a un username, on considère que c'est une inscription
        } elseif (isset($donnees['email']) && isset($donnees['password'])) {
            $action = 'login';    // S'il n'y a que email et mot de passe, c'est une connexion
        }
    }
}
/* =========================================================================
   ROUTEUR — Le "switch" fonctionne comme un grand carrefour.
   Selon la valeur de $action, le code va dans la section ("case") correspondante.
   Ordre : Flux 1 → 2 → 3 → 4 → 5 → 8 → 9 → 10
   ========================================================================= */
switch ($action) {

    /* =========================================================================
       FLUX N°1 : INSCRIPTION (REGISTER)
       Flux : app.js register() → POST JSON (username, email, password)
              → vérification unicité → password_hash → INSERT users → { success: true }
       ========================================================================= */
    case 'register': // Si l'action demandée est register (inscription), exécute ce bloc de code
        // On utilise json_encode pour envoyer une réponse structurée en JSON au frontend, car JavaScript attend ce format pour pouvoir traiter les messages correctement.
        header('Content-Type: application/json');

        // 1. Vérification que c'est bien une requête POST
        //Post c'est pour envoyer des données au serveur
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Action non autorisée']); // Si ce n'est pas le cas, on refuse l'accès
            exit;
        }

        // 2. Récupération et vérification des données (tous les champs sont obligatoires)
        // // Vérifie que les champs obligatoires sont remplis
        $donnees = json_decode(file_get_contents("php://input"), true);
        if (!is_array($donnees) || empty($donnees['username']) || empty($donnees['email']) || empty($donnees['password'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Oups ! Merci de remplir tous les champs.']);
            exit;
        }

        // 3. Nettoyage des données (on met l'email en minuscules, on enlève les espaces)
        $nom      = trim($donnees['username']);
        $email    = strtolower(trim($donnees['email']));
        $motDePasse = $donnees['password'];

        // 4. Vérification si l'email ou le nom existent déjà dans la base
        // $stmt : C'est une variable qui contient une requête SQL préparée, mais pas encore exécutée.

        $stmt = $connexion->prepare('SELECT id FROM users WHERE email = ? OR name = ? LIMIT 1');
        $stmt->bindParam(1, $email);
        $stmt->bindParam(2, $nom);
        $stmt->execute(); // Exécute la requête avec l'email fourni
        $utilisateurExistant = $stmt->fetch(PDO::FETCH_ASSOC);
        // PDO = Méthode PHP  pour communiquer avec une base de données de manière sécurisée.
        // Elle évie lesw injections SQL et fonctionne avec plusieurs types de bases

        //=> prepare - execute - fetch (cycle complet) : 1. ecrire la requete 2. injecter la valeur 3. récupérer le resultat

        if ($utilisateurExistant) {
            http_response_code(409); // 409 = Conflict (Conflit de données)
            echo json_encode(['success' => false, 'message' => 'Ce nom ou cet email existe déjà.']);
            exit;
        }

        // 5. Cryptage (hachage) du mot de passe pour la sécurité (très important !)
        $motDePasseHache = password_hash($motDePasse, PASSWORD_DEFAULT);

        // 6. Insertion du nouvel utilisateur dans la base de données
        $stmt = $connexion->prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
        $stmt->bindParam(1, $nom);
        $stmt->bindParam(2, $email);
        $stmt->bindParam(3, $motDePasseHache);
        $stmt->execute();

        // 7. Renvoi d'un message de succès
        echo json_encode(['success' => true, 'message' => 'Inscription réussie']);
        exit;

    /* =========================================================================
       FLUX N°2 : CONNEXION (LOGIN)
       Flux : app.js login() → POST JSON (email, password)
              → SELECT users WHERE email → password_verify → $_SESSION → { connexion: true }
       ========================================================================= */
    case 'login':
        // 1. Vérification de la méthode d'envoi (doit être POST)
        // On utilise json_encode pour envoyer une réponse structurée en JSON au frontend, car JavaScript attend ce format pour pouvoir traiter les messages correctement.
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['message' => 'Action non autorisée']); // Si ce n'est pas le cas, on refuse l'accès
            exit;
        }

        // 2. Récupération des données envoyées par le frontend
        $donnees = json_decode(file_get_contents("php://input"), true);
        // Vérifie que les champs obligatoires sont remplis
        if (empty($donnees['email']) || empty($donnees['password'])) {
            http_response_code(400);
            echo json_encode(['message' => 'Oups ! Merci de remplir tous les champs.']);
            exit;
        }

        // 3. Nettoyage des données (on met l'email en minuscules, on enlève les espaces)
        $email = strtolower(trim($donnees['email']));
        $mdp   = $donnees['password'];

        // 4. Recherche de l'utilisateur dans la base de données

        // $stmt : C'est une variable qui contient une requête SQL préparée, mais pas encore exécutée.
        $stmt = $connexion->prepare('SELECT id, name, email, password FROM users WHERE email = ? LIMIT 1'); // Prépare une requête sécurisée pour éviter les injections SQL
        $stmt->bindParam(1, $email);
        $stmt->execute(); // Exécute la requête avec l'email fourni
        $infosUtilisateur = $stmt->fetch(PDO::FETCH_ASSOC); // Récupère les informations de l'utilisateur (sous forme de tableau associatif)
        // PDO = Méthode PHP pour communiquer avec une base de données de manière sécurisée.
        // Elle évite les injections SQL et fonctionne avec plusieurs types de bases de données.

        //=> prepare - execute - fetch (cycle complet) : 1. écrire la requête 2. injecter la valeur 3. récupérer le résultat

        // 5. Vérification du mot de passe
        // password_verify vérifie si le mot de passe tapé correspond à celui haché en BDD
        if (!$infosUtilisateur || !password_verify($mdp, $infosUtilisateur['password'])) {
            sleep(1); // Ralentit les attaques par force brute (petite sécurité)
            http_response_code(401); // dit au frontend que la connexion est refusée
            echo json_encode(['message' => 'Identifiants Fairpay incorrects.']);
            exit;
        }

        // 6. Succès : On stocke les infos dans la session (le serveur se souvient de lui)
        $_SESSION['utilisateur'] = [
           'id'     => $infosUtilisateur['id'],
           'pseudo' => $infosUtilisateur['name'],
           'nom'    => $infosUtilisateur['email'],
           'heure'  => date('H:i')
        ];

        // 7. On renvoie une réponse positive au frontend
        http_response_code(200);
        echo json_encode([
            'connexion' => true,
            'user'      => $_SESSION['utilisateur']
        ]);
        exit;

    /* =========================================================================
       FLUX N°3 : AFFICHER LES GROUPES ET LES UTILISATEURS
       Flux : Nouveau.js + Groupes.js au montage → GET get_groups → liste des groupes
              Nouveau.js + NouveauGroupe.js au montage → GET get_users → liste des membres
       ========================================================================= */
    case 'get_groups':
        try {
            // Récupère tous les groupes, du plus récent au plus ancien
            $sql = "SELECT id, name, description, created_by, created_at FROM `groups` ORDER BY created_at DESC LIMIT 100";
            $stmt = $connexion->prepare($sql);
            $stmt->execute();
            $groupes = $stmt->fetchAll(PDO::FETCH_ASSOC); // Transforme le résultat en tableau PHP

            header('Content-Type: application/json');
            echo json_encode($groupes); // Renvoie les données au format JSON au frontend
        } catch(PDOException $e) {
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;

    case 'get_users':
        // Utilisé pour peupler le menu déroulant "Payé par" avec les vrais IDs BDD
        header('Content-Type: application/json');
        try {
            $stmt = $connexion->prepare("SELECT id, name FROM users ORDER BY name LIMIT 100");
            $stmt->execute();
            $utilisateurs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($utilisateurs);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;

    /* =========================================================================
       FLUX N°4 : AJOUTER UN GROUPE
       Flux : NouveauGroupe.js submitForm() → POST FormData (name, description)
              → INSERT groups + INSERT participations (créateur) → { success: true }
       ========================================================================= */
    case 'add_group':
        if (!isset($_SESSION['utilisateur'])) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Non connecté']);
            exit;
        }
        if ($_SERVER["REQUEST_METHOD"] == "POST") {
            // htmlspecialchars empêche l'exécution de code malveillant (Faille XSS)
            $nom         = htmlspecialchars($_POST['name']);
            $description = htmlspecialchars($_POST['description']);
            $creePar     = (int) $_SESSION['utilisateur']['id']; // ID réel de l'utilisateur connecté
            if (isset($_POST['members'])) {
                $membres = json_decode($_POST['members'], true);
            } else {
                $membres = [];
            }

            try {
                $sql = "INSERT INTO `groups` (name, description, created_by) VALUES (:n, :d, :c)";
                $stmt = $connexion->prepare($sql);
                $stmt->bindParam(':n', $nom);
                $stmt->bindParam(':d', $description);
                $stmt->bindParam(':c', $creePar, PDO::PARAM_INT);
                $stmt->execute();

                // Ajout automatique du créateur comme premier membre du groupe
                $idNouveauGroupe = (int) $connexion->lastInsertId();
                $requeteParticipation = $connexion->prepare("INSERT IGNORE INTO participations (user_id, group_id) VALUES (?, ?)");
                $requeteParticipation->bindParam(1, $creePar, PDO::PARAM_INT);
                $requeteParticipation->bindParam(2, $idNouveauGroupe, PDO::PARAM_INT);
                $requeteParticipation->execute();

                // Ajout des membres sélectionnés
                if (is_array($membres)) {
                    foreach ($membres as $idMembre) {
                        $idMembre = (int) $idMembre;
                        if ($idMembre > 0) {
                            $requeteParticipation->bindParam(1, $idMembre, PDO::PARAM_INT);
                            $requeteParticipation->bindParam(2, $idNouveauGroupe, PDO::PARAM_INT);
                            $requeteParticipation->execute();
                        }
                    }
                }

                header('Content-Type: application/json');
                echo json_encode(['success' => true]);
            } catch(PDOException $e) {
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
        }
        exit;

    /* =========================================================================
       FLUX N°5 : AJOUTER UNE DÉPENSE
       Flux : Nouveau.js submitForm() → POST FormData (group_id, payer_id, amount, reason,
              expense_date)
              → INSERT expenses → { success: true }
       ========================================================================= */
    case 'add_depense':
        if (!isset($_SESSION['utilisateur'])) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Non connecté']);
            exit;
        }
        if ($_SERVER["REQUEST_METHOD"] == "POST") {
            // Récupération des données du formulaire avec nettoyage (XSS et types)
            // EXPLICATION SÉCURITÉ :
            // 1. intval() : Force la donnée à être un nombre entier. Si un pirate envoie du texte ou du code SQL, ça deviendra un simple 0.
            // 2. floatval() : Idem, mais pour les nombres à virgule (les montants).
            // 3. htmlspecialchars() : Convertit les caractères spéciaux (comme < ou >) en entités inoffensives (&lt;, &gt;). Cela empêche un attaquant d'injecter du code Javascript (Faille XSS).
            $group_id = intval($_POST['group_id'] ?? 0);
            $payer_id = intval($_POST['payer_id'] ?? $_SESSION['utilisateur']['id']);
            $montant  = floatval($_POST['amount'] ?? 0);
            $motif    = htmlspecialchars($_POST['reason'] ?? 'Sans motif');
            $date     = htmlspecialchars($_POST['expense_date'] ?? date('Y-m-d'));

            try {
                // Insertion dans la table des dépenses
                $sql = "INSERT INTO expenses (group_id, payer_id, amount, expense_date, reason)
                        VALUES (:g, :p, :a, :d, :r)";
                $stmt = $connexion->prepare($sql);
                $stmt->bindParam(':g', $group_id, PDO::PARAM_INT);
                $stmt->bindParam(':p', $payer_id, PDO::PARAM_INT);
                $stmt->bindParam(':a', $montant);
                $stmt->bindParam(':d', $date);
                $stmt->bindParam(':r', $motif);
                $stmt->execute();

                header('Content-Type: application/json');
                echo json_encode(['success' => true]);

                // Bloc conservé pour compatibilité (participants non envoyés depuis le frontend)
                // Séparé du try principal : si l'INSERT échoue, la dépense reste sauvegardée
                $idNouvelleDepense = (int) $connexion->lastInsertId();
                if (!empty($_POST['participants'])) {
                    $listeParticipants = json_decode($_POST['participants'], true);
                    if (is_array($listeParticipants) && count($listeParticipants) > 0) {
                        try {
                            $requeteParticipants = $connexion->prepare("INSERT IGNORE INTO expense_participants (expense_id, user_id) VALUES (?, ?)");
                            foreach ($listeParticipants as $idMembre) {
                                $idMembre = (int) $idMembre;
                                if ($idMembre > 0) {
                                    $requeteParticipants->bindParam(1, $idNouvelleDepense, PDO::PARAM_INT);
                                    $requeteParticipants->bindParam(2, $idMembre, PDO::PARAM_INT);
                                    $requeteParticipants->execute();
                                }
                            }
                        } catch (PDOException $e2) { /* Silencieux : ne pas bloquer la réponse */ }
                    }
                }
            } catch(PDOException $e) {
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
        }
        exit;

    /* =========================================================================
       FLUX N°8 : TABLEAU DE BORD (DASHBOARD)
       Flux : Accueil.js fetchDashboard() → GET get_dashboard
              → session PHP → 3 requêtes SQL → JSON (groups, expenses, balance)
              → Vue.js re-rend le tableau de bord
       ========================================================================= */
    case 'get_dashboard':
        // Vérifie que l'utilisateur est connecté (session PHP active)
        if (!isset($_SESSION['utilisateur'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Non connecté']);
            exit;
        }
        // Récupère l'ID de l'utilisateur depuis la session (stockée au moment du login)
        $idUtilisateur = (int) $_SESSION['utilisateur']['id'];

        try {
            header('Content-Type: application/json');

            // --- Requête SQL 1 : récupère les 5 groupes les plus récents ---
            $stmt = $connexion->prepare(
                "SELECT id, name, description, created_by, created_at FROM `groups` ORDER BY created_at DESC LIMIT 5"
            );
            $stmt->execute();
            $groupes = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // --- Requête SQL 2 : récupère les 5 dernières dépenses avec nom du groupe ET nom du payeur ---
            // Double LEFT JOIN : expenses -> groups (nom du groupe) + expenses -> users (nom du payeur)
            // Utilise l'ID réel de la table users, pas un ID hardcodé
            $stmt = $connexion->prepare(
                "SELECT e.id, e.group_id, e.payer_id, e.amount, e.expense_date, e.reason,
                        g.name AS group_name, u.name AS payer_name
                 FROM expenses e
                 LEFT JOIN `groups` g ON e.group_id = g.id
                 LEFT JOIN users u ON e.payer_id = u.id
                 ORDER BY e.expense_date DESC
                 LIMIT 5"
            );
            $stmt->execute();
            $depenses = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // --- Calcul brut des soldes par groupe ---
            // "on_me_doit" s'accumule pour chaque dépense où j'ai payé (les autres me doivent leur part).
            // "je_dois"    s'accumule pour chaque dépense où quelqu'un d'autre a payé et je suis participant.
            // Les deux côtés s'accumulent indépendamment : on ne compense pas "je dois X" avec "X me doit Y".
            $requeteGroupes = $connexion->prepare("SELECT group_id FROM participations WHERE user_id = ? LIMIT 200");
            $requeteGroupes->bindParam(1, $idUtilisateur, PDO::PARAM_INT);
            $requeteGroupes->execute();
            $mesGroupes = array_column($requeteGroupes->fetchAll(PDO::FETCH_ASSOC), 'group_id');

            $je_dois    = 0.0;
            $on_me_doit = 0.0;

            foreach ($mesGroupes as $idGroupe) {
                $idGroupe = (int) $idGroupe;

                // Membres réels du groupe (fallback quand expense_participants est vide)
                $requeteMembres = $connexion->prepare(
                    "SELECT users.id FROM users
                     JOIN participations ON users.id = participations.user_id
                     WHERE participations.group_id = ?
                     LIMIT 100"
                );
                $requeteMembres->bindParam(1, $idGroupe, PDO::PARAM_INT);
                $requeteMembres->execute();
                $idsMembres = array_map('intval', array_column($requeteMembres->fetchAll(PDO::FETCH_ASSOC), 'id'));

                // Tous les participants par dépense pour ce groupe (une seule requête)
                $requeteParticipants = $connexion->prepare(
                    "SELECT ep.expense_id, ep.user_id
                     FROM expense_participants ep
                     JOIN expenses e ON ep.expense_id = e.id
                     WHERE e.group_id = ?
                     LIMIT 1000"
                );
                $requeteParticipants->bindParam(1, $idGroupe, PDO::PARAM_INT);
                $requeteParticipants->execute();
                $participantsParDepense = [];
                foreach ($requeteParticipants->fetchAll(PDO::FETCH_ASSOC) as $ligne) {
                    $participantsParDepense[(int)$ligne['expense_id']][] = (int)$ligne['user_id'];
                }

                // Dépenses du groupe
                $requeteDepenses = $connexion->prepare("SELECT id, payer_id, amount FROM expenses WHERE group_id = ? LIMIT 500");
                $requeteDepenses->bindParam(1, $idGroupe, PDO::PARAM_INT);
                $requeteDepenses->execute();

                foreach ($requeteDepenses->fetchAll(PDO::FETCH_ASSOC) as $depense) {
                    $idExp          = (int) $depense['id'];
                    $idPayeur       = (int) $depense['payer_id'];
                    $idsParticipants = $participantsParDepense[$idExp] ?? $idsMembres;
                    $nbParticipants  = count($idsParticipants);
                    if ($nbParticipants === 0) {
                        continue;
                    }

                    $partChacun = (float) $depense['amount'] / $nbParticipants;

                    if ($idPayeur === $idUtilisateur) {
                        // J'ai payé : chaque autre participant me doit sa part
                        // Si je suis moi-même dans la liste, je ne me dois pas ma propre part
                        if (in_array($idUtilisateur, $idsParticipants)) {
                            $nbDebiteurs = $nbParticipants - 1;
                        } else {
                            $nbDebiteurs = $nbParticipants;
                        }
                        $on_me_doit += $partChacun * $nbDebiteurs;
                    } elseif (in_array($idUtilisateur, $idsParticipants)) {
                        // Quelqu'un d'autre a payé et je suis participant : je dois ma part
                        $je_dois += $partChacun;
                    }
                }
            }

            // Flux retour : envoi des données en JSON vers le frontend Vue.js
            echo json_encode([
                'groups'   => $groupes,
                'expenses' => $depenses,
                'balance'  => [
                    'je_dois'    => round($je_dois,    2),
                    'on_me_doit' => round($on_me_doit, 2)
                ]
            ]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;

    /* =========================================================================
       FLUX N°9 : CONSULTER LES DÉTAILS D'UN GROUPE
       2 requêtes GET séparées appelées par Groupes.js lors du clic sur un groupe
       Flux : Groupes.js selectGroup() → get_group_expenses_named + get_group_members
       ========================================================================= */

    // Requête 1/2 : dépenses d'un groupe avec nom du payeur (version lisible)
    case 'get_group_expenses_named':
        header('Content-Type: application/json');
        $idGroupe = (int) ($_GET['group_id'] ?? 0);
        try {
            // JOIN expenses + users -> remplace payer_id par un vrai prénom
            $stmt = $connexion->prepare(
                "SELECT users.name AS payeur, expenses.reason, expenses.amount, expenses.expense_date
                 FROM expenses
                 JOIN users ON expenses.payer_id = users.id
                 WHERE expenses.group_id = ?
                 ORDER BY expenses.amount DESC
                 LIMIT 100"
            );
            $stmt->bindParam(1, $idGroupe, PDO::PARAM_INT);
            $stmt->execute();
            $depenses = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($depenses);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;

    // Requête 2/2 : membres d'un groupe (via la table participations)
    case 'get_group_members':
        header('Content-Type: application/json');
        $idGroupe = (int) ($_GET['group_id'] ?? 0);
        try {
            // JOIN users + participations -> liste des membres du groupe
            $stmt = $connexion->prepare(
                "SELECT users.id, users.name, users.email
                 FROM users
                 JOIN participations ON users.id = participations.user_id
                 WHERE participations.group_id = ?
                 LIMIT 100"
            );
            $stmt->bindParam(1, $idGroupe, PDO::PARAM_INT);
            $stmt->execute();
            $membres = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($membres);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;

    /* =========================================================================
       FLUX N°10 : SOLDES PAR MEMBRE (QUI DOIT QUOI ?)
       get_group_balances : pour chaque dépense du groupe, divise le montant
         entre tous les membres du groupe
         → calcul du "qui doit quoi à qui" (Groupes.js suggestedDebts)
       ========================================================================= */
    case 'get_group_balances':
        header('Content-Type: application/json');
        $idGroupe = (int) ($_GET['group_id'] ?? 0);
        try {
            // Récupère tous les membres du groupe (avec leurs IDs)
            $requeteMembres = $connexion->prepare(
                "SELECT users.id, users.name FROM users
                 JOIN participations ON users.id = participations.user_id
                 WHERE participations.group_id = ?
                 LIMIT 100"
            );
            $requeteMembres->bindParam(1, $idGroupe, PDO::PARAM_INT);
            $requeteMembres->execute();
            $membres = $requeteMembres->fetchAll(PDO::FETCH_ASSOC);

            // Initialise le solde net de chaque membre à 0
            $soldes = [];
            foreach ($membres as $membre) {
                $idMembre = (int) $membre['id'];
                $soldes[$idMembre] = ['name' => $membre['name'], 'net' => 0.0];
            }

            // Récupère toutes les dépenses du groupe
            $requeteDepenses = $connexion->prepare("SELECT id, payer_id, amount FROM expenses WHERE group_id = ? LIMIT 500");
            $requeteDepenses->bindParam(1, $idGroupe, PDO::PARAM_INT);
            $requeteDepenses->execute();
            $depenses = $requeteDepenses->fetchAll(PDO::FETCH_ASSOC);

            $requeteParticipantsDepense = $connexion->prepare("SELECT user_id FROM expense_participants WHERE expense_id = ? LIMIT 100");
            $idsMembres = array_column($membres, 'id'); // fallback : tous les membres

            foreach ($depenses as $depense) {
                // Requête des participants spécifiques à cette dépense
                $idDepense = (int)$depense['id'];
                $requeteParticipantsDepense->bindParam(1, $idDepense, PDO::PARAM_INT);
                $requeteParticipantsDepense->execute();
                $lignes = $requeteParticipantsDepense->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($lignes)) {
                    $idsParticipants = array_map('intval', array_column($lignes, 'user_id'));
                } else {
                    $idsParticipants = array_map('intval', $idsMembres); // fallback = tous les membres
                }

                $nbParticipants = count($idsParticipants);
                if ($nbParticipants === 0) {
                    continue;
                }

                $partChacun = (float) $depense['amount'] / $nbParticipants;
                $idPayeur   = (int) $depense['payer_id'];

                // Le payeur récupère la part de chaque participant (sauf la sienne)
                // Chaque participant non-payeur doit sa part au payeur
                foreach ($idsParticipants as $idMembre) {
                    if (!isset($soldes[$idMembre])) {
                        continue;
                    }
                    if ($idMembre === $idPayeur) {
                        $soldes[$idMembre]['net'] += $partChacun * ($nbParticipants - 1); // créditeur
                    } else {
                        $soldes[$idMembre]['net'] -= $partChacun;                         // débiteur
                    }
                }
            }

            // Formatte en tableau JSON [{name, net_balance}]
            $resultat = [];
            foreach ($soldes as $solde) {
                $resultat[] = ['name' => $solde['name'], 'net_balance' => round($solde['net'], 2)];
            }
            echo json_encode($resultat);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;

    /* =========================================================================
       AUCUN FLUX — ACTION INCONNUE (SÉCURITÉ)
       Si l'action demandée n'existe pas, on retourne une erreur 400
       ========================================================================= */
    default:
        http_response_code(400); // 400 = Bad Request (Requête mal formulée)
        echo json_encode(['message' => 'Action inconnue ou manquante.']);
        exit;
}
