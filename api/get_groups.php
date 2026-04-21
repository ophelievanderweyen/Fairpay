<?php
include ("securite.php");
// api/get_groups.php
include_once 'config/db_access.php';

try {
    $sql = "SELECT * FROM `groups` ORDER BY created_at DESC";
    $stmt = $connexion->prepare($sql);
    $stmt->execute();
    $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    header('Content-Type: application/json');
    echo json_encode($groups);
} catch(PDOException $e) {
    echo json_encode(["error" => $e->getMessage()]);
}




?>