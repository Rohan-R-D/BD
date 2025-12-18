import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Group } from "three";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Candle } from "./models/candle";
import { Cake } from "./models/cake";
import { Table } from "./models/table";
import { PictureFrame } from "./models/pictureFrame";
import { Fireworks } from "./components/Fireworks";
import { BirthdayCard } from "./components/BirthdayCard";

import "./App.css";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

type AnimatedSceneProps = {
  isPlaying: boolean;
  onBackgroundFadeChange?: (opacity: number) => void;
  onEnvironmentProgressChange?: (progress: number) => void;
  candleLit: boolean;
  onAnimationComplete?: () => void;
  cards: ReadonlyArray<BirthdayCardConfig>;
  activeCardId: string | null;
  onToggleCard: (id: string) => void;
};

const CAKE_START_Y = 10;
const CAKE_END_Y = 0;
const CAKE_DESCENT_DURATION = 3;

const TABLE_START_Z = 30;
const TABLE_END_Z = 0;
const TABLE_SLIDE_DURATION = 0.7;
const TABLE_SLIDE_START = CAKE_DESCENT_DURATION - TABLE_SLIDE_DURATION - 0.1;

const CANDLE_START_Y = 5;
const CANDLE_END_Y = 0;
const CANDLE_DROP_DURATION = 1.2;
const CANDLE_DROP_START =
  Math.max(CAKE_DESCENT_DURATION, TABLE_SLIDE_START + TABLE_SLIDE_DURATION) +
  1.0;

const totalAnimationTime = CANDLE_DROP_START + CANDLE_DROP_DURATION;

const ORBIT_TARGET = new Vector3(0, 1, 0);
const ORBIT_INITIAL_RADIUS = 3;
const ORBIT_INITIAL_HEIGHT = 1;
const ORBIT_INITIAL_AZIMUTH = Math.PI / 2;
const ORBIT_MIN_DISTANCE = 2;
const ORBIT_MAX_DISTANCE = 8;
const ORBIT_MIN_POLAR = Math.PI * 0;
const ORBIT_MAX_POLAR = Math.PI / 2;

const BACKGROUND_FADE_DURATION = 1;
const BACKGROUND_FADE_OFFSET = 0;
const BACKGROUND_FADE_END = Math.max(
  CANDLE_DROP_START - BACKGROUND_FADE_OFFSET,
  BACKGROUND_FADE_DURATION
);
const BACKGROUND_FADE_START = Math.max(
  BACKGROUND_FADE_END - BACKGROUND_FADE_DURATION,
  0
);

const TYPED_LINES = [
  "> manasvi/crush.exe",
  "...",
  "> running program: birthday special",
  "...",
  "> input: your smile + your eyes",
  "> processing: happiness and special memories",
  "...",
  "> result:",
  "> the world feels brighter and happier today",
  "> because you exist in it✨",
  "...",
  "> message:",
  "> Happy Birthday, Manasvi ❤️",
  "> I hope you have a great day as your warm heart ",
  "...",
  "(*^.^*) (✿◠‿◠) (〃￣ω￣〃)",
];

const TYPED_CHAR_DELAY = 100;
const POST_TYPING_SCENE_DELAY = 1000;
const CURSOR_BLINK_INTERVAL = 480;
const MUSIC_VOLUME = 0.5; // Volume level: 0.0 (silent) to 1.0 (maximum)

type BirthdayCardConfig = {
  id: string;
  image: string;
  position: [number, number, number];
  rotation: [number, number, number];
};

const BIRTHDAY_CARDS: ReadonlyArray<BirthdayCardConfig> = [
  {
    id: "confetti",
    image: "/card.png",
    position: [1, 0.081, -2],
    rotation: [-Math.PI / 2 , 0, Math.PI / 3],
  }
];

