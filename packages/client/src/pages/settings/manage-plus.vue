<template>
  <div class="team-management-container">
    <h1 class="header">{{ "Team Management" }}</h1>
    
    <!-- Team info section -->
    <div class="team-info-section">
      <h2>{{ "My Teams" }}</h2>
      <p class="info-text">{{ "Manage teams and their access to Campra+ features." }}</p>
      
      <!-- Teams list placeholder -->
      <div class="teams-list">
        <div class="empty-state">
          <i class="ph-users-three-bold"></i>
          <h3>{{ "No teams yet" }}</h3>
          <p>{{ "Create or join a team to access Campra+ features together." }}</p>
          <MkButton primary class="create-team-button">
            {{ "Create Team" }}
          </MkButton>
        </div>
      </div>
    </div>

    <!-- Features section -->
    <div class="features-section">
      <h2>{{ "Campra+ Features" }}</h2>
      <div class="features-grid">
        <div class="feature-card">
          <i class="ph-cloud-arrow-up-bold"></i>
          <h3>{{ "Increased Storage" }}</h3>
          <p>{{ "Up to 5GB storage for your files and media" }}</p>
        </div>
        <div class="feature-card">
          <i class="ph-sparkle-bold"></i>
          <h3>{{ "All Decorations" }}</h3>
          <p>{{ "Access to all avatar decorations and themes" }}</p>
        </div>
        <div class="feature-card">
          <i class="ph-code-bold"></i>
          <h3>{{ "Custom CSS" }}</h3>
          <p>{{ "Customize your profile with CSS" }}</p>
        </div>
        <div class="feature-card">
          <i class="ph-dog-bold"></i>
          <h3>{{ "Campra+ Badge" }}</h3>
          <p>{{ "Show off your support with a special badge" }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
  </template>
<script lang="ts" setup>
import MkButton from '@/components/MkButton.vue';
import { definePageMetadata } from '@/scripts/page-metadata';

definePageMetadata({
  title: "Team Management",
  icon: 'ph-users-three-bold ph-lg',
});
</script>
 <style lang="scss" scoped>
.team-management-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 2rem;
  color: var(--accent);
}

.team-info-section {
  background: var(--panel);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;

  h2 {
    font-size: 1.8rem;
    color: var(--accent);
    margin-bottom: 1rem;
  }

  .info-text {
    font-size: 1.1rem;
    margin-bottom: 2rem;
    opacity: 0.8;
  }
}

.empty-state {
  text-align: center;
  padding: 3rem 2rem;

  i {
    font-size: 4rem;
    color: var(--accent);
    margin-bottom: 1rem;
  }

  h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }

  p {
    font-size: 1rem;
    margin-bottom: 2rem;
    opacity: 0.7;
  }
}

.features-section {
  h2 {
    font-size: 1.8rem;
    color: var(--accent);
    margin-bottom: 2rem;
    text-align: center;
  }
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.feature-card {
  background: var(--panel);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;

  i {
    font-size: 3rem;
    color: var(--accent);
    margin-bottom: 1rem;
  }

  h3 {
    font-size: 1.3rem;
    margin-bottom: 1rem;
  }

  p {
    opacity: 0.8;
    line-height: 1.5;
  }
}

.create-team-button {
  padding: 0.8rem 2rem;
  font-size: 1.1rem;
}
</style>