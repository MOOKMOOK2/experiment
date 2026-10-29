import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const rooms = {
  A: { name: 'A방', flip: false, photo: `${import.meta.env.BASE_URL}images/room-a-photo.png`, model: `${import.meta.env.BASE_URL}models/room-a.glb?v=5` },
  B: { name: 'B방', flip: true, photo: `${import.meta.env.BASE_URL}images/room-b-source.png`, model: `${import.meta.env.BASE_URL}models/room-b.glb?v=2` },
};
const roomAPhotos = [1, 2, 3].map((number) => `${import.meta.env.BASE_URL}images/room-a-photo-${number}.png`);
const quiz = [
  ['머리맡이 붙어 있는 벽에는 무엇이 있는가?', ['창문', '아무것도 없음', '출입문', '욕실 문', '잘 모르겠다']],
  ['책상 의자에 앉아 책상을 바라볼 때, 침대는 어느 쪽에 있는가?', ['등 뒤쪽', '왼쪽', '오른쪽', '잘 모르겠다']],
  ['TV가 걸린 벽 바로 뒤편에 있는 것은?', ['세면대', '그냥 벽', '출입문', '소파', '잘 모르겠다']],
  ['침대에 머리맡 쪽으로 누웠을 때, 소파는 어느 쪽에 있는가?', ['왼쪽', '오른쪽', '발끝 쪽', '잘 모르겠다']],
  ['다음 평면도 중 실제 객실과 일치하는 것은?', ['A', 'B', 'C', 'D', '잘 모르겠다']],
];
const correctAnswers = {
  A: ['창문', '등 뒤쪽', '세면대', '왼쪽', 'B'],
  B: ['아무것도 없음', '왼쪽', '그냥 벽', '오른쪽', 'C'],
};

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

function PlanOption({ index }) {
  const layouts = [
    { bedX: 16, doorX: 88, bathX: 12, windowX: 16, rotate: true },
    { bedX: 48, doorX: 14, bathX: 82, windowX: 47, rotate: false },
    { bedX: 15, doorX: 87, bathX: 12, windowX: 15, rotate: false },
    { bedX: 48, doorX: 87, bathX: 12, windowX: 47, rotate: true },
  ];
  const plan = layouts[index];
  return <svg className="plan-drawing" viewBox="0 0 120 82" aria-hidden="true">
    <rect x="8" y="7" width="104" height="68" rx="1" fill="#f7f4ed" stroke="#817f73" strokeWidth="2" />
    <path d={'M' + plan.windowX + ' 8h23'} stroke="#91b1ad" strokeWidth="4" />
    <path d={'M' + plan.doorX + ' 74h18'} stroke="#fbfaf6" strokeWidth="4" />
    <path d={'M' + plan.doorX + ' 74v-15a15 15 0 0 1 15 15'} fill="none" stroke="#a78f74" strokeWidth="1" />
    <rect x={plan.bathX} y="11" width="26" height="19" fill="#e3e8df" stroke="#9b9a8d" />
    <path d="M12 31h22" stroke="#9b9a8d" strokeWidth="2" />
    <rect x={plan.bedX} y={plan.rotate ? 39 : 38} width={plan.rotate ? 27 : 34} height={plan.rotate ? 22 : 27} rx="2" fill="#d6c9b4" stroke="#928675" />
    <rect x={plan.bedX + 4} y={plan.rotate ? 41 : 40} width={plan.rotate ? 19 : 26} height="7" fill="#fffdf8" stroke="#c4bbab" />
    <rect x="75" y="52" width="19" height="8" fill="#a58e74" rx="1" />
  </svg>;
}

function Survey({ roomName, onSubmit, onCancel }) {
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    if ([1, 2, 3, 4, 5].some((n) => !answers['s' + n]) || quiz.some((_, i) => !answers['q' + i])) { setError(true); return; }
    onSubmit(answers);
  };
  return <div className="overlay"><form className="survey" onSubmit={submit}>
    <div className="survey-head"><div><small>EXPERIMENT · {roomName}</small><h2>객실 확인 설문</h2></div><button type="button" className="close" onClick={onCancel}>×</button></div>
    <p className="muted">이용한 객실 정보 확인 방식에 응답해 주세요.</p>
    {[['이 객실 정보 확인 방식은 내가 필요로 하는 기능을 갖추고 있었다.', 's1'], ['이 객실 정보 확인 방식은 사용하기 쉬웠다.', 's2'], ['이 객실에 대해 얻은 정보를 신뢰할 수 있다.', 's3'], ['이 객실을 예약하고 싶다.', 's4'], ['이 객실을 선택하는 데 확신이 있다.', 's5']].map(([label, key], i) =>
      <fieldset key={key}><legend><i>0{i + 1}</i>{label}</legend><div className="scale">{[1, 2, 3, 4, 5, 6, 7].map((v) => <label className={answers[key] === v ? 'picked' : ''} key={v}><input type="radio" name={key} onChange={() => setAnswers({ ...answers, [key]: v })} /><span>{v}</span></label>)}</div><div className="scale-captions"><span>전혀 그렇지 않다</span><span>매우 그렇다</span></div></fieldset>
    )}
    {quiz.map(([label, options], i) => <fieldset key={i}><legend><i>0{i + 6}</i>{label}</legend><div className={'choices ' + (i === 4 ? 'plan-choices' : '')}>{options.map((o, optionIndex) => <label className={(answers['q' + i] === o ? 'picked ' : '') + (i === 4 && optionIndex < 4 ? 'plan-choice' : '')} key={o}><input type="radio" name={'q' + i} onChange={() => setAnswers({ ...answers, ['q' + i]: o })} />{i === 4 && optionIndex < 4 ? <><PlanOption index={optionIndex} /><b>{o}</b></> : o}</label>)}</div></fieldset>)}
    {error && <p className="error">모든 문항에 응답해 주세요.</p>}<div className="survey-actions"><button type="button" className="secondary" onClick={onCancel}>객실로 돌아가기</button><button className="primary">응답 제출 <span>→</span></button></div>
  </form></div>;
}

