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
    7.  Flux 6  ........  delete_group      — Supprimer un groupe (cascade : settlements → expenses → participations → groups)
    8.  Flux 9  ........  get_dashboard     — Tableau de bord (4 requêtes SQL)
    9.  Flux 10  .......  get_monthly_balance — Solde filtré par mois/année
   10.  Flux 11  .......  get_group_totals          — Total avancé par membre
                          get_group_expenses_named  — Dépenses avec noms (JOIN users)
                          get_group_members         — Membres du groupe
                          get_group_settlements     — Historique remboursements
   11.  Flux 12  .......  add_member        — Ajouter un membre à un groupe
   12.  Flux 13  .......  add_settlement    — Enregistrer un remboursement
   13.  Flux 14  .......  get_expense       — Charger une dépense (pré-remplissage)
                          update_expense    — Sauvegarder la modification
   14.  Flux 15  .......  delete_expense    — Supprimer une dépense
   15.  Default  .......  Action inconnue → 400
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
ini_set('session.cookie_lifetime', 86400); // 24 heures : durée raisonnable pour une session utilisateur
ini_set('session.gc_maxlifetime',  86400); // Garde les données de session côté serveur aussi longtemps
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
$host = 'https://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
add_headers_origin($host, true, false, false); // autorise cette origine précise, avec des options de sécurité activées selon les paramètres passés

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
   Ordre : Flux 1 → 2 → 3 → 4 → 5 → 6 → 9 → 10 → 11 → 12 → 13 → 14
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
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Action non autorisée']); // Si ce n'est pas le cas, on refuse l'accès
            exit;
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

        // 3. Nettoyage
        $name = trim($donnees['username']);
        $email = strtolower(trim($donnees['email']));
        $password = $donnees['password'];

        // 4. Vérification si l'email ou le nom existent déjà dans la base
        // $stmt : C’est une variable qui contient une requête SQL préparée, mais pas encore exécutée.

        $stmt = $connexion->prepare('SELECT id FROM users WHERE email = ? OR name = ?');
        $stmt->execute([$email, $name]); // Exécute la requête avec l'email fourni
        $existingUser = $stmt->fetch(PDO::FETCH_ASSOC);
        // PDO = Méthode PHP  pour communiquer avec une base de données de manière sécurisée.
        // Elle évie lesw injections SQL et fonctionne avec plusieurs types de bases

        //=> prepare - execute - fetch (cycle complet) : 1. ecrire la requete 2. injecter la valeur 3. récupérer le resultat

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

    /* =========================================================================
       FLUX N°3 : AFFICHER LES GROUPES ET LES UTILISATEURS
       Flux : Nouveau.js + Groupes.js au montage → GET get_groups → liste des groupes
              Nouveau.js + EditExpense.js au montage → GET get_users → liste des membres
       ========================================================================= */
    case 'get_groups':
        try {
            // Récupère tous les groupes, du plus récent au plus ancien
            $sql = "SELECT * FROM `groups` ORDER BY created_at DESC";
            $stmt = $connexion->prepare($sql);
            $stmt->execute();
            $groups = $stmt->fetchAll(PDO::FETCH_ASSOC); // Transforme le résultat en tableau PHP

            header('Content-Type: application/json');
            echo json_encode($groups); // Renvoie les données au format JSON au frontend
        } catch(PDOException $e) {
            header('Content-Type: application/json');
            echo json_encode(["error" => $e->getMessage()]);
        }
        exit;

    case 'get_users':
        // Utilisé pour peupler le menu déroulant "Payé par" avec les vrais IDs BDD
        header('Content-Type: application/json');
        try {
            $stmt = $connexion->prepare("SELECT id, name FROM users ORDER BY name");
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (PDOException $e) {
            echo json_encode(['error' => $e->getMessage()]);
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

    /* =========================================================================
       FLUX N°5 : AJOUTER UNE DÉPENSE
       Flux : Nouveau.js submitForm() → POST FormData (group_id, payer_id, amount, reason, expense_date)
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

    /* =========================================================================
       FLUX N°6 : SUPPRIMER UN GROUPE
       Flux : Groupes.js deleteGroup() → POST FormData (id)
              → suppression en cascade manuelle (respecte les clés étrangères) :
                1. DELETE settlements WHERE group_id
                2. DELETE expenses WHERE group_id
                3. DELETE participations WHERE group_id
                4. DELETE groups WHERE id
              → { success: true }
       ========================================================================= */
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
                // Suppression dans l'ordre pour respecter les contraintes de clés étrangères
                $connexion->prepare("DELETE FROM settlements  WHERE group_id = ?")->execute([$id]);
                $connexion->prepare("DELETE FROM expenses     WHERE group_id = ?")->execute([$id]);
                $connexion->prepare("DELETE FROM participations WHERE group_id = ?")->execute([$id]);

                $stmt = $connexion->prepare("DELETE FROM `groups` WHERE id = ?");
                $stmt->execute([$id]);

                header('Content-Type: application/json');
                echo json_encode(["success" => true]);
            } catch(PDOException $e) {
                header('Content-Type: application/json');
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        exit;

    /* =========================================================================
       FLUX N°9 : TABLEAU DE BORD (DASHBOARD)
       Flux : Accueil.js fetchDashboard() → GET get_dashboard
              → session PHP → 4 requêtes SQL → JSON (groups, expenses, balance)
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
        $uid = (int) $_SESSION['utilisateur']['id'];

        try {
            header('Content-Type: application/json');

            // --- Requête SQL 1 : récupère les 5 groupes les plus récents ---
            $stmt = $connexion->prepare(
                "SELECT * FROM `groups` ORDER BY created_at DESC LIMIT 5"
            );
            $stmt->execute();
            $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // --- Requête SQL 2 : récupère les 5 dernières dépenses avec nom du groupe ET nom du payeur ---
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

            // --- Requête SQL 3 : calcul des soldes sur TOUTES les dépenses ---
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

            // --- Requête SQL 4 : total personnel de toutes mes dépenses (sans filtre de date) ---
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

    /* =========================================================================
       FLUX N°10 : SOLDE MENSUEL DU CALENDRIER
       Flux : Accueil.js watch(calendarMonth) → GET get_monthly_balance?year=&month=
              → même formule que Flux 9 mais filtrée sur le mois affiché → JSON
       ========================================================================= */
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

    /* =========================================================================
       FLUX N°11 : CONSULTER LES DÉTAILS D'UN GROUPE
       4 requêtes GET séparées, appelées en parallèle par Groupes.js (Promise.all)
       Flux : Groupes.js selectGroup() → Promise.all([get_group_totals,
              get_group_expenses_named, get_group_members, get_group_settlements])
       ========================================================================= */

    // Requête 1/4 : total avancé par membre dans un groupe (base de calcul des remboursements)
    case 'get_group_totals':
        header('Content-Type: application/json');
        $gid = (int) ($_GET['group_id'] ?? 0);
        try {
            // JOIN expenses + users -> SUM par payeur -> base pour calculer les remboursements
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

    // Requête 2/4 : dépenses d'un groupe avec nom du payeur (version lisible)
    case 'get_group_expenses_named':
        header('Content-Type: application/json');
        $gid = (int) ($_GET['group_id'] ?? 0);
        try {
            // JOIN expenses + users -> remplace payer_id par un vrai prénom
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

    // Requête 3/4 : membres d'un groupe (via la table participations)
    case 'get_group_members':
        header('Content-Type: application/json');
        $gid = (int) ($_GET['group_id'] ?? 0);
        try {
            // JOIN users + participations -> liste des membres du groupe
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

    // Requête 4/4 : remboursements enregistrés dans un groupe
    case 'get_group_settlements':
        header('Content-Type: application/json');
        $gid = (int) ($_GET['group_id'] ?? 0);
        try {
            // Double JOIN sur users -> remplace sender_id et receiver_id par leurs noms
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

    /* =========================================================================
       FLUX N°12 : AJOUTER UN MEMBRE À UN GROUPE
       Flux : Groupes.js addMember() → POST FormData (user_id, group_id)
              → INSERT IGNORE participations → { success: true }
              INSERT IGNORE évite l'erreur si l'utilisateur est déjà membre (contrainte UNIQUE)
       ========================================================================= */
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

    /* =========================================================================
       FLUX N°13 : ENREGISTRER UN REMBOURSEMENT (SETTLEMENT)
       Flux : Groupes.js recordSettlement() → POST FormData (group_id, sender_id, receiver_id, amount)
              → INSERT settlements → { success: true }
       ========================================================================= */
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

    /* =========================================================================
       FLUX N°14 : MODIFIER UNE DÉPENSE
       Flux : EditExpense.js mounted() → GET get_expense?id= → pré-remplissage du formulaire
              EditExpense.js saveExpense() → POST FormData (id, group_id, payer_id, ...) → UPDATE expenses
       ========================================================================= */

    // Requête 1/2 : récupérer une dépense par son ID (pré-remplissage du formulaire)
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

    // Requête 2/2 : enregistrer les modifications de la dépense
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

    /* =========================================================================
       FLUX N°15 : SUPPRIMER UNE DÉPENSE
       Flux : EditExpense.js deleteExpense() → POST FormData (id)
              → DELETE FROM expenses WHERE id → { success: true }
       ========================================================================= */
    case 'delete_expense':
        if (!isset($_SESSION['utilisateur'])) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Non connecté']);
            exit;
        }
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $id = intval($_POST['id'] ?? 0);
            header('Content-Type: application/json');
            try {
                $stmt = $connexion->prepare("DELETE FROM expenses WHERE id = ?");
                $stmt->execute([$id]);
                echo json_encode(['success' => true]);
            } catch (PDOException $e) {
                echo json_encode(['error' => $e->getMessage()]);
            }
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
