/**
 * app.js - Moteur de navigation de Fairpay
 * Gère l'affichage dynamique des composants Accueil et Nouveau
 */

const { createApp } = Vue;

const app = createApp({
    data() {
        return {
            // 'home' affiche Accueil.js au démarrage
            currentPage: 'home' 
        }
    },
    methods: {
        // Fonction pour changer de page facilement
        goTo(page) {
            this.currentPage = page;
            // On remonte en haut de page automatiquement lors du changement
            window.scrollTo(0, 0);
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

