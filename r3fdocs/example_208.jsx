import state from './state'

function HeightReporter({ onReflow }) {
  const size = useFlexSize()
  useLayoutEffect(() => onReflow && onReflow(...size), [onReflow, size])
  return null
}

function Page({ text, tag, images, textScaleFactor, onReflow, left = false }) {
  const textures = useLoader(THREE.TextureLoader, images)
  const { viewport } = useThree()
  const boxProps = {
    centerAnchor: true,
    grow: 1,
    marginTop: 1,
    marginLeft: left * 1,
    marginRight: !left * 1,
    width: 'auto',
    height: 'auto',
    minWidth: 3,
    minHeight: 3,
    maxWidth: 6,
    maxHeight: 6,
  }
  return (
    <Box dir="column" align={left ? 'flex-start' : 'flex-end'} justify="flex-start" width="100%" height="auto" minHeight="100%">
      <HeightReporter onReflow={onReflow} />
      <Box dir="row" width="100%" height="auto" justify={left ? 'flex-end' : 'flex-start'} margin={0} grow={1} wrap="wrap">
        {textures.map((texture, index) => (
          <Box key={index} {...boxProps}>
            {(width, height) => (
              <mesh>
                <planeBufferGeometry args={[width, height]} />
                <meshBasicMaterial map={texture} toneMapped={false} />
              </mesh>
            )}
          </Box>
        ))}
      </Box>
      <Box marginLeft={1.5} marginRight={1.5} marginTop={2}>
        <Text position={[left ? 1 : -1, 0.5, 1]} fontSize={textScaleFactor} lineHeight={1} letterSpacing={-0.05} maxWidth={(viewport.width / 4) * 3}>
          {tag}
          <meshBasicMaterial color="#cccccc" toneMapped={false} />
        </Text>
      </Box>
      <Box marginLeft={left ? 1.5 : 1} marginRight={left ? 1 : 1.5} marginBottom={1}>
        <Text
          bold
          position-z={0.5}
          textAlign={left ? 'left' : 'right'}
          fontSize={1.5 * textScaleFactor}
          lineHeight={1}
          letterSpacing={-0.05}
          color="black"
          maxWidth={(viewport.width / 4) * 3}>
          {text}
        </Text>
      </Box>
    </Box>
  )
}

function Layercard({ depth, boxWidth, boxHeight, text, textColor, color, map, textScaleFactor }) {
  const ref = useRef()
  const { viewport, size } = useThree()
  const pageLerp = useRef(state.top / size.height)
  useFrame(() => {
    const page = (pageLerp.current = THREE.MathUtils.lerp(pageLerp.current, state.top / size.height, 0.15))
    if (depth >= 0) ref.current.opacity = page < state.threshold * 1.7 ? 1 : 1 - (page - state.threshold * 1.7)
  })
  return (
    <>
      <mesh position={[boxWidth / 2, -boxHeight / 2, depth]}>
        <planeBufferGeometry args={[boxWidth, boxHeight]} />
        <meshBasicMaterial ref={ref} color={color} map={map} toneMapped={false} transparent opacity={1} />
      </mesh>
      <Text
        bold
        position={[boxWidth / 2, -boxHeight / 2, depth + 1.5]}
        maxWidth={(viewport.width / 4) * 1}
        anchorX="center"
        anchorY="middle"
        fontSize={0.6 * textScaleFactor}
        lineHeight={1}
        letterSpacing={-0.05}
        color={textColor}>
        {text}
      </Text>
    </>
  )
}

function Content({ onReflow }) {
  const group = useRef()
  const { viewport, size } = useThree()
  const [bW, bH] = useAspect(1920, 1920, 0.5)
  const texture = useLoader(THREE.TextureLoader, state.depthbox[0].image)
  const vec = new THREE.Vector3()
  const pageLerp = useRef(state.top / size.height)
  useFrame(() => {
    const page = (pageLerp.current = THREE.MathUtils.lerp(pageLerp.current, state.top / size.height, 0.15))
    const y = page * viewport.height
    const sticky = state.threshold * viewport.height
    group.current.position.lerp(vec.set(0, page < state.threshold ? y : sticky, page < state.threshold ? 0 : page * 1.25), 0.15)
  })
  const handleReflow = useCallback((w, h) => onReflow((state.pages = h / viewport.height + 5.5)), [onReflow, viewport.height])
  const sizesRef = useRef([])
  const scale = Math.min(1, viewport.width / 16)
  return (
    <group ref={group}>
      <Flex dir="column" position={[-viewport.width / 2, viewport.height / 2, 0]} size={[viewport.width, viewport.height, 0]} onReflow={handleReflow}>
        {state.content.map((props, index) => (
          <Page
            key={index}
            left={!(index % 2)}
            textScaleFactor={scale}
            onReflow={(w, h) => {
              sizesRef.current[index] = h
              state.threshold = Math.max(4, (4 / (15.8 * 3)) * sizesRef.current.reduce((acc, e) => acc + e, 0))
            }}
            {...props}
          />
        ))}
        <Box dir="row" width="100%" height="100%" align="center" justify="center">
          <Box centerAnchor>
            {state.lines.map((props, index) => (
              <Line key={index} {...props} />
            ))}
            <Text
              bold
              position-z={0.5}
              anchorX="center"
              anchorY="middle"
              fontSize={1.5 * scale}
              lineHeight={1}
              letterSpacing={-0.05}
              color="black"
              maxWidth={(viewport.width / 4) * 3}>
              {state.depthbox[0].text}
            </Text>
          </Box>
        </Box>
        <Box dir="row" width="100%" height="100%" align="center" justify="center">
          <Box>
            <Layercard {...state.depthbox[0]} text={state.depthbox[1].text} boxWidth={bW} boxHeight={bH} map={texture} textScaleFactor={scale} />
            <Geo position={[bW / 2, -bH / 2, state.depthbox[1].depth]} />
          </Box>
        </Box>
      </Flex>
    </group>
  )
}

