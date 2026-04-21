<?php
include ("securite.php") //
include_once 'config/db_access.php'; // Vérifie que le chemin est bon !

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

        // Après l'insertion, on revient à l'index
        header("Location: ../index.html");
        exit();
    } catch(PDOException $e) {
        die("Erreur base de données : " . $e->getMessage());
    }
}