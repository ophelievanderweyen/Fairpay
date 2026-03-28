<?php
// api/add_group.php
include_once 'config/db_access.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name = htmlspecialchars($_POST['name']);
    $description = htmlspecialchars($_POST['description']);
    $created_by = 1; // On simule l'utilisateur 1 pour le moment

    try {
        $sql = "INSERT INTO `groups` (name, description, created_by) VALUES (:n, :d, :c)";
        $stmt = $connexion->prepare($sql);
        $stmt->execute([':n' => $name, ':d' => $description, ':c' => $created_by]);

        // Redirection vers l'accueil après création
        header("Location: ../index.html");
        exit();
    } catch(PDOException $e) {
        die("Erreur : " . $e->getMessage());
    }
}
?>