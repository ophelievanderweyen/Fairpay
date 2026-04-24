/**
 * app.js - Moteur de navigation de Fairpay
 * Gère l'affichage dynamique des composants Accueil et Nouveau
 */

/* =========================================================================
   ÉTAPE 1 : INITIALISATION DE L'APPLICATION VUE
   ========================================================================= 
   On importe la fonction createApp depuis Vue.js. 
   Cette fonction permet de créer notre application principale. 
*/
const { createApp } = Vue;

/* =========================================================================
   ÉTAPE 2 : DÉFINITION DE L'APPLICATION
   ========================================================================= 
   On configure ici toutes les données (data) et les actions (methods) 
   qui seront accessibles partout dans l'application.
*/
const app = createApp({ 
    // Rappel important : dans ce fichier JS, on utilise "this." pour accéder 
    // aux variables définies dans data(). Dans le fichier HTML, on ne met PAS de "this".
    data() {
        return {
            /* 
               Les variables d'état (state) de notre application. 
               Elles déterminent ce qui s'affiche à l'écran. 
            */
            currentPage: 'home',      // Définit quelle page afficher (ex: 'home', 'profil')
            currentUser: null,        // Stocke les infos de l'utilisateur connecté (null si non connecté)
            
            /* Variables pour la page de connexion / inscription */
            isLogin: true,            // Vrai = mode connexion, Faux = mode inscription
            error: null,              // Permet d'afficher un message d'erreur si la connexion échoue
            showPassword: false,      // Permet de révéler ou masquer le mot de passe dans le formulaire
            
            /* Objet stockant les données du formulaire de connexion */
            login_form: {
                email: '',
                password: ''
            },
            
            /* Objet stockant les données du formulaire d'inscription */
            register_form: {
                username: '',
                email: '',
                password: ''
            }
        }
    },

    /* =========================================================================
       ÉTAPE 3 : LES ACTIONS / MÉTHODES
       ========================================================================= 
       Ici, on définit toutes les fonctions qui réagissent aux actions 
       de l'utilisateur (clics, soumission de formulaires, etc.).
    */
    methods: {
        // Fonction pour changer de page (navigation interne)
        goTo(page) {
            this.currentPage = page;
            window.scrollTo(0, 0); // Remonte en haut de la page après le changement
        },

        // Fonction pour basculer entre le formulaire de connexion et celui d'inscription
        toggleMode() {
            this.isLogin = !this.isLogin;
            this.error = null; // On efface les erreurs précédentes
        },

        /* --- FONCTION DE CONNEXION --- */
        async login() {
            this.error = null;
            try {
                // On envoie une requête HTTP (POST) au serveur (backend.php)
                const res = await fetch('api/backend.php?action=login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.login_form) // On envoie l'email et le mot de passe
                });
                
                const data = await res.json(); // On récupère la réponse du serveur
                
                // Si la requête a réussi et que le serveur confirme la connexion
                if (res.ok && data.connexion) {
                    this.currentUser = data.user; // On sauvegarde l'utilisateur connecté
                } else {
                    // Sinon, on affiche le message d'erreur renvoyé par le serveur
                    this.error = data.message || 'Erreur de connexion';
                }
            } catch (err) {
                this.error = 'Erreur serveur interne';
            }
        },

        /* --- FONCTION D'INSCRIPTION --- */
        async register() {
            this.error = null;
            try {
                // Même principe que pour la connexion, mais vers l'action 'register'
                const res = await fetch('api/backend.php?action=register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.register_form)
                });
                
                const data = await res.json();
                
                if (res.ok && data.success) {
                    // Si l'inscription réussit, on repasse en mode connexion
                    this.isLogin = true;
                    this.error = null;
                    alert('Inscription réussie ! Vous pouvez vous connecter.');
                } else {
                    this.error = data.message || 'Erreur lors de l\'inscription';
                }
            } catch (err) {
                this.error = 'Erreur serveur interne';
            }
        }
    }
});

/* =========================================================================
   ÉTAPE 4 : ENREGISTREMENT DES COMPOSANTS (PAGES)
   ========================================================================= 
   On déclare à notre application Vue tous les "morceaux" de page (composants)
   qu'elle va pouvoir utiliser. Ces composants sont définis dans le dossier /components/
*/
app.component('accueil-page', AccueilPage);
app.component('nouveau-page', NouveauPage);
app.component('nouveau-groupe-page', NouveauGroupePage);
app.component('groupes-page', GroupesPage);
app.component('edit-expense-page', EditExpensePage);
app.component('select-group-page', SelectGroupPage);

/* =========================================================================
   ÉTAPE 5 : LANCEMENT DE L'APPLICATION (MONTAGE)
   ========================================================================= 
   Enfin, on dit à Vue de "prendre le contrôle" de la balise HTML 
   qui possède l'id "app" (<div id="app"> dans index.html).
*/
app.mount('#app');
