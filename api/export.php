<?php

/* =========================================================================
   EXPORT.PHP — EXPORT EXCEL .XLSX DES DÉPENSES D’UN GROUPE
   =========================================================================

   Objectif de ce fichier :
   - récupérer l'id du groupe depuis l'URL
   - récupérer les dépenses du groupe depuis la base de données
   - générer un vrai fichier Excel au format .xlsx
   - appliquer une mise en page aux couleurs de Fairpay
   - télécharger automatiquement le fichier

   Important :
   Un fichier .xlsx n'est pas un simple fichier texte.
   C'est une archive ZIP contenant plusieurs fichiers XML.

   Ici, on crée donc le fichier Excel manuellement avec :
   - du XML pour les données
   - du XML pour les styles
   - ZipArchive pour fabriquer le fichier .xlsx final
   ========================================================================= */


/* =========================================================================
   AUCUN FLUX — CONNEXION À LA BASE DE DONNÉES
   =========================================================================

   Ce fichier contient la connexion PDO à la base de données.

   Dans ton projet, la variable utilisée pour les requêtes SQL est :
   $connexion

   Sans cette ligne, on ne peut pas récupérer les groupes ni les dépenses.
   ========================================================================= */

include_once 'config/db_access.php';


/* =========================================================================
   AUCUN FLUX — VÉRIFICATION DE ZIPARCHIVE
   =========================================================================

   ZipArchive est une classe PHP qui permet de créer des fichiers ZIP.

   Comme un fichier .xlsx est en réalité une archive ZIP contenant du XML,
   ZipArchive est obligatoire pour générer un vrai fichier Excel moderne.

   Si ZipArchive n'est pas activé sur le serveur, on arrête le script avec die().
   ========================================================================= */

if (!class_exists('ZipArchive')) {
    die('Erreur : ZipArchive n’est pas activé sur le serveur.');
}


/* =========================================================================
   AUCUN FLUX — RÉCUPÉRATION DE L'ID DU GROUPE
   =========================================================================

   Le bouton d'export envoie une URL comme ceci :

   export.php?group_id=8

   $_GET['group_id'] permet de récupérer la valeur 8.

   Le (int) force la valeur à devenir un nombre entier.
   C'est une sécurité pour éviter d'utiliser une valeur inattendue.
   ========================================================================= */

$groupId = (int) ($_GET['group_id'] ?? 0);


/* =========================================================================
   AUCUN FLUX — VÉRIFICATION DE L'ID DU GROUPE
   =========================================================================

   Si group_id est absent ou invalide, sa valeur sera 0.

   Dans ce cas, on arrête le script parce qu'on ne sait pas quel groupe exporter.
   ========================================================================= */

if ($groupId <= 0) {
    die('Groupe invalide.');
}


/* =========================================================================
   AUCUN FLUX — RÉCUPÉRATION DU NOM DU GROUPE
   =========================================================================

   On récupère le nom du groupe pour :
   - l'afficher dans le fichier Excel
   - l'utiliser dans le nom du fichier téléchargé

   Exemple :
   groupe = "vacances italie"
   fichier = "depenses_vacances_italie.xlsx"
   ========================================================================= */

