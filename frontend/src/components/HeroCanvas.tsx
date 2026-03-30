import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function HeroCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return

    const W = window.innerWidth
    const H = window.innerHeight

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100)
    camera.position.z = 6

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mountRef.current.appendChild(renderer.domElement)

    // ── Football pitch lines ─────────────────────
    const pitchMat = new THREE.LineBasicMaterial({ color: 0x2d6a4f, transparent: true, opacity: 0.18 })
    const pitchGroup = new THREE.Group()
    pitchGroup.position.z = -1

    const addLine = (points: [number, number, number][]) => {
      const pts = points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
      const g = new THREE.BufferGeometry().setFromPoints(pts)
      pitchGroup.add(new THREE.Line(g, pitchMat))
    }

    // Outer rect
    addLine([[-5, -3, 0], [5, -3, 0], [5, 3, 0], [-5, 3, 0], [-5, -3, 0]])
    // Center line
    addLine([[0, -3, 0], [0, 3, 0]])
    // Center circle (32 segments)
    const cc: [number, number, number][] = []
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2
      cc.push([Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0])
    }
    addLine(cc)
    // Left penalty box
    addLine([[-5, -1.4, 0], [-3.2, -1.4, 0], [-3.2, 1.4, 0], [-5, 1.4, 0]])
    // Right penalty box
    addLine([[5, -1.4, 0], [3.2, -1.4, 0], [3.2, 1.4, 0], [5, 1.4, 0]])
    // Left goal
    addLine([[-5, -0.55, 0], [-4.55, -0.55, 0], [-4.55, 0.55, 0], [-5, 0.55, 0]])
    // Right goal
    addLine([[5, -0.55, 0], [4.55, -0.55, 0], [4.55, 0.55, 0], [5, 0.55, 0]])
    scene.add(pitchGroup)

    // ── Particles ────────────────────────────────
    const COUNT = 90
    const positions = new Float32Array(COUNT * 3)
    interface Vel { vx: number; vy: number; phase: number }
    const vels: Vel[] = []

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 11
      positions[i * 3 + 1] = (Math.random() - 0.5) * 7
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2
      vels.push({
        vx: (Math.random() - 0.5) * 0.004,
        vy: (Math.random() - 0.5) * 0.003,
        phase: Math.random() * Math.PI * 2,
      })
    }

    const pGeom = new THREE.BufferGeometry()
    pGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const pMat = new THREE.PointsMaterial({ color: 0xd4a853, size: 0.045, transparent: true, opacity: 0.85 })
    const points = new THREE.Points(pGeom, pMat)
    scene.add(points)

    // ── Connection lines ─────────────────────────
    const MAX_CONNECTIONS = 200
    const linePositions = new Float32Array(MAX_CONNECTIONS * 6)
    const lGeom = new THREE.BufferGeometry()
    lGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
    const lMat = new THREE.LineBasicMaterial({ color: 0x2d6a4f, transparent: true, opacity: 0.22, vertexColors: false })
    const lineSegments = new THREE.LineSegments(lGeom, lMat)
    scene.add(lineSegments)

    // ── Mouse ─────────────────────────────────────
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    const onMouse = (e: MouseEvent) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 0.5
      mouse.ty = -(e.clientY / window.innerHeight - 0.5) * 0.3
    }
    window.addEventListener('mousemove', onMouse)

    // ── Animate ───────────────────────────────────
    let frame = 0
    let animId: number

    const animate = () => {
      animId = requestAnimationFrame(animate)
      frame++

      mouse.x += (mouse.tx - mouse.x) * 0.06
      mouse.y += (mouse.ty - mouse.y) * 0.06

      scene.rotation.y = mouse.x * 0.4
      scene.rotation.x = mouse.y * 0.3

      // Update particle positions
      const pos = pGeom.attributes.position.array as Float32Array
      for (let i = 0; i < COUNT; i++) {
        pos[i * 3]     += vels[i].vx
        pos[i * 3 + 1] += vels[i].vy + Math.sin(frame * 0.008 + vels[i].phase) * 0.0015
        if (pos[i * 3] > 5.5) pos[i * 3] = -5.5
        if (pos[i * 3] < -5.5) pos[i * 3] = 5.5
        if (pos[i * 3 + 1] > 3.5) pos[i * 3 + 1] = -3.5
        if (pos[i * 3 + 1] < -3.5) pos[i * 3 + 1] = 3.5
      }
      pGeom.attributes.position.needsUpdate = true

      // Update connection lines
      let idx = 0
      const lPos = lGeom.attributes.position.array as Float32Array
      for (let a = 0; a < COUNT && idx < MAX_CONNECTIONS; a++) {
        for (let b = a + 1; b < COUNT && idx < MAX_CONNECTIONS; b++) {
          const dx = pos[a*3] - pos[b*3]
          const dy = pos[a*3+1] - pos[b*3+1]
          const dz = pos[a*3+2] - pos[b*3+2]
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)
          if (dist < 2.2) {
            lPos[idx*6]   = pos[a*3]; lPos[idx*6+1] = pos[a*3+1]; lPos[idx*6+2] = pos[a*3+2]
            lPos[idx*6+3] = pos[b*3]; lPos[idx*6+4] = pos[b*3+1]; lPos[idx*6+5] = pos[b*3+2]
            idx++
          }
        }
      }
      // Zero out remaining
      for (let k = idx * 6; k < MAX_CONNECTIONS * 6; k++) lPos[k] = 0
      lGeom.attributes.position.needsUpdate = true
      lGeom.setDrawRange(0, idx * 2)

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      pGeom.dispose(); pMat.dispose()
      lGeom.dispose(); lMat.dispose()
      pitchMat.dispose()
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} className="absolute inset-0 z-0 pointer-events-none" />
}
