import {
  getApps,
  getApp
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';

import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';

import {
  getFunctions,
  httpsCallable
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-functions.js';


/* GREENPARK_TOURNAMENT_SCHEDULE_V6 */
/* GREENPARK_TOURNAMENT_SCHEDULE_COUNT_SYNC_V62 */

const ADMIN_UID =
  'd3nVt6SbQlO6lYnOcCUDbLBhoU02';

let firebaseUser = null;

let currentTournament = null;

let structure = {
  teams:[],
  matches:[],
  teamsCount:0,
  generated:false,
  stale:false,
  hasResults:false,
  format:{}
};

let loading = false;

let obterTorneioAtualCall = null;
let listarEstruturaTorneioCall = null;
let gerarEstruturaTorneioCall = null;


function isAdmin(){
  return (
    firebaseUser &&
    firebaseUser.uid === ADMIN_UID
  );
}


function wait(ms){
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


function initials(name){
  return String(name || 'GP')
    .trim()
    .split(/\s+/)
    .slice(0,2)
    .map(
      part =>
        part.charAt(0)
    )
    .join('')
    .toUpperCase() || 'GP';
}


function teamById(id){
  return (
    structure
      .teams
      .find(
        team =>
          String(team.id) ===
          String(id)
      ) ||
    null
  );
}


function status(
  message = '',
  type = ''
){
  const el =
    document.getElementById(
      'gptv6Status'
    );

  if(!el){
    return;
  }

  el.textContent =
    message;

  el.className =
    'gptv6-status' +
    (type ? ' ' + type : '');
}


function addStyle(){
  if(
    document.getElementById(
      'greenpark-tournament-schedule-v6-style'
    )
  ){
    return;
  }

  const style =
    document.createElement(
      'style'
    );

  style.id =
    'greenpark-tournament-schedule-v6-style';

  style.textContent = `

/* GREENPARK_TOURNAMENT_SCHEDULE_V6 */

.gptv6-root{
  display:flex;
  flex-direction:column;
  gap:10px;
}

.gptv6-admin{
  display:none;
  padding:12px;
  border:1px solid rgba(86,213,46,.25);
  border-radius:13px;
  background:#0b1712;
}

.gptv6-admin.show{
  display:block;
}

.gptv6-admin strong{
  display:block;
  color:#fff;
  font-size:10px;
  text-align:center;
}

.gptv6-admin span{
  display:block;
  margin-top:4px;
  color:#819188;
  font-size:7px;
  line-height:1.4;
  text-align:center;
}

.gptv6-generate{
  width:100%;
  min-height:46px;
  margin-top:9px;
  border:0;
  border-radius:11px;
  background:var(--green);
  color:#102011;
  font-size:9px;
  font-weight:950;
}

.gptv6-generate:disabled{
  opacity:.5;
}

.gptv6-status{
  min-height:14px;
  color:#829188;
  font-size:8px;
  line-height:1.4;
  text-align:center;
}

.gptv6-status.ok{
  color:var(--green2);
}

.gptv6-status.error{
  color:#ff9696;
}

.gptv6-alert{
  padding:10px;
  border:1px solid #725a27;
  border-radius:10px;
  background:#292316;
  color:#e7c66d;
  font-size:8px;
  line-height:1.4;
  text-align:center;
}

.gptv6-summary{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:6px;
}

.gptv6-summary div{
  min-width:0;
  padding:9px 4px;
  border:1px solid #2c4036;
  border-radius:9px;
  background:#0c1713;
  text-align:center;
}

.gptv6-summary strong{
  display:block;
  color:#fff;
  font-size:15px;
}

.gptv6-summary span{
  display:block;
  margin-top:3px;
  color:#7e8e85;
  font-size:6px;
  font-weight:950;
}

.gptv6-empty{
  min-height:105px;
  padding:18px;
  display:flex;
  align-items:center;
  justify-content:center;
  border:1px dashed #344a3e;
  border-radius:12px;
  background:#0b1612;
  color:#829188;
  font-size:9px;
  line-height:1.4;
  text-align:center;
}

.gptv6-section{
  display:flex;
  flex-direction:column;
  gap:7px;
}

.gptv6-section-title{
  margin:4px 0 1px;
  color:var(--green2);
  font-size:8px;
  font-weight:950;
  letter-spacing:.05em;
}

.gptv6-match{
  padding:9px;
  border:1px solid #2b4036;
  border-radius:11px;
  background:#0c1713;
}

.gptv6-match-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  margin-bottom:8px;
  color:#73847b;
  font-size:6.5px;
  font-weight:950;
}

.gptv6-side{
  min-width:0;
  display:grid;
  grid-template-columns:38px minmax(0,1fr) 24px;
  gap:7px;
  align-items:center;
}

.gptv6-side + .gptv6-side{
  margin-top:6px;
}

.gptv6-logo{
  width:38px;
  height:38px;
  overflow:hidden;
  display:grid;
  place-items:center;
  border:1px solid rgba(86,213,46,.22);
  border-radius:10px;
  background:#17231d;
  color:#fff;
  font-size:8px;
  font-weight:950;
}

.gptv6-logo img{
  width:100%;
  height:100%;
  object-fit:contain;
}

.gptv6-team-name{
  min-width:0;
  overflow:hidden;
  color:#fff;
  font-size:9px;
  font-weight:900;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.gptv6-score{
  color:#839089;
  font-size:16px;
  font-weight:950;
  text-align:center;
}

.gptv6-source{
  min-height:32px;
  padding:0 8px;
  display:flex;
  align-items:center;
  border:1px dashed #344a3e;
  border-radius:8px;
  color:#9ba8a1;
  font-size:7px;
  font-weight:850;
}

.gptv6-groups{
  display:flex;
  flex-direction:column;
  gap:9px;
}

.gptv6-group{
  overflow:hidden;
  border:1px solid #2c4036;
  border-radius:12px;
  background:#0c1713;
}

.gptv6-group-title{
  padding:9px 10px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  border-bottom:1px solid #26382f;
}

.gptv6-group-title strong{
  color:#fff;
  font-size:9px;
}

.gptv6-group-title span{
  color:var(--green2);
  font-size:7px;
  font-weight:950;
}

.gptv6-table-head,
.gptv6-table-row{
  display:grid;
  grid-template-columns:22px minmax(0,1fr) 28px 35px;
  gap:5px;
  align-items:center;
}

.gptv6-table-head{
  padding:7px 9px;
  color:#708179;
  font-size:6px;
  font-weight:950;
}

.gptv6-table-row{
  min-height:45px;
  padding:6px 9px;
  border-top:1px solid #22342b;
}

.gptv6-position{
  color:#7e8d85;
  font-size:8px;
  font-weight:950;
  text-align:center;
}

.gptv6-table-team{
  min-width:0;
  display:grid;
  grid-template-columns:30px minmax(0,1fr);
  gap:6px;
  align-items:center;
}

.gptv6-table-logo{
  width:30px;
  height:30px;
  overflow:hidden;
  display:grid;
  place-items:center;
  border-radius:8px;
  background:#17231d;
  color:#fff;
  font-size:6px;
  font-weight:950;
}

.gptv6-table-logo img{
  width:100%;
  height:100%;
  object-fit:contain;
}

.gptv6-table-team strong{
  min-width:0;
  overflow:hidden;
  color:#fff;
  font-size:8px;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.gptv6-number{
  color:#96a39c;
  font-size:8px;
  font-weight:900;
  text-align:center;
}

.gptv6-points{
  color:var(--green2);
  font-size:9px;
  font-weight:950;
  text-align:center;
}

.gptv6-bracket{
  display:flex;
  flex-direction:column;
  gap:7px;
}

@media(max-width:350px){
  .gptv6-summary{
    grid-template-columns:1fr;
  }
}

`;

  document.head.appendChild(
    style
  );
}


function imageBox(
  className,
  team
){
  const box =
    document.createElement(
      'div'
    );

  box.className =
    className;

  const url =
    String(
      team?.logoURL || ''
    ).trim();

  if(
    url.startsWith('https://') ||
    url.startsWith('http://')
  ){
    const img =
      document.createElement(
        'img'
      );

    img.src = url;
    img.alt =
      team?.name || 'Equipe';

    img.loading =
      'lazy';

    img.addEventListener(
      'error',
      () => {
        box.innerHTML = '';
        box.textContent =
          initials(
            team?.name
          );
      },
      {once:true}
    );

    box.appendChild(
      img
    );
  }else{
    box.textContent =
      initials(
        team?.name
      );
  }

  return box;
}


function cleanPanel(
  panelName,
  rootId
){
  const panel =
    document.querySelector(
      '#tournamentsView ' +
      '[data-tournament-panel="' +
      panelName +
      '"]'
    );

  if(!panel){
    return null;
  }

  const head =
    panel.querySelector(
      '.gptournament-panel-head'
    );

  if(!head){
    return null;
  }

  if(
    document.getElementById(
      rootId
    )
  ){
    return panel;
  }

  Array.from(
    panel.children
  ).forEach(
    child => {
      if(child !== head){
        child.remove();
      }
    }
  );

  const root =
    document.createElement(
      'div'
    );

  root.id =
    rootId;

  root.className =
    'gptv6-root';

  panel.appendChild(
    root
  );

  return panel;
}


function ensureUI(){
  addStyle();

  const matchesPanel =
    cleanPanel(
      'matches',
      'gptv6MatchesRoot'
    );

  const standingsPanel =
    cleanPanel(
      'standings',
      'gptv6StandingsRoot'
    );

  const bracketPanel =
    cleanPanel(
      'bracket',
      'gptv6BracketRoot'
    );

  if(
    !matchesPanel ||
    !standingsPanel ||
    !bracketPanel
  ){
    return false;
  }

  const matchesRoot =
    document.getElementById(
      'gptv6MatchesRoot'
    );

  if(
    matchesRoot &&
    !document.getElementById(
      'gptv6Generate'
    )
  ){
    matchesRoot.innerHTML = `
      <div
        id="gptv6Admin"
        class="gptv6-admin"
      >
        <strong>
          SORTEIO E TABELA OFICIAL
        </strong>

        <span id="gptv6AdminInfo">
          Cadastre todas as equipes antes de gerar.
        </span>

        <button
          id="gptv6Generate"
          class="gptv6-generate"
          type="button"
        >
          SORTEAR GRUPOS E GERAR JOGOS
        </button>
      </div>

      <div
        id="gptv6Status"
        class="gptv6-status"
      ></div>

      <div
        id="gptv6MatchesContent"
      ></div>
    `;

    document
      .getElementById(
        'gptv6Generate'
      )
      ?.addEventListener(
        'click',
        generateStructure
      );
  }

  updateAdminVisibility();

  return true;
}


function updateAdminVisibility(){
  const admin =
    document.getElementById(
      'gptv6Admin'
    );

  if(admin){
    admin.classList.toggle(
      'show',
      isAdmin()
    );
  }
}


function teamName(team){
  return String(
    team?.name ||
    'Equipe'
  ).toLocaleUpperCase(
    'pt-BR'
  );
}


function renderTeamSide(
  teamId,
  source
){
  if(teamId){
    const team =
      teamById(
        teamId
      );

    const row =
      document.createElement(
        'div'
      );

    row.className =
      'gptv6-side';

    row.appendChild(
      imageBox(
        'gptv6-logo',
        team
      )
    );

    const name =
      document.createElement(
        'div'
      );

    name.className =
      'gptv6-team-name';

    name.textContent =
      teamName(team);

    const score =
      document.createElement(
        'div'
      );

    score.className =
      'gptv6-score';

    score.textContent =
      '–';

    row.append(
      name,
      score
    );

    return row;
  }

  const sourceBox =
    document.createElement(
      'div'
    );

  sourceBox.className =
    'gptv6-source';

  sourceBox.textContent =
    source ||
    'A DEFINIR';

  return sourceBox;
}


function matchCard(match){
  const card =
    document.createElement(
      'article'
    );

  card.className =
    'gptv6-match';

  const head =
    document.createElement(
      'div'
    );

  head.className =
    'gptv6-match-head';

  const stage =
    document.createElement(
      'span'
    );

  stage.textContent =
    match.stage === 'group' ?
      (
        match.groupLabel +
        ' • RODADA ' +
        match.round
      ) :
      match.stageLabel;

  const state =
    document.createElement(
      'span'
    );

  state.textContent =
    'AGENDADO';

  head.append(
    stage,
    state
  );

  card.appendChild(
    head
  );

  card.appendChild(
    renderTeamSide(
      match.homeTeamId,
      match.homeSource
    )
  );

  card.appendChild(
    renderTeamSide(
      match.awayTeamId,
      match.awaySource
    )
  );

  return card;
}


function renderAdmin(){
  const button =
    document.getElementById(
      'gptv6Generate'
    );

  const info =
    document.getElementById(
      'gptv6AdminInfo'
    );

  if(
    !button ||
    !info
  ){
    return;
  }

  const total =
    structure.teams.length;

  const required =
    Number(
      structure.teamsCount || 0
    );

  if(
    total !== required
  ){
    button.disabled =
      true;

    button.textContent =
      'CADASTRE TODAS AS EQUIPES';

    info.textContent =
      total +
      ' de ' +
      required +
      ' equipes cadastradas.';

    return;
  }

  if(
    structure.hasResults
  ){
    button.disabled =
      true;

    button.textContent =
      'SORTEIO BLOQUEADO';

    info.textContent =
      'Já existem resultados lançados.';

    return;
  }

  button.disabled =
    false;

  if(
    structure.generated
  ){
    button.textContent =
      structure.stale ?
        'ATUALIZAR GRUPOS E JOGOS' :
        'REFAZER SORTEIO E JOGOS';

    info.textContent =
      structure.stale ?
        'As equipes ou o formato mudaram desde o último sorteio.' :
        'Estrutura já gerada. Você pode refazer enquanto não houver resultados.';
  }else{
    button.textContent =
      'SORTEAR GRUPOS E GERAR JOGOS';

    info.textContent =
      required +
      ' equipes prontas para o sorteio.';
  }
}


function renderSummary(
  container
){
  const groupMatches =
    structure.matches.filter(
      match =>
        match.stage ===
        'group'
    ).length;

  const knockoutMatches =
    structure.matches.length -
    groupMatches;

  const summary =
    document.createElement(
      'div'
    );

  summary.className =
    'gptv6-summary';

  [
    [
      structure.teams.length,
      'EQUIPES'
    ],
    [
      groupMatches,
      'FASE DE GRUPOS'
    ],
    [
      knockoutMatches,
      'MATA-MATA'
    ]
  ].forEach(
    ([value,label]) => {
      const card =
        document.createElement(
          'div'
        );

      const strong =
        document.createElement(
          'strong'
        );

      strong.textContent =
        String(value);

      const span =
        document.createElement(
          'span'
        );

      span.textContent =
        label;

      card.append(
        strong,
        span
      );

      summary.appendChild(
        card
      );
    }
  );

  container.appendChild(
    summary
  );
}


function renderMatches(){
  const container =
    document.getElementById(
      'gptv6MatchesContent'
    );

  if(!container){
    return;
  }

  container.innerHTML = '';

  if(
    structure.stale
  ){
    const alert =
      document.createElement(
        'div'
      );

    alert.className =
      'gptv6-alert';

    alert.textContent =
      'A estrutura está desatualizada. O Admin precisa gerar novamente os grupos e jogos.';

    container.appendChild(
      alert
    );
  }

  if(
    !structure.generated
  ){
    container.innerHTML +=
      '<div class="gptv6-empty">' +
      'Os grupos e jogos ainda não foram gerados.' +
      '</div>';

    return;
  }

  renderSummary(
    container
  );

  const groupMatches =
    structure.matches.filter(
      match =>
        match.stage ===
        'group'
    );

  const groups =
    [...new Set(
      groupMatches.map(
        match =>
          match.groupId
      )
    )];

  groups.forEach(
    id => {
      const section =
        document.createElement(
          'section'
        );

      section.className =
        'gptv6-section';

      const matches =
        groupMatches.filter(
          match =>
            match.groupId === id
        );

      const title =
        document.createElement(
          'div'
        );

      title.className =
        'gptv6-section-title';

      title.textContent =
        matches[0]?.groupLabel ||
        'FASE DE GRUPOS';

      section.appendChild(
        title
      );

      matches.forEach(
        match =>
          section.appendChild(
            matchCard(match)
          )
      );

      container.appendChild(
        section
      );
    }
  );
}


function renderStandings(){
  const root =
    document.getElementById(
      'gptv6StandingsRoot'
    );

  if(!root){
    return;
  }

  root.innerHTML = '';

  if(
    !structure.generated
  ){
    root.innerHTML =
      '<div class="gptv6-empty">' +
      'A classificação aparecerá depois do sorteio dos grupos.' +
      '</div>';

    return;
  }

  const grouped = {};

  structure.teams.forEach(
    team => {
      const id =
        String(
          team.groupId ||
          'U'
        );

      if(!grouped[id]){
        grouped[id] = [];
      }

      grouped[id].push(
        team
      );
    }
  );

  const wrap =
    document.createElement(
      'div'
    );

  wrap.className =
    'gptv6-groups';

  Object.keys(grouped)
    .sort()
    .forEach(
      id => {
        const teams =
          grouped[id]
            .sort(
              (a,b) =>
                Number(
                  a.groupOrder || 0
                ) -
                Number(
                  b.groupOrder || 0
                )
            );

        const card =
          document.createElement(
            'section'
          );

        card.className =
          'gptv6-group';

        const title =
          document.createElement(
            'div'
          );

        title.className =
          'gptv6-group-title';

        const strong =
          document.createElement(
            'strong'
          );

        strong.textContent =
          id === 'U' ?
            'GRUPO ÚNICO' :
            'GRUPO ' + id;

        const count =
          document.createElement(
            'span'
          );

        count.textContent =
          teams.length +
          ' EQUIPES';

        title.append(
          strong,
          count
        );

        card.appendChild(
          title
        );

        const head =
          document.createElement(
            'div'
          );

        head.className =
          'gptv6-table-head';

        head.innerHTML =
          '<span>#</span>' +
          '<span>EQUIPE</span>' +
          '<span>J</span>' +
          '<span>PTS</span>';

        card.appendChild(
          head
        );

        teams.forEach(
          (team,index) => {
            const row =
              document.createElement(
                'div'
              );

            row.className =
              'gptv6-table-row';

            const position =
              document.createElement(
                'div'
              );

            position.className =
              'gptv6-position';

            position.textContent =
              String(index + 1);

            const teamCell =
              document.createElement(
                'div'
              );

            teamCell.className =
              'gptv6-table-team';

            teamCell.appendChild(
              imageBox(
                'gptv6-table-logo',
                team
              )
            );

            const name =
              document.createElement(
                'strong'
              );

            name.textContent =
              teamName(team);

            teamCell.appendChild(
              name
            );

            const games =
              document.createElement(
                'div'
              );

            games.className =
              'gptv6-number';

            games.textContent =
              '0';

            const points =
              document.createElement(
                'div'
              );

            points.className =
              'gptv6-points';

            points.textContent =
              '0';

            row.append(
              position,
              teamCell,
              games,
              points
            );

            card.appendChild(
              row
            );
          }
        );

        wrap.appendChild(
          card
        );
      }
    );

  root.appendChild(
    wrap
  );
}


function renderBracket(){
  const root =
    document.getElementById(
      'gptv6BracketRoot'
    );

  if(!root){
    return;
  }

  root.innerHTML = '';

  const knockout =
    structure.matches.filter(
      match =>
        match.stage !==
        'group'
    );

  if(!knockout.length){
    root.innerHTML =
      '<div class="gptv6-empty">' +
      'O mata-mata aparecerá depois da geração da tabela.' +
      '</div>';

    return;
  }

  const stages = [
    [
      'quarterfinal',
      'QUARTAS DE FINAL'
    ],
    [
      'semifinal',
      'SEMIFINAIS'
    ],
    [
      'final',
      'FINAL'
    ]
  ];

  const wrap =
    document.createElement(
      'div'
    );

  wrap.className =
    'gptv6-bracket';

  stages.forEach(
    ([stage,label]) => {
      const matches =
        knockout.filter(
          match =>
            match.stage ===
            stage
        );

      if(!matches.length){
        return;
      }

      const title =
        document.createElement(
          'div'
        );

      title.className =
        'gptv6-section-title';

      title.textContent =
        label;

      wrap.appendChild(
        title
      );

      matches.forEach(
        match =>
          wrap.appendChild(
            matchCard(match)
          )
      );
    }
  );

  root.appendChild(
    wrap
  );
}


function renderAll(){
  if(!ensureUI()){
    return;
  }

  updateAdminVisibility();
  renderAdmin();
  renderMatches();
  renderStandings();
  renderBracket();

  const standingsHead =
    document.querySelector(
      '#tournamentsView ' +
      '[data-tournament-panel="standings"] ' +
      '.gptournament-panel-head span'
    );

  if(
    standingsHead &&
    structure.generated
  ){
    standingsHead.textContent =
      structure.format?.label ||
      'Classificação';
  }

  const matchesHead =
    document.querySelector(
      '#tournamentsView ' +
      '[data-tournament-panel="matches"] ' +
      '.gptournament-panel-head span'
    );

  if(
    matchesHead &&
    structure.generated
  ){
    matchesHead.textContent =
      structure.matches.length +
      ' jogos gerados';
  }
}


async function loadStructure(){
  if(
    loading ||
    !firebaseUser
  ){
    return;
  }

  if(!ensureUI()){
    return;
  }

  loading = true;

  try{
    const current =
      await obterTorneioAtualCall(
        {}
      );

    if(
      current.data?.exists !==
      true
    ){
      currentTournament =
        null;

      structure = {
        teams:[],
        matches:[],
        teamsCount:0,
        generated:false,
        stale:false,
        hasResults:false,
        format:{}
      };

      renderAll();
      return;
    }

    currentTournament =
      current.data.tournament;

    const response =
      await listarEstruturaTorneioCall({
        tournamentId:
          currentTournament.id
      });

    structure = {
      teams:
        Array.isArray(
          response.data?.teams
        ) ?
          response.data.teams :
          [],

      matches:
        Array.isArray(
          response.data?.matches
        ) ?
          response.data.matches :
          [],

      teamsCount:
        Number(
          response.data
            ?.teamsCount ||
          0
        ),

      generated:
        response.data
          ?.generated ===
        true,

      stale:
        response.data
          ?.stale ===
        true,

      hasResults:
        response.data
          ?.hasResults ===
        true,

      format:
        response.data
          ?.format ||
        {}
    };

    status('');

    renderAll();

  }catch(error){
    console.error(
      'Estrutura torneio V6:',
      error
    );

    status(
      error?.message ||
      'Não foi possível carregar a tabela.',
      'error'
    );

  }finally{
    loading = false;
  }
}


async function generateStructure(){
  if(
    !isAdmin() ||
    !currentTournament?.id
  ){
    return;
  }

  if(
    structure.hasResults
  ){
    status(
      'Já existem resultados. O sorteio está protegido.',
      'error'
    );

    return;
  }

  let force =
    false;

  if(
    structure.generated
  ){
    const message =
      structure.stale ?
        (
          'ATUALIZAR GRUPOS E JOGOS?\n\n' +
          'A estrutura atual será substituída pelo novo sorteio.'
        ) :
        (
          'REFAZER O SORTEIO?\n\n' +
          'Os grupos e jogos atuais serão sorteados novamente.'
        );

    if(!confirm(message)){
      return;
    }

    force = true;
  }

  const button =
    document.getElementById(
      'gptv6Generate'
    );

  if(button){
    button.disabled =
      true;

    button.textContent =
      'SORTEANDO...';
  }

  status(
    'Sorteando equipes e gerando os jogos...'
  );

  try{
    const response =
      await gerarEstruturaTorneioCall({
        tournamentId:
          currentTournament.id,
        force
      });

    const data =
      response.data || {};

    await loadStructure();

    status(
      'Sorteio concluído: ' +
      Number(
        data.totalMatches || 0
      ) +
      ' jogos gerados.',
      'ok'
    );

  }catch(error){
    console.error(
      'Gerar torneio V6:',
      error
    );

    status(
      error?.message ||
      'Não foi possível gerar os grupos.',
      'error'
    );

  }finally{
    renderAdmin();
  }
}


async function waitForApp(){
  for(
    let attempt = 0;
    attempt < 70;
    attempt += 1
  ){
    if(getApps().length){
      return getApp();
    }

    await wait(
      100
    );
  }

  throw new Error(
    'Firebase principal não iniciou.'
  );
}


async function init(){
  addStyle();

  for(
    let attempt = 0;
    attempt < 50;
    attempt += 1
  ){
    if(ensureUI()){
      break;
    }

    await wait(100);
  }

  const app =
    await waitForApp();

  const auth =
    getAuth(
      app
    );

  const functions =
    getFunctions(
      app,
      'southamerica-east1'
    );

  obterTorneioAtualCall =
    httpsCallable(
      functions,
      'obterTorneioAtual'
    );

  listarEstruturaTorneioCall =
    httpsCallable(
      functions,
      'listarEstruturaTorneio'
    );

  gerarEstruturaTorneioCall =
    httpsCallable(
      functions,
      'gerarEstruturaTorneio'
    );

  onAuthStateChanged(
    auth,
    user => {
      firebaseUser =
        user;

      updateAdminVisibility();

      setTimeout(
        loadStructure,
        300
      );
    }
  );

  window.addEventListener(
    'greenpark:tournament-teams-count-saved',
    event => {

      const savedTeams =
        Number(
          event.detail?.teamsCount
        );

      if(
        Number.isInteger(savedTeams) &&
        savedTeams >= 3 &&
        savedTeams <= 32
      ){
        structure.teamsCount =
          savedTeams;

        renderAll();
      }

      setTimeout(
        loadStructure,
        150
      );

      setTimeout(
        loadStructure,
        900
      );

    }
  );


  document.addEventListener(
    'click',
    event => {
      const tab =
        event.target
          ?.closest?.(
            '[data-tournament-tab]'
          );

      const tabName =
        tab?.dataset
          ?.tournamentTab ||
        '';

      if(
        [
          'matches',
          'standings',
          'bracket'
        ].includes(
          tabName
        )
      ){
        setTimeout(
          loadStructure,
          120
        );
      }

      const buttonId =
        event.target
          ?.closest?.(
            'button'
          )
          ?.id ||
        '';

      if(
        [
          'gptv5Save',
          'gptv44TeamsSave',
          'tournamentSaveButton',
          'openTournamentsQuick'
        ].includes(
          buttonId
        )
      ){
        setTimeout(
          loadStructure,
          1000
        );
      }
    }
  );

  const view =
    document.getElementById(
      'tournamentsView'
    );

  if(view){
    const observer =
      new MutationObserver(
        () => {
          if(
            view.classList
              .contains(
                'active'
              )
          ){
            setTimeout(
              loadStructure,
              180
            );
          }
        }
      );

    observer.observe(
      view,
      {
        attributes:true,
        attributeFilter:[
          'class'
        ]
      }
    );
  }
}


init().catch(error => {
  console.error(
    'Tournament Schedule V6:',
    error
  );
});
