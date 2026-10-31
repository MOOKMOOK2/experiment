import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '');
const apiBaseUrl = configuredApiBaseUrl || (import.meta.env.DEV ? 'http://localhost:8080' : '');

async function apiPost(path, body) {
  if (!apiBaseUrl) {
    throw new Error('백엔드 주소가 설정되지 않았습니다. VITE_API_BASE_URL을 설정해 주세요.');
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('백엔드에 연결할 수 없습니다. 서버 실행과 CORS 설정을 확인해 주세요.');
  }

  const responseText = await response.text();
  let result = null;
  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch {
    result = { message: responseText };
  }

  if (!response.ok) {
    throw new Error(result?.message || `백엔드 요청에 실패했습니다. (${response.status})`);
  }

  return result;
}

const rooms = {
  A: { name: 'A방', flip: false, photo: `${import.meta.env.BASE_URL}images/room-a-photo.png`, model: `${import.meta.env.BASE_URL}models/room-a.glb?v=5` },
  B: { name: 'B방', flip: true, photo: `${import.meta.env.BASE_URL}images/room-b-source.png`, model: `${import.meta.env.BASE_URL}models/room-b.glb?v=2` },
};
const roomAPhotos = [1, 2, 3].map((number) => `${import.meta.env.BASE_URL}images/room-a-photo-${number}.png`);
const quiz = [
  ['침대 머리맡이 붙어 있는 벽에는 무엇이 있는가?', ['창문', '출입문', '욕실 문', '아무것도 없음', '잘 모르겠다']],
  ['책상 의자에 앉아 책상을 바라볼 때, 침대는 어느 쪽에 있는가?', ['등 뒤쪽', '왼쪽', '오른쪽', '잘 모르겠다']],
  ['TV가 걸린 벽 바로 뒤편에 있는 것은?', ['세면대', '출입문', '소파', '그냥 벽', '잘 모르겠다']],
  ['침대에 머리맡 쪽으로 머리를 두고 바르게 누웠을 때, 소파는 어느 쪽에 있는가?', ['왼쪽', '오른쪽', '발끝 쪽', '잘 모르겠다']],
  ['다음 평면도 4개 중 실제 객실과 일치하는 것은?', ['A', 'B', 'C', 'D', '잘 모르겠다']],
];
const correctAnswers = {
  A: ['창문', '등 뒤쪽', '세면대', '왼쪽', 'B'],
  B: ['아무것도 없음', '왼쪽', '그냥 벽', '오른쪽', 'C'],
};

function readElapsedMillis(startedAt) {
  return startedAt === null ? 0 : Math.max(0, Math.round(performance.now() - startedAt));
}

