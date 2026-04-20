<?php
session_start();

$host = 'localhost';
$db = 'ebus2_projet03_aarr19';
$user = 'ar62yy13raif';
$pass = 'a0~p6a?2pa';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
];
try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    throw new \PDOException($e->getMessage(), (int)$e->getCode());
}


// On vérifie que c'est bien un envoi de formulaire (POST)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // On récupère les données envoyées par ton application Vue.js
    $donnees = json_decode(file_get_contents("php://input"), true);

    // Vérification : est-ce que les cases sont remplies ?
    if (empty($donnees['username']) || empty($donnees['password'])) {
        http_response_code(400);
        echo json_encode(['message' => 'Oups ! Merci de remplir tous les champs.']);
        exit;
    }

    $pseudo = strtolower(trim($donnees['username']));
    $mdp = $donnees['password'];

    // 1. On cherche l'utilisateur dans la base de données via PDO
    $stmt = $pdo->prepare('SELECT * FROM users WHERE pseudo = ?');
    $stmt->execute([$pseudo]);
    $infosUtilisateur = $stmt->fetch();

    // 2. Vérification : l'utilisateur existe-t-il ET le mot de passe est-il valide ?
    // password_verify compare le mot de passe tapé ($mdp) avec le mot de passe crypté de la BDD
    if (!$infosUtilisateur || !password_verify($mdp, $infosUtilisateur['password'])) { 
        sleep(1); // Sécurité pour ralentir les robots
        http_response_code(401);
        echo json_encode(['message' => 'Identifiants Fairpay incorrects.']);
        exit;
    }

    // 3. Si tout est bon, on crée la session (la connexion reste active)
    // On ajoute 'id' pour pouvoir identifier l'utilisateur facilement plus tard dans d'autres requêtes
    $_SESSION['utilisateur'] = [
       'id'     => $infosUtilisateur['id'],
       'pseudo' => $infosUtilisateur['pseudo'],
       'nom'    => $infosUtilisateur['nom'],
       'role'   => $infosUtilisateur['role'],
       'heure'  => date('H:i')
    ];

    // On répond à Vue.js que c'est gagné !
    http_response_code(200);
    echo json_encode([
        'connexion' => true,
        'user'      => $_SESSION['utilisateur']
    ]);
    exit;
}

// Si quelqu'un essaie d'accéder au fichier sans envoyer de formulaire
http_response_code(405);
echo json_encode(['message' => 'Action non autorisée']);