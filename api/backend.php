<?php
/* =========================================================================
   ÉTAPE 1 : CONFIGURATION DE LA SÉCURITÉ ET DES SESSIONS
   ========================================================================= 
   Ces premières lignes s'assurent que les "cookies de session" (qui 
   maintiennent l'utilisateur connecté) sont sécurisés et ne peuvent pas 
   être volés par des scripts malveillants.
*/
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.cookie_samesite', 'Strict');
session_start(); // On démarre la session pour pouvoir stocker les infos de l'utilisateur

if (!empty($_SERVER['HTTPS'])) {
    header("Strict-Transport-Security: max-age=31536000");
}

/* =========================================================================
   ÉTAPE 2 : CONNEXION À LA BASE DE DONNÉES
   ========================================================================= 
   On inclut le fichier qui contient la variable $connexion (accès à la BDD).
*/
include_once 'config/db_access.php';

/* =========================================================================
   ÉTAPE 3 : DÉTERMINATION DE L'ACTION À EFFECTUER
   ========================================================================= 
   Le frontend envoie ses requêtes vers "backend.php?action=quelqueChose".
   Ici, on regarde quelle "action" a été demandée.
*/
$action = $_GET['action'] ?? '';

// Si aucune action n'est dans l'URL mais qu'on reçoit des données JSON (POST),
// on essaie de deviner si c'est une connexion (login) ou une inscription (register).
if ($action === '' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw_input = file_get_contents("php://input"); // On lit les données envoyées
    $donnees = json_decode($raw_input, true);      // On les transforme en tableau PHP
    if (is_array($donnees)) {
        if (isset($donnees['username'])) {
            $action = 'register'; // S'il y a un username, c'est une inscription
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
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['message' => 'Action non autorisée']);
            exit;
        }

        // 2. Récupération des données envoyées par le frontend
        $donnees = json_decode(file_get_contents("php://input"), true);
        if (empty($donnees['email']) || empty($donnees['password'])) {
            http_response_code(400);
            echo json_encode(['message' => 'Oups ! Merci de remplir tous les champs.']);
            exit;
        }

        // 3. Nettoyage des données (on met l'email en minuscules, on enlève les espaces)
        $email = strtolower(trim($donnees['email']));
        $mdp = $donnees['password'];

        // 4. Recherche de l'utilisateur dans la base de données
        $stmt = $connexion->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $infosUtilisateur = $stmt->fetch(PDO::FETCH_ASSOC);

        // 5. Vérification du mot de passe
        // password_verify vérifie si le mot de passe tapé correspond à celui haché en BDD
        if (!$infosUtilisateur || !password_verify($mdp, $infosUtilisateur['password'])) {
            sleep(1); // Ralentit les attaques par force brute (petite sécurité)
            http_response_code(401);
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
    case 'register':
        header('Content-Type: application/json');
        
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
       ACTION : RÉCUPÉRER TOUTES LES DÉPENSES
       ------------------------------------------------------------------------- */
    case 'get_expenses':
        try {
            // Requête SQL pour tout sélectionner dans la table expenses
            $sql = "SELECT * FROM expenses ORDER BY expense_date DESC";
            $stmt = $connexion->prepare($sql);
            $stmt->execute();
            $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC); // Transforme le résultat en tableau PHP
            
            header('Content-Type: application/json');
            echo json_encode($expenses); // Renvoie les données au format JSON au frontend
        } catch(PDOException $e) {
            header('Content-Type: application/json');
            echo json_encode(["error" => $e->getMessage()]);
        }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : RÉCUPÉRER TOUS LES GROUPES
       ------------------------------------------------------------------------- */
    case 'get_groups':
        try {
            // Pareil que pour les dépenses, mais pour la table "groups"
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
       Cette action est souvent utilisée via un formulaire classique HTML
       ------------------------------------------------------------------------- */
    case 'add_depense':
        if ($_SERVER["REQUEST_METHOD"] == "POST") {
            // Récupération des données du formulaire
            $group_id = $_POST['group_id'] ?? 1;
            $payer_id = $_POST['payer_id'] ?? 1;
            $amount   = $_POST['amount']   ?? 0;
            $reason   = $_POST['reason']   ?? 'Sans motif';
            $date     = $_POST['expense_date'] ?? date('Y-m-d');

            try {
                // Insertion dans la table des dépenses
                $sql = "INSERT INTO expenses (group_id, payer_id, amount, expense_date, reason) 
                        VALUES (:g, :p, :a, :d, :r)";
                $stmt = $connexion->prepare($sql);
                $stmt->execute([':g'=>$group_id, ':p'=>$payer_id, ':a'=>$amount, ':d'=>$date, ':r'=>$reason]);

                // Redirection vers l'accueil après l'ajout
                header("Location: ../index.html");
                exit();
            } catch(PDOException $e) {
                die("Erreur base de données : " . $e->getMessage());
            }
        }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : AJOUTER UN GROUPE
       ------------------------------------------------------------------------- */
    case 'add_group':
        if ($_SERVER["REQUEST_METHOD"] == "POST") {
            // htmlspecialchars empêche l'exécution de code malveillant (Faille XSS)
            $name = htmlspecialchars($_POST['name']);
            $description = htmlspecialchars($_POST['description']);
            $created_by = 1; // Temporairement forcé à 1 (utilisateur "en dur" à améliorer plus tard)

            try {
                $sql = "INSERT INTO `groups` (name, description, created_by) VALUES (:n, :d, :c)";
                $stmt = $connexion->prepare($sql);
                $stmt->execute([':n' => $name, ':d' => $description, ':c' => $created_by]);

                header("Location: ../index.html");
                exit();
            } catch(PDOException $e) {
                die("Erreur : " . $e->getMessage());
            }
        }
        exit;

    /* -------------------------------------------------------------------------
       ACTION : SUPPRIMER UN GROUPE
       ------------------------------------------------------------------------- */
    case 'delete_group':
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
       SI L'ACTION DEMANDÉE N'EXISTE PAS (SÉCURITÉ)
       ------------------------------------------------------------------------- */
    default:
        http_response_code(400); // 400 = Bad Request (Requête mal formulée)
        echo json_encode(['message' => 'Action inconnue ou manquante.']);
        exit;
}