$stmtGroup = $connexion->prepare("
    SELECT name
    FROM `groups`
    WHERE id = ?
    LIMIT 1
");

/*
   execute([$groupId]) remplace le ? dans la requête SQL par l'id du groupe.
   Comme on utilise une requête préparée, c'est plus sécurisé.
*/

$stmtGroup->execute([$groupId]);

/*
   fetch(PDO::FETCH_ASSOC) récupère une seule ligne sous forme de tableau.

   Exemple de résultat :
   [
       "name" => "vacances italie"
   ]
*/

$group = $stmtGroup->fetch(PDO::FETCH_ASSOC);


/* =========================================================================
   AUCUN FLUX — VÉRIFICATION DE L'EXISTENCE DU GROUPE
   =========================================================================

   Si aucun groupe n'est trouvé en base de données, on arrête le script.
   ========================================================================= */

if (!$group) {
    die('Groupe introuvable.');
}


/* =========================================================================
   AUCUN FLUX — RÉCUPÉRATION DES DÉPENSES DU GROUPE
   =========================================================================

   Cette requête récupère toutes les dépenses du groupe sélectionné.

   On récupère :
   - reason : le motif de la dépense
   - payeur : le nom de la personne qui a payé
   - amount : le montant
   - expense_date : la date de la dépense

   Le JOIN permet de relier la table expenses à la table users.
   Grâce à ça, on affiche le nom du payeur au lieu de son id.
   ========================================================================= */

$stmt = $connexion->prepare("
    SELECT
        expenses.reason,
        users.name AS payeur,
        expenses.amount,
        expenses.expense_date
    FROM expenses
    JOIN users ON expenses.payer_id = users.id
    WHERE expenses.group_id = ?
    ORDER BY expenses.expense_date DESC
");

/*
   On exécute la requête avec l'id du groupe.
*/

$stmt->execute([$groupId]);

/*
   fetchAll(PDO::FETCH_ASSOC) récupère toutes les dépenses dans un tableau.
*/

$depenses = $stmt->fetchAll(PDO::FETCH_ASSOC);


/* =========================================================================
   AUCUN FLUX — FONCTION DE SÉCURISATION XML
   =========================================================================

   Un fichier .xlsx contient du XML.

   En XML, certains caractères peuvent poser problème :
   - &
   - <
   - >
   - "
   - '

   htmlspecialchars transforme ces caractères en version sécurisée.

   Exemple :
   "Musée & train"
   devient compatible XML.
   ========================================================================= */

function xmlSafe($value) {
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_XML1, 'UTF-8');
}


/* =========================================================================
   AUCUN FLUX — FONCTION POUR CRÉER UNE CELLULE TEXTE
   =========================================================================

   Cette fonction génère une cellule Excel contenant du texte.

   Paramètres :
   - $cell  : position de la cellule, exemple A1, B3, C7
   - $value : texte à afficher
   - $style : numéro du style Excel à appliquer

   Exemple :
   cellText('A1', 'Bonjour', 1)

   Va générer une cellule A1 contenant "Bonjour" avec le style n°1.
   ========================================================================= */

function cellText($cell, $value, $style = 0) {
    return '
        <c r="' . $cell . '" t="inlineStr" s="' . $style . '">
            <is>
                <t>' . xmlSafe($value) . '</t>
            </is>
        </c>';
}


/* =========================================================================
   AUCUN FLUX — FONCTION POUR CRÉER UNE CELLULE NUMÉRIQUE
   =========================================================================

   Cette fonction génère une cellule Excel contenant un nombre.

   Elle est utilisée pour les montants afin qu'Excel reconnaisse bien
   la valeur comme un chiffre, et pas comme du texte.

   Cela permet ensuite d'appliquer le format monétaire en euro.
   ========================================================================= */

function cellNumber($cell, $value, $style = 0) {
    return '
        <c r="' . $cell . '" s="' . $style . '">
            <v>' . (float) $value . '</v>
        </c>';
}


/* =========================================================================
   AUCUN FLUX — VARIABLES UTILES POUR L'EXPORT
   =========================================================================

   $total :
   servira à calculer le total des dépenses du groupe.

   $dateExport :
   affiche la date et l'heure auxquelles le fichier a été généré.
   ========================================================================= */

$total = 0;
$dateExport = date('d/m/Y H:i');


/* =========================================================================
   AUCUN FLUX — CRÉATION DU NOM DU FICHIER
   =========================================================================

   preg_replace nettoie le nom du groupe.

   Pourquoi ?
   Un nom de fichier ne doit pas contenir certains caractères spéciaux.

   Exemple :
   "vacances italie"
   devient :
   "vacances_italie"
   ========================================================================= */

$cleanGroupName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $group['name']);

