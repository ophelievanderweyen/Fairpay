/**
 * app.js - Moteur de navigation de Fairpay
 * Gère l'affichage dynamique des composants Accueil et Nouveau
 */

const { createApp } = Vue;

const app = createApp({
    data() {
        return {
            // 'home' affiche Accueil.js au démarrage
            currentPage: 'home',
            
            // Variables pour l'authentification
            isLogin: true,
            showPassword: false,
            error: "",
            currentUser: null,
            login_form: { email: "", password: "" },
            register_form: { username: "", email: "", password: "" }
        }
    },
    methods: {
        // Fonction pour changer de page facilement
        goTo(page) {
            this.currentPage = page;
            // On remonte en haut de page automatiquement lors du changement
            window.scrollTo(0, 0);
        },

        // Bascule entre Connexion et Inscription
        toggleMode() {
            this.isLogin = !this.isLogin;
            this.error = "";
            this.showPassword = false;
        },

        // JS pour le login 
        login(event) {
            this.error = "";
            fetch('api/backend.php', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email:login_form.email, password: login_form.password })
            })
            .then(r => r.json())
            .then(data => {
                if (data.connexion) {
                    this.currentUser = data.user;
                    this.goTo('home');
                } else {
                    this.error = data.message || "Erreur de connexion";
                }
            })
            .catch(e => {
                this.error = "Erreur de réseau ou serveur";
            });
        },

        register(event) {
            this.error = "";
            fetch('api/register.php', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: register_form.username,  
                    email: register_form.email, 
                    password: register_form.password 
                })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    // On bascule sur le formulaire de connexion et on affiche un message
                    this.isLogin = true;
                    this.error = "Inscription réussie ! Vous pouvez vous connecter.";
                    this.register_form = { username: "", email: "", password: "" };
                } else {
                    this.error = data.message || "Erreur lors de l'inscription";
                }
            })
            .catch(e => {
                this.error = "Erreur de réseau ou serveur";
            });
        }
    }
});

// Enregistrement des composants (fichiers dans le dossier /components)
// Assure-toi que les noms de fichiers sont bien Accueil.js et Nouveau.js
app.component('accueil-page', AccueilPage);
app.component('nouveau-page', NouveauPage);
app.component('nouveau-groupe-page', NouveauGroupePage);
app.component('groupes-page', GroupesPage);

// Montage de l'application sur la div #app de ton index.html
app.mount('#app');

