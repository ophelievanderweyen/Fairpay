<?php
include ("securite.php");
// api/delete_group.php
include_once 'config/db_access.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id = intval($_POST['id']);

    try {
        // On supprime le groupe avec cet ID
        $sql = "DELETE FROM `groups` WHERE id = :id";
        $stmt = $connexion->prepare($sql);
        $stmt->execute([':id' => $id]);

        echo json_encode(["success" => true]);
    } catch(PDOException $e) {
        echo json_encode(["error" => $e->getMessage()]);
    }
}
?>