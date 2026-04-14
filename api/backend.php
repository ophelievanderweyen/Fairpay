<?php
session_start();

// on devrait chercher en DB
$USERS = [
    'alice'  => ['password' => 'password123', 'role' => 'admin',   'displayName' => 'Alice O\'Païdèmervaie'],
    'bob'    => ['password' => 'php8point3',  'role' => 'editor',  'displayName' => 'Bob Morane'],
    'claire' => ['password' => 'vuejs2026',   'role' => 'viewer',  'displayName' => 'Claire Obscur'],
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!isset($data['username']) || !isset($data['password'])) {
        echo json_encode(['error' => 'Champs manquants']);
        http_response_code(422);
        exit;
    }

    $username = trim($data['username']);
    $password = $data['password'];
    $remember = isset($data['remember']);

    if (!isset($USERS[$username]) || $USERS[$username]['password'] !== $password) {
        sleep(1); // Délai volontaire pour limiter le brute-force (incrémental ce serait mieux)
        echo json_encode(['error' => 'Identifiants incorrects']);
        http_response_code(401);
        exit;
    }
    $user = $USERS[$username];

    $_SESSION['user'] = [
       'username'    => $username,
       'displayName' => $user['displayName'],
       'role'        => $user['role'],
       'loginAt'     => date('d-m-Y H:i:s'),
    ];
    if ($remember) {
        // TODO traiter le ...
    }
    echo json_encode([
        'success' => true,
        'user'    => $_SESSION['user']]);
    http_response_code(200);
    exit;
}
http_response_code(405);