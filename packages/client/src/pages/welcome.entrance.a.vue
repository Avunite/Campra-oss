<template>
	<div class="landing-page">
	  <!-- Animated Background Layers -->
	  <div class="background-container">
		<div class="animated-gradient"></div>
		<div class="particles"></div>
		<div class="glow-orbs">
		  <span class="orb orb1"></span>
		  <span class="orb orb2"></span>
		  <span class="orb orb3"></span>
		</div>
	  </div>
  
	  <!-- Main Content -->
	  <div class="content-container">
		<header class="main-header epic-fade-in">
		  <div class="logo-section">
			<img v-if="meta?.logoImageUrl" 
				 class="logo-image" 
				 :src="meta.logoImageUrl" 
				 :alt="meta.name + ' logo'">
			<div v-else class="logo-placeholder">
			  <i class="ph-chat-circle-bold ph-lg"></i>
			</div>
		  </div>
		  <h1 class="main-title glow-text">{{ meta?.name || 'Campra' }}</h1>
		  <p class="main-subtitle typewriter">Connections across campuses</p>
		</header>
  
		<!-- Actions -->
		<div class="action-section parallax-buttons">
		  <div class="auth-buttons">
			<MkButton class="signup-button epic-btn" rounded gradate large @click="signup()">
			  {{ i18n.ts.signup }}
			</MkButton>
			<MkButton class="signin-button epic-btn" rounded outlined large @click="signin()">
			  {{ i18n.ts.login }}
			</MkButton>
		  </div>
		  <div class="learn-more-section">
			<a href="https://avunite.com/products/campra"
			   target="_blank"
			   rel="noopener noreferrer"
			   class="learn-more-button glass-btn">
			  <span>Learn More</span>
			  <i class="ph-arrow-up-right-bold ph-lg"></i>
			</a>
		  </div>
		</div>
  
		<!-- Pre-Release Notice -->
		<div v-if="meta?.preReleaseMode" class="pre-release-notice glass-card fade-up">
		  <i class="ph-info-bold ph-lg"></i>
		  <div>
			<h4>Pre-Release Access</h4>
			<p>This instance is currently in pre-release mode with limited access.</p>
		  </div>
		</div>
	  </div>
	</div>
  </template>
  
  <script lang="ts" setup>
  import { ref, onMounted } from "vue";
  import MkButton from "@/components/MkButton.vue";
  import XSigninDialog from "@/components/MkSigninDialog.vue";
  import XSignupDialog from "@/components/MkSignupDialog.vue";
  import { i18n } from "@/i18n";
  import * as os from "@/os";
  
  const meta = ref<any>(null);
  
  onMounted(async () => {
	try {
	  meta.value = await os.api("meta", {});
	} catch (error) {
	  console.error("Failed to fetch meta information:", error);
	}
  });
  
  function signup() {
	os.popup(XSignupDialog, { autoSet: true }, {}, "closed");
  }
  
  function signin() {
	os.popup(XSigninDialog, { autoSet: true }, {}, "closed");
  }
  </script>
  
  <style lang="scss" scoped>
  @keyframes backgroundMove {
	0% { background-position: 0% 50%; }
	50% { background-position: 100% 50%; }
	100% { background-position: 0% 50%; }
  }
  
  @keyframes glowPulse {
	0%, 100% { filter: drop-shadow(0 0 10px var(--accent)); }
	50% { filter: drop-shadow(0 0 20px var(--accentLighten)); }
  }
  
  @keyframes typewriter {
	from { width: 0; }
	to { width: 100%; }
  }
  
  @keyframes float {
	0%, 100% { transform: translateY(0px); }
	50% { transform: translateY(-20px); }
  }
  
  .landing-page {
	height: 100vh;
	position: relative;
	overflow: hidden;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--bgDark);
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
  
  .background-container {
	position: absolute;
	inset: 0;
	z-index: 0;
  
	.animated-gradient {
	  background: linear-gradient(270deg, var(--bg), var(--accent), var(--bgDark));
	  background-size: 600% 600%;
	  animation: backgroundMove 18s ease infinite;
	  position: absolute;
	  width: 100%;
	  height: 100%;
	}
  
	.particles {
	  background: radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px);
	  background-size: 3px 3px;
	  width: 100%;
	  height: 100%;
	  opacity: 0.15;
	}
  
	.glow-orbs {
	  .orb {
		position: absolute;
		border-radius: 50%;
		background: radial-gradient(circle, var(--accentLighten), transparent);
		opacity: 0.3;
		animation: float 8s infinite ease-in-out;
	  }
	  .orb1 { width: 150px; height: 150px; top: 20%; left: 10%; }
	  .orb2 { width: 200px; height: 200px; bottom: 15%; right: 20%; }
	  .orb3 { width: 120px; height: 120px; top: 5%; right: 35%; }
	}
  }
  
  .content-container {
	position: relative;
	z-index: 10;
	text-align: center;
	padding: 2rem;
  }
  
  .logo-image {
	max-width: 120px;
	height: auto;
	animation: glowPulse 3s infinite;
  }
  
  .logo-placeholder {
	width: 80px;
	height: 80px;
	background: rgba(var(--accent), 0.2);
	border-radius: 20px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--accent);
	font-size: 2rem;
	animation: glowPulse 3s infinite;
  }
  
  .main-title {
	font-size: 3.5rem;
	font-weight: 700;
	color: var(--fg);
	margin: 0.5rem 0;
  }
  
  .glow-text {
	animation: glowPulse 3s infinite;
  }
  
  .typewriter {
	display: inline-block;
	overflow: hidden;
	white-space: nowrap;
	border-right: 3px solid var(--accent);
	animation: typewriter 3s steps(30) 1s forwards;
	font-size: 1.25rem;
	color: var(--fgTransparentWeak);
  }
  
  .auth-buttons {
	display: flex;
	justify-content: center;
	gap: 1rem;
	margin: 2rem 0;
	flex-wrap: wrap;
  }
  
  .epic-btn {
	transition: transform 0.3s, box-shadow 0.3s;
  }
  .epic-btn:hover {
	transform: translateY(-3px) scale(1.05);
	box-shadow: 0 0 25px var(--accentLighten);
  }
  
  .glass-btn {
	backdrop-filter: blur(6px);
	border: 1px solid rgba(255,255,255,0.2);
	padding: 0.5rem 1rem;
	border-radius: 25px;
  }
  
  .glass-card {
	backdrop-filter: blur(10px);
	background: rgba(255,255,255,0.05);
	border-radius: 12px;
	padding: 1rem;
	margin-top: 2rem;
	display: flex;
	gap: 1rem;
  }
  
  .learn-more-button {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	text-decoration: none;
	color: var(--accent);
	transition: 0.3s;
  }
  .learn-more-button:hover {
	transform: translateY(-2px);
  }
  </style>
  