$filename = 'depenses_' . $cleanGroupName . '.xlsx';


/* =========================================================================
   AUCUN FLUX — CONSTRUCTION DES LIGNES EXCEL
   =========================================================================

   $rows contiendra toutes les lignes de la feuille Excel.

   Chaque ligne Excel est écrite en XML avec la balise <row>.
   Chaque cellule est écrite avec la balise <c>.
   ========================================================================= */

$rows = '';


/* =========================================================================
   AUCUN FLUX — LIGNE 1 : TITRE PRINCIPAL
   =========================================================================

   On place le titre en A1.

   Plus bas, on fusionnera les cellules A1 à D1 pour que le titre soit large.
   Le style 1 correspond au grand titre rose avec texte blanc.
   ========================================================================= */

$rows .= '
    <row r="1">
        ' . cellText('A1', 'FAIRPAY - EXPORT DES DÉPENSES', 1) . '
    </row>';


/* =========================================================================
   AUCUN FLUX — LIGNES 3 ET 4 : INFORMATIONS DU GROUPE
   =========================================================================

   Ligne 3 :
   - A3 contient le label "Nom du groupe"
   - B3 contient le vrai nom du groupe

   Ligne 4 :
   - A4 contient le label "Date export"
   - B4 contient la date de génération du fichier

   Le style 2 correspond aux petites cellules roses claires.
   ========================================================================= */

$rows .= '
    <row r="3">
        ' . cellText('A3', 'Nom du groupe', 2) . '
        ' . cellText('B3', $group['name'], 0) . '
    </row>';

$rows .= '
    <row r="4">
        ' . cellText('A4', 'Date export', 2) . '
        ' . cellText('B4', $dateExport, 0) . '
    </row>';


/* =========================================================================
   AUCUN FLUX — LIGNE 6 : EN-TÊTES DU TABLEAU
   =========================================================================

   Les colonnes du tableau sont :
   - Motif
   - Payé par
   - Montant
   - Date

   Le style 3 met les titres en gras.
   ========================================================================= */

$rows .= '
    <row r="6">
        ' . cellText('A6', 'Motif', 3) . '
        ' . cellText('B6', 'Payé par', 3) . '
        ' . cellText('C6', 'Montant', 3) . '
        ' . cellText('D6', 'Date', 3) . '
    </row>';


/* =========================================================================
   AUCUN FLUX — AJOUT DES DÉPENSES DANS LE TABLEAU
   =========================================================================

   Les dépenses commencent à la ligne 7.

   Pour chaque dépense :
   - on ajoute son montant au total
   - on formate sa date au format français
   - on crée une ligne Excel
   - on alterne légèrement la couleur des lignes pour améliorer la lisibilité
   ========================================================================= */

$rowNumber = 7;

foreach ($depenses as $depense) {

    /*
       On ajoute le montant de la dépense au total général.
       Le (float) garantit qu'on manipule bien un nombre.
    */

    $total += (float) $depense['amount'];

    /*
       La date vient de la base au format SQL :
       2026-05-17

       On la transforme en format français :
       17/05/2026
    */

    $dateFormatee = date('d/m/Y', strtotime($depense['expense_date']));

    /*
       On alterne les styles :
       - une ligne normale
       - une ligne rose très clair

       Cela rend le tableau plus lisible.
    */

    $styleRow = ($rowNumber % 2 === 0) ? 4 : 0;

    /*
       On ajoute une ligne Excel complète.

       Colonne A : motif
       Colonne B : payeur
       Colonne C : montant
       Colonne D : date

       Le montant utilise cellNumber() pour être reconnu comme un nombre.
       Le style 5 applique le format euro et la couleur rose.
    */

    $rows .= '
        <row r="' . $rowNumber . '">
            ' . cellText('A' . $rowNumber, $depense['reason'], $styleRow) . '
            ' . cellText('B' . $rowNumber, $depense['payeur'], $styleRow) . '
            ' . cellNumber('C' . $rowNumber, $depense['amount'], 5) . '
            ' . cellText('D' . $rowNumber, $dateFormatee, $styleRow) . '
        </row>';

    /*
       On passe à la ligne suivante.
    */

    $rowNumber++;
}


