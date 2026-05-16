<?php
// =========================================================================
// GESTIONNAIRE CORS (Cross-Origin Resource Sharing) ET HEADERS DE SÉCURITÉ
// =========================================================================
// Ce fichier agit comme un poste de douane pour l'API. Il vérifie qui a
// le droit de faire des requêtes vers le serveur et ajoute des protections
// contre diverses attaques web (XSS, Clickjacking, Sniffing).

// CORS permet d’autoriser certains sites web à accéder aux ressources d’un autre site.
// Il protège les données en bloquant les accès cross-origin non autorisés côté navigateur.

const DEVELOPMENT = True; // En mode dev, on affiche les erreurs pour aider au débogage
if (DEVELOPMENT) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
}

/**
 * Fonction principale qui ajoute les en-têtes de sécurité à la réponse
 * @param string $host L'hôte autorisé (ex: le domaine en production)
 * @param bool $dev Si vrai, on autorise les environnements de test locaux (localhost)
 * @param bool $acceptAllHost Si vrai, on désactive la protection (dangereux, à éviter en prod)
 * @param bool $showCorsHeaders Si vrai, renvoie des infos de debug CORS
 * @return void
 */
function add_headers_origin($host, $dev, $acceptAllHost, $showCorsHeaders)
{
    $headers = apache_request_headers(); // On lit ce que le navigateur nous envoie
    $response = [];

    $response[] = "add_headers_origin for host: $host";
    
    // 1. Liste blanche (Whitelist) des domaines qui ont le droit d'accéder à l'API
    $possibleOrigins = [
        $host
    ];

    // Si on a activé la porte ouverte à tout le monde (Non recommandé)
    if ($acceptAllHost && !empty($headers['Origin'])) {
        $possibleOrigins[] = $headers['Origin'];
        $response[] = "accepting any host ie $headers[Origin]";
    }

    // Si on est en mode développement, on ajoute nos environnements locaux à la liste blanche
    if ($dev) {
        $possibleOrigins[] = 'http://localhost:5173';  // Port classique pour Vue/Vite
        $possibleOrigins[] = 'http://localhost:5174';
        $possibleOrigins[] = 'http://localhost:63342'; // Port classique PhpStorm
        $possibleOrigins[] = 'http://localhost:3000';  // Port classique React/Node
        $possibleOrigins[] = 'null'; // Utilisé parfois quand on ouvre un fichier HTML local (file://)
    }

    // 2. Vérification de l'origine de la requête
    if (!empty($headers['Origin'])) {
        $origin = $headers['Origin'];
        $response[] = "looking for origin: $origin";
        $response[] = "  in list: " . join(',', $possibleOrigins);

        // Si le domaine qui demande n'est pas dans notre liste blanche, 
        // on force l'origine autorisée au premier de la liste (ce qui bloquera l'attaquant)
        if (!in_array($origin, $possibleOrigins)) {
            $origin = $possibleOrigins[0];
            $response[] = "no valid Origin";
        } else {
            $response[] = "valid Origin found in list"; // Le domaine est autorisé !
        }

        // 3. Application des règles CORS au navigateur
        header('Access-Control-Allow-Origin: ' . $origin); // Dit au navigateur: "Oui, ce domaine a le droit de lire la réponse"
        header('Access-Control-Allow-Methods: POST, PUT, GET, DELETE, OPTIONS'); // Actions autorisées
        header("Access-Control-Allow-Headers: Authorization,Accept,Content-Type"); // Types de données autorisées
        header('Access-Control-Allow-Credentials: true'); // Permet l'envoi des cookies de session
        header('Vary: Origin'); // Sécurité pour les systèmes de cache intermédiaires
        
        if ($showCorsHeaders) {
            header('Access-Control-Expose-Headers: Vary,Access-Control-Allow-Origin,Access-Control-Allow-Methods,Access-Control-Allow-Headers');
        }
    } else {
        $response[] = "no Origin in the request";
    }

    // 4. Ajout des Headers (En-têtes) de sécurité supplémentaires pour bloquer d'autres attaques
    
    // a) Empêche le navigateur de mettre en cache les requêtes sensibles (pour éviter que quelqu'un d'autre voie tes données sur un PC public)
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0');
    header('Pragma: no-cache');
    
    // b) Empêche les attaques de type MIME-sniffing (forcer l'exécution d'un fichier déguisé)
    header('X-Content-Type-Options: nosniff');
    
    // c) Empêche le Clickjacking (interdit d'afficher ce site dans une iframe sur un autre site pirate)
    header('X-Frame-Options: DENY');
    
    // d) Active le filtre anti-XSS intégré de certains anciens navigateurs
    header('X-XSS-Protection: 1; mode=block');

    if ($showCorsHeaders) {
        header('X-Debug-Response: ' . json_encode($response));
    }
}