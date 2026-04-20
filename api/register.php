    <?php
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $donnees = json_decode(file_get_contents("php://input"), true);
    }

    if (empty($donnees['username']) || empty($donnees['password'])) {
        http_response_code(400);
        echo json_encode(['message' => 'Oups ! Merci de remplir tous les champs.']);
        exit;
    }

    ... // traitement des données : SQL  // configuartion, connexion, sql (lié les paramètre, puis exécuter) => puis répondre OK
    echo json_encode($response);



        