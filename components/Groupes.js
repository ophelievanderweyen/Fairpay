const GroupesPage = {
    data() {
        return {
            groups: []
        }
    },
    template: `
        <div class="p-4">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4 class="fw-bold mb-0">Mes Groupes</h4>
                <button class="btn btn-primary rounded-pill btn-sm" @click="$parent.currentPage = 'nouveauGroupe'">
                    <i class="bi bi-plus-lg"></i> Nouveau
                </button>
            </div>

            <div v-for="g in groups" :key="g.id" class="light-card p-3 mb-2 d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center" @click="$parent.currentPage = 'home'" style="cursor:pointer; flex-grow: 1;">
                    <div class="bg-info text-white rounded-3 d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                        <i class="bi bi-people-fill"></i>
                    </div>
                    <div>
                        <span class="fw-bold text-dark d-block">{{ g.name }}</span>
                        <small class="text-muted">{{ g.description || 'Pas de description' }}</small>
                    </div>
                </div>
                
                <button class="btn btn-link text-danger p-0 ms-3" @click="deleteGroup(g.id)">
                    <i class="bi bi-trash3"></i>
                </button>
            </div>
        </div>
    `,
    mounted() {
        this.fetchGroups();
    },
    methods: {
        fetchGroups() {
            fetch('api/backend.php?action=get_groups').then(res => res.json()).then(data => { this.groups = data; });
        },
        deleteGroup(id) {
            if(confirm("Supprimer ce groupe ?")) {
                const formData = new FormData();
                formData.append('id', id);

                fetch('api/backend.php?action=delete_group', {
                    method: 'POST',
                    body: formData
                })
                .then(() => {
                    // On rafraîchit la liste après suppression
                    this.fetchGroups();
                });
            }
        }
    }
};