/* =========================================================================
   AUCUN FLUX — LIGNE DU TOTAL
   =========================================================================

   Après toutes les dépenses, on ajoute une ligne vide implicitement
   en utilisant $rowNumber + 1.

   La ligne du total affiche :
   - "TOTAL DU GROUPE"
   - le total des montants
   ========================================================================= */

$totalRow = $rowNumber + 1;

$rows .= '
    <row r="' . $totalRow . '">
        ' . cellText('A' . $totalRow, 'TOTAL DU GROUPE', 6) . '
        ' . cellText('B' . $totalRow, '', 6) . '
        ' . cellNumber('C' . $totalRow, $total, 7) . '
    </row>';


/* =========================================================================
   AUCUN FLUX — CRÉATION DE LA FEUILLE EXCEL sheet1.xml
   =========================================================================

   Cette variable représente la feuille Excel principale.

   Elle contient :
   - les largeurs de colonnes
   - les données
   - la fusion du titre A1:D1

   Les colonnes sont volontairement élargies pour un rendu plus lisible.
   ========================================================================= */

$sheetXml = '<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">

    <cols>
        <col min="1" max="1" width="24" customWidth="1"/>
        <col min="2" max="2" width="22" customWidth="1"/>
        <col min="3" max="3" width="16" customWidth="1"/>
        <col min="4" max="4" width="14" customWidth="1"/>
    </cols>

    <sheetData>
        ' . $rows . '
    </sheetData>

    <mergeCells count="1">
        <mergeCell ref="A1:C1"/>
    </mergeCells>

</worksheet>';


/* =========================================================================
   AUCUN FLUX — CRÉATION DES STYLES styles.xml
   =========================================================================

   Cette variable contient tous les styles Excel.

   Les styles sont appelés par numéro dans les cellules :
   - s="0" : style normal
   - s="1" : titre principal rose
   - s="2" : label rose clair
   - s="3" : en-tête du tableau
   - s="4" : ligne alternée rose très clair
   - s="5" : montant en euro rose
   - s="6" : cellule du total
   - s="7" : montant total en euro

   Les couleurs utilisées suivent l'identité visuelle de Fairpay.
   ========================================================================= */

$stylesXml = '<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">

    <numFmts count="1">
        <numFmt numFmtId="164" formatCode="#,##0.00 €"/>
    </numFmts>

    <fonts count="5">
        <font><sz val="11"/><name val="Arial"/></font>
        <font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
        <font><b/><color rgb="FF666666"/><name val="Arial"/></font>
        <font><b/><color rgb="FF666666"/><name val="Arial"/></font>
        <font><b/><color rgb="FFFF4FA3"/><name val="Arial"/></font>
    </fonts>

    <fills count="5">
        <fill><patternFill patternType="none"/></fill>
        <fill><patternFill patternType="gray125"/></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFFF5CA8"/><bgColor indexed="64"/></patternFill></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2F7"/><bgColor indexed="64"/></patternFill></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFFFF8FB"/><bgColor indexed="64"/></patternFill></fill>
    </fills>

    <borders count="2">
        <border/>
        <border>
            <left style="thin"><color rgb="FFF1F1F1"/></left>
            <right style="thin"><color rgb="FFF1F1F1"/></right>
            <top style="thin"><color rgb="FFF1F1F1"/></top>
            <bottom style="thin"><color rgb="FFF1F1F1"/></bottom>
        </border>
    </borders>

    <cellStyleXfs count="1">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    </cellStyleXfs>

    <cellXfs count="8">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/>
        <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
        <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
        <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
        <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
        <xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyNumberFormat="1" applyBorder="1"/>
        <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
        <xf numFmtId="164" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyBorder="1"/>
    </cellXfs>

</styleSheet>';