function AnimatedScene({
  isPlaying,
  onBackgroundFadeChange,
  onEnvironmentProgressChange,
  candleLit,
  onAnimationComplete,
  cards,
  activeCardId,
  onToggleCard,
}: AnimatedSceneProps) {
  const cakeGroup = useRef<Group>(null);
  const tableGroup = useRef<Group>(null);
  const candleGroup = useRef<Group>(null);
  const animationStartRef = useRef<number | null>(null);
  const hasPrimedRef = useRef(false);
  const hasCompletedRef = useRef(false);
  const completionNotifiedRef = useRef(false);
  const backgroundOpacityRef = useRef(1);
  const environmentProgressRef = useRef(0);

  useEffect(() => {
    onBackgroundFadeChange?.(backgroundOpacityRef.current);
    onEnvironmentProgressChange?.(environmentProgressRef.current);
  }, [onBackgroundFadeChange, onEnvironmentProgressChange]);

  const emitBackgroundOpacity = (value: number) => {
    const clamped = clamp(value, 0, 1);
    if (Math.abs(clamped - backgroundOpacityRef.current) > 0.005) {
      backgroundOpacityRef.current = clamped;
      onBackgroundFadeChange?.(clamped);
    }
  };

  const emitEnvironmentProgress = (value: number) => {
    const clamped = clamp(value, 0, 1);
    if (Math.abs(clamped - environmentProgressRef.current) > 0.005) {
      environmentProgressRef.current = clamped;
      onEnvironmentProgressChange?.(clamped);
    }
  };

  useFrame(({ clock }) => {
    const cake = cakeGroup.current;
    const table = tableGroup.current;
    const candle = candleGroup.current;

    if (!cake || !table || !candle) {
      return;
    }

    if (!hasPrimedRef.current) {
      cake.position.set(0, CAKE_START_Y, 0);
      cake.rotation.set(0, 0, 0);
      table.position.set(0, 0, TABLE_START_Z);
      table.rotation.set(0, 0, 0);
      candle.position.set(0, CANDLE_START_Y, 0);
      candle.visible = false;
      hasPrimedRef.current = true;
    }

    if (!isPlaying) {
      emitBackgroundOpacity(1);
      emitEnvironmentProgress(0);
      animationStartRef.current = null;
      hasCompletedRef.current = false;
      completionNotifiedRef.current = false;
      return;
    }

    if (hasCompletedRef.current) {
      emitBackgroundOpacity(0);
      emitEnvironmentProgress(1);
      if (!completionNotifiedRef.current) {
        completionNotifiedRef.current = true;
        onAnimationComplete?.();
      }
      return;
    }

    if (animationStartRef.current === null) {
      animationStartRef.current = clock.elapsedTime;
    }

    const elapsed = clock.elapsedTime - animationStartRef.current;
    const clampedElapsed = clamp(elapsed, 0, totalAnimationTime);

    const cakeProgress = clamp(clampedElapsed / CAKE_DESCENT_DURATION, 0, 1);
    const cakeEase = easeOutCubic(cakeProgress);
    cake.position.y = lerp(CAKE_START_Y, CAKE_END_Y, cakeEase);
    cake.position.x = 0;
    cake.position.z = 0;
    cake.rotation.y = cakeEase * Math.PI * 2;
    cake.rotation.x = 0;
    cake.rotation.z = 0;

    let tableZ = TABLE_START_Z;
    if (clampedElapsed >= TABLE_SLIDE_START) {
      const tableProgress = clamp(
        (clampedElapsed - TABLE_SLIDE_START) / TABLE_SLIDE_DURATION,
        0,
        1
      );
      const tableEase = easeOutCubic(tableProgress);
      tableZ = lerp(TABLE_START_Z, TABLE_END_Z, tableEase);
    }
    table.position.set(0, 0, tableZ);
    table.rotation.set(0, 0, 0);

    if (clampedElapsed >= CANDLE_DROP_START) {
      if (!candle.visible) {
        candle.visible = true;
      }
      const candleProgress = clamp(
        (clampedElapsed - CANDLE_DROP_START) / CANDLE_DROP_DURATION,
        0,
        1
      );
      const candleEase = easeOutCubic(candleProgress);
      candle.position.y = lerp(CANDLE_START_Y, CANDLE_END_Y, candleEase);
    } else {
      candle.visible = false;
      candle.position.set(0, CANDLE_START_Y, 0);
    }

    if (clampedElapsed < BACKGROUND_FADE_START) {
      emitBackgroundOpacity(1);
      emitEnvironmentProgress(0);
    } else {
      const fadeProgress = clamp(
        (clampedElapsed - BACKGROUND_FADE_START) / BACKGROUND_FADE_DURATION,
        0,
        1
      );
      const eased = easeOutCubic(fadeProgress);
      const backgroundOpacity = 1 - eased;
      emitBackgroundOpacity(backgroundOpacity);
      emitEnvironmentProgress(1 - backgroundOpacity);
    }

    const animationDone = clampedElapsed >= totalAnimationTime;
    if (animationDone) {
      cake.position.set(0, CAKE_END_Y, 0);
      cake.rotation.set(0, 0, 0);
      table.position.set(0, 0, TABLE_END_Z);
      candle.position.set(0, CANDLE_END_Y, 0);
      candle.visible = true;
      emitBackgroundOpacity(0);
      emitEnvironmentProgress(1);
      hasCompletedRef.current = true;
      if (!completionNotifiedRef.current) {
        completionNotifiedRef.current = true;
        onAnimationComplete?.();
      }
    }
  });

  return (
    <>
      <group ref={tableGroup}>
        <Table />
        <PictureFrame
          image="/frame2.jpg"
          position={[0, 0.735, 3]}
          rotation={[0, 5.6, 0]}
          scale={0.75}
        />
        <PictureFrame
          image="/frame3.jpg"
          position={[0, 0.735, -3]}
          rotation={[0, 4.0, 0]}
          scale={0.75}
        />
        <PictureFrame
          image="/frame4.jpg"
          position={[-1.5, 0.735, 2.5]}
          rotation={[0, 5.4, 0]}
          scale={0.75}
        />
        <PictureFrame
          image="/frame1.jpg"
          position={[-1.5, 0.735, -2.5]}
          rotation={[0, 4.2, 0]}
          scale={0.75}
        />
        {cards.map((card) => (
          <BirthdayCard
            key={card.id}
            id={card.id}
            image={card.image}
            tablePosition={card.position}
            tableRotation={card.rotation}
            isActive={activeCardId === card.id}
            onToggle={onToggleCard}
          />
        ))}
      </group>
      <group ref={cakeGroup}>
        <Cake />
      </group>
      <group ref={candleGroup}>
        <Candle isLit={candleLit} scale={0.25} position={[0, 1.1, 0]} />
      </group>
    </>
  );
}

function ConfiguredOrbitControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const offset = new Vector3(
      Math.sin(ORBIT_INITIAL_AZIMUTH) * ORBIT_INITIAL_RADIUS,
      ORBIT_INITIAL_HEIGHT,
      Math.cos(ORBIT_INITIAL_AZIMUTH) * ORBIT_INITIAL_RADIUS
    );
    const cameraPosition = ORBIT_TARGET.clone().add(offset);
    camera.position.copy(cameraPosition);
    camera.lookAt(ORBIT_TARGET);

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(ORBIT_TARGET);
      controls.update();
    }
  }, [camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={ORBIT_MIN_DISTANCE}
      maxDistance={ORBIT_MAX_DISTANCE}
      minPolarAngle={ORBIT_MIN_POLAR}
      maxPolarAngle={ORBIT_MAX_POLAR}
    />
  );
}

type EnvironmentBackgroundControllerProps = {
  intensity: number;
};

function EnvironmentBackgroundController({
  intensity,
}: EnvironmentBackgroundControllerProps) {
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    if ("backgroundIntensity" in scene) {
      // Cast required because older typings might not include backgroundIntensity yet.
      (scene as typeof scene & { backgroundIntensity: number }).backgroundIntensity =
        intensity;
    }
  }, [scene, intensity]);

  return null;
}