function formatElapsedTime(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function cameraSides(camera, target) {
  const x = camera.position.x - target.x;
  const z = camera.position.z - target.z;
  // 카메라가 있는 모서리 쪽의 인접한 벽 두 면만 시야에서 가린다.
  return [`x${x >= 0 ? '+' : '-'}`, `z${z >= 0 ? '+' : '-'}`].sort().join(',');
}

function buildCutawayVariant(data, sideKey, bounds) {
  const { object, geometry, sourceIndices, sourceGroups } = data;
  const sides = sideKey.split(',').map((side) => {
    const axis = side[0] === 'x' ? 'x' : 'z';
    const sign = side[1] === '+' ? 1 : -1;
    const extent = bounds.max[axis] - bounds.min[axis];
    return { axis, sign, edge: sign > 0 ? bounds.max[axis] : bounds.min[axis], wallBand: Math.max(extent * 0.1, 0.2) };
  });
  const position = geometry.getAttribute('position');
  const pointA = new THREE.Vector3();
  const pointB = new THREE.Vector3();
  const pointC = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const variants = [];
  const groups = [];

  for (const group of sourceGroups) {
    const start = group.start;
    const end = Math.min(group.start + group.count, sourceIndices.length);
    const groupStart = variants.length;
    for (let i = start; i + 2 < end; i += 3) {
      const ia = sourceIndices[i];
      const ib = sourceIndices[i + 1];
      const ic = sourceIndices[i + 2];
      pointA.fromBufferAttribute(position, ia).applyMatrix4(object.matrixWorld);
      pointB.fromBufferAttribute(position, ib).applyMatrix4(object.matrixWorld);
      pointC.fromBufferAttribute(position, ic).applyMatrix4(object.matrixWorld);
      edge1.subVectors(pointB, pointA);
      edge2.subVectors(pointC, pointA);
      normal.crossVectors(edge1, edge2).normalize();
      const center = {
        x: (pointA.x + pointB.x + pointC.x) / 3,
        z: (pointA.z + pointB.z + pointC.z) / 3,
      };
      const height = (pointA.y + pointB.y + pointC.y) / 3;
      const verticalWall = height > bounds.min.y + (bounds.max.y - bounds.min.y) * 0.08 && height < bounds.max.y - (bounds.max.y - bounds.min.y) * 0.04;
      const onCameraWall = sides.some(({ axis, edge, wallBand }) => Math.abs(normal[axis]) > 0.78 && Math.abs(normal.y) < 0.28 && Math.abs(edge - center[axis]) < wallBand);
      if (!(onCameraWall && verticalWall)) variants.push(ia, ib, ic);
    }
    const count = variants.length - groupStart;
    if (count) groups.push({ start: groupStart, count, materialIndex: group.materialIndex });
  }

  if (variants.length === sourceIndices.length) return null;
  return { indices: variants, groups };
}

function ThreeRoom({ room }) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e6e9e4');
    const camera = new THREE.PerspectiveCamera(38, root.clientWidth / root.clientHeight, 0.01, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio * 1.1, 2.4));
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.replaceChildren(renderer.domElement);
    const status = document.createElement('div');
    status.className = 'model-loading';
    status.textContent = '객실 3D 모델 불러오는 중…';
    root.append(status);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc8c8c2, 2.7));
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(-4, 9, 6); scene.add(light);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.maxPolarAngle = Math.PI * .49;
    const loader = new GLTFLoader();
    let model;
    let roomBounds;
    let cutawayMeshes = [];
    let currentCutawaySide = '';
    let cancelled = false;
    loader.load(room.model, (gltf) => {
      if (cancelled) return;
      model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 8 / Math.max(size.x, size.y, size.z);
      model.position.sub(center);
      model.scale.setScalar(scale);
      model.position.y += size.y * scale / 2;
      model.updateMatrixWorld(true);
      scene.add(model);
      orbit.target.set(0, size.y * scale * .5, 0);
      camera.position.set(-12, size.y * scale * .68, 7);
      camera.lookAt(orbit.target);
      orbit.update();
      model.updateMatrixWorld(true);
      roomBounds = new THREE.Box3().setFromObject(model);
      model.traverse((object) => {
        if (!object.isMesh) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material) {
            if (room.name === 'A방' && material.name === 'Karol h9_Marais bed-007') {
              material.map = null;
              material.color.set('#ffffff');
              material.needsUpdate = true;
            }
            if (room.name === 'A방' && material.name === 'Glass_Mirror_01') {
              material.map = null;
              material.color.set('#888888');
              material.metalness = 0.08;
              material.roughness = 0.72;
              material.needsUpdate = true;
            } else if (room.name === 'A방' && material.color
              && Math.max(material.color.r, material.color.g, material.color.b) < 0.2) {
              material.color.set('#858585');
              material.needsUpdate = true;
            }
            Object.values(material).forEach((value) => {
              if (value?.isTexture) value.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
            });
          }
        });
        const geometry = object.geometry;
        const index = geometry.index;
        const sourceIndices = index ? Array.from(index.array) : Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i);
        const sourceGroups = geometry.groups.length ? geometry.groups.map((group) => ({ ...group })) : [{ start: 0, count: sourceIndices.length, materialIndex: 0 }];
        cutawayMeshes.push({ object, geometry, sourceIndices, sourceGroups, variants: new Map() });
      });
      status.remove();
    }, undefined, () => {
      if (!cancelled) status.textContent = '모델을 불러오지 못했습니다. 페이지를 새로고침해 주세요.';
    });
    const resize = new ResizeObserver(() => {
      if (!root.clientWidth || !root.clientHeight) return;
      camera.aspect = root.clientWidth / root.clientHeight;
      camera.updateProjectionMatrix(); renderer.setSize(root.clientWidth, root.clientHeight);
    });
    resize.observe(root);
    renderer.setAnimationLoop(() => {
      orbit.update();
      if (model && roomBounds) {
        const side = cameraSides(camera, orbit.target);
        if (side !== currentCutawaySide) {
          cutawayMeshes.forEach((data) => {
            if (!data.variants.has(side)) data.variants.set(side, buildCutawayVariant(data, side, roomBounds));
            const variant = data.variants.get(side);
            data.geometry.setIndex(variant ? variant.indices : data.sourceIndices);
            data.geometry.clearGroups();
            (variant?.groups || data.sourceGroups).forEach((group) => data.geometry.addGroup(group.start, group.count, group.materialIndex));
          });
          currentCutawaySide = side;
        }
      }
      renderer.render(scene, camera);
    });
    return () => {
      cancelled = true;
      resize.disconnect(); renderer.setAnimationLoop(null); orbit.dispose(); renderer.dispose();
      model?.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          Object.values(material).forEach((value) => { if (value?.isTexture) value.dispose(); });
          material.dispose();
        });
      });
      root.replaceChildren();
    };
  }, [room]);
  return <div className="three-room" ref={ref} />;
}