/* =========================================================================
   AUCUN FLUX — CRÉATION D'UN FICHIER TEMPORAIRE
   =========================================================================

   On crée un fichier temporaire sur le serveur.

   Ce fichier temporaire servira à construire le .xlsx avant de l'envoyer
   au navigateur.
   ========================================================================= */

$tempFile = tempnam(sys_get_temp_dir(), 'fairpay_export_');


/* =========================================================================
   AUCUN FLUX — CRÉATION DE L'ARCHIVE XLSX
   =========================================================================

   On ouvre une archive ZIP.

   Cette archive deviendra le fichier Excel final.
   ========================================================================= */

$zip = new ZipArchive();
$zip->open($tempFile, ZipArchive::OVERWRITE);


/* =========================================================================
   AUCUN FLUX — FICHIER [Content_Types].xml
   =========================================================================

   Ce fichier explique à Excel quels types de fichiers se trouvent
   dans l'archive .xlsx.

   Sans ce fichier, Excel ne saurait pas interpréter correctement le document.
   ========================================================================= */

$zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>');


/* =========================================================================
   AUCUN FLUX — FICHIER _rels/.rels
   =========================================================================

   Ce fichier indique où se trouve le document principal Excel.

   Ici, il pointe vers :
   xl/workbook.xml
   ========================================================================= */

$zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>');


/* =========================================================================
   AUCUN FLUX — FICHIER xl/workbook.xml
   =========================================================================

   Ce fichier représente le classeur Excel.

   Il déclare qu'il existe une feuille nommée :
   "Dépenses"
   ========================================================================= */

$zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheets>
        <sheet name="Dépenses" sheetId="1" r:id="rId1"/>
    </sheets>
</workbook>');


/* =========================================================================
   AUCUN FLUX — FICHIER xl/_rels/workbook.xml.rels
   =========================================================================

   Ce fichier relie le classeur :
   - à la feuille sheet1.xml
   - au fichier de styles styles.xml
   ========================================================================= */

$zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>');


/* =========================================================================
   AUCUN FLUX — AJOUT DE LA FEUILLE ET DES STYLES
   =========================================================================

   On ajoute maintenant :
   - la feuille Excel contenant les données
   - le fichier contenant les couleurs et styles
   ========================================================================= */

$zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);
$zip->addFromString('xl/styles.xml', $stylesXml);


/* =========================================================================
   AUCUN FLUX — FERMETURE DE L'ARCHIVE
   =========================================================================

   Une fois tous les fichiers ajoutés, on ferme le ZIP.

   À ce moment-là, le fichier temporaire est devenu un vrai .xlsx.
   ========================================================================= */

$zip->close();


/* =========================================================================
   AUCUN FLUX — HEADERS DE TÉLÉCHARGEMENT
   =========================================================================

   Ces headers indiquent au navigateur :

   Content-Type :
   - le fichier envoyé est un vrai fichier Excel .xlsx

   Content-Disposition :
   - le fichier doit être téléchargé
   - avec le nom contenu dans $filename

   Content-Length :
   - indique la taille du fichier

   Cache-Control :
   - évite de télécharger une ancienne version depuis le cache
   ========================================================================= */

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($tempFile));
header('Cache-Control: max-age=0');


/* =========================================================================
   AUCUN FLUX — ENVOI DU FICHIER AU NAVIGATEUR
   =========================================================================

   readfile() lit le fichier temporaire et l'envoie directement au navigateur.

   C'est cette ligne qui déclenche réellement le téléchargement.
   ========================================================================= */

readfile($tempFile);


/* =========================================================================
   AUCUN FLUX — SUPPRESSION DU FICHIER TEMPORAIRE
   =========================================================================

   Une fois le fichier envoyé, on supprime la copie temporaire du serveur.

   Cela évite de remplir inutilement l'espace disque.
   ========================================================================= */

unlink($tempFile);


/* =========================================================================
   AUCUN FLUX — FIN DU SCRIPT
   ========================================================================= */

exit;
