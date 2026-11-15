import * as THREE from 'three';

// Creates pooled shot, grenade, smoke, and explosion effects in the scene.
export function makeEffects(scene) {
  const lines = [];
  const particles = [];
  const grenadeMeshes = [];
  const smokeMeshes = [];
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffd18a,
    transparent: true, opacity: 0.8 });
  for (let i = 0; i < 28; i++) {
    const line = new THREE.Line(lineGeometry.clone(), lineMaterial.clone());
    line.visible = false;
    scene.add(line);
    lines.push(line);
  }
  const particleGeometry = new THREE.SphereGeometry(0.07, 5, 4);
  for (let i = 0; i < 64; i++) {
    const particle = new THREE.Mesh(particleGeometry,
      new THREE.MeshBasicMaterial({ color: 0xffbd70, transparent: true }));
    particle.visible = false;
    scene.add(particle);
    particles.push(particle);
  }
  const grenadeGeometry = new THREE.CapsuleGeometry(0.08, 0.12, 2, 6);
  for (let i = 0; i < 12; i++) {
    const mesh = new THREE.Mesh(grenadeGeometry,
      new THREE.MeshStandardMaterial({ color: 0x38494d, roughness: 0.5 }));
    mesh.visible = false;
    scene.add(mesh);
    grenadeMeshes.push(mesh);
  }
  for (let i = 0; i < 12; i++) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x82949a, transparent: true, opacity: 0 }));
    mesh.visible = false;
    scene.add(mesh);
    smokeMeshes.push(mesh);
  }
  let lineIndex = 0;
  let particleIndex = 0;

  // Adds a short-lived tracer between two world positions.
  function trace(start, end) {
    const line = lines[lineIndex++ % lines.length];
    line.geometry.attributes.position.setXYZ(0, start.x, start.y, start.z);
    line.geometry.attributes.position.setXYZ(1, end.x, end.y, end.z);
    line.geometry.attributes.position.needsUpdate = true;
    line.material.opacity = 0.9;
    line.visible = true;
    line.userData.life = 0.07;
  }

  // Places a particle in the reusable burst pool.
  function puff(x, y, z, color = 0xffbd70) {
    const particle = particles[particleIndex++ % particles.length];
    particle.position.set(x, y, z);
    particle.material.color.setHex(color);
    particle.scale.setScalar(1);
    particle.material.opacity = 1;
    particle.visible = true;
    particle.userData.life = 0.35;
  }

  return {
    trace,
    puff,
    // Shows a live grenade at its simulated position.
    grenade(grenade) {
      let mesh = grenade.mesh;
      if (!mesh) {
        mesh = grenadeMeshes.find(item => !item.userData.inUse);
        if (!mesh) return;
        mesh.userData.inUse = true;
        grenade.mesh = mesh;
      }
      mesh.position.set(grenade.x, grenade.y, grenade.z);
      mesh.rotation.x = -Math.atan2(grenade.vy,
        Math.hypot(grenade.vx, grenade.vz));
      mesh.visible = true;
    },
    // Releases a pooled grenade mesh after detonation.
    removeGrenade(grenade) {
      if (grenade.mesh) {
        grenade.mesh.visible = false;
        grenade.mesh.userData.inUse = false;
        grenade.mesh = null;
      }
    },
    // Draws an expanding smoke cluster that fades with the cloud lifetime.
    smoke(cloud) {
      const radius = Math.min(4, 0.7 + cloud.age * 0.55);
      for (let i = 0; i < smokeMeshes.length; i++) {
        const mesh = smokeMeshes[i];
        const angle = i * Math.PI * 2 / smokeMeshes.length;
        mesh.position.set(cloud.x + Math.cos(angle) * radius * 0.55,
          0.8 + i % 3 * 0.65, cloud.z + Math.sin(angle) * radius * 0.55);
        mesh.scale.setScalar(radius * (0.35 + (i % 3) * 0.08));
        mesh.material.opacity = Math.min(0.3, cloud.t / 12 * 0.3);
        mesh.visible = true;
      }
    },
    // Hides every smoke sphere after its cloud ends.
    removeSmoke() { for (const mesh of smokeMeshes) mesh.visible = false; },
    // Emits a brief expanding burst when a frag detonates.
    explosion(x, y, z) {
      for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI * 2 / 24;
        puff(x + Math.cos(angle) * 0.5, y + (i % 4) * 0.12,
          z + Math.sin(angle) * 0.5, 0xff6b25);
      }
    },
    // Ages and hides pooled tracers and particles.
    update(dt) {
      for (const line of lines) {
        if (!line.visible) continue;
        line.userData.life -= dt;
        if (line.userData.life <= 0) line.visible = false;
        else line.material.opacity = Math.min(1, line.userData.life * 5);
      }
      for (const particle of particles) {
        if (!particle.visible) continue;
        particle.userData.life -= dt;
        if (particle.userData.life <= 0) particle.visible = false;
        else {
          particle.material.opacity = Math.min(1, particle.userData.life * 5);
          particle.scale.multiplyScalar(1 + dt * 1.5);
        }
      }
    }
  };
}
