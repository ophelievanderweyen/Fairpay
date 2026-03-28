<?php
// api/get_expenses.php
include_once 'config/db_access.php';

try {
    // On récupère les dépenses et le nom de celui qui a payé (si tu as une table users)
    // Pour l'instant on fait simple : on prend tout dans 'expenses'
    $sql = "SELECT * FROM expenses ORDER BY expense_date DESC";
    $stmt = $connexion->prepare($sql);
    $stmt->execute();
    
    $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // On envoie le résultat au format JSON pour que Vue.js puisse le lire
    header('Content-Type: application/json');
    echo json_encode($expenses);

} catch(PDOException $e) {
    echo json_encode(["error" => $e->getMessage()]);
}
?>