export default function App() {
  const [selectedRoom, setSelectedRoom] = useState('A');
  const [viewMode, setViewMode] = useState('photo');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [allocation] = useState(() => Math.random() < .5 ? ['A', 'B'] : ['B', 'A']);
  const [step, setStep] = useState(0);
  const [survey, setSurvey] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [participant, setParticipant] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [started, setStarted] = useState(performance.now());
  const [complete, setComplete] = useState(false);
  const roomId = selectedRoom;
  const room = rooms[roomId];
  const mode = viewMode === 'photo' && roomId === 'A' ? 'A방 사진 버전' : '3D 렌더링 미리보기';
  const finishRoom = (data) => {
    const row = {
      participant: participant || '미입력',
      room: roomId,
      mode,
      elapsed_ms: Math.round(performance.now() - started),
      space_score: quiz.reduce((score, _, i) => score + Number(data['q' + i] === correctAnswers[roomId][i]), 0),
      ...data,
    };
    setAnswers((old) => [...old, row]); setSurvey(false);
    if (step === 0) {
      setStep(1);
      setSelectedRoom('B');
      setViewMode('3d');
      setStarted(performance.now());
    } else setComplete(true);
  };
  const exportData = () => {
    const keys = ['participant','room','mode','elapsed_ms','space_score','s1','s2','s3','s4','s5','q0','q1','q2','q3','q4'];
    const csv = '\uFEFF' + [keys, ...answers.map((row) => keys.map((key) => row[key] ?? ''))].map((row) => row.map((value) => '"' + String(value).replaceAll('"','""') + '"').join(',')).join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = 'experiment-' + (participant || 'response') + '.csv'; link.click(); URL.revokeObjectURL(link.href);
  };
  const endExperiment = () => {
    setSelectedRoom('A'); setViewMode('photo'); setPhotoIndex(0); setStep(0); setSurvey(false);
    setAnswers([]); setParticipant(''); setNameInput(''); setComplete(false); setStarted(performance.now());
  };
  return <div className="app">
    <header><a className="brand" href="#">객실 공간 정보 실험</a></header>
    <main>
      <div className="experiment preview-status"><div className="room-label"><small>현재 렌더링</small><b>{roomId}</b><span>{room.name}</span></div><div className="mode"><small>3D 모델</small><span className="current">드래그하여 회전 · 스크롤하여 확대/축소</span></div></div>
      <section className="layout">
        <div className="visual"><div className="title-row"><div><small>ROOM {roomId}　·　{viewMode === 'photo' && roomId === 'A' ? 'PHOTO VIEW' : '3D SPACE VIEW'}</small><h2>{room.name}</h2></div></div>
          {viewMode === 'photo' && roomId === 'A' ? <PhotoGallery photos={roomAPhotos} index={photoIndex} setIndex={setPhotoIndex} /> : <div className="viewer"><ThreeRoom room={room} /><label className="badge">● 자유 시점 3D</label><label className="hint">⟲ 드래그하여 회전　·　스크롤하여 확대/축소</label></div>}
          {viewMode === 'photo' && roomId === 'A' ? <div className="photo-pagination"><button onClick={() => setPhotoIndex((photoIndex + roomAPhotos.length - 1) % roomAPhotos.length)}>← 이전</button><div>{roomAPhotos.map((_, i) => <button key={i} className={photoIndex === i ? 'selected' : ''} aria-label={`${i + 1}번 사진`} aria-pressed={photoIndex === i} onClick={() => setPhotoIndex(i)} />)}</div><span>{photoIndex + 1} / {roomAPhotos.length}</span><button onClick={() => setPhotoIndex((photoIndex + 1) % roomAPhotos.length)}>다음 →</button></div> : <div className="thumbs"><span>▧　객실 전체</span><span>▧　침실</span><span>▦　공간 배치</span><small>3D 모델 미리보기</small></div>}
        </div>
        <aside className="card"><div className="card-title"><h3>{room.name}</h3><div className="room-amenities"><span>침대 1</span><span>쇼파 1</span><span>TV</span></div></div><p className="description">객실을 충분히 탐색한 후 객실확인 완료 버튼을 눌러주세요.</p><hr /><button className="reserve" onClick={() => setSurvey(true)}>객실 확인 완료 <b>→</b></button><p className="reserve-note">선택 후 해당 객실 설문이 표시됩니다</p></aside>
      </section>
    </main>
    {survey && <Survey roomName={room.name} onSubmit={finishRoom} onCancel={() => setSurvey(false)} />}
    {complete && <div className="overlay"><div className="complete"><span>✓</span><small>SESSION COMPLETE</small><h2>두 객실 확인이 완료되었습니다.</h2><p>응답과 확인 시간은 현재 브라우저에 기록됩니다. CSV 파일을 내려받아 보관해 주세요.</p><button className="primary" onClick={exportData}>응답 CSV 다운로드　↓</button><button className="secondary" onClick={endExperiment}>실험 끝내기</button></div></div>}
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
    <button className="photo-arrow previous" aria-label="이전 사진" onClick={() => setIndex((index + photos.length - 1) % photos.length)}>‹</button>
    <button className="photo-arrow next" aria-label="다음 사진" onClick={() => setIndex((index + 1) % photos.length)}>›</button>
  </div>;
}