export default function App() {
  const scrollArea = useRef()
  const onScroll = (e) => (state.top = e.target.scrollTop)
  useEffect(() => void onScroll({ target: scrollArea.current }), [])
  const [pages, setPages] = useState(0)
  return (
    <>
      <Canvas
        shadows
        raycaster={{ enabled: false }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 10], far: 1000 }}
        gl={{ powerPreference: 'high-performance', alpha: false, antialias: false, stencil: false, depth: false }}
        onCreated={({ gl }) => gl.setClearColor('#f5f5f5')}>
        <pointLight position={[-10, -10, -10]} intensity={1} />
        <ambientLight intensity={0.4} />
        <spotLight
          castShadow
          angle={0.3}
          penumbra={1}
          position={[0, 10, 20]}
          intensity={5}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Suspense fallback={null}>
          <Content onReflow={setPages} />
        </Suspense>
        <Effects />
      </Canvas>
      <div
        className="scrollArea"
        ref={scrollArea}
        onScroll={onScroll}
        onPointerMove={(e) => (state.mouse = [(e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1])}>
        <div style={{ height: `${pages * 100}vh` }} />
      </div>
      <Loader />
    </>
  )
}


const state = {
  top: 0,
  pages: 0,
  threshold: 4,
  mouse: [0, 0],
  content: [
    {
      tag: '00',
      text: `The Bacchic\nand Dionysiac\nRites`,
      images: ['/images/BH41NVu.jpg', '/images/fBoIJLX.jpg', '/images/04zTfWB.jpg'],
    },
    { tag: '01', text: `The Elysian\nMysteries`, images: ['/images/c4cA8UN.jpg', '/images/ajQ73ol.jpg', '/images/gZOmLNU.jpg'] },
    { tag: '02', text: `The Hiramic\nLegend`, images: ['/images/mbFIW1b.jpg', '/images/mlDUVig.jpg', '/images/gwuZrgo.jpg'] },
  ],
  depthbox: [
    {
      depth: 0,
      color: '#cccccc',
      textColor: '#ffffff',
      text: 'In a void,\nno one could say\nwhy a thing\nonce set in motion\nshould stop anywhere.',
      image: '/images/cAKwexj.jpg',
    },
    {
      depth: -5,
      textColor: '#272727',
      text: 'For why should it stop\nhere rather than here?\nSo that a thing\nwill either be at rest\nor must be moved\nad infinitum.',
      image: '/images/04zTfWB.jpg',
    },
  ],
  lines: [
    { points: [[-20, 0, 0], [-9, 0, 0]], color: "black", lineWidth: 0.5 },
    { points: [[20, 0, 0], [9, 0, 0]], color: "black", lineWidth: 0.5 },
  ]
}

export default state

html,
body,
#root {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  color: white;
}

body {
  cursor: url('/images/ellipse.svg'), pointer;
  cursor: -webkit-image-set(url('/images/ellipse.svg') 1x, url('/images/ellipse.svg') 2x), pointer;
  background: #272727;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, Roboto,
    Ubuntu, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
}

.scrollArea {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: auto;
}

.loading {
  position: absolute;
  top: 0px;
  left: 0px;
  width: 100%;
  height: 100%;
  background: #171717;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-bar-container {
  width: 100px;
  height: 3px;
  background: #272727;
}

.loading-bar {
  height: 3px;
  background: white;
}

.loading-data {
  display: inline-block;
  position: relative;
  font-variant-numeric: tabular-nums;
  margin-top: 0.8em;
  color: #f0f0f0;
  font-size: 0.6em;
}