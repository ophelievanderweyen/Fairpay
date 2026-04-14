<?php
session_start();

// Simulation de la base de données des membres de Fairpay
$MEMBRES = [
    'aurelie' => ['password' => 'paye123',   'role' => 'admin',  'nom' => 'Aurélie'],
    'dina'    => ['password' => 'monney456', 'role' => 'user',   'nom' => 'Dina'],
    'kawthar' => ['password' => 'fairpay78', 'role' => 'user',   'nom' => 'Kawthar'],
];

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

    // Vérification : est-ce que l'utilisateur existe et le mot de passe est bon ?
    if (!isset($MEMBRES[$pseudo]) || $MEMBRES[$pseudo]['password'] !== $mdp) {
        sleep(1); // Sécurité pour ralentir les robots
        http_response_code(401);
        echo json_encode(['message' => 'Identifiants Fairpay incorrects.']);
        exit;
    }

    // Si tout est bon, on crée la session (la connexion reste active)
    $infosUtilisateur = $MEMBRES[$pseudo];
    
    $_SESSION['utilisateur'] = [
       'pseudo' => $pseudo,
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