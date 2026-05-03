<?php
/* =========================================================================
   ÉTAPE 1 : CONFIGURATION DE LA SÉCURITÉ ET DES SESSIONS
   =========================================================================
   Ces premières lignes s'assurent que les "cookies de session" (qui
   maintiennent l'utilisateur connecté) sont sécurisés et ne peuvent pas
   être volés par des scripts malveillants.
*/

// Ces réglages ini_set() contrôlent comment PHP envoie et sécurise le cookie qui contient l'identifiant de session.
ini_set('session.cookie_httponly', 1); // empêche JavaScript d'accéder au cookie (protection contre les injections JS)
ini_set('session.cookie_secure', 1);   // le cookie n'est envoyé que via HTTPS
ini_set('session.cookie_samesite', 'Strict'); // aide à réduire les attaques CSRF
ini_set('session.cookie_lifetime', 86400); // 24 heures : durée raisonnable pour une session utilisateur
ini_set('session.gc_maxlifetime',  86400); // Garde les données de session côté serveur aussi longtemps
session_start(); // On démarre la session pour pouvoir stocker les infos de l'utilisateur

// Elle dit au navigateur "à partir de maintenant, utilise HTTPS pour ce site"
if (!empty($_SERVER['HTTPS'])) { // vérifie si la connexion actuelle est en HTTPS
    header("Strict-Transport-Security: max-age=31536000"); // mémorise cette règle pendant 1 an (31536000 secondes)
}

/* =========================================================================
   CORS ET HEADERS DE SÉCURITÉ SUPPLÉMENTAIRES
   =========================================================================
   cors-api.php est un fichier utilitaire fourni par le prof.
   Il contient la fonction add_headers_origin() qui :
   - autorise les domaines connus (le serveur + localhost pour le dev)
   - envoie les en-têtes CORS au navigateur (Access-Control-Allow-Origin, etc.)
   - ajoute les en-têtes de sécurité (cache, anti-XSS, anti-clickjacking)
*/
require_once 'cors-api.php';
// On appelle la fonction avec l'hôte actuel et dev=true pour autoriser localhost
$host = 'https://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
add_headers_origin($host, true, false, false);

// Si c'est juste une requête OPTIONS (Preflight CORS), on répond 200 et on s'arrête
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// => qd un navigateur envoie une requete il utilise GET (ex: afficher une page) pour recuperer des données
//    ou POST pour envoyer des données (ex: formulaire)


/* =========================================================================
   ÉTAPE 2 : CONNEXION À LA BASE DE DONNÉES
   =========================================================================
   On inclut le fichier qui contient la variable $connexion (accès à la BDD).
*/
include_once 'config/db_access.php'; // include_once permet de continuer l'exécution même si le fichier est absent.

