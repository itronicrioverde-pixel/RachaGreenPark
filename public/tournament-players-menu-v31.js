/* GREENPARK_TOURNAMENT_PLAYERS_MENU_V31 */

let currentSector =
  'menu';

let listObserver =
  null;


function wait(ms){
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


function isAdminUi(){
  const admin =
    document.getElementById(
      'gptv3Admin'
    );

  return (
    document.body
      .classList
      .contains(
        'admin-authenticated'
      ) ||
    admin
      ?.classList
      .contains(
        'show'
      )
  );
}


function addStyle(){

  if(
    document.getElementById(
      'greenpark-tournament-players-menu-v31-style'
    )
  ){
    return;
  }


  const style =
    document.createElement(
      'style'
    );


  style.id =
    'greenpark-tournament-players-menu-v31-style';


  style.textContent = `

/* GREENPARK_TOURNAMENT_PLAYERS_MENU_V31 */

#gptv31Root{
  display:flex;
  flex-direction:column;
  gap:10px;
}


/* O admin antigo continua existindo apenas
   como referencia para o modulo V3. */
#gptv31Root #gptv3Admin{
  position:absolute!important;
  width:1px!important;
  height:1px!important;
  overflow:hidden!important;
  opacity:0!important;
  pointer-events:none!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
}


/* RESUMO */

.gptv31-summary{
  display:grid;
  grid-template-columns:
    repeat(4,minmax(0,1fr));
  gap:5px;
}

.gptv31-summary .gptv3-metrics{
  display:contents!important;
  margin:0!important;
}

.gptv31-summary
.gptv3-metrics > div{
  min-width:0;
  min-height:58px;
  padding:8px 2px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  border:1px solid #2a4035;
  border-radius:10px;
  background:#0d1914;
}


/* MENU DE SETORES */

.gptv31-menu{
  display:flex;
  flex-direction:column;
  gap:7px;
}

.gptv31-sector-button{
  width:100%;
  min-height:64px;
  padding:10px 12px;
  display:grid;
  grid-template-columns:
    42px minmax(0,1fr) 22px;
  gap:9px;
  align-items:center;

  border:1px solid #2d4338;
  border-radius:13px;

  background:#0c1713;
  color:#fff;

  text-align:left;
}

.gptv31-sector-button:active{
  transform:scale(.99);
}

.gptv31-sector-icon{
  width:42px;
  height:42px;

  display:flex;
  align-items:center;
  justify-content:center;

  border:1px solid
    rgba(86,213,46,.25);
  border-radius:11px;

  background:#12251a;
  color:var(--green2);

  font-size:18px;
  font-weight:950;
}

.gptv31-sector-text{
  min-width:0;
}

.gptv31-sector-text strong{
  display:block;
  color:#fff;
  font-size:10px;
  font-weight:950;
}

.gptv31-sector-text span{
  display:block;
  margin-top:4px;

  color:#788a80;

  font-size:7px;
  line-height:1.35;
}

.gptv31-sector-arrow{
  color:var(--green2);
  font-size:20px;
  text-align:right;
}


/* SETOR */

.gptv31-section{
  display:none;
  flex-direction:column;
  gap:9px;
}

.gptv31-section.active{
  display:flex;
}

.gptv31-section-head{
  min-height:48px;

  display:grid;
  grid-template-columns:
    42px minmax(0,1fr);
  gap:8px;
  align-items:center;

  padding-bottom:8px;

  border-bottom:
    1px solid #25382f;
}

.gptv31-back{
  width:42px;
  height:42px;

  border:1px solid #344a3f;
  border-radius:10px;

  background:#111c17;
  color:#fff;

  font-size:19px;
}

.gptv31-section-head strong{
  display:block;

  color:#fff;

  font-size:11px;
  font-weight:950;
}

.gptv31-section-head span{
  display:block;

  margin-top:3px;

  color:#74867c;

  font-size:7px;
  line-height:1.3;
}


/* BUSCA DE JOGADORES INSCRITOS */

.gptv31-registered-search{
  height:43px;

  display:grid;
  grid-template-columns:
    35px minmax(0,1fr);
  align-items:center;

  border:1px solid #34464e;
  border-radius:10px;

  background:#111a21;
}

.gptv31-registered-search span{
  color:var(--green2);
  text-align:center;
  font-size:17px;
}

.gptv31-registered-search input{
  width:100%;
  min-width:0;
  height:100%;

  padding:0 10px 0 0;

  border:0;
  outline:0;

  background:transparent;
  color:#fff;
}


/* LISTA SOMENTE QUANDO ABERTA */

#gptv31Root[data-v31-mode="menu"]
#gptv3List,

#gptv31Root[data-v31-mode="add"]
#gptv3List{
  display:none!important;
}


/* JOGADORES CADASTRADOS:
   nao polui com botoes de pagamento */

#gptv31Root[data-v31-mode="registered"]
#gptv3List
.gptv3-actions
button:not(.remove){
  display:none!important;
}


/* PAGAMENTOS:
   nao mostra remover jogador */

#gptv31Root[data-v31-mode="payments"]
#gptv3List
.gptv3-actions
.remove{
  display:none!important;
}


/* STATUS */

#gptv31Root[data-v31-mode="menu"]
#gptv3Status{
  display:none;
}


/* PAGAMENTOS */

.gptv31-payment-note{
  padding:10px;

  border:1px solid #2c4036;
  border-radius:10px;

  background:#0b1712;

  color:#819188;

  font-size:8px;
  line-height:1.45;
  text-align:center;
}


/* NÃO ADMIN */

.gptv31-admin-only.hidden{
  display:none!important;
}


@media(max-width:370px){

  .gptv31-summary{
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

}

`;

  document.head.appendChild(
    style
  );
}


function sectionHead(
  title,
  subtitle
){
  const head =
    document.createElement(
      'div'
    );

  head.className =
    'gptv31-section-head';


  const back =
    document.createElement(
      'button'
    );

  back.type =
    'button';

  back.className =
    'gptv31-back';

  back.textContent =
    '←';

  back.setAttribute(
    'aria-label',
    'Voltar'
  );

  back.addEventListener(
    'click',
    () =>
      showSector(
        'menu'
      )
  );


  const text =
    document.createElement(
      'div'
    );


  const strong =
    document.createElement(
      'strong'
    );

  strong.textContent =
    title;


  const span =
    document.createElement(
      'span'
    );

  span.textContent =
    subtitle;


  text.append(
    strong,
    span
  );


  head.append(
    back,
    text
  );


  return head;
}


function menuButton(
  type,
  icon,
  title,
  subtitle,
  adminOnly = false
){
  const button =
    document.createElement(
      'button'
    );

  button.type =
    'button';

  button.className =
    'gptv31-sector-button';

  button.dataset.v31Sector =
    type;


  if(adminOnly){
    button.classList.add(
      'gptv31-admin-only'
    );
  }


  const iconBox =
    document.createElement(
      'span'
    );

  iconBox.className =
    'gptv31-sector-icon';

  iconBox.textContent =
    icon;


  const text =
    document.createElement(
      'span'
    );

  text.className =
    'gptv31-sector-text';


  const strong =
    document.createElement(
      'strong'
    );

  strong.textContent =
    title;


  const small =
    document.createElement(
      'span'
    );

  small.textContent =
    subtitle;


  text.append(
    strong,
    small
  );


  const arrow =
    document.createElement(
      'span'
    );

  arrow.className =
    'gptv31-sector-arrow';

  arrow.textContent =
    '›';


  button.append(
    iconBox,
    text,
    arrow
  );


  button.addEventListener(
    'click',
    () =>
      showSector(
        type
      )
  );


  return button;
}


function filterRegisteredPlayers(){

  const input =
    document.getElementById(
      'gptv31RegisteredSearch'
    );

  const list =
    document.getElementById(
      'gptv3List'
    );


  if(
    !input ||
    !list
  ){
    return;
  }


  const query =
    String(
      input.value || ''
    )
      .trim()
      .toLocaleLowerCase(
        'pt-BR'
      );


  list
    .querySelectorAll(
      '.gptv3-row'
    )
    .forEach(
      row => {

        const text =
          String(
            row.textContent || ''
          )
            .toLocaleLowerCase(
              'pt-BR'
            );


        row.style.display =
          !query ||
          text.includes(
            query
          ) ?
            '' :
            'none';

      }
    );
}


function syncAdminVisibility(){

  const admin =
    isAdminUi();


  document
    .querySelectorAll(
      '#gptv31Root ' +
      '.gptv31-admin-only'
    )
    .forEach(
      element => {

        element.classList.toggle(
          'hidden',
          !admin
        );

      }
    );


  if(
    !admin &&
    (
      currentSector ===
      'add' ||
      currentSector ===
      'payments'
    )
  ){
    showSector(
      'menu'
    );
  }
}


function moveListTo(
  hostId
){
  const list =
    document.getElementById(
      'gptv3List'
    );

  const host =
    document.getElementById(
      hostId
    );


  if(
    list &&
    host &&
    list.parentElement !== host
  ){
    host.appendChild(
      list
    );
  }
}


function showSector(
  type
){

  const root =
    document.getElementById(
      'gptv31Root'
    );

  if(!root){
    return;
  }


  if(
    (
      type === 'add' ||
      type === 'payments'
    ) &&
    !isAdminUi()
  ){
    type =
      'menu';
  }


  currentSector =
    type;

  root.dataset.v31Mode =
    type;


  const menu =
    document.getElementById(
      'gptv31Menu'
    );

  if(menu){
    menu.style.display =
      type === 'menu' ?
        'flex' :
        'none';
  }


  [
    'add',
    'payments',
    'registered'
  ].forEach(
    name => {

      document
        .getElementById(
          'gptv31Section-' +
          name
        )
        ?.classList
        .toggle(
          'active',
          type === name
        );

    }
  );


  if(type === 'payments'){

    moveListTo(
      'gptv31PaymentListHost'
    );

  }


  if(type === 'registered'){

    moveListTo(
      'gptv31RegisteredListHost'
    );

    setTimeout(
      filterRegisteredPlayers,
      0
    );

  }


  if(type === 'add'){

    setTimeout(
      () => {

        document
          .getElementById(
            'gptv3Search'
          )
          ?.focus();

      },
      50
    );

  }


  if(type === 'registered'){

    setTimeout(
      () => {

        document
          .getElementById(
            'gptv31RegisteredSearch'
          )
          ?.focus();

      },
      50
    );

  }


  window.scrollTo({
    top:
      document
        .getElementById(
          'gptv3Panel'
        )
        ?.offsetTop ||
      0,

    behavior:
      'smooth'
  });

}


function buildMenu(){

  const panel =
    document.getElementById(
      'gptv3Panel'
    );

  const admin =
    document.getElementById(
      'gptv3Admin'
    );

  const list =
    document.getElementById(
      'gptv3List'
    );


  if(
    !panel ||
    !admin ||
    !list
  ){
    return false;
  }


  if(
    document.getElementById(
      'gptv31Root'
    )
  ){
    syncAdminVisibility();
    return true;
  }


  const fee =
    panel.querySelector(
      '.gptv3-fee'
    );

  const metrics =
    admin.querySelector(
      '.gptv3-metrics'
    );

  const labels =
    Array.from(
      admin.querySelectorAll(
        '.gptv3-label'
      )
    );

  const feeEditor =
    admin.querySelector(
      '.gptv3-fee-editor'
    );

  const addSearch =
    admin.querySelector(
      '.gptv3-search'
    );

  const results =
    document.getElementById(
      'gptv3Results'
    );

  const note =
    admin.querySelector(
      '.gptv3-note'
    );

  const status =
    document.getElementById(
      'gptv3Status'
    );


  if(
    !fee ||
    !metrics ||
    labels.length < 2 ||
    !feeEditor ||
    !addSearch ||
    !results ||
    !status
  ){
    return false;
  }


  const root =
    document.createElement(
      'div'
    );

  root.id =
    'gptv31Root';

  root.dataset.v31Mode =
    'menu';


  /* RESUMO */
  const summary =
    document.createElement(
      'div'
    );

  summary.className =
    'gptv31-summary ' +
    'gptv31-admin-only';

  summary.appendChild(
    metrics
  );


  /* MENU */
  const menu =
    document.createElement(
      'div'
    );

  menu.id =
    'gptv31Menu';

  menu.className =
    'gptv31-menu';


  menu.appendChild(
    menuButton(
      'add',
      '+',
      'ADICIONAR JOGADOR',
      'Buscar um cadastro existente e incluir no campeonato.',
      true
    )
  );


  menu.appendChild(
    menuButton(
      'payments',
      '$',
      'CONTROLE DE PAGAMENTOS',
      'Valor da inscrição, pendentes, pagos e isentos.',
      true
    )
  );


  const registeredButton =
    menuButton(
      'registered',
      '☰',
      'JOGADORES CADASTRADOS',
      'Abrir a lista completa de inscritos neste campeonato.'
    );

  registeredButton.id =
    'gptv31RegisteredButton';

  menu.appendChild(
    registeredButton
  );


  /* ADICIONAR */
  const addSection =
    document.createElement(
      'section'
    );

  addSection.id =
    'gptv31Section-add';

  addSection.className =
    'gptv31-section';


  addSection.appendChild(
    sectionHead(
      'ADICIONAR JOGADOR',
      'Inclua jogadores já cadastrados no Green Park.'
    )
  );


  addSection.appendChild(
    labels[1]
  );

  addSection.appendChild(
    addSearch
  );

  addSection.appendChild(
    results
  );

  if(note){
    addSection.appendChild(
      note
    );
  }


  /* PAGAMENTOS */
  const paymentSection =
    document.createElement(
      'section'
    );

  paymentSection.id =
    'gptv31Section-payments';

  paymentSection.className =
    'gptv31-section';


  paymentSection.appendChild(
    sectionHead(
      'CONTROLE DE PAGAMENTOS',
      'Controle individual dos inscritos.'
    )
  );


  paymentSection.appendChild(
    labels[0]
  );

  paymentSection.appendChild(
    feeEditor
  );


  const paymentNote =
    document.createElement(
      'div'
    );

  paymentNote.className =
    'gptv31-payment-note';

  paymentNote.textContent =
    'A lista abaixo mostra somente o controle do pagamento.';


  paymentSection.appendChild(
    paymentNote
  );


  const paymentListHost =
    document.createElement(
      'div'
    );

  paymentListHost.id =
    'gptv31PaymentListHost';

  paymentSection.appendChild(
    paymentListHost
  );


  /* CADASTRADOS */
  const registeredSection =
    document.createElement(
      'section'
    );

  registeredSection.id =
    'gptv31Section-registered';

  registeredSection.className =
    'gptv31-section';


  registeredSection.appendChild(
    sectionHead(
      'JOGADORES CADASTRADOS',
      'Todos os inscritos no campeonato.'
    )
  );


  const registeredSearch =
    document.createElement(
      'label'
    );

  registeredSearch.className =
    'gptv31-registered-search';


  registeredSearch.innerHTML = `
    <span>⌕</span>
    <input
      id="gptv31RegisteredSearch"
      type="search"
      autocomplete="off"
      placeholder="Buscar jogador inscrito..."
    >
  `;


  registeredSection.appendChild(
    registeredSearch
  );


  const registeredListHost =
    document.createElement(
      'div'
    );

  registeredListHost.id =
    'gptv31RegisteredListHost';


  registeredListHost.appendChild(
    list
  );


  registeredSection.appendChild(
    registeredListHost
  );


  /* MONTA */
  root.append(
    summary,
    menu,
    addSection,
    paymentSection,
    registeredSection,
    admin,
    status
  );


  fee.after(
    root
  );


  document
    .getElementById(
      'gptv31RegisteredSearch'
    )
    ?.addEventListener(
      'input',
      filterRegisteredPlayers
    );


  listObserver =
    new MutationObserver(
      () => {

        if(
          currentSector ===
          'registered'
        ){
          filterRegisteredPlayers();
        }

      }
    );


  listObserver.observe(
    list,
    {
      childList:true,
      subtree:true
    }
  );


  const adminObserver =
    new MutationObserver(
      syncAdminVisibility
    );


  adminObserver.observe(
    admin,
    {
      attributes:true,
      attributeFilter:[
        'class'
      ]
    }
  );


  const bodyObserver =
    new MutationObserver(
      syncAdminVisibility
    );


  bodyObserver.observe(
    document.body,
    {
      attributes:true,
      attributeFilter:[
        'class'
      ]
    }
  );


  syncAdminVisibility();

  showSector(
    'menu'
  );


  return true;
}


async function init(){

  addStyle();


  for(
    let attempt = 0;
    attempt < 100;
    attempt += 1
  ){

    if(buildMenu()){
      return;
    }

    await wait(
      100
    );

  }


  console.warn(
    'Tournament Players Menu V3.1: ' +
    'interface V3 nao apareceu.'
  );
}


init();