function PlanOption({ roomId, index }) {
  const roomPrefix = roomId === 'A' ? 'room-a' : 'room-b';
  const src = `${import.meta.env.BASE_URL}images/floorplans/${roomPrefix}-${index + 1}.png`;
  return <img className="plan-drawing" src={src} alt={`${roomId}방 도면 ${String.fromCharCode(65 + index)}`} loading="lazy" decoding="async" draggable="false" />;
}

function Survey({ roomId, roomName, onSubmit, submitting, submitError }) {
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    if ([1, 2, 3, 4, 5].some((n) => !answers['s' + n]) || quiz.some((_, i) => !answers['q' + (i + 1)])) { setError(true); return; }
    onSubmit(answers);
  };
  return <div className="overlay"><form className="survey" onSubmit={submit}>
    <div className="survey-head"><div><small>EXPERIMENT · {roomName}</small><h2>객실 확인 설문</h2></div></div>
    <p className="muted">이용한 객실 정보 확인 방식에 응답해 주세요.</p>
    {[['이 객실 정보 확인 방식은 내가 필요로 하는 기능을 갖추고 있었다.', 's1'], ['이 객실 정보 확인 방식은 사용하기 쉬웠다.', 's2'], ['이 객실에 대해 얻은 정보를 신뢰할 수 있다.', 's3'], ['이 객실을 예약하고 싶다.', 's4'], ['이 객실을 선택하는 데 확신이 있다.', 's5']].map(([label, key], i) =>
      <fieldset key={key}><legend><i>{String(i + 1).padStart(2, '0')}</i>{label}</legend><div className="scale">{[1, 2, 3, 4, 5, 6, 7].map((v) => <label className={answers[key] === v ? 'picked' : ''} key={v}><input type="radio" name={key} onChange={() => setAnswers({ ...answers, [key]: v })} /><span>{v}</span></label>)}</div><div className="scale-captions"><span>전혀 그렇지 않다</span><span>매우 그렇다</span></div></fieldset>
    )}
    {quiz.map(([label, options], i) => { const questionCode = 'q' + (i + 1); return <fieldset key={questionCode}><legend><i>{String(i + 6).padStart(2, '0')}</i>{label}</legend><div className={'choices ' + (i === 4 ? 'plan-choices' : '')}>{options.map((o, optionIndex) => <label className={(answers[questionCode] === o ? 'picked ' : '') + (i === 4 && optionIndex < 4 ? 'plan-choice' : '')} key={o}><input type="radio" name={questionCode} onChange={() => setAnswers({ ...answers, [questionCode]: o })} />{i === 4 && optionIndex < 4 ? <PlanOption roomId={roomId} index={optionIndex} /> : o}</label>)}</div></fieldset>; })}
    {error && <p className="error">모든 문항에 응답해 주세요.</p>}{submitError && <p className="api-error" role="alert">{submitError}</p>}<div className="survey-actions"><button className="primary" disabled={submitting}>{submitting ? '응답 저장 중…' : '응답 제출'}</button></div>
  </form></div>;
}

