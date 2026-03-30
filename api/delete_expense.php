<?php
include_once 'config/db_access.php';

// On récupère l'ID envoyé par le bouton
$id = $_GET['id'] ?? null;

if ($id) {
    try {
        $sql = "DELETE FROM expenses WHERE id = :id";
        $stmt = $connexion->prepare($sql);
        $stmt->execute([':id' => $id]);
        
        echo json_encode(["status" => "success"]);
    } catch(PDOException $e) {
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "ID manquant"]);
}
?>