/* =========================================================================
   ÉTAPE 3 : DÉTERMINATION DE L'ACTION À EFFECTUER
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
   ÉTAPE 4 : LE ROUTEUR (AIGUILLAGE DES ACTIONS)
   =========================================================================
   Le "switch" fonctionne comme un grand carrefour. Selon la valeur de $action,
   le code va aller dans la section (le "case") correspondante.
*/
switch ($action) {

    /* -------------------------------------------------------------------------
       ACTION : CONNEXION (LOGIN)
       ------------------------------------------------------------------------- */
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
        $mdp = $donnees['password'];

        // 4. Recherche de l'utilisateur dans la base de données

        // $stmt : C'est une variable qui contient une requête SQL préparée, mais pas encore exécutée.
        $stmt = $connexion->prepare('SELECT * FROM users WHERE email = ?'); // Prépare une requête sécurisée pour éviter les injections SQL
        $stmt->execute([$email]); // Exécute la requête avec l'email fourni
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

    /* -------------------------------------------------------------------------
       ACTION : INSCRIPTION (REGISTER)
       ------------------------------------------------------------------------- */
    case 'register': // Si l'action demandée est register (inscription), exécute ce bloc de code
        header('Content-Type: application/json');  // La réponse que je vais t'envoyer est en JSON

        // 1. Vérification que c'est bien une requête POST
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Action non autorisée']);
            exit;
        }

        // 2. Récupération et vérification des données (tous les champs sont obligatoires)
        $donnees = json_decode(file_get_contents("php://input"), true);
        if (!is_array($donnees) || empty($donnees['username']) || empty($donnees['email']) || empty($donnees['password'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Oups ! Merci de remplir tous les champs.']);
            exit;
        }

        // 3. Nettoyage
        $name = trim($donnees['username']);
        $email = strtolower(trim($donnees['email']));
        $password = $donnees['password'];

        // 4. Vérification si l'email ou le nom existent déjà dans la base
        $stmt = $connexion->prepare('SELECT id FROM users WHERE email = ? OR name = ?');
        $stmt->execute([$email, $name]);
        $existingUser = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existingUser) {
            http_response_code(409); // 409 = Conflict (Conflit de données)
            echo json_encode(['success' => false, 'message' => 'Ce nom ou cet email existe déjà.']);
            exit;
        }

        // 5. Cryptage (hachage) du mot de passe pour la sécurité (très important !)
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        // 6. Insertion du nouvel utilisateur dans la base de données
        $stmt = $connexion->prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
        $stmt->execute([$name, $email, $hashedPassword]);

        // 7. Renvoi d'un message de succès
        echo json_encode(['success' => true, 'message' => 'Inscription réussie']);
        exit;

    /* -------------------------------------------------------------------------
       ACTION : RÉCUPÉRER TOUS LES GROUPES
       ------------------------------------------------------------------------- */
    case 'get_groups':
        try {
            // Récupère tous les groupes, du plus récent au plus ancien
            $sql = "SELECT * FROM `groups` ORDER BY created_at DESC";
            $stmt = $connexion->prepare($sql);
            $stmt->execute();
            $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

            header('Content-Type: application/json');
            echo json_encode($groups);
        } catch(PDOException $e) {
            header('Content-Type: application/json');
            echo json_encode(["error" => $e->getMessage()]);
        }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : AJOUTER UNE DÉPENSE
       Reçoit les champs via POST FormData (fetch depuis Nouveau.js) -> INSERT INTO expenses
       ------------------------------------------------------------------------- */
    case 'add_depense':
        if (!isset($_SESSION['utilisateur'])) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Non connecté']);
            exit;
        }
        if ($_SERVER["REQUEST_METHOD"] == "POST") { //
            // Récupération des données du formulaire avec nettoyage (XSS et types)
            // EXPLICATION SÉCURITÉ :
            // 1. intval() : Force la donnée à être un nombre entier. Si un pirate envoie du texte ou du code SQL, ça deviendra un simple 0.
            // 2. floatval() : Idem, mais pour les nombres à virgule (les montants).
            // 3. htmlspecialchars() : Convertit les caractères spéciaux (comme < ou >) en entités inoffensives (&lt;, &gt;). Cela empêche un attaquant d'injecter du code Javascript (Faille XSS).
            $group_id = intval($_POST['group_id'] ?? 0);
            $payer_id = intval($_POST['payer_id'] ?? $_SESSION['utilisateur']['id']);
            $amount   = floatval($_POST['amount'] ?? 0);
            $reason   = htmlspecialchars($_POST['reason'] ?? 'Sans motif');
            $date     = htmlspecialchars($_POST['expense_date'] ?? date('Y-m-d'));

            try {
                // Insertion dans la table des dépenses
                $sql = "INSERT INTO expenses (group_id, payer_id, amount, expense_date, reason)
                        VALUES (:g, :p, :a, :d, :r)";
                $stmt = $connexion->prepare($sql);
                $stmt->execute([':g'=>$group_id, ':p'=>$payer_id, ':a'=>$amount, ':d'=>$date, ':r'=>$reason]);

                header('Content-Type: application/json');
                echo json_encode(['success' => true]);
            } catch(PDOException $e) {
                header('Content-Type: application/json');
                echo json_encode(['error' => $e->getMessage()]);
            }
        }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : AJOUTER UN GROUPE
       ------------------------------------------------------------------------- */
    case 'add_group':
        if (!isset($_SESSION['utilisateur'])) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Non connecté']);
            exit;
        }
        if ($_SERVER["REQUEST_METHOD"] == "POST") {
            // htmlspecialchars empêche l'exécution de code malveillant (Faille XSS)
            $name        = htmlspecialchars($_POST['name']);
            $description = htmlspecialchars($_POST['description']);
            $created_by  = (int) $_SESSION['utilisateur']['id']; // ID réel de l'utilisateur connecté

            try {
                $sql = "INSERT INTO `groups` (name, description, created_by) VALUES (:n, :d, :c)";
                $stmt = $connexion->prepare($sql);
                $stmt->execute([':n' => $name, ':d' => $description, ':c' => $created_by]);

                // Ajout automatique du créateur comme premier membre du groupe
                $new_group_id = (int) $connexion->lastInsertId();
                $stmt2 = $connexion->prepare("INSERT INTO participations (user_id, group_id) VALUES (?, ?)");
                $stmt2->execute([$created_by, $new_group_id]);

                header('Content-Type: application/json');
                echo json_encode(['success' => true]);
            } catch(PDOException $e) {
                header('Content-Type: application/json');
                echo json_encode(['error' => $e->getMessage()]);
            }
        }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : SUPPRIMER UN GROUPE
       ------------------------------------------------------------------------- */
    case 'delete_group':
        if (!isset($_SESSION['utilisateur'])) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Non connecté']);
            exit;
        }
        if ($_SERVER["REQUEST_METHOD"] == "POST") {
            // intval sécurise l'ID en forçant que ce soit bien un nombre entier
            $id = intval($_POST['id']);
            try {
                $sql = "DELETE FROM `groups` WHERE id = :id";
                $stmt = $connexion->prepare($sql);
                $stmt->execute([':id' => $id]);

                header('Content-Type: application/json');
                echo json_encode(["success" => true]);
            } catch(PDOException $e) {
                header('Content-Type: application/json');
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : TABLEAU DE BORD (GET_DASHBOARD)
       Retourne en une seule requête : groupes, dépenses récentes, et soldes.
       Flux : frontend fetch() -> session PHP -> 3 requêtes SQL -> JSON -> Vue.js
       ------------------------------------------------------------------------- */
    case 'get_dashboard':
        // Vérifie que l'utilisateur est connecté (session PHP active)
        if (!isset($_SESSION['utilisateur'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Non connecté']);
            exit;
        }
        // Récupère l'ID de l'utilisateur depuis la session (stockée au moment du login)
        $uid = (int) $_SESSION['utilisateur']['id'];

        try {
            header('Content-Type: application/json');

            // --- Flux SQL 1 : récupère les 5 groupes les plus récents ---
            $stmt = $connexion->prepare(
                "SELECT * FROM `groups` ORDER BY created_at DESC LIMIT 5"
            );
            $stmt->execute();
            $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // --- Flux SQL 2 : récupère les 5 dernières dépenses avec nom du groupe ET nom du payeur ---
            // Double LEFT JOIN : expenses -> groups (nom du groupe) + expenses -> users (nom du payeur)
            // Utilise l'ID réel de la table users, pas un ID hardcodé
            $stmt = $connexion->prepare(
                "SELECT e.*, g.name AS group_name, u.name AS payer_name
                 FROM expenses e
                 LEFT JOIN `groups` g ON e.group_id = g.id
                 LEFT JOIN users u ON e.payer_id = u.id
                 ORDER BY e.expense_date DESC
                 LIMIT 5"
            );
            $stmt->execute();
            $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // --- Flux SQL 3 : calcul des soldes sur TOUTES les dépenses ---
            // Une seule ligne de résultat : pas de filtre par groupe ni de sous-requête.
            // Cela fonctionne même si l'utilisateur n'a pas encore de dépense enregistrée.
            // - nb_membres     = nombre de payeurs distincts dans toute l'appli (proxy pour "membres")
            // - j_ai_paye      = somme des dépenses où c'est moi qui ai payé (payer_id = $uid)
            // - autres_ont_paye= somme des dépenses payées par les autres
            $stmt = $connexion->prepare(
                "SELECT
                    COUNT(DISTINCT payer_id)                                       AS nb_membres,
                    SUM(CASE WHEN payer_id = ? THEN amount ELSE 0 END)             AS j_ai_paye,
                    SUM(CASE WHEN payer_id != ? THEN amount ELSE 0 END)            AS autres_ont_paye
                 FROM expenses"
            );
            $stmt->execute([$uid, $uid]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            // Formule de répartition équitable (n = nombre de membres) :
            // - je_dois    = ma quote-part de ce que les autres ont avancé    (1/n de chaque dépense)
            // - on_me_doit = la part que les autres me doivent sur mes avances ((n-1)/n de mes dépenses)
            $n          = max(1, (int) $row['nb_membres']); // évite la division par zéro
            $je_dois    = round((float) $row['autres_ont_paye'] / $n, 2);
            $on_me_doit = round((float) $row['j_ai_paye'] * ($n - 1) / $n, 2);

            // --- Flux SQL 4 : total personnel de toutes mes dépenses (sans filtre de date) ---
            // On ne filtre PAS par mois courant : les données de test peuvent être sur n'importe quelle date.
            // payer_id = $uid -> on ne compte que ce que MOI j'ai réellement payé.
            $stmt = $connexion->prepare(
                "SELECT COALESCE(SUM(amount), 0) AS total_mois
                 FROM expenses
                 WHERE payer_id = ?"
            );
            $stmt->execute([$uid]);
            $mensuel = $stmt->fetch(PDO::FETCH_ASSOC);

            // Flux retour : envoi des 4 blocs de données en JSON vers le frontend Vue.js
            echo json_encode([
                'groups'   => $groups,
                'expenses' => $expenses,
                'balance'  => [
                    'je_dois'    => round($je_dois, 2),
                    'on_me_doit' => round($on_me_doit, 2),
                    'total_mois' => round((float) $mensuel['total_mois'], 2)
                ]
            ]);
        } catch (PDOException $e) {
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : SOLDE DU MOIS AFFICHÉ DANS LE CALENDRIER
       Reçoit year et month en GET -> retourne je_dois/on_me_doit pour ce mois uniquement
       Flux : Vue watch(calendarMonth) -> fetch ?action=get_monthly_balance&year=&month= -> JSON
       ------------------------------------------------------------------------- */
    case 'get_monthly_balance':
        if (!isset($_SESSION['utilisateur'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Non connecté']);
            exit;
        }
        $uid   = (int) $_SESSION['utilisateur']['id'];
        $year  = (int) ($_GET['year']  ?? date('Y'));
        $month = (int) ($_GET['month'] ?? date('n'));

        header('Content-Type: application/json');
        try {
            // Même formule que le solde global, mais filtrée sur le mois affiché dans le calendrier
            $stmt = $connexion->prepare(
                "SELECT
                    COUNT(DISTINCT payer_id)                                    AS nb_membres,
                    SUM(CASE WHEN payer_id = ? THEN amount ELSE 0 END)          AS j_ai_paye,
                    SUM(CASE WHEN payer_id != ? THEN amount ELSE 0 END)         AS autres_ont_paye
                 FROM expenses
                 WHERE YEAR(expense_date) = ? AND MONTH(expense_date) = ?"
            );
            $stmt->execute([$uid, $uid, $year, $month]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $n = max(1, (int) $row['nb_membres']);
            echo json_encode([
                'je_dois'    => round((float) $row['autres_ont_paye'] / $n, 2),
                'on_me_doit' => round((float) $row['j_ai_paye'] * ($n - 1) / $n, 2)
            ]);
        } catch (PDOException $e) {
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit;

    /* -------------------------------------------------------------------------
       REQUÊTE 1 : TOTAL AVANCÉ PAR MEMBRE DANS UN GROUPE
       Utilisée dans Groupes.js pour afficher "qui a payé quoi" dans le détail
       ------------------------------------------------------------------------- */
    case 'get_group_totals':
        header('Content-Type: application/json');
        $gid = (int) ($_GET['group_id'] ?? 0);
        try {
            // Requête 1 : JOIN expenses + users -> SUM par payeur -> base pour calculer les remboursements
            $stmt = $connexion->prepare(
                "SELECT users.name AS nom_payeur, SUM(expenses.amount) AS total_avance
                 FROM expenses
                 JOIN users ON expenses.payer_id = users.id
                 WHERE expenses.group_id = ?
                 GROUP BY users.id, users.name"
            );
            $stmt->execute([$gid]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (PDOException $e) { echo json_encode(['error' => $e->getMessage()]); }
        exit;

    /* -------------------------------------------------------------------------
       REQUÊTE 2 : DÉPENSES D'UN GROUPE AVEC NOM DU PAYEUR
       Utilisée dans Groupes.js — version lisible de la requête 1 (JOIN users)
       ------------------------------------------------------------------------- */
    case 'get_group_expenses_named':
        header('Content-Type: application/json');
        $gid = (int) ($_GET['group_id'] ?? 0);
        try {
            // Requête 2 : JOIN expenses + users -> remplace payer_id par un vrai prénom
            $stmt = $connexion->prepare(
                "SELECT users.name AS payeur, expenses.reason, expenses.amount, expenses.expense_date
                 FROM expenses
                 JOIN users ON expenses.payer_id = users.id
                 WHERE expenses.group_id = ?
                 ORDER BY expenses.amount DESC"
            );
            $stmt->execute([$gid]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (PDOException $e) { echo json_encode(['error' => $e->getMessage()]); }
        exit;

    /* -------------------------------------------------------------------------
       REQUÊTE 3 : MEMBRES D'UN GROUPE
       Utilisée dans Groupes.js via get_group_members
       ------------------------------------------------------------------------- */
    case 'get_group_members':
        header('Content-Type: application/json');
        $gid = (int) ($_GET['group_id'] ?? 0);
        try {
            // Requête 3 : JOIN users + participations -> liste des membres du groupe
            $stmt = $connexion->prepare(
                "SELECT users.name, users.email
                 FROM users
                 JOIN participations ON users.id = participations.user_id
                 WHERE participations.group_id = ?"
            );
            $stmt->execute([$gid]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (PDOException $e) { echo json_encode(['error' => $e->getMessage()]); }
        exit;

    /* -------------------------------------------------------------------------
       REQUÊTE 4 : REMBOURSEMENTS D'UN GROUPE
       Utilisée dans Groupes.js via get_group_settlements
       ------------------------------------------------------------------------- */
    case 'get_group_settlements':
        header('Content-Type: application/json');
        $gid = (int) ($_GET['group_id'] ?? 0);
        try {
            // Requête 4 : double JOIN sur users -> remplace sender_id et receiver_id par leurs noms
            $stmt = $connexion->prepare(
                "SELECT sender.name AS a_paye, receiver.name AS a_recu,
                        settlements.amount, settlements.settlement_date
                 FROM settlements
                 JOIN users AS sender   ON settlements.sender_id   = sender.id
                 JOIN users AS receiver ON settlements.receiver_id = receiver.id
                 WHERE settlements.group_id = ?
                 ORDER BY settlements.settlement_date DESC"
            );
            $stmt->execute([$gid]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (PDOException $e) { echo json_encode(['error' => $e->getMessage()]); }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : RÉCUPÉRER TOUS LES UTILISATEURS
       Utilisé pour peupler le menu déroulant "Payé par" avec les vrais IDs BDD
       ------------------------------------------------------------------------- */
    case 'get_users':
        header('Content-Type: application/json');
        try {
            $stmt = $connexion->prepare("SELECT id, name FROM users ORDER BY name");
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (PDOException $e) {
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : RÉCUPÉRER UNE DÉPENSE PAR SON ID
       Utilisée par EditExpense.js pour pré-remplir le formulaire de modification
       ------------------------------------------------------------------------- */
    case 'get_expense':
        header('Content-Type: application/json');
        $id = (int) ($_GET['id'] ?? 0);
        try {
            $stmt = $connexion->prepare("SELECT * FROM expenses WHERE id = ?");
            $stmt->execute([$id]);
            $expense = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode($expense ?: ['error' => 'Dépense introuvable']);
        } catch (PDOException $e) { echo json_encode(['error' => $e->getMessage()]); }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : MODIFIER UNE DÉPENSE
       Reçoit les champs via POST FormData -> met à jour la ligne dans expenses
       ------------------------------------------------------------------------- */
    case 'update_expense':
        if (!isset($_SESSION['utilisateur'])) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Non connecté']);
            exit;
        }
        header('Content-Type: application/json');
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $id       = intval($_POST['id']           ?? 0);
            $group_id = intval($_POST['group_id']     ?? 0);
            $payer_id = intval($_POST['payer_id']     ?? 0);
            $amount   = floatval($_POST['amount']     ?? 0);
            $reason   = htmlspecialchars($_POST['reason']       ?? '');
            $date     = htmlspecialchars($_POST['expense_date'] ?? date('Y-m-d'));
            try {
                $stmt = $connexion->prepare(
                    "UPDATE expenses
                     SET group_id=:g, payer_id=:p, amount=:a, expense_date=:d, reason=:r
                     WHERE id=:id"
                );
                $stmt->execute([':g'=>$group_id,':p'=>$payer_id,':a'=>$amount,':d'=>$date,':r'=>$reason,':id'=>$id]);
                echo json_encode(['success' => true]);
            } catch (PDOException $e) { echo json_encode(['error' => $e->getMessage()]); }
        }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : ENREGISTRER UN REMBOURSEMENT
       Flux : Groupes.js -> FormData (group_id, sender_id, receiver_id, amount) -> INSERT
       ------------------------------------------------------------------------- */
    case 'add_settlement':
        if (!isset($_SESSION['utilisateur'])) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Non connecté']);
            exit;
        }
        header('Content-Type: application/json');
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $group_id    = intval($_POST['group_id']    ?? 0);
            $sender_id   = intval($_POST['sender_id']   ?? 0);
            $receiver_id = intval($_POST['receiver_id'] ?? 0);
            $amount      = floatval($_POST['amount']    ?? 0);
            $date        = date('Y-m-d');
            try {
                $stmt = $connexion->prepare(
                    "INSERT INTO settlements (group_id, sender_id, receiver_id, amount, settlement_date)
                     VALUES (?, ?, ?, ?, ?)"
                );
                $stmt->execute([$group_id, $sender_id, $receiver_id, $amount, $date]);
                echo json_encode(['success' => true]);
            } catch (PDOException $e) { echo json_encode(['error' => $e->getMessage()]); }
        }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : AJOUTER UN MEMBRE À UN GROUPE
       INSERT IGNORE évite l'erreur si l'utilisateur est déjà membre (contrainte UNIQUE)
       ------------------------------------------------------------------------- */
    case 'add_member':
        if (!isset($_SESSION['utilisateur'])) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Non connecté']);
            exit;
        }
        header('Content-Type: application/json');
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $user_id  = intval($_POST['user_id']  ?? 0);
            $group_id = intval($_POST['group_id'] ?? 0);
            try {
                $stmt = $connexion->prepare(
                    "INSERT IGNORE INTO participations (user_id, group_id) VALUES (?, ?)"
                );
                $stmt->execute([$user_id, $group_id]);
                echo json_encode(['success' => true]);
            } catch (PDOException $e) { echo json_encode(['error' => $e->getMessage()]); }
        }
        exit;

    /* -------------------------------------------------------------------------
       SI L'ACTION DEMANDÉE N'EXISTE PAS (SÉCURITÉ)
       ------------------------------------------------------------------------- */
    default:
        http_response_code(400); // 400 = Bad Request (Requête mal formulée)
        echo json_encode(['message' => 'Action inconnue ou manquante.']);
        exit;
}