export default function App() {
  const [selectedRoom, setSelectedRoom] = useState('A');
  const [viewMode, setViewMode] = useState('photo');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [survey, setSurvey] = useState(false);
  const [surveyIntro, setSurveyIntro] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [experimentId, setExperimentId] = useState(null);
  const [startingExperiment, setStartingExperiment] = useState(false);
  const [apiError, setApiError] = useState('');
  const [explorationSubmitting, setExplorationSubmitting] = useState(false);
  const [explorationLocked, setExplorationLocked] = useState(false);
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [startingNextRoom, setStartingNextRoom] = useState(false);
  const [nextRoomError, setNextRoomError] = useState('');
  const [savedRoomResults, setSavedRoomResults] = useState({});
  const roomOpenedAt = useRef(null);
  const pendingExplorationMillis = useRef(null);
  const [explorationMillis, setExplorationMillis] = useState(0);
  const [complete, setComplete] = useState(false);
  const roomId = selectedRoom;
  const room = rooms[roomId];

  useEffect(() => {
    if (!hasStarted) return;
    roomOpenedAt.current = performance.now();
    pendingExplorationMillis.current = null;
    setExplorationLocked(false);
    setExplorationMillis(0);
  }, [hasStarted, roomId]);

  useEffect(() => {
    if (!hasStarted || survey || complete || explorationLocked) return;

    const updateTimer = () => {
      if (roomOpenedAt.current !== null) {
        setExplorationMillis(readElapsedMillis(roomOpenedAt.current));
      }
    };

    updateTimer();
    const timerId = window.setInterval(updateTimer, 20);
    return () => window.clearInterval(timerId);
  }, [hasStarted, roomId, survey, complete, explorationLocked]);

  const beginExperiment = async () => {
    setStartingExperiment(true);
    setApiError('');

    try {
      const result = await apiPost('/api/experiments', {});
      if (!result?.experimentId) {
        throw new Error('실험 세션 응답에 experimentId가 없습니다.');
      }

      setExperimentId(result.experimentId);
      setSelectedRoom('A');
      setViewMode('photo');
      setPhotoIndex(0);
      setSurvey(false);
      setSurveyIntro(false);
      setComplete(false);
      setSavedRoomResults({});
      setExplorationMillis(0);
      setExplorationLocked(false);
      pendingExplorationMillis.current = null;
      roomOpenedAt.current = null;
      setHasStarted(true);
    } catch (error) {
      setApiError(error.message || '실험을 시작하지 못했습니다.');
    } finally {
      setStartingExperiment(false);
    }
  };

  const beginSurvey = async () => {
    if (!experimentId) {
      setApiError('실험 세션 정보가 없어 탐색 시간을 저장할 수 없습니다.');
      return;
    }

    const elapsed = pendingExplorationMillis.current
      ?? readElapsedMillis(roomOpenedAt.current);
    pendingExplorationMillis.current = elapsed;
    setExplorationMillis(elapsed);
    setExplorationLocked(true);
    setExplorationSubmitting(true);
    setApiError('');

    try {
      const result = await apiPost(
        `/api/experiments/${experimentId}/rooms/${roomId}/exploration-complete`,
        { explorationMillis: elapsed }
      );

      if (result?.experimentId !== experimentId || result?.roomCode !== roomId) {
        throw new Error('탐색 완료 응답의 세션 또는 객실 정보가 일치하지 않습니다.');
      }

      setExplorationMillis(Number(result.explorationMillis));
      pendingExplorationMillis.current = null;
      roomOpenedAt.current = null;
      setSurveyIntro(false);
      setSurvey(true);
    } catch (error) {
      setApiError(error.message || '탐색 시간을 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setExplorationSubmitting(false);
    }
  };

  const beginSecondRoom = async () => {
    if (!experimentId) {
      setNextRoomError('실험 세션 정보가 없어 B방을 시작할 수 없습니다.');
      return;
    }

    setStartingNextRoom(true);
    setNextRoomError('');

    try {
      const result = await apiPost(
        `/api/experiments/${experimentId}/rooms/B/start`,
        { viewMode: 'RENDERING' }
      );

      if (result?.experimentId !== experimentId || result?.roomCode !== 'B') {
        throw new Error('B방 시작 응답이 올바르지 않습니다.');
      }

      setSelectedRoom('B');
      setViewMode('3d');
      setPhotoIndex(0);
      setExplorationMillis(0);
      setExplorationLocked(false);
      pendingExplorationMillis.current = null;
      roomOpenedAt.current = null;
    } catch (error) {
      setNextRoomError(error.message || 'B방을 시작하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setStartingNextRoom(false);
    }
  };

  const finishRoom = async (data) => {
    if (!experimentId) {
      setApiError('실험 세션 정보가 없어 설문을 저장할 수 없습니다.');
      return;
    }

    setSurveySubmitting(true);
    setApiError('');

    const answers = Object.fromEntries(
      Object.entries(data).map(([questionCode, answer]) => [questionCode, String(answer)])
    );

    try {
      const result = await apiPost(
        `/api/experiments/${experimentId}/rooms/${roomId}/submit`,
        { answers }
      );

      if (result?.experimentId !== experimentId || result?.roomCode !== roomId) {
        throw new Error('설문 저장 응답의 세션 또는 객실 정보가 일치하지 않습니다.');
      }

      setSavedRoomResults((previous) => ({ ...previous, [roomId]: result }));
      setSurvey(false);

      if (roomId === 'A') {
        await beginSecondRoom();
      } else {
        setComplete(true);
      }
    } catch (error) {
      setApiError(error.message || '설문 응답을 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setSurveySubmitting(false);
    }
  };

  const endExperiment = () => {
    setSelectedRoom('A');
    setViewMode('photo');
    setPhotoIndex(0);
    setSurvey(false);
    setSurveyIntro(false);
    setHasStarted(false);
    setExperimentId(null);
    setApiError('');
    setNextRoomError('');
    setSavedRoomResults({});
    setComplete(false);
    setExplorationLocked(false);
    setExplorationMillis(0);
    roomOpenedAt.current = null;
    pendingExplorationMillis.current = null;
  };

  if (!hasStarted) return <div className="welcome-screen"><main className="welcome-content"><h1>객실 공간 정보 실험</h1><p>객실을 충분히 살펴본 후, 객실에 관한 설문에 응답해 주세요.</p>{apiError && <p className="api-error" role="alert">{apiError}</p>}<button className="primary welcome-button" onClick={beginExperiment} disabled={startingExperiment}>{startingExperiment ? '실험 준비 중…' : '시작하기'}</button></main></div>;
  return <div className="app">
    <header><a className="brand" href="#">객실 공간 정보 실험</a></header>
    <main>
      <div className="experiment preview-status"><div className="room-label room-label-box"><span>{room.name}</span></div>{roomId === 'B' && <div className="mode"><small>3D 모델</small><span className="current">드래그하여 회전 · 스크롤하여 확대/축소</span></div>}</div>
      <section className="layout">
        <div className="visual"><div className="title-row"><div><small>ROOM {roomId}　·　{viewMode === 'photo' && roomId === 'A' ? 'PHOTO VIEW' : '3D SPACE VIEW'}</small><h2>{room.name}</h2></div></div>
          {viewMode === 'photo' && roomId === 'A' ? <PhotoGallery photos={roomAPhotos} index={photoIndex} setIndex={setPhotoIndex} /> : <div className="viewer"><ThreeRoom room={room} /><label className="badge">● 자유 시점 3D</label><label className="hint">⟲ 드래그하여 회전　·　스크롤하여 확대/축소</label></div>}
          {viewMode === 'photo' && roomId === 'A' ? <div className="photo-pagination"><button aria-label="이전 사진" onClick={() => setPhotoIndex((photoIndex + roomAPhotos.length - 1) % roomAPhotos.length)}>◀</button><div>{roomAPhotos.map((_, i) => <button key={i} className={photoIndex === i ? 'selected' : ''} aria-label={`${i + 1}번 사진`} aria-pressed={photoIndex === i} onClick={() => setPhotoIndex(i)} />)}</div><span>{photoIndex + 1} / {roomAPhotos.length}</span><button aria-label="다음 사진" onClick={() => setPhotoIndex((photoIndex + 1) % roomAPhotos.length)}>▶</button></div> : <div className="thumbs"><span>▧　객실 전체</span><span>▧　침실</span><span>▦　공간 배치</span><small>3D 모델 미리보기</small></div>}
        </div>
        <aside className="card"><div className="card-title"><h3>{room.name}</h3><div className="room-amenities"><span>침대 1</span><span>쇼파 1</span><span>TV</span></div></div><div className="exploration-timer" role="timer" aria-label={`탐색 시간 ${formatElapsedTime(explorationMillis)}`}><small>탐색 시간</small><strong>{formatElapsedTime(explorationMillis)}</strong></div><p className="description">객실을 충분히 탐색한 후 객실확인 완료 버튼을 눌러주세요.</p><hr /><button className="reserve" onClick={() => setSurveyIntro(true)}>객실 확인 완료</button></aside>
      </section>
    </main>
    {surveyIntro && <div className="overlay"><section className="survey-start" role="dialog" aria-modal="true" aria-labelledby="survey-start-title"><h2 id="survey-start-title">이제 객실과 관련한 설문이 시작됩니다.</h2><p>객실 구조와 요소들을 충분히 파악한 후 설문에 응해주세요.</p><p>(설문 중에는 객실을 확인할 수 없습니다.)</p>{apiError && <p className="api-error" role="alert">{apiError}</p>}<div className="survey-actions"><button className="secondary" disabled={explorationLocked || explorationSubmitting} onClick={() => { setSurveyIntro(false); setApiError(''); }}>돌아가기</button><button className="primary" disabled={explorationSubmitting} onClick={beginSurvey}>{explorationSubmitting ? '탐색 시간 저장 중…' : explorationLocked ? '다시 시도' : '설문으로'}</button></div></section></div>}
    {survey && <Survey roomId={roomId} roomName={room.name} onSubmit={finishRoom} submitting={surveySubmitting} submitError={apiError} />}
    {(startingNextRoom || nextRoomError) && <div className="overlay"><section className="survey-start" role="dialog" aria-modal="true" aria-labelledby="next-room-title"><h2 id="next-room-title">{startingNextRoom ? 'B방을 준비하고 있습니다.' : 'A방 응답이 저장되었습니다.'}</h2><p>{startingNextRoom ? '잠시만 기다려 주세요.' : 'B방을 시작하지 못했습니다. 다시 연결해 주세요.'}</p>{nextRoomError && <p className="api-error" role="alert">{nextRoomError}</p>}<div className="survey-actions"><button className="primary" onClick={beginSecondRoom} disabled={startingNextRoom}>{startingNextRoom ? '연결 중…' : 'B방 시작 재시도'}</button></div></section></div>}
    {complete && <div className="overlay"><div className="complete"><span>✓</span><small>SESSION COMPLETE</small><h2>두 객실 확인이 완료되었습니다.</h2><p>설문 응답과 탐색 시간이 데이터베이스에 저장되었습니다.</p><div className="result-summary">{['A', 'B'].map((code) => { const result = savedRoomResults[code]; return <section key={code}><strong>{code}방</strong><span>탐색 {formatElapsedTime(result?.explorationMillis ?? 0)}</span><span>편의성 {Number(result?.convenienceScore ?? 0).toFixed(2)} / 7</span><span>선택 확신도 {Number(result?.choiceConfidenceScore ?? 0).toFixed(2)} / 7</span><span>공간 이해도 {result?.spaceAccuracy ?? 0}%</span></section>; })}</div><button className="secondary" onClick={endExperiment}>실험 끝내기</button></div></div>}
  </div>;
}

function Photo({ room, roomId }) {
  const [missing, setMissing] = useState(false);
  return <>{!missing && <img className="room-photo" src={room.photo} alt={room.name + ' 사진'} onError={() => setMissing(true)} />}{missing && <div className={'placeholder ' + (room.flip ? 'flip' : '')}><div className="window" /><div className="bed"><i /><i /></div><div className="desk" /><div className="sofa" /><div className="placeholder-label"><small>ROOM {roomId}</small><b>{room.name}</b></div></div>}</>;
}

function PhotoGallery({ photos, index, setIndex }) {
  const [failedPhotos, setFailedPhotos] = useState({});
  return <div className="viewer photo-viewer">
    {failedPhotos[index] ? <div className="photo-missing"><b>A방 사진을 불러올 수 없습니다.</b></div> : <img className="room-photo" src={photos[index]} alt={`A방 객실 사진 ${index + 1}`} onError={() => setFailedPhotos((old) => ({ ...old, [index]: true }))} />}
    <button className="photo-arrow previous" aria-label="이전 사진" onClick={() => setIndex((index + photos.length - 1) % photos.length)}>◀</button>
    <button className="photo-arrow next" aria-label="다음 사진" onClick={() => setIndex((index + 1) % photos.length)}>▶</button>
  </div>;
}