export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [backgroundOpacity, setBackgroundOpacity] = useState(1);
  const [environmentProgress, setEnvironmentProgress] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [sceneStarted, setSceneStarted] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [hasAnimationCompleted, setHasAnimationCompleted] = useState(false);
  const [isCandleLit, setIsCandleLit] = useState(true);
  const [fireworksActive, setFireworksActive] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const typedTextRef = useRef<HTMLDivElement | null>(null);
  const audioInitializedRef = useRef(false);

  useEffect(() => {
    // Initialize audio element with mobile-friendly attributes
    const audio = new Audio("/nouolve_bianche.mp3");
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = MUSIC_VOLUME;
    // Critical for iOS: allows audio to play inline without fullscreen
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.setAttribute("x-webkit-airplay", "allow");
    // Cross-origin and other mobile-friendly attributes
    audio.crossOrigin = "anonymous";
    // Add error handling to debug audio issues
    audio.addEventListener("error", (e) => {
      console.error("Audio loading error:", e);
      console.error("Audio file path:", audio.src);
      console.error("Audio readyState:", audio.readyState);
    });
    // Add loaded event to ensure audio is ready
    audio.addEventListener("loadeddata", () => {
      audioInitializedRef.current = true;
      console.log("Audio loaded and ready");
    });
    // Add canplay event for better mobile support
    audio.addEventListener("canplay", () => {
      audioInitializedRef.current = true;
    });
    backgroundAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = ""; // Clear source to free memory
      backgroundAudioRef.current = null;
      audioInitializedRef.current = false;
    };
  }, []);

  const tryPlayAudio = useCallback((audio: HTMLAudioElement) => {
    audio.volume = MUSIC_VOLUME;
    audio.currentTime = 0;
    
    // Play audio - critical for mobile: must be called directly from user interaction
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log("Audio playing successfully");
          // Ensure volume is set after play starts (some mobile browsers reset it)
          audio.volume = MUSIC_VOLUME;
        })
        .catch((error) => {
          console.error("Audio play error:", error);
          console.error("Audio readyState:", audio.readyState);
          console.error("This might be due to browser autoplay policies. User interaction is required.");
          
          // Try to unlock audio context on mobile by playing muted first
          if (audio.paused) {
            const originalVolume = audio.volume;
            audio.muted = true;
            audio.volume = 0;
            
            audio.play()
              .then(() => {
                // Successfully unlocked, now play with sound
                audio.muted = false;
                audio.volume = MUSIC_VOLUME;
                audio.currentTime = 0;
                return audio.play();
              })
              .then(() => {
                console.log("Audio unlocked and playing");
              })
              .catch((err) => {
                console.error("Unlock attempt failed:", err);
                audio.muted = false;
                audio.volume = originalVolume;
              });
          }
        });
    }
  }, []);

  const playBackgroundMusic = useCallback(() => {
    const audio = backgroundAudioRef.current;
    if (!audio) {
      console.warn("Audio not initialized");
      return;
    }
    if (!audio.paused) {
      return;
    }
    
    // For mobile: ensure audio is loaded and ready
    // readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
    if (audio.readyState < 2) {
      // Try to load the audio
      audio.load();
      // Wait a bit for mobile browsers to load
      setTimeout(() => {
        tryPlayAudio(audio);
      }, 100);
      return;
    }
    
    tryPlayAudio(audio);
  }, [tryPlayAudio]);

  const handlePrimaryAction = useCallback(() => {
    if (!hasStarted) {
      playBackgroundMusic();
      setHasStarted(true);
      return;
    }
    if (hasAnimationCompleted && isCandleLit) {
      setIsCandleLit(false);
      setFireworksActive(true);
    }
  }, [hasStarted, hasAnimationCompleted, isCandleLit, playBackgroundMusic]);

  const typingComplete = currentLineIndex >= TYPED_LINES.length;
  const typedLines = useMemo(() => {
    if (TYPED_LINES.length === 0) {
      return [""];
    }

    return TYPED_LINES.map((line, index) => {
      if (typingComplete || index < currentLineIndex) {
        return line;
      }
      if (index === currentLineIndex) {
        return line.slice(0, Math.min(currentCharIndex, line.length));
      }
      return "";
    });
  }, [currentCharIndex, currentLineIndex, typingComplete]);

  const cursorLineIndex = typingComplete
    ? Math.max(typedLines.length - 1, 0)
    : currentLineIndex;
  const cursorTargetIndex = Math.max(
    Math.min(cursorLineIndex, typedLines.length - 1),
    0
  );

  useEffect(() => {
    const container = typedTextRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isOverflowing = scrollHeight > clientHeight;
    // Only auto-scroll if content overflows AND user is already near the bottom
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 10;
    if (isOverflowing && isNearBottom) {
      container.scrollTop = scrollHeight;
    }
  }, [currentLineIndex, currentCharIndex]);

  useEffect(() => {
    if (!hasStarted) {
      setCurrentLineIndex(0);
      setCurrentCharIndex(0);
      setSceneStarted(false);
      setIsCandleLit(true);
      setFireworksActive(false);
      setHasAnimationCompleted(false);
      return;
    }

    if (typingComplete) {
      if (!sceneStarted) {
        const handle = window.setTimeout(() => {
          setSceneStarted(true);
        }, POST_TYPING_SCENE_DELAY);
        return () => window.clearTimeout(handle);
      }
      return;
    }

    const currentLine = TYPED_LINES[currentLineIndex] ?? "";
    const handle = window.setTimeout(() => {
      if (currentCharIndex < currentLine.length) {
        setCurrentCharIndex((prev) => prev + 1);
        return;
      }

      let nextLineIndex = currentLineIndex + 1;
      while (
        nextLineIndex < TYPED_LINES.length &&
        TYPED_LINES[nextLineIndex].length === 0
      ) {
        nextLineIndex += 1;
      }

      setCurrentLineIndex(nextLineIndex);
      setCurrentCharIndex(0);
    }, TYPED_CHAR_DELAY);

    return () => window.clearTimeout(handle);
  }, [
    hasStarted,
    currentCharIndex,
    currentLineIndex,
    typingComplete,
    sceneStarted,
  ]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, CURSOR_BLINK_INTERVAL);
    return () => window.clearInterval(handle);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Any key can trigger the primary action
      event.preventDefault();
      handlePrimaryAction();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrimaryAction]);

  useEffect(() => {
    const handlePointerDown = () => {
      handlePrimaryAction();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [handlePrimaryAction]);

  // Add touchstart handler specifically for mobile devices
  useEffect(() => {
    const handleTouchStart = () => {
      // Only handle if it's the first touch (not already started)
      if (!hasStarted) {
        handlePrimaryAction();
      }
    };
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    return () => window.removeEventListener("touchstart", handleTouchStart);
  }, [handlePrimaryAction, hasStarted]);

  const handleCardToggle = useCallback((id: string) => {
    setActiveCardId((current) => (current === id ? null : id));
  }, []);

  const isScenePlaying = hasStarted && sceneStarted;
  const showActionButton =
    !hasStarted || (hasAnimationCompleted && isCandleLit);
  const actionButtonLabel = !hasStarted
    ? "Start"
    : hasAnimationCompleted && isCandleLit
    ? "Blow out candle"
    : "Tap / press";

  return (
    <div className="App">
      <div
        className="background-overlay"
        style={{ opacity: backgroundOpacity }}
      >
        <div className="typed-text" ref={typedTextRef}>
          {typedLines.map((line, index) => {
            const showCursor =
              cursorVisible &&
              index === cursorTargetIndex &&
              (!typingComplete || !sceneStarted);
            return (
              <span className="typed-line" key={`typed-line-${index}`}>
                {line || "\u00a0"}
                {showCursor && (
                  <span aria-hidden="true" className="typed-cursor">
                    _
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      {hasAnimationCompleted && isCandleLit && (
        <div className="hint-overlay">tap/click/press to blow out the candle</div>
      )}
      {showActionButton && (
        <div className="action-button-container">
          <button
            type="button"
            className="action-button"
            onClick={handlePrimaryAction}
          >
            {actionButtonLabel}
          </button>
        </div>
      )}
      <Canvas
        gl={{ alpha: true }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#000000", 0);
        }}
      >
        <Suspense fallback={null}>
          <AnimatedScene
            isPlaying={isScenePlaying}
            candleLit={isCandleLit}
            onBackgroundFadeChange={setBackgroundOpacity}
            onEnvironmentProgressChange={setEnvironmentProgress}
            onAnimationComplete={() => setHasAnimationCompleted(true)}
            cards={BIRTHDAY_CARDS}
            activeCardId={activeCardId}
            onToggleCard={handleCardToggle}
          />
          <ambientLight intensity={(1 - environmentProgress) * 0.8} />
          <directionalLight intensity={0.5} position={[2, 10, 0]} color={[1, 0.9, 0.95]}/>
          <Environment
            files={["/shanghai_bund_4k.hdr"]}
            backgroundRotation={[0, 3.3, 0]}
            environmentRotation={[0, 3.3, 0]}
            background
            environmentIntensity={0.1 * environmentProgress}
            backgroundIntensity={0.05 * environmentProgress}
          />
          <EnvironmentBackgroundController intensity={0.05 * environmentProgress} />
          <Fireworks isActive={fireworksActive} origin={[0, 10, 0]} />
          <ConfiguredOrbitControls />
        </Suspense>
      </Canvas>
    </div>
  );
}
