<?php
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.cookie_samesite', 'Strict');
session_start();

if (!empty($_SERVER['HTTPS'])) {
    header("Strict-Transport-Security: max-age=31536000");
}
include_once 'config/db_access.php';

$action = $_GET['action'] ?? '';

// Fallback for login/register if action is not passed via query string
if ($action === '' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw_input = file_get_contents("php://input");
    $donnees = json_decode($raw_input, true);
    if (is_array($donnees)) {
        if (isset($donnees['username'])) {
            $action = 'register';
        } elseif (isset($donnees['email']) && isset($donnees['password'])) {
            $action = 'login';
        }
    }
}

switch ($action) {
    case 'login':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['message' => 'Action non autorisée']);
            exit;
        }

        $donnees = json_decode(file_get_contents("php://input"), true);
        if (empty($donnees['email']) || empty($donnees['password'])) {
            http_response_code(400);
            echo json_encode(['message' => 'Oups ! Merci de remplir tous les champs.']);
            exit;
        }

        $email = strtolower(trim($donnees['email']));
        $mdp = $donnees['password'];

        $stmt = $connexion->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $infosUtilisateur = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$infosUtilisateur || !password_verify($mdp, $infosUtilisateur['password'])) {
            sleep(1);
            http_response_code(401);
            echo json_encode(['message' => 'Identifiants Fairpay incorrects.']);
            exit;
        }

        $_SESSION['utilisateur'] = [
           'id'     => $infosUtilisateur['id'],
           'pseudo' => $infosUtilisateur['name'],
           'nom'    => $infosUtilisateur['email'],
           'heure'  => date('H:i')
        ];

        http_response_code(200);
        echo json_encode([
            'connexion' => true,
            'user'      => $_SESSION['utilisateur']
        ]);
        exit;

    case 'register':
        header('Content-Type: application/json');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Action non autorisée']);
            exit;
        }

        $donnees = json_decode(file_get_contents("php://input"), true);
        if (!is_array($donnees) || empty($donnees['username']) || empty($donnees['email']) || empty($donnees['password'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Oups ! Merci de remplir tous les champs.']);
            exit;
        }

        $name = trim($donnees['username']);
        $email = strtolower(trim($donnees['email']));
        $password = $donnees['password'];

        $stmt = $connexion->prepare('SELECT id FROM users WHERE email = ? OR name = ?');
        $stmt->execute([$email, $name]);
        $existingUser = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existingUser) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Ce nom ou cet email existe déjà.']);
            exit;
        }

        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $connexion->prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
        $stmt->execute([$name, $email, $hashedPassword]);

        echo json_encode(['success' => true, 'message' => 'Inscription réussie']);
        exit;

    case 'get_expenses':
        try {
            $sql = "SELECT * FROM expenses ORDER BY expense_date DESC";
            $stmt = $connexion->prepare($sql);
            $stmt->execute();
            $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            header('Content-Type: application/json');
            echo json_encode($expenses);
        } catch(PDOException $e) {
            header('Content-Type: application/json');
            echo json_encode(["error" => $e->getMessage()]);
        }
        exit;

    case 'get_groups':
        try {
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

    case 'add_depense':
        if ($_SERVER["REQUEST_METHOD"] == "POST") {
            $group_id = $_POST['group_id'] ?? 1;
            $payer_id = $_POST['payer_id'] ?? 1;
            $amount   = $_POST['amount']   ?? 0;
            $reason   = $_POST['reason']   ?? 'Sans motif';
            $date     = $_POST['expense_date'] ?? date('Y-m-d');

            try {
                $sql = "INSERT INTO expenses (group_id, payer_id, amount, expense_date, reason) 
                        VALUES (:g, :p, :a, :d, :r)";
                $stmt = $connexion->prepare($sql);
                $stmt->execute([':g'=>$group_id, ':p'=>$payer_id, ':a'=>$amount, ':d'=>$date, ':r'=>$reason]);

                header("Location: ../index.html");
                exit();
            } catch(PDOException $e) {
                die("Erreur base de données : " . $e->getMessage());
            }
        }
        exit;

    case 'add_group':
        if ($_SERVER["REQUEST_METHOD"] == "POST") {
            $name = htmlspecialchars($_POST['name']);
            $description = htmlspecialchars($_POST['description']);
            $created_by = 1; 

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

    case 'delete_group':
        if ($_SERVER["REQUEST_METHOD"] == "POST") {
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

    default:
        http_response_code(400);
        echo json_encode(['message' => 'Action inconnue ou manquante.']);
        exit;
}