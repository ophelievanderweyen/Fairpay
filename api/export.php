<?php
// ==========================================
// A. PARAMÉTRAGE ET SÉCURITÉ
// ==========================================

// Affichage des erreurs à l'écran pour t'aider à débugger si nécessaire
ini_set('display_errors', 1);
error_reporting(E_ALL);

// ==========================================
// B. L'AUTOLOADER (LE CHARGEUR AUTOMATIQUE)
// ==========================================
// Ce bloc explique à PHP où trouver les fichiers de PhpSpreadsheet 
// quand on va créer le tableur Excel.
spl_autoload_register(function ($class) {
    $prefix = 'PhpOffice\\PhpSpreadsheet\\';
    
    // On regarde si le fichier demandé appartient à la librairie
    if (strpos($class, $prefix) === 0) {
        // On isole le nom de la classe sans le préfixe
        $relative_class = substr($class, strlen($prefix));
        
        // On construit le chemin réel vers le fichier dans ton projet
        $file = __DIR__ . '/PhpSpreadsheet/' . str_replace('\\', '/', $relative_class) . '.php';
        
        // Si le fichier existe bien sur ton disque, on l'inclut
        if (file_exists($file)) {
            require_once $file;
        }
    }
});

// Importation des outils principaux nécessaires à la création du fichier
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

// ==========================================
// C. CRÉATION DU DOSSIER EXCEL (TEST)
// ==========================================

// 1. Initialisation de l'objet Excel en mémoire
$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();

// 2. Écriture de quelques lignes de test dans les cellules
$sheet->setCellValue('A1', 'Application Mobile : Fairpay');
$sheet->setCellValue('A3', 'Titre de colonne A');
$sheet->setCellValue('B3', 'Titre de colonne B');

$sheet->setCellValue('A4', 'Donnée de test 1');
$sheet->setCellValue('B4', 'Validation OK');

// 3. Vidage du tampon de mémoire pour éviter tout bug de téléchargement
if (ob_get_length()) ob_end_clean();

// 4. Envoi des instructions au navigateur pour lui dire que c'est un fichier Excel (.xlsx)
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment;filename="export_fairpay.xlsx"');
header('Cache-Control: max-age=0');

// 5. Génération finale et téléchargement immédiat
$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
exit;