<?php
session_start();

header('Content-Type: application/json'); // On indique que la réponse renvoyée sera du JSON

// ------------------------------
// CONFIGURATION DE LA BDD
// ------------------------------

$host = 'localhost';
$db = 'ebus2_projet03_aarr19';
$user = 'ar62yy13raif';
$pass = 'a0~p6a?2pa';
$charset = 'utf8mb4';

// Chaîne de connexion à la base de données
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";


// Options PDO pour afficher les erreurs SQL et récupérer les résultats sous forme de tableau associatif
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
];

// ------------------------------
// CONNEXION À LA BDD
// ------------------------------
try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
     // Si la connexion échoue, on renvoie une erreur JSON 
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erreur de connexion à la base de données']);
    exit;
}

// ------------------------------
// VÉRIFICATION DE LA MÉTHODE HTTP
// ------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    // Le fichier register.php doit être appelé uniquement en POST
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Action non autorisée']);
    exit;
}

// ------------------------------
// RÉCUPÉRATION DES DONNÉES JSON ENVOYÉES PAR FETCH()
// ------------------------------
$donnees = json_decode(file_get_contents("php://input"), true);

// Vérifie si le JSON reçu est valide
if (!is_array($donnees)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'JSON invalide']);
    exit;
}

// ------------------------------
// VÉRIFICATION DES CHAMPS OBLIGATOIRES
// ------------------------------
if (empty($donnees['username']) || empty($donnees['email']) || empty($donnees['password'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Oups ! Merci de remplir tous les champs.']);
    exit;
}

// On nettoie les valeurs reçues
$name = trim($donnees['username']);
$email = strtolower(trim($donnees['email']));
$password = $donnees['password'];

// ------------------------------
// VÉRIFICATION DES DOUBLONS
// ------------------------------
// On cherche si un utilisateur existe déjà avec le même email ou le même nom
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? OR name = ?');
$stmt->execute([$email, $name]);
$existingUser = $stmt->fetch();

if ($existingUser) {
    // Si on trouve un utilisateur, on refuse l'inscription
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Ce nom ou cet email existe déjà.']);
    exit;
}


// ------------------------------
// HACHAGE DU MOT DE PASSE
// ------------------------------
// On transforme le mot de passe en version sécurisée avant de l’enregistrer
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// ------------------------------
// INSERTION DANS LA BDD
// ------------------------------
// On insère le nouvel utilisateur dans la table users
$stmt = $pdo->prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
$stmt->execute([$name, $email, $hashedPassword]);


// ------------------------------
// RÉPONSE DE SUCCÈS
// ------------------------------
echo json_encode([
    'success' => true,
    'message' => 'Inscription réussie'
]);